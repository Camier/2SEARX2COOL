import React, { useState, useEffect, useCallback } from 'react';
import { DragDropTrackList } from './DragDropTrackList';
import { SmartPlaylistBuilder } from './SmartPlaylistBuilder';
import './PlaylistDetailView.css';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  genre?: string;
  year?: number;
  popularity?: number;
  dateAdded?: number;
  playCount?: number;
  lastPlayed?: number;
  rating?: number;
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  acousticness?: number;
  valence?: number;
  url?: string;
  artwork?: string;
}

export interface SmartPlaylistRule {
  field: string;
  operator: string;
  value: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  type: 'normal' | 'smart';
  isPublic: boolean;
  tags: string[];
  tracks: Track[];
  smartRules: SmartPlaylistRule[];
  createdAt: number;
  updatedAt: number;
  trackCount: number;
  duration: number;
  artwork?: string;
}

interface PlaylistDetailViewProps {
  playlist: Playlist;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPlay: (playlist: Playlist) => void;
  onAddToQueue: (tracks: Track[]) => void;
  onSharePlaylist: () => void;
  onTrackSelect: (track: Track) => void;
  onTrackReorder: (tracks: Track[]) => void;
  onTrackRemove: (trackId: string) => void;
  onAddTracks: () => void;
  className?: string;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlist,
  onBack,
  onEdit,
  onDelete,
  onPlay,
  onAddToQueue,
  onSharePlaylist,
  onTrackSelect,
  onTrackReorder,
  onTrackRemove,
  onAddTracks,
  className = ''
}) => {
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tracks' | 'rules'>('tracks');
  const [isPlaying, setIsPlaying] = useState(false);

  // Format duration from seconds to MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Format total playlist duration
  const formatPlaylistDuration = useCallback((): string => {
    const totalMinutes = Math.floor(playlist.duration / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, [playlist.duration]);

  // Handle track selection
  const handleTrackSelection = useCallback((trackIds: string[]) => {
    setSelectedTracks(new Set(trackIds));
  }, []);

  // Handle play playlist
  const handlePlayPlaylist = useCallback(() => {
    setIsPlaying(true);
    onPlay(playlist);
    // Reset playing state after a brief moment (would be managed by actual player)
    setTimeout(() => setIsPlaying(false), 1000);
  }, [playlist, onPlay]);

  // Handle add selected to queue
  const handleAddSelectedToQueue = useCallback(() => {
    const tracksToAdd = playlist.tracks.filter(track => selectedTracks.has(track.id));
    onAddToQueue(tracksToAdd);
    setSelectedTracks(new Set());
  }, [playlist.tracks, selectedTracks, onAddToQueue]);

  // Handle remove selected tracks
  const handleRemoveSelectedTracks = useCallback(() => {
    if (selectedTracks.size === 0) return;
    
    const trackNames = playlist.tracks
      .filter(track => selectedTracks.has(track.id))
      .map(track => `"${track.title}" by ${track.artist}`)
      .slice(0, 3);
    
    const message = selectedTracks.size === 1 
      ? `Remove ${trackNames[0]} from this playlist?`
      : `Remove ${selectedTracks.size} tracks from this playlist?${
          selectedTracks.size <= 3 ? `\n\n${trackNames.join('\n')}` : ''
        }`;
    
    if (confirm(message)) {
      selectedTracks.forEach(trackId => onTrackRemove(trackId));
      setSelectedTracks(new Set());
    }
  }, [selectedTracks, playlist.tracks, onTrackRemove]);

  return (
    <div className={`playlist-detail-view ${className}`}>
      {/* Header */}
      <div className="detail-header">
        <div className="header-main">
          <button className="back-button" onClick={onBack} title="Back to playlists">
            ← Back
          </button>
          
          <div className="playlist-info">
            <div className="playlist-artwork">
              {playlist.artwork ? (
                <img src={playlist.artwork} alt={playlist.name} />
              ) : (
                <div className="artwork-placeholder">
                  {playlist.type === 'smart' ? '🧠' : '🎵'}
                </div>
              )}
            </div>
            
            <div className="playlist-meta">
              <div className="playlist-type">
                {playlist.type === 'smart' ? 'Smart Playlist' : 'Playlist'}
                {playlist.isPublic && <span className="public-badge">Public</span>}
              </div>
              <h1 className="playlist-title">{playlist.name}</h1>
              {playlist.description && (
                <p className="playlist-description">{playlist.description}</p>
              )}
              <div className="playlist-stats">
                <span>{playlist.trackCount} tracks</span>
                <span>•</span>
                <span>{formatPlaylistDuration()}</span>
                <span>•</span>
                <span>Updated {new Date(playlist.updatedAt).toLocaleDateString()}</span>
              </div>
              {playlist.tags.length > 0 && (
                <div className="playlist-tags">
                  {playlist.tags.map(tag => (
                    <span key={tag} className="tag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className={`play-button primary ${isPlaying ? 'playing' : ''}`}
            onClick={handlePlayPlaylist}
            disabled={playlist.trackCount === 0}
          >
            {isPlaying ? '⏸️' : '▶️'} {isPlaying ? 'Playing' : 'Play'}
          </button>
          
          <button 
            className="add-queue-button"
            onClick={() => onAddToQueue(playlist.tracks)}
            disabled={playlist.trackCount === 0}
            title="Add all to queue"
          >
            📋 Add to Queue
          </button>
          
          <div className="more-actions">
            <button className="edit-button" onClick={onEdit} title="Edit playlist">
              ✏️ Edit
            </button>
            <button className="share-button" onClick={onSharePlaylist} title="Share playlist">
              🔗 Share
            </button>
            <button className="delete-button" onClick={onDelete} title="Delete playlist">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content tabs */}
      <div className="detail-content">
        <div className="content-tabs">
          <button
            className={`tab ${viewMode === 'tracks' ? 'active' : ''}`}
            onClick={() => setViewMode('tracks')}
          >
            📝 Tracks ({playlist.trackCount})
          </button>
          {playlist.type === 'smart' && (
            <button
              className={`tab ${viewMode === 'rules' ? 'active' : ''}`}
              onClick={() => setViewMode('rules')}
            >
              🧠 Smart Rules ({playlist.smartRules.length})
            </button>
          )}
        </div>

        {viewMode === 'tracks' && (
          <div className="tracks-content">
            {/* Selection toolbar */}
            {selectedTracks.size > 0 && (
              <div className="selection-toolbar">
                <div className="selection-info">
                  {selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected
                </div>
                <div className="selection-actions">
                  <button 
                    className="add-selected-button"
                    onClick={handleAddSelectedToQueue}
                  >
                    📋 Add to Queue
                  </button>
                  <button 
                    className="remove-selected-button"
                    onClick={handleRemoveSelectedTracks}
                  >
                    🗑️ Remove
                  </button>
                  <button 
                    className="clear-selection-button"
                    onClick={() => setSelectedTracks(new Set())}
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>
            )}

            {/* Tracks list or empty state */}
            {playlist.tracks.length > 0 ? (
              <DragDropTrackList
                tracks={playlist.tracks}
                onTrackSelect={onTrackSelect}
                onTrackReorder={onTrackReorder}
                onSelectionChange={handleTrackSelection}
                selectedTracks={Array.from(selectedTracks)}
                allowReorder={playlist.type === 'normal'}
                showTrackNumbers={true}
                className="detail-tracks-list"
              />
            ) : (
              <div className="empty-tracks">
                <div className="empty-icon">🎵</div>
                <h3>No tracks in this playlist</h3>
                <p>
                  {playlist.type === 'smart' 
                    ? 'This smart playlist has no rules or the rules don\'t match any tracks.'
                    : 'Add some tracks to get started!'
                  }
                </p>
                {playlist.type === 'normal' && (
                  <button className="add-tracks-button primary" onClick={onAddTracks}>
                    ➕ Add Tracks
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {viewMode === 'rules' && playlist.type === 'smart' && (
          <div className="rules-content">
            <SmartPlaylistBuilder
              rules={playlist.smartRules}
              onChange={() => {}} // Read-only in detail view
              onPreview={() => {}} // Could implement preview
              readOnly={true}
              className="detail-rules-builder"
            />
            <div className="rules-info">
              <p className="info-text">
                These rules automatically determine which tracks appear in this smart playlist.
                To modify rules, edit the playlist.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistDetailView;