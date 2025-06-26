# SearXNG-Cool Consolidation Plan - Final

## Executive Summary

The current structure contains **11,802 files** with significant redundancy:
- 54% in virtual environment (venv/)
- 44% in full SearXNG copy (searxng-core/)
- Only 2% (~200 files) are actual custom code

**Goal**: Reduce to ~100-200 files containing only custom music engines and essential support files.

## Current vs. Proposed Structure

### Current Issues:
```
searxng-cool/             # 11,802 total files
├── venv/                 # 6,460 files - REMOVE (recreate as needed)
├── searxng-core/         # 5,159 files - EXTRACT only custom engines
├── orchestrator/         # 27 files - UNCLEAR PURPOSE
├── 20+ .md files in root # CONSOLIDATE to docs/
├── Multiple test dirs    # CONSOLIDATE to tests/
├── Multiple backup dirs  # ARCHIVE all
├── Scattered scripts     # CONSOLIDATE to scripts/
└── Mixed dev/prod files  # SEPARATE clearly
```

### Proposed Minimal Structure:
```
searxng-cool/
├── engines/              # ~30 custom music engines only
│   ├── base_music.py
│   ├── lastfm.py
│   ├── musicbrainz.py
│   ├── discogs_music.py
│   ├── spotify_web.py
│   └── ... (other music engines)
├── scripts/              # 3-5 essential scripts
│   ├── deploy.sh         # Sync to production
│   ├── test.sh           # Run all tests
│   └── backup.sh         # Backup production
├── tests/                # All tests consolidated
│   └── test_engines.py
├── docs/                 # Minimal documentation
│   ├── README.md
│   ├── DEPLOYMENT.md
│   └── ENGINES.md
├── config/               # Example configurations
│   └── settings.yml.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Consolidation Steps

### Phase 1: Archive Everything (Preserve Current State)
```bash
# Create archive of entire current state
tar -czf searxng-cool-archive-$(date +%Y%m%d).tar.gz /home/mik/SEARXNG/searxng-cool/

# Create structured archive directory
mkdir -p /home/mik/SEARXNG/searxng-cool-archive/
mv venv/ searxng-cool-archive/
mv searxng-core/ searxng-cool-archive/
mv orchestrator/ searxng-cool-archive/
mv backups/ archives/ cleanup_backup_* searxng-cool-archive/
```

### Phase 2: Extract Essential Components
```bash
# Extract only custom music engines
mkdir -p engines/
cp searxng-core/searxng-core/searx/engines/base_music.py engines/
cp searxng-core/searxng-core/searx/engines/{lastfm,musicbrainz,discogs_music,spotify_web,etc}.py engines/

# Consolidate scripts
mkdir -p scripts/
cp sync_searxng.sh scripts/deploy.sh
# Create simplified test.sh and backup.sh

# Consolidate tests
mkdir -p tests/
cp test_all_music_engines.py tests/test_engines.py
```

### Phase 3: Create Minimal Documentation
```bash
# Keep only essential docs
mkdir -p docs/
# Create new consolidated README.md
# Create DEPLOYMENT.md from existing knowledge
# Create ENGINES.md listing all music engines
```

### Phase 4: Clean Repository
```bash
# Remove all non-essential files
rm -rf venv/ searxng-core/ orchestrator/
rm -rf logs/ *.log
rm -rf node_modules/ package*.json
rm -f *.bak *.backup *.tmp
# Archive old documentation
mkdir -p docs/archive/
mv *.md docs/archive/ # except README.md
```

## Key Decisions Required

### 1. Orchestrator Fate
The `orchestrator/` directory contains a Flask app with:
- Database models for music
- API blueprints
- WebSocket support

**Options:**
- A) Remove if not actively used
- B) Integrate into main deployment
- C) Keep as separate microservice

### 2. Testing Strategy
Currently tests are scattered in 4 locations.

**Recommendation:** Single test file that:
- Tests all engines against production API
- Can be run locally or in CI/CD
- Provides clear pass/fail status

### 3. Deployment Method
Current sync script copies files to `/usr/local/searxng/`.

**Options:**
- A) Keep current method (simple, works)
- B) Create proper Python package
- C) Use Git submodules

### 4. Configuration Management
Settings are currently duplicated.

**Recommendation:** Single source of truth:
- Keep example in repo
- Production config outside repo
- Environment variables for secrets

## Benefits of Consolidation

1. **Clarity**: Clear separation of custom code from upstream
2. **Maintainability**: Easy to understand and modify
3. **Deployment**: Simple copy of ~30 files vs 11,000
4. **Version Control**: Track only what matters
5. **Onboarding**: New developers understand immediately
6. **Performance**: Faster operations on smaller codebase

## Risk Mitigation

1. **Full Archive**: Complete backup before any changes
2. **Gradual Migration**: Test each component separately
3. **Rollback Plan**: Keep archive accessible
4. **Documentation**: Document what was removed and why
5. **Testing**: Ensure all engines work post-consolidation

## Expected Outcome

- **From**: 11,802 files, unclear structure, mixed concerns
- **To**: ~100 files, clear structure, production-ready
- **Reduction**: 99% fewer files
- **Improvement**: 10x easier to maintain and deploy

## Next Steps

1. **Backup everything** (critical first step)
2. **Extract custom engines** to new structure
3. **Test deployment** with minimal structure
4. **Archive old structure** once confirmed working
5. **Update documentation** for new structure