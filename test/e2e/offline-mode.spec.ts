import { test, expect } from '@playwright/test';
import { ElectronApp } from './helpers/electron-app';
import { TestUtils } from './helpers/test-utils';

test.describe('Offline Mode', () => {
  let electronApp: ElectronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should detect offline status', async () => {
    const window = electronApp.getWindow();
    
    // Go offline
    await window.context().setOffline(true);
    
    // Wait for offline detection
    await window.waitForTimeout(1000);
    
    // Check offline indicator
    await expect(window.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(window.locator('[data-testid="connection-status"]')).toContainText('Offline');
  });

  test('should use cached results when offline', async () => {
    const window = electronApp.getWindow();
    
    // First, perform search while online to cache results
    await TestUtils.mockSearchResults(window, [
      {
        id: '1',
        title: 'Cached Result',
        url: 'https://example.com/cached',
        snippet: 'This will be cached',
        source: 'Test',
        engine: 'google'
      }
    ]);
    
    await TestUtils.waitForSearch(window, 'cache test');
    
    // Verify results are cached
    const cacheStats = await electronApp.invokeIPC('cache:stats');
    expect(cacheStats.entries).toBeGreaterThan(0);
    
    // Go offline
    await window.context().setOffline(true);
    await window.waitForTimeout(1000);
    
    // Search again
    await TestUtils.waitForSearch(window, 'cache test');
    
    // Should show cached results
    await expect(window.locator('[data-testid="cached-indicator"]')).toBeVisible();
    await expect(window.locator('[data-testid="search-result"]')).toHaveCount(1);
    await expect(window.locator('[data-testid="result-title"]')).toContainText('Cached Result');
  });

  test('should save searches for later sync', async () => {
    const window = electronApp.getWindow();
    
    // Go offline
    await window.context().setOffline(true);
    await window.waitForTimeout(1000);
    
    // Perform searches
    await window.fill('[data-testid="search-input"]', 'offline search 1');
    await window.press('[data-testid="search-input"]', 'Enter');
    await window.waitForTimeout(500);
    
    await window.fill('[data-testid="search-input"]', 'offline search 2');
    await window.press('[data-testid="search-input"]', 'Enter');
    
    // Should show pending sync indicator
    await expect(window.locator('[data-testid="pending-sync"]')).toBeVisible();
    await expect(window.locator('[data-testid="pending-count"]')).toContainText('2');
    
    // Go back online
    await window.context().setOffline(false);
    await window.waitForTimeout(2000);
    
    // Should sync automatically
    await expect(window.locator('[data-testid="sync-complete"]')).toBeVisible();
    await expect(window.locator('[data-testid="pending-sync"]')).not.toBeVisible();
  });

  test('should work with local plugins offline', async () => {
    const window = electronApp.getWindow();
    
    // Install a test plugin
    const pluginPath = await TestUtils.createTestPlugin('offline-plugin');
    await TestUtils.installTestPlugin(window, pluginPath);
    
    // Go offline
    await window.context().setOffline(true);
    await window.waitForTimeout(1000);
    
    // Plugin should still work
    await expect(window.locator('#test-plugin-offline-plugin')).toBeVisible();
    
    // Test plugin functionality
    await window.click('#test-plugin-offline-plugin');
    
    // Plugin actions should work offline
    const pluginData = await electronApp.invokeIPC(
      'plugin:getData',
      'offline-plugin',
      'activated'
    );
    expect(pluginData).toBe(true);
  });

  test('should queue plugin updates when offline', async () => {
    const window = electronApp.getWindow();
    
    // Mock update check that will fail offline
    await window.route('**/plugin-updates**', (route) => {
      if (navigator.onLine) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            'test-plugin': {
              currentVersion: '1.0.0',
              latestVersion: '2.0.0',
              updateUrl: 'https://example.com/update.zip'
            }
          })
        });
      } else {
        route.abort('connectionfailed');
      }
    });

    // Go offline
    await window.context().setOffline(true);
    
    // Try to check for updates
    await window.click('[data-testid="menu-plugins"]');
    await window.click('[data-testid="check-plugin-updates"]');
    
    // Should show offline message
    await expect(window.locator('[data-testid="updates-offline"]')).toBeVisible();
    
    // Should queue update check
    await expect(window.locator('[data-testid="update-check-queued"]')).toBeVisible();
    
    // Go back online
    await window.context().setOffline(false);
    await window.waitForTimeout(2000);
    
    // Should automatically check for updates
    await expect(window.locator('[data-testid="update-available"]')).toBeVisible();
  });

  test('should handle offline mode settings', async () => {
    const window = electronApp.getWindow();
    
    // Open settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-advanced"]');
    
    // Configure offline mode
    await window.check('[data-testid="aggressive-caching"]');
    await window.fill('[data-testid="offline-cache-size"]', '500'); // MB
    await window.check('[data-testid="preload-common-searches"]');
    
    // Apply settings
    await window.click('[data-testid="apply-settings"]');
    
    // Test preloading
    await window.click('[data-testid="preload-now"]');
    await expect(window.locator('[data-testid="preloading-progress"]')).toBeVisible();
    
    // Wait for preloading
    await window.waitForSelector('[data-testid="preload-complete"]', {
      timeout: 30000
    });
    
    // Go offline and test preloaded content
    await window.context().setOffline(true);
    
    // Common searches should work offline
    const commonSearches = ['javascript', 'python', 'react', 'nodejs'];
    for (const query of commonSearches) {
      await TestUtils.waitForSearch(window, query);
      await expect(window.locator('[data-testid="search-result"]').first()).toBeVisible();
    }
  });

  test('should export data for offline use', async () => {
    const window = electronApp.getWindow();
    
    // Perform some searches to build history
    const searches = ['export test 1', 'export test 2', 'export test 3'];
    for (const query of searches) {
      await TestUtils.waitForSearch(window, query);
      await window.waitForTimeout(500);
    }
    
    // Create a playlist
    await window.click('[data-testid="create-playlist"]');
    await window.fill('[data-testid="playlist-name"]', 'Offline Playlist');
    await window.click('[data-testid="save-playlist"]');
    
    // Export for offline
    await window.click('[data-testid="menu-file"]');
    await window.click('[data-testid="export-offline-data"]');
    
    // Configure export
    await window.check('[data-testid="export-search-history"]');
    await window.check('[data-testid="export-playlists"]');
    await window.check('[data-testid="export-cached-results"]');
    
    // Export
    const [download] = await Promise.all([
      window.waitForEvent('download'),
      window.click('[data-testid="export-offline-bundle"]')
    ]);
    
    expect(download.suggestedFilename()).toContain('offline-bundle');
    expect(download.suggestedFilename()).toContain('.2searx');
  });

  test('should handle network errors gracefully', async () => {
    const window = electronApp.getWindow();
    
    // Mock network errors
    await window.route('**/search**', (route) => {
      route.abort('connectionfailed');
    });

    // Try to search
    await window.fill('[data-testid="search-input"]', 'network error test');
    await window.press('[data-testid="search-input"]', 'Enter');
    
    // Should show network error
    await expect(window.locator('[data-testid="network-error"]')).toBeVisible();
    
    // Should offer offline mode
    await expect(window.locator('[data-testid="use-offline-mode"]')).toBeVisible();
    
    // Switch to offline mode
    await window.click('[data-testid="use-offline-mode"]');
    
    // Should show offline UI
    await expect(window.locator('[data-testid="offline-mode-active"]')).toBeVisible();
  });

  test('should sync settings when coming back online', async () => {
    const window = electronApp.getWindow();
    
    // Go offline
    await window.context().setOffline(true);
    await window.waitForTimeout(1000);
    
    // Change settings while offline
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    
    // Change theme
    await window.click('[data-testid="settings-tab-appearance"]');
    await window.click('[data-testid="theme-dark"]');
    await window.click('[data-testid="apply-settings"]');
    
    // Settings should be queued for sync
    await expect(window.locator('[data-testid="settings-pending-sync"]')).toBeVisible();
    
    // Go back online
    await window.context().setOffline(false);
    await window.waitForTimeout(2000);
    
    // Should sync settings
    await expect(window.locator('[data-testid="settings-synced"]')).toBeVisible();
    
    // Verify settings persisted
    const theme = await electronApp.invokeIPC('pref:get', 'theme');
    expect(theme).toBe('dark');
  });

  test('should handle offline-first database operations', async () => {
    const window = electronApp.getWindow();
    
    // Go offline
    await window.context().setOffline(true);
    
    // Database operations should still work
    
    // Save search
    await window.fill('[data-testid="search-input"]', 'offline database test');
    await window.press('[data-testid="search-input"]', 'Enter');
    
    // Create playlist
    await window.click('[data-testid="create-playlist"]');
    await window.fill('[data-testid="playlist-name"]', 'Offline Created');
    await window.click('[data-testid="save-playlist"]');
    
    // Add to favorites
    await window.click('[data-testid="menu-favorites"]');
    await window.click('[data-testid="add-favorite"]');
    await window.fill('[data-testid="favorite-name"]', 'Offline Favorite');
    await window.fill('[data-testid="favorite-url"]', 'https://example.com');
    await window.click('[data-testid="save-favorite"]');
    
    // All operations should succeed
    await expect(window.locator('[data-testid="playlist-created"]')).toBeVisible();
    await expect(window.locator('[data-testid="favorite-added"]')).toBeVisible();
    
    // Verify data persisted locally
    const playlists = await electronApp.invokeIPC('db:getPlaylists');
    expect(playlists.some(p => p.name === 'Offline Created')).toBe(true);
  });
});