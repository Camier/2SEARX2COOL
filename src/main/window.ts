import { BrowserWindow, shell, screen, nativeTheme } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { ConfigStore } from './config/ConfigStore'
import log from 'electron-log'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
  isFullScreen?: boolean
  displayBounds?: Electron.Rectangle
}

const configStore = new ConfigStore()
const windows = new Map<string, BrowserWindow>()

function getWindowState(): WindowState {
  const defaultState: WindowState = {
    width: 1200,
    height: 800,
    isMaximized: false,
    isFullScreen: false
  }

  try {
    const savedState = configStore.getSync('windowState') as WindowState | undefined
    if (!savedState) return defaultState

    // Validate saved bounds are visible on current displays
    const displays = screen.getAllDisplays()
    const displayBounds = screen.getDisplayMatching(savedState as Electron.Rectangle).bounds

    // Check if window would be visible
    const windowWithinDisplay = displays.some(display => {
      const bounds = display.bounds
      return (
        savedState.x! >= bounds.x &&
        savedState.y! >= bounds.y &&
        savedState.x! + savedState.width <= bounds.x + bounds.width &&
        savedState.y! + savedState.height <= bounds.y + bounds.height
      )
    })

    if (windowWithinDisplay) {
      return { ...defaultState, ...savedState, displayBounds }
    }

    // Window would be off-screen, use default with current display
    return { ...defaultState, displayBounds }
  } catch (error) {
    log.error('Failed to restore window state:', error)
    return defaultState
  }
}

export function createWindow(): BrowserWindow {
  const windowState = getWindowState()
  
  // Create the browser window with enhanced options
  const mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !is.dev,
      allowRunningInsecureContent: false
    },
    icon: join(__dirname, '../../build/icon.png'),
    frame: process.platform !== 'win32', // Frameless on Windows for custom titlebar
    titleBarOverlay: process.platform === 'win32' ? {
      color: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000',
      height: 32
    } : false
  })

  // Track window state changes
  let windowStateChangeTimer: NodeJS.Timeout | null = null
  const updateWindowState = () => {
    if (windowStateChangeTimer) clearTimeout(windowStateChangeTimer)
    
    windowStateChangeTimer = setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds()
        configStore.set('windowState', {
          ...bounds,
          isMaximized: mainWindow.isMaximized(),
          isFullScreen: mainWindow.isFullScreen()
        })
      }
    }, 1000)
  }

  mainWindow.on('moved', updateWindowState)
  mainWindow.on('resized', updateWindowState)
  mainWindow.on('maximize', updateWindowState)
  mainWindow.on('unmaximize', updateWindowState)
  mainWindow.on('enter-full-screen', updateWindowState)
  mainWindow.on('leave-full-screen', updateWindowState)

  // Restore window state
  if (windowState.isMaximized) {
    mainWindow.maximize()
  }
  if (windowState.isFullScreen) {
    mainWindow.setFullScreen(true)
  }

  // Store window reference
  windows.set('main', mainWindow)
  mainWindow.on('closed', () => {
    windows.delete('main')
  })

  // Show window when ready, but also show after timeout as fallback
  let windowShown = false
  
  mainWindow.on('ready-to-show', () => {
    if (!windowShown) {
      windowShown = true
      mainWindow.show()
    }
  })

  // Fallback: show window after 3 seconds even if content fails to load
  setTimeout(() => {
    if (!windowShown) {
      windowShown = true
      mainWindow.show()
      console.log('Window shown due to timeout - content may have failed to load')
    }
  }, 3000)

  // Handle loading failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`)
    
    // Show window even on load failure
    if (!windowShown) {
      windowShown = true
      mainWindow.show()
    }

    // Load a simple error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>2SEARX2COOL - Loading Error</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .error { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
              max-width: 600px; 
              margin: 0 auto; 
            }
            .retry-btn { 
              background: #007acc; 
              color: white; 
              padding: 10px 20px; 
              border: none; 
              border-radius: 5px; 
              cursor: pointer; 
              margin: 10px; 
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>🔧 Development Setup Required</h1>
            <p><strong>Failed to load:</strong> ${validatedURL}</p>
            <p><strong>Error:</strong> ${errorDescription}</p>
            
            <h3>Quick Fix:</h3>
            <p>Start the development server:</p>
            <code style="background: #f0f0f0; padding: 10px; display: block; margin: 10px 0;">
              npm run dev
            </code>
            
            <button class="retry-btn" onclick="location.reload()">Retry</button>
            <button class="retry-btn" onclick="require('electron').ipcRenderer.send('open-devtools')">Open DevTools</button>
          </div>
        </body>
      </html>
    `
    
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the interface with better URL handling
  let targetUrl: string
  
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    targetUrl = process.env['ELECTRON_RENDERER_URL']
  } else if (is.dev) {
    // Default dev server URL
    targetUrl = 'http://localhost:5173' // Vite default port
  } else {
    // Production: load from built files
    targetUrl = join(__dirname, '../renderer/index.html')
    if (!targetUrl.startsWith('file://')) {
      targetUrl = `file://${targetUrl}`
    }
  }

  console.log(`Loading window content from: ${targetUrl}`)
  mainWindow.loadURL(targetUrl)

  // Open DevTools in development
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  return mainWindow
}

export function createSearchWindow(query?: string): BrowserWindow {
  const parent = windows.get('main')
  const searchWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    parent: parent,
    modal: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !is.dev
    },
    icon: join(__dirname, '../../build/icon.png')
  })

  // Track this window
  const windowId = `search-${Date.now()}`
  windows.set(windowId, searchWindow)
  searchWindow.on('closed', () => {
    windows.delete(windowId)
  })

  // Show when ready
  searchWindow.once('ready-to-show', () => {
    searchWindow.show()
  })

  const serverUrl = process.env.SEARXNG_URL || 'http://localhost:8888'
  const url = query ? `${serverUrl}/search?q=${encodeURIComponent(query)}` : serverUrl
  searchWindow.loadURL(url)

  return searchWindow
}

export function createSettingsWindow(): BrowserWindow {
  // Check if settings window already exists
  const existingSettings = windows.get('settings')
  if (existingSettings && !existingSettings.isDestroyed()) {
    existingSettings.focus()
    return existingSettings
  }

  const parent = windows.get('main')
  const settingsWindow = new BrowserWindow({
    width: 700,
    height: 600,
    minWidth: 500,
    minHeight: 400,
    parent: parent,
    modal: process.platform !== 'darwin',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: join(__dirname, '../../build/icon.png')
  })

  windows.set('settings', settingsWindow)
  settingsWindow.on('closed', () => {
    windows.delete('settings')
  })

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show()
  })

  // Load settings page
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/settings`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/settings'
    })
  }

  return settingsWindow
}

export function createAboutWindow(): BrowserWindow {
  const aboutWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: windows.get('main'),
    modal: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: join(__dirname, '../../build/icon.png')
  })

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show()
  })

  // Load about page
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    aboutWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/about`)
  } else {
    aboutWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/about'
    })
  }

  return aboutWindow
}

export function getAllWindows(): BrowserWindow[] {
  return Array.from(windows.values()).filter(win => !win.isDestroyed())
}

export function getWindow(id: string): BrowserWindow | undefined {
  return windows.get(id)
}

export function focusMainWindow(): void {
  const mainWindow = windows.get('main')
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }
}

export function closeAllWindows(): void {
  for (const [id, window] of windows) {
    if (!window.isDestroyed() && id !== 'main') {
      window.close()
    }
  }
}