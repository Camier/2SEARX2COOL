import { DatabaseManager } from '../database/DatabaseManager';
import { 
  AudioFile, 
  Album, 
  Artist, 
  LibraryFilter, 
  LibrarySortOptions, 
  LibraryViewOptions,
  LibraryStats 
} from '../database/LibrarySchema';
import * as path from 'path';
import log from 'electron-log';

export interface LibraryPage<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface BatchUpdateOptions {
  ids: number[];
  updates: {
    rating?: number;
    isFavorite?: boolean;
    genre?: string;
    year?: number;
  };
}

/**
 * Week 4 Day 3: Library Management Service
 * 
 * Provides comprehensive library browsing, filtering, and management
 * capabilities with support for multiple view modes and virtual scrolling.
 */
export class LibraryService {
  private db: DatabaseManager;
  
  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager;
  }
  
  /**
   * Get paginated library items based on view options and filters
   */
  async getLibraryPage(
    viewOptions: LibraryViewOptions,
    filter?: LibraryFilter,
    sort?: LibrarySortOptions
  ): Promise<LibraryPage<AudioFile | Album | Artist>> {
    const startTime = Date.now();
    
    try {
      switch (viewOptions.view) {
        case 'tracks':
          return await this.getTracksPage(viewOptions, filter, sort);
        case 'albums':
          return await this.getAlbumsPage(viewOptions, filter, sort);
        case 'artists':
          return await this.getArtistsPage(viewOptions, filter, sort);
        case 'genres':
          return await this.getGenresPage(viewOptions, filter, sort);
        default:
          throw new Error(`Unknown view type: ${viewOptions.view}`);
      }
    } finally {
      const duration = Date.now() - startTime;
      log.debug(`Library page fetched in ${duration}ms`);
    }
  }
  
  /**
   * Get paginated tracks with filtering and sorting
   */
  private async getTracksPage(
    viewOptions: LibraryViewOptions,
    filter?: LibraryFilter,
    sort?: LibrarySortOptions
  ): Promise<LibraryPage<AudioFile>> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    // Build WHERE clause
    const { whereClause, params } = this.buildWhereClause(filter);
    
    // Build ORDER BY clause
    const orderBy = sort 
      ? `ORDER BY ${this.sanitizeColumn(sort.field)} ${sort.direction.toUpperCase()}`
      : 'ORDER BY artist, album, track, title';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM audio_files 
      ${whereClause}
    `;
    const totalItems = db.prepare(countQuery).get(...params).count;
    
    // Calculate pagination
    const { page, itemsPerPage } = viewOptions;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const offset = (page - 1) * itemsPerPage;
    
    // Get paginated results
    const query = `
      SELECT 
        id, title, artist, album, album_artist as albumArtist,
        genre, year, track, disc, composer,
        file_path as filePath, file_name as fileName, file_size as fileSize,
        format, bitrate, sample_rate as sampleRate, channels,
        duration, date_added as dateAdded, last_modified as lastModified,
        last_played as lastPlayed, play_count as playCount, rating,
        is_favorite as isFavorite, personal_score as personalScore,
        album_art as albumArt, mood
      FROM audio_files
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const items = db.prepare(query).all(...params, itemsPerPage, offset) as AudioFile[];
    
    return {
      items,
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }
  
  /**
   * Get paginated albums
   */
  private async getAlbumsPage(
    viewOptions: LibraryViewOptions,
    filter?: LibraryFilter,
    sort?: LibrarySortOptions
  ): Promise<LibraryPage<Album>> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    // Build filter for albums view
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    
    if (filter) {
      if (filter.searchQuery) {
        conditions.push('(name LIKE ? OR artist LIKE ?)');
        params.push(`%${filter.searchQuery}%`, `%${filter.searchQuery}%`);
      }
      
      if (filter.artists?.length) {
        conditions.push(`artist IN (${filter.artists.map(() => '?').join(',')})`);
        params.push(...filter.artists);
      }
      
      if (filter.genres?.length) {
        conditions.push(`genre IN (${filter.genres.map(() => '?').join(',')})`);
        params.push(...filter.genres);
      }
      
      if (filter.years?.length) {
        conditions.push(`year IN (${filter.years.map(() => '?').join(',')})`);
        params.push(...filter.years);
      }
      
      if (filter.minRating !== undefined) {
        conditions.push('avg_rating >= ?');
        params.push(filter.minRating);
      }
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Default sort for albums
    const orderBy = sort
      ? `ORDER BY ${this.sanitizeAlbumColumn(sort.field)} ${sort.direction.toUpperCase()}`
      : 'ORDER BY artist, year DESC, name';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM albums ${whereClause}`;
    const totalItems = db.prepare(countQuery).get(...params).count;
    
    // Calculate pagination
    const { page, itemsPerPage } = viewOptions;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const offset = (page - 1) * itemsPerPage;
    
    // Get paginated results
    const query = `
      SELECT 
        id, name, artist, year, genre,
        album_art as albumArt, track_count as trackCount,
        total_duration as totalDuration, date_added as dateAdded,
        avg_rating as avgRating, total_play_count as totalPlayCount
      FROM albums
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const items = db.prepare(query).all(...params, itemsPerPage, offset) as Album[];
    
    return {
      items,
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }
  
  /**
   * Get paginated artists
   */
  private async getArtistsPage(
    viewOptions: LibraryViewOptions,
    filter?: LibraryFilter,
    sort?: LibrarySortOptions
  ): Promise<LibraryPage<Artist>> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    // Similar implementation to albums
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    
    if (filter) {
      if (filter.searchQuery) {
        conditions.push('name LIKE ?');
        params.push(`%${filter.searchQuery}%`);
      }
      
      if (filter.genres?.length) {
        // Artists can have multiple genres
        const genreConditions = filter.genres.map(() => 'genre LIKE ?');
        conditions.push(`(${genreConditions.join(' OR ')})`);
        params.push(...filter.genres.map(g => `%${g}%`));
      }
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const orderBy = sort
      ? `ORDER BY ${this.sanitizeArtistColumn(sort.field)} ${sort.direction.toUpperCase()}`
      : 'ORDER BY name';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM artists ${whereClause}`;
    const totalItems = db.prepare(countQuery).get(...params).count;
    
    // Calculate pagination
    const { page, itemsPerPage } = viewOptions;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const offset = (page - 1) * itemsPerPage;
    
    // Get paginated results
    const query = `
      SELECT 
        id, name, genre, album_count as albumCount,
        track_count as trackCount, total_duration as totalDuration,
        avg_rating as avgRating, total_play_count as totalPlayCount
      FROM artists
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const items = db.prepare(query).all(...params, itemsPerPage, offset) as Artist[];
    
    return {
      items,
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }
  
  /**
   * Get genres with track counts
   */
  private async getGenresPage(
    viewOptions: LibraryViewOptions,
    filter?: LibraryFilter,
    sort?: LibrarySortOptions
  ): Promise<LibraryPage<any>> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    // Genre aggregation query
    const query = `
      SELECT 
        genre as name,
        COUNT(*) as trackCount,
        COUNT(DISTINCT artist) as artistCount,
        COUNT(DISTINCT album) as albumCount,
        SUM(duration) as totalDuration,
        AVG(rating) as avgRating,
        SUM(play_count) as totalPlayCount
      FROM audio_files
      WHERE genre IS NOT NULL
      GROUP BY genre
      ORDER BY ${sort?.field === 'title' ? 'name' : 'trackCount'} ${sort?.direction || 'DESC'}
    `;
    
    const allGenres = db.prepare(query).all();
    
    // Apply pagination
    const { page, itemsPerPage } = viewOptions;
    const totalItems = allGenres.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const offset = (page - 1) * itemsPerPage;
    
    const items = allGenres.slice(offset, offset + itemsPerPage);
    
    return {
      items,
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }
  
  /**
   * Build WHERE clause from filters
   */
  private buildWhereClause(filter?: LibraryFilter): { whereClause: string; params: any[] } {
    if (!filter) return { whereClause: '', params: [] };
    
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Text search using FTS
    if (filter.searchQuery) {
      conditions.push(`
        id IN (
          SELECT rowid FROM audio_files_fts 
          WHERE audio_files_fts MATCH ?
        )
      `);
      params.push(filter.searchQuery);
    }
    
    // Category filters
    if (filter.artists?.length) {
      conditions.push(`artist IN (${filter.artists.map(() => '?').join(',')})`);
      params.push(...filter.artists);
    }
    
    if (filter.albums?.length) {
      conditions.push(`album IN (${filter.albums.map(() => '?').join(',')})`);
      params.push(...filter.albums);
    }
    
    if (filter.genres?.length) {
      conditions.push(`genre IN (${filter.genres.map(() => '?').join(',')})`);
      params.push(...filter.genres);
    }
    
    if (filter.years?.length) {
      conditions.push(`year IN (${filter.years.map(() => '?').join(',')})`);
      params.push(...filter.years);
    }
    
    // Range filters
    if (filter.minRating !== undefined) {
      conditions.push('rating >= ?');
      params.push(filter.minRating);
    }
    
    if (filter.maxRating !== undefined) {
      conditions.push('rating <= ?');
      params.push(filter.maxRating);
    }
    
    if (filter.minYear !== undefined) {
      conditions.push('year >= ?');
      params.push(filter.minYear);
    }
    
    if (filter.maxYear !== undefined) {
      conditions.push('year <= ?');
      params.push(filter.maxYear);
    }
    
    if (filter.minDuration !== undefined) {
      conditions.push('duration >= ?');
      params.push(filter.minDuration);
    }
    
    if (filter.maxDuration !== undefined) {
      conditions.push('duration <= ?');
      params.push(filter.maxDuration);
    }
    
    // Boolean filters
    if (filter.favorites !== undefined) {
      conditions.push('is_favorite = ?');
      params.push(filter.favorites ? 1 : 0);
    }
    
    if (filter.unrated) {
      conditions.push('rating IS NULL');
    }
    
    if (filter.recentlyAdded) {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      conditions.push('date_added >= ?');
      params.push(thirtyDaysAgo);
    }
    
    if (filter.recentlyPlayed) {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      conditions.push('last_played >= ?');
      params.push(sevenDaysAgo);
    }
    
    // Special filters
    if (filter.hasLyrics) {
      conditions.push('lyrics IS NOT NULL');
    }
    
    if (filter.hasAlbumArt) {
      conditions.push('album_art IS NOT NULL');
    }
    
    if (filter.fileFormats?.length) {
      conditions.push(`format IN (${filter.fileFormats.map(() => '?').join(',')})`);
      params.push(...filter.fileFormats);
    }
    
    // Always filter out inactive files
    conditions.push('is_active = 1');
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return { whereClause, params };
  }
  
  /**
   * Get distinct values for filter options
   */
  async getFilterOptions(): Promise<{
    artists: string[];
    albums: string[];
    genres: string[];
    years: number[];
    formats: string[];
  }> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    const [artists, albums, genres, years, formats] = await Promise.all([
      db.prepare('SELECT DISTINCT artist FROM audio_files WHERE artist IS NOT NULL ORDER BY artist').all().map(r => r.artist),
      db.prepare('SELECT DISTINCT album FROM audio_files WHERE album IS NOT NULL ORDER BY album').all().map(r => r.album),
      db.prepare('SELECT DISTINCT genre FROM audio_files WHERE genre IS NOT NULL ORDER BY genre').all().map(r => r.genre),
      db.prepare('SELECT DISTINCT year FROM audio_files WHERE year IS NOT NULL ORDER BY year DESC').all().map(r => r.year),
      db.prepare('SELECT DISTINCT format FROM audio_files ORDER BY format').all().map(r => r.format)
    ]);
    
    return { artists, albums, genres, years, formats };
  }
  
  /**
   * Get library statistics
   */
  async getLibraryStats(): Promise<LibraryStats> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalTracks,
        COUNT(DISTINCT album) as totalAlbums,
        COUNT(DISTINCT artist) as totalArtists,
        SUM(duration) as totalDuration,
        SUM(file_size) as totalFileSize,
        SUM(play_count) as totalPlayCount,
        AVG(rating) as avgRating,
        SUM(is_favorite) as favoriteCount
      FROM audio_files
      WHERE is_active = 1
    `).get();
    
    // Get format distribution
    const formatDist = db.prepare(`
      SELECT format, COUNT(*) as count
      FROM audio_files
      WHERE is_active = 1
      GROUP BY format
    `).all();
    
    const formatDistribution = formatDist.reduce((acc, row) => {
      acc[row.format] = row.count;
      return acc;
    }, {} as Record<string, number>);
    
    // Get genre distribution
    const genreDist = db.prepare(`
      SELECT genre, COUNT(*) as count
      FROM audio_files
      WHERE is_active = 1 AND genre IS NOT NULL
      GROUP BY genre
    `).all();
    
    const genreDistribution = genreDist.reduce((acc, row) => {
      acc[row.genre] = row.count;
      return acc;
    }, {} as Record<string, number>);
    
    // Get year distribution
    const yearDist = db.prepare(`
      SELECT year, COUNT(*) as count
      FROM audio_files
      WHERE is_active = 1 AND year IS NOT NULL
      GROUP BY year
      ORDER BY year
    `).all();
    
    const yearDistribution = yearDist.reduce((acc, row) => {
      acc[row.year] = row.count;
      return acc;
    }, {} as Record<number, number>);
    
    return {
      ...stats,
      formatDistribution,
      genreDistribution,
      yearDistribution
    };
  }
  
  /**
   * Batch update tracks
   */
  async batchUpdate(options: BatchUpdateOptions): Promise<number> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (options.updates.rating !== undefined) {
      updates.push('rating = ?');
      params.push(options.updates.rating);
    }
    
    if (options.updates.isFavorite !== undefined) {
      updates.push('is_favorite = ?');
      params.push(options.updates.isFavorite ? 1 : 0);
    }
    
    if (options.updates.genre !== undefined) {
      updates.push('genre = ?');
      params.push(options.updates.genre);
    }
    
    if (options.updates.year !== undefined) {
      updates.push('year = ?');
      params.push(options.updates.year);
    }
    
    if (updates.length === 0) return 0;
    
    const query = `
      UPDATE audio_files
      SET ${updates.join(', ')}
      WHERE id IN (${options.ids.map(() => '?').join(',')})
    `;
    
    params.push(...options.ids);
    
    const result = db.prepare(query).run(...params);
    return result.changes;
  }
  
  /**
   * Get track details by ID
   */
  async getTrack(id: number): Promise<AudioFile | null> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    const query = `
      SELECT 
        id, title, artist, album, album_artist as albumArtist,
        genre, year, track, disc, composer,
        file_path as filePath, file_name as fileName, file_size as fileSize,
        format, bitrate, sample_rate as sampleRate, channels,
        duration, date_added as dateAdded, last_modified as lastModified,
        last_played as lastPlayed, play_count as playCount, rating,
        is_favorite as isFavorite, personal_score as personalScore,
        album_art as albumArt, lyrics, comment, bpm, key, mood
      FROM audio_files
      WHERE id = ?
    `;
    
    return db.prepare(query).get(id) as AudioFile | null;
  }
  
  /**
   * Get album details with tracks
   */
  async getAlbumWithTracks(albumName: string, artist: string): Promise<{
    album: Album;
    tracks: AudioFile[];
  } | null> {
    const db = this.db.getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    // Get album info
    const albumQuery = `
      SELECT * FROM albums 
      WHERE name = ? AND artist = ?
    `;
    const album = db.prepare(albumQuery).get(albumName, artist) as Album;
    
    if (!album) return null;
    
    // Get tracks
    const tracksQuery = `
      SELECT 
        id, title, artist, album, album_artist as albumArtist,
        genre, year, track, disc, composer,
        file_path as filePath, file_name as fileName, file_size as fileSize,
        format, bitrate, sample_rate as sampleRate, channels,
        duration, date_added as dateAdded, last_modified as lastModified,
        last_played as lastPlayed, play_count as playCount, rating,
        is_favorite as isFavorite, personal_score as personalScore,
        album_art as albumArt, mood
      FROM audio_files
      WHERE album = ? AND (artist = ? OR album_artist = ?)
      ORDER BY disc, track, title
    `;
    
    const tracks = db.prepare(tracksQuery).all(albumName, artist, artist) as AudioFile[];
    
    return { album, tracks };
  }
  
  /**
   * Sanitize column names to prevent SQL injection
   */
  private sanitizeColumn(column: string): string {
    const allowedColumns = [
      'title', 'artist', 'album', 'date_added', 'last_played',
      'play_count', 'rating', 'duration', 'year', 'genre',
      'personal_score', 'file_name', 'file_size'
    ];
    
    const columnMap: Record<string, string> = {
      'dateAdded': 'date_added',
      'lastPlayed': 'last_played',
      'playCount': 'play_count',
      'personalScore': 'personal_score',
      'fileName': 'file_name',
      'fileSize': 'file_size'
    };
    
    const dbColumn = columnMap[column] || column;
    
    if (!allowedColumns.includes(dbColumn)) {
      throw new Error(`Invalid sort column: ${column}`);
    }
    
    return dbColumn;
  }
  
  private sanitizeAlbumColumn(column: string): string {
    const allowedColumns = ['name', 'artist', 'year', 'track_count', 'avg_rating', 'total_play_count'];
    
    const columnMap: Record<string, string> = {
      'album': 'name',
      'rating': 'avg_rating',
      'playCount': 'total_play_count'
    };
    
    const dbColumn = columnMap[column] || column;
    
    if (!allowedColumns.includes(dbColumn)) {
      return 'name'; // Default sort
    }
    
    return dbColumn;
  }
  
  private sanitizeArtistColumn(column: string): string {
    const allowedColumns = ['name', 'album_count', 'track_count', 'avg_rating', 'total_play_count'];
    
    const columnMap: Record<string, string> = {
      'artist': 'name',
      'rating': 'avg_rating',
      'playCount': 'total_play_count'
    };
    
    const dbColumn = columnMap[column] || column;
    
    if (!allowedColumns.includes(dbColumn)) {
      return 'name'; // Default sort
    }
    
    return dbColumn;
  }
}