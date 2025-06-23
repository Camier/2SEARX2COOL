# 2SEARX2COOL Architecture

## Overview

2SEARX2COOL is an Electron-based desktop wrapper for SearXNG-Cool that provides native desktop integration while preserving the web-based search interface.

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│                 2SEARX2COOL                 │
├─────────────────────┬───────────────────────┤
│    Main Process    │   Renderer Process    │
├────────────────────┼───────────────────────┤
│ - App Lifecycle   │ - SearXNG-Cool Web UI │
│ - Window Manager  │ - Plugin UI           │
│ - Server Manager  │ - Custom Injections   │
│ - Plugin System   │                       │
│ - Tray/Shortcuts  │                       │
│ - IPC Handlers    │                       │
└─────────┼─────────┼───────────────────────┘
          │         │
          │  Preload Script (Bridge)
          │         │
┌─────────┴─────────┴───────────────────────┐
│        SearXNG-Cool Server                  │
├─────────────────────────────────────────────┤
│ - Flask/SocketIO Orchestrator              │
│ - 27+ Music Search Engines                 │
│ - PostgreSQL Database                      │
│ - Redis Cache                              │
└─────────────────────────────────────────────┘
```

## Components

### Main Process
The Electron main process manages:
- Application lifecycle
- Window creation and management
- Python server lifecycle (bundled mode)
- Plugin loading and management
- System tray integration
- Global keyboard shortcuts
- IPC communication

### Renderer Process
Displays the SearXNG-Cool web interface with:
- Enhanced desktop features
- Plugin UI injections
- Custom styling
- Native integrations

### Preload Script
Secure bridge between main and renderer:
- Exposes safe APIs to web content
- Handles IPC communication
- Provides plugin APIs

### Server Component
SearXNG-Cool backend:
- Can be bundled, external, or hybrid
- Flask/SocketIO orchestrator
- Music search engines
- Database and caching

## Plugin Architecture

Plugins can run in three contexts:

1. **Main Process Plugins**
   - Access to Node.js APIs
   - System-level features
   - File system access

2. **Renderer Plugins**
   - UI modifications
   - Custom components
   - Style injections

3. **Preload Plugins**
   - Bridge functionality
   - API exposure
   - Security layer

## Deployment Modes

### Bundled Mode
- Python server packaged with app
- Self-contained distribution
- Larger download size
- No external dependencies

### External Mode
- Connects to existing server
- Lightweight client
- Requires server setup
- Multiple clients possible

### Hybrid Mode
- Can switch between modes
- Fallback capabilities
- Most flexible option
- Progressive deployment

## Security Model

- Context isolation enabled
- No direct Node.js access in renderer
- Secure IPC communication
- CSP headers for web content
- Plugin sandboxing

## Data Flow

1. User interacts with UI (Renderer)
2. UI calls exposed APIs (Preload)
3. Preload sends IPC to Main
4. Main processes request
5. Main communicates with Server
6. Results flow back through chain

## Performance Considerations

- Lazy plugin loading
- Efficient IPC batching
- Server connection pooling
- Smart caching strategies
- Progressive UI updates