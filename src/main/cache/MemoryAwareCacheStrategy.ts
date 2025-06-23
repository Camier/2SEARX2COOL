import log from 'electron-log';
import { EventEmitter } from 'events';

interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  ttl?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  itemCount: number;
}

export class MemoryAwareCacheStrategy<T = any> extends EventEmitter {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxMemory: number; // bytes
  private currentSize = 0;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    itemCount: 0
  };
  
  // LRU with size awareness
  private accessOrder: string[] = [];
  
  // Memory pressure levels
  private memoryPressureLevels = {
    low: 0.7,    // 70% of max memory
    medium: 0.85, // 85% of max memory
    high: 0.95   // 95% of max memory
  };

  constructor(maxMemoryMB: number = 50) {
    super();
    this.maxMemory = maxMemoryMB * 1024 * 1024;
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Set cache value with automatic size calculation
   */
  set(key: string, value: T, ttl?: number): boolean {
    try {
      const size = this.calculateSize(value);
      
      // Check if we need to make room
      if (!this.ensureCapacity(size)) {
        log.warn(`Cache capacity exceeded for key: ${key}`);
        return false;
      }
      
      // Remove existing entry if present
      if (this.cache.has(key)) {
        this.delete(key);
      }
      
      const entry: CacheEntry<T> = {
        key,
        value,
        size,
        timestamp: Date.now(),
        accessCount: 0,
        lastAccess: Date.now(),
        ttl
      };
      
      this.cache.set(key, entry);
      this.currentSize += size;
      this.accessOrder.push(key);
      
      this.stats.itemCount++;
      this.stats.totalSize = this.currentSize;
      
      this.emit('set', key, size);
      
      return true;
    } catch (error) {
      log.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cache value
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    // Update access info
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    // Update LRU order
    this.updateAccessOrder(key);
    
    this.stats.hits++;
    this.emit('hit', key);
    
    return entry.value;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    this.cache.delete(key);
    this.currentSize -= entry.size;
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    
    this.stats.itemCount--;
    this.stats.totalSize = this.currentSize;
    
    this.emit('delete', key);
    
    return true;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const previousSize = this.currentSize;
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
    
    this.stats.itemCount = 0;
    this.stats.totalSize = 0;
    
    this.emit('clear', previousSize);
    log.info(`Cache cleared. Freed ${(previousSize / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & {
    hitRate: number;
    memoryUsage: number;
    memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    const memoryUsage = this.currentSize / this.maxMemory;
    
    let memoryPressure: 'low' | 'medium' | 'high' | 'critical';
    if (memoryUsage < this.memoryPressureLevels.low) {
      memoryPressure = 'low';
    } else if (memoryUsage < this.memoryPressureLevels.medium) {
      memoryPressure = 'medium';
    } else if (memoryUsage < this.memoryPressureLevels.high) {
      memoryPressure = 'high';
    } else {
      memoryPressure = 'critical';
    }
    
    return {
      ...this.stats,
      hitRate,
      memoryUsage,
      memoryPressure
    };
  }

  /**
   * Ensure capacity for new entry
   */
  private ensureCapacity(requiredSize: number): boolean {
    if (requiredSize > this.maxMemory) {
      return false; // Item too large
    }
    
    let attempts = 0;
    while (this.currentSize + requiredSize > this.maxMemory && attempts < 100) {
      if (!this.evictOne()) {
        return false; // Cannot evict more
      }
      attempts++;
    }
    
    return this.currentSize + requiredSize <= this.maxMemory;
  }

  /**
   * Evict one entry using scoring algorithm
   */
  private evictOne(): boolean {
    if (this.cache.size === 0) return false;
    
    let victimKey: string | null = null;
    let lowestScore = Infinity;
    
    // Score = accessCount * recency / size
    // Lower score = better eviction candidate
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      const age = now - entry.lastAccess;
      const recency = 1 / (1 + age / 1000); // Decay over seconds
      const score = (entry.accessCount + 1) * recency / Math.log(entry.size + 1);
      
      if (score < lowestScore) {
        lowestScore = score;
        victimKey = key;
      }
    }
    
    if (victimKey) {
      this.delete(victimKey);
      this.stats.evictions++;
      this.emit('evict', victimKey);
      return true;
    }
    
    return false;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      log.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
    
    // Opportunistic memory optimization
    this.optimizeMemory();
  }

  /**
   * Optimize memory based on pressure
   */
  private optimizeMemory(): void {
    const stats = this.getStats();
    
    if (stats.memoryPressure === 'critical') {
      // Aggressive eviction
      const targetSize = this.maxMemory * 0.7;
      while (this.currentSize > targetSize) {
        if (!this.evictOne()) break;
      }
    } else if (stats.memoryPressure === 'high') {
      // Moderate eviction
      const targetSize = this.maxMemory * 0.85;
      while (this.currentSize > targetSize) {
        if (!this.evictOne()) break;
      }
    }
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    if (value === null || value === undefined) return 0;
    
    // Handle different types
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    } else if (typeof value === 'number') {
      return 8;
    } else if (typeof value === 'boolean') {
      return 4;
    } else if (Buffer.isBuffer(value)) {
      return value.length;
    } else if (value instanceof ArrayBuffer) {
      return value.byteLength;
    } else if (typeof value === 'object') {
      // Rough estimation for objects
      try {
        const json = JSON.stringify(value);
        return json.length * 2;
      } catch {
        return 1024; // Default size for non-serializable objects
      }
    }
    
    return 256; // Default size
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Get memory report
   */
  getMemoryReport(): {
    totalSizeMB: number;
    itemCount: number;
    averageSizeKB: number;
    largestItems: Array<{ key: string; sizeMB: number }>;
    oldestItems: Array<{ key: string; ageMinutes: number }>;
  } {
    const now = Date.now();
    const items = Array.from(this.cache.entries());
    
    // Sort by size
    const largestItems = items
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)
      .map(([key, entry]) => ({
        key,
        sizeMB: entry.size / 1024 / 1024
      }));
    
    // Sort by age
    const oldestItems = items
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 10)
      .map(([key, entry]) => ({
        key,
        ageMinutes: (now - entry.timestamp) / 1000 / 60
      }));
    
    return {
      totalSizeMB: this.currentSize / 1024 / 1024,
      itemCount: this.cache.size,
      averageSizeKB: this.cache.size > 0 ? (this.currentSize / this.cache.size) / 1024 : 0,
      largestItems,
      oldestItems
    };
  }

  /**
   * Adjust memory limit dynamically
   */
  setMaxMemory(maxMemoryMB: number): void {
    this.maxMemory = maxMemoryMB * 1024 * 1024;
    log.info(`Cache memory limit set to ${maxMemoryMB}MB`);
    
    // Trigger optimization if needed
    if (this.currentSize > this.maxMemory) {
      this.optimizeMemory();
    }
  }
}