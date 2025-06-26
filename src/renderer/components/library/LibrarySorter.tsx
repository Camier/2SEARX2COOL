import React, { useCallback, memo } from 'react';
import { LibrarySortOptions } from '../../../main/database/LibrarySchema';
import './LibrarySorter.css';

interface LibrarySorterProps {
  currentSort: LibrarySortOptions;
  viewType: 'tracks' | 'albums' | 'artists' | 'genres';
  onSortChange: (sort: LibrarySortOptions) => void;
}

/**
 * Sort controls for the library browser
 */
export const LibrarySorter: React.FC<LibrarySorterProps> = memo(({
  currentSort,
  viewType,
  onSortChange
}) => {
  
  const getSortOptions = () => {
    switch (viewType) {
      case 'tracks':
        return [
          { value: 'title', label: 'Title' },
          { value: 'artist', label: 'Artist' },
          { value: 'album', label: 'Album' },
          { value: 'dateAdded', label: 'Date Added' },
          { value: 'lastPlayed', label: 'Last Played' },
          { value: 'playCount', label: 'Play Count' },
          { value: 'rating', label: 'Rating' },
          { value: 'duration', label: 'Duration' },
          { value: 'year', label: 'Year' },
          { value: 'genre', label: 'Genre' },
          { value: 'personalScore', label: 'Personal Score' }
        ];
      
      case 'albums':
        return [
          { value: 'album', label: 'Album Name' },
          { value: 'artist', label: 'Artist' },
          { value: 'year', label: 'Year' },
          { value: 'dateAdded', label: 'Date Added' },
          { value: 'rating', label: 'Avg Rating' },
          { value: 'playCount', label: 'Total Plays' }
        ];
      
      case 'artists':
        return [
          { value: 'artist', label: 'Artist Name' },
          { value: 'playCount', label: 'Total Plays' },
          { value: 'rating', label: 'Avg Rating' }
        ];
      
      case 'genres':
        return [
          { value: 'title', label: 'Genre Name' },
          { value: 'playCount', label: 'Track Count' }
        ];
      
      default:
        return [];
    }
  };
  
  const handleFieldChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange({
      ...currentSort,
      field: e.target.value as any
    });
  }, [currentSort, onSortChange]);
  
  const handleDirectionToggle = useCallback(() => {
    onSortChange({
      ...currentSort,
      direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
    });
  }, [currentSort, onSortChange]);
  
  const sortOptions = getSortOptions();
  
  return (
    <div className="library-sorter">
      <label className="sort-label">Sort by:</label>
      
      <select
        className="sort-select"
        value={currentSort.field}
        onChange={handleFieldChange}
      >
        {sortOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      <button
        className={`sort-direction ${currentSort.direction}`}
        onClick={handleDirectionToggle}
        title={currentSort.direction === 'asc' ? 'Ascending' : 'Descending'}
      >
        {currentSort.direction === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
});