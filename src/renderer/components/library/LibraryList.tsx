import React, { useCallback, memo } from 'react';
import { AudioFile, Album, Artist } from '../../../main/database/LibrarySchema';
import { formatDuration, formatFileSize } from '../../utils/formatters';
import './LibraryList.css';

interface LibraryListProps {
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
 * List view component for library items with detailed information
 */
export const LibraryList: React.FC<LibraryListProps> = memo(({
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
  
  const handleRowClick = useCallback((item: any, e: React.MouseEvent) => {
    if (isSelectionMode || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (!isSelectionMode) onStartSelection();
      onItemSelect(item.id, !selectedIds.has(item.id));
    }
  }, [isSelectionMode, selectedIds, onItemSelect, onStartSelection]);
  
  const handleRowDoubleClick = useCallback((item: any) => {
    if (viewType === 'tracks' && onPlayTrack) {
      onPlayTrack(item.id);
    } else if (viewType === 'albums' && onPlayAlbum) {
      onPlayAlbum(item.name, item.artist);
    }
  }, [viewType, onPlayTrack, onPlayAlbum]);
  
  const renderTrackRow = (track: AudioFile, index: number) => (
    <tr
      key={track.id}
      className={`list-row track-row ${selectedIds.has(track.id) ? 'selected' : ''}`}
      onClick={(e) => handleRowClick(track, e)}
      onDoubleClick={() => handleRowDoubleClick(track)}
    >
      {isSelectionMode && (
        <td className="selection-cell">
          <input
            type="checkbox"
            checked={selectedIds.has(track.id)}
            onChange={() => onItemSelect(track.id, !selectedIds.has(track.id))}
          />
        </td>
      )}
      
      <td className="track-number">{index + 1}</td>
      
      <td className="track-title">
        <div className="title-with-controls">
          <span title={track.title}>{track.title}</span>
          <div className="inline-controls">
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
      </td>
      
      <td className="track-artist" title={track.artist}>{track.artist}</td>
      <td className="track-album" title={track.album}>{track.album || '-'}</td>
      <td className="track-duration">{formatDuration(track.duration)}</td>
      
      {track.genre && <td className="track-genre">{track.genre}</td>}
      {track.year && <td className="track-year">{track.year}</td>}
      
      <td className="track-rating">
        {track.rating ? (
          <span className="stars">
            {'★'.repeat(track.rating)}{'☆'.repeat(5 - track.rating)}
          </span>
        ) : '-'}
      </td>
      
      <td className="track-plays">{track.playCount || 0}</td>
      
      {track.isFavorite && (
        <td className="track-favorite">❤️</td>
      )}
    </tr>
  );
  
  const renderAlbumRow = (album: Album, index: number) => (
    <tr
      key={album.id}
      className={`list-row album-row ${selectedIds.has(album.id) ? 'selected' : ''}`}
      onClick={(e) => handleRowClick(album, e)}
      onDoubleClick={() => handleRowDoubleClick(album)}
    >
      {isSelectionMode && (
        <td className="selection-cell">
          <input
            type="checkbox"
            checked={selectedIds.has(album.id)}
            onChange={() => onItemSelect(album.id, !selectedIds.has(album.id))}
          />
        </td>
      )}
      
      <td className="album-number">{index + 1}</td>
      
      <td className="album-art-cell">
        {album.albumArt ? (
          <img src={album.albumArt} alt={album.name} className="album-art-thumb" />
        ) : (
          <div className="album-art-placeholder">💿</div>
        )}
      </td>
      
      <td className="album-name">
        <div className="title-with-controls">
          <span title={album.name}>{album.name}</span>
          <div className="inline-controls">
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
      </td>
      
      <td className="album-artist" title={album.artist}>{album.artist}</td>
      <td className="album-year">{album.year || '-'}</td>
      <td className="album-tracks">{album.trackCount}</td>
      <td className="album-duration">{formatDuration(album.totalDuration)}</td>
      
      <td className="album-rating">
        {album.avgRating ? (
          <span className="stars">
            {'★'.repeat(Math.round(album.avgRating))}
            {'☆'.repeat(5 - Math.round(album.avgRating))}
          </span>
        ) : '-'}
      </td>
      
      <td className="album-plays">{album.totalPlayCount || 0}</td>
    </tr>
  );
  
  const renderArtistRow = (artist: Artist, index: number) => (
    <tr
      key={artist.id}
      className={`list-row artist-row ${selectedIds.has(artist.id) ? 'selected' : ''}`}
      onClick={(e) => handleRowClick(artist, e)}
      onDoubleClick={() => handleRowDoubleClick(artist)}
    >
      {isSelectionMode && (
        <td className="selection-cell">
          <input
            type="checkbox"
            checked={selectedIds.has(artist.id)}
            onChange={() => onItemSelect(artist.id, !selectedIds.has(artist.id))}
          />
        </td>
      )}
      
      <td className="artist-number">{index + 1}</td>
      
      <td className="artist-name" title={artist.name}>{artist.name}</td>
      <td className="artist-albums">{artist.albumCount}</td>
      <td className="artist-tracks">{artist.trackCount}</td>
      <td className="artist-duration">{formatDuration(artist.totalDuration)}</td>
      
      {artist.genre && <td className="artist-genre">{artist.genre}</td>}
      
      <td className="artist-rating">
        {artist.avgRating ? (
          <span className="stars">
            {'★'.repeat(Math.round(artist.avgRating))}
            {'☆'.repeat(5 - Math.round(artist.avgRating))}
          </span>
        ) : '-'}
      </td>
      
      <td className="artist-plays">{artist.totalPlayCount || 0}</td>
    </tr>
  );
  
  const renderGenreRow = (genre: any, index: number) => (
    <tr
      key={genre.name}
      className="list-row genre-row"
      onClick={(e) => handleRowClick(genre, e)}
    >
      <td className="genre-number">{index + 1}</td>
      <td className="genre-name">{genre.name}</td>
      <td className="genre-tracks">{genre.trackCount}</td>
      <td className="genre-artists">{genre.artistCount}</td>
      <td className="genre-albums">{genre.albumCount}</td>
      <td className="genre-duration">{formatDuration(genre.totalDuration)}</td>
      
      <td className="genre-rating">
        {genre.avgRating ? (
          <span className="stars">
            {'★'.repeat(Math.round(genre.avgRating))}
            {'☆'.repeat(5 - Math.round(genre.avgRating))}
          </span>
        ) : '-'}
      </td>
      
      <td className="genre-plays">{genre.totalPlayCount || 0}</td>
    </tr>
  );
  
  const getTableHeaders = () => {
    switch (viewType) {
      case 'tracks':
        return (
          <>
            {isSelectionMode && <th className="selection-header"></th>}
            <th>#</th>
            <th>Title</th>
            <th>Artist</th>
            <th>Album</th>
            <th>Duration</th>
            <th>Genre</th>
            <th>Year</th>
            <th>Rating</th>
            <th>Plays</th>
            <th>Fav</th>
          </>
        );
      
      case 'albums':
        return (
          <>
            {isSelectionMode && <th className="selection-header"></th>}
            <th>#</th>
            <th></th>
            <th>Album</th>
            <th>Artist</th>
            <th>Year</th>
            <th>Tracks</th>
            <th>Duration</th>
            <th>Rating</th>
            <th>Plays</th>
          </>
        );
      
      case 'artists':
        return (
          <>
            {isSelectionMode && <th className="selection-header"></th>}
            <th>#</th>
            <th>Artist</th>
            <th>Albums</th>
            <th>Tracks</th>
            <th>Duration</th>
            <th>Genre</th>
            <th>Rating</th>
            <th>Plays</th>
          </>
        );
      
      case 'genres':
        return (
          <>
            <th>#</th>
            <th>Genre</th>
            <th>Tracks</th>
            <th>Artists</th>
            <th>Albums</th>
            <th>Duration</th>
            <th>Rating</th>
            <th>Plays</th>
          </>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="library-list">
      <table className={`list-table ${viewType}-table`}>
        <thead>
          <tr>{getTableHeaders()}</tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            switch (viewType) {
              case 'tracks':
                return renderTrackRow(item as AudioFile, index);
              case 'albums':
                return renderAlbumRow(item as Album, index);
              case 'artists':
                return renderArtistRow(item as Artist, index);
              case 'genres':
                return renderGenreRow(item, index);
              default:
                return null;
            }
          })}
        </tbody>
      </table>
    </div>
  );
});