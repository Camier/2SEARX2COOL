import { globalShortcut } from 'electron'
import { createSearchWindow } from './window'

export function setupGlobalShortcuts(): void {
  // Global search shortcut
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    createSearchWindow()
  })

  // Media control shortcuts
  globalShortcut.register('MediaPlayPause', () => {
    // TODO: Implement media control
    console.log('Play/Pause pressed')
  })

  globalShortcut.register('MediaNextTrack', () => {
    // TODO: Implement media control
    console.log('Next track pressed')
  })

  globalShortcut.register('MediaPreviousTrack', () => {
    // TODO: Implement media control
    console.log('Previous track pressed')
  })
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
}