/**
 * Week 4 Day 4: Playlist Service
 * 
 * Comprehensive playlist management service with support for:
 * - Manual playlist CRUD operations
 * - Smart playlist generation and updates
 * - Drag-and-drop track reordering
 * - Import/Export functionality
 * - Sharing and collaboration
 */

import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import log from 'electron-log';

import {
  Playlist,
  PlaylistTrack,
  SmartPlaylist,
  SmartPlaylistCriteria,
  SmartPlaylistRule,
  PlaylistImportExport,
  PlaylistShare,
  PlaylistStats,
  PlaylistViewOptions,
  PlaylistFilter,
  PlaylistPage,
  SMART_PLAYLIST_TEMPLATES,
  validatePlaylistName,
  validateSmartPlaylistRule,
  generatePlaylistId,
  generateShareToken
} from '../database/PlaylistSchema';

export class PlaylistService {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeTables();
  }

  private initializeTables(): void {
    // Enhanced playlists table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlists_v2 (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        cover_art TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        is_public INTEGER DEFAULT 0,
        is_smart INTEGER DEFAULT 0,
        track_count INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        tags TEXT,
        color TEXT,
        sort_order INTEGER
      )
    `);

    // Playlist tracks junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id TEXT NOT NULL,
        track_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        added_by TEXT,
        custom_note TEXT,
        FOREIGN KEY (playlist_id) REFERENCES playlists_v2(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE,
        UNIQUE(playlist_id, position)
      )
    `);

    // Smart playlists table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS smart_playlists (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        criteria TEXT NOT NULL,
        max_tracks INTEGER,
        sort_by TEXT NOT NULL,
        sort_direction TEXT NOT NULL,
        auto_update INTEGER DEFAULT 1,
        last_updated INTEGER NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists_v2(id) ON DELETE CASCADE
      )
    `);

    // Playlist shares table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlist_shares (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        share_token TEXT NOT NULL UNIQUE,
        expires_at INTEGER,
        permissions TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0,
        FOREIGN KEY (playlist_id) REFERENCES playlists_v2(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_playlists_created_at ON playlists_v2(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_playlists_updated_at ON playlists_v2(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_playlists_is_smart ON playlists_v2(is_smart);
      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
      CREATE INDEX IF NOT EXISTS idx_playlist_shares_token ON playlist_shares(share_token);
    `);

    log.info('Playlist tables initialized successfully');
  }

  // ===== PLAYLIST CRUD OPERATIONS =====

  async createPlaylist(playlist: Partial<Playlist>): Promise<Playlist> {
    const nameValidation = validatePlaylistName(playlist.name || '');
    if (nameValidation) {
      throw new Error(nameValidation);
    }

    const id = generatePlaylistId();
    const now = Date.now();

    const newPlaylist: Playlist = {
      id,
      name: playlist.name!,
      description: playlist.description,
      coverArt: playlist.coverArt,
      createdAt: now,
      updatedAt: now,
      createdBy: playlist.createdBy,
      isPublic: playlist.isPublic || false,
      isSmart: playlist.isSmart || false,
      trackCount: 0,
      totalDuration: 0,
      tags: playlist.tags,
      color: playlist.color,
      sortOrder: playlist.sortOrder
    };

    const stmt = this.db.prepare(`
      INSERT INTO playlists_v2 
      (id, name, description, cover_art, created_at, updated_at, created_by, 
       is_public, is_smart, track_count, total_duration, tags, color, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newPlaylist.id,
      newPlaylist.name,
      newPlaylist.description,
      newPlaylist.coverArt,
      newPlaylist.createdAt,
      newPlaylist.updatedAt,
      newPlaylist.createdBy,
      newPlaylist.isPublic ? 1 : 0,
      newPlaylist.isSmart ? 1 : 0,
      newPlaylist.trackCount,
      newPlaylist.totalDuration,
      newPlaylist.tags ? JSON.stringify(newPlaylist.tags) : null,
      newPlaylist.color,
      newPlaylist.sortOrder
    );

    log.info(`Created playlist: ${newPlaylist.name} (${newPlaylist.id})`);
    return newPlaylist;
  }

  async getPlaylist(id: string): Promise<Playlist | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM playlists_v2 WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToPlaylist(row);
  }

  async updatePlaylist(id: string, updates: Partial<Playlist>): Promise<Playlist> {
    if (updates.name) {
      const nameValidation = validatePlaylistName(updates.name);
      if (nameValidation) {
        throw new Error(nameValidation);
      }
    }

    const playlist = await this.getPlaylist(id);
    if (!playlist) {
      throw new Error(`Playlist not found: ${id}`);
    }

    const updatedPlaylist = { ...playlist, ...updates, updatedAt: Date.now() };

    const stmt = this.db.prepare(`
      UPDATE playlists_v2 
      SET name = ?, description = ?, cover_art = ?, updated_at = ?, 
          is_public = ?, tags = ?, color = ?, sort_order = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedPlaylist.name,
      updatedPlaylist.description,
      updatedPlaylist.coverArt,
      updatedPlaylist.updatedAt,
      updatedPlaylist.isPublic ? 1 : 0,
      updatedPlaylist.tags ? JSON.stringify(updatedPlaylist.tags) : null,
      updatedPlaylist.color,
      updatedPlaylist.sortOrder,
      id
    );

    log.info(`Updated playlist: ${updatedPlaylist.name} (${id})`);
    return updatedPlaylist;
  }

  async deletePlaylist(id: string): Promise<void> {
    const playlist = await this.getPlaylist(id);
    if (!playlist) {
      throw new Error(`Playlist not found: ${id}`);
    }

    // Delete playlist (tracks and shares will be deleted by CASCADE)
    const stmt = this.db.prepare('DELETE FROM playlists_v2 WHERE id = ?');
    stmt.run(id);

    log.info(`Deleted playlist: ${playlist.name} (${id})`);
  }

  async getPlaylists(
    options: PlaylistViewOptions,
    filter?: PlaylistFilter
  ): Promise<PlaylistPage<Playlist>> {
    let query = 'SELECT * FROM playlists_v2 WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (filter?.searchQuery) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${filter.searchQuery}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filter?.isPublic !== undefined) {
      query += ' AND is_public = ?';
      params.push(filter.isPublic ? 1 : 0);
    }

    if (filter?.isSmart !== undefined) {
      query += ' AND is_smart = ?';
      params.push(filter.isSmart ? 1 : 0);
    }

    if (filter?.createdBy) {
      query += ' AND created_by = ?';
      params.push(filter.createdBy);
    }

    if (filter?.minTrackCount !== undefined) {
      query += ' AND track_count >= ?';
      params.push(filter.minTrackCount);
    }

    if (filter?.maxTrackCount !== undefined) {
      query += ' AND track_count <= ?';
      params.push(filter.maxTrackCount);
    }

    // Add sorting
    query += ` ORDER BY ${options.sortBy} ${options.sortDirection}`;

    // Add pagination
    const offset = (options.page - 1) * options.pageSize;
    query += ' LIMIT ? OFFSET ?';
    params.push(options.pageSize, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    // Get total count for pagination
    let countQuery = query.split('ORDER BY')[0].replace('SELECT *', 'SELECT COUNT(*) as count');
    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET
    const countStmt = this.db.prepare(countQuery);
    const totalCount = (countStmt.get(...countParams) as any).count;

    const playlists = rows.map(row => this.mapRowToPlaylist(row));
    const totalPages = Math.ceil(totalCount / options.pageSize);

    return {
      items: playlists,
      totalCount,
      totalPages,
      currentPage: options.page,
      pageSize: options.pageSize,
      hasNext: options.page < totalPages,
      hasPrevious: options.page > 1
    };
  }

  // ===== TRACK MANAGEMENT =====

  async addTracksToPlaylist(
    playlistId: string,
    trackIds: number[],
    position?: number
  ): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    if (playlist.isSmart) {
      throw new Error('Cannot manually add tracks to smart playlists');
    }

    const now = Date.now();
    
    // Get current max position
    const maxPosStmt = this.db.prepare(`
      SELECT MAX(position) as max_pos FROM playlist_tracks WHERE playlist_id = ?
    `);
    const maxPosResult = maxPosStmt.get(playlistId) as any;
    let nextPosition = (maxPosResult?.max_pos || 0) + 1;

    if (position !== undefined) {
      // Insert at specific position, shift others
      this.db.exec(`
        UPDATE playlist_tracks 
        SET position = position + ${trackIds.length}
        WHERE playlist_id = '${playlistId}' AND position >= ${position}
      `);
      nextPosition = position;
    }

    // Insert tracks
    const insertStmt = this.db.prepare(`
      INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const trackId of trackIds) {
      insertStmt.run(playlistId, trackId, nextPosition++, now);
    }

    // Update playlist stats
    await this.updatePlaylistStats(playlistId);

    log.info(`Added ${trackIds.length} tracks to playlist ${playlistId}`);
  }

  async removeTracksFromPlaylist(playlistId: string, trackIds: number[]): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    if (playlist.isSmart) {
      throw new Error('Cannot manually remove tracks from smart playlists');
    }

    // Remove tracks
    const stmt = this.db.prepare(`
      DELETE FROM playlist_tracks 
      WHERE playlist_id = ? AND track_id IN (${trackIds.map(() => '?').join(',')})
    `);
    stmt.run(playlistId, ...trackIds);

    // Reorder remaining tracks
    await this.reorderTracks(playlistId);

    // Update playlist stats
    await this.updatePlaylistStats(playlistId);

    log.info(`Removed ${trackIds.length} tracks from playlist ${playlistId}`);
  }

  async reorderTracks(playlistId: string, trackOrder?: number[]): Promise<void> {
    if (trackOrder) {
      // Reorder based on provided order
      const updateStmt = this.db.prepare(`
        UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?
      `);

      trackOrder.forEach((trackId, index) => {
        updateStmt.run(index + 1, playlistId, trackId);
      });
    } else {
      // Compact positions (remove gaps)
      const tracks = this.db.prepare(`
        SELECT track_id FROM playlist_tracks 
        WHERE playlist_id = ? 
        ORDER BY position
      `).all(playlistId) as any[];

      const updateStmt = this.db.prepare(`
        UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?
      `);

      tracks.forEach((track, index) => {
        updateStmt.run(index + 1, playlistId, track.track_id);
      });
    }

    log.info(`Reordered tracks in playlist ${playlistId}`);
  }

  async getPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]> {
    const stmt = this.db.prepare(`
      SELECT pt.*, af.title, af.artist, af.album, af.duration
      FROM playlist_tracks pt
      JOIN audio_files af ON pt.track_id = af.id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position
    `);

    const rows = stmt.all(playlistId) as any[];
    return rows.map(row => ({
      id: row.id,
      playlistId: row.playlist_id,
      trackId: row.track_id,
      position: row.position,
      addedAt: row.added_at,
      addedBy: row.added_by,
      customNote: row.custom_note,
      // Include track metadata for convenience
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration
    }));
  }

  // ===== SMART PLAYLISTS =====

  async createSmartPlaylist(
    playlist: Partial<Playlist>,
    criteria: SmartPlaylistCriteria,
    options: {
      maxTracks?: number;
      sortBy: string;
      sortDirection: 'asc' | 'desc';
      autoUpdate?: boolean;
    }
  ): Promise<Playlist> {
    // Validate criteria
    for (const rule of criteria.rules) {
      const validation = validateSmartPlaylistRule(rule);
      if (validation) {
        throw new Error(validation);
      }
    }

    // Create playlist
    const smartPlaylist = await this.createPlaylist({
      ...playlist,
      isSmart: true
    });

    // Create smart playlist record
    const smartRecord: SmartPlaylist = {
      id: generatePlaylistId(),
      playlistId: smartPlaylist.id,
      criteria,
      maxTracks: options.maxTracks,
      sortBy: options.sortBy,
      sortDirection: options.sortDirection,
      autoUpdate: options.autoUpdate !== false,
      lastUpdated: Date.now()
    };

    const stmt = this.db.prepare(`
      INSERT INTO smart_playlists 
      (id, playlist_id, criteria, max_tracks, sort_by, sort_direction, auto_update, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      smartRecord.id,
      smartRecord.playlistId,
      JSON.stringify(smartRecord.criteria),
      smartRecord.maxTracks,
      smartRecord.sortBy,
      smartRecord.sortDirection,
      smartRecord.autoUpdate ? 1 : 0,
      smartRecord.lastUpdated
    );

    // Generate initial tracks
    await this.updateSmartPlaylist(smartPlaylist.id);

    log.info(`Created smart playlist: ${smartPlaylist.name} (${smartPlaylist.id})`);
    return smartPlaylist;
  }

  async updateSmartPlaylist(playlistId: string): Promise<void> {
    const smartStmt = this.db.prepare(`
      SELECT * FROM smart_playlists WHERE playlist_id = ?
    `);
    const smartRecord = smartStmt.get(playlistId) as any;

    if (!smartRecord) {
      throw new Error(`Smart playlist not found: ${playlistId}`);
    }

    const criteria: SmartPlaylistCriteria = JSON.parse(smartRecord.criteria);
    
    // Build query from criteria
    let query = 'SELECT id FROM audio_files WHERE ';
    const params: any[] = [];
    const conditions: string[] = [];

    for (const rule of criteria.rules) {
      const condition = this.buildRuleCondition(rule, params);
      conditions.push(condition);
    }

    query += conditions.join(` ${criteria.operator} `);
    
    // Add sorting
    query += ` ORDER BY ${smartRecord.sort_by} ${smartRecord.sort_direction}`;
    
    // Add limit
    if (smartRecord.max_tracks) {
      query += ` LIMIT ${smartRecord.max_tracks}`;
    }

    // Execute query
    const trackStmt = this.db.prepare(query);
    const tracks = trackStmt.all(...params) as any[];

    // Clear existing tracks
    this.db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId);

    // Add new tracks
    if (tracks.length > 0) {
      const insertStmt = this.db.prepare(`
        INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
        VALUES (?, ?, ?, ?)
      `);

      const now = Date.now();
      tracks.forEach((track, index) => {
        insertStmt.run(playlistId, track.id, index + 1, now);
      });
    }

    // Update smart playlist record
    this.db.prepare(`
      UPDATE smart_playlists SET last_updated = ? WHERE playlist_id = ?
    `).run(Date.now(), playlistId);

    // Update playlist stats
    await this.updatePlaylistStats(playlistId);

    log.info(`Updated smart playlist ${playlistId} with ${tracks.length} tracks`);
  }

  private buildRuleCondition(rule: SmartPlaylistRule, params: any[]): string {
    switch (rule.operator) {
      case 'equals':
        params.push(rule.value);
        return `${rule.field} = ?`;
        
      case 'contains':
        params.push(`%${rule.value}%`);
        return `${rule.field} LIKE ?`;
        
      case 'startsWith':
        params.push(`${rule.value}%`);
        return `${rule.field} LIKE ?`;
        
      case 'endsWith':
        params.push(`%${rule.value}`);
        return `${rule.field} LIKE ?`;
        
      case 'gt':
        params.push(rule.value);
        return `${rule.field} > ?`;
        
      case 'lt':
        params.push(rule.value);
        return `${rule.field} < ?`;
        
      case 'gte':
        params.push(rule.value);
        return `${rule.field} >= ?`;
        
      case 'lte':
        params.push(rule.value);
        return `${rule.field} <= ?`;
        
      case 'in':
        const inValues = Array.isArray(rule.value) ? rule.value : [rule.value];
        const placeholders = inValues.map(() => '?').join(',');
        params.push(...inValues);
        return `${rule.field} IN (${placeholders})`;
        
      case 'not_in':
        const notInValues = Array.isArray(rule.value) ? rule.value : [rule.value];
        const notInPlaceholders = notInValues.map(() => '?').join(',');
        params.push(...notInValues);
        return `${rule.field} NOT IN (${notInPlaceholders})`;
        
      default:
        throw new Error(`Unsupported operator: ${rule.operator}`);
    }
  }

  // ===== IMPORT/EXPORT =====

  async exportPlaylist(playlistId: string, format: PlaylistImportExport['format'], filePath: string): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    const tracks = await this.getPlaylistTracks(playlistId);

    switch (format) {
      case 'M3U':
      case 'M3U8':
        await this.exportM3U(playlist, tracks, filePath);
        break;
      case 'PLS':
        await this.exportPLS(playlist, tracks, filePath);
        break;
      case 'XSPF':
        await this.exportXSPF(playlist, tracks, filePath);
        break;
      case 'JSON':
        await this.exportJSON(playlist, tracks, filePath);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    log.info(`Exported playlist ${playlist.name} to ${filePath} (${format})`);
  }

  private async exportM3U(playlist: Playlist, tracks: PlaylistTrack[], filePath: string): Promise<void> {
    const content = [
      '#EXTM3U',
      `#PLAYLIST:${playlist.name}`,
      ''
    ];

    for (const track of tracks) {
      content.push(`#EXTINF:${Math.floor((track as any).duration || 0)},${(track as any).artist} - ${(track as any).title}`);
      // Note: In a real implementation, you'd need the actual file path
      content.push(`# Track ID: ${track.trackId}`);
      content.push('');
    }

    writeFileSync(filePath, content.join('\n'), 'utf8');
  }

  private async exportPLS(playlist: Playlist, tracks: PlaylistTrack[], filePath: string): Promise<void> {
    const content = [
      '[playlist]',
      ''
    ];

    tracks.forEach((track, index) => {
      const num = index + 1;
      content.push(`File${num}=# Track ID: ${track.trackId}`);
      content.push(`Title${num}=${(track as any).artist} - ${(track as any).title}`);
      content.push(`Length${num}=${Math.floor((track as any).duration || 0)}`);
      content.push('');
    });

    content.push(`NumberOfEntries=${tracks.length}`);
    content.push('Version=2');

    writeFileSync(filePath, content.join('\n'), 'utf8');
  }

  private async exportXSPF(playlist: Playlist, tracks: PlaylistTrack[], filePath: string): Promise<void> {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<playlist version="1" xmlns="http://xspf.org/ns/0/">',
      `  <title>${playlist.name}</title>`,
      '  <trackList>'
    ];

    for (const track of tracks) {
      xml.push('    <track>');
      xml.push(`      <title>${(track as any).title || ''}</title>`);
      xml.push(`      <creator>${(track as any).artist || ''}</creator>`);
      xml.push(`      <album>${(track as any).album || ''}</album>`);
      xml.push(`      <duration>${Math.floor(((track as any).duration || 0) * 1000)}</duration>`);
      xml.push(`      <annotation>Track ID: ${track.trackId}</annotation>`);
      xml.push('    </track>');
    }

    xml.push('  </trackList>');
    xml.push('</playlist>');

    writeFileSync(filePath, xml.join('\n'), 'utf8');
  }

  private async exportJSON(playlist: Playlist, tracks: PlaylistTrack[], filePath: string): Promise<void> {
    const data = {
      playlist,
      tracks,
      exportedAt: Date.now(),
      version: '1.0'
    };

    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  // ===== UTILITY METHODS =====

  private async updatePlaylistStats(playlistId: string): Promise<void> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as track_count, SUM(af.duration) as total_duration
      FROM playlist_tracks pt
      JOIN audio_files af ON pt.track_id = af.id
      WHERE pt.playlist_id = ?
    `);

    const stats = stmt.get(playlistId) as any;

    this.db.prepare(`
      UPDATE playlists_v2 
      SET track_count = ?, total_duration = ?, updated_at = ?
      WHERE id = ?
    `).run(
      stats.track_count || 0,
      stats.total_duration || 0,
      Date.now(),
      playlistId
    );
  }

  private mapRowToPlaylist(row: any): Playlist {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      coverArt: row.cover_art,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      isPublic: row.is_public === 1,
      isSmart: row.is_smart === 1,
      trackCount: row.track_count || 0,
      totalDuration: row.total_duration || 0,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      color: row.color,
      sortOrder: row.sort_order
    };
  }

  async getStats(): Promise<PlaylistStats> {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM playlists_v2');
    const totalPlaylists = (totalStmt.get() as any).count;

    const tracksStmt = this.db.prepare('SELECT SUM(track_count) as count FROM playlists_v2');
    const totalTracks = (tracksStmt.get() as any).count || 0;

    const avgStmt = this.db.prepare('SELECT AVG(track_count) as avg FROM playlists_v2');
    const averagePlaylistLength = (avgStmt.get() as any).avg || 0;

    const longestStmt = this.db.prepare(`
      SELECT id, name, track_count 
      FROM playlists_v2 
      ORDER BY track_count DESC 
      LIMIT 1
    `);
    const longestPlaylist = longestStmt.get() as any;

    return {
      totalPlaylists,
      totalTracks,
      averagePlaylistLength: Math.round(averagePlaylistLength),
      longestPlaylist: longestPlaylist ? {
        id: longestPlaylist.id,
        name: longestPlaylist.name,
        trackCount: longestPlaylist.track_count
      } : { id: '', name: '', trackCount: 0 },
      mostPopularGenres: [], // Would need genre analysis
      recentActivity: [] // Would need activity tracking
    };
  }

  // ===== SHARING FUNCTIONALITY =====

  async createPlaylistShare(
    playlistId: string,
    permissions: SharePermission[],
    expiresAt?: number
  ): Promise<PlaylistShare> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    if (!playlist.isPublic) {
      throw new Error('Only public playlists can be shared');
    }

    const shareToken = generateShareToken();
    const now = Date.now();

    const share: PlaylistShare = {
      id: generatePlaylistId(),
      playlistId,
      shareToken,
      expiresAt,
      permissions,
      createdAt: now,
      accessCount: 0
    };

    const stmt = this.db.prepare(`
      INSERT INTO playlist_shares 
      (id, playlist_id, share_token, expires_at, permissions, created_at, access_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      share.id,
      share.playlistId,
      share.shareToken,
      share.expiresAt,
      JSON.stringify(share.permissions),
      share.createdAt,
      share.accessCount
    );

    log.info(`Created share for playlist ${playlistId}: ${shareToken}`);
    return share;
  }

  async getPlaylistShare(shareToken: string): Promise<PlaylistShare | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM playlist_shares 
      WHERE share_token = ? AND (expires_at IS NULL OR expires_at > ?)
    `);

    const row = stmt.get(shareToken, Date.now()) as any;
    if (!row) return null;

    // Increment access count
    this.db.prepare(`
      UPDATE playlist_shares SET access_count = access_count + 1 WHERE share_token = ?
    `).run(shareToken);

    return {
      id: row.id,
      playlistId: row.playlist_id,
      shareToken: row.share_token,
      expiresAt: row.expires_at,
      permissions: JSON.parse(row.permissions),
      createdAt: row.created_at,
      accessCount: row.access_count + 1
    };
  }

  async getPlaylistShares(playlistId: string): Promise<PlaylistShare[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM playlist_shares 
      WHERE playlist_id = ? 
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(playlistId) as any[];
    return rows.map(row => ({
      id: row.id,
      playlistId: row.playlist_id,
      shareToken: row.share_token,
      expiresAt: row.expires_at,
      permissions: JSON.parse(row.permissions),
      createdAt: row.created_at,
      accessCount: row.access_count
    }));
  }

  async revokePlaylistShare(shareToken: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM playlist_shares WHERE share_token = ?');
    const result = stmt.run(shareToken);

    if (result.changes === 0) {
      throw new Error(`Share not found: ${shareToken}`);
    }

    log.info(`Revoked playlist share: ${shareToken}`);
  }

  async cleanExpiredShares(): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM playlist_shares 
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `);

    const result = stmt.run(Date.now());
    log.info(`Cleaned ${result.changes} expired playlist shares`);
    return result.changes;
  }

  // ===== IMPORT FUNCTIONALITY =====

  async importPlaylist(filePath: string, name?: string): Promise<Playlist> {
    const ext = extname(filePath).toLowerCase();
    const content = readFileSync(filePath, 'utf8');

    let tracks: number[] = [];
    let playlistName = name || 'Imported Playlist';

    switch (ext) {
      case '.m3u':
      case '.m3u8':
        const importedM3U = this.parseM3U(content);
        playlistName = importedM3U.name || playlistName;
        tracks = await this.resolveTrackPaths(importedM3U.tracks);
        break;

      case '.pls':
        const importedPLS = this.parsePLS(content);
        playlistName = importedPLS.name || playlistName;
        tracks = await this.resolveTrackPaths(importedPLS.tracks);
        break;

      case '.xspf':
        const importedXSPF = this.parseXSPF(content);
        playlistName = importedXSPF.name || playlistName;
        tracks = await this.resolveTrackPaths(importedXSPF.tracks);
        break;

      case '.json':
        const importedJSON = JSON.parse(content);
        if (importedJSON.playlist && importedJSON.tracks) {
          playlistName = importedJSON.playlist.name || playlistName;
          tracks = importedJSON.tracks.map((t: any) => t.trackId).filter((id: any) => id);
        }
        break;

      default:
        throw new Error(`Unsupported import format: ${ext}`);
    }

    // Create playlist
    const playlist = await this.createPlaylist({
      name: playlistName,
      description: `Imported from ${filePath}`
    });

    // Add tracks if any were resolved
    if (tracks.length > 0) {
      await this.addTracksToPlaylist(playlist.id, tracks);
    }

    log.info(`Imported playlist ${playlistName} with ${tracks.length} tracks`);
    return playlist;
  }

  private parseM3U(content: string): { name?: string; tracks: string[] } {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const tracks: string[] = [];
    let name: string | undefined;

    for (const line of lines) {
      if (line.startsWith('#PLAYLIST:')) {
        name = line.substring(10);
      } else if (!line.startsWith('#') && line.length > 0) {
        tracks.push(line);
      }
    }

    return { name, tracks };
  }

  private parsePLS(content: string): { name?: string; tracks: string[] } {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const tracks: string[] = [];
    let name: string | undefined;

    for (const line of lines) {
      if (line.toLowerCase().startsWith('file') && line.includes('=')) {
        const filePath = line.split('=', 2)[1];
        tracks.push(filePath);
      }
    }

    return { name, tracks };
  }

  private parseXSPF(content: string): { name?: string; tracks: string[] } {
    // Basic XML parsing for XSPF - in production, use a proper XML parser
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const name = titleMatch ? titleMatch[1] : undefined;
    
    const tracks: string[] = [];
    const locationMatches = content.match(/<location>(.*?)<\/location>/g);
    
    if (locationMatches) {
      for (const match of locationMatches) {
        const location = match.replace(/<\/?location>/g, '');
        tracks.push(location);
      }
    }

    return { name, tracks };
  }

  private async resolveTrackPaths(paths: string[]): Promise<number[]> {
    const trackIds: number[] = [];
    
    for (const path of paths) {
      if (path.startsWith('# Track ID:')) {
        // Handle our own export format
        const trackId = parseInt(path.replace('# Track ID:', '').trim());
        if (!isNaN(trackId)) {
          trackIds.push(trackId);
        }
      } else {
        // Try to find track by file path
        const stmt = this.db.prepare('SELECT id FROM audio_files WHERE filePath = ?');
        const result = stmt.get(path) as any;
        if (result) {
          trackIds.push(result.id);
        }
      }
    }

    return trackIds;
  }

  // ===== UTILITY METHODS FOR TEMPLATES =====

  async createSmartPlaylistFromTemplate(
    templateKey: keyof typeof SMART_PLAYLIST_TEMPLATES,
    customName?: string
  ): Promise<Playlist> {
    const template = SMART_PLAYLIST_TEMPLATES[templateKey];
    
    return await this.createSmartPlaylist(
      {
        name: customName || template.name,
        description: template.description
      },
      template.criteria,
      {
        maxTracks: template.maxTracks,
        sortBy: template.sortBy,
        sortDirection: template.sortDirection,
        autoUpdate: template.autoUpdate
      }
    );
  }

  async updateAllAutoUpdatePlaylists(): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT playlist_id FROM smart_playlists WHERE auto_update = 1
    `);
    
    const smartPlaylists = stmt.all() as any[];
    let updatedCount = 0;

    for (const smartPlaylist of smartPlaylists) {
      try {
        await this.updateSmartPlaylist(smartPlaylist.playlist_id);
        updatedCount++;
      } catch (error) {
        log.error(`Failed to update smart playlist ${smartPlaylist.playlist_id}:`, error);
      }
    }

    log.info(`Updated ${updatedCount} auto-update smart playlists`);
    return updatedCount;
  }

  // ===== DATABASE ACCESS =====
  
  getDatabase(): Database.Database {
    return this.db;
  }
}