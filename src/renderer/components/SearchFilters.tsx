import React from 'react';

interface SearchOptions {
  includeLocal: boolean;
  includeSearxng: boolean;
  includePersonalScore: boolean;
  personalScoreWeight: number;
  favoriteBoost: boolean;
  limit: number;
}

interface SearchFiltersProps {
  options: SearchOptions;
  onChange: (options: SearchOptions) => void;
  disabled?: boolean;
}

/**
 * Week 4 Day 1: Search Filters Component
 * 
 * Advanced search options and filters for controlling
 * search behavior and result ranking.
 */
export const SearchFilters: React.FC<SearchFiltersProps> = ({
  options,
  onChange,
  disabled = false
}) => {
  const handleToggle = (key: keyof SearchOptions) => {
    onChange({
      ...options,
      [key]: !options[key]
    });
  };
  
  const handleSliderChange = (key: keyof SearchOptions, value: number) => {
    onChange({
      ...options,
      [key]: value
    });
  };
  
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Search Options</h3>
        <button
          type="button"
          onClick={() => onChange({
            includeLocal: true,
            includeSearxng: true,
            includePersonalScore: true,
            personalScoreWeight: 0.3,
            favoriteBoost: true,
            limit: 50
          })}
          className="text-xs text-blue-600 hover:text-blue-700"
          disabled={disabled}
        >
          Reset to defaults
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Search sources */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeLocal}
              onChange={() => handleToggle('includeLocal')}
              disabled={disabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Search local library</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeSearxng}
              onChange={() => handleToggle('includeSearxng')}
              disabled={disabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Search web (SearXNG)</span>
          </label>
        </div>
        
        {/* Personalization options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includePersonalScore}
              onChange={() => handleToggle('includePersonalScore')}
              disabled={disabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Use personal scoring</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.favoriteBoost}
              onChange={() => handleToggle('favoriteBoost')}
              disabled={disabled || !options.includePersonalScore}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700">Boost favorites</span>
          </label>
        </div>
        
        {/* Personal score weight */}
        <div className="space-y-2">
          <label className="block">
            <span className="text-sm text-gray-700">
              Personal weight: {Math.round(options.personalScoreWeight * 100)}%
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={options.personalScoreWeight * 100}
              onChange={(e) => handleSliderChange('personalScoreWeight', parseInt(e.target.value) / 100)}
              disabled={disabled || !options.includePersonalScore}
              className="mt-1 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </label>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>Relevance</span>
            <span>Personal</span>
          </div>
        </div>
      </div>
      
      {/* Results limit */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <label className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Results per page:</span>
          <select
            value={options.limit}
            onChange={(e) => handleSliderChange('limit', parseInt(e.target.value))}
            disabled={disabled}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
      </div>
    </div>
  );
};