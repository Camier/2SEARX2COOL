import React, { useCallback, memo } from 'react';
import { AudioFile, Album, Artist } from '../../../main/database/LibrarySchema';
import { formatDuration } from '../../utils/formatters';
import './LibraryGrid.css';

interface LibraryGridProps {
  items: (AudioFile | Album | Artist | any)[];
  viewType: 'tracks' | 'albums' | 'artists' | 'genres';
  selectedIds: Set<number>;
  isSelectionMode: boolean;
  onItemSelect: (id: number, isSelected: boolean) => void;
  onPlayTrack?: (id: number) => void;
  onAddToQueue?: (id: number) => void;
  onPlayAlbum?: (albumName: string, artist: string) => void;
  onStartSelection: () => void;
}

/**
 * Grid view component for library items with album artwork
 */
export const LibraryGrid: React.FC<LibraryGridProps> = memo(({
  items,
  viewType,
  selectedIds,
  isSelectionMode,
  onItemSelect,
  onPlayTrack,
  onAddToQueue,
  onPlayAlbum,
  onStartSelection
}) => {
  
  const handleItemClick = useCallback((item: any, e: React.MouseEvent) => {
    if (isSelectionMode || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (!isSelectionMode) onStartSelection();
      onItemSelect(item.id, !selectedIds.has(item.id));
    }
  }, [isSelectionMode, selectedIds, onItemSelect, onStartSelection]);
  
  const handleItemDoubleClick = useCallback((item: any) => {
    if (viewType === 'tracks' && onPlayTrack) {
      onPlayTrack(item.id);
    } else if (viewType === 'albums' && onPlayAlbum) {
      onPlayAlbum(item.name, item.artist);
    }
  }, [viewType, onPlayTrack, onPlayAlbum]);
  
  const renderTrackCard = (track: AudioFile) => (
    <div
      key={track.id}
      className={`grid-item track-card ${selectedIds.has(track.id) ? 'selected' : ''}`}
      onClick={(e) => handleItemClick(track, e)}
      onDoubleClick={() => handleItemDoubleClick(track)}
    >
      <div className="album-art">
        {track.albumArt ? (
          <img src={track.albumArt} alt={track.album || 'Album art'} />
        ) : (
          <div className="album-art-placeholder">🎵</div>
        )}
        
        <div className="hover-controls">
          <button
            className="play-button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayTrack?.(track.id);
            }}
            title="Play"
          >
            ▶
          </button>
          <button
            className="queue-button"
            onClick={(e) => {
              e.stopPropagation();
              onAddToQueue?.(track.id);
            }}
            title="Add to queue"
          >
            +
          </button>
        </div>
      </div>
      
      <div className="track-info">
        <div className="track-title" title={track.title}>{track.title}</div>
        <div className="track-artist" title={track.artist}>{track.artist}</div>
        <div className="track-meta">
          {track.album && <span className="track-album">{track.album}</span>}
          <span className="track-duration">{formatDuration(track.duration)}</span>
        </div>
        
        {track.rating && (
          <div className="track-rating">
            {'★'.repeat(track.rating)}{'☆'.repeat(5 - track.rating)}
          </div>
        )}
      </div>
      
      {isSelectionMode && (
        <div className="selection-checkbox">
          <input
            type="checkbox"
            checked={selectedIds.has(track.id)}
            onChange={() => {}}
          />
        </div>
      )}
    </div>
  );
  
  const renderAlbumCard = (album: Album) => (
    <div
      key={album.id}
      className={`grid-item album-card ${selectedIds.has(album.id) ? 'selected' : ''}`}
      onClick={(e) => handleItemClick(album, e)}
      onDoubleClick={() => handleItemDoubleClick(album)}
    >
      <div className="album-art">
        {album.albumArt ? (
          <img src={album.albumArt} alt={album.name} />
        ) : (
          <div className="album-art-placeholder">💿</div>
        )}
        
        <div className="hover-controls">
          <button
            className="play-button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayAlbum?.(album.name, album.artist);
            }}
            title="Play album"
          >
            ▶
          </button>
        </div>
      </div>
      
      <div className="album-info">
        <div className="album-name" title={album.name}>{album.name}</div>
        <div className="album-artist" title={album.artist}>{album.artist}</div>
        <div className="album-meta">
          {album.year && <span className="album-year">{album.year}</span>}
          <span className="album-tracks">{album.trackCount} tracks</span>
        </div>
        
        {album.avgRating && (
          <div className="album-rating">
            {'★'.repeat(Math.round(album.avgRating))}
            {'☆'.repeat(5 - Math.round(album.avgRating))}
          </div>
        )}
      </div>
      
      {isSelectionMode && (
        <div className="selection-checkbox">
          <input
            type="checkbox"
            checked={selectedIds.has(album.id)}
            onChange={() => {}}
          />
        </div>
      )}
    </div>
  );
  
  const renderArtistCard = (artist: Artist) => (
    <div
      key={artist.id}
      className={`grid-item artist-card ${selectedIds.has(artist.id) ? 'selected' : ''}`}
      onClick={(e) => handleItemClick(artist, e)}
      onDoubleClick={() => handleItemDoubleClick(artist)}
    >
      <div className="artist-avatar">
        <div className="artist-avatar-placeholder">👤</div>
      </div>
      
      <div className="artist-info">
        <div className="artist-name" title={artist.name}>{artist.name}</div>
        <div className="artist-meta">
          <span className="artist-albums">{artist.albumCount} albums</span>
          <span className="artist-tracks">{artist.trackCount} tracks</span>
        </div>
        {artist.genre && <div className="artist-genre">{artist.genre}</div>}
        
        {artist.avgRating && (
          <div className="artist-rating">
            {'★'.repeat(Math.round(artist.avgRating))}
            {'☆'.repeat(5 - Math.round(artist.avgRating))}
          </div>
        )}
      </div>
      
      {isSelectionMode && (
        <div className="selection-checkbox">
          <input
            type="checkbox"
            checked={selectedIds.has(artist.id)}
            onChange={() => {}}
          />
        </div>
      )}
    </div>
  );
  
  const renderGenreCard = (genre: any) => (
    <div
      key={genre.name}
      className="grid-item genre-card"
      onClick={(e) => handleItemClick(genre, e)}
    >
      <div className="genre-icon">
        <div className="genre-icon-placeholder">🎼</div>
      </div>
      
      <div className="genre-info">
        <div className="genre-name">{genre.name}</div>
        <div className="genre-meta">
          <span className="genre-tracks">{genre.trackCount} tracks</span>
          <span className="genre-artists">{genre.artistCount} artists</span>
        </div>
        <div className="genre-duration">
          {formatDuration(genre.totalDuration)}
        </div>
      </div>
    </div>
  );
  
  return (
    <div className={`library-grid ${viewType}-grid`}>
      {items.map(item => {
        switch (viewType) {
          case 'tracks':
            return renderTrackCard(item as AudioFile);
          case 'albums':
            return renderAlbumCard(item as Album);
          case 'artists':
            return renderArtistCard(item as Artist);
          case 'genres':
            return renderGenreCard(item);
          default:
            return null;
        }
      })}
    </div>
  );
});