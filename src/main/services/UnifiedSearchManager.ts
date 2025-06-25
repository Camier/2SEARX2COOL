import { LibrarySearchService, SearchResult, UnifiedSearchOptions, SearchStats } from './LibrarySearchService';
import { DatabaseManager } from '../database/DatabaseManager';
import { MetadataExtractor } from './MetadataExtractor';
import EventEmitter from 'events';

export interface SearchSession {
  id: string;
  query: string;
  timestamp: Date;
  results: SearchResult[];
  stats: SearchStats;
  options: UnifiedSearchOptions;
}

export interface SearchPreferences {
  defaultEngines: string[];
  maxResults: number;
  localWeight: number;
  matchThreshold: number;
  searxngUrl: string;
  enableLocalSearch: boolean;
  enableWebSearch: boolean;
  autoSaveSearches: boolean;
}

export interface RecentSearch {
  query: string;
  timestamp: Date;
  resultCount: number;
}

/**
 * Week 3 Day 2: Unified Search Manager
 * 
 * High-level interface for managing unified music search across
 * local library and SearXNG. Handles search sessions, preferences,
 * and provides a clean API for the UI layer.
 */
export class UnifiedSearchManager extends EventEmitter {
  private librarySearch: LibrarySearchService;
  private db: DatabaseManager;
  private metadataExtractor: MetadataExtractor;
  private searchSessions: Map<string, SearchSession> = new Map();
  private recentSearches: RecentSearch[] = [];
  
  private defaultPreferences: SearchPreferences = {
    defaultEngines: ['soundcloud', 'youtube_music', 'bandcamp', 'spotify', 'deezer'],
    maxResults: 50,
    localWeight: 1.5,
    matchThreshold: 0.7,
    searxngUrl: 'http://localhost:8888',
    enableLocalSearch: true,
    enableWebSearch: true,
    autoSaveSearches: true
  };
  
  private preferences: SearchPreferences;
  
  constructor(databaseManager: DatabaseManager, metadataExtractor: MetadataExtractor) {
    super();
    this.db = databaseManager;
    this.metadataExtractor = metadataExtractor;
    this.librarySearch = new LibrarySearchService(databaseManager);
    this.preferences = { ...this.defaultPreferences };
    
    this.loadPreferences();
    this.loadRecentSearches();
  }
  
  /**
   * Perform unified search with full session management
   */
  async search(query: string, customOptions?: Partial<UnifiedSearchOptions>): Promise<SearchSession> {
    const sessionId = this.generateSessionId();
    const timestamp = new Date();
    
    console.log(`🎵 Starting search session ${sessionId} for: "${query}"`);
    
    // Merge preferences with custom options
    const searchOptions: UnifiedSearchOptions = {
      includeLocal: this.preferences.enableLocalSearch,
      includeSearxng: this.preferences.enableWebSearch,
      searxngUrl: this.preferences.searxngUrl,
      engines: this.preferences.defaultEngines,
      maxResults: this.preferences.maxResults,
      localWeight: this.preferences.localWeight,
      matchThreshold: this.preferences.matchThreshold,
      ...customOptions
    };
    
    this.emit('searchStarted', { sessionId, query, options: searchOptions });
    
    try {
      // Perform the search
      const { results, stats } = await this.librarySearch.search(query, searchOptions);
      
      // Create search session
      const session: SearchSession = {
        id: sessionId,
        query,
        timestamp,
        results,
        stats,
        options: searchOptions
      };
      
      // Store session
      this.searchSessions.set(sessionId, session);
      
      // Update recent searches
      this.addRecentSearch(query, results.length);
      
      // Save session if enabled
      if (this.preferences.autoSaveSearches) {
        await this.saveSearchSession(session);
      }
      
      this.emit('searchCompleted', session);
      
      console.log(`✅ Search session ${sessionId} completed: ${results.length} results`);
      return session;
      
    } catch (error) {
      console.error(`❌ Search session ${sessionId} failed:`, error);
      this.emit('searchFailed', { sessionId, query, error: error.message });
      throw error;
    }
  }
  
  /**
   * Quick search without full session management
   */
  async quickSearch(query: string): Promise<SearchResult[]> {
    const { results } = await this.librarySearch.search(query, {
      maxResults: 20,
      includeLocal: this.preferences.enableLocalSearch,
      includeSearxng: this.preferences.enableWebSearch
    });
    
    return results;
  }
  
  /**
   * Search only local library
   */
  async searchLocal(query: string, maxResults: number = 20): Promise<SearchResult[]> {
    const { results } = await this.librarySearch.search(query, {
      includeLocal: true,
      includeSearxng: false,
      maxResults
    });
    
    return results;
  }
  
  /**
   * Search only SearXNG
   */
  async searchWeb(query: string, engines?: string[], maxResults: number = 20): Promise<SearchResult[]> {
    const { results } = await this.librarySearch.search(query, {
      includeLocal: false,
      includeSearxng: true,
      engines: engines || this.preferences.defaultEngines,
      maxResults
    });
    
    return results;
  }
  
  /**
   * Get search suggestions based on local library
   */
  async getSearchSuggestions(partial: string, limit: number = 10): Promise<string[]> {
    if (partial.length < 2) return [];
    
    try {
      const db = this.db.getDatabase();
      
      // Get suggestions from titles, artists, and albums
      const suggestions = db.prepare(`
        SELECT DISTINCT suggestion, COUNT(*) as frequency FROM (
          SELECT title as suggestion FROM audio_files WHERE title LIKE ? AND title IS NOT NULL
          UNION ALL
          SELECT artist as suggestion FROM audio_files WHERE artist LIKE ? AND artist IS NOT NULL
          UNION ALL
          SELECT album as suggestion FROM audio_files WHERE album LIKE ? AND album IS NOT NULL
        )
        GROUP BY suggestion
        ORDER BY frequency DESC, suggestion ASC
        LIMIT ?
      `).all(`%${partial}%`, `%${partial}%`, `%${partial}%`, limit);
      
      return suggestions.map(row => row.suggestion);
      
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }
  
  /**
   * Get recent searches
   */
  getRecentSearches(limit: number = 10): RecentSearch[] {
    return this.recentSearches.slice(0, limit);
  }
  
  /**
   * Get search session by ID
   */
  getSearchSession(sessionId: string): SearchSession | null {
    return this.searchSessions.get(sessionId) || null;
  }
  
  /**
   * Get all active search sessions
   */
  getActiveSessions(): SearchSession[] {
    return Array.from(this.searchSessions.values());
  }
  
  /**
   * Clear search session
   */
  clearSession(sessionId: string): boolean {
    return this.searchSessions.delete(sessionId);
  }
  
  /**
   * Clear all search sessions
   */
  clearAllSessions(): void {
    this.searchSessions.clear();
    this.emit('sessionsCleared');
  }
  
  /**
   * Update search preferences
   */
  updatePreferences(updates: Partial<SearchPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    
    // Update the underlying library search service
    this.librarySearch.updateOptions({
      searxngUrl: this.preferences.searxngUrl,
      engines: this.preferences.defaultEngines,
      maxResults: this.preferences.maxResults,
      localWeight: this.preferences.localWeight,
      matchThreshold: this.preferences.matchThreshold
    });
    
    this.savePreferences();
    this.emit('preferencesUpdated', this.preferences);
  }
  
  /**
   * Get current preferences
   */
  getPreferences(): SearchPreferences {
    return { ...this.preferences };
  }
  
  /**
   * Reset preferences to defaults
   */
  resetPreferences(): void {
    this.preferences = { ...this.defaultPreferences };
    this.savePreferences();
    this.emit('preferencesReset');
  }
  
  /**
   * Get library statistics
   */
  async getLibraryStats() {
    return await this.librarySearch.getLibraryStats();
  }
  
  /**
   * Test SearXNG connectivity
   */
  async testSearxngConnection(): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const { results, stats } = await this.librarySearch.search('test', {
        includeLocal: false,
        includeSearxng: true,
        maxResults: 1
      });
      
      return {
        success: true,
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Get search analytics
   */
  getSearchAnalytics() {
    const sessions = Array.from(this.searchSessions.values());
    
    if (sessions.length === 0) {
      return {
        totalSearches: 0,
        avgResultsPerSearch: 0,
        avgSearchTime: 0,
        localVsWebRatio: 0,
        mostPopularEngines: [],
        topQueries: []
      };
    }
    
    const totalSearches = sessions.length;
    const avgResultsPerSearch = sessions.reduce((sum, s) => sum + s.results.length, 0) / totalSearches;
    const avgSearchTime = sessions.reduce((sum, s) => sum + s.stats.searchTime, 0) / totalSearches;
    
    const localSearches = sessions.filter(s => s.options.includeLocal).length;
    const webSearches = sessions.filter(s => s.options.includeSearxng).length;
    const localVsWebRatio = webSearches > 0 ? localSearches / webSearches : 0;
    
    // Count engine usage
    const engineCounts = new Map<string, number>();
    sessions.forEach(session => {
      session.options.engines?.forEach(engine => {
        engineCounts.set(engine, (engineCounts.get(engine) || 0) + 1);
      });
    });
    
    const mostPopularEngines = Array.from(engineCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([engine, count]) => ({ engine, count }));
    
    // Count query frequency
    const queryCounts = new Map<string, number>();
    sessions.forEach(session => {
      const query = session.query.toLowerCase();
      queryCounts.set(query, (queryCounts.get(query) || 0) + 1);
    });
    
    const topQueries = Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
    
    return {
      totalSearches,
      avgResultsPerSearch: Math.round(avgResultsPerSearch * 100) / 100,
      avgSearchTime: Math.round(avgSearchTime),
      localVsWebRatio: Math.round(localVsWebRatio * 100) / 100,
      mostPopularEngines,
      topQueries
    };
  }
  
  /**
   * Export search data for backup
   */
  exportSearchData() {
    return {
      preferences: this.preferences,
      recentSearches: this.recentSearches,
      sessionCount: this.searchSessions.size,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Import search data from backup
   */
  importSearchData(data: any): void {
    if (data.preferences) {
      this.preferences = { ...this.defaultPreferences, ...data.preferences };
      this.savePreferences();
    }
    
    if (data.recentSearches) {
      this.recentSearches = data.recentSearches.map((search: any) => ({
        ...search,
        timestamp: new Date(search.timestamp)
      }));
      this.saveRecentSearches();
    }
    
    this.emit('dataImported', data);
  }
  
  // Private helper methods
  
  private generateSessionId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private addRecentSearch(query: string, resultCount: number): void {
    // Remove existing entry for this query
    this.recentSearches = this.recentSearches.filter(s => s.query !== query);
    
    // Add to front
    this.recentSearches.unshift({
      query,
      timestamp: new Date(),
      resultCount
    });
    
    // Keep only last 50 searches
    this.recentSearches = this.recentSearches.slice(0, 50);
    
    this.saveRecentSearches();
  }
  
  private async saveSearchSession(session: SearchSession): Promise<void> {
    try {
      const db = this.db.getDatabase();
      
      // Create searches table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS search_sessions (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          result_count INTEGER,
          local_results INTEGER,
          searxng_results INTEGER,
          search_time INTEGER,
          options TEXT
        )
      `);
      
      db.prepare(`
        INSERT OR REPLACE INTO search_sessions 
        (id, query, timestamp, result_count, local_results, searxng_results, search_time, options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.id,
        session.query,
        session.timestamp.toISOString(),
        session.results.length,
        session.stats.localResults,
        session.stats.searxngResults,
        session.stats.searchTime,
        JSON.stringify(session.options)
      );
      
    } catch (error) {
      console.error('Failed to save search session:', error);
    }
  }
  
  private loadPreferences(): void {
    try {
      const db = this.db.getDatabase();
      
      const row = db.prepare(`
        SELECT value FROM app_settings WHERE key = 'searchPreferences'
      `).get();
      
      if (row) {
        const saved = JSON.parse(row.value);
        this.preferences = { ...this.defaultPreferences, ...saved };
      }
    } catch (error) {
      console.error('Failed to load search preferences:', error);
    }
  }
  
  private savePreferences(): void {
    try {
      const db = this.db.getDatabase();
      
      db.prepare(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)
      `).run('searchPreferences', JSON.stringify(this.preferences));
      
    } catch (error) {
      console.error('Failed to save search preferences:', error);
    }
  }
  
  private loadRecentSearches(): void {
    try {
      const db = this.db.getDatabase();
      
      const row = db.prepare(`
        SELECT value FROM app_settings WHERE key = 'recentSearches'
      `).get();
      
      if (row) {
        const saved = JSON.parse(row.value);
        this.recentSearches = saved.map((search: any) => ({
          ...search,
          timestamp: new Date(search.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  }
  
  private saveRecentSearches(): void {
    try {
      const db = this.db.getDatabase();
      
      db.prepare(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)
      `).run('recentSearches', JSON.stringify(this.recentSearches));
      
    } catch (error) {
      console.error('Failed to save recent searches:', error);
    }
  }
}