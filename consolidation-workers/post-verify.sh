#!/bin/bash
# Post-Consolidation Verification Script

set -e
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== 🔍 POST-CONSOLIDATION VERIFICATION ==="
echo ""

# 1. Check directory structure
echo "📁 Verifying new directory structure..."
EXPECTED_DIRS=(
    "logs"
    "test" 
    "docs"
    "docs/archive"
    "scripts/archive"
    ".archive"
)

for dir in "${EXPECTED_DIRS[@]}"; do
    if [ -d "$BASE_DIR/$dir" ]; then
        echo -e "${GREEN}✅${NC} $dir exists"
    else
        echo -e "${RED}❌${NC} $dir missing"
    fi
done

# 2. Verify critical components untouched
echo -e "\n🔒 Verifying critical components..."
CRITICAL_ITEMS=(
    "orchestrator/app.py"
    "orchestrator/run_server.py"
    "searxng-wttr/searx/webapp.py"
    "engines/__init__.py"
    "config/searxng-settings.yml"
    "config/orchestrator.yml"
)

for item in "${CRITICAL_ITEMS[@]}"; do
    if [ -e "$BASE_DIR/$item" ]; then
        echo -e "${GREEN}✅${NC} $item preserved"
    else
        echo -e "${RED}❌${NC} $item MISSING!"
    fi
done

# 3. Check consolidation results
echo -e "\n📊 Consolidation Results..."
echo "- Log files in /logs/: $(ls "$BASE_DIR/logs/"*.log 2>/dev/null | wc -l)"
echo "- Test files in /test/: $(ls "$BASE_DIR/test/"*.py 2>/dev/null | wc -l)"
echo "- Archived scripts: $(ls "$BASE_DIR/scripts/archive/"*.sh 2>/dev/null | wc -l)"
echo "- Legacy in .archive: $(ls -d "$BASE_DIR/.archive/"* 2>/dev/null | wc -l)"

# 4. Check for removed items
echo -e "\n🗑️ Verifying removals..."
if [ ! -d "$BASE_DIR/2SEARX2COOL-FINAL-INTEGRATED" ]; then
    echo -e "${GREEN}✅${NC} Nested duplicate removed"
else
    echo -e "${RED}❌${NC} Nested duplicate still exists!"
fi

# Check startup scripts moved
OLD_SCRIPTS=($(ls "$BASE_DIR"/{start-*.sh,fix-*.sh,run_*.sh} 2>/dev/null | grep -v start.sh || true))
if [ ${#OLD_SCRIPTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅${NC} Old startup scripts archived"
else
    echo -e "${YELLOW}⚠️${NC} ${#OLD_SCRIPTS[@]} old scripts still in root"
fi

# 5. Test services (if running)
echo -e "\n🌐 Testing services..."

# Check systemd services
SEARXNG_STATUS=$(systemctl is-active searxng 2>/dev/null || echo "inactive")
ORCHESTRATOR_STATUS=$(systemctl is-active 2searx2cool-orchestrator 2>/dev/null || echo "inactive")

echo "- SearXNG service: $SEARXNG_STATUS"
echo "- Orchestrator service: $ORCHESTRATOR_STATUS"

# Test API endpoints if services are active
if [[ "$ORCHESTRATOR_STATUS" == "active" ]]; then
    if curl -s -f "http://localhost:8889/public/status" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} Orchestrator API responding"
    else
        echo -e "${RED}❌${NC} Orchestrator API not responding"
    fi
fi

if [[ "$SEARXNG_STATUS" == "active" ]]; then
    if curl -s -f "http://localhost:8888/search?q=test&format=json" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} SearXNG API responding"
    else
        echo -e "${RED}❌${NC} SearXNG API not responding"
    fi
fi

# 6. Space savings report
echo -e "\n💾 Space Savings..."
CURRENT_SIZE=$(du -sh "$BASE_DIR" 2>/dev/null | cut -f1)
echo "Current project size: $CURRENT_SIZE (was 4.2GB)"

# 7. Final summary
echo -e "\n=== 📋 VERIFICATION SUMMARY ==="

# Count successes and failures
ISSUES=0

# Check if all critical files exist
for item in "${CRITICAL_ITEMS[@]}"; do
    [ ! -e "$BASE_DIR/$item" ] && ((ISSUES++))
done

# Check if nested duplicate was removed
[ -d "$BASE_DIR/2SEARX2COOL-FINAL-INTEGRATED" ] && ((ISSUES++))

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Consolidation successful!${NC}"
    echo "All critical components preserved and structure improved."
else
    echo -e "${RED}❌ Found $ISSUES issues!${NC}"
    echo "Review the output above and check consolidation.log"
fi

echo -e "\n📝 Next steps:"
echo "1. If services are stopped, restart them:"
echo "   sudo systemctl start searxng 2searx2cool-orchestrator"
echo "2. Run full production verification:"
echo "   python3 integration/phase4_verification.py"
echo "3. When satisfied, remove backup:"
echo "   rm ../2searx2cool-backup-*.tar.gz"