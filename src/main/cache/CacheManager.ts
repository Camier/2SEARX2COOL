import log from 'electron-log';
import { EventEmitter } from 'events';
import { MemoryAwareCacheStrategy } from './MemoryAwareCacheStrategy';
import type { DatabaseManager } from '../database/DatabaseManager';

export interface CacheConfig {
  maxMemoryMB?: number;
  ttl?: number;
  persistentCache?: boolean;
  compressionEnabled?: boolean;
}

export interface CacheRegion {
  name: string;
  strategy: MemoryAwareCacheStrategy;
  config: CacheConfig;
}

export class CacheManager extends EventEmitter {
  private regions: Map<string, CacheRegion> = new Map();
  private databaseManager: DatabaseManager;
  private globalConfig: CacheConfig = {
    maxMemoryMB: 50,
    ttl: 3600000, // 1 hour default
    persistentCache: true,
    compressionEnabled: true
  };

  constructor(databaseManager: DatabaseManager) {
    super();
    this.databaseManager = databaseManager;
  }

  async initialize(config?: CacheConfig): Promise<void> {
    if (config) {
      this.globalConfig = { ...this.globalConfig, ...config };
    }

    // Create default regions
    this.createRegion('search', {
      maxMemoryMB: 30,
      ttl: 1800000 // 30 minutes for search results
    });

    this.createRegion('plugins', {
      maxMemoryMB: 10,
      ttl: 3600000 // 1 hour for plugin data
    });

    this.createRegion('assets', {
      maxMemoryMB: 20,
      ttl: 86400000 // 24 hours for assets
    });

    this.createRegion('api', {
      maxMemoryMB: 15,
      ttl: 300000 // 5 minutes for API responses
    });

    // Load persistent cache if enabled
    if (this.globalConfig.persistentCache) {
      await this.loadPersistentCache();
    }

    log.info('Cache manager initialized with regions:', Array.from(this.regions.keys()));
  }

  /**
   * Create a new cache region
   */
  createRegion(name: string, config?: Partial<CacheConfig>): CacheRegion {
    const regionConfig = { ...this.globalConfig, ...config };
    const strategy = new MemoryAwareCacheStrategy(regionConfig.maxMemoryMB);
    
    const region: CacheRegion = {
      name,
      strategy,
      config: regionConfig
    };

    // Set up event forwarding
    strategy.on('evict', (key) => {
      this.emit('evict', { region: name, key });
    });

    strategy.on('memory:pressure', (pressure) => {
      this.emit('memory:pressure', { region: name, pressure });
    });

    this.regions.set(name, region);
    return region;
  }

  /**
   * Get value from cache
   */
  async get<T>(region: string, key: string): Promise<T | undefined> {
    const cacheRegion = this.regions.get(region);
    if (!cacheRegion) {
      log.warn(`Cache region '${region}' not found`);
      return undefined;
    }

    // Try memory cache first
    let value = cacheRegion.strategy.get(key);
    
    // Try persistent cache if not in memory
    if (!value && this.globalConfig.persistentCache) {
      value = await this.getPersistent(region, key);
      if (value) {
        // Restore to memory cache
        cacheRegion.strategy.set(key, value, cacheRegion.config.ttl);
      }
    }

    return value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(region: string, key: string, value: T, ttl?: number): Promise<boolean> {
    const cacheRegion = this.regions.get(region);
    if (!cacheRegion) {
      log.warn(`Cache region '${region}' not found`);
      return false;
    }

    // Compress if enabled and value is large
    let processedValue = value;
    if (this.shouldCompress(value)) {
      processedValue = await this.compress(value);
    }

    const success = cacheRegion.strategy.set(key, processedValue, ttl || cacheRegion.config.ttl);

    // Persist if enabled
    if (success && this.globalConfig.persistentCache) {
      await this.setPersistent(region, key, processedValue).catch(e => {
        log.error('Failed to persist cache entry:', e);
      });
    }

    return success;
  }

  /**
   * Delete from cache
   */
  async delete(region: string, key: string): Promise<boolean> {
    const cacheRegion = this.regions.get(region);
    if (!cacheRegion) {
      return false;
    }

    const deleted = cacheRegion.strategy.delete(key);

    // Remove from persistent cache
    if (this.globalConfig.persistentCache) {
      await this.deletePersistent(region, key).catch(e => {
        log.error('Failed to delete from persistent cache:', e);
      });
    }

    return deleted;
  }

  /**
   * Clear entire region or all cache
   */
  async clear(region?: string): Promise<void> {
    if (region) {
      const cacheRegion = this.regions.get(region);
      if (cacheRegion) {
        cacheRegion.strategy.clear();
        await this.clearPersistentRegion(region);
      }
    } else {
      // Clear all regions
      for (const [name, region] of this.regions) {
        region.strategy.clear();
      }
      await this.clearAllPersistent();
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    global: {
      totalMemoryMB: number;
      totalItems: number;
      hitRate: number;
    };
    regions: Record<string, any>;
  } {
    let totalMemory = 0;
    let totalItems = 0;
    let totalHits = 0;
    let totalRequests = 0;
    const regionStats: Record<string, any> = {};

    for (const [name, region] of this.regions) {
      const stats = region.strategy.getStats();
      regionStats[name] = stats;
      
      totalMemory += stats.totalSize;
      totalItems += stats.itemCount;
      totalHits += stats.hits;
      totalRequests += stats.hits + stats.misses;
    }

    return {
      global: {
        totalMemoryMB: totalMemory / 1024 / 1024,
        totalItems,
        hitRate: totalRequests > 0 ? totalHits / totalRequests : 0
      },
      regions: regionStats
    };
  }

  /**
   * Optimize all cache regions
   */
  async optimizeAll(): Promise<void> {
    log.info('Optimizing all cache regions...');
    
    for (const [name, region] of this.regions) {
      const report = region.strategy.getMemoryReport();
      log.debug(`Region ${name}: ${report.totalSizeMB.toFixed(2)}MB, ${report.itemCount} items`);
      
      // Trigger cleanup on high memory regions
      if (report.totalSizeMB > region.config.maxMemoryMB! * 0.9) {
        region.strategy.clear();
        log.info(`Cleared high-memory region: ${name}`);
      }
    }
  }

  /**
   * Adjust memory limits dynamically
   */
  adjustMemoryLimits(totalAvailableMB: number): void {
    const regionCount = this.regions.size;
    const perRegionMB = Math.floor(totalAvailableMB / regionCount);
    
    for (const [name, region] of this.regions) {
      region.strategy.setMaxMemory(perRegionMB);
      log.info(`Adjusted ${name} cache limit to ${perRegionMB}MB`);
    }
  }

  // Persistent cache methods
  private async loadPersistentCache(): Promise<void> {
    try {
      const entries = await this.databaseManager.loadCache();
      let loaded = 0;
      
      for (const entry of entries) {
        const region = this.regions.get(entry.region);
        if (region) {
          region.strategy.set(entry.key, entry.value, entry.ttl);
          loaded++;
        }
      }
      
      log.info(`Loaded ${loaded} entries from persistent cache`);
    } catch (error) {
      log.error('Failed to load persistent cache:', error);
    }
  }

  private async getPersistent(region: string, key: string): Promise<any> {
    try {
      return await this.databaseManager.getCacheEntry(region, key);
    } catch (error) {
      log.error('Failed to get from persistent cache:', error);
      return undefined;
    }
  }

  private async setPersistent(region: string, key: string, value: any): Promise<void> {
    await this.databaseManager.setCacheEntry(region, key, value);
  }

  private async deletePersistent(region: string, key: string): Promise<void> {
    await this.databaseManager.deleteCacheEntry(region, key);
  }

  private async clearPersistentRegion(region: string): Promise<void> {
    await this.databaseManager.clearCacheRegion(region);
  }

  private async clearAllPersistent(): Promise<void> {
    await this.databaseManager.clearAllCache();
  }

  // Compression helpers
  private shouldCompress(value: any): boolean {
    if (!this.globalConfig.compressionEnabled) return false;
    
    try {
      const size = JSON.stringify(value).length;
      return size > 10240; // Compress if > 10KB
    } catch {
      return false;
    }
  }

  private async compress(value: any): Promise<any> {
    const zlib = await import('zlib');
    const util = await import('util');
    const gzip = util.promisify(zlib.gzip);
    
    const json = JSON.stringify(value);
    const compressed = await gzip(json);
    
    return {
      _compressed: true,
      data: compressed.toString('base64')
    };
  }

  private async decompress(value: any): Promise<any> {
    if (!value._compressed) return value;
    
    const zlib = await import('zlib');
    const util = await import('util');
    const gunzip = util.promisify(zlib.gunzip);
    
    const compressed = Buffer.from(value.data, 'base64');
    const json = await gunzip(compressed);
    
    return JSON.parse(json.toString());
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Save current cache to persistent storage
    if (this.globalConfig.persistentCache) {
      await this.saveToPersistent();
    }
    
    // Clear all regions
    for (const region of this.regions.values()) {
      region.strategy.clear();
    }
    
    this.regions.clear();
    this.removeAllListeners();
    
    log.info('Cache manager cleaned up');
  }

  private async saveToPersistent(): Promise<void> {
    // Implementation would save current in-memory cache to database
    log.debug('Saving cache to persistent storage...');
  }
}