import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AudioFile,
  Album,
  Artist,
  LibraryFilter,
  LibrarySortOptions,
  LibraryViewOptions
} from '../../../main/database/LibrarySchema';
import { LibraryGrid } from './LibraryGrid';
import { LibraryList } from './LibraryList';
import { LibraryFilters } from './LibraryFilters';
import { LibrarySorter } from './LibrarySorter';
import { LibraryStats } from './LibraryStats';
import './LibraryBrowser.css';

interface LibraryPage<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Week 4 Day 3: Library Browser Component
 * 
 * Main component for browsing and managing the music library with
 * support for multiple views, filtering, sorting, and batch operations.
 */
export const LibraryBrowser: React.FC = () => {
  // View state
  const [viewOptions, setViewOptions] = useState<LibraryViewOptions>({
    view: 'tracks',
    itemsPerPage: 50,
    page: 1
  });
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<LibraryFilter>({});
  const [sort, setSort] = useState<LibrarySortOptions>({
    field: 'artist',
    direction: 'asc'
  });
  
  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Fetch library page
  const { data: libraryPage, isLoading, error } = useQuery({
    queryKey: ['library', viewOptions, filter, sort],
    queryFn: async () => {
      const result = await window.electronAPI.invoke('library-get-page', viewOptions, filter, sort);
      if (!result.success) throw new Error(result.error);
      return result.data as LibraryPage<AudioFile | Album | Artist>;
    },
    staleTime: 30000, // 30 seconds
  });
  
  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['library-filter-options'],
    queryFn: async () => {
      const result = await window.electronAPI.invoke('library-get-filter-options');
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 60000, // 1 minute
  });
  
  // Fetch library stats
  const { data: libraryStats } = useQuery({
    queryKey: ['library-stats'],
    queryFn: async () => {
      const result = await window.electronAPI.invoke('library-get-stats');
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 60000, // 1 minute
  });
  
  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const result = await window.electronAPI.invoke('library-batch-update', {
        ids: Array.from(selectedIds),
        updates
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats'] });
      // Clear selection
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  });
  
  // Handle view change
  const handleViewChange = useCallback((newView: LibraryViewOptions['view']) => {
    setViewOptions(prev => ({
      ...prev,
      view: newView,
      page: 1 // Reset to first page
    }));
  }, []);
  
  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setViewOptions(prev => ({
      ...prev,
      page: newPage
    }));
  }, []);
  
  // Handle filter change
  const handleFilterChange = useCallback((newFilter: LibraryFilter) => {
    setFilter(newFilter);
    setViewOptions(prev => ({
      ...prev,
      page: 1 // Reset to first page when filter changes
    }));
  }, []);
  
  // Handle sort change
  const handleSortChange = useCallback((newSort: LibrarySortOptions) => {
    setSort(newSort);
  }, []);
  
  // Handle item selection
  const handleItemSelect = useCallback((id: number, isSelected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);
  
  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!libraryPage) return;
    
    const allIds = libraryPage.items.map(item => 
      'id' in item ? item.id : 0
    ).filter(id => id > 0);
    
    setSelectedIds(new Set(allIds));
  }, [libraryPage]);
  
  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);
  
  // Handle batch operations
  const handleBatchRate = useCallback((rating: number) => {
    batchUpdateMutation.mutate({ rating });
  }, [batchUpdateMutation]);
  
  const handleBatchFavorite = useCallback((isFavorite: boolean) => {
    batchUpdateMutation.mutate({ isFavorite });
  }, [batchUpdateMutation]);
  
  // Handle play actions
  const handlePlayTrack = useCallback(async (trackId: number) => {
    await window.electronAPI.invoke('library-play-track', trackId);
  }, []);
  
  const handleAddToQueue = useCallback(async (trackId: number) => {
    await window.electronAPI.invoke('library-add-to-queue', trackId);
  }, []);
  
  const handlePlayAlbum = useCallback(async (albumName: string, artist: string) => {
    await window.electronAPI.invoke('library-play-album', albumName, artist);
  }, []);
  
  // Listen for library updates
  useEffect(() => {
    const handleLibraryUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats'] });
    };
    
    window.electronAPI.on('library-updated', handleLibraryUpdate);
    
    return () => {
      window.electronAPI.off('library-updated', handleLibraryUpdate);
    };
  }, [queryClient]);
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="library-browser loading">
        <div className="loading-spinner">Loading library...</div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="library-browser error">
        <div className="error-message">
          <h3>Failed to load library</h3>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="library-browser">
      {/* Header with view switcher and stats */}
      <div className="library-header">
        <div className="view-switcher">
          <button 
            className={viewOptions.view === 'tracks' ? 'active' : ''}
            onClick={() => handleViewChange('tracks')}
          >
            Tracks
          </button>
          <button 
            className={viewOptions.view === 'albums' ? 'active' : ''}
            onClick={() => handleViewChange('albums')}
          >
            Albums
          </button>
          <button 
            className={viewOptions.view === 'artists' ? 'active' : ''}
            onClick={() => handleViewChange('artists')}
          >
            Artists
          </button>
          <button 
            className={viewOptions.view === 'genres' ? 'active' : ''}
            onClick={() => handleViewChange('genres')}
          >
            Genres
          </button>
        </div>
        
        <div className="view-controls">
          <button
            className={`view-mode-toggle ${viewMode}`}
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? '☰' : '⊞'}
          </button>
          
          <LibrarySorter
            currentSort={sort}
            viewType={viewOptions.view}
            onSortChange={handleSortChange}
          />
        </div>
        
        {libraryStats && (
          <LibraryStats stats={libraryStats} compact />
        )}
      </div>
      
      {/* Filters */}
      <LibraryFilters
        filter={filter}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
      />
      
      {/* Selection controls */}
      {isSelectionMode && (
        <div className="selection-controls">
          <span>{selectedIds.size} items selected</span>
          <button onClick={handleSelectAll}>Select All</button>
          <button onClick={handleClearSelection}>Clear</button>
          
          <div className="batch-actions">
            <div className="rating-buttons">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => handleBatchRate(rating)}
                  title={`Rate ${rating} stars`}
                >
                  {'★'.repeat(rating)}
                </button>
              ))}
            </div>
            
            <button onClick={() => handleBatchFavorite(true)}>
              ❤️ Favorite
            </button>
            <button onClick={() => handleBatchFavorite(false)}>
              💔 Unfavorite
            </button>
          </div>
        </div>
      )}
      
      {/* Main content area */}
      <div className="library-content">
        {libraryPage && (
          <>
            {viewMode === 'grid' ? (
              <LibraryGrid
                items={libraryPage.items}
                viewType={viewOptions.view}
                selectedIds={selectedIds}
                isSelectionMode={isSelectionMode}
                onItemSelect={handleItemSelect}
                onPlayTrack={handlePlayTrack}
                onAddToQueue={handleAddToQueue}
                onPlayAlbum={handlePlayAlbum}
                onStartSelection={() => setIsSelectionMode(true)}
              />
            ) : (
              <LibraryList
                items={libraryPage.items}
                viewType={viewOptions.view}
                selectedIds={selectedIds}
                isSelectionMode={isSelectionMode}
                onItemSelect={handleItemSelect}
                onPlayTrack={handlePlayTrack}
                onAddToQueue={handleAddToQueue}
                onPlayAlbum={handlePlayAlbum}
                onStartSelection={() => setIsSelectionMode(true)}
              />
            )}
            
            {/* Pagination */}
            {libraryPage.totalPages > 1 && (
              <div className="library-pagination">
                <button
                  disabled={!libraryPage.hasPrevious}
                  onClick={() => handlePageChange(viewOptions.page - 1)}
                >
                  Previous
                </button>
                
                <span>
                  Page {libraryPage.currentPage} of {libraryPage.totalPages}
                  {' '}({libraryPage.totalItems} total items)
                </span>
                
                <button
                  disabled={!libraryPage.hasNext}
                  onClick={() => handlePageChange(viewOptions.page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};