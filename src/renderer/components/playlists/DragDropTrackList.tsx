import React, { useState, useRef, useCallback, useEffect } from 'react';
import './DragDropTrackList.css';

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  source: string;
  url: string;
  coverArt?: string;
  genre?: string;
  year?: number;
  rating?: number;
  playCount?: number;
}

interface DragDropTrackListProps {
  tracks: Track[];
  onTracksReorder: (tracks: Track[]) => void;
  onTrackRemove?: (trackId: string) => void;
  onTrackPlay?: (track: Track) => void;
  onTrackSelect?: (tracks: Track[]) => void;
  selectable?: boolean;
  removable?: boolean;
  showIndex?: boolean;
  showControls?: boolean;
  className?: string;
}

interface DragState {
  isDragging: boolean;
  draggedTrack: Track | null;
  draggedIndex: number;
  dragOverIndex: number;
  dragOffsetY: number;
}

export const DragDropTrackList: React.FC<DragDropTrackListProps> = ({
  tracks,
  onTracksReorder,
  onTrackRemove,
  onTrackPlay,
  onTrackSelect,
  selectable = false,
  removable = true,
  showIndex = true,
  showControls = true,
  className = ''
}) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedTrack: null,
    draggedIndex: -1,
    dragOverIndex: -1,
    dragOffsetY: 0
  });

  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const dragImageRef = useRef<HTMLDivElement>(null);

  // Handle track selection
  const handleTrackSelection = useCallback((track: Track, event: React.MouseEvent) => {
    if (!selectable) return;

    let newSelection = new Set(selectedTracks);

    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      if (newSelection.has(track.id)) {
        newSelection.delete(track.id);
      } else {
        newSelection.add(track.id);
      }
    } else if (event.shiftKey && selectedTracks.size > 0) {
      // Range select
      const currentIndex = tracks.findIndex(t => t.id === track.id);
      const lastSelectedIndex = tracks.findIndex(t => selectedTracks.has(t.id));
      
      if (currentIndex !== -1 && lastSelectedIndex !== -1) {
        const start = Math.min(currentIndex, lastSelectedIndex);
        const end = Math.max(currentIndex, lastSelectedIndex);
        
        newSelection.clear();
        for (let i = start; i <= end; i++) {
          newSelection.add(tracks[i].id);
        }
      }
    } else {
      // Single select
      newSelection.clear();
      newSelection.add(track.id);
    }

    setSelectedTracks(newSelection);
    onTrackSelect?.(tracks.filter(t => newSelection.has(t.id)));
  }, [selectable, selectedTracks, tracks, onTrackSelect]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, track: Track, index: number) => {
    const dragImage = dragImageRef.current;
    if (dragImage) {
      // Create custom drag image
      dragImage.textContent = `${track.title} - ${track.artist}`;
      e.dataTransfer.setDragImage(dragImage, 0, 0);
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', track.id);

    setDragState(prev => ({
      ...prev,
      isDragging: true,
      draggedTrack: track,
      draggedIndex: index,
      dragOffsetY: e.clientY
    }));
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    setDragState(prev => ({
      ...prev,
      dragOverIndex: index
    }));
  }, []);

  // Handle drag enter
  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    setDragState(prev => ({
      ...prev,
      dragOverIndex: index
    }));
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset drag over if we're leaving the entire list
    const listElement = listRef.current;
    if (listElement && !listElement.contains(e.relatedTarget as Node)) {
      setDragState(prev => ({
        ...prev,
        dragOverIndex: -1
      }));
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    const { draggedIndex } = dragState;
    
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDragState(prev => ({
        ...prev,
        isDragging: false,
        draggedTrack: null,
        draggedIndex: -1,
        dragOverIndex: -1
      }));
      return;
    }

    // Reorder tracks
    const newTracks = [...tracks];
    const [movedTrack] = newTracks.splice(draggedIndex, 1);
    newTracks.splice(dropIndex, 0, movedTrack);

    onTracksReorder(newTracks);

    setDragState(prev => ({
      ...prev,
      isDragging: false,
      draggedTrack: null,
      draggedIndex: -1,
      dragOverIndex: -1
    }));
  }, [dragState, tracks, onTracksReorder]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      isDragging: false,
      draggedTrack: null,
      draggedIndex: -1,
      dragOverIndex: -1
    }));
  }, []);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, track: Track, index: number) => {
    if (!selectable) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) {
          const prevTrack = tracks[index - 1];
          setSelectedTracks(new Set([prevTrack.id]));
          onTrackSelect?.([prevTrack]);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (index < tracks.length - 1) {
          const nextTrack = tracks[index + 1];
          setSelectedTracks(new Set([nextTrack.id]));
          onTrackSelect?.([nextTrack]);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onTrackPlay?.(track);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (removable && selectedTracks.has(track.id)) {
          onTrackRemove?.(track.id);
        }
        break;
    }
  }, [selectable, tracks, selectedTracks, onTrackSelect, onTrackPlay, removable, onTrackRemove]);

  // Clear selection when tracks change
  useEffect(() => {
    const validSelection = new Set(
      Array.from(selectedTracks).filter(id => tracks.some(t => t.id === id))
    );
    
    if (validSelection.size !== selectedTracks.size) {
      setSelectedTracks(validSelection);
      onTrackSelect?.(tracks.filter(t => validSelection.has(t.id)));
    }
  }, [tracks, selectedTracks, onTrackSelect]);

  // Render track item
  const renderTrackItem = (track: Track, index: number) => {
    const isSelected = selectedTracks.has(track.id);
    const isDraggedOver = dragState.dragOverIndex === index;
    const isBeingDragged = dragState.draggedIndex === index;

    return (
      <div
        key={track.id}
        className={`track-item ${isSelected ? 'selected' : ''} ${isDraggedOver ? 'drag-over' : ''} ${isBeingDragged ? 'being-dragged' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, track, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnter={(e) => handleDragEnter(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        onClick={(e) => handleTrackSelection(track, e)}
        onDoubleClick={() => onTrackPlay?.(track)}
        onKeyDown={(e) => handleKeyDown(e, track, index)}
        tabIndex={selectable ? 0 : -1}
        role={selectable ? 'option' : 'listitem'}
        aria-selected={selectable ? isSelected : undefined}
      >
        {/* Drag handle */}
        <div className="drag-handle">
          <span className="drag-icon">⋮⋮</span>
        </div>

        {/* Track index */}
        {showIndex && (
          <div className="track-index">
            {index + 1}
          </div>
        )}

        {/* Selection checkbox */}
        {selectable && (
          <div className="track-selection">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}} // Handled by click event
              tabIndex={-1}
            />
          </div>
        )}

        {/* Cover art */}
        <div className="track-cover">
          {track.coverArt ? (
            <img src={track.coverArt} alt={`${track.album} cover`} />
          ) : (
            <div className="cover-placeholder">🎵</div>
          )}
        </div>

        {/* Track info */}
        <div className="track-info">
          <div className="track-primary">
            <div className="track-title">{track.title}</div>
            <div className="track-artist">{track.artist}</div>
          </div>
          <div className="track-secondary">
            {track.album && <span className="track-album">{track.album}</span>}
            {track.year && <span className="track-year">{track.year}</span>}
            {track.genre && <span className="track-genre">{track.genre}</span>}
          </div>
        </div>

        {/* Track metadata */}
        <div className="track-metadata">
          <div className="track-duration">{formatDuration(track.duration)}</div>
          {track.rating && (
            <div className="track-rating">
              {'★'.repeat(Math.floor(track.rating))}
            </div>
          )}
          {track.playCount !== undefined && (
            <div className="track-plays">{track.playCount} plays</div>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="track-controls">
            <button
              className="play-button"
              onClick={(e) => {
                e.stopPropagation();
                onTrackPlay?.(track);
              }}
              title="Play track"
            >
              ▶
            </button>
            
            {removable && (
              <button
                className="remove-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackRemove?.(track.id);
                }}
                title="Remove track"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Drop indicator */}
        {isDraggedOver && (
          <div className="drop-indicator" />
        )}
      </div>
    );
  };

  return (
    <div className={`drag-drop-track-list ${className}`} ref={listRef}>
      {/* Hidden drag image element */}
      <div ref={dragImageRef} className="drag-image" />

      {/* Track list */}
      <div
        className="track-list"
        role={selectable ? 'listbox' : 'list'}
        aria-multiselectable={selectable}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        {tracks.length === 0 ? (
          <div className="empty-list">
            <div className="empty-icon">🎵</div>
            <p>No tracks in this playlist</p>
          </div>
        ) : (
          tracks.map((track, index) => renderTrackItem(track, index))
        )}
      </div>

      {/* Selection info */}
      {selectable && selectedTracks.size > 0 && (
        <div className="selection-info">
          <span>{selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected</span>
          <button
            className="clear-selection"
            onClick={() => {
              setSelectedTracks(new Set());
              onTrackSelect?.([]);
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Drag overlay */}
      {dragState.isDragging && (
        <div className="drag-overlay">
          <div className="drag-preview">
            Moving: {dragState.draggedTrack?.title}
          </div>
        </div>
      )}
    </div>
  );
};

export default DragDropTrackList;