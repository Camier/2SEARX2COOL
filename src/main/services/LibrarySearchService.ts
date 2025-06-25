import axios from 'axios';
import { DatabaseManager } from '../database/DatabaseManager';
import { AudioMetadata } from './MetadataExtractor';
import * as path from 'path';

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  url?: string;
  source: 'local' | 'searxng' | 'hybrid';
  localFile?: {
    path: string;
    size: number;
    format: string;
    bitrate?: number;
  };
  searxngData?: {
    engine: string;
    thumbnail?: string;
    publishedDate?: string;
    content?: string;
  };
  matchConfidence?: number; // How well SearXNG result matches local file
  isLocalMatch?: boolean; // Whether this SearXNG result has a local file
}

export interface UnifiedSearchOptions {
  includeLocal?: boolean;
  includeSearxng?: boolean;
  searxngUrl?: string;
  engines?: string[];
  maxResults?: number;
  localWeight?: number; // Boost local results in ranking
  matchThreshold?: number; // Similarity threshold for local matching
}

export interface SearchStats {
  localResults: number;
  searxngResults: number;
  duplicatesFound: number;
  matchesFound: number;
  totalResults: number;
  searchTime: number;
}

/**
 * Week 3 Day 2: Library Search Service
 * 
 * Combines local library search with SearXNG web search to create
 * a unified music discovery experience that prioritizes personal library
 * while expanding with web results.
 */
export class LibrarySearchService {
  private db: DatabaseManager;
  private defaultOptions: UnifiedSearchOptions = {
    includeLocal: true,
    includeSearxng: true,
    searxngUrl: 'http://localhost:8888',
    engines: ['soundcloud', 'youtube_music', 'bandcamp', 'spotify', 'deezer'],
    maxResults: 50,
    localWeight: 1.5, // Boost local results by 50%
    matchThreshold: 0.7 // 70% similarity for local matching
  };
  
  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager;
  }
  
  /**
   * Unified search across local library and SearXNG
   */
  async search(query: string, options: UnifiedSearchOptions = {}): Promise<{
    results: SearchResult[];
    stats: SearchStats;
  }> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    
    console.log(`🔍 Unified search for: "${query}"`);
    
    const [localResults, searxngResults] = await Promise.allSettled([
      opts.includeLocal ? this.searchLocalLibrary(query, opts) : Promise.resolve([]),
      opts.includeSearxng ? this.searchSearxng(query, opts) : Promise.resolve([])
    ]);
    
    const local = localResults.status === 'fulfilled' ? localResults.value : [];
    const searxng = searxngResults.status === 'fulfilled' ? searxngResults.value : [];
    
    // Merge and deduplicate results
    const { mergedResults, duplicatesFound, matchesFound } = this.mergeResults(local, searxng, opts);
    
    // Rank results with local preference
    const rankedResults = this.rankResults(mergedResults, query, opts);
    
    // Limit final results
    const finalResults = rankedResults.slice(0, opts.maxResults);
    
    const searchTime = Date.now() - startTime;
    
    const stats: SearchStats = {
      localResults: local.length,
      searxngResults: searxng.length,
      duplicatesFound,
      matchesFound,
      totalResults: finalResults.length,
      searchTime
    };
    
    console.log(`✅ Search completed: ${stats.totalResults} results (${stats.localResults} local, ${stats.searxngResults} web, ${stats.matchesFound} matches) in ${stats.searchTime}ms`);
    
    return { results: finalResults, stats };
  }
  
  /**
   * Search local music library
   */
  private async searchLocalLibrary(query: string, options: UnifiedSearchOptions): Promise<SearchResult[]> {
    try {
      const db = this.db.getDatabase();
      
      // Search across title, artist, album with fuzzy matching
      const searchQuery = `
        SELECT 
          id, title, artist, album, duration, file_path, 
          file_size, format, bitrate, last_modified,
          -- Calculate relevance score
          (
            CASE WHEN title LIKE ? THEN 10 ELSE 0 END +
            CASE WHEN artist LIKE ? THEN 8 ELSE 0 END +
            CASE WHEN album LIKE ? THEN 5 ELSE 0 END +
            -- Partial matches
            CASE WHEN title LIKE ? THEN 5 ELSE 0 END +
            CASE WHEN artist LIKE ? THEN 4 ELSE 0 END +
            CASE WHEN album LIKE ? THEN 3 ELSE 0 END
          ) as relevance
        FROM audio_files 
        WHERE relevance > 0
        ORDER BY relevance DESC, title ASC
        LIMIT 100
      `;
      
      const searchTerm = `%${query}%`;
      const exactTerm = query.toLowerCase();
      
      const rows = db.prepare(searchQuery).all(
        exactTerm, exactTerm, exactTerm,  // Exact matches
        searchTerm, searchTerm, searchTerm // Partial matches
      );
      
      return rows.map(row => ({
        id: `local_${row.id}`,
        title: row.title || path.basename(row.file_path, path.extname(row.file_path)),
        artist: row.artist || 'Unknown Artist',
        album: row.album,
        duration: row.duration,
        source: 'local' as const,
        localFile: {
          path: row.file_path,
          size: row.file_size,
          format: row.format || path.extname(row.file_path),
          bitrate: row.bitrate
        },
        matchConfidence: 1.0 // Local files always 100% confidence
      }));
      
    } catch (error) {
      console.error('Local library search failed:', error);
      return [];
    }
  }
  
  /**
   * Search SearXNG for music
   */
  private async searchSearxng(query: string, options: UnifiedSearchOptions): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        categories: 'music',
        engines: options.engines?.join(',') || 'soundcloud,youtube_music'
      });
      
      const response = await axios.get(`${options.searxngUrl}/search?${params}`, {
        timeout: 10000,
        headers: {
          'User-Agent': '2SEARX2COOL/1.0'
        }
      });
      
      if (!response.data?.results) {
        return [];
      }
      
      return response.data.results.slice(0, 30).map((result: any, index: number) => {
        // Parse title and artist from SearXNG result
        const { title, artist } = this.parseSearxngTitle(result.title);
        
        return {
          id: `searxng_${index}_${result.engine}`,
          title,
          artist: artist || 'Unknown Artist',
          duration: this.parseDuration(result.content),
          url: result.url,
          source: 'searxng' as const,
          searxngData: {
            engine: result.engine,
            thumbnail: result.thumbnail,
            publishedDate: result.publishedDate,
            content: result.content
          }
        };
      });
      
    } catch (error) {
      console.error('SearXNG search failed:', error);
      return [];
    }
  }
  
  /**
   * Merge local and SearXNG results, detecting duplicates and matches
   */
  private mergeResults(
    localResults: SearchResult[], 
    searxngResults: SearchResult[], 
    options: UnifiedSearchOptions
  ): { mergedResults: SearchResult[]; duplicatesFound: number; matchesFound: number } {
    const merged: SearchResult[] = [...localResults];
    let duplicatesFound = 0;
    let matchesFound = 0;
    
    for (const searxngResult of searxngResults) {
      // Check if this SearXNG result matches any local file
      const match = this.findLocalMatch(searxngResult, localResults, options.matchThreshold!);
      
      if (match) {
        matchesFound++;
        
        // Mark the local result as having a web match
        const localIndex = merged.findIndex(r => r.id === match.id);
        if (localIndex >= 0) {
          merged[localIndex] = {
            ...merged[localIndex],
            source: 'hybrid' as const,
            searxngData: searxngResult.searxngData,
            url: searxngResult.url,
            isLocalMatch: true
          };
        }
        
        // Don't add the SearXNG result separately to avoid duplication
        duplicatesFound++;
      } else {
        // Add unique SearXNG result
        merged.push(searxngResult);
      }
    }
    
    return { mergedResults: merged, duplicatesFound, matchesFound };
  }
  
  /**
   * Find local file that matches a SearXNG result
   */
  private findLocalMatch(
    searxngResult: SearchResult, 
    localResults: SearchResult[], 
    threshold: number
  ): SearchResult | null {
    let bestMatch: SearchResult | null = null;
    let bestScore = 0;
    
    for (const localResult of localResults) {
      const score = this.calculateSimilarity(searxngResult, localResult);
      
      if (score >= threshold && score > bestScore) {
        bestMatch = localResult;
        bestScore = score;
      }
    }
    
    if (bestMatch) {
      bestMatch.matchConfidence = bestScore;
    }
    
    return bestMatch;
  }
  
  /**
   * Calculate similarity between two results
   */
  private calculateSimilarity(result1: SearchResult, result2: SearchResult): number {
    const titleSim = this.stringSimilarity(result1.title, result2.title);
    const artistSim = this.stringSimilarity(result1.artist, result2.artist);
    
    // Weight title and artist equally, with slight preference for title
    return (titleSim * 0.6) + (artistSim * 0.4);
  }
  
  /**
   * Calculate string similarity using Levenshtein distance
   */
  private stringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
    if (len2 === 0) return 0.0;
    
    // Levenshtein distance algorithm
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    
    return 1.0 - (distance / maxLen);
  }
  
  /**
   * Rank search results with preference for local files
   */
  private rankResults(results: SearchResult[], query: string, options: UnifiedSearchOptions): SearchResult[] {
    return results.sort((a, b) => {
      // Calculate base relevance score
      const scoreA = this.calculateRelevanceScore(a, query);
      const scoreB = this.calculateRelevanceScore(b, query);
      
      // Apply local weight boost
      const finalScoreA = a.source === 'local' || a.source === 'hybrid' 
        ? scoreA * options.localWeight! 
        : scoreA;
      const finalScoreB = b.source === 'local' || b.source === 'hybrid'
        ? scoreB * options.localWeight!
        : scoreB;
      
      return finalScoreB - finalScoreA;
    });
  }
  
  /**
   * Calculate relevance score for a result
   */
  private calculateRelevanceScore(result: SearchResult, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    // Exact matches get highest scores
    if (result.title.toLowerCase().includes(queryLower)) score += 10;
    if (result.artist.toLowerCase().includes(queryLower)) score += 8;
    if (result.album?.toLowerCase().includes(queryLower)) score += 5;
    
    // Boost for local files and high-confidence matches
    if (result.source === 'local') score += 5;
    if (result.matchConfidence && result.matchConfidence > 0.8) score += 3;
    if (result.isLocalMatch) score += 2;
    
    return score;
  }
  
  /**
   * Parse title and artist from SearXNG result title
   */
  private parseSearxngTitle(fullTitle: string): { title: string; artist?: string } {
    // Common patterns: "Artist - Title", "Title by Artist", "Artist: Title"
    const patterns = [
      /^(.+?)\s*-\s*(.+)$/,       // Artist - Title
      /^(.+?)\s*:\s*(.+)$/,       // Artist: Title  
      /^(.+?)\s+by\s+(.+)$/i,     // Title by Artist
      /^(.+?)\s*\|\s*(.+)$/,      // Artist | Title
    ];
    
    for (const pattern of patterns) {
      const match = fullTitle.match(pattern);
      if (match) {
        // For "Title by Artist", swap the order
        if (pattern.source.includes('by')) {
          return { title: match[1].trim(), artist: match[2].trim() };
        } else {
          return { title: match[2].trim(), artist: match[1].trim() };
        }
      }
    }
    
    // No pattern matched, return full title
    return { title: fullTitle.trim() };
  }
  
  /**
   * Parse duration from SearXNG content
   */
  private parseDuration(content?: string): number | undefined {
    if (!content) return undefined;
    
    // Look for duration patterns: "3:45", "1:23:45", "2m 30s"
    const patterns = [
      /(\d+):(\d+):(\d+)/,        // HH:MM:SS
      /(\d+):(\d+)/,              // MM:SS
      /(\d+)m\s*(\d+)s/i,         // 2m 30s
      /(\d+)\s*min/i              // 3 min
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        if (pattern.source.includes('min')) {
          return parseInt(match[1]) * 60;
        } else if (match[3]) {
          // HH:MM:SS
          return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
        } else {
          // MM:SS or 2m 30s
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Get library statistics
   */
  async getLibraryStats() {
    try {
      const db = this.db.getDatabase();
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_files,
          COUNT(DISTINCT artist) as unique_artists,
          COUNT(DISTINCT album) as unique_albums,
          SUM(duration) as total_duration,
          AVG(duration) as avg_duration,
          SUM(file_size) as total_size
        FROM audio_files
      `).get();
      
      return {
        totalFiles: stats.total_files || 0,
        uniqueArtists: stats.unique_artists || 0,
        uniqueAlbums: stats.unique_albums || 0,
        totalDurationHours: stats.total_duration ? Math.round(stats.total_duration / 3600 * 100) / 100 : 0,
        avgDurationMinutes: stats.avg_duration ? Math.round(stats.avg_duration / 60 * 100) / 100 : 0,
        totalSizeGB: stats.total_size ? Math.round(stats.total_size / (1024 * 1024 * 1024) * 100) / 100 : 0
      };
    } catch (error) {
      console.error('Failed to get library stats:', error);
      return null;
    }
  }
  
  /**
   * Update search options
   */
  updateOptions(options: Partial<UnifiedSearchOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
}