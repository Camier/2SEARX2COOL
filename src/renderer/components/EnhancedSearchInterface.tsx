import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PersonalizedSearchResult } from '../../main/services/PersonalizedSearchService';
import { SearchStatusInfo } from '../../main/services/OfflineSearchService';
import { OfflineIndicator, OfflineStatusBadge } from './OfflineIndicator';
import { SearchResultCard } from './SearchResultCard';
import { SearchSuggestions } from './SearchSuggestions';
import { SearchFilters } from './SearchFilters';
import { debounce } from '../../utils/debounce';

interface EnhancedSearchInterfaceProps {
  onResultSelect?: (result: PersonalizedSearchResult) => void;
  onPlayTrack?: (result: PersonalizedSearchResult) => void;
}

/**
 * Week 4 Day 1: Enhanced Search Interface Component
 * 
 * Unified search interface that combines local library search,
 * SearXNG web search, offline capabilities, and personal scoring.
 */
export const EnhancedSearchInterface: React.FC<EnhancedSearchInterfaceProps> = ({
  onResultSelect,
  onPlayTrack
}) => {
  // State management
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonalizedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<SearchStatusInfo | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  
  // Search options
  const [searchOptions, setSearchOptions] = useState({
    includeLocal: true,
    includeSearxng: true,
    includePersonalScore: true,
    personalScoreWeight: 0.3,
    favoriteBoost: true,
    limit: 50
  });
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Load initial status
  useEffect(() => {
    loadSearchStatus();
    
    // Subscribe to status updates
    const handleStatusUpdate = (_event: any, status: SearchStatusInfo) => {
      setSearchStatus(status);
    };
    
    // @ts-ignore
    window.electron.ipcRenderer.on('search-status-update', handleStatusUpdate);
    
    return () => {
      // @ts-ignore
      window.electron.ipcRenderer.removeListener('search-status-update', handleStatusUpdate);
    };
  }, []);
  
  // Load search status
  const loadSearchStatus = async () => {
    try {
      // @ts-ignore
      const status = await window.electron.ipcRenderer.invoke('get-search-status');
      setSearchStatus(status);
    } catch (error) {
      console.error('Failed to load search status:', error);
    }
  };
  
  // Perform search
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    
    // Cancel previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setLoading(true);
    setError(null);
    
    try {
      // @ts-ignore
      const searchResults = await window.electron.ipcRenderer.invoke(
        'perform-search',
        searchQuery,
        searchOptions,
        { signal: abortController.signal }
      );
      
      if (!abortController.signal.aborted) {
        setResults(searchResults);
        
        // Record search in history
        // @ts-ignore
        window.electron.ipcRenderer.send('record-search', searchQuery);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search failed:', error);
        setError(error.message || 'Search failed. Please try again.');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };
  
  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => performSearch(value), 300),
    [searchOptions]
  );
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.trim()) {
      debouncedSearch(value);
      loadSuggestions(value);
    } else {
      setResults([]);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };
  
  // Load search suggestions
  const loadSuggestions = async (partial: string) => {
    try {
      // @ts-ignore
      const suggestionsData = await window.electron.ipcRenderer.invoke(
        'get-search-suggestions',
        partial,
        10
      );
      setSuggestions(suggestionsData);
      setShowSuggestions(suggestionsData.length > 0);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };
  
  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
    searchInputRef.current?.focus();
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => prev > -1 ? prev - 1 : -1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestion >= 0) {
          handleSuggestionSelect(suggestions[selectedSuggestion]);
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        break;
    }
  };
  
  // Handle result interaction
  const handleResultClick = (result: PersonalizedSearchResult) => {
    // Record interaction
    // @ts-ignore
    window.electron.ipcRenderer.send('record-interaction', {
      resultId: result.id,
      resultType: result.source,
      interactionType: 'click',
      query
    });
    
    onResultSelect?.(result);
  };
  
  const handlePlayClick = (result: PersonalizedSearchResult) => {
    // Record play interaction
    // @ts-ignore
    window.electron.ipcRenderer.send('record-interaction', {
      resultId: result.id,
      resultType: result.source,
      interactionType: 'play',
      query
    });
    
    onPlayTrack?.(result);
  };
  
  // Handle rating change
  const handleRatingChange = async (result: PersonalizedSearchResult, rating: number) => {
    if (result.localFile?.id) {
      try {
        // @ts-ignore
        await window.electron.ipcRenderer.invoke('set-rating', result.localFile.id, rating);
        
        // Update result in state
        setResults(prev => prev.map(r => 
          r.id === result.id ? { ...r, rating } : r
        ));
      } catch (error) {
        console.error('Failed to set rating:', error);
      }
    }
  };
  
  // Handle favorite toggle
  const handleFavoriteToggle = async (result: PersonalizedSearchResult) => {
    if (result.localFile?.id) {
      try {
        // @ts-ignore
        const newStatus = await window.electron.ipcRenderer.invoke(
          'toggle-favorite',
          result.localFile.id
        );
        
        // Update result in state
        setResults(prev => prev.map(r => 
          r.id === result.id ? { ...r, favorite: newStatus } : r
        ));
      } catch (error) {
        console.error('Failed to toggle favorite:', error);
      }
    }
  };
  
  return (
    <div className="search-interface p-6">
      {/* Header with search status */}
      <div className="search-header mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Music Search</h1>
          <div className="flex items-center gap-4">
            <OfflineIndicator showDetails={true} />
            {searchStatus?.mode === 'offline' && <OfflineStatusBadge />}
          </div>
        </div>
        
        {/* Search input */}
        <div className="relative">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onFocus={() => query && loadSuggestions(query)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search for music..."
              className="w-full px-4 py-3 pr-12 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              autoFocus
            />
            
            {/* Search icon/spinner */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>
          </div>
          
          {/* Search suggestions */}
          {showSuggestions && (
            <SearchSuggestions
              suggestions={suggestions}
              selectedIndex={selectedSuggestion}
              onSelect={handleSuggestionSelect}
            />
          )}
        </div>
        
        {/* Search filters */}
        <SearchFilters
          options={searchOptions}
          onChange={setSearchOptions}
          disabled={loading}
        />
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {/* Results count and sort */}
      {results.length > 0 && !loading && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-600">
            Found {results.length} results
            {searchStatus?.mode === 'offline' && ' (offline mode)'}
          </p>
          
          <select className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="relevance">Sort by Relevance</option>
            <option value="personal">Sort by Personal Score</option>
            <option value="recent">Sort by Recently Played</option>
            <option value="rating">Sort by Rating</option>
          </select>
        </div>
      )}
      
      {/* Search results */}
      <div className="search-results space-y-4">
        {results.map((result, index) => (
          <SearchResultCard
            key={result.id}
            result={result}
            index={index}
            onPlay={() => handlePlayClick(result)}
            onClick={() => handleResultClick(result)}
            onRate={(rating) => handleRatingChange(result, rating)}
            onToggleFavorite={() => handleFavoriteToggle(result)}
          />
        ))}
      </div>
      
      {/* Empty state */}
      {!loading && query && results.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600 text-lg">No results found for "{query}"</p>
          {searchStatus?.mode === 'offline' && (
            <p className="text-gray-500 text-sm mt-2">
              You're in offline mode. Try searching for something you've played before.
            </p>
          )}
        </div>
      )}
      
      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-24" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedSearchInterface;