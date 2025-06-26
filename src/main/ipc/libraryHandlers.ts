import { ipcMain } from 'electron';
import { LibraryService, LibraryPage, BatchUpdateOptions } from '../services/LibraryService';
import { 
  AudioFile, 
  Album, 
  Artist, 
  LibraryFilter, 
  LibrarySortOptions, 
  LibraryViewOptions,
  LibraryStats 
} from '../database/LibrarySchema';
import log from 'electron-log';

/**
 * Week 4 Day 3: Library IPC Handlers
 * 
 * Exposes library browsing and management functionality to the renderer process
 * with comprehensive error handling and logging.
 */
export function registerLibraryHandlers(libraryService: LibraryService): void {
  
  /**
   * Get paginated library items
   */
  ipcMain.handle('library-get-page', async (event, viewOptions: LibraryViewOptions, filter?: LibraryFilter, sort?: LibrarySortOptions) => {
    try {
      log.debug('Library page request:', { viewOptions, filter, sort });
      const result = await libraryService.getLibraryPage(viewOptions, filter, sort);
      return { success: true, data: result };
    } catch (error) {
      log.error('Failed to get library page:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Get filter options (distinct values)
   */
  ipcMain.handle('library-get-filter-options', async (event) => {
    try {
      const options = await libraryService.getFilterOptions();
      return { success: true, data: options };
    } catch (error) {
      log.error('Failed to get filter options:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Get library statistics
   */
  ipcMain.handle('library-get-stats', async (event) => {
    try {
      const stats = await libraryService.getLibraryStats();
      return { success: true, data: stats };
    } catch (error) {
      log.error('Failed to get library stats:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Batch update tracks
   */
  ipcMain.handle('library-batch-update', async (event, options: BatchUpdateOptions) => {
    try {
      log.info('Batch update request:', options);
      const changedCount = await libraryService.batchUpdate(options);
      
      // Notify all windows about the update
      event.sender.send('library-updated', { 
        ids: options.ids, 
        updates: options.updates,
        changedCount 
      });
      
      return { success: true, data: { changedCount } };
    } catch (error) {
      log.error('Failed to batch update:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Get single track details
   */
  ipcMain.handle('library-get-track', async (event, id: number) => {
    try {
      const track = await libraryService.getTrack(id);
      return { success: true, data: track };
    } catch (error) {
      log.error('Failed to get track:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Get album with tracks
   */
  ipcMain.handle('library-get-album', async (event, albumName: string, artist: string) => {
    try {
      const result = await libraryService.getAlbumWithTracks(albumName, artist);
      return { success: true, data: result };
    } catch (error) {
      log.error('Failed to get album:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Add track to queue from library
   */
  ipcMain.handle('library-add-to-queue', async (event, trackId: number) => {
    try {
      const track = await libraryService.getTrack(trackId);
      if (!track) {
        throw new Error('Track not found');
      }
      
      // Convert to player format and send to player
      const playerTrack = {
        id: `local_${track.id}`,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        url: `file://${track.filePath}`,
        source: 'local' as const,
        localFile: {
          path: track.filePath,
          format: track.format,
          bitrate: track.bitrate
        }
      };
      
      // Emit to player
      event.sender.send('player-queue-add', playerTrack);
      
      return { success: true };
    } catch (error) {
      log.error('Failed to add to queue:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Play track immediately from library
   */
  ipcMain.handle('library-play-track', async (event, trackId: number) => {
    try {
      const track = await libraryService.getTrack(trackId);
      if (!track) {
        throw new Error('Track not found');
      }
      
      // Convert to player format
      const playerTrack = {
        id: `local_${track.id}`,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        url: `file://${track.filePath}`,
        source: 'local' as const,
        localFile: {
          path: track.filePath,
          format: track.format,
          bitrate: track.bitrate
        }
      };
      
      // Send to player
      event.sender.send('player-play', playerTrack);
      
      return { success: true };
    } catch (error) {
      log.error('Failed to play track:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Play entire album
   */
  ipcMain.handle('library-play-album', async (event, albumName: string, artist: string) => {
    try {
      const result = await libraryService.getAlbumWithTracks(albumName, artist);
      if (!result) {
        throw new Error('Album not found');
      }
      
      // Convert tracks to player format
      const playerTracks = result.tracks.map(track => ({
        id: `local_${track.id}`,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        url: `file://${track.filePath}`,
        source: 'local' as const,
        localFile: {
          path: track.filePath,
          format: track.format,
          bitrate: track.bitrate
        }
      }));
      
      // Clear queue and play album
      event.sender.send('player-clear-queue');
      event.sender.send('player-queue-add-multiple', playerTracks);
      if (playerTracks.length > 0) {
        event.sender.send('player-play', playerTracks[0]);
      }
      
      return { success: true };
    } catch (error) {
      log.error('Failed to play album:', error);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Export library data
   */
  ipcMain.handle('library-export', async (event, format: 'json' | 'csv') => {
    try {
      // This would export the library in the requested format
      // For now, just return success
      log.info(`Library export requested in ${format} format`);
      return { success: true };
    } catch (error) {
      log.error('Failed to export library:', error);
      return { success: false, error: error.message };
    }
  });
  
  log.info('Library IPC handlers registered');
}