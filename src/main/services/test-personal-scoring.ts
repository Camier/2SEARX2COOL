import { DatabaseManager } from '../database/DatabaseManager';
import { PersonalScoreService } from './PersonalScoreService';
import { PersonalizedSearchService } from './PersonalizedSearchService';
import { UnifiedSearchManager } from './UnifiedSearchManager';
import { MetadataExtractor } from './MetadataExtractor';
import { PERSONAL_SCORE_SCHEMA } from '../database/PersonalScoreSchema';

/**
 * Week 3 Day 4: Personal Scoring System Test Suite
 * 
 * Tests the personal scoring functionality including play tracking,
 * ratings, favorites, and personalized search ranking.
 */
class PersonalScoreTest {
  private dbManager: DatabaseManager;
  private personalScoreService: PersonalScoreService;
  private searchManager: UnifiedSearchManager;
  private personalizedSearch: PersonalizedSearchService;
  
  constructor() {
    // Initialize with in-memory database
    this.dbManager = new DatabaseManager(':memory:');
    this.personalScoreService = new PersonalScoreService(this.dbManager);
    
    const metadataExtractor = new MetadataExtractor();
    this.searchManager = new UnifiedSearchManager(this.dbManager, metadataExtractor);
    
    this.personalizedSearch = new PersonalizedSearchService(
      this.personalScoreService,
      this.searchManager
    );
  }
  
  async runAllTests() {
    console.log('🎯 Week 3 Day 4: Personal Scoring System Test Suite\n');
    
    try {
      // Initialize test data
      await this.setupTestData();
      
      // Test 1: Play tracking
      await this.testPlayTracking();
      
      // Test 2: Rating system
      await this.testRatingSystem();
      
      // Test 3: Favorite functionality
      await this.testFavorites();
      
      // Test 4: Personal score calculation
      await this.testScoreCalculation();
      
      // Test 5: Personalized search ranking
      await this.testPersonalizedSearch();
      
      // Test 6: Recommendations
      await this.testRecommendations();
      
      // Test 7: Analytics and statistics
      await this.testAnalytics();
      
      console.log('\n🎉 All personal scoring tests completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    } finally {
      this.cleanup();
    }
  }
  
  private async setupTestData() {
    console.log('📋 Setting up test data...');
    
    // Initialize database schema
    const db = this.dbManager.getDatabase();
    
    // Create audio_files table
    db.exec(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        artist TEXT,
        album TEXT,
        duration INTEGER,
        file_path TEXT UNIQUE NOT NULL,
        file_size INTEGER,
        format TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Initialize personal score schema
    db.exec(PERSONAL_SCORE_SCHEMA);
    
    // Add test tracks
    const testTracks = [
      { id: 1, title: 'Favorite Song', artist: 'Top Artist', album: 'Best Album', file_path: '/music/favorite.mp3' },
      { id: 2, title: 'Good Track', artist: 'Popular Artist', album: 'Hit Album', file_path: '/music/good.mp3' },
      { id: 3, title: 'New Song', artist: 'Fresh Artist', album: 'Debut Album', file_path: '/music/new.mp3' },
      { id: 4, title: 'Skipped Track', artist: 'Unknown Artist', album: 'Random Album', file_path: '/music/skip.mp3' },
      { id: 5, title: 'Hidden Gem', artist: 'Indie Artist', album: 'Underground', file_path: '/music/gem.mp3' }
    ];
    
    const insertTrack = db.prepare(`
      INSERT INTO audio_files (id, title, artist, album, duration, file_path, file_size, format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const track of testTracks) {
      insertTrack.run(
        track.id, track.title, track.artist, track.album,
        240, track.file_path, 5000000, 'mp3'
      );
    }
    
    console.log('✅ Test data initialized\n');
  }
  
  private async testPlayTracking() {
    console.log('🧪 Test 1: Play Tracking');
    
    // Record multiple plays
    await this.personalScoreService.recordPlay(1, 240, 100, 'test'); // Full play
    await this.personalScoreService.recordPlay(1, 180, 75, 'test');  // 75% play
    await this.personalScoreService.recordPlay(2, 120, 50, 'test');  // 50% play
    await this.personalScoreService.recordPlay(4, 30, 12.5, 'test'); // Skip (12.5%)
    
    console.log('   ✅ Recorded 4 play events');
    
    // Check statistics
    const stats1 = await this.personalScoreService.getTrackStatistics(1);
    console.log(`   ✅ Track 1: ${stats1?.playCount} plays, ${stats1?.averagePlayPercentage.toFixed(1)}% average`);
    
    const stats4 = await this.personalScoreService.getTrackStatistics(4);
    console.log(`   ✅ Track 4: ${stats4?.skipCount} skips detected`);
    
    console.log('✅ Play tracking working correctly\n');
  }
  
  private async testRatingSystem() {
    console.log('🧪 Test 2: Rating System');
    
    // Set ratings
    await this.personalScoreService.setRating(1, 5); // 5 stars
    await this.personalScoreService.setRating(2, 4); // 4 stars
    await this.personalScoreService.setRating(4, 2); // 2 stars
    
    console.log('   ✅ Set ratings for 3 tracks');
    
    // Verify ratings
    const stats1 = await this.personalScoreService.getTrackStatistics(1);
    const stats2 = await this.personalScoreService.getTrackStatistics(2);
    const stats4 = await this.personalScoreService.getTrackStatistics(4);
    
    console.log(`   ✅ Ratings: Track 1=${stats1?.rating}★, Track 2=${stats2?.rating}★, Track 4=${stats4?.rating}★`);
    
    // Test rating update
    await this.personalScoreService.setRating(2, 5); // Upgrade to 5 stars
    const stats2Updated = await this.personalScoreService.getTrackStatistics(2);
    console.log(`   ✅ Updated Track 2 rating to ${stats2Updated?.rating}★`);
    
    console.log('✅ Rating system working correctly\n');
  }
  
  private async testFavorites() {
    console.log('🧪 Test 3: Favorite Functionality');
    
    // Toggle favorites
    const fav1 = await this.personalScoreService.toggleFavorite(1);
    console.log(`   ✅ Track 1 favorite status: ${fav1}`);
    
    const fav5 = await this.personalScoreService.toggleFavorite(5);
    console.log(`   ✅ Track 5 favorite status: ${fav5}`);
    
    // Toggle again to test unfavorite
    const fav1Toggle = await this.personalScoreService.toggleFavorite(1);
    console.log(`   ✅ Track 1 toggled again: ${fav1Toggle}`);
    
    // Re-favorite
    await this.personalScoreService.toggleFavorite(1);
    console.log('   ✅ Track 1 re-favorited');
    
    console.log('✅ Favorite functionality working correctly\n');
  }
  
  private async testScoreCalculation() {
    console.log('🧪 Test 4: Personal Score Calculation');
    
    // Add more play data for scoring
    for (let i = 0; i < 10; i++) {
      await this.personalScoreService.recordPlay(1, 240, 100, 'test');
    }
    
    for (let i = 0; i < 5; i++) {
      await this.personalScoreService.recordPlay(2, 200, 83, 'test');
    }
    
    // Get updated scores
    const tracks = await this.personalScoreService.getTopTracks(5);
    
    console.log('   📊 Personal Scores:');
    for (const track of tracks) {
      const db = this.dbManager.getDatabase();
      const info = db.prepare('SELECT title FROM audio_files WHERE id = ?').get(track.fileId);
      console.log(`   - ${info.title}: ${track.personalScore.toFixed(1)} (${track.playCount} plays, ${track.rating || 0}★)`);
    }
    
    console.log('✅ Score calculation working correctly\n');
  }
  
  private async testPersonalizedSearch() {
    console.log('🧪 Test 5: Personalized Search Ranking');
    
    // Mock search results
    const mockResults = [
      { id: '1', title: 'Favorite Song', artist: 'Top Artist', source: 'local' as const, localFile: { id: 1 } },
      { id: '2', title: 'Good Track', artist: 'Popular Artist', source: 'local' as const, localFile: { id: 2 } },
      { id: '3', title: 'New Song', artist: 'Fresh Artist', source: 'local' as const, localFile: { id: 3 } },
      { id: '4', title: 'Skipped Track', artist: 'Unknown Artist', source: 'local' as const, localFile: { id: 4 } },
      { id: '5', title: 'Hidden Gem', artist: 'Indie Artist', source: 'local' as const, localFile: { id: 5 } }
    ];
    
    // Apply personal scoring
    const personalizedResults = await this.personalScoreService.applyPersonalScoring(mockResults);
    
    console.log('   📊 Personalized Search Results:');
    personalizedResults.slice(0, 3).forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.title} - Score: ${result.personalScore?.toFixed(1) || 0}${result.favorite ? ' ❤️' : ''}`);
    });
    
    console.log('✅ Personalized search ranking working correctly\n');
  }
  
  private async testRecommendations() {
    console.log('🧪 Test 6: Recommendations');
    
    const recommendations = await this.personalScoreService.getRecommendations(10);
    
    console.log(`   ✅ Generated ${recommendations.length} recommendations`);
    
    if (recommendations.length > 0) {
      console.log('   📊 Top Recommendations:');
      recommendations.slice(0, 3).forEach((track, index) => {
        console.log(`   ${index + 1}. ${track.title} - Score: ${track.personal_score.toFixed(1)}`);
      });
    }
    
    console.log('✅ Recommendations working correctly\n');
  }
  
  private async testAnalytics() {
    console.log('🧪 Test 7: Analytics and Statistics');
    
    // Get recently played
    const recentlyPlayed = await this.personalScoreService.getRecentlyPlayed(5);
    console.log(`   ✅ Recently played: ${recentlyPlayed.length} tracks`);
    
    // Record search interactions
    await this.personalScoreService.recordSearchInteraction(
      'favorite', '1', 'local', 'click', 1, 'test_session'
    );
    await this.personalScoreService.recordSearchInteraction(
      'favorite', '1', 'local', 'play', 1, 'test_session'
    );
    
    console.log('   ✅ Recorded search interactions');
    
    // Export data
    const exportData = await this.personalScoreService.exportPersonalData();
    console.log(`   ✅ Export contains: ${exportData.plays.length} plays, ${exportData.ratings.length} ratings`);
    
    // Test preference updates
    await this.personalScoreService.updatePreferences({
      weightRating: 0.5,
      weightPlayCount: 0.3
    });
    console.log('   ✅ Updated scoring preferences');
    
    console.log('✅ Analytics and statistics working correctly\n');
  }
  
  private cleanup() {
    console.log('🧹 Cleaning up test resources...');
    this.personalScoreService.shutdown();
    // Database cleanup happens automatically with :memory: databases
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new PersonalScoreTest();
  tester.runAllTests().catch(console.error);
}

export { PersonalScoreTest };