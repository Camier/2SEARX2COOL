# 2SEARX2COOL Knowledge Entry

## Project: 2SEARX2COOL
**Type**: Consolidated Music Search Platform
**Location**: /home/mik/SEARXNG/2SEARX2COOL
**Created**: 2025-06-23
**Size**: 1.7MB

## Description
2SEARX2COOL is the final consolidated version of the SearXNG music search platform. It combines all the essential components from multiple previous versions (searxng-cool, searxng-cool-old, searxng-cool-complete) into a single, clean directory structure.

## Architecture
- **Multi-tier**: nginx → Flask Orchestrator → SearXNG Core → Search Engines
- **Performance**: Eventlet-optimized for 10,000+ concurrent connections
- **Scalability**: WebSocket support for real-time updates
- **Caching**: Redis-based result caching on port 6380

## Components
1. **Orchestrator** - Flask application with blueprints for API, auth, proxy, and websocket
2. **Engines** - 27 custom music search engines
3. **Music** - Music-specific infrastructure (cache, rate limiter, tests)
4. **Config** - All configuration files
5. **Scripts** - Deployment and utility automation
6. **Docs** - Complete documentation
7. **Tests** - Comprehensive test suites

## Music Engines (27 total)
- Streaming: Spotify Web, Apple Music Web, Tidal Web, Deezer, YouTube Music
- Independent: Bandcamp, SoundCloud, Mixcloud, Jamendo
- Metadata: Last.fm, MusicBrainz, AllMusic, Discogs
- Lyrics: Genius, Musixmatch
- Reviews: Pitchfork
- Specialized: Beatport, Radio Paradise, Free Music Archive

## Replaces
- searxng-cool (minimal version)
- searxng-cool-old (bloated original)
- searxng-cool-complete (previous consolidation attempt)
- searxng-cool-restored (partial restoration)
- All searxng-cool-archive-* directories

## Benefits
- Consolidated from 2.5GB across multiple directories to 1.7MB
- Clean, organized structure
- All features preserved
- Git-friendly size
- Production-ready

## Configuration
- Redis: localhost:6379 (orchestrator), localhost:6380 (SearXNG cache)
- Main config: /home/mik/SEARXNG/2SEARX2COOL/config/orchestrator.yml
- Service name: 2searx2cool-orchestrator

## Related Commands
```bash
cd /home/mik/SEARXNG/2SEARX2COOL
./scripts/deployment/start-eventlet-production.sh
```