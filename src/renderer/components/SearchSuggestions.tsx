import React from 'react';

interface SearchSuggestionsProps {
  suggestions: string[];
  selectedIndex: number;
  onSelect: (suggestion: string) => void;
}

/**
 * Week 4 Day 1: Search Suggestions Component
 * 
 * Dropdown list of search suggestions based on search history
 * and local library content.
 */
export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  selectedIndex,
  onSelect
}) => {
  if (suggestions.length === 0) return null;
  
  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
      <ul className="py-1 max-h-60 overflow-y-auto">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion}>
            <button
              type="button"
              className={`
                w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors
                ${selectedIndex === index ? 'bg-gray-100' : ''}
              `}
              onClick={() => onSelect(suggestion)}
              onMouseEnter={(e) => {
                // Update selected index on hover
                const parent = e.currentTarget.parentElement?.parentElement;
                if (parent) {
                  const items = parent.querySelectorAll('li');
                  items.forEach((item, i) => {
                    if (item === e.currentTarget.parentElement) {
                      // This would need to be handled by parent component
                    }
                  });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700">{suggestion}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Use ↑↓ to navigate • Enter to select • Esc to close
      </div>
    </div>
  );
};