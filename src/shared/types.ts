// Enhanced type definitions with all architectural improvements

export interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  author?: string;
  enabled: boolean;
  settings?: any;
  permissions?: PluginPermission[];
  main?: PluginModule;
  renderer?: PluginModule;
  preload?: PluginModule;
}

export interface PluginModule {
  activate: (context: PluginContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

export interface PluginContext {
  app: any; // Electron app or Express app
  store: any; // Configuration store
  api: PluginAPI;
  logger: Logger;
}

export interface PluginAPI {
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  cache: CacheAPI;
  hardware: HardwareAPI;
  ui: UIAPI;
  ipc: IPCAPI;
}

export interface ServerStatus {
  running: boolean;
  url?: string;
  error?: string;
  mode: 'bundled' | 'external' | 'hybrid';
  version?: string;
  engines?: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  url: string;
  source: string;
  engine: string;
  thumbnail?: string;
  metadata?: MusicMetadata;
  cached?: boolean;
  score?: number;
  timestamp?: number;
}

export interface MusicMetadata {
  genre?: string[];
  year?: number;
  bpm?: number;
  key?: string;
  audioFeatures?: AudioFeatures;
  lyrics?: string;
  isrc?: string;
  label?: string;
}

export interface AudioFeatures {
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
  speechiness?: number;
  liveness?: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  serverUrl?: string;
  autoStart: boolean;
  startMinimized: boolean;
  globalShortcuts: boolean;
  plugins: Record<string, boolean>;
  cache: CacheConfig;
  privacy: PrivacyConfig;
  audio: AudioConfig;
  shortcuts: ShortcutConfig;
}

export interface SearchOptions {
  engines?: string[];
  timeRange?: 'all' | 'day' | 'week' | 'month' | 'year';
  safeSearch?: boolean;
  categories?: string[];
  offline?: boolean;
  limit?: number;
  offset?: number;
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number; // MB
  ttl: number; // seconds
  strategy: 'lru' | 'lfu' | 'ttl';
  offlineMode: boolean;
}

export interface PrivacyConfig {
  telemetry: boolean;
  crashReports: boolean;
  doNotTrack: boolean;
  clearOnExit: boolean;
}

export interface AudioConfig {
  enableAnalysis: boolean;
  midiEnabled: boolean;
  defaultDevice?: string;
}

export interface ShortcutConfig {
  search: string;
  playPause: string;
  next: string;
  previous: string;
  volumeUp: string;
  volumeDown: string;
}

export interface CacheAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  getStats: () => Promise<CacheStats>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
}

export interface HardwareAPI {
  midi: MidiAPI;
  audio: AudioAPI;
}

export interface MidiAPI {
  getDevices: () => Promise<MidiDevice[]>;
  connect: (deviceId: string) => Promise<MidiConnection>;
  onMessage: (callback: (message: MidiMessage) => void) => void;
  sendMessage: (deviceId: string, message: MidiMessage) => Promise<void>;
}

export interface AudioAPI {
  getDevices: () => Promise<AudioDevice[]>;
  getAnalyzer: () => AudioAnalyzer;
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
}

export interface UIAPI {
  showNotification: (options: NotificationOptions) => void;
  setTrayTooltip: (tooltip: string) => void;
  setBadge: (count: number) => void;
  setProgressBar: (progress: number) => void;
  flashFrame: (flag: boolean) => void;
}

export interface IPCAPI {
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: (...args: any[]) => void) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  removeAllListeners: (channel: string) => void;
}

export type PluginPermission = 
  | 'hardware'
  | 'network'
  | 'filesystem'
  | 'notifications'
  | 'system'
  | 'preferences'
  | 'cache'
  | 'ui';

export interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  connected: boolean;
}

export interface MidiConnection {
  send: (message: MidiMessage) => void;
  close: () => void;
  onMessage: (callback: (message: MidiMessage) => void) => void;
}

export interface MidiMessage {
  status: number;
  data: number[];
  timestamp: number;
  channel?: number;
  type?: 'noteon' | 'noteoff' | 'cc' | 'pitchbend' | 'sysex';
}

export interface AudioDevice {
  id: string;
  name: string;
  channels: number;
  sampleRate: number;
  type: 'input' | 'output';
  isDefault: boolean;
}

export interface AudioAnalyzer {
  getFrequencyData: () => Float32Array;
  getTimeData: () => Float32Array;
  getBPM: () => Promise<number>;
  getKey: () => Promise<string>;
  getPeaks: () => Promise<number[]>;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  sound?: boolean;
  actions?: NotificationAction[];
  closeButtonText?: string;
}

export interface NotificationAction {
  type: string;
  text: string;
}

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  isAlwaysOnTop: boolean;
}

// Database schemas for SQLite
export interface DatabaseSchema {
  searches: SearchRecord[];
  results: CachedResult[];
  plugins: PluginData[];
  preferences: UserPreference[];
  playlists: Playlist[];
  analytics: AnalyticsEvent[];
}

export interface SearchRecord {
  id: string;
  query: string;
  timestamp: number;
  resultsCount: number;
  engines: string[];
  duration: number;
  userId?: string;
}

export interface CachedResult {
  id: string;
  searchId: string;
  result: SearchResult;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface PluginData {
  pluginId: string;
  key: string;
  value: any;
  version: number;
  updatedAt: number;
}

export interface UserPreference {
  key: string;
  value: any;
  updatedAt: number;
  syncEnabled: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: SearchResult[];
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
}

export interface AnalyticsEvent {
  id: string;
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

// IPC channels
export const IPC_CHANNELS = {
  // Search
  SEARCH: 'search:query',
  SEARCH_RESULTS: 'search:results',
  SEARCH_ERROR: 'search:error',
  
  // Server
  SERVER_STATUS: 'server:status',
  SERVER_START: 'server:start',
  SERVER_STOP: 'server:stop',
  
  // Plugins
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_ENABLE: 'plugin:enable',
  PLUGIN_DISABLE: 'plugin:disable',
  PLUGIN_INSTALL: 'plugin:install',
  PLUGIN_UNINSTALL: 'plugin:uninstall',
  
  // Hardware
  MIDI_DEVICES: 'midi:devices',
  MIDI_CONNECT: 'midi:connect',
  MIDI_MESSAGE: 'midi:message',
  AUDIO_DEVICES: 'audio:devices',
  AUDIO_ANALYZE: 'audio:analyze',
  
  // Preferences
  PREF_GET: 'preferences:get',
  PREF_SET: 'preferences:set',
  PREF_RESET: 'preferences:reset',
  
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_FULLSCREEN: 'window:fullscreen',
  
  // Cache
  CACHE_CLEAR: 'cache:clear',
  CACHE_STATS: 'cache:stats',
  
  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
} as const;

// Error types
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class PluginError extends AppError {
  constructor(message: string, pluginId: string, details?: any) {
    super(message, `PLUGIN_ERROR_${pluginId}`, details);
    this.name = 'PluginError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, statusCode?: number, details?: any) {
    super(message, 'NETWORK_ERROR', { statusCode, ...details });
    this.name = 'NetworkError';
  }
}