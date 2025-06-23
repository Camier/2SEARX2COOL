import { ipcMain } from 'electron';
import log from 'electron-log';

export async function cleanupIPC(): Promise<void> {
  try {
    // Remove all IPC listeners
    ipcMain.removeAllListeners();
    log.info('IPC handlers cleaned up');
  } catch (error) {
    log.error('Failed to cleanup IPC handlers:', error);
  }
}