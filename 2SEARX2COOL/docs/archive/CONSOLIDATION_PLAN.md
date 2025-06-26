# SearXNG Directory Consolidation Plan

## Current Situation

### Two Separate Directories:
1. **Development Directory**: `/home/mik/SEARXNG/searxng-cool/`
   - Contains all our custom engines
   - Has documentation and test scripts
   - This is where we've been developing

2. **SearXNG Installation**: `/usr/local/searxng/searxng-src/`
   - This is what actually runs
   - Managed by systemd service
   - Requires sudo to modify

## Consolidation Strategy

### Option 1: Work Directly in Installation (NOT RECOMMENDED)
- Would require constant sudo
- Risk of breaking production
- Difficult to version control

### Option 2: Symlink Approach (RECOMMENDED)
- Keep development in `/home/mik/SEARXNG/searxng-cool/`
- Create symlinks from installation to development
- Easy to update and test

### Option 3: Sync Script Approach
- Keep development separate
- Create sync script to copy changes
- Run after each change

## Recommended Approach: Sync Script

Create a sync script that:
1. Backs up current installation
2. Copies all custom engines
3. Copies settings.yml
4. Restarts SearXNG
5. Runs tests

This way:
- Development stays in your home directory
- Production runs from /usr/local/searxng
- One command to sync changes
- Easy rollback if needed