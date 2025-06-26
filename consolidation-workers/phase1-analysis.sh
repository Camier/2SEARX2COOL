#!/bin/bash
# Phase 1: Analysis & Backup Workers

set -e
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$BASE_DIR/consolidation-reports"
mkdir -p "$REPORT_DIR"

echo "=== PHASE 1: Analysis & Backup ==="
echo "Starting at: $(date)"

# Worker 1: File Inventory
echo -e "\n[Worker 1] Creating file inventory..."
(
    cd "$BASE_DIR"
    find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" \) | sort > "$REPORT_DIR/file_inventory.txt"
    find . -type d | sort > "$REPORT_DIR/directory_inventory.txt"
    echo "Found $(wc -l < "$REPORT_DIR/file_inventory.txt") code files"
    echo "Found $(wc -l < "$REPORT_DIR/directory_inventory.txt") directories"
) &

# Worker 2: Access Time Analysis  
echo -e "\n[Worker 2] Analyzing file access times..."
(
    cd "$BASE_DIR"
    find . -type f -atime +30 > "$REPORT_DIR/potentially_unused.txt" 2>/dev/null
    echo "Found $(wc -l < "$REPORT_DIR/potentially_unused.txt") files not accessed in 30+ days"
) &

# Worker 3: Create Backup
echo -e "\n[Worker 3] Creating full backup..."
BACKUP_FILE="$BASE_DIR/../2searx2cool-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
(
    cd "$BASE_DIR/.."
    tar -czf "$BACKUP_FILE" "2SEARX2COOL-FINAL-INTEGRATED" --exclude='*.log' --exclude='__pycache__'
    echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
) &

# Worker 4: Dry Run Analysis
echo -e "\n[Worker 4] Running consolidation dry run..."
(
    cd "$BASE_DIR"
    ./consolidate.sh --dry-run > "$REPORT_DIR/dry_run_report.txt" 2>&1
    echo "Dry run complete - see $REPORT_DIR/dry_run_report.txt"
) &

# Wait for all workers
wait

echo -e "\n=== Phase 1 Complete ==="
echo "Reports saved in: $REPORT_DIR"
echo "Backup saved as: $BACKUP_FILE"

# Summary
echo -e "\n📊 Analysis Summary:"
echo "- Nested duplicate found: $([ -d "$BASE_DIR/2SEARX2COOL-FINAL-INTEGRATED" ] && echo "YES (1.2GB)" || echo "NO")"
echo "- Legacy directories: $(ls -d "$BASE_DIR"/{searxng-migration-backup,searxng-convivial,SEARXTHEME} 2>/dev/null | wc -l)"
echo "- Log files in root: $(ls "$BASE_DIR"/*.log 2>/dev/null | wc -l)"
echo "- Test files in root: $(ls "$BASE_DIR"/test_*.py 2>/dev/null | wc -l)"
echo "- Startup scripts: $(ls "$BASE_DIR"/{start-*.sh,fix-*.sh,run_*.sh} 2>/dev/null | wc -l)"

echo -e "\n✅ Ready for Phase 2 consolidation"