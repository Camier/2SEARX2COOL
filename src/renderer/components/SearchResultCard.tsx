import React from 'react';
import { PersonalizedSearchResult } from '../../main/services/PersonalizedSearchService';
import { 
  RatingStars, 
  PlayCount, 
  FavoriteButton, 
  PersonalScore, 
  LastPlayed,
  LocalFileIndicator,
  CacheAgeIndicator
} from './PersonalScoreComponents';

interface SearchResultCardProps {
  result: PersonalizedSearchResult;
  index: number;
  onPlay: () => void;
  onAddToQueue: () => void;
  onClick: () => void;
  onRate: (rating: number) => void;
  onToggleFavorite: () => void;
}

/**
 * Week 4 Day 1: Search Result Card Component
 * 
 * Displays a single search result with all metadata, scores,
 * and interactive elements for ratings and favorites.
 */
export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  index,
  onPlay,
  onAddToQueue,
  onClick,
  onRate,
  onToggleFavorite
}) => {
  const isLocal = result.source === 'local' || result.source === 'hybrid';
  const hasLocalFile = !!result.localFile;
  const isWeb = result.source === 'searxng';
  
  return (
    <div className={`
      search-result-card bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200
      border-2 ${result.favorite ? 'border-red-200' : 'border-transparent'}
      p-4 cursor-pointer
    `}>
      <div className="flex items-start gap-4">
        {/* Rank/Score indicator */}
        <div className="flex-shrink-0">
          {result.personalScore !== undefined ? (
            <PersonalScore score={result.personalScore} size="small" showLabel={false} />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-semibold">
              {index + 1}
            </div>
          )}
        </div>
        
        {/* Main content */}
        <div className="flex-1 min-w-0" onClick={onClick}>
          {/* Title and artist */}
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-800 truncate">
              {result.title || 'Unknown Title'}
            </h3>
            <p className="text-sm text-gray-600">
              {result.artist || 'Unknown Artist'}
              {result.album && ` • ${result.album}`}
            </p>
          </div>
          
          {/* Source indicators */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {isLocal && <LocalFileIndicator hasLocalFile={true} />}
            
            {result.source === 'hybrid' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-medium">
                Local + Web
              </span>
            )}
            
            {isWeb && result.searxngData?.engine && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                {result.searxngData.engine}
              </span>
            )}
            
            {result.cachedAt && <CacheAgeIndicator cachedAt={result.cachedAt} />}
          </div>
          
          {/* Additional metadata */}
          {result.duration && (
            <p className="text-sm text-gray-500 mb-2">
              Duration: {formatDuration(result.duration)}
            </p>
          )}
          
          {/* URL for web results */}
          {result.url && (
            <a 
              href={result.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline truncate block"
              onClick={(e) => e.stopPropagation()}
            >
              {result.url}
            </a>
          )}
        </div>
        
        {/* Actions column */}
        <div className="flex-shrink-0 flex flex-col items-end gap-3">
          {/* Play button */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              title="Play now"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Add to queue button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue();
              }}
              className="p-2 rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-colors"
              title="Add to queue"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
          
          {/* Favorite button */}
          {hasLocalFile && (
            <FavoriteButton
              isFavorite={result.favorite || false}
              onToggle={onToggleFavorite}
              size="medium"
            />
          )}
        </div>
      </div>
      
      {/* Bottom row with ratings and stats */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Rating stars */}
          {hasLocalFile && (
            <RatingStars
              rating={result.rating || 0}
              onRate={onRate}
              size="small"
            />
          )}
          
          {/* Play count */}
          {result.playCount !== undefined && result.playCount > 0 && (
            <PlayCount count={result.playCount} size="small" showLabel={false} />
          )}
          
          {/* Last played */}
          {result.lastPlayed && (
            <LastPlayed date={result.lastPlayed} size="small" />
          )}
        </div>
        
        {/* Relevance/Final score */}
        {result.finalScore !== undefined && (
          <div className="text-xs text-gray-500">
            Score: {Math.round(result.finalScore)}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to format duration
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}