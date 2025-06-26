# SearXNG Quick Reference

## 🚀 Essential Commands

```bash
# Go to your workspace
cd /home/mik/SEARXNG/searxng-cool/

# Sync changes to production
./sync_searxng.sh

# Test all music engines
python3 test_all_music_engines.py

# View logs
sudo journalctl -u searxng -f

# Restart SearXNG
sudo systemctl restart searxng
```

## 📁 Where Things Are

### Your Development Files
- **Engines**: `searxng-core/searxng-core/searx/engines/`
- **Settings**: `searxng-core/searxng-core/searx/settings.yml`
- **Docs**: `docs/music-engines/`
- **Tests**: `tests/music-engines/`

### Production (Don't Edit Directly!)
- **Running From**: `/usr/local/searxng/searxng-src/`
- **Service**: `systemd` manages SearXNG

## 🎵 Music Engines

### Working Engines (15+)
- Last.fm, Deezer, MusicBrainz, Discogs
- Free Music Archive, Jamendo
- Bandcamp, SoundCloud, MixCloud
- Genius, YouTube, Radio Paradise
- Piped.music, WikiCommons.audio

### Test Specific Engine
```bash
curl "http://localhost:8888/search?q=test&engines=lastfm&format=json" | jq '.results | length'
```

## 🔧 Common Tasks

### Add New Engine
1. Create in `searxng-core/searxng-core/searx/engines/`
2. Add to `sync_searxng.sh` MUSIC_ENGINES array
3. Run `./sync_searxng.sh`

### Update Settings
1. Edit `searxng-core/searxng-core/searx/settings.yml`
2. Run `./sync_searxng.sh --settings`

### Debug Issues
```bash
# Check logs
sudo journalctl -u searxng -n 50

# Test engine
curl "http://localhost:8888/search?q=test&engines=ENGINE_NAME&format=json" | jq

# Check if running
sudo systemctl status searxng
```

## ⚠️ Remember

- **ALWAYS** work in `/home/mik/SEARXNG/searxng-cool/`
- **NEVER** edit files in `/usr/local/searxng/` directly
- **USE** `./sync_searxng.sh` to apply changes
- **BACKUPS** are automatic in `backups/` directory