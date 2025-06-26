# 2SEARX2COOL API Reference

## Overview

2SEARX2COOL provides multiple APIs depending on the operating mode:

1. **Web Service API**: RESTful HTTP API for web service mode
2. **JSON-RPC API**: Engine bridge API for desktop mode
3. **IPC API**: Electron inter-process communication for desktop mode
4. **Plugin API**: Extension API for custom plugins

## Web Service API

Base URL: `http://localhost:8888` (configurable)

### Authentication

Optional JWT-based authentication for protected endpoints:

```http
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Search

##### `GET /search`
Execute a search query across configured engines.

**Parameters:**
- `q` (string, required): Search query
- `engines` (string, optional): Comma-separated list of engines
- `categories` (string, optional): music, general, files, etc.
- `pageno` (integer, optional): Page number (default: 1)
- `time_range` (string, optional): day, week, month, year
- `language` (string, optional): ISO 639-1 language code
- `safe_search` (integer, optional): 0=off, 1=moderate, 2=strict
- `format` (string, optional): html, json, csv, rss

**Example Request:**
```bash
curl "http://localhost:8888/search?q=pink+floyd&engines=spotify,soundcloud&format=json"
```

**Example Response:**
```json
{
  "query": "pink floyd",
  "number_of_results": 42,
  "results": [
    {
      "url": "https://open.spotify.com/artist/0k17h0D3J5VfsdmQ1iZtE9",
      "title": "Pink Floyd",
      "content": "British rock band formed in London in 1965",
      "engine": "spotify",
      "parsed_url": ["https", "open.spotify.com", "/artist/0k17h0D3J5VfsdmQ1iZtE9"],
      "engines": ["spotify"],
      "positions": [1],
      "score": 1.0,
      "category": "music",
      "pretty_url": "open.spotify.com",
      "metadata": {
        "artist_id": "0k17h0D3J5VfsdmQ1iZtE9",
        "followers": 12500000,
        "genres": ["album rock", "art rock", "classic rock", "progressive rock", "psychedelic rock"],
        "images": [
          {
            "height": 640,
            "url": "https://i.scdn.co/image/...",
            "width": 640
          }
        ]
      }
    }
  ],
  "suggestions": ["pink floyd albums", "pink floyd songs", "pink floyd the wall"],
  "answers": [],
  "corrections": [],
  "infoboxes": [
    {
      "infobox": "Pink Floyd",
      "content": "Progressive rock band",
      "img_src": "https://...",
      "urls": [
        {"title": "Official Website", "url": "https://pinkfloyd.com"},
        {"title": "Wikipedia", "url": "https://en.wikipedia.org/wiki/Pink_Floyd"}
      ]
    }
  ],
  "paging": true,
  "results_number": 42
}
```

#### Autocomplete

##### `GET /autocomplete`
Get search suggestions for partial queries.

**Parameters:**
- `q` (string, required): Partial search query

**Example:**
```bash
curl "http://localhost:8888/autocomplete?q=beatl"
```

**Response:**
```json
["beatles", "beatles songs", "beatles albums", "beatles abbey road"]
```

#### Engine Management

##### `GET /engines`
List all available search engines.

**Response:**
```json
{
  "engines": [
    {
      "name": "spotify",
      "categories": ["music"],
      "enabled": true,
      "shortcut": "sp",
      "timeout": 5.0,
      "display_error_messages": true,
      "tokens": [],
      "weight": 1,
      "disabled": false
    },
    ...
  ]
}
```

#### Preferences

##### `GET /preferences`
Get current user preferences.

##### `POST /preferences`
Update user preferences.

**Request Body:**
```json
{
  "categories": ["music"],
  "engines": ["spotify", "soundcloud", "bandcamp"],
  "language": "en",
  "locale": "en",
  "autocomplete": "google",
  "safe_search": 0,
  "theme_name": "simple",
  "results_on_new_tab": false,
  "doi_resolver": "sci-hub.se",
  "simple_style": "auto",
  "center_alignment": false,
  "advanced_search": false,
  "query_in_title": false,
  "infinite_scroll": false,
  "search_on_category_select": true,
  "hotkeys": "vim"
}
```

### Orchestrator API

Base URL: `http://localhost:8889`

#### Music Search

##### `POST /api/music/search`
Advanced music search with aggregation.

**Request Body:**
```json
{
  "query": "pink floyd dark side",
  "engines": ["spotify", "apple_music", "soundcloud"],
  "type": "album",
  "filters": {
    "year_min": 1970,
    "year_max": 1980,
    "genre": "progressive rock"
  },
  "options": {
    "aggregate": true,
    "deduplicate": true,
    "enrich_metadata": true
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "2WT1pbYjLJciAR26yMebkH",
      "title": "The Dark Side of the Moon",
      "artist": "Pink Floyd",
      "type": "album",
      "year": 1973,
      "sources": {
        "spotify": {
          "url": "https://open.spotify.com/album/2WT1pbYjLJciAR26yMebkH",
          "id": "2WT1pbYjLJciAR26yMebkH"
        },
        "apple_music": {
          "url": "https://music.apple.com/album/1065973699",
          "id": "1065973699"
        }
      },
      "metadata": {
        "genres": ["progressive rock", "psychedelic rock"],
        "label": "Harvest Records",
        "duration": 2590,
        "tracks": 9,
        "popularity": 95
      }
    }
  ],
  "aggregation": {
    "total_results": 42,
    "sources_queried": 3,
    "sources_responded": 3,
    "query_time": 1.23
  }
}
```

## JSON-RPC API (Engine Bridge)

Used for communication between Electron and Python engines.

### Protocol

All requests follow JSON-RPC 2.0 specification:

```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": {...},
  "id": 1
}
```

### Methods

#### `initialize`
Initialize the engine bridge with configuration.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "engines_path": "/path/to/engines",
    "config": {
      "timeout": 5,
      "max_results": 100
    }
  },
  "id": 1
}
```

#### `search`
Execute a search using specified engines.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "search",
  "params": {
    "query": "pink floyd",
    "engines": ["spotify", "soundcloud"],
    "options": {
      "safe_search": 1,
      "time_range": "year",
      "language": "en"
    }
  },
  "id": 2
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "results": [...],
    "errors": [],
    "metadata": {
      "query_time": 1.23,
      "engines_used": ["spotify", "soundcloud"]
    }
  },
  "id": 2
}
```

#### `get_engines`
Get list of available engines.

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "engines": [
      {
        "name": "spotify",
        "categories": ["music"],
        "supported_languages": ["en"],
        "search_types": ["track", "album", "artist", "playlist"]
      }
    ]
  },
  "id": 3
}
```

## IPC API (Electron)

Communication between main and renderer processes.

### Main → Renderer

#### `search:results`
Send search results to renderer.

```typescript
ipcRenderer.on('search:results', (event, results) => {
  console.log('Search results:', results);
});
```

#### `settings:updated`
Notify renderer of settings changes.

```typescript
ipcRenderer.on('settings:updated', (event, settings) => {
  console.log('Settings updated:', settings);
});
```

### Renderer → Main

#### `search:execute`
Request a search from main process.

```typescript
ipcRenderer.invoke('search:execute', {
  query: 'pink floyd',
  engines: ['spotify', 'soundcloud'],
  options: {
    safe_search: 1
  }
}).then(results => {
  console.log('Results:', results);
});
```

#### `settings:get`
Get current settings.

```typescript
const settings = await ipcRenderer.invoke('settings:get');
```

#### `settings:set`
Update settings.

```typescript
await ipcRenderer.invoke('settings:set', {
  theme: 'dark',
  language: 'en'
});
```

## Plugin API

API available to plugins for extending functionality.

### Core API

```typescript
interface PluginContext {
  // Search engine management
  searchEngines: {
    register(engine: SearchEngine): void;
    unregister(engineId: string): void;
    get(engineId: string): SearchEngine | undefined;
    list(): SearchEngine[];
  };
  
  // UI component registration
  ui: {
    addMenuItem(item: MenuItem): void;
    addToolbarButton(button: ToolbarButton): void;
    addSettingsTab(tab: SettingsTab): void;
    showNotification(notification: Notification): void;
  };
  
  // Storage API
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
  };
  
  // Event system
  events: {
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
    emit(event: string, ...args: any[]): void;
  };
  
  // HTTP client
  http: {
    get(url: string, options?: RequestOptions): Promise<Response>;
    post(url: string, data: any, options?: RequestOptions): Promise<Response>;
  };
  
  // Utilities
  utils: {
    log(level: 'info' | 'warn' | 'error', message: string): void;
    translate(key: string, params?: object): string;
    openExternal(url: string): Promise<void>;
  };
}
```

### Search Engine Interface

```typescript
interface SearchEngine {
  id: string;
  name: string;
  categories: string[];
  
  search(query: string, params: SearchParams): Promise<SearchResult[]>;
  getSuggestions?(query: string): Promise<string[]>;
  getMetadata?(): EngineMetadata;
}

interface SearchParams {
  page?: number;
  language?: string;
  time_range?: 'day' | 'week' | 'month' | 'year';
  safe_search?: 0 | 1 | 2;
  custom?: Record<string, any>;
}

interface SearchResult {
  url: string;
  title: string;
  content?: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
}
```

### Events

Plugins can listen to and emit these events:

- `search:before` - Before search execution
- `search:after` - After search completion
- `search:error` - Search error occurred
- `results:filter` - Filter search results
- `settings:changed` - Settings were updated
- `plugin:activated` - Plugin was activated
- `plugin:deactivated` - Plugin was deactivated

### Example Plugin

```typescript
import { Plugin, PluginContext, SearchEngine } from '2searx2cool';

export default class MyMusicPlugin implements Plugin {
  id = 'my-music-plugin';
  name = 'My Music Plugin';
  version = '1.0.0';
  description = 'Adds custom music search features';
  
  private context: PluginContext;
  
  async activate(context: PluginContext) {
    this.context = context;
    
    // Register custom search engine
    context.searchEngines.register({
      id: 'my-engine',
      name: 'My Music Engine',
      categories: ['music'],
      
      async search(query, params) {
        const response = await context.http.get(
          `https://api.example.com/search?q=${encodeURIComponent(query)}`
        );
        
        return response.data.results.map(item => ({
          url: item.url,
          title: item.title,
          content: item.description,
          metadata: {
            artist: item.artist,
            album: item.album,
            duration: item.duration
          }
        }));
      }
    });
    
    // Add UI elements
    context.ui.addMenuItem({
      id: 'my-action',
      label: 'My Custom Action',
      accelerator: 'Ctrl+Shift+M',
      click: () => {
        context.ui.showNotification({
          title: 'Hello',
          body: 'This is my custom action!'
        });
      }
    });
    
    // Listen to events
    context.events.on('search:after', (results) => {
      context.utils.log('info', `Search returned ${results.length} results`);
    });
    
    // Store plugin data
    await context.storage.set('activated_at', Date.now());
  }
  
  async deactivate() {
    // Cleanup
    this.context.searchEngines.unregister('my-engine');
    await this.context.storage.clear();
  }
}
```

## Error Responses

All APIs use consistent error responses:

```json
{
  "error": {
    "code": "ENGINE_TIMEOUT",
    "message": "Search engine 'spotify' timed out after 5 seconds",
    "details": {
      "engine": "spotify",
      "timeout": 5
    }
  }
}
```

Common error codes:
- `INVALID_REQUEST` - Malformed request
- `ENGINE_ERROR` - Engine-specific error
- `ENGINE_TIMEOUT` - Engine timeout
- `RATE_LIMITED` - Too many requests
- `UNAUTHORIZED` - Authentication required
- `SERVER_ERROR` - Internal server error

## Rate Limiting

- Default: 60 requests per minute per IP
- Authenticated: 300 requests per minute per user
- Headers returned:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## WebSocket API

For real-time features (orchestrator):

```javascript
const ws = new WebSocket('ws://localhost:8889/ws');

// Subscribe to live search updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'search:updates',
  query_id: '12345'
}));

// Receive updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'search:update') {
    console.log('New results:', data.results);
  }
};
```

## SDK Support

Official SDKs available:
- JavaScript/TypeScript: `npm install @2searx2cool/sdk`
- Python: `pip install 2searx2cool-sdk`
- Go: `go get github.com/Camier/2searx2cool-sdk-go`

Example usage:

```javascript
import { SearchClient } from '@2searx2cool/sdk';

const client = new SearchClient({
  baseUrl: 'http://localhost:8888',
  apiKey: 'optional-api-key'
});

const results = await client.search('pink floyd', {
  engines: ['spotify', 'soundcloud'],
  format: 'json'
});
```