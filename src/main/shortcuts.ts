import { globalShortcut, BrowserWindow, dialog } from 'electron'
import { createSearchWindow, createSettingsWindow, focusMainWindow, getAllWindows } from './window'
import log from 'electron-log'

interface ShortcutDefinition {
  accelerator: string
  description: string
  handler: () => void
  category: 'search' | 'navigation' | 'media' | 'window'
}

const shortcuts: ShortcutDefinition[] = [
  // Search shortcuts
  {
    accelerator: 'CommandOrControl+Shift+Space',
    description: 'Open new search window',
    category: 'search',
    handler: () => {
      createSearchWindow()
    }
  },
  {
    accelerator: 'CommandOrControl+Shift+F',
    description: 'Focus search in main window',
    category: 'search',
    handler: () => {
      focusMainWindow()
      const mainWindow = getAllWindows().find(w => w.id === 1)
      if (mainWindow) {
        mainWindow.webContents.send('focus-search')
      }
    }
  },
  
  // Navigation shortcuts
  {
    accelerator: 'CommandOrControl+Tab',
    description: 'Next search result',
    category: 'navigation',
    handler: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send('navigate-result', 'next')
    }
  },
  {
    accelerator: 'CommandOrControl+Shift+Tab',
    description: 'Previous search result',
    category: 'navigation',
    handler: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send('navigate-result', 'previous')
    }
  },
  
  // Media control shortcuts
  {
    accelerator: 'MediaPlayPause',
    description: 'Play/Pause media',
    category: 'media',
    handler: () => {
      handleMediaControl('play-pause')
    }
  },
  {
    accelerator: 'MediaNextTrack',
    description: 'Next track',
    category: 'media',
    handler: () => {
      handleMediaControl('next')
    }
  },
  {
    accelerator: 'MediaPreviousTrack',
    description: 'Previous track',
    category: 'media',
    handler: () => {
      handleMediaControl('previous')
    }
  },
  {
    accelerator: 'MediaStop',
    description: 'Stop media',
    category: 'media',
    handler: () => {
      handleMediaControl('stop')
    }
  },
  
  // Window shortcuts
  {
    accelerator: 'CommandOrControl+Shift+S',
    description: 'Show main window',
    category: 'window',
    handler: () => {
      focusMainWindow()
    }
  },
  {
    accelerator: 'CommandOrControl+,',
    description: 'Open settings',
    category: 'window',
    handler: () => {
      createSettingsWindow()
    }
  },
  {
    accelerator: 'F11',
    description: 'Toggle fullscreen',
    category: 'window',
    handler: () => {
      const window = BrowserWindow.getFocusedWindow()
      if (window) {
        window.setFullScreen(!window.isFullScreen())
      }
    }
  },
  {
    accelerator: 'CommandOrControl+Shift+I',
    description: 'Toggle DevTools',
    category: 'window',
    handler: () => {
      const window = BrowserWindow.getFocusedWindow()
      if (window) {
        window.webContents.toggleDevTools()
      }
    }
  }
]

// Track registered shortcuts
const registeredShortcuts = new Set<string>()

export function setupGlobalShortcuts(): void {
  log.info('Setting up global shortcuts...')
  
  let successCount = 0
  let failCount = 0
  
  for (const shortcut of shortcuts) {
    try {
      const success = globalShortcut.register(shortcut.accelerator, shortcut.handler)
      
      if (success) {
        registeredShortcuts.add(shortcut.accelerator)
        successCount++
        log.debug(`✅ Registered: ${shortcut.accelerator} - ${shortcut.description}`)
      } else {
        failCount++
        log.warn(`⚠️ Failed to register: ${shortcut.accelerator} - ${shortcut.description}`)
      }
    } catch (error) {
      failCount++
      log.error(`❌ Error registering ${shortcut.accelerator}:`, error)
    }
  }
  
  log.info(`Global shortcuts setup complete: ${successCount} successful, ${failCount} failed`)
  
  // Show warning if some shortcuts failed
  if (failCount > 0 && process.env.NODE_ENV !== 'production') {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Keyboard Shortcuts',
      message: `Some keyboard shortcuts could not be registered (${failCount} failed).`,
      detail: 'This may be because they are already in use by other applications.',
      buttons: ['OK']
    })
  }
}

export function unregisterGlobalShortcuts(): void {
  log.info('Unregistering global shortcuts...')
  
  for (const accelerator of registeredShortcuts) {
    try {
      globalShortcut.unregister(accelerator)
      log.debug(`✅ Unregistered: ${accelerator}`)
    } catch (error) {
      log.error(`❌ Error unregistering ${accelerator}:`, error)
    }
  }
  
  registeredShortcuts.clear()
  
  // Also unregister all (in case some were registered outside this module)
  globalShortcut.unregisterAll()
  
  log.info('All global shortcuts unregistered')
}

export function isShortcutRegistered(accelerator: string): boolean {
  return globalShortcut.isRegistered(accelerator)
}

export function getRegisteredShortcuts(): ShortcutDefinition[] {
  return shortcuts.filter(s => registeredShortcuts.has(s.accelerator))
}

export function getShortcutsByCategory(category: string): ShortcutDefinition[] {
  return shortcuts.filter(s => s.category === category && registeredShortcuts.has(s.accelerator))
}

// Media control handler
function handleMediaControl(action: string): void {
  // Send to all windows
  const windows = getAllWindows()
  for (const window of windows) {
    window.webContents.send('media-control', action)
  }
  
  // Also emit on app level for plugins
  const { app } = require('electron')
  app.emit('media-control', action)
  
  log.debug(`Media control: ${action}`)
}

// Dynamic shortcut registration
export function registerShortcut(
  accelerator: string, 
  handler: () => void, 
  description?: string
): boolean {
  try {
    if (registeredShortcuts.has(accelerator)) {
      log.warn(`Shortcut already registered: ${accelerator}`)
      return false
    }
    
    const success = globalShortcut.register(accelerator, handler)
    
    if (success) {
      registeredShortcuts.add(accelerator)
      log.info(`✅ Dynamically registered: ${accelerator}${description ? ` - ${description}` : ''}`)
      return true
    }
    
    return false
  } catch (error) {
    log.error(`Failed to register shortcut ${accelerator}:`, error)
    return false
  }
}

export function unregisterShortcut(accelerator: string): boolean {
  try {
    if (!registeredShortcuts.has(accelerator)) {
      return false
    }
    
    globalShortcut.unregister(accelerator)
    registeredShortcuts.delete(accelerator)
    log.info(`✅ Unregistered: ${accelerator}`)
    return true
  } catch (error) {
    log.error(`Failed to unregister shortcut ${accelerator}:`, error)
    return false
  }
}

// Re-register shortcuts (useful after focus changes)
export function refreshShortcuts(): void {
  log.debug('Refreshing global shortcuts...')
  
  // Unregister all first
  for (const accelerator of registeredShortcuts) {
    try {
      globalShortcut.unregister(accelerator)
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  
  registeredShortcuts.clear()
  
  // Re-register
  setupGlobalShortcuts()
}