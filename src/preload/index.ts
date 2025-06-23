import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { IPC_CHANNELS } from '../shared/types';

// Whitelist of allowed channels for security
const ALLOWED_CHANNELS = Object.values(IPC_CHANNELS);

// Validate channel is allowed
function isAllowedChannel(channel: string): boolean {
  return ALLOWED_CHANNELS.includes(channel);
}

// Enhanced API with all features
const api = {
  // Server control
  server: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SERVER_STATUS),
    start: () => ipcRenderer.invoke(IPC_CHANNELS.SERVER_START),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.SERVER_STOP),
    onStatusChange: (callback: (status: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SERVER_STATUS, (_, status) => callback(status));
    }
  },
  
  // Search functionality
  search: {
    query: (query: string, options?: any) => 
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH, query, options),
    onResults: (callback: (results: any[]) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SEARCH_RESULTS, (_, results) => callback(results));
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.SEARCH_ERROR, (_, error) => callback(error));
    }
  },
  
  // Plugin system
  plugins: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_LIST),
    enable: (pluginId: string) => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_ENABLE, pluginId),
    disable: (pluginId: string) => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_DISABLE, pluginId),
    install: (pluginPath: string) => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_INSTALL, pluginPath),
    uninstall: (pluginId: string) => ipcRenderer.invoke(IPC_CHANNELS.PLUGIN_UNINSTALL, pluginId),
    getSettings: (pluginId: string) => ipcRenderer.invoke('get-plugin-settings', pluginId),
    setSettings: (pluginId: string, settings: any) => ipcRenderer.invoke('set-plugin-settings', pluginId, settings)
  },
  
  // Window control
  window: {
    minimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
    fullscreen: (enable: boolean) => ipcRenderer.send(IPC_CHANNELS.WINDOW_FULLSCREEN, enable),
    newWindow: (url?: string) => ipcRenderer.send('new-window', url)
  },
  
  // Media controls
  media: {
    play: () => ipcRenderer.send('media-play'),
    pause: () => ipcRenderer.send('media-pause'),
    next: () => ipcRenderer.send('media-next'),
    previous: () => ipcRenderer.send('media-previous')
  },
  
  // Hardware integration
  hardware: {
    midi: {
      getDevices: () => ipcRenderer.invoke(IPC_CHANNELS.MIDI_DEVICES),
      connect: (deviceId: string) => ipcRenderer.invoke(IPC_CHANNELS.MIDI_CONNECT, deviceId),
      onMessage: (callback: (message: any) => void) => {
        ipcRenderer.on(IPC_CHANNELS.MIDI_MESSAGE, (_, message) => callback(message));
      }
    },
    audio: {
      getDevices: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_DEVICES),
      analyze: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIO_ANALYZE)
    }
  },
  
  // Preferences
  preferences: {
    get: (key?: string) => ipcRenderer.invoke(IPC_CHANNELS.PREF_GET, key),
    set: (key: string, value: any) => ipcRenderer.invoke(IPC_CHANNELS.PREF_SET, key, value),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.PREF_RESET)
  },
  
  // Cache management
  cache: {
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.CACHE_CLEAR),
    getStats: () => ipcRenderer.invoke(IPC_CHANNELS.CACHE_STATS)
  },
  
  // Updates
  updates: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL)
  },
  
  // General IPC for plugins (with security)
  ipc: {
    send: (channel: string, ...args: any[]) => {
      if (isAllowedChannel(channel)) {
        ipcRenderer.send(channel, ...args);
      } else {
        console.warn(`Blocked unauthorized IPC send to channel: ${channel}`);
      }
    },
    
    on: (channel: string, callback: (...args: any[]) => void) => {
      if (isAllowedChannel(channel)) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      } else {
        console.warn(`Blocked unauthorized IPC listener on channel: ${channel}`);
      }
    },
    
    once: (channel: string, callback: (...args: any[]) => void) => {
      if (isAllowedChannel(channel)) {
        ipcRenderer.once(channel, (event, ...args) => callback(...args));
      } else {
        console.warn(`Blocked unauthorized IPC listener on channel: ${channel}`);
      }
    },
    
    removeAllListeners: (channel: string) => {
      if (isAllowedChannel(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
    
    invoke: async (channel: string, ...args: any[]) => {
      if (isAllowedChannel(channel)) {
        return await ipcRenderer.invoke(channel, ...args);
      } else {
        console.warn(`Blocked unauthorized IPC invoke on channel: ${channel}`);
        throw new Error(`Unauthorized channel: ${channel}`);
      }
    }
  },
  
  // Platform info
  platform: {
    name: process.platform,
    arch: process.arch,
    version: process.getSystemVersion()
  },
  
  // Utility functions
  utils: {
    openExternal: (url: string) => {
      // Validate URL before opening
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
          ipcRenderer.send('open-external', url);
        }
      } catch (error) {
        console.error('Invalid URL:', url);
      }
    },
    
    getPath: (name: string) => ipcRenderer.invoke('get-path', name),
    
    showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
    
    showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options)
  },

  // Error reporting
  errors: {
    report: (errorInfo: any) => ipcRenderer.invoke('error:report', errorInfo),
    reportSync: (errors: any[]) => ipcRenderer.sendSync('error:report-sync', errors),
    getRecent: (limit?: number) => ipcRenderer.invoke('error:get-recent', limit),
    clear: () => ipcRenderer.invoke('error:clear'),
    getReportConfig: () => ipcRenderer.invoke('error:get-report-config'),
    setReportConfig: (config: any) => ipcRenderer.invoke('error:set-report-config', config),
    exportReports: (outputPath: string) => ipcRenderer.invoke('error:export-reports', outputPath),
    getPendingReports: () => ipcRenderer.invoke('error:get-pending-reports')
  },

  // App control
  app: {
    restart: () => ipcRenderer.send('app:restart'),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
    showItemInFolder: (path: string) => ipcRenderer.send('app:show-item-in-folder', path),
    openExternal: (url: string) => ipcRenderer.send('app:open-external', url)
  }
};

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    
    // Expose version info
    contextBridge.exposeInMainWorld('versions', {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      app: '0.2.0'
    });
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
  // @ts-ignore (define in dts)
  window.versions = {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    app: '0.2.0'
  };
}

// Type definitions for TypeScript
declare global {
  interface Window {
    electron: typeof electronAPI;
    api: typeof api;
    versions: {
      node: string;
      chrome: string;
      electron: string;
      app: string;
    };
  }
}

// Log successful preload
console.log('Preload script loaded successfully');