# Changelog

All notable changes to SearXNG-Cool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-06-19

### 🎵 Music Engine Expansion

#### Added
- **24 Music Search Engines** - Comprehensive music search capabilities
- **Base Music Engine Class** (`base_music.py`) - Standardization for all music engines
- **15+ Working Engines** with live results:
  - Last.fm (API-based, 30+ results)
  - Deezer (25+ results with previews)
  - MusicBrainz (20+ results)
  - Discogs (40+ results)
  - Jamendo (40+ results)
  - Free Music Archive (20+ results)
  - Bandcamp, SoundCloud, MixCloud, Genius, YouTube
  - Radio Paradise, Piped.music, WikiCommons.audio
  - Adobe Stock Audio

#### Implemented (Limited by Anti-Bot)
- Spotify Web, Apple Music Web, Tidal Web
- Musixmatch (CloudFlare 403)
- Beatport, Pitchfork, AllMusic
- MusicToScrape

#### Infrastructure
- **Sync Script** (`sync_searxng.sh`) - One-command deployment
- **Test Suite** (`test_all_music_engines.py`) - Comprehensive testing
- **Auto-backup System** - Backups on each sync
- **Consolidated Directory Structure** - Clear separation of dev/prod

#### Documentation
- Complete music engine documentation
- Implementation guides and research
- Scraping strategies and anti-bot analysis
- Quick reference guides

### Fixed
- Radio Paradise NoneType errors
- Apple Music Web KeyError issues
- Pitchfork timeout configuration
- SQLite multi-thread warnings
- Missing doi_resolver configuration

### Changed
- Consolidated development workflow
- Simplified deployment process
- Enhanced error handling in engines
- Improved result standardization

## [1.5.0] - 2025-06-17

### Added
- Production Flask-SocketIO with eventlet
- Support for 10,000+ concurrent connections
- Intelligent nginx routing
- WebSocket real-time search
- Comprehensive monitoring

### Fixed
- WSL2 localhost connectivity issues
- Memory optimization (~4KB per connection)
- CORS and security headers

## [1.0.0] - 2025-06-13

### Added
- Initial SearXNG-Cool release
- Flask orchestrator service
- PostgreSQL integration
- Redis message queue
- Basic music engine support

---

For detailed commit history, see the [Git log](https://github.com/yourusername/searxng-cool/commits/main)