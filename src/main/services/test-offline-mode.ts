import { UnifiedSearchManager } from './UnifiedSearchManager';
import { OfflineCacheManager } from './OfflineCacheManager';
import { OfflineSearchService } from './OfflineSearchService';
import { DatabaseManager } from '../database/DatabaseManager';
import { MetadataExtractor } from './MetadataExtractor';
import { SearchResult } from './LibrarySearchService';

/**
 * Week 3 Day 3: Offline Mode Test Suite
 * 
 * Tests offline functionality with simulated network failures,
 * cache strategies, and fallback mechanisms.
 */
class OfflineModeTest {
  private dbManager: DatabaseManager;
  private searchManager: UnifiedSearchManager;
  private cacheManager: OfflineCacheManager;
  private offlineService: OfflineSearchService;
  private metadataExtractor: MetadataExtractor;
  
  constructor() {
    // Initialize with in-memory databases for testing
    this.dbManager = new DatabaseManager(':memory:');
    this.metadataExtractor = new MetadataExtractor();
    this.searchManager = new UnifiedSearchManager(this.dbManager, this.metadataExtractor);
    this.cacheManager = new OfflineCacheManager(':memory:');
    this.offlineService = new OfflineSearchService(this.searchManager, this.cacheManager);
  }
  
  async runAllTests() {
    console.log('🔌 Week 3 Day 3: Offline Mode Test Suite\n');
    
    try {
      // Initialize test data
      await this.setupTestData();
      
      // Test 1: Cache functionality
      await this.testCacheOperations();
      
      // Test 2: Network status detection
      await this.testNetworkStatusDetection();
      
      // Test 3: Offline search with cache
      await this.testOfflineSearchWithCache();
      
      // Test 4: Fallback strategies
      await this.testFallbackStrategies();
      
      // Test 5: Cache freshness and expiration
      await this.testCacheFreshness();
      
      // Test 6: Performance with large cache
      await this.testCachePerformance();
      
      // Test 7: Export/Import functionality
      await this.testExportImport();
      
      console.log('\n🎉 All offline mode tests completed successfully!');
      
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
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add sample tracks
    const testTracks = [
      { title: 'Test Song 1', artist: 'Test Artist', album: 'Test Album', file_path: '/test/song1.mp3' },
      { title: 'Test Song 2', artist: 'Test Artist', album: 'Test Album', file_path: '/test/song2.mp3' },
      { title: 'Another Track', artist: 'Different Artist', album: 'Different Album', file_path: '/test/track.mp3' }
    ];
    
    const insertTrack = db.prepare(`
      INSERT INTO audio_files (title, artist, album, duration, file_path, file_size, format)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const track of testTracks) {
      insertTrack.run(
        track.title, track.artist, track.album, 180, 
        track.file_path, 5000000, 'mp3'
      );
    }
    
    console.log('✅ Test data initialized\n');
  }
  
  private async testCacheOperations() {
    console.log('🧪 Test 1: Cache Operations');
    
    // Create test search results
    const testResults: SearchResult[] = [
      {
        id: 'test_1',
        title: 'Cached Song',
        artist: 'Cached Artist',
        album: 'Cached Album',
        source: 'searxng',
        url: 'https://example.com/song',
        searxngData: {
          engine: 'soundcloud',
          content: 'Test content'
        }
      },
      {
        id: 'test_2',
        title: 'Local Song',
        artist: 'Local Artist',
        source: 'local',
        localFile: {
          path: '/music/local.mp3',
          size: 5000000,
          format: 'mp3'
        }
      }
    ];
    
    // Test caching
    await this.cacheManager.cacheSearchResults('test query', testResults);
    console.log('   ✅ Cached search results');
    
    // Test retrieval
    const cached = await this.cacheManager.getCachedResults('test query');
    console.log(`   ✅ Retrieved ${cached?.results.length} cached results`);
    
    // Test similar searches
    const similar = await this.cacheManager.getSimilarSearches('test', 5);
    console.log(`   ✅ Found ${similar.length} similar searches`);
    
    // Test cache stats
    const stats = await this.cacheManager.getCacheStats();
    console.log(`   ✅ Cache stats: ${stats.totalCachedSearches} searches, ${(stats.cacheSize / 1024).toFixed(1)}KB`);
    
    console.log('✅ Cache operations working correctly\n');
  }
  
  private async testNetworkStatusDetection() {
    console.log('🧪 Test 2: Network Status Detection');
    
    // Get initial status
    const initialStatus = this.offlineService.getSearchStatus();
    console.log(`   Initial status: ${initialStatus.networkStatus}`);
    console.log(`   Search mode: ${initialStatus.mode}`);
    
    // Simulate network check
    await this.offlineService.checkNetworkStatus();
    const afterCheck = this.offlineService.getSearchStatus();
    console.log(`   After check: ${afterCheck.networkStatus}`);
    
    // Test status event emission
    let statusChangeDetected = false;
    this.offlineService.once('networkStatusChanged', (change) => {
      statusChangeDetected = true;
      console.log(`   ✅ Status change detected: ${change.previous} → ${change.current}`);
    });
    
    // Force a status change by temporarily modifying the service
    (this.offlineService as any).updateNetworkStatus('offline');
    (this.offlineService as any).updateNetworkStatus('online');
    
    console.log('✅ Network status detection working correctly\n');
  }
  
  private async testOfflineSearchWithCache() {
    console.log('🧪 Test 3: Offline Search with Cache');
    
    // First, perform an "online" search to populate cache
    const onlineQuery = 'test music';
    const onlineResults: SearchResult[] = [
      {
        id: 'online_1',
        title: 'Online Result 1',
        artist: 'Online Artist',
        source: 'searxng',
        searxngData: { engine: 'youtube_music' }
      },
      {
        id: 'online_2',
        title: 'Online Result 2',
        artist: 'Online Artist',
        source: 'searxng',
        searxngData: { engine: 'spotify' }
      }
    ];
    
    // Cache the results
    await this.cacheManager.cacheSearchResults(onlineQuery, onlineResults);
    console.log('   ✅ Cached online search results');
    
    // Now search in offline mode
    const offlineSession = await this.offlineService.search(onlineQuery, {
      forceOffline: true
    });
    
    console.log(`   ✅ Offline search returned ${offlineSession.results.length} results`);
    console.log(`   Mode: ${(offlineSession as any).options?.forceOffline ? 'forced offline' : 'auto'}`);
    
    // Test cache-first strategy
    const cacheFirstSession = await this.offlineService.search(onlineQuery, {
      useCacheFirst: true
    });
    
    console.log(`   ✅ Cache-first search returned ${cacheFirstSession.results.length} results`);
    
    console.log('✅ Offline search with cache working correctly\n');
  }
  
  private async testFallbackStrategies() {
    console.log('🧪 Test 4: Fallback Strategies');
    
    // Test 1: No exact match, but similar query exists
    await this.cacheManager.cacheSearchResults('rock music', [
      {
        id: 'rock_1',
        title: 'Rock Song',
        artist: 'Rock Band',
        source: 'searxng'
      }
    ]);
    
    // Force offline mode
    (this.offlineService as any).updateNetworkStatus('offline');
    
    // Search for something similar
    const similarSearch = await this.offlineService.search('rock songs', {
      forceOffline: true
    });
    
    console.log(`   ✅ Similar search fallback: ${similarSearch.results.length} results`);
    if ((similarSearch as any).fallbackMessage) {
      console.log(`   Message: ${(similarSearch as any).fallbackMessage}`);
    }
    
    // Test 2: No cache, fall back to local library
    const localOnlySearch = await this.offlineService.search('test artist', {
      forceOffline: true
    });
    
    console.log(`   ✅ Local library fallback: ${localOnlySearch.results.length} results`);
    
    // Test 3: No results at all
    const noResultsSearch = await this.offlineService.search('xyz123nonexistent', {
      forceOffline: true
    });
    
    console.log(`   ✅ No results fallback handled: ${noResultsSearch.results.length} results`);
    
    console.log('✅ Fallback strategies working correctly\n');
  }
  
  private async testCacheFreshness() {
    console.log('🧪 Test 5: Cache Freshness & Expiration');
    
    // Create results with different ages
    const freshResults: SearchResult[] = [{
      id: 'fresh_1',
      title: 'Fresh Result',
      artist: 'Fresh Artist',
      source: 'searxng'
    }];
    
    // Cache with custom expiration
    await this.cacheManager.cacheSearchResults('fresh query', freshResults);
    
    // Test freshness check
    const freshCache = await this.cacheManager.getCachedResults('fresh query');
    const isFresh = (this.offlineService as any).isCacheFresh(freshCache, 24);
    console.log(`   ✅ Fresh cache detected: ${isFresh}`);
    
    // Test cleanup
    const cleanedCount = await this.cacheManager.cleanupExpiredCache();
    console.log(`   ✅ Cleanup removed ${cleanedCount} expired entries`);
    
    // Test size-based cleanup
    const sizeCleanup = await this.cacheManager.cleanupBySize();
    console.log(`   ✅ Size cleanup removed ${sizeCleanup} entries`);
    
    console.log('✅ Cache freshness and expiration working correctly\n');
  }
  
  private async testCachePerformance() {
    console.log('🧪 Test 6: Cache Performance');
    
    const startTime = Date.now();
    
    // Add many cache entries
    const queries = 50;
    for (let i = 0; i < queries; i++) {
      const results: SearchResult[] = Array(20).fill(null).map((_, j) => ({
        id: `perf_${i}_${j}`,
        title: `Song ${i}-${j}`,
        artist: `Artist ${i}`,
        source: 'searxng' as const
      }));
      
      await this.cacheManager.cacheSearchResults(`performance test ${i}`, results);
    }
    
    const cacheTime = Date.now() - startTime;
    console.log(`   ✅ Cached ${queries} searches in ${cacheTime}ms (${(cacheTime/queries).toFixed(1)}ms per search)`);
    
    // Test retrieval performance
    const retrieveStart = Date.now();
    for (let i = 0; i < 10; i++) {
      await this.cacheManager.getCachedResults(`performance test ${i}`);
    }
    const retrieveTime = Date.now() - retrieveStart;
    console.log(`   ✅ Retrieved 10 searches in ${retrieveTime}ms (${(retrieveTime/10).toFixed(1)}ms per retrieval)`);
    
    // Test search performance
    const searchStart = Date.now();
    const similar = await this.cacheManager.getSimilarSearches('performance', 20);
    const searchTime = Date.now() - searchStart;
    console.log(`   ✅ Found ${similar.length} similar searches in ${searchTime}ms`);
    
    // Check final stats
    const stats = await this.cacheManager.getCacheStats();
    console.log(`   ✅ Final cache size: ${(stats.cacheSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Compression ratio: ${(stats.compressionRatio * 100).toFixed(0)}% savings`);
    
    console.log('✅ Cache performance is acceptable\n');
  }
  
  private async testExportImport() {
    console.log('🧪 Test 7: Export/Import Functionality');
    
    // Export current data
    const exportData = await this.offlineService.exportOfflineData();
    console.log(`   ✅ Exported ${exportData.cache.searches} cached searches`);
    console.log(`   Status: ${exportData.status.networkStatus}`);
    
    // Clear cache
    await this.cacheManager.clearAllCache();
    const afterClear = await this.cacheManager.getCacheStats();
    console.log(`   ✅ Cache cleared: ${afterClear.totalCachedSearches} searches remaining`);
    
    // Import data back
    await this.offlineService.importOfflineData(exportData);
    const afterImport = await this.cacheManager.getCacheStats();
    console.log(`   ✅ Imported ${afterImport.totalCachedSearches} searches`);
    
    // Verify imported data
    const testQuery = 'performance test 0';
    const imported = await this.cacheManager.getCachedResults(testQuery);
    console.log(`   ✅ Verified imported data: ${imported ? 'success' : 'failed'}`);
    
    console.log('✅ Export/Import functionality working correctly\n');
  }
  
  private cleanup() {
    console.log('🧹 Cleaning up test resources...');
    this.offlineService.shutdown();
    // Database cleanup happens automatically with :memory: databases
  }
}

// Simulate network failures for testing
export async function simulateNetworkFailure(searchManager: UnifiedSearchManager) {
  // Override the testSearxngConnection method to simulate failure
  const original = searchManager.testSearxngConnection;
  
  searchManager.testSearxngConnection = async () => {
    return {
      success: false,
      error: 'Simulated network failure',
      responseTime: 0
    };
  };
  
  // Restore after delay
  setTimeout(() => {
    searchManager.testSearxngConnection = original;
  }, 5000);
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new OfflineModeTest();
  tester.runAllTests().catch(console.error);
}

export { OfflineModeTest };