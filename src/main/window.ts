import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createWindow(): BrowserWindow {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: join(__dirname, '../../build/icon.png')
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
  const searchWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const serverUrl = process.env.SEARXNG_URL || 'http://localhost:5000'
  const url = query ? `${serverUrl}/search?q=${encodeURIComponent(query)}` : serverUrl
  searchWindow.loadURL(url)

  return searchWindow
}