import { app, BrowserWindow, shell, ipcMain, protocol, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import log from 'electron-log';

// Core modules
import { createWindow } from './window';
import { setupTray } from './tray';
import { setupGlobalShortcuts } from './shortcuts';
import { PluginManager } from './plugins/PluginManager';
import { ServerManager } from './server/ServerManager';
import { DatabaseManager } from './database/DatabaseManager';
import { CacheManager } from './cache/CacheManager';
import { HardwareManager } from './hardware/HardwareManager';
import { SecurityManager } from './security/SecurityManager';
import { ConfigStore } from './config/ConfigStore';
import { setupIPC } from './ipc';

// Types
import { UserPreferences } from '../shared/types';

// Initialize logging
log.transports.file.level = 'info';
log.transports.console.level = is.dev ? 'debug' : 'info';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Global references
let mainWindow: BrowserWindow | null = null;
let pluginManager: PluginManager;
let serverManager: ServerManager;
let databaseManager: DatabaseManager;
let cacheManager: CacheManager;
let hardwareManager: HardwareManager;
let securityManager: SecurityManager;
let configStore: ConfigStore;

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
    // Initialize configuration
    configStore = new ConfigStore();
    const config = await configStore.get<UserPreferences>('preferences');
    
    // Initialize security manager first
    securityManager = new SecurityManager();
    await securityManager.initialize();
    
    // Initialize database
    databaseManager = new DatabaseManager();
    await databaseManager.initialize();
    
    // Initialize cache with database
    cacheManager = new CacheManager(databaseManager);
    await cacheManager.initialize(config?.cache);
    
    // Initialize server manager
    serverManager = new ServerManager(configStore);
    await serverManager.initialize();
    
    // Initialize hardware manager
    hardwareManager = new HardwareManager();
    if (config?.audio?.midiEnabled) {
      await hardwareManager.initialize();
    }
    
    // Initialize plugin manager
    pluginManager = new PluginManager({
      configStore,
      cacheManager,
      hardwareManager,
      databaseManager,
      serverManager
    });
    await pluginManager.initialize();
    
    // Set up IPC handlers
    setupIPC({
      pluginManager,
      serverManager,
      databaseManager,
      cacheManager,
      hardwareManager,
      configStore
    });
    
    log.info('All systems initialized successfully');
  } catch (error) {
    log.error('Failed to initialize systems:', error);
    throw error;
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
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
  await initializeSystems();

  // Load saved preferences
  const preferences = await configStore.get<UserPreferences>('preferences');

  // Setup system tray
  setupTray();

  // Setup global shortcuts if enabled
  if (preferences?.globalShortcuts) {
    setupGlobalShortcuts();
  }

  // Start the SearXNG server based on deployment mode
  const deploymentMode = process.env.DEPLOYMENT_MODE || preferences?.serverUrl ? 'external' : 'bundled';
  if (deploymentMode === 'bundled' || deploymentMode === 'hybrid') {
    await serverManager.start();
  }

  // Create the main window
  mainWindow = createWindow();

  // Load plugins after window is created
  await pluginManager.loadAllPlugins();

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
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on exit
app.on('before-quit', async () => {
  try {
    // Save window state
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      await configStore.set('windowState', {
        ...bounds,
        isMaximized: mainWindow.isMaximized(),
        isFullScreen: mainWindow.isFullScreen()
      });
    }
    
    // Stop the server if running
    await serverManager?.stop();
    
    // Cleanup managers
    await pluginManager?.cleanup();
    await hardwareManager?.cleanup();
    await cacheManager?.cleanup();
    await databaseManager?.close();
    
    log.info('Application cleanup completed');
  } catch (error) {
    log.error('Error during cleanup:', error);
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