import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch } from 'chokidar';
import log from 'electron-log';
import { 
  Plugin, 
  PluginContext, 
  PluginAPI,
  PluginPermission,
  SearchOptions,
  SearchResult,
  CacheAPI,
  HardwareAPI,
  UIAPI,
  IPCAPI
} from '../../shared/types';
import { ConfigStore } from '../config/ConfigStore';
import { CacheManager } from '../cache/CacheManager';
import { HardwareManager } from '../hardware/HardwareManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { ServerManager } from '../server/ServerManager';

interface PluginManifest {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  author?: string;
  permissions?: PluginPermission[];
  main?: string;
  renderer?: string;
  preload?: string;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginContexts: Map<string, PluginContext> = new Map();
  private pluginPaths: string[] = [];
  private watcher: any = null;
  private api: PluginAPI;

  constructor(
    private dependencies: {
      configStore: ConfigStore;
      cacheManager: CacheManager;
      hardwareManager: HardwareManager;
      databaseManager: DatabaseManager;
      serverManager: ServerManager;
    }
  ) {
    // Define plugin directories
    this.pluginPaths = [
      path.join(app.getPath('userData'), 'plugins'),
      path.join(process.resourcesPath, 'plugins'),
      path.join(__dirname, '../../plugins')
    ];

    // Initialize plugin API
    this.api = this.createPluginAPI();
  }

  async initialize(): Promise<void> {
    // Ensure plugin directories exist
    for (const pluginPath of this.pluginPaths) {
      try {
        await fs.mkdir(pluginPath, { recursive: true });
      } catch (error) {
        log.warn(`Failed to create plugin directory: ${pluginPath}`, error);
      }
    }

    // Set up hot reload in development
    if (process.env.NODE_ENV === 'development') {
      this.setupHotReload();
    }

    log.info('Plugin manager initialized');
  }

  private createPluginAPI(): PluginAPI {
    return {
      search: async (query: string, options?: SearchOptions): Promise<SearchResult[]> => {
        return this.dependencies.serverManager.search(query, options);
      },
      
      cache: this.createCacheAPI(),
      hardware: this.createHardwareAPI(),
      ui: this.createUIAPI(),
      ipc: this.createIPCAPI()
    };
  }

  private createCacheAPI(): CacheAPI {
    return {
      get: (key: string) => this.dependencies.cacheManager.get(key),
      set: (key: string, value: any, ttl?: number) => 
        this.dependencies.cacheManager.set(key, value, ttl),
      delete: (key: string) => this.dependencies.cacheManager.delete(key),
      clear: () => this.dependencies.cacheManager.clear(),
      getStats: () => this.dependencies.cacheManager.getStats()
    };
  }

  private createHardwareAPI(): HardwareAPI {
    return {
      midi: {
        getDevices: () => this.dependencies.hardwareManager.getMidiDevices(),
        connect: (deviceId: string) => this.dependencies.hardwareManager.connectMidiDevice(deviceId),
        onMessage: (callback) => this.dependencies.hardwareManager.onMidiMessage(callback),
        sendMessage: (deviceId, message) => 
          this.dependencies.hardwareManager.sendMidiMessage(deviceId, message)
      },
      audio: {
        getDevices: () => this.dependencies.hardwareManager.getAudioDevices(),
        getAnalyzer: () => this.dependencies.hardwareManager.getAudioAnalyzer(),
        setInputDevice: (deviceId) => this.dependencies.hardwareManager.setAudioInputDevice(deviceId),
        setOutputDevice: (deviceId) => this.dependencies.hardwareManager.setAudioOutputDevice(deviceId)
      }
    };
  }

  private createUIAPI(): UIAPI {
    return {
      showNotification: (options) => {
        const { Notification } = require('electron');
        new Notification(options).show();
      },
      setTrayTooltip: (tooltip) => {
        // Implemented in tray module
      },
      setBadge: (count) => {
        if (process.platform === 'darwin') {
          app.dock.setBadge(count > 0 ? count.toString() : '');
        }
      },
      setProgressBar: (progress) => {
        // Implemented per window
      },
      flashFrame: (flag) => {
        // Implemented per window
      }
    };
  }

  private createIPCAPI(): IPCAPI {
    const { ipcMain } = require('electron');
    return {
      send: (channel, ...args) => {
        // Send to all windows
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send(channel, ...args);
        });
      },
      on: (channel, listener) => {
        ipcMain.on(channel, listener);
      },
      invoke: (channel, ...args) => {
        return ipcMain.invoke(channel, ...args);
      },
      removeAllListeners: (channel) => {
        ipcMain.removeAllListeners(channel);
      }
    };
  }

  async loadAllPlugins(): Promise<void> {
    const loadedPlugins: string[] = [];

    for (const pluginPath of this.pluginPaths) {
      try {
        const dirs = await fs.readdir(pluginPath);
        
        for (const dir of dirs) {
          const fullPath = path.join(pluginPath, dir);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            try {
              await this.loadPlugin(fullPath);
              loadedPlugins.push(dir);
            } catch (error) {
              log.error(`Failed to load plugin from ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        log.warn(`Failed to read plugin directory ${pluginPath}:`, error);
      }
    }

    log.info(`Loaded ${loadedPlugins.length} plugins:`, loadedPlugins);
  }

  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Read manifest
      const manifestPath = path.join(pluginPath, 'package.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Check if plugin is already loaded
      if (this.plugins.has(manifest.id)) {
        log.warn(`Plugin ${manifest.id} is already loaded`);
        return;
      }

      // Check permissions
      const enabledPlugins = await this.dependencies.configStore.get<Record<string, boolean>>('plugins') || {};
      const isEnabled = enabledPlugins[manifest.id] !== false;

      // Create plugin instance
      const plugin: Plugin = {
        id: manifest.id,
        name: manifest.name,
        displayName: manifest.displayName,
        description: manifest.description,
        version: manifest.version,
        author: manifest.author,
        enabled: isEnabled,
        permissions: manifest.permissions || []
      };

      // Load main process module if specified
      if (manifest.main && isEnabled) {
        const mainPath = path.join(pluginPath, manifest.main);
        try {
          const mainModule = require(mainPath);
          plugin.main = mainModule.default || mainModule;
        } catch (error) {
          log.error(`Failed to load main module for plugin ${manifest.id}:`, error);
        }
      }

      // Store plugin
      this.plugins.set(manifest.id, plugin);

      // Create context
      const context = this.createPluginContext(plugin);
      this.pluginContexts.set(manifest.id, context);

      // Activate plugin if enabled
      if (isEnabled && plugin.main?.activate) {
        await plugin.main.activate(context);
        log.info(`Activated plugin: ${manifest.id}`);
      }
    } catch (error) {
      log.error(`Failed to load plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  private createPluginContext(plugin: Plugin): PluginContext {
    const logger = {
      info: (message: string, ...args: any[]) => 
        log.info(`[${plugin.id}] ${message}`, ...args),
      warn: (message: string, ...args: any[]) => 
        log.warn(`[${plugin.id}] ${message}`, ...args),
      error: (message: string, ...args: any[]) => 
        log.error(`[${plugin.id}] ${message}`, ...args),
      debug: (message: string, ...args: any[]) => 
        log.debug(`[${plugin.id}] ${message}`, ...args)
    };

    return {
      app,
      store: {
        get: (key: string) => 
          this.dependencies.databaseManager.getPluginData(plugin.id, key),
        set: (key: string, value: any) => 
          this.dependencies.databaseManager.setPluginData(plugin.id, key, value)
      },
      api: this.api,
      logger
    };
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.enabled) {
      log.warn(`Plugin ${pluginId} is already enabled`);
      return;
    }

    plugin.enabled = true;

    // Update config
    const enabledPlugins = await this.dependencies.configStore.get<Record<string, boolean>>('plugins') || {};
    enabledPlugins[pluginId] = true;
    await this.dependencies.configStore.set('plugins', enabledPlugins);

    // Activate plugin
    const context = this.pluginContexts.get(pluginId);
    if (context && plugin.main?.activate) {
      await plugin.main.activate(context);
      log.info(`Enabled plugin: ${pluginId}`);
    }
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.enabled) {
      log.warn(`Plugin ${pluginId} is already disabled`);
      return;
    }

    // Deactivate plugin
    if (plugin.main?.deactivate) {
      await plugin.main.deactivate();
    }

    plugin.enabled = false;

    // Update config
    const enabledPlugins = await this.dependencies.configStore.get<Record<string, boolean>>('plugins') || {};
    enabledPlugins[pluginId] = false;
    await this.dependencies.configStore.set('plugins', enabledPlugins);

    log.info(`Disabled plugin: ${pluginId}`);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Disable first
    if (plugin.enabled) {
      await this.disablePlugin(pluginId);
    }

    // Remove from maps
    this.plugins.delete(pluginId);
    this.pluginContexts.delete(pluginId);

    log.info(`Uninstalled plugin: ${pluginId}`);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    return plugin.permissions?.includes(permission) || false;
  }

  private setupHotReload(): void {
    this.watcher = watch(this.pluginPaths, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', async (filePath: string) => {
      log.debug(`Plugin file changed: ${filePath}`);
      
      // Find which plugin this file belongs to
      for (const [pluginId, plugin] of this.plugins) {
        // Reload plugin logic here
        // This is simplified - in production you'd want more sophisticated hot reload
      }
    });
  }

  async cleanup(): Promise<void> {
    // Deactivate all plugins
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.enabled && plugin.main?.deactivate) {
        try {
          await plugin.main.deactivate();
        } catch (error) {
          log.error(`Error deactivating plugin ${pluginId}:`, error);
        }
      }
    }

    // Close watcher
    if (this.watcher) {
      await this.watcher.close();
    }

    // Clear maps
    this.plugins.clear();
    this.pluginContexts.clear();
  }
}