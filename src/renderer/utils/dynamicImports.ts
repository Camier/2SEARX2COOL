import { lazy, LazyExoticComponent, ComponentType } from 'react';
import log from 'electron-log';

interface ImportStatus {
  component: string;
  status: 'loading' | 'loaded' | 'error';
  loadTime?: number;
  error?: Error;
}

class DynamicImportManager {
  private static instance: DynamicImportManager;
  private importStatus: Map<string, ImportStatus> = new Map();
  private preloadQueue: Set<string> = new Set();

  private constructor() {}

  static getInstance(): DynamicImportManager {
    if (!DynamicImportManager.instance) {
      DynamicImportManager.instance = new DynamicImportManager();
    }
    return DynamicImportManager.instance;
  }

  /**
   * Create a lazy loaded component with error handling
   */
  createLazyComponent<T extends ComponentType<any>>(
    componentName: string,
    importFn: () => Promise<{ default: T }>
  ): LazyExoticComponent<T> {
    return lazy(async () => {
      const startTime = Date.now();
      this.updateStatus(componentName, 'loading');

      try {
        const module = await importFn();
        const loadTime = Date.now() - startTime;
        
        this.updateStatus(componentName, 'loaded', loadTime);
        log.debug(`Lazy loaded ${componentName} in ${loadTime}ms`);
        
        return module;
      } catch (error) {
        this.updateStatus(componentName, 'error', undefined, error as Error);
        log.error(`Failed to lazy load ${componentName}:`, error);
        
        // Return error component
        return {
          default: (() => {
            const errorMessage = `Failed to load component: ${componentName}`;
            console.error(errorMessage);
            throw new Error(errorMessage);
          }) as T
        };
      }
    });
  }

  /**
   * Preload components in the background
   */
  async preloadComponent(
    componentName: string,
    importFn: () => Promise<any>
  ): Promise<void> {
    if (this.preloadQueue.has(componentName)) {
      return; // Already queued
    }

    this.preloadQueue.add(componentName);

    // Delay to avoid blocking main thread
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const startTime = Date.now();
      await importFn();
      const loadTime = Date.now() - startTime;
      
      this.updateStatus(componentName, 'loaded', loadTime);
      log.debug(`Preloaded ${componentName} in ${loadTime}ms`);
    } catch (error) {
      this.updateStatus(componentName, 'error', undefined, error as Error);
      log.error(`Failed to preload ${componentName}:`, error);
    } finally {
      this.preloadQueue.delete(componentName);
    }
  }

  /**
   * Get import statistics
   */
  getStatistics(): {
    total: number;
    loaded: number;
    loading: number;
    errors: number;
    avgLoadTime: number;
  } {
    const stats = {
      total: this.importStatus.size,
      loaded: 0,
      loading: 0,
      errors: 0,
      totalLoadTime: 0,
      count: 0
    };

    for (const status of this.importStatus.values()) {
      switch (status.status) {
        case 'loaded':
          stats.loaded++;
          if (status.loadTime) {
            stats.totalLoadTime += status.loadTime;
            stats.count++;
          }
          break;
        case 'loading':
          stats.loading++;
          break;
        case 'error':
          stats.errors++;
          break;
      }
    }

    return {
      total: stats.total,
      loaded: stats.loaded,
      loading: stats.loading,
      errors: stats.errors,
      avgLoadTime: stats.count > 0 ? stats.totalLoadTime / stats.count : 0
    };
  }

  private updateStatus(
    component: string,
    status: 'loading' | 'loaded' | 'error',
    loadTime?: number,
    error?: Error
  ): void {
    this.importStatus.set(component, {
      component,
      status,
      loadTime,
      error
    });
  }
}

export const importManager = DynamicImportManager.getInstance();

// Route-based code splitting
export const routes = {
  // Main routes
  Home: importManager.createLazyComponent(
    'Home',
    () => import(/* webpackChunkName: "home" */ '../pages/Home')
  ),
  
  Search: importManager.createLazyComponent(
    'Search',
    () => import(/* webpackChunkName: "search" */ '../pages/Search')
  ),
  
  Settings: importManager.createLazyComponent(
    'Settings',
    () => import(/* webpackChunkName: "settings" */ '../pages/Settings')
  ),
  
  Plugins: importManager.createLazyComponent(
    'Plugins',
    () => import(/* webpackChunkName: "plugins" */ '../pages/Plugins')
  ),
  
  About: importManager.createLazyComponent(
    'About',
    () => import(/* webpackChunkName: "about" */ '../pages/About')
  ),
};

// Heavy component code splitting
export const components = {
  // Charts and visualizations
  ChartComponent: importManager.createLazyComponent(
    'ChartComponent',
    () => import(/* webpackChunkName: "charts" */ '../components/Charts')
  ),
  
  // Rich text editor
  RichTextEditor: importManager.createLazyComponent(
    'RichTextEditor',
    () => import(/* webpackChunkName: "editor" */ '../components/RichTextEditor')
  ),
  
  // Media player
  MediaPlayer: importManager.createLazyComponent(
    'MediaPlayer',
    () => import(/* webpackChunkName: "media" */ '../components/MediaPlayer')
  ),
  
  // Code editor
  CodeEditor: importManager.createLazyComponent(
    'CodeEditor',
    () => import(/* webpackChunkName: "code-editor" */ '../components/CodeEditor')
  ),
};

// Utility for conditional imports
export async function conditionalImport<T>(
  condition: boolean,
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  if (condition) {
    try {
      return await importFn();
    } catch (error) {
      log.error('Conditional import failed:', error);
      return fallback;
    }
  }
  return fallback;
}

// Preload critical routes based on user behavior
export function setupRoutePreloading(): void {
  // Preload settings after 5 seconds
  setTimeout(() => {
    importManager.preloadComponent(
      'Settings',
      () => import(/* webpackChunkName: "settings" */ '../pages/Settings')
    );
  }, 5000);

  // Preload based on hover
  const preloadOnHover = (selector: string, componentName: string, importFn: () => Promise<any>) => {
    const element = document.querySelector(selector);
    if (element) {
      element.addEventListener('mouseenter', () => {
        importManager.preloadComponent(componentName, importFn);
      }, { once: true });
    }
  };

  // Setup hover preloading for navigation links
  preloadOnHover('[data-route="plugins"]', 'Plugins', 
    () => import(/* webpackChunkName: "plugins" */ '../pages/Plugins')
  );
  
  preloadOnHover('[data-route="about"]', 'About',
    () => import(/* webpackChunkName: "about" */ '../pages/About')
  );
}

// Resource hints for critical chunks
export function addResourceHints(): void {
  const chunks = [
    'vendor.react.js',
    'search.js',
    'common.js'
  ];

  chunks.forEach(chunk => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `/js/${chunk}`;
    document.head.appendChild(link);
  });
}

// Intersection Observer for lazy loading
export function setupIntersectionObserver(): void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const component = entry.target.getAttribute('data-lazy-component');
        if (component && component in components) {
          // Component will be loaded when needed
          observer.unobserve(entry.target);
        }
      }
    });
  }, {
    rootMargin: '50px'
  });

  // Observe elements with lazy components
  document.querySelectorAll('[data-lazy-component]').forEach(el => {
    observer.observe(el);
  });
}