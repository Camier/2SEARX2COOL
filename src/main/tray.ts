import { app, Tray, Menu, nativeImage, clipboard, shell } from 'electron'
import { join } from 'path'
import { createWindow, createSearchWindow, createSettingsWindow, focusMainWindow, getWindow } from './window'
import { ServerManager } from './server/ServerManager'
import log from 'electron-log'

let tray: Tray | null = null
let serverManager: ServerManager | null = null

export function setupTray(server?: ServerManager): void {
  serverManager = server || null
  
  // Create tray icon with different sizes for different platforms
  const iconPath = join(__dirname, '../../build/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  
  // Platform-specific icon sizing
  const trayIcon = process.platform === 'darwin' 
    ? icon.resize({ width: 16, height: 16 })
    : process.platform === 'win32'
    ? icon.resize({ width: 16, height: 16 })
    : icon.resize({ width: 24, height: 24 })

  tray = new Tray(trayIcon)
  
  updateTrayMenu()
  
  // Set initial tooltip
  tray.setToolTip('2SEARX2COOL - Music Search')

  // Platform-specific behaviors
  if (process.platform === 'win32') {
    // Windows: single click shows menu, double click shows window
    tray.on('click', () => {
      tray?.popUpContextMenu()
    })
    
    tray.on('double-click', () => {
      focusMainWindow()
    })
  } else if (process.platform === 'darwin') {
    // macOS: click toggles window visibility
    tray.on('click', () => {
      const mainWindow = getWindow('main')
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
        }
      } else {
        createWindow()
      }
    })
    
    tray.on('right-click', () => {
      tray?.popUpContextMenu()
    })
  } else {
    // Linux: click shows menu
    tray.on('click', () => {
      tray?.popUpContextMenu()
    })
  }
}

export function updateTrayMenu(): void {
  if (!tray) return

  const serverStatus = serverManager?.getStatus() || { running: false, port: 8888 }
  const mainWindow = getWindow('main')
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: mainWindow ? 'Show 2SEARX2COOL' : 'Open 2SEARX2COOL',
      click: () => {
        if (mainWindow) {
          focusMainWindow()
        } else {
          createWindow()
        }
      },
      accelerator: 'CmdOrCtrl+Shift+S'
    },
    {
      label: 'New Search',
      click: () => {
        createSearchWindow()
      },
      accelerator: 'CmdOrCtrl+Shift+Space'
    },
    {
      label: 'Quick Search from Clipboard',
      click: () => {
        const clipboardText = clipboard.readText()
        if (clipboardText && clipboardText.trim()) {
          createSearchWindow(clipboardText.trim())
        } else {
          createSearchWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Server Status',
      submenu: [
        {
          label: serverStatus.running ? `✅ Running on port ${serverStatus.port}` : '❌ Stopped',
          enabled: false
        },
        {
          label: serverStatus.running ? 'Stop Server' : 'Start Server',
          click: async () => {
            try {
              if (serverStatus.running) {
                await serverManager?.stop()
              } else {
                await serverManager?.start()
              }
              // Update menu after state change
              setTimeout(updateTrayMenu, 1000)
            } catch (error) {
              log.error('Failed to toggle server:', error)
            }
          }
        },
        {
          label: 'Open in Browser',
          enabled: serverStatus.running,
          click: () => {
            shell.openExternal(`http://localhost:${serverStatus.port}`)
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Settings',
          click: () => {
            createSettingsWindow()
          },
          accelerator: 'CmdOrCtrl+,'
        },
        {
          label: 'Plugin Manager',
          click: () => {
            const mainWin = getWindow('main')
            if (mainWin) {
              mainWin.webContents.send('navigate', '/plugins')
              focusMainWindow()
            }
          }
        },
        {
          label: 'Hardware Controls',
          click: () => {
            const mainWin = getWindow('main')
            if (mainWin) {
              mainWin.webContents.send('navigate', '/hardware')
              focusMainWindow()
            }
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/Camier/2SEARX2COOL#readme')
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/Camier/2SEARX2COOL/issues/new')
          }
        },
        {
          label: 'Check for Updates',
          click: () => {
            app.emit('check-for-updates')
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            const { createAboutWindow } = require('./window')
            createAboutWindow()
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
      accelerator: 'CmdOrCtrl+Q'
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function updateTrayTooltip(text: string): void {
  if (tray) {
    tray.setToolTip(text)
  }
}

export function showTrayBalloon(title: string, content: string): void {
  if (tray && process.platform === 'win32') {
    tray.displayBalloon({
      title,
      content,
      iconType: 'info'
    })
  }
}

export function setTrayIcon(iconType: 'normal' | 'active' | 'error' | 'offline'): void {
  if (!tray) return

  const iconPath = join(__dirname, '../../build')
  let iconFile: string

  switch (iconType) {
    case 'active':
      iconFile = 'icon-active.png'
      break
    case 'error':
      iconFile = 'icon-error.png'
      break
    case 'offline':
      iconFile = 'icon-offline.png'
      break
    default:
      iconFile = 'icon.png'
  }

  try {
    const icon = nativeImage.createFromPath(join(iconPath, iconFile))
    const sized = process.platform === 'darwin' 
      ? icon.resize({ width: 16, height: 16 })
      : icon.resize({ width: 24, height: 24 })
    
    tray.setImage(sized)
  } catch (error) {
    log.error('Failed to set tray icon:', error)
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}