# SearXNG-Cool Consolidation Final Checklist

## ✅ Backup Created
- Location: `/home/mik/SEARXNG/searxng-cool-backup-20250619-142325.tar.gz`
- Size: 157MB
- Excludes: venv, __pycache__, .git, node_modules, logs

## 🔴 Critical Findings

### 1. Missing Engines (6 engines not in consolidation plan):
- genius.py (different from genius_lyrics.py)
- beatport.py
- tidal_web.py
- musixmatch.py
- pitchfork.py
- radio_paradise.py

### 2. Security Issues:
- `.env` file contains REAL API KEYS and passwords
- Must create `.env.production` with placeholders
- Never commit the real .env file

### 3. Key Components to Include:
```
# Orchestrator API Routes
orchestrator/
├── app.py
├── blueprints/
│   ├── api/
│   │   ├── music_aggregation_routes.py
│   │   ├── music_routes.py
│   │   └── routes.py
│   ├── auth/routes.py
│   ├── proxy/routes.py
│   └── websocket/routes.py

# All 27 Music Engines
engines/
├── allmusic.py
├── apple_music_web.py
├── bandcamp.py
├── bandcamp_enhanced.py
├── base_music.py
├── beatport.py ← ADD
├── deezer.py
├── discogs_music.py
├── free_music_archive.py
├── genius.py ← ADD
├── genius_lyrics.py
├── jamendo_music.py
├── lastfm.py
├── musicbrainz.py
├── musictoscrape.py
├── musixmatch.py ← ADD
├── pitchfork.py ← ADD
├── radio_paradise.py ← ADD
├── soundcloud.py
├── soundcloud_enhanced.py
├── spotify.py
├── spotify_web.py
├── tidal_web.py ← ADD
├── yandex_music.py
├── youtube_api.py
├── youtube_music.py
└── youtube_noapi.py

# Service & Config Files
config/
├── .env.example (safe template)
├── searxng-cool.service
└── settings.yml
```

## 📋 Pre-Consolidation Tasks

1. **Create safe .env template:**
   ```bash
   cp .env .env.production
   # Then manually replace all real keys with placeholders
   ```

2. **Update sync_searxng.sh:**
   - Add the 6 missing engines to the MUSIC_ENGINES array
   - Update paths for new consolidated structure

3. **Update service file paths:**
   - Modify searxng-cool.service for new directory structure
   - Update WorkingDirectory and ExecStart paths

## 🚀 Ready to Proceed?

Once these issues are addressed:
1. All 27 music engines will be included
2. Security will be maintained (no real keys in repo)
3. Service configurations will be updated
4. Backup exists for recovery

The consolidation can then proceed safely with all critical components preserved.