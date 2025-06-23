import { test, expect } from '@playwright/test';
import { ElectronApp } from './helpers/electron-app';
import { TestUtils } from './helpers/test-utils';
import path from 'path';

test.describe('Plugin Installation', () => {
  let electronApp: ElectronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should install plugin from file', async () => {
    const window = electronApp.getWindow();
    
    // Create test plugin
    const pluginPath = await TestUtils.createTestPlugin('file-install-test');
    
    // Open plugin manager
    await window.click('[data-testid="menu-plugins"]');
    await window.click('[data-testid="manage-plugins"]');
    
    // Install plugin
    await window.click('[data-testid="install-plugin"]');
    
    // Handle file dialog
    const fileChooserPromise = window.waitForEvent('filechooser');
    await window.click('[data-testid="browse-plugin"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(pluginPath);
    
    // Confirm installation
    await window.click('[data-testid="confirm-install"]');
    
    // Wait for installation
    await expect(window.locator('[data-testid="plugin-file-install-test"]')).toBeVisible({
      timeout: 5000
    });
    
    // Check plugin is listed
    const pluginItem = window.locator('[data-testid="plugin-file-install-test"]');
    await expect(pluginItem.locator('[data-testid="plugin-name"]')).toContainText('Test file-install-test');
    await expect(pluginItem.locator('[data-testid="plugin-status"]')).toContainText('Enabled');
    
    // Check plugin UI element was added
    await expect(window.locator('#test-plugin-file-install-test')).toBeVisible();
  });

  test('should install plugin from URL', async () => {
    const window = electronApp.getWindow();
    
    // Mock plugin download
    await window.route('**/plugin.zip', async (route) => {
      // Create a simple plugin zip
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      
      zip.addFile('package.json', Buffer.from(JSON.stringify({
        id: 'url-install-test',
        name: 'url-install-test',
        displayName: 'URL Install Test',
        description: 'Plugin installed from URL',
        version: '1.0.0',
        main: './index.js'
      })));
      
      zip.addFile('index.js', Buffer.from(`
        module.exports = {
          activate: async (context) => {
            context.logger.info('URL plugin activated');
          }
        };
      `));
      
      route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: zip.toBuffer()
      });
    });

    // Open plugin manager
    await window.click('[data-testid="menu-plugins"]');
    await window.click('[data-testid="manage-plugins"]');
    
    // Install from URL
    await window.click('[data-testid="install-from-url"]');
    await window.fill('[data-testid="plugin-url"]', 'https://example.com/plugin.zip');
    await window.click('[data-testid="download-install"]');
    
    // Wait for installation
    await expect(window.locator('[data-testid="plugin-url-install-test"]')).toBeVisible({
      timeout: 10000
    });
  });

  test('should enable and disable plugins', async () => {
    const window = electronApp.getWindow();
    
    // Create and install test plugin
    const pluginPath = await TestUtils.createTestPlugin('toggle-test');
    await TestUtils.installTestPlugin(window, pluginPath);
    
    // Check plugin is enabled
    const pluginItem = window.locator('[data-testid="plugin-toggle-test"]');
    await expect(pluginItem.locator('[data-testid="plugin-status"]')).toContainText('Enabled');
    
    // Disable plugin
    await pluginItem.locator('[data-testid="disable-plugin"]').click();
    
    // Confirm disable
    await window.click('[data-testid="confirm-disable"]');
    
    // Check plugin is disabled
    await expect(pluginItem.locator('[data-testid="plugin-status"]')).toContainText('Disabled');
    
    // Check plugin UI element was removed
    await expect(window.locator('#test-plugin-toggle-test')).not.toBeVisible();
    
    // Re-enable plugin
    await pluginItem.locator('[data-testid="enable-plugin"]').click();
    
    // Check plugin is enabled again
    await expect(pluginItem.locator('[data-testid="plugin-status"]')).toContainText('Enabled');
    await expect(window.locator('#test-plugin-toggle-test')).toBeVisible();
  });

  test('should uninstall plugins', async () => {
    const window = electronApp.getWindow();
    
    // Create and install test plugin
    const pluginPath = await TestUtils.createTestPlugin('uninstall-test');
    await TestUtils.installTestPlugin(window, pluginPath);
    
    // Open plugin settings
    const pluginItem = window.locator('[data-testid="plugin-uninstall-test"]');
    await pluginItem.locator('[data-testid="plugin-settings"]').click();
    
    // Click uninstall
    await window.click('[data-testid="uninstall-plugin"]');
    
    // Confirm uninstall
    await window.click('[data-testid="confirm-uninstall"]');
    
    // Wait for removal
    await expect(window.locator('[data-testid="plugin-uninstall-test"]')).not.toBeVisible({
      timeout: 5000
    });
    
    // Verify plugin was removed from disk
    const pluginExists = await electronApp.evaluate((pluginId: string) => {
      const { app } = require('electron');
      const fs = require('fs');
      const path = require('path');
      
      const pluginDir = path.join(app.getPath('userData'), 'plugins', pluginId);
      return fs.existsSync(pluginDir);
    }, 'uninstall-test');
    
    expect(pluginExists).toBe(false);
  });

  test('should handle plugin permissions', async () => {
    const window = electronApp.getWindow();
    
    // Create plugin with specific permissions
    const pluginDir = path.join(__dirname, 'test-data', 'permission-test');
    await TestUtils.createTestPlugin('permission-test');
    
    // Modify to request network permission
    const fs = require('fs/promises');
    const packageJson = JSON.parse(
      await fs.readFile(path.join(pluginDir, 'package.json'), 'utf-8')
    );
    packageJson.permissions = ['network', 'hardware', 'system'];
    await fs.writeFile(
      path.join(pluginDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Install plugin
    await TestUtils.installTestPlugin(window, pluginDir);
    
    // Check permission dialog appeared
    await expect(window.locator('[data-testid="permission-dialog"]')).toBeVisible();
    
    // Check requested permissions
    const permissions = window.locator('[data-testid="requested-permission"]');
    await expect(permissions).toHaveCount(3);
    
    // Deny one permission
    await window.uncheck('[data-testid="permission-system"]');
    
    // Accept with limited permissions
    await window.click('[data-testid="accept-permissions"]');
    
    // Verify plugin has limited permissions
    const hasSystemPermission = await electronApp.invokeIPC(
      'plugin:hasPermission',
      'permission-test',
      'system'
    );
    expect(hasSystemPermission).toBe(false);
  });

  test('should update plugins', async () => {
    const window = electronApp.getWindow();
    
    // Install initial version
    const pluginPath = await TestUtils.createTestPlugin('update-test');
    await TestUtils.installTestPlugin(window, pluginPath);
    
    // Mock update check
    await window.route('**/plugin-updates**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          'update-test': {
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            updateUrl: 'https://example.com/update-test-v2.zip',
            changelog: 'New features and bug fixes'
          }
        })
      });
    });

    // Check for updates
    await window.click('[data-testid="menu-plugins"]');
    await window.click('[data-testid="check-plugin-updates"]');
    
    // Wait for update notification
    await expect(window.locator('[data-testid="update-available"]')).toBeVisible();
    
    // View update details
    const pluginItem = window.locator('[data-testid="plugin-update-test"]');
    await expect(pluginItem.locator('[data-testid="update-badge"]')).toBeVisible();
    
    // Update plugin
    await pluginItem.locator('[data-testid="update-plugin"]').click();
    
    // Check changelog
    await expect(window.locator('[data-testid="update-changelog"]')).toContainText('New features and bug fixes');
    
    // Confirm update
    await window.click('[data-testid="confirm-update"]');
    
    // Wait for update to complete
    await expect(pluginItem.locator('[data-testid="plugin-version"]')).toContainText('2.0.0', {
      timeout: 10000
    });
  });

  test('should validate plugin manifest', async () => {
    const window = electronApp.getWindow();
    
    // Create invalid plugin
    const pluginDir = path.join(__dirname, 'test-data', 'invalid-plugin');
    const fs = require('fs/promises');
    await fs.mkdir(pluginDir, { recursive: true });
    
    // Invalid manifest (missing required fields)
    await fs.writeFile(
      path.join(pluginDir, 'package.json'),
      JSON.stringify({
        name: 'invalid-plugin'
        // Missing: id, version, main
      })
    );

    // Try to install
    await window.click('[data-testid="menu-plugins"]');
    await window.click('[data-testid="manage-plugins"]');
    await window.click('[data-testid="install-plugin"]');
    
    const fileChooserPromise = window.waitForEvent('filechooser');
    await window.click('[data-testid="browse-plugin"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(pluginDir);
    
    // Should show validation error
    await expect(window.locator('[data-testid="plugin-error"]')).toBeVisible();
    await expect(window.locator('[data-testid="plugin-error"]')).toContainText('Invalid plugin manifest');
  });

  test('should handle plugin conflicts', async () => {
    const window = electronApp.getWindow();
    
    // Install first plugin
    const plugin1 = await TestUtils.createTestPlugin('conflict-test');
    await TestUtils.installTestPlugin(window, plugin1);
    
    // Try to install plugin with same ID
    const plugin2Dir = path.join(__dirname, 'test-data', 'conflict-test-2');
    await TestUtils.createTestPlugin('conflict-test-2');
    
    // Modify to have same ID as first plugin
    const fs = require('fs/promises');
    const packageJson = JSON.parse(
      await fs.readFile(path.join(plugin2Dir, 'package.json'), 'utf-8')
    );
    packageJson.id = 'conflict-test'; // Same ID as first plugin
    await fs.writeFile(
      path.join(plugin2Dir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Try to install
    await window.click('[data-testid="install-plugin"]');
    
    const fileChooserPromise = window.waitForEvent('filechooser');
    await window.click('[data-testid="browse-plugin"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(plugin2Dir);
    
    await window.click('[data-testid="confirm-install"]');
    
    // Should show conflict dialog
    await expect(window.locator('[data-testid="plugin-conflict"]')).toBeVisible();
    await expect(window.locator('[data-testid="conflict-message"]')).toContainText('already installed');
    
    // Option to replace
    await window.click('[data-testid="replace-plugin"]');
    
    // Check original was replaced
    const pluginItem = window.locator('[data-testid="plugin-conflict-test"]');
    await expect(pluginItem.locator('[data-testid="plugin-name"]')).toContainText('Test conflict-test-2');
  });

  test('should support plugin marketplace', async () => {
    const window = electronApp.getWindow();
    
    // Mock marketplace API
    await window.route('**/marketplace/plugins**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plugins: [
            {
              id: 'popular-plugin',
              name: 'Popular Plugin',
              description: 'A very popular plugin',
              author: 'Test Author',
              downloads: 10000,
              rating: 4.5,
              version: '3.0.0'
            },
            {
              id: 'new-plugin',
              name: 'New Plugin',
              description: 'A brand new plugin',
              author: 'Another Author',
              downloads: 100,
              rating: 5.0,
              version: '1.0.0'
            }
          ]
        })
      });
    });

    // Open marketplace
    await window.click('[data-testid="menu-plugins"]');
    await window.click('[data-testid="plugin-marketplace"]');
    
    // Check plugins listed
    await expect(window.locator('[data-testid="marketplace-plugin"]')).toHaveCount(2);
    
    // Search marketplace
    await window.fill('[data-testid="marketplace-search"]', 'popular');
    await window.press('[data-testid="marketplace-search"]', 'Enter');
    
    // Check filtered results
    await expect(window.locator('[data-testid="marketplace-plugin"]')).toHaveCount(1);
    
    // Install from marketplace
    const popularPlugin = window.locator('[data-testid="marketplace-plugin-popular-plugin"]');
    await popularPlugin.locator('[data-testid="install-from-marketplace"]').click();
    
    // Confirm installation
    await window.click('[data-testid="confirm-marketplace-install"]');
    
    // Wait for installation
    await expect(window.locator('[data-testid="plugin-popular-plugin"]')).toBeVisible({
      timeout: 10000
    });
  });
});