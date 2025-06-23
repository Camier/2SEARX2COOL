import { app, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { createWindow, createSearchWindow } from './window'

let tray: Tray | null = null

export function setupTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open 2SEARX2COOL',
      click: () => {
        const windows = require('electron').BrowserWindow.getAllWindows()
        if (windows.length === 0) {
          createWindow()
        } else {
          windows[0].show()
        }
      }
    },
    {
      label: 'New Search',
      click: () => {
        createSearchWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        // TODO: Open settings window
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('2SEARX2COOL - Music Search')
  tray.setContextMenu(contextMenu)

  // On Windows, clicking the tray icon should show the menu
  if (process.platform === 'win32') {
    tray.on('click', () => {
      tray?.popUpContextMenu()
    })
  }
}