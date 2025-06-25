import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { SearchResult } from './LibrarySearchService';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CachedSearch {
  id: string;
  query: string;
  normalizedQuery: string;
  results: SearchResult[];
  cachedAt: Date;
  lastAccessed: Date;
  accessCount: number;
  resultCount: number;
  hasLocalResults: boolean;
  hasSearxngResults: boolean;
  compressed: boolean;
  expiresAt?: Date;
}

export interface CacheStats {
  totalCachedSearches: number;
  totalCachedResults: number;
  cacheSize: number; // in bytes
  oldestEntry: Date | null;
  newestEntry: Date | null;
  hitRate: number;
  compressionRatio: number;
}

export interface OfflineCacheOptions {
  maxCacheSize?: number; // in MB
  maxSearchAge?: number; // in days
  compressionThreshold?: number; // compress if results > N
  enableCompression?: boolean;
  cleanupInterval?: number; // in hours
}

/**
 * Week 3 Day 3: Offline Cache Manager
 * 
 * Provides persistent caching of search results for offline mode,
 * with intelligent compression, cleanup, and fallback strategies.
 */
export class OfflineCacheManager {
  private db: Database.Database;
  private dbPath: string;
  private options: Required<OfflineCacheOptions>;
  private cleanupTimer?: NodeJS.Timeout;
  
  private readonly DEFAULT_OPTIONS: Required<OfflineCacheOptions> = {
    maxCacheSize: 100, // 100MB
    maxSearchAge: 30, // 30 days
    compressionThreshold: 20, // compress if > 20 results
    enableCompression: true,
    cleanupInterval: 24 // cleanup every 24 hours
  };
  
  constructor(customPath?: string, options?: OfflineCacheOptions) {
    this.options = { ...this.DEFAULT_OPTIONS, ...options };
    
    // Use custom path or default to app data directory
    this.dbPath = customPath || path.join(app.getPath('userData'), 'offline-cache.db');
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Initialize database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    
    this.initializeDatabase();
    this.startCleanupTimer();
  }
  
  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    // Main cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        normalized_query TEXT NOT NULL,
        results_data TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL,
        access_count INTEGER DEFAULT 1,
        result_count INTEGER NOT NULL,
        has_local_results INTEGER DEFAULT 0,
        has_searxng_results INTEGER DEFAULT 0,
        compressed INTEGER DEFAULT 0,
        expires_at INTEGER,
        data_size INTEGER NOT NULL
      )
    `);
    
    // Indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_normalized_query ON search_cache(normalized_query);
      CREATE INDEX IF NOT EXISTS idx_cached_at ON search_cache(cached_at DESC);
      CREATE INDEX IF NOT EXISTS idx_last_accessed ON search_cache(last_accessed DESC);
      CREATE INDEX IF NOT EXISTS idx_expires_at ON search_cache(expires_at);
    `);
    
    // Cache statistics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_stats (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }
  
  /**
   * Cache search results
   */
  async cacheSearchResults(query: string, results: SearchResult[]): Promise<void> {
    const id = this.generateCacheId(query);
    const normalizedQuery = this.normalizeQuery(query);
    const now = Date.now();
    
    // Determine if compression is needed
    const shouldCompress = this.options.enableCompression && 
                          results.length > this.options.compressionThreshold;
    
    // Serialize and optionally compress results
    let resultsData: string;
    let compressed = false;
    
    try {
      const jsonData = JSON.stringify(results);
      
      if (shouldCompress) {
        const compressedData = await gzip(jsonData);
        resultsData = compressedData.toString('base64');
        compressed = true;
      } else {
        resultsData = jsonData;
      }
      
      // Calculate expiration
      const expiresAt = this.options.maxSearchAge > 0 
        ? now + (this.options.maxSearchAge * 24 * 60 * 60 * 1000)
        : null;
      
      // Check for local and searxng results
      const hasLocalResults = results.some(r => r.source === 'local' || r.source === 'hybrid');
      const hasSearxngResults = results.some(r => r.source === 'searxng' || r.source === 'hybrid');
      
      // Insert or update cache entry
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO search_cache 
        (id, query, normalized_query, results_data, cached_at, last_accessed, 
         access_count, result_count, has_local_results, has_searxng_results, 
         compressed, expires_at, data_size)
        VALUES (?, ?, ?, ?, ?, ?, 
          COALESCE((SELECT access_count FROM search_cache WHERE id = ?), 0) + 1,
          ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, query, normalizedQuery, resultsData, now, now,
        id, // for COALESCE subquery
        results.length, hasLocalResults ? 1 : 0, hasSearxngResults ? 1 : 0,
        compressed ? 1 : 0, expiresAt, resultsData.length
      );
      
      // Update statistics
      this.updateCacheStats();
      
    } catch (error) {
      console.error('Failed to cache search results:', error);
      throw error;
    }
  }
  
  /**
   * Retrieve cached search results
   */
  async getCachedResults(query: string): Promise<CachedSearch | null> {
    const normalizedQuery = this.normalizeQuery(query);
    
    try {
      // Look for exact match first
      let row = this.db.prepare(`
        SELECT * FROM search_cache 
        WHERE normalized_query = ? 
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY last_accessed DESC
        LIMIT 1
      `).get(normalizedQuery, Date.now());
      
      // If no exact match, try fuzzy match
      if (!row) {
        row = this.db.prepare(`
          SELECT * FROM search_cache 
          WHERE normalized_query LIKE ? 
          AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY last_accessed DESC, result_count DESC
          LIMIT 1
        `).get(`%${normalizedQuery}%`, Date.now());
      }
      
      if (!row) return null;
      
      // Update access count and last accessed
      this.db.prepare(`
        UPDATE search_cache 
        SET last_accessed = ?, access_count = access_count + 1
        WHERE id = ?
      `).run(Date.now(), row.id);
      
      // Decompress results if needed
      let results: SearchResult[];
      if (row.compressed) {
        const compressedBuffer = Buffer.from(row.results_data, 'base64');
        const decompressed = await gunzip(compressedBuffer);
        results = JSON.parse(decompressed.toString());
      } else {
        results = JSON.parse(row.results_data);
      }
      
      return {
        id: row.id,
        query: row.query,
        normalizedQuery: row.normalized_query,
        results,
        cachedAt: new Date(row.cached_at),
        lastAccessed: new Date(row.last_accessed),
        accessCount: row.access_count,
        resultCount: row.result_count,
        hasLocalResults: row.has_local_results === 1,
        hasSearxngResults: row.has_searxng_results === 1,
        compressed: row.compressed === 1,
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined
      };
      
    } catch (error) {
      console.error('Failed to retrieve cached results:', error);
      return null;
    }
  }
  
  /**
   * Get similar searches for suggestions in offline mode
   */
  async getSimilarSearches(partialQuery: string, limit: number = 10): Promise<string[]> {
    const normalized = this.normalizeQuery(partialQuery);
    
    try {
      const rows = this.db.prepare(`
        SELECT DISTINCT query, access_count, result_count
        FROM search_cache
        WHERE normalized_query LIKE ?
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY access_count DESC, result_count DESC
        LIMIT ?
      `).all(`%${normalized}%`, Date.now(), limit);
      
      return rows.map(row => row.query);
      
    } catch (error) {
      console.error('Failed to get similar searches:', error);
      return [];
    }
  }
  
  /**
   * Get frequently accessed searches for offline suggestions
   */
  async getFrequentSearches(limit: number = 20): Promise<CachedSearch[]> {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM search_cache
        WHERE (expires_at IS NULL OR expires_at > ?)
        ORDER BY access_count DESC, last_accessed DESC
        LIMIT ?
      `).all(Date.now(), limit);
      
      const searches: CachedSearch[] = [];
      
      for (const row of rows) {
        // Decompress results
        let results: SearchResult[];
        if (row.compressed) {
          const compressedBuffer = Buffer.from(row.results_data, 'base64');
          const decompressed = await gunzip(compressedBuffer);
          results = JSON.parse(decompressed.toString());
        } else {
          results = JSON.parse(row.results_data);
        }
        
        searches.push({
          id: row.id,
          query: row.query,
          normalizedQuery: row.normalized_query,
          results,
          cachedAt: new Date(row.cached_at),
          lastAccessed: new Date(row.last_accessed),
          accessCount: row.access_count,
          resultCount: row.result_count,
          hasLocalResults: row.has_local_results === 1,
          hasSearxngResults: row.has_searxng_results === 1,
          compressed: row.compressed === 1,
          expiresAt: row.expires_at ? new Date(row.expires_at) : undefined
        });
      }
      
      return searches;
      
    } catch (error) {
      console.error('Failed to get frequent searches:', error);
      return [];
    }
  }
  
  /**
   * Clear expired cache entries
   */
  async cleanupExpiredCache(): Promise<number> {
    try {
      const result = this.db.prepare(`
        DELETE FROM search_cache
        WHERE expires_at IS NOT NULL AND expires_at < ?
      `).run(Date.now());
      
      this.updateCacheStats();
      return result.changes;
      
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
      return 0;
    }
  }
  
  /**
   * Clear cache by size limit
   */
  async cleanupBySize(): Promise<number> {
    try {
      const maxSizeBytes = this.options.maxCacheSize * 1024 * 1024;
      
      // Get current total size
      const { total_size } = this.db.prepare(`
        SELECT SUM(data_size) as total_size FROM search_cache
      `).get();
      
      if (total_size <= maxSizeBytes) return 0;
      
      // Delete oldest entries until under limit
      const toDelete = this.db.prepare(`
        SELECT id, data_size FROM search_cache
        ORDER BY last_accessed ASC
      `).all();
      
      let deletedCount = 0;
      let currentSize = total_size;
      
      for (const entry of toDelete) {
        if (currentSize <= maxSizeBytes) break;
        
        this.db.prepare('DELETE FROM search_cache WHERE id = ?').run(entry.id);
        currentSize -= entry.data_size;
        deletedCount++;
      }
      
      this.updateCacheStats();
      return deletedCount;
      
    } catch (error) {
      console.error('Failed to cleanup by size:', error);
      return 0;
    }
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_searches,
          SUM(result_count) as total_results,
          SUM(data_size) as total_size,
          MIN(cached_at) as oldest_entry,
          MAX(cached_at) as newest_entry,
          AVG(CASE WHEN compressed = 1 THEN data_size ELSE 0 END) as avg_compressed_size,
          AVG(CASE WHEN compressed = 0 THEN data_size ELSE 0 END) as avg_uncompressed_size,
          SUM(access_count) as total_accesses,
          COUNT(DISTINCT normalized_query) as unique_queries
        FROM search_cache
      `).get();
      
      // Calculate hit rate from stats table
      const hitRateRow = this.db.prepare(`
        SELECT value FROM cache_stats WHERE key = 'hit_rate'
      `).get();
      
      const hitRate = hitRateRow ? parseFloat(hitRateRow.value) : 0;
      
      // Calculate compression ratio
      const compressionRatio = stats.avg_uncompressed_size > 0
        ? stats.avg_compressed_size / stats.avg_uncompressed_size
        : 1;
      
      return {
        totalCachedSearches: stats.total_searches || 0,
        totalCachedResults: stats.total_results || 0,
        cacheSize: stats.total_size || 0,
        oldestEntry: stats.oldest_entry ? new Date(stats.oldest_entry) : null,
        newestEntry: stats.newest_entry ? new Date(stats.newest_entry) : null,
        hitRate,
        compressionRatio: 1 - compressionRatio // Show as savings percentage
      };
      
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalCachedSearches: 0,
        totalCachedResults: 0,
        cacheSize: 0,
        oldestEntry: null,
        newestEntry: null,
        hitRate: 0,
        compressionRatio: 0
      };
    }
  }
  
  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    try {
      this.db.exec('DELETE FROM search_cache');
      this.db.exec('DELETE FROM cache_stats');
      console.log('Offline cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }
  
  /**
   * Export cache for backup
   */
  async exportCache(): Promise<any> {
    try {
      const searches = this.db.prepare('SELECT * FROM search_cache').all();
      const stats = await this.getCacheStats();
      
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        searches: searches.length,
        stats,
        data: searches
      };
      
    } catch (error) {
      console.error('Failed to export cache:', error);
      throw error;
    }
  }
  
  /**
   * Import cache from backup
   */
  async importCache(data: any): Promise<void> {
    if (data.version !== 1) {
      throw new Error('Unsupported cache version');
    }
    
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO search_cache 
        (id, query, normalized_query, results_data, cached_at, last_accessed,
         access_count, result_count, has_local_results, has_searxng_results,
         compressed, expires_at, data_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const entry of data.data) {
        stmt.run(
          entry.id, entry.query, entry.normalized_query, entry.results_data,
          entry.cached_at, entry.last_accessed, entry.access_count,
          entry.result_count, entry.has_local_results, entry.has_searxng_results,
          entry.compressed, entry.expires_at, entry.data_size
        );
      }
      
      this.updateCacheStats();
      
    } catch (error) {
      console.error('Failed to import cache:', error);
      throw error;
    }
  }
  
  /**
   * Cleanup and close database
   */
  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.db.close();
  }
  
  // Private helper methods
  
  private generateCacheId(query: string): string {
    return `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  private updateCacheStats(): void {
    try {
      const now = Date.now();
      
      // Update last cleanup time
      this.db.prepare(`
        INSERT OR REPLACE INTO cache_stats (key, value, updated_at)
        VALUES ('last_cleanup', ?, ?)
      `).run(now.toString(), now);
      
    } catch (error) {
      console.error('Failed to update cache stats:', error);
    }
  }
  
  private startCleanupTimer(): void {
    if (this.options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.performScheduledCleanup();
      }, this.options.cleanupInterval * 60 * 60 * 1000);
    }
  }
  
  private async performScheduledCleanup(): Promise<void> {
    console.log('Performing scheduled cache cleanup...');
    
    const expiredCount = await this.cleanupExpiredCache();
    const sizeCount = await this.cleanupBySize();
    
    console.log(`Cache cleanup complete: ${expiredCount} expired, ${sizeCount} by size`);
  }
}