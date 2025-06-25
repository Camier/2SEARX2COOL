import React from 'react';

/**
 * Week 4 Day 1: Personal Score UI Components
 * 
 * Reusable components for displaying personal scores,
 * ratings, favorites, and other user-specific metadata.
 */

interface RatingStarsProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: 'small' | 'medium' | 'large';
  readonly?: boolean;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  onRate,
  size = 'medium',
  readonly = false
}) => {
  const sizes = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };
  
  const handleClick = (star: number) => {
    if (!readonly && onRate) {
      onRate(star);
    }
  };
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => handleClick(star)}
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} text-yellow-400 hover:text-yellow-500 transition-colors`}
        >
          <svg
            className={sizes[size]}
            fill={star <= rating ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
};

interface PlayCountProps {
  count: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export const PlayCount: React.FC<PlayCountProps> = ({
  count,
  size = 'medium',
  showLabel = true
}) => {
  const sizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };
  
  return (
    <div className={`flex items-center gap-1 text-gray-600 ${sizes[size]}`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{count}{showLabel && ' plays'}</span>
    </div>
  );
};

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  size = 'medium'
}) => {
  const sizes = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };
  
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`p-1.5 rounded-full transition-colors ${
        isFavorite
          ? 'text-red-500 hover:text-red-600 bg-red-50'
          : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100'
      }`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        className={sizes[size]}
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
};

interface PersonalScoreProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export const PersonalScore: React.FC<PersonalScoreProps> = ({
  score,
  size = 'medium',
  showLabel = true
}) => {
  const sizes = {
    small: 'w-12 h-12 text-sm',
    medium: 'w-16 h-16 text-base',
    large: 'w-20 h-20 text-lg'
  };
  
  // Calculate color based on score (0-100)
  const getColor = () => {
    if (score >= 80) return 'bg-green-500 text-white';
    if (score >= 60) return 'bg-blue-500 text-white';
    if (score >= 40) return 'bg-yellow-500 text-white';
    return 'bg-gray-400 text-white';
  };
  
  return (
    <div className="flex flex-col items-center">
      <div className={`${sizes[size]} ${getColor()} rounded-full flex items-center justify-center font-bold`}>
        {Math.round(score)}
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600 mt-1">Personal Score</span>
      )}
    </div>
  );
};

interface LastPlayedProps {
  date: string;
  size?: 'small' | 'medium' | 'large';
}

export const LastPlayed: React.FC<LastPlayedProps> = ({
  date,
  size = 'medium'
}) => {
  const sizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };
  
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };
  
  return (
    <span className={`text-gray-500 ${sizes[size]}`}>
      Last played: {formatRelativeTime(date)}
    </span>
  );
};

interface LocalFileIndicatorProps {
  hasLocalFile: boolean;
}

export const LocalFileIndicator: React.FC<LocalFileIndicatorProps> = ({
  hasLocalFile
}) => {
  if (!hasLocalFile) return null;
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
      </svg>
      Local
    </span>
  );
};

interface CacheAgeIndicatorProps {
  cachedAt: string;
}

export const CacheAgeIndicator: React.FC<CacheAgeIndicatorProps> = ({
  cachedAt
}) => {
  const date = new Date(cachedAt);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  let color = 'bg-green-100 text-green-800';
  let label = 'Fresh';
  
  if (diffHours > 24 * 7) {
    color = 'bg-red-100 text-red-800';
    label = 'Stale';
  } else if (diffHours > 24) {
    color = 'bg-yellow-100 text-yellow-800';
    label = 'Cached';
  }
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${color} text-xs font-medium`}>
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      {label}
    </span>
  );
};

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium'
}) => {
  const sizes = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };
  
  return (
    <div className="flex items-center justify-center">
      <svg
        className={`${sizes[size]} animate-spin text-blue-500`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};