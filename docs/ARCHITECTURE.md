# 2SEARX2COOL Architecture

## Overview

2SEARX2COOL is a dual-mode music search platform that can operate as:
1. **Web Service**: Traditional server deployment for multi-user access
2. **Desktop Application**: Electron-based native app with enhanced features
3. **Hybrid Mode**: Desktop app with embedded web service (default)

This architecture provides maximum flexibility for different use cases while maintaining a unified codebase.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          2SEARX2COOL Platform                        │
├─────────────────────────────┬───────────────────────────────────────┤
│        Desktop Mode         │           Web Service Mode             │
├─────────────────────────────┼───────────────────────────────────────┤
│ ┌─────────────────────────┐ │ ┌───────────────────────────────────┐ │
│ │    Electron Shell       │ │ │        Web Browser               │ │
│ │  ┌─────────────────┐   │ │ │  ┌─────────────────────────────┐ │ │
│ │  │  Main Process   │   │ │ │  │   SearXNG Web Interface    │ │ │
│ │  │  - App Manager  │   │ │ │  │   - Search UI              │ │ │
│ │  │  - IPC Handlers │   │ │ │  │   - Results Display        │ │ │
│ │  │  - Plugin Loader│   │ │ │  │   - Settings Panel         │ │ │
│ │  └────────┬────────┘   │ │ │  └──────────┬──────────────────┘ │ │
│ │           │            │ │ │             │                     │ │
│ │  ┌────────▼────────┐   │ │ │             │                     │ │
│ │  │ Renderer Process│   │ │ │             │                     │ │
│ │  │  - Web View     │   │ │ │             │                     │ │
│ │  │  - Native UI    │   │ │ │             │                     │ │
│ │  └────────┬────────┘   │ │ │             │                     │ │
│ └───────────┼────────────┘ │ └─────────────┼─────────────────────┘ │
│             │              │               │                       │
│    ┌────────▼────────┐     │      ┌────────▼────────┐             │
│    │ JSON-RPC Bridge │     │      │ HTTP/WebSocket │             │
│    └────────┬────────┘     │      └────────┬────────┘             │
└─────────────┼──────────────┴────────────────┼──────────────────────┘
              │                               │
              └────────────┬──────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                      Core Services Layer                             │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│ │   SearXNG Core   │  │   Orchestrator   │  │   Engine Bridge    │ │
│ │                  │  │                  │  │                    │ │
│ │ - Request Router │  │ - Search Manager │  │ - Protocol Handler │ │
│ │ - Result Merger  │  │ - Cache Manager  │  │ - Engine Registry  │ │
│ │ - Filter Engine  │  │ - User Sessions  │  │ - Type Conversion │ │
│ │ - Privacy Layer  │  │ - API Gateway    │  │ - Error Handling  │ │
│ └────────┬─────────┘  └────────┬─────────┘  └─────────┬──────────┘ │
│          │                     │                       │            │
│          └─────────────────────┴───────────────────────┘            │
│                                │                                    │
│ ┌──────────────────────────────▼────────────────────────────────┐  │
│ │                    Music Search Engines                        │  │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │  │
│ │ │  Spotify   │ │   Apple    │ │ SoundCloud │ │  Bandcamp  │  │  │
│ │ │   Engine   │ │   Music    │ │   Engine   │ │   Engine   │  │  │
│ │ └────────────┘ └────────────┘ └────────────┘ └────────────┘  │  │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │  │
│ │ │  YouTube   │ │   Deezer   │ │   Tidal    │ │  Last.fm   │  │  │
│ │ │   Music    │ │   Engine   │ │   Engine   │ │   Engine   │  │  │
│ │ └────────────┘ └────────────┘ └────────────┘ └────────────┘  │  │
│ │                    ... and 19 more engines                    │  │
│ └────────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
│ ┌────────────────────────────▼──────────────────────────────────┐  │
│ │                      Data & Cache Layer                        │  │
│ │ ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │  │
│ │ │    Redis     │  │  PostgreSQL  │  │   File System      │  │  │
│ │ │    Cache     │  │   Database   │  │   Cache/Storage    │  │  │
│ │ └──────────────┘  └──────────────┘  └────────────────────┘  │  │
│ └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Layer

#### Desktop Mode (Electron)
The Electron application provides a native desktop experience:

**Main Process**
- Application lifecycle management
- Window creation and management
- System tray integration
- Global keyboard shortcuts
- Plugin system initialization
- IPC communication handler
- Auto-updater
- Hardware integration (MIDI, audio devices)

**Renderer Process**
- Chromium-based web view
- React-based UI enhancements
- Offline mode support
- Local storage management
- Custom context menus
- Native notifications

**Preload Script**
- Secure bridge between main and renderer
- Exposed APIs for web content
- IPC message handling
- Security context isolation

#### Web Service Mode
Traditional web browser access:
- Standard SearXNG interface
- Multi-user support
- Remote accessibility
- No installation required
- Cross-platform via browser

### Communication Layer

#### JSON-RPC Bridge (Desktop Mode)
Efficient binary protocol for desktop:
```python
# Engine Bridge Protocol
{
    "jsonrpc": "2.0",
    "method": "search",
    "params": {
        "query": "pink floyd",
        "engines": ["spotify", "soundcloud"],
        "options": {
            "safe_search": 1,
            "time_range": "year"
        }
    },
    "id": 1
}
```

Benefits:
- Lower latency than HTTP
- Smaller payload size
- Bidirectional communication
- Type-safe contracts

#### HTTP/WebSocket (Web Mode)
Standard web protocols:
- RESTful API endpoints
- WebSocket for real-time updates
- CORS support for external clients
- Standard authentication methods

### Core Services

#### SearXNG Core
The heart of the search system:
- **Request Router**: Distributes searches to appropriate engines
- **Result Merger**: Combines and deduplicates results
- **Filter Engine**: Applies user preferences and safe search
- **Privacy Layer**: Strips tracking parameters, anonymizes requests

Configuration: `config/searxng-settings.yml`

#### Orchestrator
Advanced search orchestration:
- **Search Manager**: Coordinates parallel engine execution
- **Cache Manager**: Redis-based intelligent caching
- **User Sessions**: Maintains search history and preferences
- **API Gateway**: Provides unified API for all clients

Configuration: `config/orchestrator.yml`

#### Engine Bridge
Connects Python engines with Node.js/Electron:
- **Protocol Handler**: Translates between JSON-RPC and Python
- **Engine Registry**: Dynamic engine discovery and loading
- **Type Conversion**: Ensures data compatibility
- **Error Handling**: Graceful degradation for failed engines

### Music Search Engines

27+ specialized engines, each implementing:
```python
class MusicEngine:
    def search(self, query: str, params: dict) -> list:
        """Execute search and return results"""
        
    def get_metadata(self) -> dict:
        """Return engine capabilities and requirements"""
        
    def validate_result(self, result: dict) -> bool:
        """Ensure result meets quality standards"""
```

Engine categories:
- **Streaming Services**: Spotify, Apple Music, Tidal, Deezer
- **Discovery Platforms**: SoundCloud, Bandcamp, Mixcloud
- **Video Platforms**: YouTube Music
- **Metadata Services**: MusicBrainz, Last.fm, Discogs
- **Lyrics Providers**: Genius, Musixmatch
- **Specialized**: Beatport, Pitchfork, Radio Paradise

### Data Layer

#### Redis Cache
High-performance caching:
- Search result caching (TTL: 1 hour)
- User session storage
- Rate limiting counters
- Real-time analytics
- Pub/sub for live updates

#### PostgreSQL Database
Persistent storage (optional):
- User accounts and preferences
- Search history and analytics
- Playlist management
- API keys and credentials
- Plugin configurations

#### File System
Local storage:
- Downloaded content
- Offline cache
- Plugin files
- Configuration backups
- Temporary files

## Operating Modes

### Service Mode
```bash
APP_MODE=service ./scripts/start-unified.sh
```
- Only Python services run
- No desktop GUI
- Ideal for servers
- Multi-user support
- Remote access

### Desktop Mode
```bash
APP_MODE=desktop npm run dev
```
- Electron GUI only
- Connects to external services
- Requires separate service setup
- Best for development
- Single user focus

### Hybrid Mode (Default)
```bash
APP_MODE=hybrid npm run dev
```
- Electron starts embedded services
- All-in-one package
- Best for end users
- Offline capabilities
- Seamless experience

## Data Flow

### Search Request Flow

1. **User Input**
   - Desktop: Native search bar → IPC → Main process
   - Web: Browser form → HTTP POST → Flask

2. **Request Processing**
   - Query parsing and validation
   - User preference application
   - Engine selection based on query type

3. **Engine Execution**
   - Parallel engine invocation
   - Individual timeout management (5s default)
   - Error isolation

4. **Result Processing**
   - Format normalization
   - Duplicate detection
   - Relevance scoring
   - Metadata enrichment

5. **Response Delivery**
   - Desktop: JSON-RPC → IPC → Renderer
   - Web: JSON response → Template rendering

### Caching Strategy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────▶│ Redis Cache │────▶│   Engine    │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │ │                    │
                    Hit ──┘ └── Miss ────────────┘
```

Cache keys: `search:{hash(query+engines+params)}:{timestamp}`

## Plugin Architecture

### Plugin Types

1. **Search Plugins**
   - Add new search engines
   - Modify search behavior
   - Custom result processors

2. **UI Plugins**
   - Theme modifications
   - Custom components
   - Visualization tools

3. **Integration Plugins**
   - Music player integration
   - Export functionality
   - External API connections

### Plugin Structure
```
plugin-name/
├── package.json
├── index.ts          # Main entry point
├── manifest.json     # Plugin metadata
├── assets/          # Icons, styles
└── locales/         # Translations
```

### Plugin API
```typescript
interface Plugin {
    id: string;
    name: string;
    version: string;
    
    activate(context: PluginContext): Promise<void>;
    deactivate(): Promise<void>;
}

interface PluginContext {
    searchEngines: SearchEngineRegistry;
    ui: UIComponentRegistry;
    storage: StorageAPI;
    events: EventEmitter;
}
```

## Security Model

### Electron Security
- Context isolation enabled
- Node integration disabled in renderer
- Preload scripts for secure bridging
- CSP headers for web content
- Secure IPC validation

### Web Service Security
- CORS configuration
- Rate limiting per IP
- API key authentication
- SQL injection prevention
- XSS protection

### Plugin Security
- Sandboxed execution
- Permission system
- Resource limits
- Code signing (planned)

## Performance Optimizations

### Startup Performance
- Lazy loading of engines
- Deferred plugin initialization
- Optimized bundle sizes
- Service worker caching

### Search Performance
- Parallel engine execution
- Redis caching layer
- Connection pooling
- Result streaming

### Memory Management
- Automatic cache eviction
- Plugin memory limits
- Renderer process recycling
- Database connection pooling

## Configuration System

### Unified Configuration
All settings managed through unified system:
```
config/
├── unified-config.json    # Merged configuration
├── app-settings.json      # Desktop app settings
├── music_engines.yml      # Engine configurations
├── orchestrator.yml       # Service settings
└── searxng-settings.yml   # Core search settings
```

### Environment Variables
```bash
# Operating mode
APP_MODE=hybrid

# Service configuration
SEARXNG_PORT=8888
ORCHESTRATOR_PORT=8889
REDIS_URL=redis://localhost:6379

# API Keys (optional)
DISCOGS_API_TOKEN=xxx
JAMENDO_API_KEY=xxx
```

## Development Architecture

### Technology Stack
- **Frontend**: TypeScript, React, Electron
- **Backend**: Python 3.8+, Flask, SearXNG
- **Database**: PostgreSQL 12+, Redis 6+
- **Build**: Webpack, electron-builder, Vite
- **Testing**: Jest, Playwright, pytest

### Code Organization
```
src/
├── main/           # Electron main process
├── renderer/       # React application
├── preload/        # Preload scripts
├── shared/         # Shared types/utils
engines/            # Python search engines
engine-bridge/      # IPC/JSON-RPC bridge
orchestrator/       # Flask application
config/             # Configuration files
scripts/            # Build/deploy scripts
```

## Deployment Considerations

### Desktop Deployment
- Code signing for distribution
- Auto-update infrastructure
- Crash reporting
- Analytics (optional, privacy-respecting)

### Server Deployment
- Nginx reverse proxy
- SSL/TLS termination
- Systemd service files
- Monitoring integration
- Backup strategies

## Future Architecture Plans

1. **Microservices Migration**
   - Separate engine services
   - Kubernetes deployment
   - Service mesh integration

2. **Performance Enhancements**
   - WebAssembly engines
   - GPU acceleration
   - P2P result sharing

3. **Feature Additions**
   - Federated search network
   - Blockchain verification
   - AI-powered recommendations