import { PersonalScoreService } from './PersonalScoreService';
import { UnifiedSearchManager, SearchSession } from './UnifiedSearchManager';
import { SearchResult } from './LibrarySearchService';
import { DatabaseManager } from '../database/DatabaseManager';

export interface PersonalizedSearchOptions {
  includePersonalScore?: boolean;
  personalScoreWeight?: number; // 0-1, how much to weight personal score vs relevance
  favoriteBoost?: boolean;
  excludeSkipped?: boolean;
  minPlayCount?: number;
}

export interface PersonalizedSearchResult extends SearchResult {
  personalScore?: number;
  playCount?: number;
  rating?: number;
  favorite?: boolean;
  lastPlayed?: Date;
  relevanceScore?: number;
  finalScore?: number;
}

/**
 * Week 3 Day 4: Personalized Search Service
 * 
 * Enhances search results with personal scoring and preferences,
 * providing a tailored search experience based on user behavior.
 */
export class PersonalizedSearchService {
  private personalScoreService: PersonalScoreService;
  private searchManager: UnifiedSearchManager;
  private defaultOptions: Required<PersonalizedSearchOptions> = {
    includePersonalScore: true,
    personalScoreWeight: 0.3, // 30% personal, 70% relevance
    favoriteBoost: true,
    excludeSkipped: false,
    minPlayCount: 0
  };
  
  constructor(
    personalScoreService: PersonalScoreService,
    searchManager: UnifiedSearchManager
  ) {
    this.personalScoreService = personalScoreService;
    this.searchManager = searchManager;
  }
  
  /**
   * Perform personalized search
   */
  async search(
    query: string,
    options: PersonalizedSearchOptions = {}
  ): Promise<SearchSession<PersonalizedSearchResult>> {
    const searchOptions = { ...this.defaultOptions, ...options };
    
    // Perform base search
    const baseSession = await this.searchManager.search(query);
    
    // Enhance results with personal scores
    const enhancedResults = await this.enhanceWithPersonalScores(
      baseSession.results,
      query,
      searchOptions
    );
    
    // Apply personalized ranking
    const rankedResults = this.applyPersonalizedRanking(
      enhancedResults,
      searchOptions
    );
    
    // Filter based on preferences
    const filteredResults = this.applyFilters(rankedResults, searchOptions);
    
    // Record search session
    const sessionId = this.generateSessionId();
    await this.recordSearchSession(sessionId, query, filteredResults);
    
    // Return enhanced session
    return {
      ...baseSession,
      results: filteredResults,
      options: { ...baseSession.options, ...searchOptions }
    } as SearchSession<PersonalizedSearchResult>;
  }
  
  /**
   * Enhance results with personal scoring data
   */
  private async enhanceWithPersonalScores(
    results: SearchResult[],
    query: string,
    options: PersonalizedSearchOptions
  ): Promise<PersonalizedSearchResult[]> {
    const enhancedResults = await Promise.all(
      results.map(async (result, index) => {
        const enhanced: PersonalizedSearchResult = {
          ...result,
          relevanceScore: this.calculateRelevanceScore(result, query, index)
        };
        
        // Add personal data for local results
        if (result.source === 'local' && result.localFile?.id) {
          const stats = await this.personalScoreService.getTrackStatistics(
            result.localFile.id
          );
          
          if (stats) {
            enhanced.personalScore = stats.personalScore;
            enhanced.playCount = stats.playCount;
            enhanced.rating = stats.rating;
            enhanced.favorite = stats.favorite;
            enhanced.lastPlayed = stats.lastPlayed;
          }
        }
        
        return enhanced;
      })
    );
    
    return enhancedResults;
  }
  
  /**
   * Apply personalized ranking algorithm
   */
  private applyPersonalizedRanking(
    results: PersonalizedSearchResult[],
    options: PersonalizedSearchOptions
  ): PersonalizedSearchResult[] {
    // Calculate final scores
    const scoredResults = results.map(result => {
      let finalScore = result.relevanceScore || 0;
      
      if (options.includePersonalScore && result.personalScore !== undefined) {
        // Blend personal and relevance scores
        const personalWeight = options.personalScoreWeight || 0.3;
        const relevanceWeight = 1 - personalWeight;
        
        finalScore = (result.personalScore * personalWeight) + 
                    (finalScore * relevanceWeight);
        
        // Apply favorite boost
        if (options.favoriteBoost && result.favorite) {
          finalScore *= 1.5;
        }
      }
      
      return { ...result, finalScore };
    });
    
    // Sort by final score
    return scoredResults.sort((a, b) => {
      // Favorites always come first if boost is enabled
      if (options.favoriteBoost) {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
      }
      
      // Then by final score
      return (b.finalScore || 0) - (a.finalScore || 0);
    });
  }
  
  /**
   * Apply user preference filters
   */
  private applyFilters(
    results: PersonalizedSearchResult[],
    options: PersonalizedSearchOptions
  ): PersonalizedSearchResult[] {
    return results.filter(result => {
      // Filter by minimum play count
      if (options.minPlayCount && options.minPlayCount > 0) {
        if ((result.playCount || 0) < options.minPlayCount) {
          return false;
        }
      }
      
      // Exclude frequently skipped tracks
      if (options.excludeSkipped) {
        // This would need skip count from statistics
        // For now, we'll skip this filter
      }
      
      return true;
    });
  }
  
  /**
   * Calculate relevance score based on query match
   */
  private calculateRelevanceScore(
    result: SearchResult,
    query: string,
    position: number
  ): number {
    const queryLower = query.toLowerCase();
    let score = 100;
    
    // Position penalty (results further down are less relevant)
    score -= position * 2;
    
    // Exact matches get bonus
    if (result.title?.toLowerCase() === queryLower) {
      score += 50;
    } else if (result.title?.toLowerCase().includes(queryLower)) {
      score += 25;
    }
    
    if (result.artist?.toLowerCase() === queryLower) {
      score += 30;
    } else if (result.artist?.toLowerCase().includes(queryLower)) {
      score += 15;
    }
    
    if (result.album?.toLowerCase().includes(queryLower)) {
      score += 10;
    }
    
    // Local results get a small bonus
    if (result.source === 'local') {
      score += 10;
    }
    
    // Normalize to 0-100
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Record search session for analytics
   */
  private async recordSearchSession(
    sessionId: string,
    query: string,
    results: PersonalizedSearchResult[]
  ): Promise<void> {
    // Record top results as potential interactions
    const topResults = results.slice(0, 10);
    
    for (let i = 0; i < topResults.length; i++) {
      const result = topResults[i];
      
      // Pre-record search results for later interaction tracking
      await this.personalScoreService.recordSearchInteraction(
        query,
        result.id,
        result.source === 'local' ? 'local' : 'web',
        'ignore', // Default, will be updated on actual interaction
        i + 1,
        sessionId
      );
    }
  }
  
  /**
   * Get search suggestions based on personal history
   */
  async getPersonalizedSuggestions(
    partialQuery: string,
    limit: number = 10
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Get suggestions from search manager
    const baseSuggestions = await this.searchManager.getSearchSuggestions(
      partialQuery,
      limit
    );
    suggestions.push(...baseSuggestions);
    
    // Add frequently searched queries from personal history
    // This would query the search_interactions table
    // For now, return base suggestions
    
    return [...new Set(suggestions)].slice(0, limit);
  }
  
  /**
   * Get recommended tracks based on listening history
   */
  async getRecommendations(limit: number = 20): Promise<PersonalizedSearchResult[]> {
    const recommendations = await this.personalScoreService.getRecommendations(limit);
    
    return recommendations.map(track => ({
      id: `local_${track.id}`,
      title: track.title,
      artist: track.artist,
      album: track.album,
      source: 'local' as const,
      localFile: {
        id: track.id,
        path: track.file_path,
        size: track.file_size,
        format: track.format
      },
      personalScore: track.personal_score,
      playCount: track.play_count,
      rating: track.rating,
      favorite: track.favorite === 1,
      lastPlayed: track.last_played ? new Date(track.last_played) : undefined,
      relevanceScore: 100, // Recommendations are always relevant
      finalScore: track.personal_score
    }));
  }
  
  /**
   * Record user interaction with search result
   */
  async recordInteraction(
    result: PersonalizedSearchResult,
    interactionType: 'click' | 'play' | 'download',
    sessionId?: string
  ): Promise<void> {
    await this.personalScoreService.recordSearchInteraction(
      '', // Query not needed for update
      result.id,
      result.source === 'local' ? 'local' : 'web',
      interactionType,
      undefined,
      sessionId
    );
    
    // If it's a play interaction on a local file, record the play
    if (interactionType === 'play' && result.localFile?.id) {
      await this.personalScoreService.recordPlay(
        result.localFile.id,
        undefined,
        undefined,
        'search'
      );
    }
  }
  
  /**
   * Update user preferences
   */
  async updatePreferences(
    preferences: Partial<PersonalizedSearchOptions>
  ): Promise<void> {
    // Store preferences for future searches
    Object.assign(this.defaultOptions, preferences);
    
    // Could persist to database here
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}