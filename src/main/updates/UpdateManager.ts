import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { dialog } from 'electron';

export class UpdateManager extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  constructor() {
    super();
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
      this.emit('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      this.emit('update-available', info);
      this.promptUpdateDownload(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available');
      this.emit('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      log.error('Update error:', err);
      this.emit('error', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      log.info(logMessage);
      this.emit('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      this.emit('update-downloaded', info);
      this.promptUpdateInstall(info);
    });
  }

  async checkForUpdates(): Promise<void> {
    if (this.isChecking) return;
    
    try {
      this.isChecking = true;
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      log.error('Failed to check for updates:', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  startAutoCheck(intervalHours = 4): void {
    // Stop any existing interval
    this.stopAutoCheck();

    // Start new interval
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.checkInterval = setInterval(() => {
      this.checkForUpdates().catch((err) => {
        log.error('Auto update check failed:', err);
      });
    }, intervalMs);

    // Check immediately
    this.checkForUpdates().catch((err) => {
      log.error('Initial update check failed:', err);
    });
  }

  stopAutoCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      throw error;
    }
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  private async promptUpdateDownload(info: any): Promise<void> {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Would you like to download it now?`,
      detail: info.releaseNotes?.replace(/<[^>]*>/g, '') || 'New version available',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      await this.downloadUpdate();
    }
  }

  private async promptUpdateInstall(info: any): Promise<void> {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded. Install and restart now?`,
      detail: 'The application will restart to apply the update.',
      buttons: ['Install Now', 'Install on Quit'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      this.quitAndInstall();
    }
  }

  setFeedURL(url: string): void {
    autoUpdater.setFeedURL(url);
  }

  getCurrentVersion(): string {
    return autoUpdater.currentVersion.toString();
  }
}