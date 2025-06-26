# SearXNG Cleanup Map

This document maps all SearXNG-related files in the system and indicates what can be safely removed after centralizing knowledge.

## 🟢 KEEP (Active Instances & Core Files)

### Active Instance Directories
```
✓ /home/mik/SEARXNG/searxng-wttr/               # Main production instance
✓ /home/mik/SEARXNG/searxng-convivial/          # Convivial community instance
✓ /home/mik/SEARXNG/SEARXTHEME/ALFREDISGONE/    # Memorial theme (if still using)
```

### Essential Documentation (Now in SEARXNG_CENTRAL)
```
✓ /home/mik/SEARXNG_CENTRAL/                    # NEW centralized location
  - README.md
  - SEARXNG_COMPLETE_GUIDE.md
  - SEARXNG_CONFIGS.yml
  - SEARXNG_SCRIPTS.sh
  - SEARXNG_CLEANUP_MAP.md
```

## 🟡 ARCHIVE (Move to Backups)

### Theme Development Backups
```
→ /home/mik/BACKUPS/correct_theme_backup_20250524_045250/
→ /home/mik/BACKUPS/theme_backups/
→ /home/mik/SEARXNG/SEARXTHEME/deadcat_backup_*/
→ /home/mik/SEARXNG/SEARXTHEME/theme_analysis/
```
**Action**: Create archive: `tar -czf searxng-themes-archive.tar.gz [dirs]`

### Configuration Backups
```
→ /home/mik/BACKUPS/searxng-backup-20250526_194912/
```
**Action**: Keep for reference, compress if large

## 🔴 REMOVE (Redundant/Duplicate Files)

### Duplicate Documentation
```
✗ /home/mik/SEARXNG/searxng-convivial-conversation-saved.md
✗ /home/mik/SEARXNG/searxng-convivial-project-summary.md
✗ /home/mik/SEARXNG/ADVANCED_SEARCH_SUMMARY.md
✗ /home/mik/SEARXNG/CONTEXT7_SEARCH_REPORT.md
✗ /home/mik/SEARXNG/organization_preview_searxng.md
✗ /home/mik/SEARXNG_COMPLETE_KNOWLEDGE.md         # Replaced by CENTRAL version
```

### Duplicate Project Directory
```
✗ /home/mik/PROJECTS/GITHUB/searxng-project/      # Duplicate of convivial
```

### Old Scripts (Now in SEARXNG_SCRIPTS.sh)
```
✗ /home/mik/SEARXNG/searxng-cleanup.sh
✗ /home/mik/SEARXNG/searxng-tailscale-installer.sh
✗ /home/mik/SEARXNG/run-searxng-simple.sh
✗ /home/mik/SEARXNG/fix-searxng-service.sh
✗ /home/mik/SEARXNG/smart-searxng-fix.sh
✗ /home/mik/SEARXNG/start-searxng-v2.sh
✗ /home/mik/SEARXNG/start_alfredisgone.sh
✗ /home/mik/SCRIPTS/networking/fix-searxng-networking.sh
```

### Temporary/Test Files
```
✗ /home/mik/SEARXNG/alfredisgone_homepage.png
✗ /home/mik/SEARXNG/verify_alfredisgone_complete.js
✗ /home/mik/CONFIG/searxng-access-info.txt        # Info now in GUIDE
```

### ALFREDISGONE Handover Files (If theme is fixed)
```
✗ /home/mik/SEARXNG/ALFREDISGONE_CRITICAL_UPDATE.md
✗ /home/mik/SEARXNG/ALFREDISGONE_HANDOVER.md
✗ /home/mik/SEARXNG/ALFREDISGONE_NEXT_CHAT_CONTINUE.md
✗ /home/mik/SEARXNG/ALFREDISGONE_NEXT_CHAT_INSTRUCTIONS.md
```

### Nested Script Duplicates
```
✗ /home/mik/SEARXNG/SEARXTHEME/searxng-setup/     # Many duplicate scripts
✗ /home/mik/SEARXNG/SEARXTHEME/feature_extracts/
```

## 📋 Cleanup Commands

### 1. Create Final Backup
```bash
# Backup everything before cleanup
cd /home/mik
tar -czf SEARXNG_FULL_BACKUP_$(date +%Y%m%d).tar.gz \
  SEARXNG/ BACKUPS/*searxng* BACKUPS/*theme* \
  PROJECTS/GITHUB/searxng-project/
```

### 2. Archive Theme Development
```bash
cd /home/mik
mkdir -p ARCHIVES
tar -czf ARCHIVES/searxng-themes-$(date +%Y%m%d).tar.gz \
  BACKUPS/correct_theme_backup_* \
  BACKUPS/theme_backups/ \
  SEARXNG/SEARXTHEME/deadcat_backup_*
```

### 3. Remove Redundant Files
```bash
# Documentation
rm -f /home/mik/SEARXNG/searxng-convivial-*.md
rm -f /home/mik/SEARXNG/ADVANCED_SEARCH_SUMMARY.md
rm -f /home/mik/SEARXNG/CONTEXT7_SEARCH_REPORT.md
rm -f /home/mik/SEARXNG/organization_preview_searxng.md
rm -f /home/mik/SEARXNG_COMPLETE_KNOWLEDGE.md

# Scripts
rm -f /home/mik/SEARXNG/*.sh
rm -f /home/mik/SCRIPTS/networking/fix-searxng-networking.sh

# Duplicate project
rm -rf /home/mik/PROJECTS/GITHUB/searxng-project/

# ALFREDISGONE docs (if not needed)
rm -f /home/mik/SEARXNG/ALFREDISGONE_*.md

# Test files
rm -f /home/mik/SEARXNG/*.png
rm -f /home/mik/SEARXNG/*.js
rm -f /home/mik/CONFIG/searxng-access-info.txt
```

### 4. Clean Nested Directories
```bash
# Remove duplicate setup directories
rm -rf /home/mik/SEARXNG/SEARXTHEME/searxng-setup/
rm -rf /home/mik/SEARXNG/SEARXTHEME/feature_extracts/

# Clean old theme backups after archiving
rm -rf /home/mik/SEARXNG/SEARXTHEME/deadcat_backup_*
```

## 📊 Space Savings Estimate

| Category | Est. Size | Action |
|----------|-----------|---------|
| Duplicate docs | ~500KB | Remove |
| Duplicate scripts | ~200KB | Remove |
| Duplicate project | ~10MB | Remove |
| Theme backups | ~50MB | Archive |
| **Total Savings** | **~60MB** | |

## ✅ Final Structure

After cleanup, you'll have:
```
/home/mik/
├── SEARXNG_CENTRAL/           # All knowledge in 4 files
│   ├── README.md
│   ├── SEARXNG_COMPLETE_GUIDE.md
│   ├── SEARXNG_CONFIGS.yml
│   ├── SEARXNG_SCRIPTS.sh
│   └── SEARXNG_CLEANUP_MAP.md
├── SEARXNG/
│   ├── searxng-wttr/          # Active instance
│   ├── searxng-convivial/     # Active instance
│   └── SEARXTHEME/
│       └── ALFREDISGONE/      # Keep if using
└── ARCHIVES/
    └── searxng-themes-*.tar.gz
```

## 🔒 Safety Check

Before removing anything:
1. Ensure SEARXNG_CENTRAL has all needed information
2. Test that active instances still work
3. Keep the full backup for 30 days
4. Document what was removed in a cleanup log

---
*Use this map to safely clean up SearXNG files while preserving all essential knowledge and active instances.*