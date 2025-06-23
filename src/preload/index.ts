import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Server control
  server: {
    getStatus: () => ipcRenderer.invoke('get-server-status'),
    start: () => ipcRenderer.invoke('start-server'),
    stop: () => ipcRenderer.invoke('stop-server')
  },
  
  // Plugin system
  plugins: {
    list: () => ipcRenderer.invoke('list-plugins'),
    enable: (pluginId: string) => ipcRenderer.invoke('enable-plugin', pluginId),
    disable: (pluginId: string) => ipcRenderer.invoke('disable-plugin', pluginId),
    getSettings: (pluginId: string) => ipcRenderer.invoke('get-plugin-settings', pluginId),
    setSettings: (pluginId: string, settings: any) => ipcRenderer.invoke('set-plugin-settings', pluginId, settings)
  },
  
  // Window control
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    newWindow: (url?: string) => ipcRenderer.send('new-window', url)
  },
  
  // Media controls
  media: {
    play: () => ipcRenderer.send('media-play'),
    pause: () => ipcRenderer.send('media-pause'),
    next: () => ipcRenderer.send('media-next'),
    previous: () => ipcRenderer.send('media-previous')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}