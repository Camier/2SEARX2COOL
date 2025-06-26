# SearXNG Directory Structure - Consolidated

## 📁 Main Directories

### 1. Development Directory (YOUR WORKSPACE)
```
/home/mik/SEARXNG/searxng-cool/
├── searxng-core/searxng-core/        # Development copy of SearXNG
│   └── searx/
│       ├── engines/                  # Your custom engines go here
│       │   ├── base_music.py        # Base class for music engines
│       │   ├── lastfm.py           # Custom music engines...
│       │   └── ...
│       └── settings.yml             # Development settings
├── docs/                            # Documentation
│   └── music-engines/              # Music engine docs
├── tests/                          # Test scripts
├── scripts/                        # Utility scripts
├── backups/                        # Backups of your work
└── sync_searxng.sh                 # Sync script to production
```

### 2. Production Directory (SEARXNG RUNS FROM HERE)
```
/usr/local/searxng/searxng-src/
└── searx/
    ├── engines/                    # Active engines (synced from dev)
    └── settings.yml               # Active settings
```

## 🔄 Workflow

### 1. Development Workflow
```bash
# 1. Make changes in development directory
cd /home/mik/SEARXNG/searxng-cool/
vim searxng-core/searxng-core/searx/engines/my_engine.py

# 2. Test locally if needed
python3 tests/test_my_engine.py

# 3. Sync to production
./sync_searxng.sh

# 4. Test in production
curl "http://localhost:8888/search?q=test&engines=my_engine&format=json"
```

### 2. Quick Commands
```bash
# Go to development directory
cd /home/mik/SEARXNG/searxng-cool/

# Sync engines only
./sync_searxng.sh

# Sync engines AND settings
./sync_searxng.sh --settings

# View SearXNG logs
sudo journalctl -u searxng -f

# Restart SearXNG
sudo systemctl restart searxng

# Test all music engines
python3 test_all_music_engines.py
```

## 📝 Important Files

### In Development Directory
- `searxng-core/searxng-core/searx/engines/` - Your custom engines
- `docs/music-engines/` - Documentation for music engines
- `tests/music-engines/` - Test scripts
- `sync_searxng.sh` - Sync script

### In Production Directory
- `/usr/local/searxng/searxng-src/searx/settings.yml` - Active config
- `/usr/local/searxng/searxng-src/searx/engines/` - Active engines

## ⚠️ Important Notes

1. **Always work in development directory** (`/home/mik/SEARXNG/searxng-cool/`)
2. **Use sync script** to copy changes to production
3. **Don't edit production files directly** (requires sudo and risky)
4. **Backup before major changes** (automatic in sync script)

## 🚀 Common Tasks

### Add a new engine
```bash
# 1. Create engine in development
vim searxng-core/searxng-core/searx/engines/new_engine.py

# 2. Add to sync script
vim sync_searxng.sh  # Add to MUSIC_ENGINES array

# 3. Sync and test
./sync_searxng.sh
```

### Update settings
```bash
# 1. Edit development settings
vim searxng-core/searxng-core/searx/settings.yml

# 2. Sync with --settings flag
./sync_searxng.sh --settings
```

### Debug an engine
```bash
# 1. Check logs
sudo journalctl -u searxng -f | grep "engine_name"

# 2. Test directly
curl "http://localhost:8888/search?q=test&engines=engine_name&format=json" | jq
```

## 📊 Current Status

- **Development Directory**: `/home/mik/SEARXNG/searxng-cool/`
- **Production Directory**: `/usr/local/searxng/searxng-src/`
- **Sync Method**: `./sync_searxng.sh` script
- **Music Engines**: 24 total (15+ working)