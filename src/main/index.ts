import { app, BrowserWindow, shell, ipcMain, protocol, session, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import log from 'electron-log';

// Core modules
import { createWindow } from './window';
import { setupTray } from './tray';
import { setupGlobalShortcuts } from './shortcuts';
import { SecurityManager } from './security/SecurityManager';
import { ConfigStore } from './config/ConfigStore';
import { UnifiedConfigManager } from './config/UnifiedConfigManager';
import { setupIPC } from './ipc';
import { cleanupIPC } from './ipc/cleanup';
import { resourceManager } from './utils/ResourceManager';
import { errorManager } from './errors/ErrorManager';
import { startupPerformance } from './utils/StartupPerformance';
import { memoryManager } from './utils/MemoryManager';

// Lazy loading system
import { lazyLoader } from './utils/LazyLoader';
import { registerLazyModules, preloadCriticalModules } from './modules/LazyModules';
import { registerWindowModules } from './windows/LazyWindows';

// Types for lazy loaded modules
import type { PluginManager } from './plugins/PluginManager';
import type { ServerManager } from './server/ServerManager';
import type { DatabaseManager } from './database/DatabaseManager';
import type { CacheManager } from './cache/CacheManager';
import type { HardwareManager } from './hardware/HardwareManager';
import type { Analytics } from './analytics/Analytics';
import type { UpdateManager } from './updates/UpdateManager';
import type { SearchOptimizer } from './search/SearchOptimizer';

// Types
import { UserPreferences } from '../shared/types';

// Initialize logging
log.transports.file.level = 'info';
log.transports.console.level = is.dev ? 'debug' : 'info';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// NOTE: Error handlers are now managed by ErrorManager
// The ErrorManager will be initialized after app.whenReady()

// Global references
let mainWindow: BrowserWindow | null = null;
let pluginManager: PluginManager;
let serverManager: ServerManager;
let databaseManager: DatabaseManager;
let cacheManager: CacheManager;
let hardwareManager: HardwareManager;
let securityManager: SecurityManager;
let configStore: ConfigStore;
let unifiedConfigManager: UnifiedConfigManager;

// Handle protocol for deep linking
app.setAsDefaultProtocolClient('2searx2cool');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Security: Set up Content Security Policy
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Only allow navigation to SearXNG instance and local files
    if (parsedUrl.origin !== 'file://' && 
        !parsedUrl.origin.includes('localhost') &&
        !parsedUrl.origin.includes('127.0.0.1')) {
      log.warn(`Blocked navigation to: ${navigationUrl}`);
      event.preventDefault();
    }
  });

  // Disable opening new windows
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

// Initialize core systems
async function initializeSystems() {
  try {
    startupPerformance.markStart('initializeSystems');
    
    // Initialize error manager first
    startupPerformance.markStart('errorManager');
    await errorManager.initialize();
    resourceManager.register('errorManager', () => errorManager.cleanup(), 5);
    startupPerformance.markEnd('errorManager');
    
    // Register all lazy modules
    startupPerformance.markStart('registerModules');
    registerLazyModules();
    registerWindowModules();
    startupPerformance.markEnd('registerModules');
    
    // Initialize configuration
    startupPerformance.markStart('configStore');
    configStore = new ConfigStore();
    unifiedConfigManager = new UnifiedConfigManager();
    
    // Wait for unified config to initialize
    await new Promise(resolve => {
      unifiedConfigManager.once('config:loaded', resolve);
      setTimeout(resolve, 5000); // Timeout after 5 seconds
    });
    
    const config = await configStore.get<UserPreferences>('preferences');
    startupPerformance.markEnd('configStore');
    
    // Initialize security manager
    startupPerformance.markStart('securityManager');
    securityManager = new SecurityManager();
    await securityManager.initialize();
    startupPerformance.markEnd('securityManager');
    
    // Preload critical modules (database, cache, server)
    startupPerformance.markStart('preloadCriticalModules');
    log.info('Starting critical module preloading...');
    await preloadCriticalModules();
    startupPerformance.markEnd('preloadCriticalModules');
    
    // Get preloaded modules
    startupPerformance.markStart('getPreloadedModules');
    databaseManager = await lazyLoader.get<DatabaseManager>('database');
    cacheManager = await lazyLoader.get<CacheManager>('cache');
    serverManager = await lazyLoader.get<ServerManager>('server');
    startupPerformance.markEnd('getPreloadedModules');
    
    // Initialize hardware manager if needed
    if (config?.audio?.midiEnabled) {
      hardwareManager = await lazyLoader.get<HardwareManager>('hardwareManager');
    }
    
    // Plugin manager will be loaded on demand when needed
    
    // Set up IPC handlers with lazy loading support
    setupIPC({
      pluginManager: null, // Will be loaded on demand
      serverManager,
      databaseManager,
      cacheManager,
      hardwareManager: hardwareManager || null,
      configStore,
      unifiedConfigManager,
      lazyLoader // Pass lazy loader for on-demand loading
    });
    
    // Set up error IPC handlers
    setupErrorIPC();
    
    // Register IPC cleanup
    resourceManager.register('ipc', cleanupIPC, 60);
    
    // Start analytics in background (non-blocking)
    lazyLoader.get<Analytics>('analytics').then(analytics => {
      log.info('Analytics loaded in background');
    }).catch(error => {
      log.warn('Failed to load analytics:', error);
    });
    
    // Start memory monitoring
    startupPerformance.markStart('memoryManager');
    memoryManager.startMonitoring(30000); // Check every 30 seconds
    
    // Set memory thresholds based on system
    const totalMemory = process.getSystemMemoryInfo().total / 1024; // MB
    memoryManager.setThresholds({
      warning: Math.min(300, totalMemory * 0.1), // 10% of system or 300MB
      critical: Math.min(500, totalMemory * 0.15), // 15% of system or 500MB
      rendererWarning: Math.min(150, totalMemory * 0.05) // 5% of system or 150MB
    });
    
    // Listen for memory warnings
    memoryManager.on('memory:warning', (usage) => {
      log.warn('Memory warning triggered, optimizing...');
      memoryManager.optimizeMemory().catch(e => log.error('Memory optimization failed:', e));
    });
    
    memoryManager.on('memory:critical', (usage) => {
      log.error('Critical memory usage detected!');
      // Could show user notification here
    });
    
    resourceManager.register('memoryManager', () => memoryManager.cleanup(), 5);
    startupPerformance.markEnd('memoryManager');
    
    startupPerformance.markEnd('initializeSystems');
    log.info('Core systems initialized successfully');
  } catch (error) {
    log.error('Failed to initialize systems:', error);
    await errorManager.handleError({
      error: error instanceof Error ? error : new Error(String(error)),
      severity: 'critical',
      source: 'main',
      handled: false,
      context: { phase: 'initialization' }
    });
    throw error;
  }
}

// Set up error-related IPC handlers
function setupErrorIPC() {
  ipcMain.handle('error:report', async (event, errorInfo) => {
    await errorManager.handleError({
      error: new Error(errorInfo.message),
      severity: 'medium',
      source: 'renderer',
      handled: errorInfo.handled,
      context: errorInfo
    });
  });

  ipcMain.on('error:report-sync', (event, errors) => {
    // Handle sync error reporting (used before page unload)
    for (const errorInfo of errors) {
      errorManager.handleError({
        error: new Error(errorInfo.message),
        severity: 'medium',
        source: 'renderer',
        handled: errorInfo.handled,
        context: errorInfo
      }).catch(e => log.error('Failed to report sync error:', e));
    }
    event.returnValue = true;
  });

  ipcMain.handle('error:get-recent', async (event, limit) => {
    return errorManager.getErrors({ limit: limit || 50 });
  });

  ipcMain.handle('error:clear', async () => {
    await errorManager.clearErrors();
  });

  // Error reporting configuration
  ipcMain.handle('error:get-report-config', async () => {
    const { errorReporter } = await import('./errors/ErrorReporter');
    return errorReporter.config;
  });

  ipcMain.handle('error:set-report-config', async (event, config) => {
    const { errorReporter } = await import('./errors/ErrorReporter');
    await errorReporter.updateConfig(config);
  });

  ipcMain.handle('error:export-reports', async (event, outputPath) => {
    const { errorReporter } = await import('./errors/ErrorReporter');
    await errorReporter.exportReports(outputPath);
  });

  ipcMain.handle('error:get-pending-reports', async () => {
    const { errorReporter } = await import('./errors/ErrorReporter');
    return errorReporter.getPendingReports();
  });

  // App control IPC handlers
  ipcMain.on('app:restart', () => {
    app.relaunch();
    app.quit();
  });

  ipcMain.handle('app:get-version', () => app.getVersion());
  
  ipcMain.handle('app:get-path', (event, name) => app.getPath(name as any));
  
  ipcMain.on('app:show-item-in-folder', (event, path) => {
    shell.showItemInFolder(path);
  });
  
  ipcMain.on('app:open-external', (event, url) => {
    shell.openExternal(url);
  });
  
  // Memory management IPC handlers
  ipcMain.handle('memory:get-stats', () => {
    return memoryManager.getStatistics();
  });
  
  ipcMain.handle('memory:get-usage', async () => {
    return memoryManager.getCurrentUsage();
  });
  
  ipcMain.handle('memory:optimize', async () => {
    return memoryManager.optimizeMemory();
  });
  
  ipcMain.handle('memory:get-report', () => {
    return memoryManager.getReport();
  });
  
  ipcMain.handle('memory:force-gc', () => {
    return memoryManager.forceGarbageCollection();
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  startupPerformance.markStart('appReady');
  
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.camier.2searx2cool');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Security: Disable remote module
  require('@electron/remote/main').initialize();
  
  // Protocol handling for custom protocols
  protocol.registerFileProtocol('2searx2cool', (request, callback) => {
    const url = request.url.substr(13);
    callback({ path: join(__dirname, url) });
  });

  // Security: Set permissions
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['notifications', 'media', 'clipboard-read'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Initialize all systems
  startupPerformance.markStart('systemsInit');
  await initializeSystems();
  startupPerformance.markEnd('systemsInit');

  // Load saved preferences
  const preferences = await configStore.get<UserPreferences>('preferences');

  // Setup system tray with server manager reference
  startupPerformance.markStart('traySetup');
  setupTray(serverManager);
  startupPerformance.markEnd('traySetup');

  // Setup global shortcuts if enabled
  if (preferences?.globalShortcuts) {
    startupPerformance.markStart('shortcutsSetup');
    setupGlobalShortcuts();
    startupPerformance.markEnd('shortcutsSetup');
  }

  // Start the SearXNG server based on unified configuration mode
  const appMode = unifiedConfigManager.getMode();
  if (appMode === 'hybrid' || appMode === 'desktop') {
    startupPerformance.markStart('serverStart');
    // Get server configuration from unified config
    const serverConfig = unifiedConfigManager.get('service.searxng');
    const orchestratorConfig = unifiedConfigManager.get('service.orchestrator');
    
    log.info(`Starting services - SearXNG: ${serverConfig.port}, Orchestrator: ${orchestratorConfig.port}`);
    
    await serverManager.start();
    startupPerformance.markEnd('serverStart');
  }

  // Create the main window
  startupPerformance.markStart('createWindow');
  mainWindow = createWindow();
  startupPerformance.markEnd('createWindow');

  // Load plugins after window is created (lazy load plugin manager)
  try {
    startupPerformance.markStart('pluginsLoad');
    pluginManager = await lazyLoader.get<PluginManager>('pluginManager');
    await pluginManager.loadAllPlugins();
    startupPerformance.markEnd('pluginsLoad');
  } catch (error) {
    log.error('Failed to load plugin manager:', error);
    // Continue without plugins
  }

  // Auto-updater
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify();
    
    autoUpdater.on('update-available', () => {
      log.info('Update available');
    });
    
    autoUpdater.on('update-downloaded', () => {
      log.info('Update downloaded');
    });
  }

  app.on('activate', function () {
    // On macOS, re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
  
  // Mark app ready and log performance report
  startupPerformance.markEnd('appReady');
  
  // Log startup performance report
  if (is.dev || process.env.LOG_STARTUP_PERFORMANCE) {
    startupPerformance.logReport();
  }
  
  // Save performance report
  startupPerformance.saveReport().catch(error => {
    log.error('Failed to save startup performance report:', error);
  });
  
  // Compare with previous startup
  startupPerformance.compareWithPrevious().then(comparison => {
    if (comparison) {
      const improvementPercent = (comparison.improvement / comparison.previousTime) * 100;
      log.info(`Startup performance: ${comparison.currentTime}ms (${improvementPercent > 0 ? '+' : ''}${improvementPercent.toFixed(1)}% from last run)`);
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on exit
app.on('before-quit', async (event) => {
  event.preventDefault(); // Prevent immediate quit
  
  try {
    log.info('Starting application cleanup...');
    
    // Save window state
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      await configStore.set('windowState', {
        ...bounds,
        isMaximized: mainWindow.isMaximized(),
        isFullScreen: mainWindow.isFullScreen()
      });
      log.debug('Window state saved');
    }
    
    // Stop the server if running
    if (serverManager) {
      try {
        await serverManager.stop();
        log.debug('Server stopped');
      } catch (error) {
        log.error('Failed to stop server:', error);
      }
    }
    
    // Use ResourceManager for cleanup
    try {
      await resourceManager.cleanupAll(15000); // 15 second timeout
      log.info('All resources cleaned up successfully');
    } catch (error) {
      log.error('Some resources failed to cleanup:', error);
    }
    
    log.info('Application cleanup completed');
  } catch (error) {
    log.error('Critical error during cleanup:', error);
  } finally {
    app.exit(0); // Force exit after cleanup
  }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (is.dev) {
    // Ignore certificate errors in development
    event.preventDefault();
    callback(true);
  } else {
    // Use default behavior in production
    callback(false);
  }
});

// IPC handlers for legacy compatibility
ipcMain.handle('get-server-status', () => serverManager.getStatus());
ipcMain.handle('start-server', () => serverManager.start());
ipcMain.handle('stop-server', () => serverManager.stop());

// Export for plugin access
export {
  pluginManager,
  serverManager,
  databaseManager,
  cacheManager,
  hardwareManager,
  configStore
};