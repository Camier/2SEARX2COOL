/**
 * Week 4 Day 4: Playlist IPC Handlers
 * 
 * IPC communication layer for playlist operations between main and renderer processes.
 * Provides secure access to playlist functionality with proper error handling.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';

import { PlaylistService } from '../services/PlaylistService';
import {
  Playlist,
  PlaylistTrack,
  SmartPlaylist,
  SmartPlaylistCriteria,
  PlaylistImportExport,
  PlaylistShare,
  PlaylistStats,
  PlaylistViewOptions,
  PlaylistFilter,
  PlaylistPage,
  SharePermission,
  SMART_PLAYLIST_TEMPLATES
} from '../database/PlaylistSchema';

export class PlaylistHandlers {
  constructor(private playlistService: PlaylistService) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // ===== PLAYLIST CRUD OPERATIONS =====

    ipcMain.handle('playlist:create', async (event: IpcMainInvokeEvent, playlist: Partial<Playlist>) => {
      try {
        return await this.playlistService.createPlaylist(playlist);
      } catch (error) {
        log.error('Failed to create playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:get', async (event: IpcMainInvokeEvent, id: string) => {
      try {
        return await this.playlistService.getPlaylist(id);
      } catch (error) {
        log.error('Failed to get playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:update', async (event: IpcMainInvokeEvent, id: string, updates: Partial<Playlist>) => {
      try {
        return await this.playlistService.updatePlaylist(id, updates);
      } catch (error) {
        log.error('Failed to update playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:delete', async (event: IpcMainInvokeEvent, id: string) => {
      try {
        await this.playlistService.deletePlaylist(id);
        return { success: true };
      } catch (error) {
        log.error('Failed to delete playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:getAll', async (
      event: IpcMainInvokeEvent, 
      options: PlaylistViewOptions, 
      filter?: PlaylistFilter
    ) => {
      try {
        return await this.playlistService.getPlaylists(options, filter);
      } catch (error) {
        log.error('Failed to get playlists:', error);
        throw error;
      }
    });

    // ===== TRACK MANAGEMENT =====

    ipcMain.handle('playlist:addTracks', async (
      event: IpcMainInvokeEvent,
      playlistId: string,
      trackIds: number[],
      position?: number
    ) => {
      try {
        await this.playlistService.addTracksToPlaylist(playlistId, trackIds, position);
        return { success: true };
      } catch (error) {
        log.error('Failed to add tracks to playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:removeTracks', async (
      event: IpcMainInvokeEvent,
      playlistId: string,
      trackIds: number[]
    ) => {
      try {
        await this.playlistService.removeTracksFromPlaylist(playlistId, trackIds);
        return { success: true };
      } catch (error) {
        log.error('Failed to remove tracks from playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:reorderTracks', async (
      event: IpcMainInvokeEvent,
      playlistId: string,
      trackOrder?: number[]
    ) => {
      try {
        await this.playlistService.reorderTracks(playlistId, trackOrder);
        return { success: true };
      } catch (error) {
        log.error('Failed to reorder tracks in playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:getTracks', async (event: IpcMainInvokeEvent, playlistId: string) => {
      try {
        return await this.playlistService.getPlaylistTracks(playlistId);
      } catch (error) {
        log.error('Failed to get playlist tracks:', error);
        throw error;
      }
    });

    // ===== SMART PLAYLISTS =====

    ipcMain.handle('playlist:createSmart', async (
      event: IpcMainInvokeEvent,
      playlist: Partial<Playlist>,
      criteria: SmartPlaylistCriteria,
      options: {
        maxTracks?: number;
        sortBy: string;
        sortDirection: 'asc' | 'desc';
        autoUpdate?: boolean;
      }
    ) => {
      try {
        return await this.playlistService.createSmartPlaylist(playlist, criteria, options);
      } catch (error) {
        log.error('Failed to create smart playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:updateSmart', async (event: IpcMainInvokeEvent, playlistId: string) => {
      try {
        await this.playlistService.updateSmartPlaylist(playlistId);
        return { success: true };
      } catch (error) {
        log.error('Failed to update smart playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:createFromTemplate', async (
      event: IpcMainInvokeEvent,
      templateKey: keyof typeof SMART_PLAYLIST_TEMPLATES,
      customName?: string
    ) => {
      try {
        return await this.playlistService.createSmartPlaylistFromTemplate(templateKey, customName);
      } catch (error) {
        log.error('Failed to create playlist from template:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:updateAllSmart', async (event: IpcMainInvokeEvent) => {
      try {
        return await this.playlistService.updateAllAutoUpdatePlaylists();
      } catch (error) {
        log.error('Failed to update all smart playlists:', error);
        throw error;
      }
    });

    // ===== IMPORT/EXPORT =====

    ipcMain.handle('playlist:export', async (
      event: IpcMainInvokeEvent,
      playlistId: string,
      format: PlaylistImportExport['format'],
      filePath: string
    ) => {
      try {
        await this.playlistService.exportPlaylist(playlistId, format, filePath);
        return { success: true };
      } catch (error) {
        log.error('Failed to export playlist:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:import', async (
      event: IpcMainInvokeEvent,
      filePath: string,
      name?: string
    ) => {
      try {
        return await this.playlistService.importPlaylist(filePath, name);
      } catch (error) {
        log.error('Failed to import playlist:', error);
        throw error;
      }
    });

    // ===== SHARING =====

    ipcMain.handle('playlist:createShare', async (
      event: IpcMainInvokeEvent,
      playlistId: string,
      permissions: SharePermission[],
      expiresAt?: number
    ) => {
      try {
        return await this.playlistService.createPlaylistShare(playlistId, permissions, expiresAt);
      } catch (error) {
        log.error('Failed to create playlist share:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:getShare', async (event: IpcMainInvokeEvent, shareToken: string) => {
      try {
        return await this.playlistService.getPlaylistShare(shareToken);
      } catch (error) {
        log.error('Failed to get playlist share:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:getShares', async (event: IpcMainInvokeEvent, playlistId: string) => {
      try {
        return await this.playlistService.getPlaylistShares(playlistId);
      } catch (error) {
        log.error('Failed to get playlist shares:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:revokeShare', async (event: IpcMainInvokeEvent, shareToken: string) => {
      try {
        await this.playlistService.revokePlaylistShare(shareToken);
        return { success: true };
      } catch (error) {
        log.error('Failed to revoke playlist share:', error);
        throw error;
      }
    });

    ipcMain.handle('playlist:cleanExpiredShares', async (event: IpcMainInvokeEvent) => {
      try {
        return await this.playlistService.cleanExpiredShares();
      } catch (error) {
        log.error('Failed to clean expired shares:', error);
        throw error;
      }
    });

    // ===== STATISTICS =====

    ipcMain.handle('playlist:getStats', async (event: IpcMainInvokeEvent) => {
      try {
        return await this.playlistService.getStats();
      } catch (error) {
        log.error('Failed to get playlist stats:', error);
        throw error;
      }
    });

    // ===== TEMPLATES =====

    ipcMain.handle('playlist:getTemplates', async (event: IpcMainInvokeEvent) => {
      try {
        return SMART_PLAYLIST_TEMPLATES;
      } catch (error) {
        log.error('Failed to get playlist templates:', error);
        throw error;
      }
    });

    log.info('Playlist IPC handlers registered successfully');
  }

  // Utility methods for batch operations
  async handleBatchOperation<T>(
    operation: string, 
    items: T[], 
    handler: (item: T) => Promise<any>
  ): Promise<{ results: any[]; errors: any[] }> {
    const results: any[] = [];
    const errors: any[] = [];

    for (const item of items) {
      try {
        const result = await handler(item);
        results.push(result);
      } catch (error) {
        log.error(`Batch operation ${operation} failed for item:`, item, error);
        errors.push({ item, error: error.message });
      }
    }

    return { results, errors };
  }

  // Register batch operations
  private registerBatchHandlers(): void {
    ipcMain.handle('playlist:batchCreate', async (
      event: IpcMainInvokeEvent,
      playlists: Partial<Playlist>[]
    ) => {
      return this.handleBatchOperation('create', playlists, async (playlist) => {
        return await this.playlistService.createPlaylist(playlist);
      });
    });

    ipcMain.handle('playlist:batchDelete', async (
      event: IpcMainInvokeEvent,
      playlistIds: string[]
    ) => {
      return this.handleBatchOperation('delete', playlistIds, async (id) => {
        await this.playlistService.deletePlaylist(id);
        return { id, deleted: true };
      });
    });

    ipcMain.handle('playlist:batchAddTracks', async (
      event: IpcMainInvokeEvent,
      operations: Array<{ playlistId: string; trackIds: number[] }>
    ) => {
      return this.handleBatchOperation('addTracks', operations, async (op) => {
        await this.playlistService.addTracksToPlaylist(op.playlistId, op.trackIds);
        return { playlistId: op.playlistId, tracksAdded: op.trackIds.length };
      });
    });
  }

  // Cleanup method
  cleanup(): void {
    // Remove all playlist-related IPC handlers
    const handlers = [
      'playlist:create', 'playlist:get', 'playlist:update', 'playlist:delete', 'playlist:getAll',
      'playlist:addTracks', 'playlist:removeTracks', 'playlist:reorderTracks', 'playlist:getTracks',
      'playlist:createSmart', 'playlist:updateSmart', 'playlist:createFromTemplate', 'playlist:updateAllSmart',
      'playlist:export', 'playlist:import',
      'playlist:createShare', 'playlist:getShare', 'playlist:getShares', 'playlist:revokeShare', 'playlist:cleanExpiredShares',
      'playlist:getStats', 'playlist:getTemplates',
      'playlist:batchCreate', 'playlist:batchDelete', 'playlist:batchAddTracks'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    log.info('Playlist IPC handlers cleaned up');
  }
}