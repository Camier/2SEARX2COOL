# SearXNG-Cool Consolidation Check Report

## 1. Music Engines Comparison

### Found in Original (searxng-core/searxng-core/searx/engines/):
- allmusic.py
- apple_music_web.py
- bandcamp.py
- bandcamp_enhanced.py
- base_music.py
- deezer.py
- discogs_music.py
- free_music_archive.py
- **genius.py** ← MISSING from consolidation plan!
- genius_lyrics.py
- jamendo_music.py
- lastfm.py
- musicbrainz.py
- musictoscrape.py
- soundcloud.py
- soundcloud_enhanced.py
- spotify.py
- spotify_web.py
- yandex_music.py
- youtube_api.py
- youtube_music.py
- youtube_noapi.py

### Additional Engines Found (not in initial grep):
- beatport.py ← FOUND
- tidal_web.py ← FOUND
- musixmatch.py ← FOUND
- pitchfork.py ← FOUND
- radio_paradise.py ← FOUND

## 2. Critical Files Found

### Environment Files:
- `.env` - Contains API keys and database credentials (MUST BE SECURED!)
- `.env.example` - Template file

### Service Files:
- `searxng-cool.service` - SystemD service for production orchestrator
- `searxng-core/searxng-core/utils/templates/lib/systemd/system/searxng-redis.service`

### Database Connection:
- PostgreSQL: `searxng_user:searxng_music_2024@localhost/searxng_cool_music`
- Redis: `localhost:6379` (DB 1)

## 3. Issues to Address

### High Priority:
1. **genius.py** engine not included in consolidation plan
2. **Additional 5 engines** (beatport, tidal_web, musixmatch, pitchfork, radio_paradise) not in consolidation plan
3. `.env` file contains actual API keys - needs to be secured
4. No backup created yet (tar.gz command didn't run)

### Medium Priority:
1. Service file paths need updating for consolidated structure
2. Need to verify all custom Python files are captured
3. Database schema files not found (may be managed by code)

## 4. Recommendations

### Before Consolidation:
1. Add 6 missing engines to the consolidation list: genius.py, beatport.py, tidal_web.py, musixmatch.py, pitchfork.py, radio_paradise.py
2. Create `.env.production` with placeholder values
3. Create backup first: `tar -czf searxng-cool-backup-$(date +%Y%m%d-%H%M%S).tar.gz --exclude='venv' --exclude='__pycache__' --exclude='.git' .`

### Consolidation Structure Updates:
```
searxng-cool-consolidated/
├── engines/
│   └── [ADD genius.py to the list]
├── config/
│   ├── .env.example (safe template)
│   └── searxng-cool.service (updated paths)
├── sync_searxng.sh (remove missing engines)
└── [other planned directories]
```

### Security Actions:
1. Never commit .env with real keys
2. Use environment variables or secrets management
3. Update .gitignore to exclude .env

## 5. Updated Engine List for Consolidation

All music engines to include (27 total):
- allmusic.py
- apple_music_web.py
- bandcamp.py
- bandcamp_enhanced.py
- base_music.py
- beatport.py ← ADDED
- deezer.py
- discogs_music.py
- free_music_archive.py
- genius.py ← ADDED
- genius_lyrics.py
- jamendo_music.py
- lastfm.py
- musicbrainz.py
- musictoscrape.py
- musixmatch.py ← ADDED
- pitchfork.py ← ADDED
- radio_paradise.py ← ADDED
- soundcloud.py
- soundcloud_enhanced.py
- spotify.py
- spotify_web.py
- tidal_web.py ← ADDED
- yandex_music.py
- youtube_api.py
- youtube_music.py
- youtube_noapi.py