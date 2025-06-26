import React, { memo } from 'react';
import { LibraryStats as LibraryStatsType } from '../../../main/database/LibrarySchema';
import { formatDuration, formatFileSize } from '../../utils/formatters';
import './LibraryStats.css';

interface LibraryStatsProps {
  stats: LibraryStatsType;
  compact?: boolean;
}

/**
 * Display library statistics
 */
export const LibraryStats: React.FC<LibraryStatsProps> = memo(({
  stats,
  compact = false
}) => {
  
  if (compact) {
    return (
      <div className="library-stats compact">
        <span className="stat">
          <span className="stat-value">{stats.totalTracks.toLocaleString()}</span>
          <span className="stat-label">tracks</span>
        </span>
        <span className="stat">
          <span className="stat-value">{stats.totalAlbums.toLocaleString()}</span>
          <span className="stat-label">albums</span>
        </span>
        <span className="stat">
          <span className="stat-value">{stats.totalArtists.toLocaleString()}</span>
          <span className="stat-label">artists</span>
        </span>
        <span className="stat">
          <span className="stat-value">{formatDuration(stats.totalDuration, true)}</span>
          <span className="stat-label">total</span>
        </span>
      </div>
    );
  }
  
  const topGenres = Object.entries(stats.genreDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const topFormats = Object.entries(stats.formatDistribution)
    .sort((a, b) => b[1] - a[1]);
  
  return (
    <div className="library-stats full">
      <h3>Library Statistics</h3>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🎵</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalTracks.toLocaleString()}</div>
            <div className="stat-label">Total Tracks</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💿</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalAlbums.toLocaleString()}</div>
            <div className="stat-label">Albums</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalArtists.toLocaleString()}</div>
            <div className="stat-label">Artists</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <div className="stat-value">{formatDuration(stats.totalDuration, true)}</div>
            <div className="stat-label">Total Duration</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <div className="stat-value">{formatFileSize(stats.totalFileSize)}</div>
            <div className="stat-label">Total Size</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">▶️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalPlayCount.toLocaleString()}</div>
            <div className="stat-label">Total Plays</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-value">
              {stats.avgRating ? stats.avgRating.toFixed(1) : '-'}
            </div>
            <div className="stat-label">Avg Rating</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">❤️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.favoriteCount.toLocaleString()}</div>
            <div className="stat-label">Favorites</div>
          </div>
        </div>
      </div>
      
      {/* Genre distribution */}
      {topGenres.length > 0 && (
        <div className="stats-section">
          <h4>Top Genres</h4>
          <div className="distribution-list">
            {topGenres.map(([genre, count]) => (
              <div key={genre} className="distribution-item">
                <span className="item-label">{genre}</span>
                <span className="item-count">{count} tracks</span>
                <div 
                  className="item-bar"
                  style={{ 
                    width: `${(count / stats.totalTracks) * 100}%` 
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Format distribution */}
      {topFormats.length > 0 && (
        <div className="stats-section">
          <h4>File Formats</h4>
          <div className="format-chips">
            {topFormats.map(([format, count]) => (
              <div key={format} className="format-chip">
                <span className="format-name">{format.toUpperCase()}</span>
                <span className="format-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});