import { createLazyModule, lazyLoader } from '../utils/LazyLoader';
import log from 'electron-log';

// Heavy modules that should be lazy loaded

// Hardware Manager - Only load when needed
export const hardwareManagerModule = createLazyModule(
  'hardwareManager',
  async () => {
    log.info('Loading HardwareManager...');
    const { HardwareManager } = await import('../hardware/HardwareManager');
    const manager = new HardwareManager();
    await manager.initialize();
    return manager;
  },
  { preload: false, priority: 30 }
);

// Plugin Manager - Load on demand
export const pluginManagerModule = createLazyModule(
  'pluginManager',
  async () => {
    log.info('Loading PluginManager...');
    const { PluginManager } = await import('../plugins/PluginManager');
    const { ConfigStore } = await import('../config/ConfigStore');
    const { CacheManager } = await import('../cache/CacheManager');
    const { DatabaseManager } = await import('../database/DatabaseManager');
    const { ServerManager } = await import('../server/ServerManager');
    
    // Get dependencies
    const configStore = new ConfigStore();
    const databaseManager = await lazyLoader.get<DatabaseManager>('database');
    const cacheManager = await lazyLoader.get<CacheManager>('cache');
    const serverManager = await lazyLoader.get<ServerManager>('server');
    const hardwareManager = await lazyLoader.get('hardwareManager');

    const manager = new PluginManager({
      configStore,
      cacheManager,
      hardwareManager,
      databaseManager,
      serverManager
    });
    
    await manager.initialize();
    return manager;
  },
  { preload: false, priority: 20 }
);

// Update Manager - Only load when checking for updates
export const updateManagerModule = createLazyModule(
  'updateManager',
  async () => {
    log.info('Loading UpdateManager...');
    const { UpdateManager } = await import('../updates/UpdateManager');
    const { ConfigStore } = await import('../config/ConfigStore');
    
    const configStore = new ConfigStore();
    const manager = new UpdateManager(configStore);
    await manager.initialize();
    return manager;
  },
  { preload: false, priority: 10 }
);

// Analytics - Load after main app is ready
export const analyticsModule = createLazyModule(
  'analytics',
  async () => {
    log.info('Loading Analytics...');
    const { Analytics } = await import('../analytics/Analytics');
    const { DatabaseManager } = await import('../database/DatabaseManager');
    
    const databaseManager = await lazyLoader.get<DatabaseManager>('database');
    const analytics = new Analytics(databaseManager);
    await analytics.initialize();
    return analytics;
  },
  { preload: false, priority: 5 }
);

// Search Optimizer - Load when first search is performed
export const searchOptimizerModule = createLazyModule(
  'searchOptimizer',
  async () => {
    log.info('Loading SearchOptimizer...');
    const { SearchOptimizer } = await import('../search/SearchOptimizer');
    const { CacheManager } = await import('../cache/CacheManager');
    const { DatabaseManager } = await import('../database/DatabaseManager');
    
    const cacheManager = await lazyLoader.get<CacheManager>('cache');
    const databaseManager = await lazyLoader.get<DatabaseManager>('database');
    
    const optimizer = new SearchOptimizer(cacheManager, databaseManager);
    await optimizer.initialize();
    return optimizer;
  },
  { preload: false, priority: 40 }
);

// Core modules that need early loading
export const databaseModule = createLazyModule(
  'database',
  async () => {
    log.info('Loading DatabaseManager...');
    const { DatabaseManager } = await import('../database/DatabaseManager');
    const manager = new DatabaseManager();
    await manager.initialize();
    return manager;
  },
  { preload: true, priority: 100 }
);

export const cacheModule = createLazyModule(
  'cache',
  async () => {
    log.info('Loading CacheManager...');
    const { CacheManager } = await import('../cache/CacheManager');
    const { DatabaseManager } = await import('../database/DatabaseManager');
    
    const databaseManager = await lazyLoader.get<DatabaseManager>('database');
    const manager = new CacheManager(databaseManager);
    const { ConfigStore } = await import('../config/ConfigStore');
    const configStore = new ConfigStore();
    const config = await configStore.get('cache');
    await manager.initialize(config);
    return manager;
  },
  { preload: true, priority: 90 }
);

export const serverModule = createLazyModule(
  'server',
  async () => {
    log.info('Loading ServerManager...');
    const { ServerManager } = await import('../server/ServerManager');
    const { ConfigStore } = await import('../config/ConfigStore');
    
    const configStore = new ConfigStore();
    const manager = new ServerManager(configStore);
    await manager.initialize();
    return manager;
  },
  { preload: true, priority: 80 }
);

// Register all lazy modules
export function registerLazyModules(): void {
  lazyLoader.registerMany([
    databaseModule,
    cacheModule,
    serverModule,
    hardwareManagerModule,
    pluginManagerModule,
    updateManagerModule,
    analyticsModule,
    searchOptimizerModule
  ]);
  
  log.info('Lazy modules registered');
}

// Preload critical modules
export async function preloadCriticalModules(): Promise<void> {
  log.info('Preloading critical modules...');
  await lazyLoader.preloadByPriority();
  log.info('Critical modules preloaded');
}