export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
  settings?: any
}

export interface ServerStatus {
  running: boolean
  url?: string
  error?: string
  mode: 'bundled' | 'external' | 'hybrid'
}

export interface SearchResult {
  id: string
  title: string
  artist?: string
  album?: string
  duration?: number
  url: string
  source: string
  thumbnail?: string
  metadata?: Record<string, any>
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  serverUrl?: string
  autoStart: boolean
  startMinimized: boolean
  globalShortcuts: boolean
  plugins: Record<string, boolean>
}