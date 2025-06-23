/**
 * SearchInterface.tsx - Main Search Component
 * 
 * Primary search interface integrating with SearXNG backend
 * Features:
 * - Real-time search with debouncing
 * - Multiple search engines
 * - Result filtering and sorting
 * - Keyboard shortcuts
 * - Hardware control integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  score?: number;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

interface SearchInterfaceProps {
  serverStatus: {
    running: boolean;
    url?: string;
    mode?: string;
  };
  onServerConnect?: () => void;
  onServerDisconnect?: () => void;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  serverStatus,
  onServerConnect,
  onServerDisconnect
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState('all');
  const [filters, setFilters] = useState({
    category: 'all',
    timeRange: 'all',
    language: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Auto-search with debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length > 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch();
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, selectedEngine, filters, currentPage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            searchInputRef.current?.focus();
            break;
          case 'Enter':
            if (results.length > 0) {
              window.open(results[0].url, '_blank');
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results]);

  const performSearch = useCallback(async () => {
    if (!query.trim() || !serverStatus.running) return;

    setLoading(true);
    
    try {
      const searchParams = {
        q: query.trim(),
        engines: selectedEngine === 'all' ? undefined : selectedEngine,
        category: filters.category === 'all' ? undefined : filters.category,
        time_range: filters.timeRange === 'all' ? undefined : filters.timeRange,
        language: filters.language === 'all' ? undefined : filters.language,
        page: currentPage
      };

      // Use the API if available, otherwise direct fetch
      let searchResults;
      if (window.api?.search?.performSearch) {
        searchResults = await window.api.search.performSearch(searchParams);
      } else {
        // Fallback to direct fetch
        const searchUrl = new URL('/search', serverStatus.url);
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value !== undefined) {
            searchUrl.searchParams.append(key, String(value));
          }
        });

        const response = await fetch(searchUrl.toString());
        searchResults = await response.json();
      }

      setResults(searchResults.results || []);
      setTotalResults(searchResults.number_of_results || 0);

    } catch (error) {
      console.error('❌ [SEARCH] Search failed:', error);
      setResults([]);
      // Show error notification
      window.api?.notifications?.show?.({
        type: 'error',
        title: 'Search Failed',
        message: 'Unable to perform search. Please check server connection.'
      });
    } finally {
      setLoading(false);
    }
  }, [query, selectedEngine, filters, currentPage, serverStatus]);

  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setCurrentPage(1); // Reset to first page
  }, []);

  const handleEngineChange = useCallback((engine: string) => {
    setSelectedEngine(engine);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setCurrentPage(1);
  }, []);

  const handleResultClick = useCallback((result: SearchResult, event: React.MouseEvent) => {
    const shouldOpenInNewTab = event.metaKey || event.ctrlKey || event.button === 1;
    
    if (shouldOpenInNewTab) {
      window.open(result.url, '_blank');
    } else {
      window.location.href = result.url;
    }

    // Track click for analytics
    window.api?.analytics?.trackEvent?.('search_result_click', {
      query,
      url: result.url,
      engine: result.engine,
      position: results.indexOf(result)
    });
  }, [query, results]);

  const renderSearchHeader = () => (
    <div className="search-header">
      <div className="search-input-container">
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          placeholder="Search the web... (⌘K to focus)"
          value={query}
          onChange={handleQueryChange}
          disabled={!serverStatus.running}
        />
        
        {loading && <div className="search-loading-indicator">🔍</div>}
      </div>

      <div className="search-filters">
        <select
          value={selectedEngine}
          onChange={(e) => handleEngineChange(e.target.value)}
          className="engine-select"
        >
          <option value="all">All Engines</option>
          <option value="google">Google</option>
          <option value="bing">Bing</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="startpage">Startpage</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="category-select"
        >
          <option value="all">All Categories</option>
          <option value="general">General</option>
          <option value="music">Music</option>
          <option value="videos">Videos</option>
          <option value="images">Images</option>
          <option value="news">News</option>
        </select>

        <select
          value={filters.timeRange}
          onChange={(e) => handleFilterChange('timeRange', e.target.value)}
          className="time-select"
        >
          <option value="all">Any Time</option>
          <option value="day">Past Day</option>
          <option value="week">Past Week</option>
          <option value="month">Past Month</option>
          <option value="year">Past Year</option>
        </select>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!serverStatus.running) {
      return (
        <div className="search-status">
          <div className="status-message">
            <h3>🔌 Server Not Connected</h3>
            <p>Please start the SearXNG server to begin searching.</p>
            {onServerConnect && (
              <button onClick={onServerConnect} className="connect-btn">
                Start Server
              </button>
            )}
          </div>
        </div>
      );
    }

    if (!query.trim()) {
      return (
        <div className="search-placeholder">
          <div className="placeholder-content">
            <h2>🔍 2SEARX2COOL</h2>
            <p>Enter a search query to explore the web with enhanced privacy.</p>
            <div className="search-tips">
              <h4>Quick Tips:</h4>
              <ul>
                <li>Use <kbd>⌘K</kbd> to focus search</li>
                <li>Hold <kbd>⌘</kbd> + click to open in new tab</li>
                <li>Try specific engines for better results</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="search-loading">
          <div className="loading-spinner"></div>
          <p>Searching across multiple engines...</p>
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <div className="search-no-results">
          <h3>No results found</h3>
          <p>Try adjusting your search terms or filters.</p>
        </div>
      );
    }

    return (
      <div className="search-results">
        <div className="results-meta">
          <span>{totalResults.toLocaleString()} results</span>
          <span>•</span>
          <span>Page {currentPage}</span>
        </div>

        <div className="results-list">
          {results.map((result, index) => (
            <div
              key={`${result.url}-${index}`}
              className="result-item"
              onClick={(e) => handleResultClick(result, e)}
            >
              <div className="result-header">
                <h3 className="result-title">{result.title}</h3>
                <div className="result-meta">
                  <span className="result-engine">{result.engine}</span>
                  {result.score && (
                    <span className="result-score">
                      Score: {Math.round(result.score * 100)}%
                    </span>
                  )}
                </div>
              </div>
              
              <div className="result-url">{result.url}</div>
              
              {result.content && (
                <div className="result-content">{result.content}</div>
              )}
              
              {result.thumbnail && (
                <div className="result-thumbnail">
                  <img src={result.thumbnail} alt="" loading="lazy" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          
          <span className="pagination-info">Page {currentPage}</span>
          
          <button
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={results.length < 20} // Assuming 20 results per page
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="search-interface">
      {renderSearchHeader()}
      <div className="search-content">
        {renderResults()}
      </div>
    </div>
  );
};

export default SearchInterface;