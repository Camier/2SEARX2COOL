// Database row types for better-sqlite3
export interface SearchRow {
  id: string;
  query: string;
  timestamp: number;
  results_count: number;
  engines: string;
  duration: number;
  user_id: string | null;
}

export interface CachedResultRow {
  id: string;
  search_id: string;
  result: string;
  expires_at: number;
  access_count: number;
  last_accessed: number;
}

export interface PluginDataRow {
  plugin_id: string;
  key: string;
  value: string;
  version: number;
  updated_at: number;
}

export interface PreferenceRow {
  key: string;
  value: string;
  updated_at: number;
  sync_enabled: number;
}

export interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  tracks: string;
  created_at: number;
  updated_at: number;
  is_public: number;
}

export interface AnalyticsRow {
  id: string;
  event: string;
  properties: string;
  timestamp: number;
  session_id: string;
}

export interface CountRow {
  count: number;
}

export interface SizeRow {
  size: number;
}