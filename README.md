# 2SEARX2COOL 🎵

> Transform your music search into a native desktop experience

2SEARX2COOL is an Electron desktop wrapper for [SearXNG-Cool](https://github.com/Camier/searxng-cool), bringing the power of 27+ music search engines to your desktop with native integrations, offline capabilities, and an extensible plugin system.

## ✨ Features

### 🎯 Core Features
- **Native Desktop Integration**: System tray, global hotkeys, media controls
- **Offline-First**: Local caching with SQLite for offline functionality
- **Plugin System**: Extensible architecture with hot-reload support
- **Multi-Window Support**: Open multiple search sessions
- **Voice Search**: Native speech recognition integration
- **Hardware Support**: MIDI controllers and audio interface integration

### 🚀 Deployment Models
1. **Bundled**: Self-contained app with embedded Python server
2. **External**: Connect to existing SearXNG-Cool instance
3. **Hybrid**: Flexible switching between local and remote servers

### 🔌 Plugin Architecture
- **Main Process Plugins**: System-level integrations
- **Renderer Plugins**: UI enhancements
- **Preload Plugins**: Secure API bridges

## 🛠️ Tech Stack
- **Frontend**: Electron + TypeScript
- **Backend**: SearXNG-Cool (Python/Flask)
- **Plugin System**: Inspired by YouTube Music Desktop App
- **Build Tools**: electron-builder, webpack

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL

# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build
```

## 📦 Installation

### Pre-built Binaries
Download the latest release for your platform:
- [Windows](https://github.com/Camier/2SEARX2COOL/releases)
- [macOS](https://github.com/Camier/2SEARX2COOL/releases)
- [Linux](https://github.com/Camier/2SEARX2COOL/releases)

### From Source
See the [Quick Start](#-quick-start) section above.

## 🔧 Configuration

2SEARX2COOL can be configured through:
- Settings UI in the app
- `config.json` file
- Environment variables
- Command-line arguments

## 🎨 Plugin Development

Create your own plugins to extend functionality:

```typescript
// plugins/my-plugin/index.ts
export default {
  name: 'my-plugin',
  displayName: 'My Amazing Plugin',
  description: 'Adds amazing features',
  version: '1.0.0',
  
  // Plugin implementation
  activate(context) {
    // Your plugin code here
  }
}
```

See our [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT.md) for more details.

## 🗺️ Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Basic Electron wrapper
- [ ] Process communication
- [ ] System tray integration

### Phase 2: Core Features (Weeks 3-4)
- [ ] Plugin system
- [ ] Global hotkeys
- [ ] Settings management

### Phase 3: Enhanced Features (Weeks 5-6)
- [ ] Offline caching
- [ ] Download manager
- [ ] Local library scanner

### Phase 4: Advanced Integration (Weeks 7-8)
- [ ] Voice search
- [ ] Hardware integration
- [ ] Multi-window support

### Phase 5: Polish & Distribution (Weeks 9-10)
- [ ] Auto-updater
- [ ] Code signing
- [ ] Performance optimization

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SearXNG-Cool](https://github.com/Camier/searxng-cool) - The amazing music search aggregator
- [YouTube Music Desktop App](https://github.com/th-ch/youtube-music) - Inspiration for plugin architecture
- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework

## 🔗 Links

- [Project Homepage](https://github.com/Camier/2SEARX2COOL)
- [Issue Tracker](https://github.com/Camier/2SEARX2COOL/issues)
- [Discussions](https://github.com/Camier/2SEARX2COOL/discussions)
- [SearXNG-Cool](https://github.com/Camier/searxng-cool)

---

<p align="center">Made with ❤️ for the open music community</p>