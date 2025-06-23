import { webContents, WebContents } from 'electron';
import log from 'electron-log';

interface OptimizationOptions {
  clearCache?: boolean;
  clearSessionStorage?: boolean;
  clearLocalStorage?: boolean;
  runGarbageCollection?: boolean;
  disableImages?: boolean;
  throttleJavaScript?: boolean;
}

export class WebContentsOptimizer {
  private static instance: WebContentsOptimizer;
  private optimizationScripts: Map<string, string> = new Map();

  private constructor() {
    this.initializeScripts();
  }

  static getInstance(): WebContentsOptimizer {
    if (!WebContentsOptimizer.instance) {
      WebContentsOptimizer.instance = new WebContentsOptimizer();
    }
    return WebContentsOptimizer.instance;
  }

  /**
   * Initialize optimization scripts
   */
  private initializeScripts(): void {
    // Script to remove unused DOM nodes
    this.optimizationScripts.set('cleanupDOM', `
      (() => {
        // Remove comments
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_COMMENT,
          null,
          false
        );
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach(comment => comment.remove());
        
        // Remove empty text nodes
        const textWalker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        const emptyTexts = [];
        while (textWalker.nextNode()) {
          if (!textWalker.currentNode.textContent.trim()) {
            emptyTexts.push(textWalker.currentNode);
          }
        }
        emptyTexts.forEach(text => text.remove());
        
        // Remove hidden elements with no children
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' && el.children.length === 0) {
            el.remove();
          }
        });
      })();
    `);

    // Script to cleanup event listeners
    this.optimizationScripts.set('cleanupListeners', `
      (() => {
        // Store original addEventListener
        if (!window._originalAddEventListener) {
          window._originalAddEventListener = EventTarget.prototype.addEventListener;
          window._eventListeners = new WeakMap();
        }
        
        // Clean up detached nodes
        if (window._eventListeners) {
          // This is a simplified version - real implementation would be more complex
          console.log('Event listener cleanup performed');
        }
      })();
    `);

    // Script to limit resource usage
    this.optimizationScripts.set('limitResources', `
      (() => {
        // Limit animation frame rate
        let lastTime = 0;
        const targetFPS = 30;
        const frameTime = 1000 / targetFPS;
        
        const originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = (callback) => {
          const currentTime = Date.now();
          const timeToCall = Math.max(0, frameTime - (currentTime - lastTime));
          
          return setTimeout(() => {
            lastTime = currentTime + timeToCall;
            callback(currentTime + timeToCall);
          }, timeToCall);
        };
        
        // Throttle scroll events
        let scrollTimeout;
        const throttledScroll = (e) => {
          if (!scrollTimeout) {
            scrollTimeout = setTimeout(() => {
              scrollTimeout = null;
              // Process scroll
            }, 100);
          }
        };
        
        // Lazy load images
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              imageObserver.unobserve(img);
            }
          });
        });
        images.forEach(img => imageObserver.observe(img));
      })();
    `);

    // Script to clear caches
    this.optimizationScripts.set('clearCaches', `
      (async () => {
        // Clear service worker caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // Clear IndexedDB if needed
        if (window.indexedDB) {
          const databases = await indexedDB.databases();
          // Only clear non-essential databases
          databases.forEach(db => {
            if (db.name && !db.name.includes('essential')) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        }
      })();
    `);
  }

  /**
   * Optimize a specific WebContents
   */
  async optimizeWebContents(
    wc: WebContents,
    options: OptimizationOptions = {}
  ): Promise<void> {
    try {
      const id = wc.id;
      log.debug(`Optimizing WebContents ${id}`);

      // Clear caches if requested
      if (options.clearCache) {
        await wc.session.clearCache();
      }

      if (options.clearSessionStorage || options.clearLocalStorage) {
        await wc.session.clearStorageData({
          storages: [
            options.clearSessionStorage ? 'sessionstorage' : '',
            options.clearLocalStorage ? 'localstorage' : ''
          ].filter(Boolean)
        });
      }

      // Run optimization scripts
      await this.runOptimizationScript(wc, 'cleanupDOM');
      await this.runOptimizationScript(wc, 'limitResources');
      
      if (options.clearCache) {
        await this.runOptimizationScript(wc, 'clearCaches');
      }

      // Run garbage collection if available
      if (options.runGarbageCollection) {
        await wc.executeJavaScript(`
          if (window.gc) {
            window.gc();
            console.log('Garbage collection executed');
          }
        `);
      }

      // Disable images if requested
      if (options.disableImages) {
        await wc.insertCSS('img { display: none !important; }');
      }

      // Throttle JavaScript if requested
      if (options.throttleJavaScript) {
        await wc.setVisualZoomLevelLimits(1, 1);
        await wc.setBackgroundThrottling(true);
      }

      log.debug(`WebContents ${id} optimization complete`);
    } catch (error) {
      log.error('WebContents optimization error:', error);
    }
  }

  /**
   * Optimize all WebContents
   */
  async optimizeAll(options: OptimizationOptions = {}): Promise<void> {
    const allWebContents = webContents.getAllWebContents();
    log.info(`Optimizing ${allWebContents.length} WebContents`);

    const promises = allWebContents.map(wc => 
      this.optimizeWebContents(wc, options).catch(e => 
        log.error(`Failed to optimize WebContents ${wc.id}:`, e)
      )
    );

    await Promise.all(promises);
  }

  /**
   * Monitor WebContents for memory issues
   */
  startMonitoring(thresholdMB: number = 100): void {
    const checkInterval = 30000; // 30 seconds

    setInterval(async () => {
      const allWebContents = webContents.getAllWebContents();
      
      for (const wc of allWebContents) {
        try {
          // Get memory info
          const pid = wc.getOSProcessId();
          const metrics = await app.getAppMetrics();
          const processMetric = metrics.find(m => m.pid === pid);
          
          if (processMetric && processMetric.memory.workingSetSize > thresholdMB * 1024) {
            log.warn(`WebContents ${wc.id} exceeds memory threshold: ${
              (processMetric.memory.workingSetSize / 1024).toFixed(2)
            }MB`);
            
            // Auto-optimize
            await this.optimizeWebContents(wc, {
              clearCache: true,
              runGarbageCollection: true
            });
          }
        } catch (error) {
          log.debug(`Failed to check WebContents ${wc.id}:`, error);
        }
      }
    }, checkInterval);
  }

  /**
   * Run optimization script
   */
  private async runOptimizationScript(
    wc: WebContents,
    scriptName: string
  ): Promise<any> {
    const script = this.optimizationScripts.get(scriptName);
    if (!script) {
      throw new Error(`Unknown optimization script: ${scriptName}`);
    }

    try {
      return await wc.executeJavaScript(script);
    } catch (error) {
      log.debug(`Failed to run ${scriptName} on WebContents ${wc.id}:`, error);
    }
  }

  /**
   * Set memory limit for WebContents
   */
  async setMemoryLimit(wc: WebContents, limitMB: number): Promise<void> {
    // Inject memory monitoring script
    await wc.executeJavaScript(`
      (() => {
        const limit = ${limitMB} * 1024 * 1024;
        let checkInterval;
        
        const checkMemory = () => {
          if (performance.memory && performance.memory.usedJSHeapSize > limit) {
            console.warn('Memory limit exceeded, triggering cleanup');
            
            // Clear caches
            if (window.caches) {
              caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
              });
            }
            
            // Trigger GC if available
            if (window.gc) window.gc();
            
            // Notify main process
            window.postMessage({ type: 'memory-limit-exceeded' }, '*');
          }
        };
        
        // Check every 10 seconds
        checkInterval = setInterval(checkMemory, 10000);
        
        // Store cleanup function
        window.__cleanupMemoryMonitor = () => {
          if (checkInterval) clearInterval(checkInterval);
        };
      })();
    `);
  }

  /**
   * Get memory usage for all WebContents
   */
  async getAllMemoryUsage(): Promise<Array<{
    id: number;
    url: string;
    memoryMB: number;
    title: string;
  }>> {
    const allWebContents = webContents.getAllWebContents();
    const usage = [];
    const metrics = await app.getAppMetrics();

    for (const wc of allWebContents) {
      try {
        const pid = wc.getOSProcessId();
        const processMetric = metrics.find(m => m.pid === pid);
        
        if (processMetric) {
          usage.push({
            id: wc.id,
            url: wc.getURL(),
            memoryMB: processMetric.memory.workingSetSize / 1024,
            title: wc.getTitle()
          });
        }
      } catch (error) {
        log.debug(`Failed to get memory for WebContents ${wc.id}:`, error);
      }
    }

    return usage.sort((a, b) => b.memoryMB - a.memoryMB);
  }
}

// Export singleton instance
export const webContentsOptimizer = WebContentsOptimizer.getInstance();

// Import app after class definition to avoid circular dependency
import { app } from 'electron';