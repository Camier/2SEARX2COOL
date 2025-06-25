import { UnifiedSearchManager, SearchSession } from './UnifiedSearchManager';
import { OfflineCacheManager, CachedSearch } from './OfflineCacheManager';
import { SearchResult, UnifiedSearchOptions } from './LibrarySearchService';
import EventEmitter from 'events';

export type NetworkStatus = 'online' | 'offline' | 'degraded';
export type SearchMode = 'online' | 'offline' | 'hybrid';

export interface OfflineSearchOptions extends UnifiedSearchOptions {
  forceOffline?: boolean;
  useCacheFirst?: boolean;
  cacheResults?: boolean;
  maxCacheAge?: number; // hours
}

export interface SearchStatusInfo {
  mode: SearchMode;
  networkStatus: NetworkStatus;
  cacheAvailable: boolean;
  searxngAvailable: boolean;
  localLibraryAvailable: boolean;
  lastOnlineCheck: Date;
  offlineSince?: Date;
}

export interface FallbackResult {
  strategy: 'cache' | 'local' | 'none';
  results: SearchResult[];
  message?: string;
  cachedAt?: Date;
}

/**
 * Week 3 Day 3: Offline Search Service with Fallback Strategies
 * 
 * Provides seamless search experience even when SearXNG is unavailable,
 * using cached results and intelligent fallback strategies.
 */
export class OfflineSearchService extends EventEmitter {
  private searchManager: UnifiedSearchManager;
  private cacheManager: OfflineCacheManager;
  private networkStatus: NetworkStatus = 'online';
  private searxngAvailable: boolean = true;
  private lastOnlineCheck: Date = new Date();
  private offlineSince?: Date;
  private checkInterval?: NodeJS.Timeout;
  
  // Configuration
  private readonly ONLINE_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CACHE_FIRST_THRESHOLD = 60000; // 1 minute
  private readonly MAX_OFFLINE_CACHE_AGE = 72; // 72 hours
  
  constructor(searchManager: UnifiedSearchManager, cacheManager: OfflineCacheManager) {
    super();
    this.searchManager = searchManager;
    this.cacheManager = cacheManager;
    
    // Start monitoring network status
    this.startNetworkMonitoring();
    
    // Check initial status
    this.checkNetworkStatus();
  }
  
  /**
   * Main search method with offline support
   */
  async search(query: string, options: OfflineSearchOptions = {}): Promise<SearchSession> {
    const searchOptions = this.prepareSearchOptions(options);
    
    // Emit search start event with mode info
    this.emit('searchStarted', {
      query,
      mode: this.determineSearchMode(searchOptions),
      networkStatus: this.networkStatus
    });
    
    try {
      // Force offline mode if requested
      if (searchOptions.forceOffline || this.networkStatus === 'offline') {
        return await this.offlineSearch(query, searchOptions);
      }
      
      // Use cache first if network is degraded or cache is fresh
      if (searchOptions.useCacheFirst || this.shouldUseCacheFirst()) {
        const cachedResults = await this.searchCacheFirst(query, searchOptions);
        if (cachedResults) return cachedResults;
      }
      
      // Try online search with fallback
      return await this.searchWithFallback(query, searchOptions);
      
    } catch (error) {
      console.error('Search failed:', error);
      
      // Last resort: try any available fallback
      const fallback = await this.getAnyAvailableFallback(query, searchOptions);
      if (fallback.results.length > 0) {
        return this.createFallbackSession(query, fallback, searchOptions);
      }
      
      throw error;
    }
  }
  
  /**
   * Offline-only search using cache and local library
   */
  private async offlineSearch(query: string, options: OfflineSearchOptions): Promise<SearchSession> {
    console.log(`🔌 Offline search for: "${query}"`);
    
    // First, try to get cached results
    const cached = await this.cacheManager.getCachedResults(query);
    if (cached && this.isCacheFresh(cached, options.maxCacheAge)) {
      console.log(`✅ Found cached results (${cached.resultCount} results)`);
      
      return this.createCachedSession(query, cached, options);
    }
    
    // Fall back to local-only search
    console.log('📁 Falling back to local library search');
    const localResults = await this.searchManager.searchLocal(query);
    
    const session: SearchSession = {
      id: this.generateSessionId(),
      query,
      timestamp: new Date(),
      results: localResults,
      stats: {
        localResults: localResults.length,
        searxngResults: 0,
        duplicatesFound: 0,
        matchesFound: 0,
        totalResults: localResults.length,
        searchTime: 0
      },
      options: { ...options, includeLocal: true, includeSearxng: false }
    };
    
    // Annotate results as offline
    session.results = session.results.map(result => ({
      ...result,
      searxngData: {
        ...result.searxngData,
        engine: 'offline_mode'
      }
    }));
    
    this.emit('offlineSearchCompleted', session);
    return session;
  }
  
  /**
   * Search with cache-first strategy
   */
  private async searchCacheFirst(query: string, options: OfflineSearchOptions): Promise<SearchSession | null> {
    const cached = await this.cacheManager.getCachedResults(query);
    
    if (cached && this.isCacheFresh(cached, options.maxCacheAge)) {
      console.log(`📦 Using cached results for: "${query}"`);
      
      // Return cached results immediately
      const session = this.createCachedSession(query, cached, options);
      
      // Optionally refresh in background if online
      if (this.networkStatus === 'online' && this.searxngAvailable) {
        this.refreshCacheInBackground(query, options);
      }
      
      return session;
    }
    
    return null;
  }
  
  /**
   * Search with automatic fallback on failure
   */
  private async searchWithFallback(query: string, options: OfflineSearchOptions): Promise<SearchSession> {
    try {
      // Attempt normal unified search
      const session = await this.searchManager.search(query, options);
      
      // Cache successful results
      if (options.cacheResults !== false && session.results.length > 0) {
        await this.cacheManager.cacheSearchResults(query, session.results);
      }
      
      this.updateNetworkStatus('online');
      return session;
      
    } catch (error) {
      console.warn('Online search failed, using fallback strategy');
      
      // Determine network status from error
      if (this.isNetworkError(error)) {
        this.updateNetworkStatus('offline');
      } else {
        this.updateNetworkStatus('degraded');
      }
      
      // Get fallback results
      const fallback = await this.determineFallbackStrategy(query, options);
      return this.createFallbackSession(query, fallback, options);
    }
  }
  
  /**
   * Determine best fallback strategy
   */
  private async determineFallbackStrategy(query: string, options: OfflineSearchOptions): Promise<FallbackResult> {
    // Strategy 1: Try cache first
    const cached = await this.cacheManager.getCachedResults(query);
    if (cached) {
      // Even stale cache is better than nothing
      console.log(`📦 Using ${cached.results.length} cached results (age: ${this.getCacheAge(cached)})`);
      return {
        strategy: 'cache',
        results: cached.results,
        cachedAt: cached.cachedAt,
        message: `Using cached results from ${this.formatCacheAge(cached)}`
      };
    }
    
    // Strategy 2: Similar searches from cache
    const similarSearches = await this.cacheManager.getSimilarSearches(query, 5);
    if (similarSearches.length > 0) {
      console.log(`🔍 Trying similar cached searches`);
      
      for (const similarQuery of similarSearches) {
        const similarCached = await this.cacheManager.getCachedResults(similarQuery);
        if (similarCached && similarCached.results.length > 0) {
          return {
            strategy: 'cache',
            results: similarCached.results,
            cachedAt: similarCached.cachedAt,
            message: `No exact match found. Showing results for "${similarQuery}"`
          };
        }
      }
    }
    
    // Strategy 3: Local library only
    console.log('📁 Using local library as final fallback');
    const localResults = await this.searchManager.searchLocal(query);
    
    if (localResults.length > 0) {
      return {
        strategy: 'local',
        results: localResults,
        message: 'Showing results from your local library only'
      };
    }
    
    // Strategy 4: Frequent searches
    const frequentSearches = await this.cacheManager.getFrequentSearches(10);
    if (frequentSearches.length > 0) {
      console.log('📊 Suggesting frequent searches');
      
      // Return empty results with suggestions
      return {
        strategy: 'none',
        results: [],
        message: `No results found. Try one of these popular searches: ${
          frequentSearches.slice(0, 5).map(s => s.query).join(', ')
        }`
      };
    }
    
    // No fallback available
    return {
      strategy: 'none',
      results: [],
      message: 'No results available offline. Please check your connection.'
    };
  }
  
  /**
   * Get any available fallback results
   */
  private async getAnyAvailableFallback(query: string, options: OfflineSearchOptions): Promise<FallbackResult> {
    // Try all strategies in order
    const strategies = [
      () => this.cacheManager.getCachedResults(query),
      () => this.searchManager.searchLocal(query),
      () => this.cacheManager.getFrequentSearches(1)
    ];
    
    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result) {
          if (Array.isArray(result) && result.length > 0) {
            return {
              strategy: 'local',
              results: result as SearchResult[]
            };
          } else if ('results' in result && result.results.length > 0) {
            return {
              strategy: 'cache',
              results: result.results,
              cachedAt: result.cachedAt
            };
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return {
      strategy: 'none',
      results: []
    };
  }
  
  /**
   * Get current search status
   */
  getSearchStatus(): SearchStatusInfo {
    return {
      mode: this.determineSearchMode(),
      networkStatus: this.networkStatus,
      cacheAvailable: true, // Always available with local DB
      searxngAvailable: this.searxngAvailable,
      localLibraryAvailable: true, // Always available
      lastOnlineCheck: this.lastOnlineCheck,
      offlineSince: this.offlineSince
    };
  }
  
  /**
   * Force refresh network status
   */
  async checkNetworkStatus(): Promise<NetworkStatus> {
    this.lastOnlineCheck = new Date();
    
    try {
      const connectionTest = await this.searchManager.testSearxngConnection();
      
      if (connectionTest.success) {
        this.updateNetworkStatus('online');
        this.searxngAvailable = true;
      } else {
        this.updateNetworkStatus('degraded');
        this.searxngAvailable = false;
      }
      
    } catch (error) {
      this.updateNetworkStatus('offline');
      this.searxngAvailable = false;
    }
    
    return this.networkStatus;
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await this.cacheManager.getCacheStats();
  }
  
  /**
   * Clear offline cache
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clearAllCache();
    this.emit('cacheCleared');
  }
  
  /**
   * Export offline data
   */
  async exportOfflineData() {
    const cacheData = await this.cacheManager.exportCache();
    const searchData = this.searchManager.exportSearchData();
    
    return {
      cache: cacheData,
      searches: searchData,
      status: this.getSearchStatus(),
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Import offline data
   */
  async importOfflineData(data: any): Promise<void> {
    if (data.cache) {
      await this.cacheManager.importCache(data.cache);
    }
    
    if (data.searches) {
      this.searchManager.importSearchData(data.searches);
    }
    
    this.emit('dataImported');
  }
  
  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.cacheManager.close();
  }
  
  // Private helper methods
  
  private startNetworkMonitoring(): void {
    // Periodic network checks
    this.checkInterval = setInterval(() => {
      this.checkNetworkStatus();
    }, this.ONLINE_CHECK_INTERVAL);
    
    // Listen for system network events if available
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateNetworkStatus('online'));
      window.addEventListener('offline', () => this.updateNetworkStatus('offline'));
    }
  }
  
  private updateNetworkStatus(status: NetworkStatus): void {
    const previousStatus = this.networkStatus;
    this.networkStatus = status;
    
    if (status === 'offline' && previousStatus !== 'offline') {
      this.offlineSince = new Date();
    } else if (status === 'online' && previousStatus !== 'online') {
      this.offlineSince = undefined;
    }
    
    if (previousStatus !== status) {
      this.emit('networkStatusChanged', { previous: previousStatus, current: status });
    }
  }
  
  private determineSearchMode(options?: OfflineSearchOptions): SearchMode {
    if (options?.forceOffline || this.networkStatus === 'offline') {
      return 'offline';
    }
    
    if (this.networkStatus === 'degraded' || !this.searxngAvailable) {
      return 'hybrid';
    }
    
    return 'online';
  }
  
  private shouldUseCacheFirst(): boolean {
    // Use cache first if recently went offline
    if (this.networkStatus === 'degraded') return true;
    
    // Use cache first if SearXNG was recently unavailable
    const timeSinceCheck = Date.now() - this.lastOnlineCheck.getTime();
    return !this.searxngAvailable && timeSinceCheck < this.CACHE_FIRST_THRESHOLD;
  }
  
  private isCacheFresh(cached: CachedSearch, maxAgeHours?: number): boolean {
    const maxAge = maxAgeHours || this.MAX_OFFLINE_CACHE_AGE;
    const ageHours = this.getCacheAgeHours(cached);
    return ageHours < maxAge;
  }
  
  private getCacheAge(cached: CachedSearch): string {
    const hours = this.getCacheAgeHours(cached);
    if (hours < 1) return 'less than an hour ago';
    if (hours < 24) return `${Math.round(hours)} hours ago`;
    return `${Math.round(hours / 24)} days ago`;
  }
  
  private getCacheAgeHours(cached: CachedSearch): number {
    return (Date.now() - cached.cachedAt.getTime()) / (1000 * 60 * 60);
  }
  
  private formatCacheAge(cached: CachedSearch): string {
    return cached.cachedAt.toLocaleString();
  }
  
  private isNetworkError(error: any): boolean {
    const networkErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
    return error.code && networkErrors.includes(error.code);
  }
  
  private prepareSearchOptions(options: OfflineSearchOptions): OfflineSearchOptions {
    return {
      cacheResults: true,
      useCacheFirst: this.networkStatus === 'degraded',
      ...options
    };
  }
  
  private generateSessionId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private createCachedSession(query: string, cached: CachedSearch, options: OfflineSearchOptions): SearchSession {
    return {
      id: this.generateSessionId(),
      query,
      timestamp: new Date(),
      results: cached.results,
      stats: {
        localResults: cached.results.filter(r => r.source === 'local').length,
        searxngResults: cached.results.filter(r => r.source === 'searxng').length,
        duplicatesFound: 0,
        matchesFound: 0,
        totalResults: cached.results.length,
        searchTime: 0
      },
      options
    };
  }
  
  private createFallbackSession(query: string, fallback: FallbackResult, options: OfflineSearchOptions): SearchSession {
    const session: SearchSession = {
      id: this.generateSessionId(),
      query,
      timestamp: new Date(),
      results: fallback.results,
      stats: {
        localResults: fallback.results.filter(r => r.source === 'local').length,
        searxngResults: 0,
        duplicatesFound: 0,
        matchesFound: 0,
        totalResults: fallback.results.length,
        searchTime: 0
      },
      options
    };
    
    // Add fallback metadata
    if (fallback.message) {
      (session as any).fallbackMessage = fallback.message;
    }
    
    if (fallback.cachedAt) {
      (session as any).cachedAt = fallback.cachedAt;
    }
    
    this.emit('fallbackUsed', {
      query,
      strategy: fallback.strategy,
      resultCount: fallback.results.length
    });
    
    return session;
  }
  
  private async refreshCacheInBackground(query: string, options: OfflineSearchOptions): Promise<void> {
    try {
      console.log(`🔄 Refreshing cache in background for: "${query}"`);
      
      const freshResults = await this.searchManager.search(query, {
        ...options,
        includeLocal: true,
        includeSearxng: true
      });
      
      if (freshResults.results.length > 0) {
        await this.cacheManager.cacheSearchResults(query, freshResults.results);
      }
      
    } catch (error) {
      console.log('Background cache refresh failed:', error.message);
    }
  }
}