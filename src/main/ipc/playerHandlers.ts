import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { MusicPlayerService, Track } from '../services/MusicPlayerService';

/**
 * Week 4 Day 2: Music Player IPC Handlers
 * 
 * Handles all music player-related IPC communication between
 * the renderer process and main process services.
 */

export function registerPlayerHandlers(musicPlayerService: MusicPlayerService) {
  // Get current player state
  ipcMain.handle('get-player-state', async () => {
    return musicPlayerService.getState();
  });
  
  // Play a track
  ipcMain.handle('player-play', async (
    event: IpcMainInvokeEvent,
    track: Track,
    addToQueue: boolean = true
  ) => {
    try {
      await musicPlayerService.playTrack(track, addToQueue);
      return true;
    } catch (error) {
      console.error('Failed to play track:', error);
      throw error;
    }
  });
  
  // Pause playback
  ipcMain.handle('player-pause', async () => {
    musicPlayerService.pause();
    return true;
  });
  
  // Resume playback
  ipcMain.handle('player-resume', async () => {
    musicPlayerService.resume();
    return true;
  });
  
  // Stop playback
  ipcMain.handle('player-stop', async () => {
    await musicPlayerService.stop();
    return true;
  });
  
  // Seek to time
  ipcMain.handle('player-seek', async (
    event: IpcMainInvokeEvent,
    time: number
  ) => {
    musicPlayerService.seek(time);
    return true;
  });
  
  // Set volume
  ipcMain.handle('player-set-volume', async (
    event: IpcMainInvokeEvent,
    volume: number
  ) => {
    musicPlayerService.setVolume(volume);
    return true;
  });
  
  // Play next track
  ipcMain.handle('player-next', async () => {
    try {
      await musicPlayerService.playNext();
      return true;
    } catch (error) {
      console.error('Failed to play next:', error);
      throw error;
    }
  });
  
  // Play previous track
  ipcMain.handle('player-previous', async () => {
    try {
      await musicPlayerService.playPrevious();
      return true;
    } catch (error) {
      console.error('Failed to play previous:', error);
      throw error;
    }
  });
  
  // Add track to queue
  ipcMain.handle('player-add-to-queue', async (
    event: IpcMainInvokeEvent,
    track: Track
  ) => {
    musicPlayerService.addToQueue(track);
    return true;
  });
  
  // Remove track from queue
  ipcMain.handle('player-remove-from-queue', async (
    event: IpcMainInvokeEvent,
    trackId: string
  ) => {
    musicPlayerService.removeFromQueue(trackId);
    return true;
  });
  
  // Clear queue
  ipcMain.handle('player-clear-queue', async () => {
    musicPlayerService.clearQueue();
    return true;
  });
  
  // Set repeat mode
  ipcMain.handle('player-set-repeat', async (
    event: IpcMainInvokeEvent,
    mode: 'none' | 'one' | 'all'
  ) => {
    musicPlayerService.setRepeat(mode);
    return true;
  });
  
  // Set shuffle mode
  ipcMain.handle('player-set-shuffle', async (
    event: IpcMainInvokeEvent,
    enabled: boolean
  ) => {
    musicPlayerService.setShuffle(enabled);
    return true;
  });
  
  // Preload track
  ipcMain.handle('player-preload-track', async (
    event: IpcMainInvokeEvent,
    track: Track
  ) => {
    try {
      await musicPlayerService.preloadTrack(track);
      return true;
    } catch (error) {
      console.error('Failed to preload track:', error);
      return false;
    }
  });
  
  // Set up event forwarding to renderer
  const broadcastToAllWindows = (channel: string, ...args: any[]) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send(channel, ...args);
    });
  };
  
  // Forward player events to renderer
  musicPlayerService.on('trackChange', (track) => {
    broadcastToAllWindows('track-change', track);
  });
  
  musicPlayerService.on('playStateChange', (isPlaying) => {
    broadcastToAllWindows('play-state-change', isPlaying);
  });
  
  musicPlayerService.on('timeUpdate', (currentTime) => {
    broadcastToAllWindows('time-update', currentTime);
  });
  
  musicPlayerService.on('durationChange', (duration) => {
    broadcastToAllWindows('duration-change', duration);
  });
  
  musicPlayerService.on('volumeChange', (volume) => {
    broadcastToAllWindows('volume-change', volume);
  });
  
  musicPlayerService.on('queueChange', (queue) => {
    broadcastToAllWindows('queue-change', queue);
  });
  
  musicPlayerService.on('repeatChange', (mode) => {
    broadcastToAllWindows('repeat-change', mode);
  });
  
  musicPlayerService.on('shuffleChange', (enabled) => {
    broadcastToAllWindows('shuffle-change', enabled);
  });
  
  musicPlayerService.on('playRecorded', (session) => {
    broadcastToAllWindows('play-recorded', session);
  });
  
  musicPlayerService.on('error', (error) => {
    broadcastToAllWindows('player-error', error);
  });
  
  musicPlayerService.on('canPlay', () => {
    broadcastToAllWindows('player-can-play');
  });
  
  // Global media key support (if available)
  if (process.platform === 'darwin') {
    // macOS media keys
    ipcMain.on('register-media-keys', () => {
      // This would integrate with macOS media key API
      console.log('Media keys registered for macOS');
    });
  } else if (process.platform === 'win32') {
    // Windows media keys
    ipcMain.on('register-media-keys', () => {
      // This would integrate with Windows media key API
      console.log('Media keys registered for Windows');
    });
  }
  
  console.log('✅ Music player IPC handlers registered');
}

// Helper function to initialize player service
export async function initializeMusicPlayerService(
  appDataPath: string,
  personalScoreService: any
): Promise<MusicPlayerService> {
  try {
    const musicPlayerService = new MusicPlayerService(personalScoreService);
    
    // Register IPC handlers
    registerPlayerHandlers(musicPlayerService);
    
    console.log('✅ Music player service initialized');
    return musicPlayerService;
  } catch (error) {
    console.error('Failed to initialize music player service:', error);
    throw error;
  }
}