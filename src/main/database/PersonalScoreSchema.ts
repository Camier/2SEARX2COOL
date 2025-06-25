/**
 * Week 3 Day 4: Personal Scoring Database Schema
 * 
 * Defines tables and indexes for tracking user interactions,
 * play counts, ratings, and personalized scoring data.
 */

export const PERSONAL_SCORE_SCHEMA = `
  -- User interactions table for play history
  CREATE TABLE IF NOT EXISTS user_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    play_duration INTEGER, -- seconds played
    play_percentage REAL, -- percentage of track played (0-100)
    skipped INTEGER DEFAULT 0, -- 1 if track was skipped
    context TEXT, -- search, playlist, album, etc.
    FOREIGN KEY (file_id) REFERENCES audio_files(id) ON DELETE CASCADE
  );

  -- User ratings table
  CREATE TABLE IF NOT EXISTS user_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL UNIQUE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    rated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES audio_files(id) ON DELETE CASCADE
  );

  -- Aggregated statistics for performance
  CREATE TABLE IF NOT EXISTS track_statistics (
    file_id INTEGER PRIMARY KEY,
    play_count INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    total_play_time INTEGER DEFAULT 0, -- total seconds played
    average_play_percentage REAL DEFAULT 0,
    last_played TEXT,
    first_played TEXT,
    rating INTEGER,
    personal_score REAL DEFAULT 0, -- calculated score
    score_updated_at TEXT,
    favorite INTEGER DEFAULT 0, -- quick favorite flag
    FOREIGN KEY (file_id) REFERENCES audio_files(id) ON DELETE CASCADE
  );

  -- Search interaction tracking
  CREATE TABLE IF NOT EXISTS search_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_query TEXT NOT NULL,
    result_id TEXT NOT NULL, -- can be file_id or web result id
    result_type TEXT NOT NULL, -- 'local' or 'web'
    interaction_type TEXT NOT NULL, -- 'click', 'play', 'download', 'ignore'
    interaction_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position INTEGER, -- position in search results
    session_id TEXT -- to group interactions by search session
  );

  -- Personal preferences and weights
  CREATE TABLE IF NOT EXISTS scoring_preferences (
    key TEXT PRIMARY KEY,
    value REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_plays_file_id ON user_plays(file_id);
  CREATE INDEX IF NOT EXISTS idx_plays_played_at ON user_plays(played_at DESC);
  CREATE INDEX IF NOT EXISTS idx_plays_context ON user_plays(context);
  CREATE INDEX IF NOT EXISTS idx_ratings_file_id ON user_ratings(file_id);
  CREATE INDEX IF NOT EXISTS idx_statistics_score ON track_statistics(personal_score DESC);
  CREATE INDEX IF NOT EXISTS idx_statistics_play_count ON track_statistics(play_count DESC);
  CREATE INDEX IF NOT EXISTS idx_statistics_last_played ON track_statistics(last_played DESC);
  CREATE INDEX IF NOT EXISTS idx_statistics_favorite ON track_statistics(favorite);
  CREATE INDEX IF NOT EXISTS idx_search_query ON search_interactions(search_query);
  CREATE INDEX IF NOT EXISTS idx_search_session ON search_interactions(session_id);
  CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_interactions(interaction_at DESC);

  -- Triggers to maintain statistics
  CREATE TRIGGER IF NOT EXISTS update_statistics_on_play
  AFTER INSERT ON user_plays
  BEGIN
    INSERT OR REPLACE INTO track_statistics (
      file_id, play_count, skip_count, total_play_time, 
      average_play_percentage, last_played, first_played
    )
    VALUES (
      NEW.file_id,
      COALESCE((SELECT play_count FROM track_statistics WHERE file_id = NEW.file_id), 0) + 1,
      COALESCE((SELECT skip_count FROM track_statistics WHERE file_id = NEW.file_id), 0) + NEW.skipped,
      COALESCE((SELECT total_play_time FROM track_statistics WHERE file_id = NEW.file_id), 0) + COALESCE(NEW.play_duration, 0),
      (
        SELECT AVG(play_percentage) 
        FROM user_plays 
        WHERE file_id = NEW.file_id 
        AND play_percentage IS NOT NULL
      ),
      NEW.played_at,
      COALESCE(
        (SELECT first_played FROM track_statistics WHERE file_id = NEW.file_id),
        NEW.played_at
      )
    );
  END;

  -- Trigger to sync ratings
  CREATE TRIGGER IF NOT EXISTS sync_rating_to_statistics
  AFTER INSERT OR UPDATE ON user_ratings
  BEGIN
    UPDATE track_statistics 
    SET rating = NEW.rating, score_updated_at = NEW.updated_at
    WHERE file_id = NEW.file_id;
  END;

  -- Default scoring preferences
  INSERT OR IGNORE INTO scoring_preferences (key, value) VALUES
    ('weight_play_count', 0.3),
    ('weight_rating', 0.4),
    ('weight_recency', 0.2),
    ('weight_completion', 0.1),
    ('recency_decay_days', 30),
    ('skip_penalty', 0.5),
    ('favorite_boost', 2.0);
`;

export interface UserPlay {
  id?: number;
  fileId: number;
  playedAt: Date;
  playDuration?: number;
  playPercentage?: number;
  skipped: boolean;
  context?: string;
}

export interface UserRating {
  id?: number;
  fileId: number;
  rating: number; // 1-5
  ratedAt: Date;
  updatedAt: Date;
}

export interface TrackStatistics {
  fileId: number;
  playCount: number;
  skipCount: number;
  totalPlayTime: number;
  averagePlayPercentage: number;
  lastPlayed?: Date;
  firstPlayed?: Date;
  rating?: number;
  personalScore: number;
  scoreUpdatedAt?: Date;
  favorite: boolean;
}

export interface SearchInteraction {
  id?: number;
  searchQuery: string;
  resultId: string;
  resultType: 'local' | 'web';
  interactionType: 'click' | 'play' | 'download' | 'ignore';
  interactionAt: Date;
  position?: number;
  sessionId?: string;
}

export interface ScoringPreferences {
  weightPlayCount: number;
  weightRating: number;
  weightRecency: number;
  weightCompletion: number;
  recencyDecayDays: number;
  skipPenalty: number;
  favoriteBoost: number;
}

export const DEFAULT_SCORING_PREFERENCES: ScoringPreferences = {
  weightPlayCount: 0.3,
  weightRating: 0.4,
  weightRecency: 0.2,
  weightCompletion: 0.1,
  recencyDecayDays: 30,
  skipPenalty: 0.5,
  favoriteBoost: 2.0
};