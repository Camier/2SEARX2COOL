import log from 'electron-log';
import { asyncExecute } from './AsyncErrorHandler';

export interface LazyModule<T = any> {
  name: string;
  load: () => Promise<T>;
  instance?: T;
  loading?: Promise<T>;
  preload?: boolean;
  priority?: number;
}

export class LazyLoader {
  private modules: Map<string, LazyModule> = new Map();
  private loadedModules: Map<string, any> = new Map();
  private metrics: Map<string, { loadTime: number; size?: number }> = new Map();

  /**
   * Register a module for lazy loading
   */
  register<T>(module: LazyModule<T>): void {
    this.modules.set(module.name, module);
    
    if (module.preload) {
      // Preload high-priority modules in background
      this.preloadModule(module.name);
    }
  }

  /**
   * Register multiple modules
   */
  registerMany(modules: LazyModule[]): void {
    modules.forEach(module => this.register(module));
  }

  /**
   * Get a lazily loaded module
   */
  async get<T>(name: string): Promise<T> {
    // Check if already loaded
    if (this.loadedModules.has(name)) {
      return this.loadedModules.get(name);
    }

    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module ${name} not registered`);
    }

    // Check if currently loading
    if (module.loading) {
      return module.loading;
    }

    // Load the module
    const startTime = Date.now();
    
    module.loading = asyncExecute({
      name: `LazyLoader.load.${name}`,
      operation: async () => {
        const instance = await module.load();
        
        // Store metrics
        const loadTime = Date.now() - startTime;
        this.metrics.set(name, { loadTime });
        
        log.debug(`Lazy loaded module ${name} in ${loadTime}ms`);
        
        return instance;
      },
      timeout: 30000,
      retries: 2,
      severity: 'medium'
    }).then(result => {
      if (result.success) {
        this.loadedModules.set(name, result.data);
        module.instance = result.data;
        module.loading = undefined;
        return result.data;
      } else {
        module.loading = undefined;
        throw result.error;
      }
    });

    return module.loading;
  }

  /**
   * Preload a module in the background
   */
  private async preloadModule(name: string): Promise<void> {
    try {
      await this.get(name);
      log.debug(`Preloaded module: ${name}`);
    } catch (error) {
      log.warn(`Failed to preload module ${name}:`, error);
    }
  }

  /**
   * Preload multiple modules by priority
   */
  async preloadByPriority(): Promise<void> {
    const modulesToPreload = Array.from(this.modules.values())
      .filter(m => m.preload)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const module of modulesToPreload) {
      await this.preloadModule(module.name);
    }
  }

  /**
   * Check if a module is loaded
   */
  isLoaded(name: string): boolean {
    return this.loadedModules.has(name);
  }

  /**
   * Get loading metrics
   */
  getMetrics(): Map<string, { loadTime: number; size?: number }> {
    return new Map(this.metrics);
  }

  /**
   * Clear a loaded module (for memory management)
   */
  async unload(name: string): Promise<void> {
    const module = this.modules.get(name);
    if (!module) return;

    // If module has cleanup method, call it
    const instance = this.loadedModules.get(name);
    if (instance && typeof instance.cleanup === 'function') {
      await instance.cleanup();
    }

    this.loadedModules.delete(name);
    module.instance = undefined;
    module.loading = undefined;
    
    log.debug(`Unloaded module: ${name}`);
  }

  /**
   * Clear all loaded modules
   */
  async clear(): Promise<void> {
    for (const name of this.loadedModules.keys()) {
      await this.unload(name);
    }
  }
}

// Singleton instance
export const lazyLoader = new LazyLoader();

// Helper function to create lazy modules
export function createLazyModule<T>(
  name: string,
  loader: () => Promise<T>,
  options?: {
    preload?: boolean;
    priority?: number;
  }
): LazyModule<T> {
  return {
    name,
    load: loader,
    preload: options?.preload,
    priority: options?.priority
  };
}