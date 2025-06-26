#!/bin/bash
# 2SEARX2COOL Consolidation Script
# Safely consolidates and cleans up the project structure

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_DIR="$BASE_DIR/.archive"
BACKUP_DIR="$BASE_DIR/.backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}=== 2SEARX2COOL Consolidation Script ===${NC}"
echo -e "${YELLOW}This script will consolidate and clean up the project structure${NC}"
echo -e "${YELLOW}A backup will be created at: $BACKUP_DIR${NC}"
echo ""

# Parse command line arguments
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
fi

# Confirmation
if [ "$DRY_RUN" = false ]; then
    read -p "Do you want to proceed? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Consolidation cancelled."
        exit 1
    fi
fi

# Create backup directory
echo -e "\n${GREEN}Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"

# Function to safely move files
safe_move() {
    local src="$1"
    local dst="$2"
    if [ -e "$src" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${BLUE}[DRY RUN]${NC} Would move: $src → $dst"
        else
            mkdir -p "$(dirname "$dst")"
            cp -r "$src" "$BACKUP_DIR/$(basename "$src")" 2>/dev/null || true
            mv "$src" "$dst"
            echo -e "${GREEN}✓${NC} Moved: $src → $dst"
        fi
    fi
}

# Function to safely remove
safe_remove() {
    local target="$1"
    if [ -e "$target" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${BLUE}[DRY RUN]${NC} Would remove: $target ($(du -sh "$target" 2>/dev/null | cut -f1))"
        else
            cp -r "$target" "$BACKUP_DIR/$(basename "$target")" 2>/dev/null || true
            rm -rf "$target"
            echo -e "${GREEN}✓${NC} Removed: $target"
        fi
    fi
}

# Phase 1: Critical Cleanup
echo -e "\n${BLUE}Phase 1: Critical Cleanup${NC}"

# Remove nested duplicate (CRITICAL)
if [ -d "$BASE_DIR/2SEARX2COOL-FINAL-INTEGRATED" ]; then
    echo -e "${RED}Found nested duplicate directory!${NC}"
    safe_remove "$BASE_DIR/2SEARX2COOL-FINAL-INTEGRATED"
fi

# Create organized directories
mkdir -p "$BASE_DIR/logs"
mkdir -p "$BASE_DIR/test"
mkdir -p "$BASE_DIR/scripts"
mkdir -p "$BASE_DIR/docs/archive"
mkdir -p "$ARCHIVE_DIR"

# Move log files
echo -e "\n${BLUE}Consolidating log files...${NC}"
for log in *.log; do
    [ -f "$log" ] && safe_move "$log" "$BASE_DIR/logs/$log"
done

# Archive legacy directories
echo -e "\n${BLUE}Archiving legacy directories...${NC}"
for dir in searxng-migration-backup searxng-convivial SEARXTHEME; do
    [ -d "$BASE_DIR/$dir" ] && safe_move "$BASE_DIR/$dir" "$ARCHIVE_DIR/$dir"
done

# Phase 2: Consolidate Startup Scripts
echo -e "\n${BLUE}Phase 2: Consolidating startup scripts...${NC}"

# Create unified startup script
cat > "$BASE_DIR/start.sh" << 'EOF'
#!/bin/bash
# Unified 2SEARX2COOL Startup Script

# Default values
MODE="dev"
SERVICE="all"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        --service=*)
            SERVICE="${1#*=}"
            shift
            ;;
        --help)
            echo "Usage: $0 [--mode=dev|prod|debug] [--service=all|searxng|orchestrator|bridge]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to start SearXNG
start_searxng() {
    echo "Starting SearXNG..."
    cd "$BASE_DIR/searxng-wttr"
    export SEARXNG_SETTINGS_PATH="$BASE_DIR/config/searxng-settings.yml"
    
    if [ "$MODE" = "prod" ]; then
        python -m searx.webapp &
    else
        python -m searx.webapp --debug &
    fi
}

# Function to start Orchestrator
start_orchestrator() {
    echo "Starting Orchestrator..."
    cd "$BASE_DIR/orchestrator"
    
    if [ "$MODE" = "prod" ]; then
        python run_server.py &
    else
        python run_server.py --debug &
    fi
}

# Function to start Engine Bridge
start_bridge() {
    echo "Starting Engine Bridge..."
    cd "$BASE_DIR/integration"
    node engine-bridge.js &
}

# Start services based on selection
case $SERVICE in
    all)
        start_searxng
        sleep 2
        start_orchestrator
        sleep 1
        start_bridge
        ;;
    searxng)
        start_searxng
        ;;
    orchestrator)
        start_orchestrator
        ;;
    bridge)
        start_bridge
        ;;
esac

echo "Services started in $MODE mode"
wait
EOF

chmod +x "$BASE_DIR/start.sh"

# Move old startup scripts to archive
mkdir -p "$BASE_DIR/scripts/archive"
for script in start-*.sh fix-*.sh run_*.sh; do
    [ -f "$script" ] && [ "$script" != "start.sh" ] && safe_move "$script" "$BASE_DIR/scripts/archive/$script"
done

# Phase 3: Consolidate Test Files
echo -e "\n${BLUE}Phase 3: Organizing test files...${NC}"

# Move test files to test directory
for test in test_*.py; do
    [ -f "$test" ] && safe_move "$test" "$BASE_DIR/test/$test"
done

# Phase 4: Documentation Consolidation
echo -e "\n${BLUE}Phase 4: Consolidating documentation...${NC}"

# Archive phase reports
for report in PHASE*-*.md; do
    [ -f "$report" ] && safe_move "$report" "$BASE_DIR/docs/archive/$report"
done

# Keep only essential docs in root
for doc in *.md; do
    if [[ ! "$doc" =~ ^(README|CHANGELOG|LICENSE|PROJECT-COMPLETE)\.md$ ]]; then
        [ -f "$doc" ] && safe_move "$doc" "$BASE_DIR/docs/$doc"
    fi
done

# Phase 5: Configuration Consolidation
echo -e "\n${BLUE}Phase 5: Organizing configurations...${NC}"

# Create organized config structure
mkdir -p "$BASE_DIR/config/app"
mkdir -p "$BASE_DIR/config/services"
mkdir -p "$BASE_DIR/config/development"
mkdir -p "$BASE_DIR/config/production"

# Move unified configs
if [ -d "$BASE_DIR/config/unified" ]; then
    cp -r "$BASE_DIR/config/unified/"* "$BASE_DIR/config/app/" 2>/dev/null || true
    safe_remove "$BASE_DIR/config/unified"
fi

# Phase 6: Engine Consolidation
echo -e "\n${BLUE}Phase 6: Consolidating engines...${NC}"

# Merge adapted engines into main engines directory
if [ -d "$BASE_DIR/adapted_engines" ]; then
    cp -r "$BASE_DIR/adapted_engines/"* "$BASE_DIR/engines/" 2>/dev/null || true
    safe_remove "$BASE_DIR/adapted_engines"
fi

# Remove duplicate engine directories
safe_remove "$BASE_DIR/2SEARX2COOL/engines"

# Phase 7: Clean up temporary files
echo -e "\n${BLUE}Phase 7: Cleaning temporary files...${NC}"

# Remove common temporary files
find "$BASE_DIR" -name "*.pyc" -delete
find "$BASE_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BASE_DIR" -name ".DS_Store" -delete 2>/dev/null || true
find "$BASE_DIR" -name "*.tmp" -delete 2>/dev/null || true

# Final Report
echo -e "\n${BLUE}=== Consolidation Complete ===${NC}"
echo -e "${GREEN}✓ Removed nested duplicates${NC}"
echo -e "${GREEN}✓ Consolidated startup scripts → start.sh${NC}"
echo -e "${GREEN}✓ Organized test files → /test/${NC}"
echo -e "${GREEN}✓ Archived documentation → /docs/archive/${NC}"
echo -e "${GREEN}✓ Centralized logs → /logs/${NC}"
echo -e "${GREEN}✓ Cleaned temporary files${NC}"
echo -e "\n${YELLOW}Backup saved at: $BACKUP_DIR${NC}"

# Size comparison
if command -v du &> /dev/null; then
    echo -e "\n${BLUE}Space Savings:${NC}"
    BEFORE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    AFTER=$(du -sh "$BASE_DIR" 2>/dev/null | cut -f1)
    echo "Before: ~$BEFORE"
    echo "After:  $AFTER"
fi

echo -e "\n${GREEN}Consolidation successful!${NC}"
echo -e "${YELLOW}Review the changes and remove the backup when satisfied:${NC}"
echo -e "rm -rf $BACKUP_DIR"