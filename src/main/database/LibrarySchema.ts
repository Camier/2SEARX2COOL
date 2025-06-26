/**
 * Week 4 Day 3: Library Database Schema
 * 
 * Comprehensive schema for music library management with support for
 * advanced filtering, sorting, and browsing capabilities.
 */

export interface AudioFile {
  id: number;
  // Basic metadata
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
  
  // Additional metadata for filtering
  genre?: string;
  year?: number;
  track?: number;
  disc?: number;
  composer?: string;
  
  // File information
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  
  // Duration and dates
  duration: number; // in seconds
  dateAdded: number; // timestamp
  lastModified: number; // timestamp
  lastPlayed?: number; // timestamp
  
  // User data (from PersonalScoreService)
  playCount: number;
  rating?: number; // 1-5 stars
  isFavorite: boolean;
  personalScore?: number; // calculated score
  
  // Additional metadata
  albumArt?: string; // base64 or file path
  lyrics?: string;
  comment?: string;
  bpm?: number;
  key?: string;
  mood?: string;
  
  // Library management
  isActive: boolean; // false if file is missing
  lastScanned: number; // timestamp
  fingerprint?: string; // audio fingerprint for matching
}

export interface Album {
  id: number;
  name: string;
  artist: string;
  year?: number;
  genre?: string;
  albumArt?: string;
  trackCount: number;
  totalDuration: number;
  dateAdded: number;
  // Aggregated from tracks
  avgRating?: number;
  totalPlayCount: number;
}

export interface Artist {
  id: number;
  name: string;
  genre?: string;
  albumCount: number;
  trackCount: number;
  totalDuration: number;
  // Aggregated from tracks
  avgRating?: number;
  totalPlayCount: number;
}

export interface LibraryFilter {
  // Text search
  searchQuery?: string;
  
  // Category filters
  artists?: string[];
  albums?: string[];
  genres?: string[];
  years?: number[];
  
  // Range filters
  minRating?: number;
  maxRating?: number;
  minYear?: number;
  maxYear?: number;
  minDuration?: number; // seconds
  maxDuration?: number; // seconds
  
  // Boolean filters
  favorites?: boolean;
  unrated?: boolean;
  recentlyAdded?: boolean; // last 30 days
  recentlyPlayed?: boolean; // last 7 days
  
  // Special filters
  hasLyrics?: boolean;
  hasAlbumArt?: boolean;
  fileFormats?: string[];
}

export interface LibrarySortOptions {
  field: 'title' | 'artist' | 'album' | 'dateAdded' | 'lastPlayed' | 
         'playCount' | 'rating' | 'duration' | 'year' | 'genre' |
         'personalScore' | 'fileName' | 'fileSize';
  direction: 'asc' | 'desc';
}

export interface LibraryViewOptions {
  view: 'tracks' | 'albums' | 'artists' | 'genres';
  groupBy?: 'album' | 'artist' | 'genre' | 'year';
  itemsPerPage: number;
  page: number;
}

export interface LibraryStats {
  totalTracks: number;
  totalAlbums: number;
  totalArtists: number;
  totalDuration: number; // seconds
  totalFileSize: number; // bytes
  totalPlayCount: number;
  avgRating: number;
  favoriteCount: number;
  // By format
  formatDistribution: Record<string, number>;
  // By genre
  genreDistribution: Record<string, number>;
  // By year
  yearDistribution: Record<number, number>;
}

export const LIBRARY_SCHEMA_SQL = `
  -- Main audio files table
  CREATE TABLE IF NOT EXISTS audio_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Basic metadata
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    album_artist TEXT,
    
    -- Additional metadata
    genre TEXT,
    year INTEGER,
    track INTEGER,
    disc INTEGER,
    composer TEXT,
    
    -- File information
    file_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    format TEXT NOT NULL,
    bitrate INTEGER,
    sample_rate INTEGER,
    channels INTEGER,
    
    -- Duration and dates
    duration REAL NOT NULL,
    date_added INTEGER NOT NULL,
    last_modified INTEGER NOT NULL,
    last_played INTEGER,
    
    -- User data
    play_count INTEGER DEFAULT 0,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_favorite INTEGER DEFAULT 0,
    personal_score REAL DEFAULT 0,
    
    -- Additional metadata
    album_art TEXT,
    lyrics TEXT,
    comment TEXT,
    bpm INTEGER,
    key TEXT,
    mood TEXT,
    
    -- Library management
    is_active INTEGER DEFAULT 1,
    last_scanned INTEGER NOT NULL,
    fingerprint TEXT,
    
    -- Indexes will be created separately
    CHECK (duration >= 0),
    CHECK (file_size > 0)
  );

  -- Albums view (virtual table for performance)
  CREATE VIEW IF NOT EXISTS albums AS
  SELECT 
    ROW_NUMBER() OVER (ORDER BY album, artist) as id,
    album as name,
    album_artist as artist,
    year,
    genre,
    MAX(album_art) as album_art,
    COUNT(*) as track_count,
    SUM(duration) as total_duration,
    MIN(date_added) as date_added,
    AVG(rating) as avg_rating,
    SUM(play_count) as total_play_count
  FROM audio_files
  WHERE album IS NOT NULL
  GROUP BY album, album_artist;

  -- Artists view
  CREATE VIEW IF NOT EXISTS artists AS
  SELECT
    ROW_NUMBER() OVER (ORDER BY artist) as id,
    artist as name,
    GROUP_CONCAT(DISTINCT genre) as genre,
    COUNT(DISTINCT album) as album_count,
    COUNT(*) as track_count,
    SUM(duration) as total_duration,
    AVG(rating) as avg_rating,
    SUM(play_count) as total_play_count
  FROM audio_files
  GROUP BY artist;

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_audio_files_artist ON audio_files(artist);
  CREATE INDEX IF NOT EXISTS idx_audio_files_album ON audio_files(album);
  CREATE INDEX IF NOT EXISTS idx_audio_files_genre ON audio_files(genre);
  CREATE INDEX IF NOT EXISTS idx_audio_files_year ON audio_files(year);
  CREATE INDEX IF NOT EXISTS idx_audio_files_rating ON audio_files(rating);
  CREATE INDEX IF NOT EXISTS idx_audio_files_play_count ON audio_files(play_count);
  CREATE INDEX IF NOT EXISTS idx_audio_files_date_added ON audio_files(date_added);
  CREATE INDEX IF NOT EXISTS idx_audio_files_last_played ON audio_files(last_played);
  CREATE INDEX IF NOT EXISTS idx_audio_files_personal_score ON audio_files(personal_score);
  CREATE INDEX IF NOT EXISTS idx_audio_files_is_favorite ON audio_files(is_favorite);
  
  -- Full text search index
  CREATE VIRTUAL TABLE IF NOT EXISTS audio_files_fts USING fts5(
    title, artist, album, genre,
    content=audio_files,
    content_rowid=id
  );
  
  -- Triggers to keep FTS index in sync
  CREATE TRIGGER IF NOT EXISTS audio_files_ai AFTER INSERT ON audio_files BEGIN
    INSERT INTO audio_files_fts(rowid, title, artist, album, genre)
    VALUES (new.id, new.title, new.artist, new.album, new.genre);
  END;
  
  CREATE TRIGGER IF NOT EXISTS audio_files_ad AFTER DELETE ON audio_files BEGIN
    DELETE FROM audio_files_fts WHERE rowid = old.id;
  END;
  
  CREATE TRIGGER IF NOT EXISTS audio_files_au AFTER UPDATE ON audio_files BEGIN
    UPDATE audio_files_fts 
    SET title = new.title, artist = new.artist, album = new.album, genre = new.genre
    WHERE rowid = new.id;
  END;
`;