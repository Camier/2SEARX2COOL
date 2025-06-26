import React, { useState, useCallback, memo } from 'react';
import { LibraryFilter } from '../../../main/database/LibrarySchema';
import './LibraryFilters.css';

interface LibraryFiltersProps {
  filter: LibraryFilter;
  filterOptions?: {
    artists: string[];
    albums: string[];
    genres: string[];
    years: number[];
    formats: string[];
  };
  onFilterChange: (filter: LibraryFilter) => void;
}

/**
 * Filter controls for the library browser
 */
export const LibraryFilters: React.FC<LibraryFiltersProps> = memo(({
  filter,
  filterOptions,
  onFilterChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Handle search query change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filter,
      searchQuery: e.target.value
    });
  }, [filter, onFilterChange]);
  
  // Handle genre filter
  const handleGenreChange = useCallback((genre: string) => {
    const genres = filter.genres || [];
    const newGenres = genres.includes(genre)
      ? genres.filter(g => g !== genre)
      : [...genres, genre];
    
    onFilterChange({
      ...filter,
      genres: newGenres.length > 0 ? newGenres : undefined
    });
  }, [filter, onFilterChange]);
  
  // Handle year filter
  const handleYearChange = useCallback((year: number) => {
    const years = filter.years || [];
    const newYears = years.includes(year)
      ? years.filter(y => y !== year)
      : [...years, year];
    
    onFilterChange({
      ...filter,
      years: newYears.length > 0 ? newYears : undefined
    });
  }, [filter, onFilterChange]);
  
  // Handle rating filter
  const handleMinRatingChange = useCallback((rating: number) => {
    onFilterChange({
      ...filter,
      minRating: filter.minRating === rating ? undefined : rating
    });
  }, [filter, onFilterChange]);
  
  // Handle boolean filters
  const handleBooleanFilter = useCallback((key: keyof LibraryFilter, value: boolean) => {
    onFilterChange({
      ...filter,
      [key]: filter[key] === value ? undefined : value
    });
  }, [filter, onFilterChange]);
  
  // Clear all filters
  const handleClearFilters = useCallback(() => {
    onFilterChange({});
  }, [onFilterChange]);
  
  // Check if any filters are active
  const hasActiveFilters = Object.keys(filter).some(key => 
    key !== 'searchQuery' && filter[key as keyof LibraryFilter] !== undefined
  );
  
  return (
    <div className="library-filters">
      <div className="filters-header">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search library..."
            value={filter.searchQuery || ''}
            onChange={handleSearchChange}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <button
          className={`filter-toggle ${isExpanded ? 'expanded' : ''} ${hasActiveFilters ? 'active' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          ⚙️ Filters {hasActiveFilters && '●'}
        </button>
        
        {hasActiveFilters && (
          <button
            className="clear-filters"
            onClick={handleClearFilters}
          >
            Clear
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="filters-content">
          {/* Genre filter */}
          {filterOptions?.genres && filterOptions.genres.length > 0 && (
            <div className="filter-section">
              <h4>Genre</h4>
              <div className="filter-chips">
                {filterOptions.genres.slice(0, 10).map(genre => (
                  <label key={genre} className="filter-chip">
                    <input
                      type="checkbox"
                      checked={filter.genres?.includes(genre) || false}
                      onChange={() => handleGenreChange(genre)}
                    />
                    <span>{genre}</span>
                  </label>
                ))}
                {filterOptions.genres.length > 10 && (
                  <span className="more-indicator">
                    +{filterOptions.genres.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Year filter */}
          {filterOptions?.years && filterOptions.years.length > 0 && (
            <div className="filter-section">
              <h4>Year</h4>
              <div className="filter-chips">
                {filterOptions.years.slice(0, 10).map(year => (
                  <label key={year} className="filter-chip">
                    <input
                      type="checkbox"
                      checked={filter.years?.includes(year) || false}
                      onChange={() => handleYearChange(year)}
                    />
                    <span>{year}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* Rating filter */}
          <div className="filter-section">
            <h4>Minimum Rating</h4>
            <div className="rating-filter">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  className={`rating-button ${filter.minRating === rating ? 'active' : ''}`}
                  onClick={() => handleMinRatingChange(rating)}
                  title={`${rating}+ stars`}
                >
                  {'★'.repeat(rating)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Quick filters */}
          <div className="filter-section">
            <h4>Quick Filters</h4>
            <div className="quick-filters">
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={filter.favorites === true}
                  onChange={(e) => handleBooleanFilter('favorites', true)}
                />
                <span>❤️ Favorites Only</span>
              </label>
              
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={filter.unrated === true}
                  onChange={(e) => handleBooleanFilter('unrated', true)}
                />
                <span>Unrated Only</span>
              </label>
              
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={filter.recentlyAdded === true}
                  onChange={(e) => handleBooleanFilter('recentlyAdded', true)}
                />
                <span>Recently Added (30 days)</span>
              </label>
              
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={filter.recentlyPlayed === true}
                  onChange={(e) => handleBooleanFilter('recentlyPlayed', true)}
                />
                <span>Recently Played (7 days)</span>
              </label>
            </div>
          </div>
          
          {/* Special filters */}
          <div className="filter-section">
            <h4>Special Filters</h4>
            <div className="quick-filters">
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={filter.hasLyrics === true}
                  onChange={(e) => handleBooleanFilter('hasLyrics', true)}
                />
                <span>Has Lyrics</span>
              </label>
              
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={filter.hasAlbumArt === true}
                  onChange={(e) => handleBooleanFilter('hasAlbumArt', true)}
                />
                <span>Has Album Art</span>
              </label>
            </div>
          </div>
          
          {/* File format filter */}
          {filterOptions?.formats && filterOptions.formats.length > 0 && (
            <div className="filter-section">
              <h4>File Format</h4>
              <div className="filter-chips">
                {filterOptions.formats.map(format => (
                  <label key={format} className="filter-chip">
                    <input
                      type="checkbox"
                      checked={filter.fileFormats?.includes(format) || false}
                      onChange={() => {
                        const formats = filter.fileFormats || [];
                        const newFormats = formats.includes(format)
                          ? formats.filter(f => f !== format)
                          : [...formats, format];
                        
                        onFilterChange({
                          ...filter,
                          fileFormats: newFormats.length > 0 ? newFormats : undefined
                        });
                      }}
                    />
                    <span>{format.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});