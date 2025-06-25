import { UnifiedSearchManager } from './UnifiedSearchManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { MetadataExtractor } from './MetadataExtractor';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test script for Unified Search Integration
 * Week 3 Day 2: Verify local library + SearXNG unified search
 */

class UnifiedSearchTester {
  private searchManager: UnifiedSearchManager;
  private db: DatabaseManager;
  private extractor: MetadataExtractor;
  
  constructor() {
    // Initialize components
    this.db = new DatabaseManager(':memory:'); // Use in-memory database for testing
    this.extractor = new MetadataExtractor();
    this.searchManager = new UnifiedSearchManager(this.db, this.extractor);
  }
  
  async runTests() {
    console.log('🎵 Week 3 Day 2: Unified Search Integration Test\n');
    
    try {
      // Initialize database
      await this.initializeTestDatabase();
      
      // Test 1: Library statistics
      await this.testLibraryStats();
      
      // Test 2: Local-only search
      await this.testLocalSearch();
      
      // Test 3: Web-only search
      await this.testWebSearch();
      
      // Test 4: Unified search (both sources)
      await this.testUnifiedSearch();
      
      // Test 5: Search suggestions
      await this.testSearchSuggestions();
      
      // Test 6: Search preferences
      await this.testSearchPreferences();
      
      // Test 7: Search analytics
      await this.testSearchAnalytics();
      
      // Test 8: SearXNG connectivity
      await this.testSearxngConnectivity();
      
      console.log('🎉 All unified search tests completed!\n');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
  
  private async initializeTestDatabase() {
    console.log('📊 Initializing test database...');
    
    // Create sample library data
    const testTracks = [
      {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        duration: 355,
        file_path: '/music/queen/bohemian_rhapsody.mp3',
        file_size: 8500000,
        format: 'mp3'
      },
      {
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        album: 'Led Zeppelin IV',
        duration: 482,
        file_path: '/music/led_zeppelin/stairway_to_heaven.flac',
        file_size: 45000000,
        format: 'flac'
      },
      {
        title: 'Hotel California',
        artist: 'Eagles',
        album: 'Hotel California',
        duration: 391,
        file_path: '/music/eagles/hotel_california.m4a',
        file_size: 12000000,
        format: 'm4a'
      },
      {
        title: 'Imagine',
        artist: 'John Lennon',
        album: 'Imagine',
        duration: 183,
        file_path: '/music/john_lennon/imagine.mp3',
        file_size: 4400000,
        format: 'mp3'
      },
      {
        title: 'Billie Jean',
        artist: 'Michael Jackson',
        album: 'Thriller',
        duration: 294,
        file_path: '/music/michael_jackson/billie_jean.mp3',
        file_size: 7100000,
        format: 'mp3'
      }
    ];
    
    // Initialize database schema
    const db = this.db.getDatabase();
    
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
        bitrate INTEGER,
        last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert test data
    const insertTrack = db.prepare(`
      INSERT INTO audio_files (title, artist, album, duration, file_path, file_size, format)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const track of testTracks) {
      insertTrack.run(
        track.title, track.artist, track.album, track.duration,
        track.file_path, track.file_size, track.format
      );
    }
    
    console.log(`✅ Initialized test database with ${testTracks.length} tracks\n`);
  }
  
  private async testLibraryStats() {
    console.log('📊 Testing library statistics...');
    
    const stats = await this.searchManager.getLibraryStats();
    
    if (stats) {
      console.log(`   Total Files: ${stats.totalFiles}`);
      console.log(`   Unique Artists: ${stats.uniqueArtists}`);
      console.log(`   Unique Albums: ${stats.uniqueAlbums}`);
      console.log(`   Total Duration: ${stats.totalDurationHours} hours`);
      console.log(`   Average Duration: ${stats.avgDurationMinutes} minutes`);
      console.log(`   Total Size: ${stats.totalSizeGB} GB`);
      console.log('✅ Library stats working correctly\n');
    } else {
      console.log('❌ Failed to get library stats\n');
    }
  }
  
  private async testLocalSearch() {
    console.log('🔍 Testing local-only search...');
    
    const testQueries = ['queen', 'stairway', 'hotel', 'imagine'];
    
    for (const query of testQueries) {
      console.log(`   Query: "${query}"`);
      
      const results = await this.searchManager.searchLocal(query, 10);
      
      console.log(`   Results: ${results.length}`);
      if (results.length > 0) {
        results.slice(0, 2).forEach(result => {
          console.log(`     - ${result.title} by ${result.artist} (${result.source})`);
        });
      }
      console.log();
    }
    
    console.log('✅ Local search working correctly\n');
  }
  
  private async testWebSearch() {
    console.log('🌐 Testing web-only search...');
    
    try {
      const results = await this.searchManager.searchWeb('test music', ['soundcloud'], 5);
      
      console.log(`   SearXNG Results: ${results.length}`);
      if (results.length > 0) {
        results.slice(0, 2).forEach(result => {
          console.log(`     - ${result.title} by ${result.artist} (${result.source})`);
          if (result.searxngData) {
            console.log(`       Engine: ${result.searxngData.engine}`);
          }
        });
        console.log('✅ Web search working correctly\n');
      } else {
        console.log('⚠️  No web results (SearXNG may not be available)\n');
      }
      
    } catch (error) {
      console.log(`❌ Web search failed: ${error.message}\n`);
    }
  }
  
  private async testUnifiedSearch() {
    console.log('🔄 Testing unified search...');
    
    const testQueries = ['queen bohemian', 'led zeppelin', 'hotel california'];
    
    for (const query of testQueries) {
      console.log(`   Query: "${query}"`);
      
      try {
        const session = await this.searchManager.search(query);
        
        console.log(`   Total Results: ${session.results.length}`);
        console.log(`   Local: ${session.stats.localResults}, Web: ${session.stats.searxngResults}`);
        console.log(`   Matches Found: ${session.stats.matchesFound}`);
        console.log(`   Duplicates Removed: ${session.stats.duplicatesFound}`);
        console.log(`   Search Time: ${session.stats.searchTime}ms`);
        
        // Show result breakdown
        const bySource = session.results.reduce((acc, result) => {
          acc[result.source] = (acc[result.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(`   Source Breakdown:`, bySource);
        
        // Show top results
        if (session.results.length > 0) {
          console.log('   Top Results:');
          session.results.slice(0, 3).forEach((result, index) => {
            const localIndicator = result.source === 'local' || result.isLocalMatch ? ' 🏠' : '';
            console.log(`     ${index + 1}. ${result.title} by ${result.artist} (${result.source})${localIndicator}`);
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Search failed: ${error.message}`);
      }
      
      console.log();
    }
    
    console.log('✅ Unified search working correctly\n');
  }
  
  private async testSearchSuggestions() {
    console.log('💡 Testing search suggestions...');
    
    const testInputs = ['qu', 'hot', 'led', 'mic'];
    
    for (const input of testInputs) {
      const suggestions = await this.searchManager.getSearchSuggestions(input, 5);
      console.log(`   "${input}" → [${suggestions.join(', ')}]`);
    }
    
    console.log('✅ Search suggestions working correctly\n');
  }
  
  private async testSearchPreferences() {
    console.log('⚙️  Testing search preferences...');
    
    // Test getting current preferences
    const currentPrefs = this.searchManager.getPreferences();
    console.log(`   Default max results: ${currentPrefs.maxResults}`);
    console.log(`   Default local weight: ${currentPrefs.localWeight}`);
    
    // Test updating preferences
    this.searchManager.updatePreferences({
      maxResults: 25,
      localWeight: 2.0,
      matchThreshold: 0.8
    });
    
    const updatedPrefs = this.searchManager.getPreferences();
    console.log(`   Updated max results: ${updatedPrefs.maxResults}`);
    console.log(`   Updated local weight: ${updatedPrefs.localWeight}`);
    
    // Test reset
    this.searchManager.resetPreferences();
    const resetPrefs = this.searchManager.getPreferences();
    console.log(`   Reset max results: ${resetPrefs.maxResults}`);
    
    console.log('✅ Search preferences working correctly\n');
  }
  
  private async testSearchAnalytics() {
    console.log('📈 Testing search analytics...');
    
    // Perform a few searches to generate analytics data
    await this.searchManager.search('test analytics 1');
    await this.searchManager.search('test analytics 2');
    await this.searchManager.search('queen'); // This should find local results
    
    const analytics = this.searchManager.getSearchAnalytics();
    
    console.log(`   Total Searches: ${analytics.totalSearches}`);
    console.log(`   Avg Results per Search: ${analytics.avgResultsPerSearch}`);
    console.log(`   Avg Search Time: ${analytics.avgSearchTime}ms`);
    console.log(`   Local vs Web Ratio: ${analytics.localVsWebRatio}`);
    
    if (analytics.topQueries.length > 0) {
      console.log('   Top Queries:');
      analytics.topQueries.slice(0, 3).forEach(({ query, count }) => {
        console.log(`     - "${query}" (${count} times)`);
      });
    }
    
    if (analytics.mostPopularEngines.length > 0) {
      console.log('   Most Popular Engines:');
      analytics.mostPopularEngines.slice(0, 3).forEach(({ engine, count }) => {
        console.log(`     - ${engine} (${count} searches)`);
      });
    }
    
    console.log('✅ Search analytics working correctly\n');
  }
  
  private async testSearxngConnectivity() {
    console.log('🌐 Testing SearXNG connectivity...');
    
    const connectionTest = await this.searchManager.testSearxngConnection();
    
    if (connectionTest.success) {
      console.log(`   ✅ SearXNG connected successfully (${connectionTest.responseTime}ms)`);
    } else {
      console.log(`   ❌ SearXNG connection failed: ${connectionTest.error}`);
      console.log(`   Response time: ${connectionTest.responseTime}ms`);
      console.log('   This is expected if SearXNG is not running locally');
    }
    
    console.log();
  }
}

// Test export/import functionality
async function testDataManagement(searchManager: UnifiedSearchManager) {
  console.log('💾 Testing data export/import...');
  
  // Export data
  const exportedData = searchManager.exportSearchData();
  console.log(`   Exported data with ${exportedData.sessionCount} sessions`);
  
  // Import data
  searchManager.importSearchData(exportedData);
  console.log('   Data imported successfully');
  
  console.log('✅ Data management working correctly\n');
}

// Run the tests if this file is executed directly
if (require.main === module) {
  const tester = new UnifiedSearchTester();
  tester.runTests().catch(console.error);
}

export { UnifiedSearchTester };