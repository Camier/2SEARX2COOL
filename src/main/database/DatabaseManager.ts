import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { 
  DatabaseSchema, 
  SearchRecord, 
  CachedResult, 
  PluginData, 
  UserPreference,
  Playlist,
  AnalyticsEvent
} from '../../shared/types';
import {
  SearchRow,
  CachedResultRow,
  PluginDataRow,
  PreferenceRow,
  PlaylistRow,
  AnalyticsRow,
  CountRow,
  SizeRow
} from './types';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'data.db');
  }

  async initialize(): Promise<void> {
    try {
      // Create database connection
      this.db = new Database(this.dbPath, {
        verbose: log.debug,
        fileMustExist: false
      });

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');

      // Create tables
      this.createTables();

      // Create indexes
      this.createIndexes();

      log.info('Database initialized successfully');
    } catch (error) {
      log.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Search history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS searches (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        results_count INTEGER NOT NULL,
        engines TEXT NOT NULL,
        duration INTEGER NOT NULL,
        user_id TEXT
      )
    `);

    // Cached results table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cached_results (
        id TEXT PRIMARY KEY,
        search_id TEXT NOT NULL,
        result TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0,
        last_accessed INTEGER NOT NULL,
        FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE
      )
    `);

    // Plugin data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plugin_data (
        plugin_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (plugin_id, key)
      )
    `);

    // User preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_enabled INTEGER DEFAULT 0
      )
    `);

    // Playlists table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        tracks TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_public INTEGER DEFAULT 0
      )
    `);

    // Analytics events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id TEXT PRIMARY KEY,
        event TEXT NOT NULL,
        properties TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        session_id TEXT NOT NULL
      )
    `);

    // Audio files table (Library feature)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filePath TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        genre TEXT,
        year INTEGER,
        duration INTEGER,
        bitrate INTEGER,
        sampleRate INTEGER,
        fileSize INTEGER,
        fileFormat TEXT,
        dateAdded INTEGER NOT NULL,
        lastModified INTEGER NOT NULL,
        lastPlayed INTEGER,
        playCount INTEGER DEFAULT 0,
        skipCount INTEGER DEFAULT 0,
        rating INTEGER,
        isFavorite INTEGER DEFAULT 0,
        trackNumber INTEGER,
        discNumber INTEGER,
        albumArtist TEXT,
        composer TEXT,
        comment TEXT,
        lyrics TEXT,
        bpm INTEGER,
        albumArt TEXT,
        md5Hash TEXT,
        gain REAL,
        personalScore REAL,
        fingerprint TEXT,
        acousticFeatures TEXT,
        metadata TEXT
      )
    `);

    // Create views for library
    this.db.exec(`
      -- Albums view
      CREATE VIEW IF NOT EXISTS albums_view AS
      SELECT 
        album,
        albumArtist as artist,
        MIN(year) as year,
        COUNT(*) as trackCount,
        SUM(duration) as totalDuration,
        AVG(rating) as avgRating,
        SUM(playCount) as totalPlayCount,
        MAX(albumArt) as albumArt,
        MAX(lastPlayed) as lastPlayed
      FROM audio_files
      WHERE album IS NOT NULL
      GROUP BY album, albumArtist
      ORDER BY album;

      -- Artists view
      CREATE VIEW IF NOT EXISTS artists_view AS
      SELECT 
        artist,
        COUNT(DISTINCT album) as albumCount,
        COUNT(*) as trackCount,
        SUM(duration) as totalDuration,
        AVG(rating) as avgRating,
        SUM(playCount) as totalPlayCount,
        MAX(lastPlayed) as lastPlayed
      FROM audio_files
      GROUP BY artist
      ORDER BY artist;
      
      -- Genres view
      CREATE VIEW IF NOT EXISTS genres_view AS
      SELECT 
        genre,
        COUNT(*) as trackCount,
        COUNT(DISTINCT artist) as artistCount,
        COUNT(DISTINCT album) as albumCount,
        SUM(duration) as totalDuration,
        AVG(rating) as avgRating
      FROM audio_files
      WHERE genre IS NOT NULL
      GROUP BY genre
      ORDER BY trackCount DESC;
    `);
  }

  private createIndexes(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_searches_timestamp ON searches(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query);
      CREATE INDEX IF NOT EXISTS idx_cached_results_expires ON cached_results(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cached_results_search ON cached_results(search_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event);
      CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id);
      
      -- Library indexes
      CREATE INDEX IF NOT EXISTS idx_audio_files_artist ON audio_files(artist);
      CREATE INDEX IF NOT EXISTS idx_audio_files_album ON audio_files(album);
      CREATE INDEX IF NOT EXISTS idx_audio_files_genre ON audio_files(genre);
      CREATE INDEX IF NOT EXISTS idx_audio_files_year ON audio_files(year);
      CREATE INDEX IF NOT EXISTS idx_audio_files_rating ON audio_files(rating);
      CREATE INDEX IF NOT EXISTS idx_audio_files_date_added ON audio_files(dateAdded DESC);
      CREATE INDEX IF NOT EXISTS idx_audio_files_last_played ON audio_files(lastPlayed DESC);
      CREATE INDEX IF NOT EXISTS idx_audio_files_play_count ON audio_files(playCount DESC);
      CREATE INDEX IF NOT EXISTS idx_audio_files_favorite ON audio_files(isFavorite);
      CREATE INDEX IF NOT EXISTS idx_audio_files_file_path ON audio_files(filePath);
      CREATE INDEX IF NOT EXISTS idx_audio_files_personal_score ON audio_files(personalScore DESC);
    `);
    
    // Create full-text search virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS audio_files_fts USING fts5(
        title,
        artist,
        album,
        genre,
        comment,
        content=audio_files,
        content_rowid=id
      );
      
      -- Populate FTS table
      INSERT OR REPLACE INTO audio_files_fts(rowid, title, artist, album, genre, comment)
      SELECT id, title, artist, album, genre, comment FROM audio_files;
      
      -- Create triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS audio_files_fts_insert AFTER INSERT ON audio_files
      BEGIN
        INSERT INTO audio_files_fts(rowid, title, artist, album, genre, comment)
        VALUES (new.id, new.title, new.artist, new.album, new.genre, new.comment);
      END;
      
      CREATE TRIGGER IF NOT EXISTS audio_files_fts_update AFTER UPDATE ON audio_files
      BEGIN
        UPDATE audio_files_fts
        SET title = new.title, artist = new.artist, album = new.album, 
            genre = new.genre, comment = new.comment
        WHERE rowid = new.id;
      END;
      
      CREATE TRIGGER IF NOT EXISTS audio_files_fts_delete AFTER DELETE ON audio_files
      BEGIN
        DELETE FROM audio_files_fts WHERE rowid = old.id;
      END;
    `);
  }

  // Search operations
  async saveSearch(search: SearchRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO searches 
      (id, query, timestamp, results_count, engines, duration, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      search.id,
      search.query,
      search.timestamp,
      search.resultsCount,
      JSON.stringify(search.engines),
      search.duration,
      search.userId || null
    );
  }

  async getRecentSearches(limit: number = 50): Promise<SearchRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM searches 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as SearchRow[];
    return rows.map(row => ({
      id: row.id,
      query: row.query,
      timestamp: row.timestamp,
      resultsCount: row.results_count,
      engines: JSON.parse(row.engines),
      duration: row.duration,
      userId: row.user_id || undefined
    }));
  }

  async searchHistory(query: string): Promise<SearchRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM searches 
      WHERE query LIKE ? 
      ORDER BY timestamp DESC 
      LIMIT 100
    `);

    const rows = stmt.all(`%${query}%`) as SearchRow[];
    return rows.map(row => ({
      id: row.id,
      query: row.query,
      timestamp: row.timestamp,
      resultsCount: row.results_count,
      engines: JSON.parse(row.engines),
      duration: row.duration,
      userId: row.user_id || undefined
    }));
  }

  // Cache operations
  async getCachedResult(key: string): Promise<CachedResult | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM cached_results 
      WHERE id = ? AND expires_at > ?
    `);

    const row = stmt.get(key, Date.now()) as CachedResultRow | undefined;
    if (!row) return null;

    // Update access count and last accessed
    const updateStmt = this.db.prepare(`
      UPDATE cached_results 
      SET access_count = access_count + 1, last_accessed = ? 
      WHERE id = ?
    `);
    updateStmt.run(Date.now(), key);

    return {
      id: row.id,
      searchId: row.search_id,
      result: JSON.parse(row.result),
      expiresAt: row.expires_at,
      accessCount: row.access_count,
      lastAccessed: row.last_accessed
    };
  }

  async setCachedResult(result: CachedResult): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cached_results 
      (id, search_id, result, expires_at, access_count, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.id,
      result.searchId,
      JSON.stringify(result.result),
      result.expiresAt,
      result.accessCount || 0,
      result.lastAccessed || Date.now()
    );
  }

  async cleanExpiredCache(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM cached_results 
      WHERE expires_at < ?
    `);

    const result = stmt.run(Date.now());
    return result.changes;
  }

  // Plugin data operations
  async getPluginData(pluginId: string, key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT value FROM plugin_data 
      WHERE plugin_id = ? AND key = ?
    `);

    const row = stmt.get(pluginId, key) as PluginDataRow | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  async setPluginData(pluginId: string, key: string, value: unknown): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO plugin_data 
      (plugin_id, key, value, version, updated_at)
      VALUES (?, ?, ?, 1, ?)
    `);

    stmt.run(pluginId, key, JSON.stringify(value), Date.now());
  }

  // Preferences operations
  async getPreference(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT value FROM preferences 
      WHERE key = ?
    `);

    const row = stmt.get(key) as PreferenceRow | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  async setPreference(key: string, value: unknown, syncEnabled = false): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO preferences 
      (key, value, updated_at, sync_enabled)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(key, JSON.stringify(value), Date.now(), syncEnabled ? 1 : 0);
  }

  // Playlist operations
  async createPlaylist(playlist: Playlist): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO playlists 
      (id, name, description, tracks, created_at, updated_at, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      playlist.id,
      playlist.name,
      playlist.description || null,
      JSON.stringify(playlist.tracks),
      playlist.createdAt,
      playlist.updatedAt,
      playlist.isPublic ? 1 : 0
    );
  }

  async getPlaylists(): Promise<Playlist[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM playlists 
      ORDER BY updated_at DESC
    `);

    const rows = stmt.all() as PlaylistRow[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      tracks: JSON.parse(row.tracks),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isPublic: row.is_public === 1
    }));
  }

  // Analytics operations
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO analytics 
      (id, event, properties, timestamp, session_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.event,
      JSON.stringify(event.properties),
      event.timestamp,
      event.sessionId
    );
  }

  async getAnalytics(event?: string, startTime?: number): Promise<AnalyticsEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM analytics WHERE 1=1';
    const params: (string | number)[] = [];

    if (event) {
      query += ' AND event = ?';
      params.push(event);
    }

    if (startTime) {
      query += ' AND timestamp >= ?';
      params.push(startTime);
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as AnalyticsRow[];

    return rows.map(row => ({
      id: row.id,
      event: row.event,
      properties: JSON.parse(row.properties),
      timestamp: row.timestamp,
      sessionId: row.session_id,
      userId: undefined // Not stored in database
    }));
  }

  // Utility methods
  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('VACUUM');
  }

  async backup(backupPath: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.backup(backupPath);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Statistics
  async getDatabaseStats(): Promise<{
    searches: number;
    cachedResults: number;
    playlists: number;
    analytics: number;
    sizeBytes: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = {
      searches: (this.db.prepare('SELECT COUNT(*) as count FROM searches').get() as CountRow).count,
      cachedResults: (this.db.prepare('SELECT COUNT(*) as count FROM cached_results').get() as CountRow).count,
      playlists: (this.db.prepare('SELECT COUNT(*) as count FROM playlists').get() as CountRow).count,
      analytics: (this.db.prepare('SELECT COUNT(*) as count FROM analytics').get() as CountRow).count,
      sizeBytes: (this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as SizeRow).size
    };

    return stats;
  }

  // Additional cache methods for CacheManager
  async loadCache(): Promise<Array<{region: string, key: string, value: any, ttl: number}>> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM cached_results 
      WHERE expires_at > ?
    `);
    
    const rows = stmt.all(Date.now()) as CachedResultRow[];
    return rows.map(row => ({
      region: 'default',
      key: row.id,
      value: JSON.parse(row.result),
      ttl: row.expires_at - Date.now()
    }));
  }

  async getCacheEntry(region: string, key: string): Promise<any> {
    const result = await this.getCachedResult(key);
    return result ? result.result : null;
  }

  async setCacheEntry(region: string, key: string, value: any): Promise<void> {
    const cacheResult: CachedResult = {
      id: key,
      searchId: `${region}_${key}`,
      result: value, // value is already an object, will be stringified in setCachedResult
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour default
      accessCount: 0,
      lastAccessed: Date.now()
    };
    await this.setCachedResult(cacheResult);
  }

  async deleteCacheEntry(region: string, key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      DELETE FROM cached_results 
      WHERE key = ?
    `);
    
    stmt.run(key);
  }

  async clearCacheRegion(region: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      DELETE FROM cached_results 
      WHERE key LIKE ?
    `);
    
    stmt.run(`${region}_%`);
  }

  async clearAllCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('DELETE FROM cached_results');
    stmt.run();
  }
}