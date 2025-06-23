import { test, expect } from '@playwright/test';
import { ElectronApp } from './helpers/electron-app';
import { TestUtils } from './helpers/test-utils';

test.describe('Search Functionality', () => {
  let electronApp: ElectronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should perform basic search', async () => {
    const window = electronApp.getWindow();
    
    // Mock search results
    await TestUtils.mockSearchResults(window, [
      {
        id: '1',
        title: 'Test Result 1',
        url: 'https://example.com/1',
        snippet: 'This is a test result',
        source: 'Test Source',
        engine: 'google'
      },
      {
        id: '2',
        title: 'Test Result 2',
        url: 'https://example.com/2',
        snippet: 'Another test result',
        source: 'Test Source 2',
        engine: 'bing'
      }
    ]);

    // Perform search
    await TestUtils.waitForSearch(window, 'test query');
    
    // Check results displayed
    const results = window.locator('[data-testid="search-result"]');
    await expect(results).toHaveCount(2);
    
    // Check first result content
    const firstResult = results.first();
    await expect(firstResult.locator('[data-testid="result-title"]')).toContainText('Test Result 1');
    await expect(firstResult.locator('[data-testid="result-snippet"]')).toContainText('This is a test result');
    await expect(firstResult.locator('[data-testid="result-source"]')).toContainText('Test Source');
  });

  test('should filter by search engines', async () => {
    const window = electronApp.getWindow();
    
    // Open engine filter
    await window.click('[data-testid="engine-filter"]');
    
    // Check available engines
    await expect(window.locator('[data-testid="engine-google"]')).toBeVisible();
    await expect(window.locator('[data-testid="engine-bing"]')).toBeVisible();
    await expect(window.locator('[data-testid="engine-duckduckgo"]')).toBeVisible();
    
    // Select only Google
    await window.uncheck('[data-testid="engine-bing"]');
    await window.uncheck('[data-testid="engine-duckduckgo"]');
    
    // Apply filter
    await window.click('[data-testid="apply-filters"]');
    
    // Perform search
    await TestUtils.waitForSearch(window, 'filtered search');
    
    // Verify only Google results
    const results = window.locator('[data-testid="search-result"]');
    const engines = await results.evaluateAll(elements => 
      elements.map(el => el.getAttribute('data-engine'))
    );
    
    expect(engines.every(e => e === 'google')).toBe(true);
  });

  test('should show search suggestions', async () => {
    const window = electronApp.getWindow();
    
    // Mock suggestions endpoint
    await window.route('**/suggestions**', (route) => {
      const query = new URL(route.request().url()).searchParams.get('q');
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          query,
          [`${query} tutorial`, `${query} documentation`, `${query} examples`]
        ])
      });
    });

    // Start typing
    await window.fill('[data-testid="search-input"]', 'java');
    
    // Wait for suggestions
    await window.waitForSelector('[data-testid="search-suggestions"]');
    
    // Check suggestions
    const suggestions = window.locator('[data-testid="suggestion-item"]');
    await expect(suggestions).toHaveCount(3);
    await expect(suggestions.first()).toContainText('java tutorial');
  });

  test('should save search history', async () => {
    const window = electronApp.getWindow();
    
    // Perform multiple searches
    await TestUtils.waitForSearch(window, 'first search');
    await window.waitForTimeout(1000);
    
    await TestUtils.waitForSearch(window, 'second search');
    await window.waitForTimeout(1000);
    
    await TestUtils.waitForSearch(window, 'third search');
    
    // Open search history
    await window.click('[data-testid="search-history"]');
    
    // Check history items
    const historyItems = window.locator('[data-testid="history-item"]');
    await expect(historyItems).toHaveCount(3);
    
    // Most recent first
    await expect(historyItems.first()).toContainText('third search');
    await expect(historyItems.nth(1)).toContainText('second search');
    await expect(historyItems.nth(2)).toContainText('first search');
  });

  test('should handle search errors gracefully', async () => {
    const window = electronApp.getWindow();
    
    // Mock server error
    await window.route('**/search**', (route) => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error'
      });
    });

    // Attempt search
    await window.fill('[data-testid="search-input"]', 'error test');
    await window.press('[data-testid="search-input"]', 'Enter');
    
    // Check error message
    await expect(window.locator('[data-testid="search-error"]')).toBeVisible();
    await expect(window.locator('[data-testid="search-error"]')).toContainText('Failed to perform search');
    
    // Check retry button
    await expect(window.locator('[data-testid="retry-search"]')).toBeVisible();
  });

  test('should paginate search results', async () => {
    const window = electronApp.getWindow();
    
    // Mock paginated results
    let page = 1;
    await window.route('**/search**', (route) => {
      const url = new URL(route.request().url());
      page = parseInt(url.searchParams.get('page') || '1');
      
      const results = Array.from({ length: 20 }, (_, i) => ({
        id: `${page}-${i}`,
        title: `Result ${(page - 1) * 20 + i + 1}`,
        url: `https://example.com/${page}/${i}`,
        snippet: `Page ${page} result ${i}`,
        source: 'Test',
        engine: 'google'
      }));
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results,
          total: 100,
          page,
          hasMore: page < 5
        })
      });
    });

    // Perform search
    await TestUtils.waitForSearch(window, 'paginated search');
    
    // Check first page
    await expect(window.locator('[data-testid="search-result"]')).toHaveCount(20);
    await expect(window.locator('[data-testid="result-title"]').first()).toContainText('Result 1');
    
    // Go to next page
    await window.click('[data-testid="next-page"]');
    await window.waitForSelector('[data-testid="search-results"]');
    
    // Check second page
    await expect(window.locator('[data-testid="result-title"]').first()).toContainText('Result 21');
    
    // Check pagination info
    await expect(window.locator('[data-testid="page-info"]')).toContainText('Page 2 of 5');
  });

  test('should export search results', async () => {
    const window = electronApp.getWindow();
    
    // Mock search results
    await TestUtils.mockSearchResults(window, [
      {
        id: '1',
        title: 'Export Test',
        url: 'https://example.com/export',
        snippet: 'Test export functionality',
        source: 'Test',
        engine: 'google'
      }
    ]);

    // Perform search
    await TestUtils.waitForSearch(window, 'export test');
    
    // Open export menu
    await window.click('[data-testid="export-results"]');
    
    // Check export options
    await expect(window.locator('[data-testid="export-json"]')).toBeVisible();
    await expect(window.locator('[data-testid="export-csv"]')).toBeVisible();
    await expect(window.locator('[data-testid="export-markdown"]')).toBeVisible();
    
    // Export as JSON
    const [download] = await Promise.all([
      window.waitForEvent('download'),
      window.click('[data-testid="export-json"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toContain('search-results');
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should support advanced search syntax', async () => {
    const window = electronApp.getWindow();
    
    // Test various search operators
    const advancedQueries = [
      { query: '"exact phrase"', expected: 'exact phrase' },
      { query: 'site:example.com test', expected: 'site:example.com' },
      { query: 'test -exclude', expected: '-exclude' },
      { query: 'test OR alternative', expected: 'OR' }
    ];

    for (const { query, expected } of advancedQueries) {
      await TestUtils.waitForSearch(window, query);
      
      // Check that query is parsed correctly
      const parsedQuery = await window.getAttribute('[data-testid="parsed-query"]', 'data-query');
      expect(parsedQuery).toContain(expected);
    }
  });

  test('should support search shortcuts', async () => {
    const window = electronApp.getWindow();
    
    // Focus search input with Ctrl+K
    await window.press('body', 'Control+k');
    const searchFocused = await window.evaluate(() => 
      document.activeElement?.getAttribute('data-testid') === 'search-input'
    );
    expect(searchFocused).toBe(true);
    
    // Clear search with Escape
    await window.fill('[data-testid="search-input"]', 'test');
    await window.press('[data-testid="search-input"]', 'Escape');
    const searchValue = await window.inputValue('[data-testid="search-input"]');
    expect(searchValue).toBe('');
    
    // Navigate results with arrow keys
    await TestUtils.mockSearchResults(window, Array(5).fill(null).map((_, i) => ({
      id: String(i),
      title: `Result ${i}`,
      url: `https://example.com/${i}`,
      snippet: 'Test',
      source: 'Test',
      engine: 'google'
    })));
    
    await TestUtils.waitForSearch(window, 'keyboard nav');
    
    // Navigate down
    await window.press('body', 'ArrowDown');
    await window.press('body', 'ArrowDown');
    
    // Check focused result
    const focusedResult = await window.evaluate(() => {
      const focused = document.querySelector('[data-testid="search-result"]:focus-within');
      return focused?.querySelector('[data-testid="result-title"]')?.textContent;
    });
    expect(focusedResult).toBe('Result 1');
  });
});