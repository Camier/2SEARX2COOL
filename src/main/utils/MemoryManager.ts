import { app, webContents } from 'electron';
import log from 'electron-log';
import { EventEmitter } from 'events';

interface MemoryUsage {
  timestamp: number;
  process: {
    private: number;
    shared: number;
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  system: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  renderers: Array<{
    id: number;
    pid: number;
    memory: any;
  }>;
}

interface MemoryThresholds {
  warning: number; // MB
  critical: number; // MB
  rendererWarning: number; // MB
}

export class MemoryManager extends EventEmitter {
  private static instance: MemoryManager;
  private monitorInterval?: NodeJS.Timeout;
  private memoryHistory: MemoryUsage[] = [];
  private maxHistorySize = 100;
  private gcForceThreshold = 500; // MB
  
  private thresholds: MemoryThresholds = {
    warning: 300,
    critical: 500,
    rendererWarning: 150
  };

  private constructor() {
    super();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs = 10000): void {
    if (this.monitorInterval) {
      log.warn('Memory monitoring already started');
      return;
    }

    log.info(`Starting memory monitoring with ${intervalMs}ms interval`);
    
    this.monitorInterval = setInterval(() => {
      this.checkMemoryUsage().catch(error => {
        log.error('Memory monitoring error:', error);
      });
    }, intervalMs);

    // Initial check
    this.checkMemoryUsage();
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      log.info('Memory monitoring stopped');
    }
  }

  /**
   * Get current memory usage
   */
  async getCurrentUsage(): Promise<MemoryUsage> {
    const processMetrics = process.memoryUsage();
    const systemMetrics = await this.getSystemMemory();
    const rendererMetrics = await this.getRendererMemory();

    const usage: MemoryUsage = {
      timestamp: Date.now(),
      process: {
        private: processMetrics.rss - processMetrics.external,
        shared: processMetrics.external,
        rss: processMetrics.rss,
        heapUsed: processMetrics.heapUsed,
        heapTotal: processMetrics.heapTotal,
        external: processMetrics.external,
        arrayBuffers: processMetrics.arrayBuffers
      },
      system: systemMetrics,
      renderers: rendererMetrics
    };

    // Add to history
    this.memoryHistory.push(usage);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    return usage;
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      log.info('Forcing garbage collection');
      global.gc();
      return true;
    } else {
      log.warn('Garbage collection not available. Run with --expose-gc flag');
      return false;
    }
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory(): Promise<{
    before: number;
    after: number;
    freed: number;
  }> {
    const before = process.memoryUsage().heapUsed;
    
    // Clear caches
    await this.clearCaches();
    
    // Force GC if available
    this.forceGarbageCollection();
    
    // Clear module cache for non-essential modules
    this.clearModuleCache();
    
    // Optimize renderer processes
    await this.optimizeRenderers();
    
    const after = process.memoryUsage().heapUsed;
    const freed = before - after;
    
    log.info(`Memory optimization completed. Freed: ${(freed / 1024 / 1024).toFixed(2)}MB`);
    
    return { before, after, freed };
  }

  /**
   * Set memory thresholds
   */
  setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    log.info('Memory thresholds updated:', this.thresholds);
  }

  /**
   * Get memory statistics
   */
  getStatistics(): {
    current: MemoryUsage | null;
    average: {
      heapUsed: number;
      rss: number;
    };
    peak: {
      heapUsed: number;
      rss: number;
      timestamp: number;
    };
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    if (this.memoryHistory.length === 0) {
      return {
        current: null,
        average: { heapUsed: 0, rss: 0 },
        peak: { heapUsed: 0, rss: 0, timestamp: 0 },
        trend: 'stable'
      };
    }

    const current = this.memoryHistory[this.memoryHistory.length - 1];
    
    // Calculate averages
    const average = this.memoryHistory.reduce((acc, usage) => {
      acc.heapUsed += usage.process.heapUsed;
      acc.rss += usage.process.rss;
      return acc;
    }, { heapUsed: 0, rss: 0 });
    
    average.heapUsed /= this.memoryHistory.length;
    average.rss /= this.memoryHistory.length;
    
    // Find peak
    const peak = this.memoryHistory.reduce((max, usage) => {
      if (usage.process.heapUsed > max.heapUsed) {
        return {
          heapUsed: usage.process.heapUsed,
          rss: usage.process.rss,
          timestamp: usage.timestamp
        };
      }
      return max;
    }, { heapUsed: 0, rss: 0, timestamp: 0 });
    
    // Determine trend
    const trend = this.calculateTrend();
    
    return { current, average, peak, trend };
  }

  /**
   * Check memory usage and emit warnings
   */
  private async checkMemoryUsage(): Promise<void> {
    const usage = await this.getCurrentUsage();
    const heapUsedMB = usage.process.heapUsed / 1024 / 1024;
    const rssMB = usage.process.rss / 1024 / 1024;
    
    // Check main process memory
    if (heapUsedMB > this.thresholds.critical) {
      log.error(`Critical memory usage: ${heapUsedMB.toFixed(2)}MB`);
      this.emit('memory:critical', usage);
      
      // Auto-optimize if critical
      this.optimizeMemory().catch(error => {
        log.error('Auto-optimization failed:', error);
      });
    } else if (heapUsedMB > this.thresholds.warning) {
      log.warn(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      this.emit('memory:warning', usage);
    }
    
    // Check renderer processes
    for (const renderer of usage.renderers) {
      const rendererMB = renderer.memory.workingSetSize / 1024;
      if (rendererMB > this.thresholds.rendererWarning) {
        log.warn(`Renderer ${renderer.id} high memory: ${rendererMB.toFixed(2)}MB`);
        this.emit('renderer:memory:warning', renderer);
      }
    }
    
    // Force GC if needed
    if (rssMB > this.gcForceThreshold && global.gc) {
      log.info('Memory threshold exceeded, forcing garbage collection');
      this.forceGarbageCollection();
    }
    
    this.emit('memory:update', usage);
  }

  /**
   * Get system memory information
   */
  private async getSystemMemory(): Promise<{
    total: number;
    free: number;
    used: number;
    percentage: number;
  }> {
    const metrics = await app.getAppMetrics();
    const systemMemory = process.getSystemMemoryInfo();
    
    return {
      total: systemMemory.total,
      free: systemMemory.free,
      used: systemMemory.total - systemMemory.free,
      percentage: ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100
    };
  }

  /**
   * Get renderer process memory usage
   */
  private async getRendererMemory(): Promise<Array<{
    id: number;
    pid: number;
    memory: any;
  }>> {
    const allWebContents = webContents.getAllWebContents();
    const renderers = [];
    
    for (const wc of allWebContents) {
      try {
        const pid = wc.getOSProcessId();
        const metrics = await app.getAppMetrics();
        const processMetric = metrics.find(m => m.pid === pid);
        
        if (processMetric) {
          renderers.push({
            id: wc.id,
            pid,
            memory: processMetric.memory
          });
        }
      } catch (error) {
        log.debug(`Failed to get memory for renderer ${wc.id}:`, error);
      }
    }
    
    return renderers;
  }

  /**
   * Clear various caches
   */
  private async clearCaches(): Promise<void> {
    // Clear session caches
    const sessions = [session.defaultSession];
    for (const ses of sessions) {
      await ses.clearCache();
      await ses.clearStorageData({
        storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      });
    }
    
    // Clear image cache in renderers
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      wc.executeJavaScript(`
        if (window.caches) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
      `).catch(() => {}); // Ignore errors
    }
    
    log.debug('Caches cleared');
  }

  /**
   * Clear module cache for non-essential modules
   */
  private clearModuleCache(): void {
    const essentialModules = [
      'electron',
      'path',
      'fs',
      'crypto',
      'events',
      'util',
      'stream',
      'buffer'
    ];
    
    for (const key in require.cache) {
      if (!essentialModules.some(mod => key.includes(mod))) {
        delete require.cache[key];
      }
    }
    
    log.debug('Module cache cleared');
  }

  /**
   * Optimize renderer processes
   */
  private async optimizeRenderers(): Promise<void> {
    const allWebContents = webContents.getAllWebContents();
    
    for (const wc of allWebContents) {
      try {
        // Run GC in renderer if available
        await wc.executeJavaScript(`
          if (window.gc) {
            window.gc();
          }
          // Clear any large data structures
          if (window.__cleanup) {
            window.__cleanup();
          }
        `);
      } catch (error) {
        log.debug(`Failed to optimize renderer ${wc.id}:`, error);
      }
    }
  }

  /**
   * Calculate memory usage trend
   */
  private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.memoryHistory.length < 5) {
      return 'stable';
    }
    
    // Get last 5 measurements
    const recent = this.memoryHistory.slice(-5);
    const firstAvg = (recent[0].process.heapUsed + recent[1].process.heapUsed) / 2;
    const lastAvg = (recent[3].process.heapUsed + recent[4].process.heapUsed) / 2;
    
    const difference = lastAvg - firstAvg;
    const percentChange = (difference / firstAvg) * 100;
    
    if (percentChange > 10) {
      return 'increasing';
    } else if (percentChange < -10) {
      return 'decreasing';
    }
    
    return 'stable';
  }

  /**
   * Get memory report
   */
  getReport(): string {
    const stats = this.getStatistics();
    const current = stats.current;
    
    if (!current) {
      return 'No memory data available';
    }
    
    const report = [
      '=== Memory Report ===',
      `Timestamp: ${new Date(current.timestamp).toISOString()}`,
      '',
      'Process Memory:',
      `  RSS: ${(current.process.rss / 1024 / 1024).toFixed(2)}MB`,
      `  Heap Used: ${(current.process.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      `  Heap Total: ${(current.process.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      `  External: ${(current.process.external / 1024 / 1024).toFixed(2)}MB`,
      '',
      'System Memory:',
      `  Total: ${(current.system.total / 1024).toFixed(2)}GB`,
      `  Used: ${(current.system.used / 1024).toFixed(2)}GB (${current.system.percentage.toFixed(1)}%)`,
      '',
      'Statistics:',
      `  Average Heap: ${(stats.average.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      `  Peak Heap: ${(stats.peak.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      `  Trend: ${stats.trend}`,
      '',
      'Renderers:',
      ...current.renderers.map(r => 
        `  Renderer ${r.id}: ${(r.memory.workingSetSize / 1024).toFixed(2)}MB`
      ),
      '==================='
    ];
    
    return report.join('\n');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.memoryHistory = [];
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();