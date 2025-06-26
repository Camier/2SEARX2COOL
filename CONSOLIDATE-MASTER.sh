#!/bin/bash
# Master Consolidation Control Script
# Coordinates all phases with safety checks

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${MAGENTA}╔══════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║   2SEARX2COOL MASTER CONSOLIDATION CONTROL   ║${NC}"
echo -e "${MAGENTA}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This will reduce project size from 4.2GB to ~2GB${NC}"
echo -e "${YELLOW}Full backup will be created before any changes${NC}"
echo ""

# Parse arguments
MODE="interactive"
if [[ "$1" == "--auto" ]]; then
    MODE="auto"
    echo -e "${BLUE}Running in automatic mode${NC}"
elif [[ "$1" == "--help" ]]; then
    echo "Usage: $0 [--auto|--help]"
    echo "  --auto  Run without prompts (still creates backup)"
    echo "  --help  Show this help"
    exit 0
fi

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$BASE_DIR/consolidation-workers"

# Function to prompt for continuation
prompt_continue() {
    if [ "$MODE" == "interactive" ]; then
        echo -e "\n${YELLOW}$1${NC}"
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Consolidation cancelled by user${NC}"
            exit 1
        fi
    fi
}

# STEP 1: Initial Analysis
echo -e "\n${BLUE}═══ STEP 1: Initial Analysis ═══${NC}"
echo "This will analyze the project structure and create a backup"
prompt_continue "Proceed with analysis?"

echo -e "${GREEN}Running analysis...${NC}"
bash "$WORKER_DIR/phase1-analysis.sh"

# Show analysis results
if [ -f "$BASE_DIR/consolidation-reports/dry_run_report.txt" ]; then
    echo -e "\n${YELLOW}Key findings:${NC}"
    grep -E "(Would remove|Would move)" "$BASE_DIR/consolidation-reports/dry_run_report.txt" | head -10
    echo "... (see full report in consolidation-reports/dry_run_report.txt)"
fi

# STEP 2: Safety Verification
echo -e "\n${BLUE}═══ STEP 2: Safety Verification ═══${NC}"
prompt_continue "Run safety checks?"

if ! bash "$WORKER_DIR/verify-safety.sh"; then
    echo -e "${RED}Safety verification failed!${NC}"
    exit 1
fi

# STEP 3: Main Consolidation
echo -e "\n${BLUE}═══ STEP 3: Main Consolidation ═══${NC}"
echo -e "${YELLOW}This will:${NC}"
echo "  • Remove 1.2GB nested duplicate"
echo "  • Organize logs → /logs/"
echo "  • Archive legacy code → /.archive/"
echo "  • Consolidate startup scripts → start.sh"
echo "  • Organize tests and docs"

prompt_continue "Execute consolidation?"

echo -e "${GREEN}Starting consolidation...${NC}"
bash "$WORKER_DIR/execute-consolidation.sh"

# STEP 4: Post-Verification
echo -e "\n${BLUE}═══ STEP 4: Post-Consolidation Verification ═══${NC}"
prompt_continue "Run verification?"

bash "$WORKER_DIR/post-verify.sh"

# STEP 5: Service Restart (if needed)
echo -e "\n${BLUE}═══ STEP 5: Service Management ═══${NC}"

SEARXNG_STATUS=$(systemctl is-active searxng 2>/dev/null || echo "inactive")
ORCHESTRATOR_STATUS=$(systemctl is-active 2searx2cool-orchestrator 2>/dev/null || echo "inactive")

if [[ "$SEARXNG_STATUS" == "inactive" ]] || [[ "$ORCHESTRATOR_STATUS" == "inactive" ]]; then
    echo -e "${YELLOW}Services are currently stopped${NC}"
    if [ "$MODE" == "interactive" ]; then
        read -p "Start services now? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo systemctl start searxng 2searx2cool-orchestrator
            echo -e "${GREEN}Services started${NC}"
        fi
    fi
else
    echo -e "${GREEN}Services are already running${NC}"
fi

# STEP 6: Final Report
echo -e "\n${BLUE}═══ FINAL REPORT ═══${NC}"

# Get sizes
BACKUP_SIZE=$(ls -lh ../2searx2cool-backup-*.tar.gz | tail -1 | awk '{print $5}')
CURRENT_SIZE=$(du -sh "$BASE_DIR" | cut -f1)

echo -e "${GREEN}✅ Consolidation Complete!${NC}"
echo ""
echo "📊 Results:"
echo "  • Original size: 4.2GB"  
echo "  • Current size: $CURRENT_SIZE"
echo "  • Space saved: ~2GB+"
echo "  • Backup size: $BACKUP_SIZE"
echo ""
echo "📁 New Structure:"
echo "  • /logs/ - All log files"
echo "  • /test/ - All test files"
echo "  • /docs/ - Documentation"
echo "  • /.archive/ - Legacy code"
echo "  • start.sh - Unified startup script"
echo ""
echo "🔍 Verification:"
echo "  1. Run: python3 monitoring/production_health.py"
echo "  2. Test: curl http://localhost:8889/public/status"
echo "  3. Check: sudo systemctl status searxng 2searx2cool-orchestrator"
echo ""
echo "💾 Backup:"
echo "  • Location: ../2searx2cool-backup-*.tar.gz"
echo "  • Remove when satisfied: rm ../2searx2cool-backup-*.tar.gz"

# Create completion marker
touch "$BASE_DIR/.consolidation_complete"
echo ""
echo -e "${MAGENTA}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 2SEARX2COOL consolidation successful! 🎉${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════${NC}"