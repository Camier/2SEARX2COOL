/**
 * Week 4 Day 4: Playlist System Database Schema
 * 
 * Comprehensive playlist management with support for:
 * - Manual playlists with drag-and-drop ordering
 * - Smart playlists with dynamic criteria
 * - Import/Export functionality
 * - Sharing and collaboration features
 */

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverArt?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  isPublic: boolean;
  isSmart: boolean;
  trackCount: number;
  totalDuration: number;
  tags?: string[];
  color?: string;
  sortOrder?: number;
}

export interface PlaylistTrack {
  id: number;
  playlistId: string;
  trackId: number; // References audio_files.id
  position: number;
  addedAt: number;
  addedBy?: string;
  customNote?: string;
}

export interface SmartPlaylist {
  id: string;
  playlistId: string;
  criteria: SmartPlaylistCriteria;
  maxTracks?: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  autoUpdate: boolean;
  lastUpdated: number;
}

export interface SmartPlaylistCriteria {
  rules: SmartPlaylistRule[];
  operator: 'AND' | 'OR';
}

export interface SmartPlaylistRule {
  field: string; // 'genre', 'artist', 'year', 'rating', 'playCount', etc.
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value: string | number | string[] | number[];
}

export interface PlaylistImportExport {
  format: 'M3U' | 'M3U8' | 'PLS' | 'XSPF' | 'JSON';
  filePath: string;
  encoding?: string;
}

export interface PlaylistShare {
  id: string;
  playlistId: string;
  shareToken: string;
  expiresAt?: number;
  permissions: SharePermission[];
  createdAt: number;
  accessCount: number;
}

export type SharePermission = 'view' | 'edit' | 'admin';

export interface PlaylistStats {
  totalPlaylists: number;
  totalTracks: number;
  averagePlaylistLength: number;
  longestPlaylist: {
    id: string;
    name: string;
    trackCount: number;
  };
  mostPopularGenres: Array<{
    genre: string;
    count: number;
  }>;
  recentActivity: Array<{
    type: 'created' | 'modified' | 'played';
    playlistId: string;
    timestamp: number;
  }>;
}

export interface PlaylistViewOptions {
  viewType: 'grid' | 'list';
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'trackCount' | 'totalDuration';
  sortDirection: 'asc' | 'desc';
  pageSize: number;
  page: number;
}

export interface PlaylistFilter {
  searchQuery?: string;
  tags?: string[];
  isPublic?: boolean;
  isSmart?: boolean;
  createdBy?: string;
  minTrackCount?: number;
  maxTrackCount?: number;
  minDuration?: number;
  maxDuration?: number;
  createdAfter?: number;
  createdBefore?: number;
}

export interface PlaylistPage<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Common smart playlist templates
export const SMART_PLAYLIST_TEMPLATES = {
  RECENTLY_ADDED: {
    name: 'Recently Added',
    description: 'Tracks added in the last 30 days',
    criteria: {
      rules: [{
        field: 'dateAdded',
        operator: 'gte' as const,
        value: Date.now() - (30 * 24 * 60 * 60 * 1000)
      }],
      operator: 'AND' as const
    },
    sortBy: 'dateAdded',
    sortDirection: 'desc' as const,
    maxTracks: 100,
    autoUpdate: true
  },
  
  TOP_RATED: {
    name: 'Top Rated',
    description: '5-star rated tracks',
    criteria: {
      rules: [{
        field: 'rating',
        operator: 'equals' as const,
        value: 5
      }],
      operator: 'AND' as const
    },
    sortBy: 'rating',
    sortDirection: 'desc' as const,
    autoUpdate: true
  },
  
  MOST_PLAYED: {
    name: 'Most Played',
    description: 'Your most frequently played tracks',
    criteria: {
      rules: [{
        field: 'playCount',
        operator: 'gt' as const,
        value: 5
      }],
      operator: 'AND' as const
    },
    sortBy: 'playCount',
    sortDirection: 'desc' as const,
    maxTracks: 50,
    autoUpdate: true
  },
  
  NEVER_PLAYED: {
    name: 'Never Played',
    description: 'Tracks you haven\'t listened to yet',
    criteria: {
      rules: [{
        field: 'playCount',
        operator: 'equals' as const,
        value: 0
      }],
      operator: 'AND' as const
    },
    sortBy: 'dateAdded',
    sortDirection: 'desc' as const,
    autoUpdate: true
  }
} as const;

// Playlist validation helpers
export function validatePlaylistName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Playlist name is required';
  }
  if (name.length > 100) {
    return 'Playlist name must be 100 characters or less';
  }
  if (name.includes('/') || name.includes('\\')) {
    return 'Playlist name cannot contain / or \\ characters';
  }
  return null;
}

export function validateSmartPlaylistRule(rule: SmartPlaylistRule): string | null {
  if (!rule.field) {
    return 'Rule field is required';
  }
  if (!rule.operator) {
    return 'Rule operator is required';
  }
  if (rule.value === undefined || rule.value === null) {
    return 'Rule value is required';
  }
  
  // Validate operator compatibility with field types
  const numericFields = ['year', 'rating', 'playCount', 'duration', 'bitrate', 'trackNumber'];
  const stringFields = ['title', 'artist', 'album', 'genre', 'comment'];
  const dateFields = ['dateAdded', 'lastPlayed', 'lastModified'];
  
  if (numericFields.includes(rule.field)) {
    const numericOperators = ['equals', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in'];
    if (!numericOperators.includes(rule.operator)) {
      return `Operator ${rule.operator} is not valid for numeric field ${rule.field}`;
    }
  }
  
  if (stringFields.includes(rule.field)) {
    const stringOperators = ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'not_in'];
    if (!stringOperators.includes(rule.operator)) {
      return `Operator ${rule.operator} is not valid for text field ${rule.field}`;
    }
  }
  
  return null;
}

export function generatePlaylistId(): string {
  return `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateShareToken(): string {
  return Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
}