import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { initializePlugins } from './plugins'
import { setupTray } from './tray'
import { setupGlobalShortcuts } from './shortcuts'
import { SearXNGServer } from './server'

// Initialize the SearXNG server manager
const server = new SearXNGServer()

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit()
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.camier.2searx2cool')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize plugins
  initializePlugins()

  // Setup system tray
  setupTray()

  // Setup global shortcuts
  setupGlobalShortcuts()

  // Start the SearXNG server if in bundled mode
  if (process.env.DEPLOYMENT_MODE === 'bundled') {
    server.start()
  }

  // Create the main window
  createWindow()

  app.on('activate', function () {
    // On macOS, re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Stop the server if running
    server.stop()
    app.quit()
  }
})

// Handle protocol for deep linking
app.setAsDefaultProtocolClient('searxng')

// Handle deep link on Windows/Linux
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// IPC handlers
ipcMain.handle('get-server-status', () => server.getStatus())
ipcMain.handle('start-server', () => server.start())
ipcMain.handle('stop-server', () => server.stop())