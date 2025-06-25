import { ipcMain, Notification, nativeImage, shell } from 'electron'
import { join } from 'path'
import log from 'electron-log'

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  sound?: boolean
  urgency?: 'low' | 'normal' | 'critical'
  actions?: Array<{
    type: string
    text: string
  }>
  closeButtonText?: string
  silent?: boolean
  hasReply?: boolean
  replyPlaceholder?: string
  timeoutType?: 'default' | 'never'
  data?: any
}

interface NotificationAction {
  type: string
  data?: any
}

// Track active notifications
const activeNotifications = new Map<string, Notification>()

export function setupNotificationHandlers(): void {
  // Show notification
  ipcMain.handle('notification:show', async (event, options: NotificationOptions) => {
    try {
      if (!Notification.isSupported()) {
        log.warn('Notifications are not supported on this system')
        return { success: false, error: 'Notifications not supported' }
      }

      const notificationId = `notification-${Date.now()}-${Math.random()}`
      
      // Create notification options
      const notificationOptions: Electron.NotificationConstructorOptions = {
        title: options.title,
        body: options.body,
        silent: options.silent || false,
        hasReply: options.hasReply || false,
        replyPlaceholder: options.replyPlaceholder,
        closeButtonText: options.closeButtonText || 'Close',
        timeoutType: options.timeoutType || 'default'
      }

      // Set icon
      if (options.icon) {
        try {
          const iconPath = options.icon.startsWith('data:') 
            ? options.icon 
            : join(__dirname, '../../../', options.icon)
          notificationOptions.icon = iconPath
        } catch (error) {
          log.error('Failed to set notification icon:', error)
        }
      }

      // Set urgency (Linux)
      if (process.platform === 'linux' && options.urgency) {
        notificationOptions.urgency = options.urgency
      }

      // Add actions (macOS)
      if (process.platform === 'darwin' && options.actions) {
        notificationOptions.actions = options.actions
      }

      // Set sound
      if (options.sound !== false && !options.silent) {
        if (process.platform === 'darwin') {
          notificationOptions.sound = 'default'
        } else if (process.platform === 'win32') {
          // Windows uses system sounds by default
        }
      }

      // Create and show notification
      const notification = new Notification(notificationOptions)
      
      // Store notification reference
      activeNotifications.set(notificationId, notification)

      // Handle notification events
      notification.on('click', () => {
        event.sender.send('notification:clicked', {
          id: notificationId,
          data: options.data
        })
        activeNotifications.delete(notificationId)
      })

      notification.on('close', () => {
        event.sender.send('notification:closed', {
          id: notificationId,
          data: options.data
        })
        activeNotifications.delete(notificationId)
      })

      notification.on('reply', (event, reply) => {
        event.sender.send('notification:reply', {
          id: notificationId,
          reply,
          data: options.data
        })
      })

      notification.on('action', (event, index) => {
        if (options.actions && options.actions[index]) {
          event.sender.send('notification:action', {
            id: notificationId,
            action: options.actions[index].type,
            data: options.data
          })
        }
      })

      notification.show()

      return { success: true, id: notificationId }
    } catch (error) {
      log.error('Failed to show notification:', error)
      return { success: false, error: error.message }
    }
  })

  // Close notification
  ipcMain.handle('notification:close', async (event, notificationId: string) => {
    const notification = activeNotifications.get(notificationId)
    if (notification) {
      notification.close()
      activeNotifications.delete(notificationId)
      return { success: true }
    }
    return { success: false, error: 'Notification not found' }
  })

  // Check if notifications are supported
  ipcMain.handle('notification:isSupported', async () => {
    return Notification.isSupported()
  })

  // Show toast notification (Windows specific)
  ipcMain.handle('notification:showToast', async (event, options: NotificationOptions) => {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Toast notifications are only supported on Windows' }
    }

    try {
      // For Windows 10+, we can use the built-in toast notifications
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        silent: options.silent || false,
        toastXml: `
          <toast>
            <visual>
              <binding template="ToastGeneric">
                <text>${options.title}</text>
                <text>${options.body}</text>
              </binding>
            </visual>
            ${options.actions ? `
              <actions>
                ${options.actions.map(action => 
                  `<action content="${action.text}" arguments="${action.type}" />`
                ).join('')}
              </actions>
            ` : ''}
          </toast>
        `
      })

      notification.show()
      return { success: true }
    } catch (error) {
      log.error('Failed to show toast notification:', error)
      return { success: false, error: error.message }
    }
  })

  // Request notification permission (for consistency with web API)
  ipcMain.handle('notification:requestPermission', async () => {
    // Electron apps always have notification permission
    return 'granted'
  })

  // Show system badge (macOS/Linux)
  ipcMain.handle('notification:setBadge', async (event, count: number | null) => {
    try {
      const { app } = require('electron')
      
      if (process.platform === 'darwin') {
        if (count === null || count === 0) {
          app.dock.setBadge('')
        } else {
          app.dock.setBadge(count.toString())
        }
      } else if (process.platform === 'linux') {
        if (count === null || count === 0) {
          app.setBadgeCount(0)
        } else {
          app.setBadgeCount(count)
        }
      }
      
      return { success: true }
    } catch (error) {
      log.error('Failed to set badge:', error)
      return { success: false, error: error.message }
    }
  })

  // Flash taskbar/dock icon
  ipcMain.handle('notification:flashFrame', async (event, flag: boolean) => {
    try {
      const window = event.sender.getOwnerBrowserWindow()
      if (window) {
        window.flashFrame(flag)
        return { success: true }
      }
      return { success: false, error: 'Window not found' }
    } catch (error) {
      log.error('Failed to flash frame:', error)
      return { success: false, error: error.message }
    }
  })

  // Bounce dock icon (macOS)
  ipcMain.handle('notification:bounce', async (event, type: 'informational' | 'critical' = 'informational') => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Bounce is only supported on macOS' }
    }

    try {
      const { app } = require('electron')
      const id = app.dock.bounce(type)
      
      // Store bounce ID to allow cancellation
      return { success: true, id }
    } catch (error) {
      log.error('Failed to bounce dock:', error)
      return { success: false, error: error.message }
    }
  })

  // Cancel dock bounce (macOS)
  ipcMain.handle('notification:cancelBounce', async (event, id: number) => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Bounce is only supported on macOS' }
    }

    try {
      const { app } = require('electron')
      app.dock.cancelBounce(id)
      return { success: true }
    } catch (error) {
      log.error('Failed to cancel bounce:', error)
      return { success: false, error: error.message }
    }
  })

  log.info('Notification handlers initialized')
}

// Cleanup function
export function cleanupNotifications(): void {
  // Close all active notifications
  for (const [id, notification] of activeNotifications) {
    try {
      notification.close()
    } catch (error) {
      log.error(`Failed to close notification ${id}:`, error)
    }
  }
  activeNotifications.clear()
  
  log.info('Notification cleanup completed')
}