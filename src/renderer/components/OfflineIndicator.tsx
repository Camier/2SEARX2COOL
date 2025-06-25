import React, { useState, useEffect } from 'react';
import { NetworkStatus, SearchMode, SearchStatusInfo } from '../../main/services/OfflineSearchService';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
  onStatusClick?: () => void;
}

interface StatusColors {
  background: string;
  text: string;
  icon: string;
}

/**
 * Week 3 Day 3: Offline Mode Indicator Component
 * 
 * Visual indicator for network status and search mode,
 * providing clear feedback about offline capabilities.
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showDetails = false,
  onStatusClick
}) => {
  const [status, setStatus] = useState<SearchStatusInfo | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cacheStats, setCacheStats] = useState<any>(null);
  
  useEffect(() => {
    // Subscribe to status updates from main process
    const handleStatusUpdate = (_event: any, newStatus: SearchStatusInfo) => {
      setStatus(newStatus);
    };
    
    // @ts-ignore - IPC types
    window.electron.ipcRenderer.on('search-status-update', handleStatusUpdate);
    
    // Request initial status
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-search-status').then(setStatus);
    
    // Request cache stats if expanded
    if (isExpanded) {
      // @ts-ignore
      window.electron.ipcRenderer.invoke('get-cache-stats').then(setCacheStats);
    }
    
    return () => {
      // @ts-ignore
      window.electron.ipcRenderer.removeListener('search-status-update', handleStatusUpdate);
    };
  }, [isExpanded]);
  
  if (!status) return null;
  
  const getStatusColors = (): StatusColors => {
    switch (status.networkStatus) {
      case 'online':
        return {
          background: 'bg-green-100',
          text: 'text-green-800',
          icon: 'text-green-600'
        };
      case 'degraded':
        return {
          background: 'bg-yellow-100',
          text: 'text-yellow-800',
          icon: 'text-yellow-600'
        };
      case 'offline':
        return {
          background: 'bg-red-100',
          text: 'text-red-800',
          icon: 'text-red-600'
        };
    }
  };
  
  const getStatusIcon = () => {
    switch (status.networkStatus) {
      case 'online':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a1 1 0 011.414 0 9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 010-1.414zM7.879 6.464a1 1 0 010 1.414 3 3 0 000 4.243 1 1 0 11-1.415 1.414 5 5 0 010-7.07 1 1 0 011.415 0zm4.242 0a1 1 0 011.415 0 5 5 0 010 7.072 1 1 0 01-1.415-1.415 3 3 0 000-4.242 1 1 0 010-1.415zM10 9a1 1 0 011 1v.01a1 1 0 11-2 0V10a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        );
      case 'degraded':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'offline':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l6.921 6.922c.05.062.105.118.168.167l6.91 6.911a1 1 0 001.415-1.414l-6.911-6.91a1.003 1.003 0 00-.167-.168L3.707 2.293zm6.46 8.167a3 3 0 012.83 3.98l-2.83-2.83a3.001 3.001 0 00-2.83-3.98L5.051 5.745a5.002 5.002 0 015.116 4.715zM3.533 8.091a7 7 0 008.377 8.377l-1.426 1.426a9 9 0 01-8.377-8.377l1.426-1.426zm11.433 5.818a5 5 0 00-5.116-4.715l2.286 2.286a3 3 0 002.83 3.98v-1.551z" clipRule="evenodd" />
          </svg>
        );
    }
  };
  
  const getStatusText = () => {
    if (status.mode === 'offline') {
      return 'Offline Mode';
    }
    
    if (status.mode === 'hybrid') {
      return 'Limited Connection';
    }
    
    if (!status.searxngAvailable) {
      return 'SearXNG Unavailable';
    }
    
    return 'Online';
  };
  
  const getDetailedStatus = () => {
    const features = [];
    
    if (status.localLibraryAvailable) {
      features.push('Local Library');
    }
    
    if (status.cacheAvailable) {
      features.push('Cached Results');
    }
    
    if (status.searxngAvailable) {
      features.push('Web Search');
    }
    
    return features.join(' • ');
  };
  
  const formatOfflineTime = () => {
    if (!status.offlineSince) return null;
    
    const duration = Date.now() - new Date(status.offlineSince).getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `Offline for ${hours}h ${minutes % 60}m`;
    }
    
    return `Offline for ${minutes}m`;
  };
  
  const colors = getStatusColors();
  
  const handleClick = () => {
    if (showDetails) {
      setIsExpanded(!isExpanded);
    }
    onStatusClick?.();
  };
  
  return (
    <div className={`offline-indicator ${className}`}>
      <div
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer
          transition-all duration-200 select-none
          ${colors.background} ${colors.text}
          hover:shadow-md hover:scale-105
        `}
        onClick={handleClick}
        title={getDetailedStatus()}
      >
        <span className={`${colors.icon} animate-pulse`}>
          {getStatusIcon()}
        </span>
        
        <span className="text-sm font-medium">
          {getStatusText()}
        </span>
        
        {showDetails && (
          <svg 
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      
      {showDetails && isExpanded && (
        <div className={`
          mt-2 p-3 rounded-lg shadow-inner
          ${colors.background} ${colors.text}
        `}>
          <div className="space-y-2 text-sm">
            {/* Available Features */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Available:</span>
              <span className="text-xs">{getDetailedStatus()}</span>
            </div>
            
            {/* Offline Duration */}
            {status.offlineSince && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Duration:</span>
                <span className="text-xs">{formatOfflineTime()}</span>
              </div>
            )}
            
            {/* Last Check */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Last Check:</span>
              <span className="text-xs">
                {new Date(status.lastOnlineCheck).toLocaleTimeString()}
              </span>
            </div>
            
            {/* Cache Stats */}
            {cacheStats && (
              <>
                <div className="border-t pt-2 mt-2">
                  <div className="font-medium mb-1">Cache Stats:</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Cached Searches:</span>
                      <span>{cacheStats.totalCachedSearches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cache Size:</span>
                      <span>{(cacheStats.cacheSize / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hit Rate:</span>
                      <span>{(cacheStats.hitRate * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                
                <button
                  className={`
                    w-full mt-2 px-3 py-1 rounded text-xs font-medium
                    bg-white bg-opacity-50 hover:bg-opacity-70
                    transition-colors
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    // @ts-ignore
                    window.electron.ipcRenderer.invoke('clear-offline-cache').then(() => {
                      setCacheStats(null);
                      // Refresh stats
                      // @ts-ignore
                      window.electron.ipcRenderer.invoke('get-cache-stats').then(setCacheStats);
                    });
                  }}
                >
                  Clear Cache
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Simple status badge component
export const OfflineStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [isOffline, setIsOffline] = useState(false);
  
  useEffect(() => {
    const checkStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    
    checkStatus();
    
    window.addEventListener('online', () => setIsOffline(false));
    window.addEventListener('offline', () => setIsOffline(true));
    
    return () => {
      window.removeEventListener('online', () => setIsOffline(false));
      window.removeEventListener('offline', () => setIsOffline(true));
    };
  }, []);
  
  if (!isOffline) return null;
  
  return (
    <div className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-full
      bg-red-100 text-red-800 text-xs font-medium
      ${compact ? '' : 'animate-pulse'}
    `}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
      </svg>
      {!compact && <span>Offline</span>}
    </div>
  );
};

// Local file indicator for search results
export const LocalFileIndicator: React.FC<{ hasLocalFile?: boolean }> = ({ hasLocalFile }) => {
  if (!hasLocalFile) return null;
  
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      <span>Local</span>
    </div>
  );
};

// Cache age indicator
export const CacheAgeIndicator: React.FC<{ cachedAt?: Date }> = ({ cachedAt }) => {
  if (!cachedAt) return null;
  
  const getAgeText = () => {
    const hours = (Date.now() - new Date(cachedAt).getTime()) / (1000 * 60 * 60);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${Math.round(hours)}h ago`;
    
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };
  
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
      <span>Cached {getAgeText()}</span>
    </div>
  );
};