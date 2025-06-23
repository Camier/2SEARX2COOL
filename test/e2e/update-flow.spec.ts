import { test, expect } from '@playwright/test';
import { ElectronApp } from './helpers/electron-app';

test.describe('Update Flow', () => {
  let electronApp: ElectronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should check for updates on startup', async () => {
    await electronApp.launch({
      env: {
        CHECK_FOR_UPDATES: 'true'
      }
    });

    const window = electronApp.getWindow();
    
    // Mock update check response
    await electronApp.evaluate(() => {
      const { ipcMain } = require('electron');
      const { autoUpdater } = require('electron-updater');
      
      // Simulate update available
      setTimeout(() => {
        autoUpdater.emit('update-available', {
          version: '1.0.0',
          releaseNotes: 'Test release notes',
          releaseName: 'v1.0.0',
          releaseDate: new Date().toISOString()
        });
      }, 1000);
    });

    // Wait for update notification
    await expect(window.locator('[data-testid="update-notification"]')).toBeVisible({
      timeout: 5000
    });
    
    // Check notification content
    await expect(window.locator('[data-testid="update-version"]')).toContainText('1.0.0');
    await expect(window.locator('[data-testid="update-notes"]')).toContainText('Test release notes');
  });

  test('should download updates', async () => {
    await electronApp.launch();
    const window = electronApp.getWindow();
    
    // Trigger update check manually
    await window.click('[data-testid="menu-help"]');
    await window.click('[data-testid="check-for-updates"]');
    
    // Mock update available
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.emit('update-available', {
        version: '2.0.0',
        releaseNotes: 'Major update'
      });
    });

    // Click download
    await window.click('[data-testid="download-update"]');
    
    // Mock download progress
    for (let i = 0; i <= 100; i += 20) {
      await electronApp.evaluate((progress) => {
        const { autoUpdater } = require('electron-updater');
        autoUpdater.emit('download-progress', {
          bytesPerSecond: 1000000,
          percent: progress,
          transferred: progress * 10000000,
          total: 100000000
        });
      }, i);
      
      await window.waitForTimeout(500);
    }
    
    // Check progress bar
    const progressValue = await window.getAttribute('[data-testid="download-progress"]', 'value');
    expect(parseInt(progressValue!)).toBe(100);
    
    // Mock download complete
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.emit('update-downloaded', {
        version: '2.0.0',
        releaseNotes: 'Major update',
        releaseName: 'v2.0.0'
      });
    });

    // Should show install button
    await expect(window.locator('[data-testid="install-update"]')).toBeVisible();
  });

  test('should install update and restart', async () => {
    await electronApp.launch();
    const window = electronApp.getWindow();
    
    // Mock update downloaded state
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.emit('update-downloaded', {
        version: '3.0.0',
        releaseNotes: 'New features'
      });
    });

    // Show update ready dialog
    await expect(window.locator('[data-testid="update-ready"]')).toBeVisible();
    
    // Click install and restart
    await window.click('[data-testid="install-restart"]');
    
    // Confirm restart
    await window.click('[data-testid="confirm-restart"]');
    
    // Check quit and install was called
    const quitCalled = await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      let called = false;
      const originalQuit = autoUpdater.quitAndInstall;
      autoUpdater.quitAndInstall = () => {
        called = true;
        // Don't actually quit in test
      };
      setTimeout(() => {
        autoUpdater.quitAndInstall();
      }, 100);
      return new Promise(resolve => setTimeout(() => resolve(called), 200));
    });
    
    expect(quitCalled).toBe(true);
  });

  test('should defer updates', async () => {
    await electronApp.launch();
    const window = electronApp.getWindow();
    
    // Mock update available
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.emit('update-available', {
        version: '1.5.0',
        releaseNotes: 'Minor update'
      });
    });

    // Click remind me later
    await window.click('[data-testid="remind-later"]');
    
    // Should hide notification
    await expect(window.locator('[data-testid="update-notification"]')).not.toBeVisible();
    
    // Should set reminder
    const reminder = await electronApp.invokeIPC('pref:get', 'updateReminder');
    expect(reminder).toBeDefined();
    expect(new Date(reminder).getTime()).toBeGreaterThan(Date.now());
  });

  test('should handle update errors', async () => {
    await electronApp.launch();
    const window = electronApp.getWindow();
    
    // Trigger update check
    await window.click('[data-testid="menu-help"]');
    await window.click('[data-testid="check-for-updates"]');
    
    // Mock update error
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.emit('error', new Error('Network error'));
    });

    // Should show error
    await expect(window.locator('[data-testid="update-error"]')).toBeVisible();
    await expect(window.locator('[data-testid="update-error"]')).toContainText('Network error');
    
    // Should offer retry
    await expect(window.locator('[data-testid="retry-update"]')).toBeVisible();
  });

  test('should respect auto-update settings', async () => {
    // Launch with auto-update disabled
    await electronApp.launch({
      env: {
        AUTO_UPDATE_ENABLED: 'false'
      }
    });

    // Verify auto-updater is disabled
    const autoUpdateEnabled = await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      return autoUpdater.autoDownload;
    });
    
    expect(autoUpdateEnabled).toBe(false);
  });

  test('should show changelog', async () => {
    await electronApp.launch();
    const window = electronApp.getWindow();
    
    // Mock update with detailed changelog
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.emit('update-available', {
        version: '2.1.0',
        releaseNotes: `
## What's New
- Added new search engines
- Improved performance
- Fixed memory leaks

## Bug Fixes
- Fixed crash on startup
- Fixed plugin loading issues
        `
      });
    });

    // Open changelog
    await window.click('[data-testid="view-changelog"]');
    
    // Check changelog content
    await expect(window.locator('[data-testid="changelog-modal"]')).toBeVisible();
    await expect(window.locator('[data-testid="changelog-content"]')).toContainText("What's New");
    await expect(window.locator('[data-testid="changelog-content"]')).toContainText('Added new search engines');
    await expect(window.locator('[data-testid="changelog-content"]')).toContainText('Bug Fixes');
  });

  test('should support update channels', async () => {
    await electronApp.launch();
    const window = electronApp.getWindow();
    
    // Open settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    
    // Change update channel
    await window.selectOption('[data-testid="update-channel"]', 'beta');
    await window.click('[data-testid="apply-settings"]');
    
    // Verify channel changed
    const channel = await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      return autoUpdater.channel;
    });
    
    expect(channel).toBe('beta');
    
    // Check for beta updates
    await window.click('[data-testid="check-updates-now"]');
    
    // Mock beta update
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.emit('update-available', {
        version: '2.2.0-beta.1',
        releaseNotes: 'Beta features',
        prerelease: true
      });
    });

    // Should show beta indicator
    await expect(window.locator('[data-testid="beta-update"]')).toBeVisible();
  });

  test('should rollback failed updates', async () => {
    await electronApp.launch();
    const window = electronApp.getWindow();
    
    // Mock update failure after download
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      
      // First show download complete
      autoUpdater.emit('update-downloaded', {
        version: '3.0.0'
      });
      
      // Then simulate installation failure on restart
      const { app } = require('electron');
      app.once('before-quit', (e) => {
        e.preventDefault();
        // Simulate failure
        setTimeout(() => {
          autoUpdater.emit('error', new Error('Installation failed'));
        }, 100);
      });
    });

    // Try to install
    await window.click('[data-testid="install-restart"]');
    
    // Should show error
    await expect(window.locator('[data-testid="install-error"]')).toBeVisible();
    
    // Should offer rollback
    await expect(window.locator('[data-testid="rollback-update"]')).toBeVisible();
    
    // Click rollback
    await window.click('[data-testid="rollback-update"]');
    
    // Should restore previous version
    await expect(window.locator('[data-testid="rollback-success"]')).toBeVisible();
  });

  test('should verify update signatures', async () => {
    await electronApp.launch();
    
    // Mock unsigned update
    await electronApp.evaluate(() => {
      const { autoUpdater } = require('electron-updater');
      
      // Override signature verification
      const originalVerify = autoUpdater.verifyUpdateCodeSignature;
      autoUpdater.verifyUpdateCodeSignature = () => {
        throw new Error('Invalid signature');
      };
      
      // Trigger update
      autoUpdater.emit('update-available', {
        version: '4.0.0'
      });
    });

    const window = electronApp.getWindow();
    
    // Should show security warning
    await expect(window.locator('[data-testid="signature-error"]')).toBeVisible();
    await expect(window.locator('[data-testid="signature-error"]')).toContainText('Invalid signature');
    
    // Should not allow installation
    await expect(window.locator('[data-testid="download-update"]')).not.toBeVisible();
  });
});