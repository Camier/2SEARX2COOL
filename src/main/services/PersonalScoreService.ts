import { DatabaseManager } from '../database/DatabaseManager';
import {
  UserPlay,
  UserRating,
  TrackStatistics,
  SearchInteraction,
  ScoringPreferences,
  DEFAULT_SCORING_PREFERENCES,
  PERSONAL_SCORE_SCHEMA
} from '../database/PersonalScoreSchema';
import EventEmitter from 'events';

/**
 * Week 3 Day 4: Personal Score Service
 * 
 * Manages user interactions, ratings, play counts, and generates
 * personalized scores for tracks based on user behavior.
 */
export class PersonalScoreService extends EventEmitter {
  private db: DatabaseManager;
  private preferences: ScoringPreferences;
  private updateTimer?: NodeJS.Timeout;
  
  constructor(databaseManager: DatabaseManager) {
    super();
    this.db = databaseManager;
    this.preferences = { ...DEFAULT_SCORING_PREFERENCES };
    
    // Initialize schema
    this.initializeSchema();
    
    // Load preferences
    this.loadPreferences();
    
    // Start periodic score updates
    this.startScoreUpdateTimer();
  }
  
  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    try {
      const database = this.db.getDatabase();
      database.exec(PERSONAL_SCORE_SCHEMA);
      console.log('Personal scoring schema initialized');
    } catch (error) {
      console.error('Failed to initialize personal scoring schema:', error);
    }
  }
  
  /**
   * Record a play event
   */
  async recordPlay(
    fileId: number,
    duration?: number,
    percentage?: number,
    context: string = 'unknown'
  ): Promise<void> {
    try {
      const database = this.db.getDatabase();
      const stmt = database.prepare(`
        INSERT INTO user_plays (file_id, play_duration, play_percentage, skipped, context)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const skipped = percentage && percentage < 50;
      stmt.run(fileId, duration, percentage, skipped ? 1 : 0, context);
      
      // Update personal score
      await this.updateTrackScore(fileId);
      
      // Emit event
      this.emit('playRecorded', { fileId, duration, percentage, context });
      
    } catch (error) {
      console.error('Failed to record play:', error);
      throw error;
    }
  }
  
  /**
   * Set user rating for a track
   */
  async setRating(fileId: number, rating: number): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    try {
      const database = this.db.getDatabase();
      const stmt = database.prepare(`
        INSERT OR REPLACE INTO user_ratings (file_id, rating, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(fileId, rating);
      
      // Update personal score
      await this.updateTrackScore(fileId);
      
      // Emit event
      this.emit('ratingSet', { fileId, rating });
      
    } catch (error) {
      console.error('Failed to set rating:', error);
      throw error;
    }
  }
  
  /**
   * Toggle favorite status
   */
  async toggleFavorite(fileId: number): Promise<boolean> {
    try {
      const database = this.db.getDatabase();
      
      // Get current status
      const current = database.prepare(
        'SELECT favorite FROM track_statistics WHERE file_id = ?'
      ).get(fileId);
      
      const newStatus = current ? !current.favorite : true;
      
      // Update favorite status
      database.prepare(`
        INSERT OR REPLACE INTO track_statistics (file_id, favorite)
        VALUES (?, ?)
        ON CONFLICT(file_id) DO UPDATE SET favorite = ?
      `).run(fileId, newStatus ? 1 : 0, newStatus ? 1 : 0);
      
      // Update personal score
      await this.updateTrackScore(fileId);
      
      // Emit event
      this.emit('favoriteToggled', { fileId, favorite: newStatus });
      
      return newStatus;
      
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  }
  
  /**
   * Record search interaction
   */
  async recordSearchInteraction(
    query: string,
    resultId: string,
    resultType: 'local' | 'web',
    interactionType: 'click' | 'play' | 'download' | 'ignore',
    position?: number,
    sessionId?: string
  ): Promise<void> {
    try {
      const database = this.db.getDatabase();
      const stmt = database.prepare(`
        INSERT INTO search_interactions 
        (search_query, result_id, result_type, interaction_type, position, session_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(query, resultId, resultType, interactionType, position, sessionId);
      
      // If it's a local file interaction, update its score
      if (resultType === 'local' && interactionType !== 'ignore') {
        const fileId = parseInt(resultId);
        if (!isNaN(fileId)) {
          await this.updateTrackScore(fileId);
        }
      }
      
    } catch (error) {
      console.error('Failed to record search interaction:', error);
    }
  }
  
  /**
   * Get track statistics
   */
  async getTrackStatistics(fileId: number): Promise<TrackStatistics | null> {
    try {
      const database = this.db.getDatabase();
      const row = database.prepare(`
        SELECT * FROM track_statistics WHERE file_id = ?
      `).get(fileId);
      
      if (!row) return null;
      
      return {
        fileId: row.file_id,
        playCount: row.play_count,
        skipCount: row.skip_count,
        totalPlayTime: row.total_play_time,
        averagePlayPercentage: row.average_play_percentage,
        lastPlayed: row.last_played ? new Date(row.last_played) : undefined,
        firstPlayed: row.first_played ? new Date(row.first_played) : undefined,
        rating: row.rating,
        personalScore: row.personal_score,
        scoreUpdatedAt: row.score_updated_at ? new Date(row.score_updated_at) : undefined,
        favorite: row.favorite === 1
      };
      
    } catch (error) {
      console.error('Failed to get track statistics:', error);
      return null;
    }
  }
  
  /**
   * Get top tracks by personal score
   */
  async getTopTracks(limit: number = 50): Promise<TrackStatistics[]> {
    try {
      const database = this.db.getDatabase();
      const rows = database.prepare(`
        SELECT * FROM track_statistics
        ORDER BY personal_score DESC
        LIMIT ?
      `).all(limit);
      
      return rows.map(row => ({
        fileId: row.file_id,
        playCount: row.play_count,
        skipCount: row.skip_count,
        totalPlayTime: row.total_play_time,
        averagePlayPercentage: row.average_play_percentage,
        lastPlayed: row.last_played ? new Date(row.last_played) : undefined,
        firstPlayed: row.first_played ? new Date(row.first_played) : undefined,
        rating: row.rating,
        personalScore: row.personal_score,
        scoreUpdatedAt: row.score_updated_at ? new Date(row.score_updated_at) : undefined,
        favorite: row.favorite === 1
      }));
      
    } catch (error) {
      console.error('Failed to get top tracks:', error);
      return [];
    }
  }
  
  /**
   * Get recently played tracks
   */
  async getRecentlyPlayed(limit: number = 20): Promise<Array<UserPlay & { trackInfo?: any }>> {
    try {
      const database = this.db.getDatabase();
      const rows = database.prepare(`
        SELECT 
          p.*,
          a.title, a.artist, a.album, a.file_path
        FROM user_plays p
        JOIN audio_files a ON p.file_id = a.id
        ORDER BY p.played_at DESC
        LIMIT ?
      `).all(limit);
      
      return rows.map(row => ({
        id: row.id,
        fileId: row.file_id,
        playedAt: new Date(row.played_at),
        playDuration: row.play_duration,
        playPercentage: row.play_percentage,
        skipped: row.skipped === 1,
        context: row.context,
        trackInfo: {
          title: row.title,
          artist: row.artist,
          album: row.album,
          filePath: row.file_path
        }
      }));
      
    } catch (error) {
      console.error('Failed to get recently played:', error);
      return [];
    }
  }
  
  /**
   * Calculate personal score for a track
   */
  private async updateTrackScore(fileId: number): Promise<number> {
    try {
      const database = this.db.getDatabase();
      
      // Get all relevant data
      const stats = await this.getTrackStatistics(fileId);
      if (!stats) {
        return 0;
      }
      
      // Calculate score components
      const playScore = this.calculatePlayScore(stats.playCount, stats.skipCount);
      const ratingScore = this.calculateRatingScore(stats.rating);
      const recencyScore = this.calculateRecencyScore(stats.lastPlayed);
      const completionScore = this.calculateCompletionScore(stats.averagePlayPercentage);
      
      // Apply weights
      let score = 
        (playScore * this.preferences.weightPlayCount) +
        (ratingScore * this.preferences.weightRating) +
        (recencyScore * this.preferences.weightRecency) +
        (completionScore * this.preferences.weightCompletion);
      
      // Apply favorite boost
      if (stats.favorite) {
        score *= this.preferences.favoriteBoost;
      }
      
      // Normalize to 0-100 range
      score = Math.min(100, Math.max(0, score * 100));
      
      // Update database
      database.prepare(`
        UPDATE track_statistics
        SET personal_score = ?, score_updated_at = CURRENT_TIMESTAMP
        WHERE file_id = ?
      `).run(score, fileId);
      
      return score;
      
    } catch (error) {
      console.error('Failed to update track score:', error);
      return 0;
    }
  }
  
  /**
   * Calculate play count component of score
   */
  private calculatePlayScore(playCount: number, skipCount: number): number {
    if (playCount === 0) return 0;
    
    // Base score from play count (logarithmic scale)
    const baseScore = Math.log10(playCount + 1) / Math.log10(100);
    
    // Apply skip penalty
    const skipRatio = skipCount / playCount;
    const skipMultiplier = 1 - (skipRatio * this.preferences.skipPenalty);
    
    return baseScore * skipMultiplier;
  }
  
  /**
   * Calculate rating component of score
   */
  private calculateRatingScore(rating?: number): number {
    if (!rating) return 0.5; // Neutral score for unrated
    return (rating - 1) / 4; // Normalize 1-5 to 0-1
  }
  
  /**
   * Calculate recency component of score
   */
  private calculateRecencyScore(lastPlayed?: Date): number {
    if (!lastPlayed) return 0;
    
    const daysSincePlay = (Date.now() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-daysSincePlay / this.preferences.recencyDecayDays);
    
    return decayFactor;
  }
  
  /**
   * Calculate completion component of score
   */
  private calculateCompletionScore(averagePercentage: number): number {
    return averagePercentage / 100;
  }
  
  /**
   * Apply personal scores to search results
   */
  async applyPersonalScoring(results: any[]): Promise<any[]> {
    const scoredResults = await Promise.all(
      results.map(async (result) => {
        // Only apply to local results
        if (result.source === 'local' && result.localFile?.id) {
          const stats = await this.getTrackStatistics(result.localFile.id);
          
          if (stats) {
            return {
              ...result,
              personalScore: stats.personalScore,
              playCount: stats.playCount,
              rating: stats.rating,
              favorite: stats.favorite,
              lastPlayed: stats.lastPlayed
            };
          }
        }
        
        return { ...result, personalScore: 0 };
      })
    );
    
    // Sort by personal score (descending) then by original order
    return scoredResults.sort((a, b) => {
      // Favorites always come first
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      
      // Then by personal score
      const scoreDiff = (b.personalScore || 0) - (a.personalScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      
      // Maintain original order for equal scores
      return 0;
    });
  }
  
  /**
   * Get personalized recommendations
   */
  async getRecommendations(limit: number = 20): Promise<any[]> {
    try {
      const database = this.db.getDatabase();
      
      // Get top-rated and frequently played tracks
      const recommendations = database.prepare(`
        SELECT 
          a.*,
          ts.personal_score,
          ts.play_count,
          ts.rating,
          ts.favorite,
          ts.last_played
        FROM audio_files a
        JOIN track_statistics ts ON a.id = ts.file_id
        WHERE ts.personal_score > 50
        ORDER BY ts.personal_score DESC
        LIMIT ?
      `).all(limit);
      
      return recommendations;
      
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      return [];
    }
  }
  
  /**
   * Update scoring preferences
   */
  async updatePreferences(updates: Partial<ScoringPreferences>): Promise<void> {
    try {
      const database = this.db.getDatabase();
      const stmt = database.prepare(`
        INSERT OR REPLACE INTO scoring_preferences (key, value)
        VALUES (?, ?)
      `);
      
      const mappings: Record<keyof ScoringPreferences, string> = {
        weightPlayCount: 'weight_play_count',
        weightRating: 'weight_rating',
        weightRecency: 'weight_recency',
        weightCompletion: 'weight_completion',
        recencyDecayDays: 'recency_decay_days',
        skipPenalty: 'skip_penalty',
        favoriteBoost: 'favorite_boost'
      };
      
      for (const [key, value] of Object.entries(updates)) {
        const dbKey = mappings[key as keyof ScoringPreferences];
        if (dbKey && value !== undefined) {
          stmt.run(dbKey, value);
          this.preferences[key as keyof ScoringPreferences] = value as any;
        }
      }
      
      // Recalculate all scores with new preferences
      await this.recalculateAllScores();
      
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  }
  
  /**
   * Load preferences from database
   */
  private loadPreferences(): void {
    try {
      const database = this.db.getDatabase();
      const rows = database.prepare('SELECT key, value FROM scoring_preferences').all();
      
      for (const row of rows) {
        const keyMap: Record<string, keyof ScoringPreferences> = {
          'weight_play_count': 'weightPlayCount',
          'weight_rating': 'weightRating',
          'weight_recency': 'weightRecency',
          'weight_completion': 'weightCompletion',
          'recency_decay_days': 'recencyDecayDays',
          'skip_penalty': 'skipPenalty',
          'favorite_boost': 'favoriteBoost'
        };
        
        const key = keyMap[row.key];
        if (key) {
          this.preferences[key] = row.value;
        }
      }
      
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }
  
  /**
   * Recalculate all personal scores
   */
  private async recalculateAllScores(): Promise<void> {
    try {
      const database = this.db.getDatabase();
      const fileIds = database.prepare('SELECT DISTINCT file_id FROM track_statistics').all();
      
      for (const row of fileIds) {
        await this.updateTrackScore(row.file_id);
      }
      
      this.emit('scoresRecalculated', { count: fileIds.length });
      
    } catch (error) {
      console.error('Failed to recalculate scores:', error);
    }
  }
  
  /**
   * Start periodic score update timer
   */
  private startScoreUpdateTimer(): void {
    // Update scores every hour for recency decay
    this.updateTimer = setInterval(() => {
      this.recalculateAllScores();
    }, 60 * 60 * 1000);
  }
  
  /**
   * Export personal data
   */
  async exportPersonalData(): Promise<any> {
    try {
      const database = this.db.getDatabase();
      
      return {
        plays: database.prepare('SELECT * FROM user_plays').all(),
        ratings: database.prepare('SELECT * FROM user_ratings').all(),
        statistics: database.prepare('SELECT * FROM track_statistics').all(),
        interactions: database.prepare('SELECT * FROM search_interactions').all(),
        preferences: this.preferences,
        exportedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Failed to export personal data:', error);
      throw error;
    }
  }
  
  /**
   * Import personal data
   */
  async importPersonalData(data: any): Promise<void> {
    // Implementation for importing personal data
    // This would restore plays, ratings, statistics, etc.
  }
  
  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }
}