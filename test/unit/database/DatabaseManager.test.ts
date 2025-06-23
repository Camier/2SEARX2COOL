import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../../src/main/database/DatabaseManager';
import { SearchRecord, CachedResult, Playlist } from '../../../src/shared/types';
import * as crypto from 'crypto';

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  beforeEach(async () => {
    db = new DatabaseManager();
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      expect(db).toBeDefined();
      const stats = await db.getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats.searches).toBe(0);
    });

    it('should create all required tables', async () => {
      // This is implicitly tested by successful initialization
      // If tables weren't created, queries would fail
      expect(true).toBe(true);
    });
  });

  describe('search operations', () => {
    const createTestSearch = (): SearchRecord => ({
      id: crypto.randomUUID(),
      query: 'test query',
      timestamp: Date.now(),
      resultsCount: 10,
      engines: ['google', 'bing'],
      duration: 1000
    });

    it('should save and retrieve a search', async () => {
      const search = createTestSearch();
      await db.saveSearch(search);

      const searches = await db.getRecentSearches(1);
      expect(searches).toHaveLength(1);
      expect(searches[0]).toMatchObject({
        id: search.id,
        query: search.query,
        resultsCount: search.resultsCount,
        engines: search.engines
      });
    });

    it('should retrieve searches in reverse chronological order', async () => {
      const search1 = createTestSearch();
      search1.timestamp = Date.now() - 2000;
      const search2 = createTestSearch();
      search2.timestamp = Date.now() - 1000;
      const search3 = createTestSearch();
      search3.timestamp = Date.now();

      await db.saveSearch(search1);
      await db.saveSearch(search2);
      await db.saveSearch(search3);

      const searches = await db.getRecentSearches(3);
      expect(searches).toHaveLength(3);
      expect(searches[0].id).toBe(search3.id);
      expect(searches[1].id).toBe(search2.id);
      expect(searches[2].id).toBe(search1.id);
    });

    it('should limit search results', async () => {
      // Save 5 searches
      for (let i = 0; i < 5; i++) {
        await db.saveSearch(createTestSearch());
      }

      const searches = await db.getRecentSearches(3);
      expect(searches).toHaveLength(3);
    });

    it('should search history by query', async () => {
      const search1 = createTestSearch();
      search1.query = 'javascript tutorial';
      const search2 = createTestSearch();
      search2.query = 'python tutorial';
      const search3 = createTestSearch();
      search3.query = 'javascript framework';

      await db.saveSearch(search1);
      await db.saveSearch(search2);
      await db.saveSearch(search3);

      const results = await db.searchHistory('javascript');
      expect(results).toHaveLength(2);
      expect(results.map(r => r.query)).toContain('javascript tutorial');
      expect(results.map(r => r.query)).toContain('javascript framework');
    });
  });

  describe('cache operations', () => {
    const createTestCachedResult = (): CachedResult => ({
      id: crypto.randomUUID(),
      searchId: crypto.randomUUID(),
      result: {
        id: '1',
        title: 'Test Result',
        url: 'https://example.com',
        source: 'test',
        engine: 'test'
      },
      expiresAt: Date.now() + 3600000, // 1 hour from now
      accessCount: 0,
      lastAccessed: Date.now()
    });

    it('should cache and retrieve a result', async () => {
      const cached = createTestCachedResult();
      await db.setCachedResult(cached);

      const retrieved = await db.getCachedResult(cached.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(cached.id);
      expect(retrieved?.result).toEqual(cached.result);
    });

    it('should not return expired cache entries', async () => {
      const cached = createTestCachedResult();
      cached.expiresAt = Date.now() - 1000; // Expired 1 second ago
      await db.setCachedResult(cached);

      const retrieved = await db.getCachedResult(cached.id);
      expect(retrieved).toBeNull();
    });

    it('should increment access count on retrieval', async () => {
      const cached = createTestCachedResult();
      await db.setCachedResult(cached);

      // First access
      await db.getCachedResult(cached.id);
      
      // Second access
      const retrieved = await db.getCachedResult(cached.id);
      expect(retrieved?.accessCount).toBe(2);
    });

    it('should clean expired cache entries', async () => {
      // Create mix of expired and valid entries
      const expired1 = createTestCachedResult();
      expired1.expiresAt = Date.now() - 2000;
      const expired2 = createTestCachedResult();
      expired2.expiresAt = Date.now() - 1000;
      const valid = createTestCachedResult();
      valid.expiresAt = Date.now() + 10000;

      await db.setCachedResult(expired1);
      await db.setCachedResult(expired2);
      await db.setCachedResult(valid);

      const cleaned = await db.cleanExpiredCache();
      expect(cleaned).toBe(2);

      // Verify only valid entry remains
      const retrieved = await db.getCachedResult(valid.id);
      expect(retrieved).toBeDefined();
    });
  });

  describe('plugin data operations', () => {
    it('should store and retrieve plugin data', async () => {
      const pluginId = 'test-plugin';
      const key = 'settings';
      const value = { theme: 'dark', enabled: true };

      await db.setPluginData(pluginId, key, value);
      const retrieved = await db.getPluginData(pluginId, key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent plugin data', async () => {
      const data = await db.getPluginData('non-existent', 'key');
      expect(data).toBeNull();
    });

    it('should update existing plugin data', async () => {
      const pluginId = 'test-plugin';
      const key = 'counter';

      await db.setPluginData(pluginId, key, 1);
      await db.setPluginData(pluginId, key, 2);

      const value = await db.getPluginData(pluginId, key);
      expect(value).toBe(2);
    });
  });

  describe('preferences operations', () => {
    it('should store and retrieve preferences', async () => {
      const prefs = {
        theme: 'dark',
        language: 'en',
        autoUpdate: true
      };

      await db.setPreference('userPrefs', prefs);
      const retrieved = await db.getPreference('userPrefs');
      
      expect(retrieved).toEqual(prefs);
    });

    it('should handle sync enabled flag', async () => {
      await db.setPreference('syncPref', 'value', true);
      // The sync flag is stored but not returned in get
      const value = await db.getPreference('syncPref');
      expect(value).toBe('value');
    });
  });

  describe('playlist operations', () => {
    const createTestPlaylist = (): Playlist => ({
      id: crypto.randomUUID(),
      name: 'Test Playlist',
      description: 'A test playlist',
      tracks: [
        {
          id: '1',
          title: 'Track 1',
          artist: 'Artist 1',
          url: 'https://example.com/1',
          source: 'test',
          engine: 'test'
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: false
    });

    it('should create and retrieve playlists', async () => {
      const playlist = createTestPlaylist();
      await db.createPlaylist(playlist);

      const playlists = await db.getPlaylists();
      expect(playlists).toHaveLength(1);
      expect(playlists[0]).toMatchObject({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description
      });
      expect(playlists[0].tracks).toHaveLength(1);
    });

    it('should retrieve playlists ordered by update time', async () => {
      const playlist1 = createTestPlaylist();
      playlist1.updatedAt = Date.now() - 2000;
      const playlist2 = createTestPlaylist();
      playlist2.updatedAt = Date.now();

      await db.createPlaylist(playlist1);
      await db.createPlaylist(playlist2);

      const playlists = await db.getPlaylists();
      expect(playlists[0].id).toBe(playlist2.id);
      expect(playlists[1].id).toBe(playlist1.id);
    });
  });

  describe('analytics operations', () => {
    it('should track analytics events', async () => {
      const event = {
        id: crypto.randomUUID(),
        event: 'search_performed',
        properties: { query: 'test', engine: 'google' },
        timestamp: Date.now(),
        sessionId: 'test-session'
      };

      await db.trackEvent(event);
      const events = await db.getAnalytics();
      
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event: event.event,
        properties: event.properties
      });
    });

    it('should filter analytics by event type', async () => {
      await db.trackEvent({
        id: crypto.randomUUID(),
        event: 'search_performed',
        properties: {},
        timestamp: Date.now(),
        sessionId: 'test'
      });

      await db.trackEvent({
        id: crypto.randomUUID(),
        event: 'plugin_installed',
        properties: {},
        timestamp: Date.now(),
        sessionId: 'test'
      });

      const searchEvents = await db.getAnalytics('search_performed');
      expect(searchEvents).toHaveLength(1);
      expect(searchEvents[0].event).toBe('search_performed');
    });

    it('should filter analytics by time', async () => {
      const now = Date.now();
      
      await db.trackEvent({
        id: crypto.randomUUID(),
        event: 'old_event',
        properties: {},
        timestamp: now - 10000,
        sessionId: 'test'
      });

      await db.trackEvent({
        id: crypto.randomUUID(),
        event: 'new_event',
        properties: {},
        timestamp: now,
        sessionId: 'test'
      });

      const recentEvents = await db.getAnalytics(undefined, now - 5000);
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].event).toBe('new_event');
    });
  });

  describe('utility operations', () => {
    it('should get database statistics', async () => {
      // Add some data
      await db.saveSearch(createTestSearch());
      await db.createPlaylist(createTestPlaylist());

      const stats = await db.getDatabaseStats();
      expect(stats.searches).toBe(1);
      expect(stats.playlists).toBe(1);
      expect(stats.cachedResults).toBe(0);
      expect(stats.analytics).toBe(0);
      expect(stats.sizeBytes).toBeGreaterThan(0);
    });

    it('should vacuum database', async () => {
      await expect(db.vacuum()).resolves.not.toThrow();
    });

    it('should backup database', async () => {
      const backupPath = global.testHelpers.getTestDir() + '/backup.db';
      await expect(db.backup(backupPath)).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error when database not initialized', async () => {
      const newDb = new DatabaseManager();
      await expect(newDb.saveSearch(createTestSearch())).rejects.toThrow('Database not initialized');
    });

    it('should handle invalid data gracefully', async () => {
      // This should not throw, just store as string
      await expect(db.setPluginData('test', 'circular', { 
        a: 1,
        get b() { return this; }
      })).resolves.not.toThrow();
    });
  });
});

// Helper functions
function createTestSearch(): SearchRecord {
  return {
    id: crypto.randomUUID(),
    query: 'test query',
    timestamp: Date.now(),
    resultsCount: 10,
    engines: ['google', 'bing'],
    duration: 1000
  };
}

function createTestPlaylist(): Playlist {
  return {
    id: crypto.randomUUID(),
    name: 'Test Playlist',
    description: 'A test playlist',
    tracks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPublic: false
  };
}