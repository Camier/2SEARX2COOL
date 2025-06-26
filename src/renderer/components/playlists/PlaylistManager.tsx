import React, { useState, useEffect, useCallback } from 'react';
import './PlaylistManager.css';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  type: 'normal' | 'smart';
  trackCount: number;
  duration: number;
  createdAt: number;
  updatedAt: number;
  coverArt?: string;
  isPublic: boolean;
  tags: string[];
}

interface PlaylistManagerProps {
  onPlaylistSelect?: (playlist: Playlist) => void;
  onPlaylistCreate?: () => void;
  onPlaylistEdit?: (playlist: Playlist) => void;
  onPlaylistDelete?: (playlistId: string) => void;
  className?: string;
}

interface PlaylistManagerState {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  selectedPlaylists: Set<string>;
  searchQuery: string;
  sortBy: 'name' | 'created' | 'updated' | 'tracks' | 'duration';
  sortOrder: 'asc' | 'desc';
  filterType: 'all' | 'normal' | 'smart';
  viewMode: 'grid' | 'list';
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  onPlaylistSelect,
  onPlaylistCreate,
  onPlaylistEdit,
  onPlaylistDelete,
  className = ''
}) => {
  const [state, setState] = useState<PlaylistManagerState>({
    playlists: [],
    loading: true,
    error: null,
    selectedPlaylists: new Set(),
    searchQuery: '',
    sortBy: 'updated',
    sortOrder: 'desc',
    filterType: 'all',
    viewMode: 'grid'
  });

  // Load playlists from backend
  const loadPlaylists = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const playlists = await window.electronAPI.playlists.getAll();
      
      setState(prev => ({
        ...prev,
        playlists,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load playlists',
        loading: false
      }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Filter and sort playlists
  const filteredAndSortedPlaylists = React.useMemo(() => {
    let filtered = state.playlists;

    // Apply search filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(playlist =>
        playlist.name.toLowerCase().includes(query) ||
        playlist.description?.toLowerCase().includes(query) ||
        playlist.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    if (state.filterType !== 'all') {
      filtered = filtered.filter(playlist => playlist.type === state.filterType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (state.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case 'updated':
          aValue = a.updatedAt;
          bValue = b.updatedAt;
          break;
        case 'tracks':
          aValue = a.trackCount;
          bValue = b.trackCount;
          break;
        case 'duration':
          aValue = a.duration;
          bValue = b.duration;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return state.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return state.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [state.playlists, state.searchQuery, state.filterType, state.sortBy, state.sortOrder]);

  // Handle playlist selection
  const handlePlaylistClick = (playlist: Playlist, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      setState(prev => {
        const newSelected = new Set(prev.selectedPlaylists);
        if (newSelected.has(playlist.id)) {
          newSelected.delete(playlist.id);
        } else {
          newSelected.add(playlist.id);
        }
        return { ...prev, selectedPlaylists: newSelected };
      });
    } else {
      // Single select
      setState(prev => ({ ...prev, selectedPlaylists: new Set([playlist.id]) }));
      onPlaylistSelect?.(playlist);
    }
  };

  // Handle playlist deletion
  const handleDeleteSelected = async () => {
    if (state.selectedPlaylists.size === 0) return;

    const confirmMessage = state.selectedPlaylists.size === 1
      ? 'Are you sure you want to delete this playlist?'
      : `Are you sure you want to delete ${state.selectedPlaylists.size} playlists?`;

    if (!confirm(confirmMessage)) return;

    try {
      for (const playlistId of state.selectedPlaylists) {
        await window.electronAPI.playlists.delete(playlistId);
        onPlaylistDelete?.(playlistId);
      }

      setState(prev => ({ ...prev, selectedPlaylists: new Set() }));
      await loadPlaylists();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete playlists'
      }));
    }
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  // Render playlist item
  const renderPlaylistItem = (playlist: Playlist) => {
    const isSelected = state.selectedPlaylists.has(playlist.id);

    return (
      <div
        key={playlist.id}
        className={`playlist-item ${isSelected ? 'selected' : ''} ${state.viewMode}`}
        onClick={(e) => handlePlaylistClick(playlist, e)}
        onDoubleClick={() => onPlaylistSelect?.(playlist)}
      >
        {/* Cover Art */}
        <div className="playlist-cover">
          {playlist.coverArt ? (
            <img src={playlist.coverArt} alt={playlist.name} />
          ) : (
            <div className="playlist-cover-placeholder">
              {playlist.type === 'smart' ? '🧠' : '🎵'}
            </div>
          )}
          <div className="playlist-overlay">
            <button
              className="play-button"
              onClick={(e) => {
                e.stopPropagation();
                onPlaylistSelect?.(playlist);
              }}
              title="Play playlist"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Playlist Info */}
        <div className="playlist-info">
          <div className="playlist-header">
            <h3 className="playlist-name">{playlist.name}</h3>
            <div className="playlist-type">
              {playlist.type === 'smart' && <span className="smart-badge">SMART</span>}
              {playlist.isPublic && <span className="public-badge">PUBLIC</span>}
            </div>
          </div>

          {playlist.description && (
            <p className="playlist-description">{playlist.description}</p>
          )}

          <div className="playlist-metadata">
            <span className="track-count">{playlist.trackCount} tracks</span>
            <span className="duration">{formatDuration(playlist.duration)}</span>
            <span className="updated">Updated {formatDate(playlist.updatedAt)}</span>
          </div>

          {playlist.tags.length > 0 && (
            <div className="playlist-tags">
              {playlist.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="playlist-actions">
          <button
            className="edit-button"
            onClick={(e) => {
              e.stopPropagation();
              onPlaylistEdit?.(playlist);
            }}
            title="Edit playlist"
          >
            ✏️
          </button>
          <button
            className="delete-button"
            onClick={(e) => {
              e.stopPropagation();
              setState(prev => ({ ...prev, selectedPlaylists: new Set([playlist.id]) }));
              handleDeleteSelected();
            }}
            title="Delete playlist"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`playlist-manager ${className}`}>
      {/* Header */}
      <div className="playlist-manager-header">
        <div className="header-left">
          <h2>Playlists</h2>
          <span className="playlist-count">
            {filteredAndSortedPlaylists.length} playlist{filteredAndSortedPlaylists.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="header-actions">
          <button
            className="create-button primary"
            onClick={onPlaylistCreate}
            title="Create new playlist"
          >
            ➕ New Playlist
          </button>

          {state.selectedPlaylists.size > 0 && (
            <button
              className="delete-button danger"
              onClick={handleDeleteSelected}
              title={`Delete ${state.selectedPlaylists.size} selected playlist${state.selectedPlaylists.size !== 1 ? 's' : ''}`}
            >
              🗑️ Delete ({state.selectedPlaylists.size})
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="playlist-controls">
        {/* Search */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Search playlists..."
            value={state.searchQuery}
            onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* Filters */}
        <div className="filter-controls">
          <select
            value={state.filterType}
            onChange={(e) => setState(prev => ({ ...prev, filterType: e.target.value as any }))}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="normal">Regular Playlists</option>
            <option value="smart">Smart Playlists</option>
          </select>

          <select
            value={`${state.sortBy}-${state.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              setState(prev => ({ ...prev, sortBy: sortBy as any, sortOrder: sortOrder as any }));
            }}
            className="sort-select"
          >
            <option value="updated-desc">Recently Updated</option>
            <option value="created-desc">Recently Created</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="tracks-desc">Most Tracks</option>
            <option value="tracks-asc">Fewest Tracks</option>
            <option value="duration-desc">Longest</option>
            <option value="duration-asc">Shortest</option>
          </select>

          <div className="view-mode-toggle">
            <button
              className={`view-mode-button ${state.viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, viewMode: 'grid' }))}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              className={`view-mode-button ${state.viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, viewMode: 'list' }))}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="playlist-content">
        {state.loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading playlists...</p>
          </div>
        )}

        {state.error && (
          <div className="error-state">
            <p className="error-message">{state.error}</p>
            <button onClick={loadPlaylists} className="retry-button">
              Try Again
            </button>
          </div>
        )}

        {!state.loading && !state.error && filteredAndSortedPlaylists.length === 0 && (
          <div className="empty-state">
            {state.playlists.length === 0 ? (
              <>
                <div className="empty-icon">🎵</div>
                <h3>No playlists yet</h3>
                <p>Create your first playlist to get started</p>
                <button
                  className="create-button primary"
                  onClick={onPlaylistCreate}
                >
                  Create Playlist
                </button>
              </>
            ) : (
              <>
                <div className="empty-icon">🔍</div>
                <h3>No playlists found</h3>
                <p>Try adjusting your search or filters</p>
              </>
            )}
          </div>
        )}

        {!state.loading && !state.error && filteredAndSortedPlaylists.length > 0 && (
          <div className={`playlist-grid ${state.viewMode}`}>
            {filteredAndSortedPlaylists.map(renderPlaylistItem)}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistManager;