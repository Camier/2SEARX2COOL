import { ipcMain, BrowserWindow, shell, app, dialog } from 'electron';
import log from 'electron-log';
import { IPC_CHANNELS } from '../shared/types';
import type { ServerManager } from './server/ServerManager';
import type { DatabaseManager } from './database/DatabaseManager';
import type { CacheManager } from './cache/CacheManager';
import type { HardwareManager } from './hardware/HardwareManager';
import type { PluginManager } from './plugins/PluginManager';
import type { ConfigStore } from './config/ConfigStore';
import type { LazyLoader } from './utils/LazyLoader';

interface IPCDependencies {
  pluginManager: PluginManager | null;
  serverManager: ServerManager;
  databaseManager: DatabaseManager;
  cacheManager: CacheManager;
  hardwareManager: HardwareManager | null;
  configStore: ConfigStore;
  lazyLoader?: LazyLoader;
}

let deps: IPCDependencies;

export function setupIPC(dependencies: IPCDependencies): void {
  deps = dependencies;

  // Server control
  ipcMain.handle(IPC_CHANNELS.SERVER_STATUS, async () => {
    return deps.serverManager.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_START, async () => {
    return deps.serverManager.start();
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_STOP, async () => {
    return deps.serverManager.stop();
  });

  // Search functionality with optimization
  ipcMain.handle(IPC_CHANNELS.SEARCH, async (event, query: string, options?: any) => {
    try {
      // Get search optimizer if available
      if (deps.lazyLoader) {
        try {
          const searchOptimizer = await deps.lazyLoader.get('searchOptimizer');
          
          // Use optimizer for caching and performance
          const result = await searchOptimizer.optimizeSearch(
            { query, ...options },
            async (searchQuery) => {
              // Perform actual search
              const searchUrl = await deps.serverManager.getSearchUrl(
                searchQuery.query,
                searchQuery
              );
              // In a real implementation, this would fetch and parse results
              return { url: searchUrl, results: [] };
            }
          );
          
          return {
            success: true,
            url: result.results.url,
            fromCache: result.fromCache,
            responseTime: result.responseTime
          };
        } catch (error) {
          log.debug('Search optimizer not available, falling back to direct search');
        }
      }
      
      // Fallback to direct search
      const searchUrl = await deps.serverManager.getSearchUrl(query, options);
      return { success: true, url: searchUrl };
    } catch (error) {
      log.error('Search error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Search suggestions
  ipcMain.handle('search:suggestions', async (event, partial: string) => {
    if (deps.lazyLoader) {
      try {
        const searchOptimizer = await deps.lazyLoader.get('searchOptimizer');
        return searchOptimizer.getSuggestions(partial);
      } catch (error) {
        log.debug('Search optimizer not available for suggestions');
      }
    }
    return [];
  });
  
  // Search statistics
  ipcMain.handle('search:stats', async () => {
    if (deps.lazyLoader) {
      try {
        const searchOptimizer = await deps.lazyLoader.get('searchOptimizer');
        return searchOptimizer.getStatistics();
      } catch (error) {
        log.debug('Search optimizer not available for statistics');
      }
    }
    return null;
  });
  
  // Clear search cache
  ipcMain.handle('search:clear-cache', async (event, query?: string) => {
    if (deps.lazyLoader) {
      try {
        const searchOptimizer = await deps.lazyLoader.get('searchOptimizer');
        await searchOptimizer.clearCache(query);
        return { success: true };
      } catch (error) {
        log.error('Failed to clear search cache:', error);
      }
    }
    return { success: false };
  });

  // Plugin system - Lazy load plugin manager when needed
  ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST, async () => {
    const pluginManager = await getPluginManager();
    return pluginManager.getPlugins();
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_ENABLE, async (event, pluginId: string) => {
    const pluginManager = await getPluginManager();
    await pluginManager.enablePlugin(pluginId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_DISABLE, async (event, pluginId: string) => {
    const pluginManager = await getPluginManager();
    await pluginManager.disablePlugin(pluginId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_INSTALL, async (event, pluginPath: string) => {
    const pluginManager = await getPluginManager();
    const result = await pluginManager.installPlugin(pluginPath);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.PLUGIN_UNINSTALL, async (event, pluginId: string) => {
    const pluginManager = await getPluginManager();
    await pluginManager.uninstallPlugin(pluginId);
    return { success: true };
  });

  ipcMain.handle('get-plugin-settings', async (event, pluginId: string) => {
    const pluginManager = await getPluginManager();
    return pluginManager.getPluginSettings(pluginId);
  });

  ipcMain.handle('set-plugin-settings', async (event, pluginId: string, settings: any) => {
    const pluginManager = await getPluginManager();
    await pluginManager.setPluginSettings(pluginId, settings);
    return { success: true };
  });

  // Window control
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_FULLSCREEN, (event, enable: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.setFullScreen(enable);
  });

  ipcMain.on('new-window', async (event, url?: string) => {
    if (deps.lazyLoader) {
      const { openWindow } = await import('./windows/LazyWindows');
      if (url?.includes('settings')) {
        await openWindow('settings');
      } else if (url?.includes('about')) {
        await openWindow('about');
      } else if (url?.includes('plugins')) {
        await openWindow('pluginManager');
      }
    }
  });

  // Media controls
  ipcMain.on('media-play', () => {
    // Will be handled by plugins
  });

  ipcMain.on('media-pause', () => {
    // Will be handled by plugins
  });

  ipcMain.on('media-next', () => {
    // Will be handled by plugins
  });

  ipcMain.on('media-previous', () => {
    // Will be handled by plugins
  });

  // Hardware integration - Check if hardware manager is available
  if (deps.hardwareManager) {
    ipcMain.handle(IPC_CHANNELS.MIDI_DEVICES, async () => {
      return deps.hardwareManager!.getMidiDevices();
    });

    ipcMain.handle(IPC_CHANNELS.MIDI_CONNECT, async (event, deviceId: string) => {
      await deps.hardwareManager!.connectMidiDevice(deviceId);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.AUDIO_DEVICES, async () => {
      return deps.hardwareManager!.getAudioDevices();
    });

    ipcMain.handle(IPC_CHANNELS.AUDIO_ANALYZE, async () => {
      return deps.hardwareManager!.startAudioAnalysis();
    });
  }

  // Preferences
  ipcMain.handle(IPC_CHANNELS.PREF_GET, async (event, key?: string) => {
    if (key) {
      return deps.configStore.get(key);
    }
    return deps.configStore.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.PREF_SET, async (event, key: string, value: any) => {
    await deps.configStore.set(key, value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PREF_RESET, async () => {
    await deps.configStore.reset();
    return { success: true };
  });

  // Cache management
  ipcMain.handle(IPC_CHANNELS.CACHE_CLEAR, async () => {
    await deps.cacheManager.clear();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CACHE_STATS, async () => {
    return deps.cacheManager.getStatistics();
  });

  // Updates - Lazy load update manager
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    if (deps.lazyLoader) {
      const updateManager = await deps.lazyLoader.get('updateManager');
      return updateManager.checkForUpdates();
    }
    return { available: false };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    if (deps.lazyLoader) {
      const updateManager = await deps.lazyLoader.get('updateManager');
      return updateManager.downloadUpdate();
    }
    return { success: false };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    if (deps.lazyLoader) {
      const updateManager = await deps.lazyLoader.get('updateManager');
      return updateManager.installUpdate();
    }
    return { success: false };
  });

  // Utility handlers
  ipcMain.on('open-external', (event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle('get-path', (event, name: string) => {
    return app.getPath(name as any);
  });

  ipcMain.handle('show-save-dialog', async (event, options: any) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      const result = await dialog.showSaveDialog(window, options);
      return result;
    }
    return { canceled: true };
  });

  ipcMain.handle('show-open-dialog', async (event, options: any) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      const result = await dialog.showOpenDialog(window, options);
      return result;
    }
    return { canceled: true, filePaths: [] };
  });

  log.info('IPC handlers set up successfully');
}

// Helper to lazy load plugin manager
async function getPluginManager(): Promise<PluginManager> {
  if (deps.pluginManager) {
    return deps.pluginManager;
  }

  if (deps.lazyLoader) {
    deps.pluginManager = await deps.lazyLoader.get<PluginManager>('pluginManager');
    return deps.pluginManager;
  }

  throw new Error('Plugin manager not available');
}