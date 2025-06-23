import { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

export class TestUtils {
  static async waitForSearch(page: Page, query: string) {
    // Type search query
    await page.fill('[data-testid="search-input"]', query);
    
    // Submit search
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', {
      state: 'visible',
      timeout: 10000
    });
  }

  static async installTestPlugin(page: Page, pluginPath: string) {
    // Open plugin manager
    await page.click('[data-testid="menu-plugins"]');
    
    // Click install button
    await page.click('[data-testid="install-plugin"]');
    
    // Select plugin file
    await page.setInputFiles('[data-testid="plugin-file-input"]', pluginPath);
    
    // Wait for installation
    await page.waitForSelector('[data-testid="plugin-installed"]', {
      timeout: 5000
    });
  }

  static async createTestPlugin(name: string): Promise<string> {
    const pluginDir = path.join(__dirname, '../test-data', name);
    await fs.mkdir(pluginDir, { recursive: true });

    // Create package.json
    await fs.writeFile(
      path.join(pluginDir, 'package.json'),
      JSON.stringify({
        id: name,
        name: name,
        displayName: `Test ${name}`,
        description: 'E2E test plugin',
        version: '1.0.0',
        main: './index.js',
        permissions: ['ui', 'cache']
      }, null, 2)
    );

    // Create index.js
    await fs.writeFile(
      path.join(pluginDir, 'index.js'),
      `
module.exports = {
  activate: async (context) => {
    context.logger.info('${name} activated');
    
    // Add test UI element
    const testDiv = document.createElement('div');
    testDiv.id = 'test-plugin-${name}';
    testDiv.textContent = 'Test Plugin ${name} Active';
    testDiv.style.position = 'fixed';
    testDiv.style.bottom = '10px';
    testDiv.style.right = '10px';
    testDiv.style.padding = '10px';
    testDiv.style.background = '#4CAF50';
    testDiv.style.color = 'white';
    testDiv.style.borderRadius = '5px';
    testDiv.style.zIndex = '9999';
    document.body.appendChild(testDiv);
    
    await context.store.set('activated', true);
  },
  
  deactivate: async () => {
    const testDiv = document.getElementById('test-plugin-${name}');
    if (testDiv) {
      testDiv.remove();
    }
  }
};
`
    );

    return pluginDir;
  }

  static async mockSearchResults(page: Page, results: any[]) {
    await page.route('**/search**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: results,
          suggestions: [],
          engines: ['mock'],
          query: route.request().url().includes('q=') 
            ? new URL(route.request().url()).searchParams.get('q') 
            : ''
        })
      });
    });
  }

  static async checkOfflineMode(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return window.navigator.onLine === false;
    });
  }

  static async waitForNotification(page: Page, text: string) {
    await page.waitForSelector(`[data-testid="notification"]:has-text("${text}")`, {
      timeout: 5000
    });
  }

  static async clearAppData(electronApp: any) {
    await electronApp.evaluate(async () => {
      const { session } = require('electron');
      await session.defaultSession.clearStorageData();
      await session.defaultSession.clearCache();
    });
  }
}