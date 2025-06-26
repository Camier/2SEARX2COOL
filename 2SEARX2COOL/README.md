# 2SEARX2COOL - Complete Music Search Platform

A high-performance, scalable music search platform built on SearXNG with 27 custom music engines and advanced orchestration capabilities.

## 🎵 Features

- **27 Custom Music Engines**: Comprehensive coverage of music platforms
- **Multi-tier Architecture**: nginx → Flask Orchestrator → SearXNG → Engines
- **High Performance**: Eventlet-optimized for 10,000+ concurrent connections
- **WebSocket Support**: Real-time search updates
- **Intelligent Caching**: Redis-based result caching
- **Rate Limiting**: Protect against API limits
- **Authentication System**: Secure access control
- **Result Aggregation**: Smart deduplication and ranking

## 📁 Project Structure

```
2SEARX2COOL/
├── orchestrator/       # Flask application layer
│   ├── app_eventlet_optimized.py  # High-performance server
│   ├── blueprints/    # Modular components
│   │   ├── api/      # RESTful endpoints
│   │   ├── auth/     # Authentication
│   │   ├── proxy/    # Proxy functionality
│   │   └── websocket/# Real-time updates
│   ├── models/        # Database models
│   └── services/      # Business logic
├── engines/           # 27 custom music engines
├── music/             # Music-specific features
├── config/           # Configuration files
├── scripts/          # Automation scripts
├── docs/             # Documentation
└── tests/            # Test suites
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Redis server (running on ports 6379/6380)
- nginx (for production)
- PostgreSQL (optional, for advanced features)

### Installation

1. **Clone and setup SearXNG core**:
```bash
git clone https://github.com/searxng/searxng.git searxng-core
cd searxng-core
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. **Setup the orchestrator**:
```bash
cd ../orchestrator
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **Deploy music engines**:
```bash
./scripts/deployment/deploy_music_engines_systematic.sh
```

4. **Configure services**:
```bash
# Copy and edit configuration
cp config/orchestrator.yml.example config/orchestrator.yml
# Edit Redis connection, ports, etc.
```

5. **Start services**:
```bash
# Development
python orchestrator/app.py

# Production (high-performance)
./scripts/deployment/start-eventlet-production.sh
```

## 🎯 Simplified Workflow

### Development Setup
```
YOUR WORKSPACE (Edit Here)
/home/mik/SEARXNG/2SEARX2COOL/
    ↓
    scripts/sync_searxng.sh (One Command)
    ↓
PRODUCTION (Runs Here)
/usr/local/searxng/searxng-src/
```

### Daily Workflow
1. **Edit** in your workspace: `/home/mik/SEARXNG/2SEARX2COOL/`
2. **Sync** changes: `./scripts/sync_searxng.sh`
3. **Test** results: `python tests/test_all_music_engines.py`
4. **Done!** Changes are live in production

## 🎼 Music Engines

### Streaming Services
- Spotify Web, Apple Music Web, Tidal Web
- Deezer, YouTube Music, Yandex Music

### Independent Platforms
- Bandcamp (+ Enhanced), SoundCloud (+ Enhanced)
- Mixcloud (+ Enhanced), Jamendo

### Metadata & Discovery
- Last.fm, MusicBrainz, AllMusic, Discogs
- Genius, Musixmatch, Pitchfork

### Specialized
- Beatport (Electronic), Radio Paradise
- Free Music Archive, MusicToScrape

### Current Status
- **27 Total Engines** configured
- **15+ Working** engines with verified results
- **Automatic sync** to production
- **Comprehensive testing** suite

## ⚙️ Configuration

### Redis Setup
```yaml
# config/orchestrator.yml
redis:
  host: localhost
  port: 6380
  db: 2
```

### Engine Configuration
```yaml
# config/music_engines.yml
engines:
  spotify_web:
    enabled: true
    rate_limit: 100
    cache_ttl: 3600
```

### nginx Configuration
```bash
# Use provided nginx configs
cp config/nginx-searxng-cool-advanced.conf /etc/nginx/sites-available/
```

## 📊 Performance

- Handles 10,000+ concurrent connections
- Sub-second search response times
- Intelligent result caching
- Automatic failover between engines

## 🔧 Development

### Running Tests
```bash
# Test all music engines
python tests/test_all_music_engines.py

# Run specific engine tests
cd music/tests
python test_spotify_web.py
```

### Adding New Engines
1. Create engine file in `engines/`
2. Inherit from `base_music.py`
3. Add to `config/music_engines.yml`
4. Test thoroughly

### Key Development Files
| Purpose | Location |
|---------|----------|
| Your Engines | `engines/` |
| Sync Script | `scripts/sync_searxng.sh` |
| Test Script | `tests/test_all_music_engines.py` |
| Quick Reference | `docs/operational/QUICK_REFERENCE.md` |
| Engine Status | `docs/operational/MUSIC_ENGINES_STATUS.md` |

## 📚 Documentation

- **Architecture**: `docs/architecture/` - System design and patterns
- **Deployment**: `docs/deployment/` - Production setup guides
- **API Reference**: `docs/api/` - Endpoint documentation
- **Engine Development**: `docs/music-engines/` - Creating new engines
- **Operational Docs**: `docs/operational/` - Daily operations guides

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis is running: `redis-cli ping`
   - Verify ports in config

2. **Engines Not Loading**
   - Check engine deployment
   - Verify SearXNG settings.yml
   - Run sync script: `./scripts/sync_searxng.sh`

3. **High Memory Usage**
   - Adjust cache TTL
   - Configure rate limits

4. **Sync Issues**
   - Check permissions on production directory
   - Verify backup directory exists
   - Review sync script logs

## 📝 License

This project maintains the original SearXNG AGPL license for compatibility.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request

## 🎯 Roadmap

- [ ] Add more music platforms
- [ ] Implement ML-based result ranking
- [ ] Add playlist generation
- [ ] Mobile app API
- [ ] Federation support
- [ ] Enhanced caching strategies
- [ ] Real-time lyrics sync

## 💡 Key Benefits

- **One workspace**: Simplified development environment
- **One command**: Easy deployment with sync script
- **One source of truth**: Your development directory
- **Automatic backups**: Every sync creates a backup
- **Clear documentation**: Everything organized and accessible

---

For detailed documentation, see the `docs/` directory.
For quick operations, check `docs/operational/QUICK_REFERENCE.md`.