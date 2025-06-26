# SearXNG Central Knowledge Hub

📍 **New Location**: `/home/mik/SEARXNG/CENTRAL/`

This directory contains all essential SearXNG knowledge consolidated into 4 key files:

## 📚 Core Documentation Files

1. **[SEARXNG_COMPLETE_GUIDE.md](./SEARXNG_COMPLETE_GUIDE.md)**
   - Complete installation and configuration guide
   - All three instances documented (wttr, convivial, alfredisgone)
   - Troubleshooting and networking fixes
   - Theme development guide

2. **[SEARXNG_CONFIGS.yml](./SEARXNG_CONFIGS.yml)**
   - All configuration templates in one place
   - Docker compose configurations
   - Settings.yml templates
   - Environment variable examples

3. **[SEARXNG_SCRIPTS.sh](./SEARXNG_SCRIPTS.sh)**
   - All useful scripts consolidated
   - Installation scripts
   - Networking fixes
   - Quick start commands

4. **[SEARXNG_CLEANUP_MAP.md](./SEARXNG_CLEANUP_MAP.md)**
   - List of all SearXNG files in the system
   - What can be safely deleted
   - What should be kept
   - Backup recommendations

## 🚀 Quick Access

### Start Any Instance
```bash
# Convivial Instance
cd /home/mik/SEARXNG/searxng-convivial/searxng-convivial-instance
docker compose up -d

# ALFREDISGONE
cd /home/mik/SEARXNG/SEARXTHEME/ALFREDISGONE
# Use the scripts: /home/mik/SEARXNG/CENTRAL/SEARXNG_SCRIPTS.sh

# Main wttr instance
cd /home/mik/SEARXNG/searxng-wttr
docker compose up -d
```

### Access URLs
- Convivial: http://localhost:8890 (alice/alice123)
- Direct: http://localhost:8899
- WSL2 IP: http://192.168.1.11:8890

## 📁 Cleanup Status
✅ **Cleanup Completed** (6/13/2025)
- Removed duplicate files and directories
- Safety backup: `/home/mik/BACKUPS/searxng-cleanup-20250613/`
- Cleanup log: `SEARXNG_CLEANUP_LOG.txt`

## 📍 File Locations
- **Active Instances**: `/home/mik/SEARXNG/`
- **Central Docs**: `/home/mik/SEARXNG/CENTRAL/`
- **Backups**: `/home/mik/BACKUPS/searxng-cleanup-20250613/`

---
*Last Updated: 6/13/2025*