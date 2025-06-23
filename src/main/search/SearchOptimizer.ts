import log from 'electron-log';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { CacheManager } from '../cache/CacheManager';
import type { DatabaseManager } from '../database/DatabaseManager';

interface SearchQuery {
  query: string;
  engines?: string[];
  categories?: string[];
  language?: string;
  timeRange?: string;
  safeSearch?: boolean;
}

interface SearchResult {
  id: string;
  query: SearchQuery;
  results: any[];
  timestamp: number;
  responseTime: number;
  fromCache: boolean;
}

interface QueryStats {
  query: string;
  count: number;
  avgResponseTime: number;
  lastSearched: number;
  cacheHits: number;
}

export class SearchOptimizer extends EventEmitter {
  private cacheManager: CacheManager;
  private databaseManager: DatabaseManager;
  private queryStats: Map<string, QueryStats> = new Map();
  private pendingSearches: Map<string, Promise<SearchResult>> = new Map();
  
  // Configuration
  private config = {
    cacheEnabled: true,
    cacheTTL: 1800000, // 30 minutes
    maxCacheSize: 100, // MB
    minQueryLength: 2,
    deduplicationWindow: 5000, // 5 seconds
    prefetchEnabled: true,
    prefetchThreshold: 3, // Prefetch after 3 searches
    compressionThreshold: 10240 // Compress results > 10KB
  };

  constructor(cacheManager: CacheManager, databaseManager: DatabaseManager) {
    super();
    this.cacheManager = cacheManager;
    this.databaseManager = databaseManager;
  }

  async initialize(): Promise<void> {
    // Load query statistics
    await this.loadQueryStats();
    
    // Set up periodic cleanup
    setInterval(() => this.cleanupOldEntries(), 3600000); // Every hour
    
    log.info('Search optimizer initialized');
  }

  /**
   * Optimize search request
   */
  async optimizeSearch(
    query: SearchQuery,
    searchFunction: (query: SearchQuery) => Promise<any[]>
  ): Promise<SearchResult> {
    const queryKey = this.generateQueryKey(query);
    const startTime = Date.now();
    
    // Check for duplicate in-flight requests
    if (this.pendingSearches.has(queryKey)) {
      log.debug('Deduplicating search request:', queryKey);
      return this.pendingSearches.get(queryKey)!;
    }
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = await this.getFromCache(queryKey);
      if (cached) {
        this.updateQueryStats(query.query, true, 0);
        this.emit('cache:hit', { query: query.query, key: queryKey });
        
        return {
          id: this.generateResultId(),
          query,
          results: cached,
          timestamp: Date.now(),
          responseTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }
    
    // Create pending search promise
    const searchPromise = this.performSearch(query, queryKey, searchFunction, startTime);
    this.pendingSearches.set(queryKey, searchPromise);
    
    try {
      const result = await searchPromise;
      return result;
    } finally {
      this.pendingSearches.delete(queryKey);
    }
  }

  /**
   * Perform actual search
   */
  private async performSearch(
    query: SearchQuery,
    queryKey: string,
    searchFunction: (query: SearchQuery) => Promise<any[]>,
    startTime: number
  ): Promise<SearchResult> {
    try {
      // Perform the search
      const results = await searchFunction(query);
      const responseTime = Date.now() - startTime;
      
      // Create result object
      const searchResult: SearchResult = {
        id: this.generateResultId(),
        query,
        results,
        timestamp: Date.now(),
        responseTime,
        fromCache: false
      };
      
      // Cache the results
      if (this.config.cacheEnabled && results.length > 0) {
        await this.cacheResults(queryKey, results);
      }
      
      // Update statistics
      this.updateQueryStats(query.query, false, responseTime);
      
      // Check for prefetch opportunities
      if (this.config.prefetchEnabled) {
        this.checkPrefetchOpportunity(query);
      }
      
      // Track search in database
      await this.trackSearch(searchResult);
      
      this.emit('search:complete', searchResult);
      
      return searchResult;
    } catch (error) {
      log.error('Search error:', error);
      this.emit('search:error', { query, error });
      throw error;
    }
  }

  /**
   * Get results from cache
   */
  private async getFromCache(queryKey: string): Promise<any[] | null> {
    try {
      const cached = await this.cacheManager.get<any>('search', queryKey);
      if (cached) {
        // Decompress if needed
        if (cached._compressed) {
          return await this.decompress(cached);
        }
        return cached;
      }
    } catch (error) {
      log.error('Cache retrieval error:', error);
    }
    return null;
  }

  /**
   * Cache search results
   */
  private async cacheResults(queryKey: string, results: any[]): Promise<void> {
    try {
      let dataToCache = results;
      
      // Compress if results are large
      const size = JSON.stringify(results).length;
      if (size > this.config.compressionThreshold) {
        dataToCache = await this.compress(results);
      }
      
      await this.cacheManager.set(
        'search',
        queryKey,
        dataToCache,
        this.config.cacheTTL
      );
      
      log.debug(`Cached search results for: ${queryKey}`);
    } catch (error) {
      log.error('Cache storage error:', error);
    }
  }

  /**
   * Generate cache key for query
   */
  private generateQueryKey(query: SearchQuery): string {
    const normalized = {
      q: query.query.toLowerCase().trim(),
      e: (query.engines || []).sort().join(','),
      c: (query.categories || []).sort().join(','),
      l: query.language || 'en',
      t: query.timeRange || 'all',
      s: query.safeSearch ? '1' : '0'
    };
    
    const keyString = JSON.stringify(normalized);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(query: string, fromCache: boolean, responseTime: number): void {
    const normalizedQuery = query.toLowerCase().trim();
    const existing = this.queryStats.get(normalizedQuery) || {
      query: normalizedQuery,
      count: 0,
      avgResponseTime: 0,
      lastSearched: 0,
      cacheHits: 0
    };
    
    existing.count++;
    existing.lastSearched = Date.now();
    
    if (fromCache) {
      existing.cacheHits++;
    } else {
      // Update average response time
      existing.avgResponseTime = 
        (existing.avgResponseTime * (existing.count - 1) + responseTime) / existing.count;
    }
    
    this.queryStats.set(normalizedQuery, existing);
  }

  /**
   * Check if we should prefetch related queries
   */
  private async checkPrefetchOpportunity(query: SearchQuery): Promise<void> {
    const stats = this.queryStats.get(query.query.toLowerCase().trim());
    
    if (!stats || stats.count < this.config.prefetchThreshold) {
      return;
    }
    
    // Get related queries from history
    const relatedQueries = await this.getRelatedQueries(query.query);
    
    // Prefetch top related queries
    for (const related of relatedQueries.slice(0, 3)) {
      this.prefetchQuery(related, query).catch(error => {
        log.debug('Prefetch error:', error);
      });
    }
  }

  /**
   * Prefetch a query
   */
  private async prefetchQuery(
    relatedQuery: string,
    originalQuery: SearchQuery
  ): Promise<void> {
    const prefetchQuery: SearchQuery = {
      ...originalQuery,
      query: relatedQuery
    };
    
    const queryKey = this.generateQueryKey(prefetchQuery);
    
    // Check if already cached
    const cached = await this.getFromCache(queryKey);
    if (cached) {
      return;
    }
    
    log.debug(`Prefetching query: ${relatedQuery}`);
    this.emit('prefetch:start', relatedQuery);
    
    // Note: This would need the actual search function
    // For now, we'll just emit the event
    this.emit('prefetch:needed', prefetchQuery);
  }

  /**
   * Get related queries based on search history
   */
  private async getRelatedQueries(query: string): Promise<string[]> {
    try {
      // Get from database
      const related = await this.databaseManager.getRelatedQueries(query, 10);
      return related.map(r => r.query);
    } catch (error) {
      log.error('Failed to get related queries:', error);
      return [];
    }
  }

  /**
   * Track search in database
   */
  private async trackSearch(result: SearchResult): Promise<void> {
    try {
      await this.databaseManager.trackSearch({
        query: result.query.query,
        engines: result.query.engines || [],
        resultCount: result.results.length,
        responseTime: result.responseTime,
        fromCache: result.fromCache,
        timestamp: result.timestamp
      });
    } catch (error) {
      log.error('Failed to track search:', error);
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(partial: string, limit: number = 10): Promise<string[]> {
    if (partial.length < this.config.minQueryLength) {
      return [];
    }
    
    const normalized = partial.toLowerCase().trim();
    const suggestions: Array<{ query: string; score: number }> = [];
    
    // Score based on frequency and recency
    const now = Date.now();
    for (const [query, stats] of this.queryStats) {
      if (query.startsWith(normalized)) {
        const recencyScore = 1 / (1 + (now - stats.lastSearched) / 86400000); // Decay over days
        const frequencyScore = Math.log(stats.count + 1);
        const score = recencyScore * frequencyScore;
        
        suggestions.push({ query: stats.query, score });
      }
    }
    
    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.query);
  }

  /**
   * Clear cache for specific query or all
   */
  async clearCache(query?: string): Promise<void> {
    if (query) {
      const queryKey = this.generateQueryKey({ query });
      await this.cacheManager.delete('search', queryKey);
    } else {
      await this.cacheManager.clear('search');
    }
    
    this.emit('cache:cleared', query);
  }

  /**
   * Get optimization statistics
   */
  getStatistics(): {
    totalQueries: number;
    uniqueQueries: number;
    cacheHitRate: number;
    avgResponseTime: number;
    topQueries: Array<{ query: string; count: number }>;
  } {
    let totalQueries = 0;
    let totalCacheHits = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    const queries = Array.from(this.queryStats.values());
    
    for (const stats of queries) {
      totalQueries += stats.count;
      totalCacheHits += stats.cacheHits;
      if (stats.avgResponseTime > 0) {
        totalResponseTime += stats.avgResponseTime;
        responseTimeCount++;
      }
    }
    
    const topQueries = queries
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(q => ({ query: q.query, count: q.count }));
    
    return {
      totalQueries,
      uniqueQueries: queries.length,
      cacheHitRate: totalQueries > 0 ? totalCacheHits / totalQueries : 0,
      avgResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      topQueries
    };
  }

  /**
   * Clean up old entries
   */
  private async cleanupOldEntries(): Promise<void> {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Clean up old stats
    for (const [query, stats] of this.queryStats) {
      if (now - stats.lastSearched > maxAge) {
        this.queryStats.delete(query);
      }
    }
    
    // Clean up old cache entries (handled by cache TTL)
    
    log.debug('Search optimizer cleanup completed');
  }

  /**
   * Load query statistics from database
   */
  private async loadQueryStats(): Promise<void> {
    try {
      const stats = await this.databaseManager.getQueryStatistics(100);
      
      for (const stat of stats) {
        this.queryStats.set(stat.query, {
          query: stat.query,
          count: stat.count,
          avgResponseTime: stat.avgResponseTime,
          lastSearched: stat.lastSearched,
          cacheHits: 0 // Reset cache hits on load
        });
      }
      
      log.info(`Loaded ${stats.length} query statistics`);
    } catch (error) {
      log.error('Failed to load query statistics:', error);
    }
  }

  /**
   * Save query statistics to database
   */
  async saveQueryStats(): Promise<void> {
    try {
      const stats = Array.from(this.queryStats.values());
      await this.databaseManager.saveQueryStatistics(stats);
      log.debug('Query statistics saved');
    } catch (error) {
      log.error('Failed to save query statistics:', error);
    }
  }

  /**
   * Compression helpers
   */
  private async compress(data: any): Promise<any> {
    const zlib = await import('zlib');
    const util = await import('util');
    const gzip = util.promisify(zlib.gzip);
    
    const json = JSON.stringify(data);
    const compressed = await gzip(json);
    
    return {
      _compressed: true,
      data: compressed.toString('base64')
    };
  }

  private async decompress(compressed: any): Promise<any> {
    const zlib = await import('zlib');
    const util = await import('util');
    const gunzip = util.promisify(zlib.gunzip);
    
    const buffer = Buffer.from(compressed.data, 'base64');
    const json = await gunzip(buffer);
    
    return JSON.parse(json.toString());
  }

  /**
   * Generate unique result ID
   */
  private generateResultId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.saveQueryStats();
    this.queryStats.clear();
    this.pendingSearches.clear();
    this.removeAllListeners();
    
    log.info('Search optimizer cleaned up');
  }
}