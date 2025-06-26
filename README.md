# 2SEARX2COOL 🎵 - Privacy-First Music Search Platform

<div align="center">
  <img src="build/icon.png" alt="2SEARX2COOL Logo" width="128" height="128">
  
  [![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
  [![Python](https://img.shields.io/badge/Python-3.8+-blue?logo=python)](https://www.python.org/)
  [![Electron](https://img.shields.io/badge/Electron-30.0.0-47848F?logo=electron)](https://www.electronjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.4.0-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-18.0.0+-green?logo=node.js)](https://nodejs.org/)
  
  **Privacy-focused music search with 27+ engines - Available as Web Service & Desktop App**
  
  [Features](#features) • [Quick Start](#quick-start) • [Installation](#installation) • [Architecture](#architecture) • [Development](#development) • [Documentation](docs/)
</div>

## 🌟 Overview

2SEARX2COOL is a powerful, privacy-focused music search platform that extends [SearXNG](https://github.com/searxng/searxng) with specialized music search capabilities. It offers **dual-mode operation**: run it as a web service for server deployments or as a native desktop application with enhanced features.

### 🎯 Key Highlights

- **🎵 27+ Music Search Engines**: Comprehensive coverage of music platforms
- **🔐 Privacy-First**: No tracking, no data collection, no ads
- **⚡ High Performance**: Redis caching, parallel searches, optimized responses
- **🖥️ Dual-Mode**: Web service OR desktop application
- **🔌 Extensible**: Plugin system for custom engines and features
- **🌐 Self-Hostable**: Full control over your search infrastructure

## ✨ Features

### 🎵 Music Search Capabilities
- **Comprehensive Engine Coverage**: Spotify, Apple Music, SoundCloud, Bandcamp, YouTube Music, and 20+ more
- **Advanced Search Features**: 
  - Multi-engine parallel search
  - Intelligent result aggregation
  - Duplicate detection and merging
  - Metadata enrichment
- **Content Types**: Songs, albums, artists, playlists, lyrics, music videos
- **Smart Caching**: Redis-based caching for instant repeated searches

### 🚀 Operating Modes

#### 🌐 **Web Service Mode**
Perfect for server deployments and multi-user scenarios:
- SearXNG instance with custom music engines
- Flask/SocketIO orchestrator for real-time features
- PostgreSQL for user data and preferences
- Redis for high-performance caching
- RESTful API for integration

#### 🖥️ **Desktop Application Mode**
Native desktop experience with Electron:
- Offline-first architecture
- Hardware acceleration
- System tray integration
- Global keyboard shortcuts
- Plugin marketplace
- Auto-updates

#### 🔄 **Hybrid Mode** (Default)
Best of both worlds:
- Desktop app with embedded web service
- All-in-one installation
- Local-first with cloud capabilities
- Seamless mode switching

### 🔧 Technical Features
- **JSON-RPC Bridge**: Efficient communication between components
- **Unified Configuration**: Single source of truth for all settings
- **Plugin System**: Extend functionality with JavaScript/TypeScript plugins
- **Security**: Context isolation, CSP headers, encrypted storage
- **Development Tools**: Hot reload, debugging tools, test automation

## 🚀 Quick Start

### Option 1: Desktop Application (Recommended for End Users)

```bash
# Download the latest release for your platform
# Windows: 2SEARX2COOL-Setup-x.x.x.exe
# macOS: 2SEARX2COOL-x.x.x.dmg
# Linux: 2SEARX2COOL-x.x.x.AppImage

# Or build from source:
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED
npm install
npm run dev
```

### Option 2: Web Service (For Server Deployments)

```bash
# Clone and navigate to the project
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED

# Install dependencies
pip install -r requirements.txt

# Start all services
./scripts/start-unified.sh --service
```

### Option 3: Docker (Quick Deploy)

```bash
# Using Docker Compose
docker-compose up -d

# Access the web interface
open http://localhost:8888
```

## 📋 System Requirements

### Desktop Application
- **OS**: Windows 10+, macOS 10.13+, Ubuntu 20.04+
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for application, 1GB+ for cache
- **Internet**: Required for search functionality

### Web Service
- **OS**: Any Linux distribution
- **RAM**: 2GB minimum, 4GB recommended
- **Python**: 3.8 or higher
- **Redis**: 6.0 or higher
- **PostgreSQL**: 12 or higher (optional)

## 🏗️ Architecture

### Dual-Mode Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        2SEARX2COOL                          │
├─────────────────────────┬───────────────────────────────────┤
│    Desktop Mode         │         Web Service Mode          │
├─────────────────────────┼───────────────────────────────────┤
│ ┌──────────────────┐   │   ┌────────────────────────┐      │
│ │  Electron App    │   │   │   Web Browser          │      │
│ │  - Native UI     │   │   │   - Standard UI        │      │
│ │  - Offline Mode  │   │   │   - Multi-user         │      │
│ │  - Hardware Int. │   │   │   - Remote Access      │      │
│ └────────┬─────────┘   │   └───────────┬────────────┘      │
│          │             │                │                   │
│          ▼             │                ▼                   │
│ ┌──────────────────┐   │   ┌────────────────────────┐      │
│ │  JSON-RPC Bridge │   │   │   HTTP/WebSocket       │      │
│ └────────┬─────────┘   │   └───────────┬────────────┘      │
└──────────┼─────────────┴────────────────┼───────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Core Services Layer                        │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   SearXNG   │  │ Orchestrator │  │  Engine Bridge   │   │
│  │  Port 8888  │  │  Port 8889   │  │  (Python/Node)   │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                    │              │
│         ▼                ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            27+ Music Search Engines                  │    │
│  │  Spotify • Apple Music • SoundCloud • Bandcamp •    │    │
│  │  YouTube Music • Deezer • Tidal • Last.fm • More    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│         ┌─────────────────┴──────────────────┐              │
│         ▼                                    ▼              │
│  ┌──────────────┐                    ┌──────────────┐       │
│  │    Redis     │                    │  PostgreSQL  │       │
│  │   Caching    │                    │   Database   │       │
│  └──────────────┘                    └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### Component Overview

1. **Frontend Layer**
   - Electron App: Native desktop experience with offline capabilities
   - Web Browser: Standard web interface for remote access

2. **Communication Layer**
   - JSON-RPC Bridge: Efficient protocol for desktop mode
   - HTTP/WebSocket: Standard web protocols for service mode

3. **Core Services**
   - SearXNG: Privacy-respecting metasearch engine
   - Orchestrator: Manages searches, aggregation, and caching
   - Engine Bridge: Connects Python engines with Node.js frontend

4. **Search Engines**
   - 27+ specialized music search engines
   - Parallel execution for fast results
   - Intelligent result aggregation

5. **Data Layer**
   - Redis: High-performance caching
   - PostgreSQL: User data and preferences (optional)

## 🛠️ Installation

### Desktop Application

#### Pre-built Binaries
Download from [Releases](https://github.com/Camier/2SEARX2COOL/releases):
- **Windows**: `2SEARX2COOL-Setup-x.x.x.exe` or `.zip`
- **macOS**: `2SEARX2COOL-x.x.x.dmg` or `.zip`
- **Linux**: `2SEARX2COOL-x.x.x.AppImage`, `.deb`, or `.rpm`

#### Build from Source
```bash
# Clone repository
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED

# Install dependencies
npm install
pip install -r requirements.txt

# Development mode
npm run dev

# Build for production
npm run build
npm run dist
```

### Web Service

#### Manual Installation
```bash
# Clone repository
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Initialize database (if using PostgreSQL)
python scripts/create_database_schema.py

# Start services
./scripts/start-unified.sh --service
```

#### Docker Installation
```bash
# Using Docker Compose
docker-compose up -d

# Using Docker directly
docker build -t 2searx2cool .
docker run -d -p 8888:8888 -p 8889:8889 2searx2cool
```

#### Production Deployment
See [Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md) for:
- Nginx configuration
- SSL/TLS setup
- Systemd services
- Performance tuning
- Security hardening

## ⚙️ Configuration

### Unified Configuration System
2SEARX2COOL uses a unified configuration system that works across both modes:

```yaml
# config/unified-config.json - Main configuration
{
  "mode": "hybrid",  # service, desktop, or hybrid
  "service": {
    "searxng": {
      "port": 8888,
      "engines": ["spotify", "soundcloud", "bandcamp", ...]
    },
    "orchestrator": {
      "port": 8889,
      "redis_url": "redis://localhost:6379"
    }
  },
  "desktop": {
    "autoStart": false,
    "minimizeToTray": true,
    "theme": "system"
  }
}
```

### Environment Variables
```bash
# Required for some music engines
DISCOGS_API_TOKEN=your_token
JAMENDO_API_KEY=your_key

# Database (optional)
DATABASE_URL=postgresql://user:pass@localhost/dbname

# Operating mode
APP_MODE=hybrid  # service, desktop, or hybrid
```

### Music Engine Configuration
See [config/music_engines.yml](config/music_engines.yml) for engine-specific settings.

## 🎮 Usage

### Desktop Application

1. **Launch** the application
2. **Search** using the search bar or `Ctrl/Cmd + K`
3. **Filter** results by source, type, or quality
4. **Export** results or integrate with music players

#### Keyboard Shortcuts
- `Ctrl/Cmd + K`: Focus search
- `Ctrl/Cmd + ,`: Settings
- `Ctrl/Cmd + T`: New tab
- `Ctrl/Cmd + Shift + P`: Command palette

### Web Service

1. **Access** `http://localhost:8888` in your browser
2. **Search** using the web interface
3. **Use API** for programmatic access:
   ```bash
   curl "http://localhost:8888/search?q=pink+floyd&engines=spotify,soundcloud&format=json"
   ```

### Search Syntax
```
# Basic search
pink floyd

# Specific engine
!spotify dark side of the moon

# Advanced operators
artist:"Pink Floyd" album:"The Wall"
genre:rock year:1979
duration:>300 quality:lossless
```

## 🔌 Plugin System

### Creating a Plugin
```typescript
// my-plugin/index.ts
import { Plugin, PluginContext } from '2searx2cool';

export default class MyMusicPlugin implements Plugin {
  id = 'my-music-plugin';
  name = 'My Music Plugin';
  version = '1.0.0';
  
  async activate(context: PluginContext) {
    // Add custom search engine
    context.searchEngines.register({
      id: 'my-engine',
      name: 'My Music Engine',
      search: async (query) => {
        // Implementation
        return results;
      }
    });
  }
}
```

### Installing Plugins
1. Via UI: Settings → Plugins → Browse
2. Via CLI: `npm run plugin:install <plugin-name>`
3. Manual: Copy to `plugins/` directory

## 🧪 Development

### Project Structure
```
2SEARX2COOL-FINAL-INTEGRATED/
├── src/                    # TypeScript/React source
│   ├── main/              # Electron main process
│   ├── renderer/          # React UI
│   └── preload/           # Preload scripts
├── engines/               # Python search engines
├── engine-bridge/         # JSON-RPC bridge
├── orchestrator/          # Flask backend
├── config/                # Configuration files
├── scripts/               # Utility scripts
└── test/                  # Test suites
```

### Development Workflow
```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Run in development mode
npm run dev

# Run tests
npm test
python -m pytest

# Build for production
npm run build
npm run dist
```

### Testing
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`
- Python tests: `pytest tests/`

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/api/README.md)
- [Plugin Development](docs/PLUGIN_DEVELOPMENT.md)
- [Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md)
- [Configuration Guide](config/unified/README.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Quick Start for Contributors
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 🔒 Security

- No user tracking or telemetry
- All searches are private
- Optional Tor support
- Encrypted credential storage
- Regular security updates

Report security issues to: security@example.com

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0** - see [LICENSE](LICENSE).

## 🙏 Acknowledgments

- [SearXNG](https://github.com/searxng/searxng) - Privacy-respecting metasearch engine
- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- All our [contributors](CONTRIBUTORS.md)

## 📞 Support

- [Issue Tracker](https://github.com/Camier/2SEARX2COOL/issues)
- [Discussions](https://github.com/Camier/2SEARX2COOL/discussions)
- [Wiki](https://github.com/Camier/2SEARX2COOL/wiki)

---

<div align="center">
  <sub>Built with ❤️ for privacy and music</sub>
  <br>
  <sub>Making music search private, powerful, and delightful</sub>
</div>