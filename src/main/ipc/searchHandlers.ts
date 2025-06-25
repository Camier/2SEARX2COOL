import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { DatabaseManager } from '../database/DatabaseManager';
import { PersonalScoreService } from '../services/PersonalScoreService';
import { PersonalizedSearchService } from '../services/PersonalizedSearchService';
import { UnifiedSearchManager } from '../services/UnifiedSearchManager';
import { OfflineSearchService } from '../services/OfflineSearchService';
import { OfflineCacheManager } from '../services/OfflineCacheManager';
import { MetadataExtractor } from '../services/MetadataExtractor';

/**
 * Week 4 Day 1: Search IPC Handlers
 * 
 * Handles all search-related IPC communication between
 * the renderer process and main process services.
 */
export function registerSearchHandlers(
  dbManager: DatabaseManager,
  personalScoreService: PersonalScoreService,
  offlineSearchService: OfflineSearchService
) {
  // Initialize services
  const metadataExtractor = new MetadataExtractor();
  const unifiedSearchManager = new UnifiedSearchManager(dbManager, metadataExtractor);
  const personalizedSearchService = new PersonalizedSearchService(
    personalScoreService,
    unifiedSearchManager
  );
  
  // Perform search
  ipcMain.handle('perform-search', async (
    event: IpcMainInvokeEvent,
    query: string,
    options: any
  ) => {
    try {
      console.log(`Performing search for: "${query}"`);
      
      // Use offline search service which handles online/offline modes
      const session = await offlineSearchService.search(query, options);
      
      // Apply personal scoring if enabled
      if (options.includePersonalScore) {
        const personalizedResults = await personalScoreService.applyPersonalScoring(
          session.results
        );
        session.results = personalizedResults;
      }
      
      return session.results;
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  });
  
  // Get search suggestions
  ipcMain.handle('get-search-suggestions', async (
    event: IpcMainInvokeEvent,
    partial: string,
    limit: number = 10
  ) => {
    try {
      return await personalizedSearchService.getPersonalizedSuggestions(partial, limit);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  });
  
  // Get search status
  ipcMain.handle('get-search-status', async () => {
    return offlineSearchService.getSearchStatus();
  });
  
  // Get cache statistics
  ipcMain.handle('get-cache-stats', async () => {
    return await offlineSearchService.getCacheStats();
  });
  
  // Clear offline cache
  ipcMain.handle('clear-offline-cache', async () => {
    await offlineSearchService.clearCache();
  });
  
  // Set rating
  ipcMain.handle('set-rating', async (
    event: IpcMainInvokeEvent,
    fileId: number,
    rating: number
  ) => {
    await personalScoreService.setRating(fileId, rating);
  });
  
  // Toggle favorite
  ipcMain.handle('toggle-favorite', async (
    event: IpcMainInvokeEvent,
    fileId: number
  ) => {
    return await personalScoreService.toggleFavorite(fileId);
  });
  
  // Get recently played
  ipcMain.handle('get-recently-played', async (
    event: IpcMainInvokeEvent,
    limit: number = 20
  ) => {
    return await personalScoreService.getRecentlyPlayed(limit);
  });
  
  // Get top tracks
  ipcMain.handle('get-top-tracks', async (
    event: IpcMainInvokeEvent,
    limit: number = 50
  ) => {
    return await personalScoreService.getTopTracks(limit);
  });
  
  // Record interaction (non-blocking)
  ipcMain.on('record-interaction', (event, data) => {
    const { resultId, resultType, interactionType, query } = data;
    
    personalScoreService.recordSearchInteraction(
      query,
      resultId,
      resultType,
      interactionType
    ).catch(error => {
      console.error('Failed to record interaction:', error);
    });
  });
  
  // Record search query (non-blocking)
  ipcMain.on('record-search', (event, query: string) => {
    // This could be used to track search history
    unifiedSearchManager.addToRecentSearches(query).catch(error => {
      console.error('Failed to record search:', error);
    });
  });
  
  // Subscribe to network status changes
  offlineSearchService.on('networkStatusChanged', (change) => {
    // Broadcast to all windows
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('search-status-update', offlineSearchService.getSearchStatus());
    });
  });
  
  // Subscribe to cache events
  offlineSearchService.on('cacheCleared', () => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('cache-cleared');
    });
  });
}

// Helper function to setup search services on app start
export async function initializeSearchServices(appDataPath: string) {
  try {
    // Initialize database
    const dbManager = new DatabaseManager(appDataPath);
    
    // Initialize services
    const personalScoreService = new PersonalScoreService(dbManager);
    const cacheManager = new OfflineCacheManager(appDataPath);
    const metadataExtractor = new MetadataExtractor();
    const unifiedSearchManager = new UnifiedSearchManager(dbManager, metadataExtractor);
    const offlineSearchService = new OfflineSearchService(unifiedSearchManager, cacheManager);
    
    // Register IPC handlers
    registerSearchHandlers(dbManager, personalScoreService, offlineSearchService);
    
    // Start network monitoring
    await offlineSearchService.checkNetworkStatus();
    
    console.log('✅ Search services initialized successfully');
    
    return {
      dbManager,
      personalScoreService,
      offlineSearchService,
      unifiedSearchManager
    };
  } catch (error) {
    console.error('Failed to initialize search services:', error);
    throw error;
  }
}