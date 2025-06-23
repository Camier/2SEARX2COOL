import { test, expect } from '@playwright/test';
import { ElectronApp } from './helpers/electron-app';

test.describe('Settings', () => {
  let electronApp: ElectronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should open settings window', async () => {
    const window = electronApp.getWindow();
    
    // Open settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    
    // Check settings window opened
    await expect(window.locator('[data-testid="settings-window"]')).toBeVisible();
    
    // Check tabs
    await expect(window.locator('[data-testid="settings-tab-general"]')).toBeVisible();
    await expect(window.locator('[data-testid="settings-tab-appearance"]')).toBeVisible();
    await expect(window.locator('[data-testid="settings-tab-search"]')).toBeVisible();
    await expect(window.locator('[data-testid="settings-tab-privacy"]')).toBeVisible();
    await expect(window.locator('[data-testid="settings-tab-advanced"]')).toBeVisible();
  });

  test('should change theme', async () => {
    const window = electronApp.getWindow();
    
    // Open appearance settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-appearance"]');
    
    // Check current theme
    const isDarkTheme = await window.evaluate(() => 
      document.documentElement.classList.contains('dark-theme')
    );
    
    // Change theme
    if (isDarkTheme) {
      await window.click('[data-testid="theme-light"]');
    } else {
      await window.click('[data-testid="theme-dark"]');
    }
    
    // Apply changes
    await window.click('[data-testid="apply-settings"]');
    
    // Check theme changed
    const newTheme = await window.evaluate(() => 
      document.documentElement.classList.contains('dark-theme')
    );
    expect(newTheme).toBe(!isDarkTheme);
  });

  test('should change language', async () => {
    const window = electronApp.getWindow();
    
    // Open general settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    
    // Select language
    await window.selectOption('[data-testid="language-select"]', 'es');
    
    // Apply changes
    await window.click('[data-testid="apply-settings"]');
    
    // Check UI updated to Spanish
    await window.waitForTimeout(1000); // Wait for language change
    await expect(window.locator('[data-testid="search-button"]')).toContainText('Buscar');
  });

  test('should configure search engines', async () => {
    const window = electronApp.getWindow();
    
    // Open search settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-search"]');
    
    // Disable some engines
    await window.uncheck('[data-testid="engine-setting-bing"]');
    await window.uncheck('[data-testid="engine-setting-yahoo"]');
    
    // Set default engine
    await window.selectOption('[data-testid="default-engine"]', 'duckduckgo');
    
    // Configure result limits
    await window.fill('[data-testid="results-per-page"]', '50');
    
    // Apply changes
    await window.click('[data-testid="apply-settings"]');
    
    // Verify settings applied
    const settings = await electronApp.invokeIPC('pref:get', 'search');
    expect(settings.disabledEngines).toContain('bing');
    expect(settings.disabledEngines).toContain('yahoo');
    expect(settings.defaultEngine).toBe('duckduckgo');
    expect(settings.resultsPerPage).toBe(50);
  });

  test('should configure privacy settings', async () => {
    const window = electronApp.getWindow();
    
    // Open privacy settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-privacy"]');
    
    // Configure privacy options
    await window.check('[data-testid="disable-telemetry"]');
    await window.check('[data-testid="clear-cache-on-exit"]');
    await window.uncheck('[data-testid="save-search-history"]');
    
    // Configure cache size
    await window.fill('[data-testid="max-cache-size"]', '100');
    
    // Apply changes
    await window.click('[data-testid="apply-settings"]');
    
    // Verify settings
    const privacy = await electronApp.invokeIPC('pref:get', 'privacy');
    expect(privacy.telemetryEnabled).toBe(false);
    expect(privacy.clearCacheOnExit).toBe(true);
    expect(privacy.saveSearchHistory).toBe(false);
    expect(privacy.maxCacheSize).toBe(100);
  });

  test('should configure keyboard shortcuts', async () => {
    const window = electronApp.getWindow();
    
    // Open advanced settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-advanced"]');
    
    // Open shortcuts configuration
    await window.click('[data-testid="configure-shortcuts"]');
    
    // Change search shortcut
    const searchShortcut = window.locator('[data-testid="shortcut-search"]');
    await searchShortcut.click();
    await searchShortcut.press('Control+Shift+F');
    
    // Apply changes
    await window.click('[data-testid="save-shortcuts"]');
    
    // Test new shortcut
    await window.press('body', 'Control+Shift+F');
    const searchFocused = await window.evaluate(() => 
      document.activeElement?.getAttribute('data-testid') === 'search-input'
    );
    expect(searchFocused).toBe(true);
  });

  test('should export and import settings', async () => {
    const window = electronApp.getWindow();
    
    // Open advanced settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-advanced"]');
    
    // Export settings
    const [download] = await Promise.all([
      window.waitForEvent('download'),
      window.click('[data-testid="export-settings"]')
    ]);
    
    expect(download.suggestedFilename()).toContain('settings');
    expect(download.suggestedFilename()).toContain('.json');
    
    // Save downloaded file path
    const downloadPath = await download.path();
    
    // Reset settings to defaults
    await window.click('[data-testid="reset-settings"]');
    await window.click('[data-testid="confirm-reset"]');
    
    // Import settings back
    const fileChooserPromise = window.waitForEvent('filechooser');
    await window.click('[data-testid="import-settings"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(downloadPath!);
    
    // Verify import success
    await expect(window.locator('[data-testid="import-success"]')).toBeVisible();
  });

  test('should configure auto-update settings', async () => {
    const window = electronApp.getWindow();
    
    // Open general settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    
    // Configure auto-update
    await window.check('[data-testid="auto-update-enabled"]');
    await window.selectOption('[data-testid="update-channel"]', 'beta');
    await window.check('[data-testid="auto-download-updates"]');
    
    // Apply changes
    await window.click('[data-testid="apply-settings"]');
    
    // Check for updates manually
    await window.click('[data-testid="check-updates-now"]');
    
    // Wait for update check
    await expect(window.locator('[data-testid="update-status"]')).toBeVisible();
  });

  test('should configure proxy settings', async () => {
    const window = electronApp.getWindow();
    
    // Open advanced settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-advanced"]');
    
    // Enable proxy
    await window.check('[data-testid="use-proxy"]');
    
    // Configure proxy
    await window.selectOption('[data-testid="proxy-type"]', 'http');
    await window.fill('[data-testid="proxy-host"]', '127.0.0.1');
    await window.fill('[data-testid="proxy-port"]', '8080');
    
    // Add authentication
    await window.check('[data-testid="proxy-auth"]');
    await window.fill('[data-testid="proxy-username"]', 'testuser');
    await window.fill('[data-testid="proxy-password"]', 'testpass');
    
    // Apply changes
    await window.click('[data-testid="apply-settings"]');
    
    // Test proxy connection
    await window.click('[data-testid="test-proxy"]');
    await expect(window.locator('[data-testid="proxy-status"]')).toBeVisible();
  });

  test('should manage data and storage', async () => {
    const window = electronApp.getWindow();
    
    // Open privacy settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    await window.click('[data-testid="settings-tab-privacy"]');
    
    // Check storage usage
    await window.click('[data-testid="view-storage"]');
    await expect(window.locator('[data-testid="storage-breakdown"]')).toBeVisible();
    
    // Clear specific data
    await window.click('[data-testid="manage-data"]');
    await window.check('[data-testid="clear-search-history"]');
    await window.check('[data-testid="clear-cache"]');
    await window.uncheck('[data-testid="clear-preferences"]');
    
    // Clear selected data
    await window.click('[data-testid="clear-selected-data"]');
    await window.click('[data-testid="confirm-clear"]');
    
    // Verify data cleared
    await expect(window.locator('[data-testid="data-cleared"]')).toBeVisible();
    
    // Check storage reduced
    const newSize = await window.locator('[data-testid="cache-size"]').textContent();
    expect(newSize).toContain('0');
  });

  test('should handle invalid settings gracefully', async () => {
    const window = electronApp.getWindow();
    
    // Open settings
    await window.click('[data-testid="menu-settings"]');
    await window.click('[data-testid="preferences"]');
    
    // Enter invalid values
    await window.click('[data-testid="settings-tab-search"]');
    await window.fill('[data-testid="results-per-page"]', '-10'); // Invalid
    
    // Try to apply
    await window.click('[data-testid="apply-settings"]');
    
    // Check validation error
    await expect(window.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(window.locator('[data-testid="validation-error"]')).toContainText('must be positive');
    
    // Fix value
    await window.fill('[data-testid="results-per-page"]', '20');
    await window.click('[data-testid="apply-settings"]');
    
    // Should succeed now
    await expect(window.locator('[data-testid="settings-saved"]')).toBeVisible();
  });
});