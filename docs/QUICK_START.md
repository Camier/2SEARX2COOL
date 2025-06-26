# 2SEARX2COOL Quick Start Guide

Welcome to 2SEARX2COOL! This guide will get you up and running in minutes.

## 🚀 Choose Your Path

### Option 1: Desktop Application (Easiest)

Perfect for personal use with a native desktop experience.

#### Download and Run

1. **Download** the latest release for your platform:
   - **Windows**: [2SEARX2COOL-Setup.exe](https://github.com/Camier/2SEARX2COOL/releases)
   - **macOS**: [2SEARX2COOL.dmg](https://github.com/Camier/2SEARX2COOL/releases)
   - **Linux**: [2SEARX2COOL.AppImage](https://github.com/Camier/2SEARX2COOL/releases)

2. **Install** and launch the application

3. **Search** for music using 27+ search engines!

That's it! The desktop app handles everything automatically.

### Option 2: Web Service (For Servers)

Ideal for hosting your own search service.

#### Quick Deploy with Docker

```bash
# Clone the repository
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:8888
```

#### Manual Installation (10 minutes)

```bash
# 1. Clone repository
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start services
./scripts/start-unified.sh --service

# 4. Open http://localhost:8888
```

## 🎵 Basic Usage

### Search for Music

1. **Enter** your search query (artist, song, album)
2. **Select** search engines (or use all)
3. **Press** Enter or click Search
4. **Browse** results from multiple sources

### Search Tips

- **Specific engine**: `!spotify pink floyd`
- **Advanced search**: `artist:"Pink Floyd" year:1973`
- **Exclude terms**: `beatles -remix`

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Focus search | `Ctrl/Cmd + K` |
| New search | `Ctrl/Cmd + T` |
| Settings | `Ctrl/Cmd + ,` |
| Clear search | `Ctrl/Cmd + L` |

## ⚙️ Configuration

### Desktop App Settings

Access via `Settings` menu or `Ctrl/Cmd + ,`:

- **Theme**: Light/Dark/System
- **Search Engines**: Enable/disable specific engines
- **Cache**: Manage offline data
- **Shortcuts**: Customize keyboard shortcuts

### Web Service Configuration

Edit `config/unified-config.json`:

```json
{
  "mode": "service",
  "service": {
    "searxng": {
      "port": 8888,
      "engines": ["spotify", "soundcloud", "bandcamp"]
    }
  }
}
```

## 🔌 Optional: API Keys

Some engines work better with API keys:

### Get API Keys

1. **Discogs**: [Register at Discogs](https://www.discogs.com/settings/developers)
2. **Jamendo**: [Get key at Jamendo](https://devportal.jamendo.com/)

### Add API Keys

#### Desktop App
Settings → API Keys → Add your keys

#### Web Service
```bash
# Edit .env file
DISCOGS_API_TOKEN=your_token_here
JAMENDO_API_KEY=your_key_here
```

## 🚨 Troubleshooting

### Desktop App Issues

**App won't start?**
- Check antivirus isn't blocking it
- Run as administrator (Windows)
- Check Security & Privacy settings (macOS)

**Blank screen?**
- Press `Ctrl/Cmd + Shift + I` for developer tools
- Check for JavaScript errors

### Web Service Issues

**Port already in use?**
```bash
# Check what's using port 8888
sudo lsof -i :8888

# Use different port
SEARXNG_PORT=8080 ./scripts/start-unified.sh --service
```

**No results?**
```bash
# Check service status
curl http://localhost:8888/healthz

# View logs
tail -f logs/searxng.log
```

## 🎯 Next Steps

### Explore Features

- **Plugins**: Browse and install plugins for extra features
- **Themes**: Customize the appearance
- **Export**: Save search results in various formats
- **History**: Access your search history

### Advanced Usage

- [Plugin Development](PLUGIN_DEVELOPMENT.md)
- [API Documentation](api/API_REFERENCE.md)
- [Self-Hosting Guide](deployment/DEPLOYMENT_GUIDE.md)

### Get Help

- **Documentation**: [Full docs](https://github.com/Camier/2SEARX2COOL/wiki)
- **Issues**: [Report bugs](https://github.com/Camier/2SEARX2COOL/issues)
- **Discussions**: [Ask questions](https://github.com/Camier/2SEARX2COOL/discussions)

## 🎉 Quick Wins

Try these searches to see the power of 2SEARX2COOL:

1. **Multi-source search**: `pink floyd dark side`
   - See results from Spotify, Apple Music, YouTube Music, and more!

2. **Lyrics search**: `!genius bohemian rhapsody lyrics`
   - Find complete lyrics instantly

3. **Discovery mode**: `genre:"progressive rock" year:1970..1975`
   - Discover classic prog rock albums

4. **Artist deep dive**: `artist:"David Bowie" type:album`
   - Explore an artist's complete discography

## 📱 Mobile Access (Web Service)

Access your web service from mobile devices:

1. Find your computer's IP address:
   ```bash
   # Linux/macOS
   ip addr show | grep inet
   
   # Windows
   ipconfig
   ```

2. On your mobile device, visit:
   ```
   http://YOUR_IP:8888
   ```

3. Add to home screen for app-like experience

## 🔄 Staying Updated

### Desktop App
- Auto-updates enabled by default
- Check manually: Help → Check for Updates

### Web Service
```bash
# Update to latest version
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED
git pull
pip install -r requirements.txt --upgrade
./scripts/start-unified.sh --service
```

---

**Congratulations!** You're now ready to enjoy private, powerful music search with 2SEARX2COOL. 🎵

*Need more help? Check the [full documentation](../README.md) or [ask the community](https://github.com/Camier/2SEARX2COOL/discussions).*