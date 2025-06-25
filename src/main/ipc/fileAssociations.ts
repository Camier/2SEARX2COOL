import { ipcMain, dialog, shell, app } from 'electron'
import { extname, basename } from 'path'
import * as fs from 'fs/promises'
import log from 'electron-log'
import { createSearchWindow } from '../window'

// Supported file types
const MUSIC_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.opus', '.wma', '.aac']
const PLAYLIST_EXTENSIONS = ['.m3u', '.m3u8', '.pls', '.xspf', '.wpl']
const METADATA_EXTENSIONS = ['.cue', '.nfo']

interface FileInfo {
  path: string
  name: string
  extension: string
  size: number
  type: 'music' | 'playlist' | 'metadata' | 'unknown'
}

export function setupFileAssociationHandlers(): void {
  // Handle file open events
  ipcMain.handle('files:open', async (event, paths?: string[]) => {
    try {
      if (!paths || paths.length === 0) {
        // Show file picker
        const result = await dialog.showOpenDialog({
          title: 'Open Music Files',
          filters: [
            { name: 'Music Files', extensions: ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'opus', 'wma', 'aac'] },
            { name: 'Playlists', extensions: ['m3u', 'm3u8', 'pls', 'xspf', 'wpl'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile', 'multiSelections']
        })

        if (result.canceled || !result.filePaths.length) {
          return { success: false, canceled: true }
        }

        paths = result.filePaths
      }

      const fileInfos = await getFileInfos(paths)
      return { success: true, files: fileInfos }
    } catch (error) {
      log.error('Failed to open files:', error)
      return { success: false, error: error.message }
    }
  })

  // Handle folder open
  ipcMain.handle('files:openFolder', async (event) => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Music Folder',
        properties: ['openDirectory']
      })

      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true }
      }

      const folderPath = result.filePaths[0]
      const files = await scanMusicFolder(folderPath)
      
      return { success: true, folder: folderPath, files }
    } catch (error) {
      log.error('Failed to open folder:', error)
      return { success: false, error: error.message }
    }
  })

  // Get file metadata
  ipcMain.handle('files:getMetadata', async (event, filePath: string) => {
    try {
      const metadata = await extractMetadata(filePath)
      return { success: true, metadata }
    } catch (error) {
      log.error('Failed to get metadata:', error)
      return { success: false, error: error.message }
    }
  })

  // Search for file online
  ipcMain.handle('files:searchOnline', async (event, fileInfo: FileInfo) => {
    try {
      let searchQuery = ''
      
      if (fileInfo.type === 'music') {
        // Extract metadata for better search
        const metadata = await extractMetadata(fileInfo.path)
        if (metadata.artist && metadata.title) {
          searchQuery = `${metadata.artist} ${metadata.title}`
        } else {
          // Use filename without extension
          searchQuery = basename(fileInfo.name, fileInfo.extension)
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        }
      } else {
        searchQuery = basename(fileInfo.name, fileInfo.extension)
      }

      // Open search window with query
      createSearchWindow(searchQuery)
      
      return { success: true, query: searchQuery }
    } catch (error) {
      log.error('Failed to search online:', error)
      return { success: false, error: error.message }
    }
  })

  // Show file in folder
  ipcMain.handle('files:showInFolder', async (event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      log.error('Failed to show in folder:', error)
      return { success: false, error: error.message }
    }
  })

  // Open with default application
  ipcMain.handle('files:openExternal', async (event, filePath: string) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      log.error('Failed to open externally:', error)
      return { success: false, error: error.message }
    }
  })

  // Register file associations
  ipcMain.handle('files:registerAssociations', async () => {
    try {
      if (process.platform === 'win32') {
        // Windows: Set file associations in registry
        app.setAsDefaultProtocolClient('2searx2cool')
        
        // Register music file types
        for (const ext of MUSIC_EXTENSIONS) {
          app.setAsDefaultProtocolClient(`2searx2cool-${ext.slice(1)}`)
        }
      } else if (process.platform === 'darwin') {
        // macOS: Handled in Info.plist
        log.info('File associations are configured in Info.plist on macOS')
      } else {
        // Linux: Create .desktop file
        log.info('File associations should be configured in .desktop file on Linux')
      }
      
      return { success: true }
    } catch (error) {
      log.error('Failed to register file associations:', error)
      return { success: false, error: error.message }
    }
  })

  log.info('File association handlers initialized')
}

// Get file information
async function getFileInfos(paths: string[]): Promise<FileInfo[]> {
  const fileInfos: FileInfo[] = []

  for (const path of paths) {
    try {
      const stats = await fs.stat(path)
      const ext = extname(path).toLowerCase()
      const name = basename(path)

      let type: FileInfo['type'] = 'unknown'
      if (MUSIC_EXTENSIONS.includes(ext)) {
        type = 'music'
      } else if (PLAYLIST_EXTENSIONS.includes(ext)) {
        type = 'playlist'
      } else if (METADATA_EXTENSIONS.includes(ext)) {
        type = 'metadata'
      }

      fileInfos.push({
        path,
        name,
        extension: ext,
        size: stats.size,
        type
      })
    } catch (error) {
      log.error(`Failed to get info for ${path}:`, error)
    }
  }

  return fileInfos
}

// Scan folder for music files
async function scanMusicFolder(folderPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = []
  
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = `${folderPath}/${entry.name}`
        const ext = extname(entry.name).toLowerCase()
        
        if (MUSIC_EXTENSIONS.includes(ext) || PLAYLIST_EXTENSIONS.includes(ext)) {
          const stats = await fs.stat(filePath)
          files.push({
            path: filePath,
            name: entry.name,
            extension: ext,
            size: stats.size,
            type: MUSIC_EXTENSIONS.includes(ext) ? 'music' : 'playlist'
          })
        }
      }
    }
  } catch (error) {
    log.error('Failed to scan folder:', error)
  }

  return files
}

// Extract metadata from music file
async function extractMetadata(filePath: string): Promise<any> {
  // This is a placeholder - in a real implementation, you would use a library like
  // node-taglib, music-metadata, or similar to extract actual metadata
  
  const name = basename(filePath)
  const ext = extname(filePath)
  
  // Simple parsing from filename
  const nameWithoutExt = name.replace(ext, '')
  const parts = nameWithoutExt.split(' - ')
  
  return {
    title: parts.length > 1 ? parts[1] : nameWithoutExt,
    artist: parts.length > 1 ? parts[0] : 'Unknown Artist',
    album: 'Unknown Album',
    duration: 0,
    format: ext.slice(1).toUpperCase()
  }
}

// Handle file open from OS
export function handleFileOpen(filePath: string): void {
  log.info('Opening file from OS:', filePath)
  
  // Send to renderer
  const { BrowserWindow } = require('electron')
  const windows = BrowserWindow.getAllWindows()
  
  if (windows.length > 0) {
    windows[0].webContents.send('file-opened', filePath)
  }
}