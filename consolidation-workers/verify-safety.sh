#!/bin/bash
# Safety Verification Before Consolidation

set -e
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== 🔍 SAFETY VERIFICATION ==="

# Check if production services are running
echo -e "\n📌 Checking production services..."
SEARXNG_STATUS=$(systemctl is-active searxng 2>/dev/null || echo "inactive")
ORCHESTRATOR_STATUS=$(systemctl is-active 2searx2cool-orchestrator 2>/dev/null || echo "inactive")

echo "- SearXNG service: $SEARXNG_STATUS"
echo "- Orchestrator service: $ORCHESTRATOR_STATUS"

if [[ "$SEARXNG_STATUS" == "active" ]] || [[ "$ORCHESTRATOR_STATUS" == "active" ]]; then
    echo -e "\n⚠️  WARNING: Production services are running!"
    echo "It's recommended to:"
    echo "1. Stop services: sudo systemctl stop searxng 2searx2cool-orchestrator"
    echo "2. Run consolidation"
    echo "3. Restart services: sudo systemctl start searxng 2searx2cool-orchestrator"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for critical directories
echo -e "\n📁 Verifying critical directories exist..."
CRITICAL_DIRS=(
    "orchestrator"
    "searxng-wttr"
    "engines"
    "config"
)

for dir in "${CRITICAL_DIRS[@]}"; do
    if [ -d "$BASE_DIR/$dir" ]; then
        echo "✅ $dir - Found"
    else
        echo "❌ $dir - MISSING! This is critical!"
        exit 1
    fi
done

# Check for backup
echo -e "\n💾 Checking for recent backup..."
BACKUP_COUNT=$(ls "$BASE_DIR"/../2searx2cool-backup-*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -eq 0 ]; then
    echo "❌ No backup found! Run phase1-analysis.sh first!"
    exit 1
else
    LATEST_BACKUP=$(ls -t "$BASE_DIR"/../2searx2cool-backup-*.tar.gz | head -1)
    echo "✅ Found backup: $(basename "$LATEST_BACKUP") ($(du -h "$LATEST_BACKUP" | cut -f1))"
fi

# Check disk space
echo -e "\n💿 Checking disk space..."
AVAILABLE_SPACE=$(df -BG "$BASE_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
REQUIRED_SPACE=5  # GB

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    echo "❌ Insufficient disk space! Available: ${AVAILABLE_SPACE}GB, Required: ${REQUIRED_SPACE}GB"
    exit 1
else
    echo "✅ Disk space OK: ${AVAILABLE_SPACE}GB available"
fi

# Test API endpoints
echo -e "\n🌐 Testing API endpoints..."
if curl -s -f "http://localhost:8889/public/status" > /dev/null 2>&1; then
    echo "✅ Orchestrator API responding"
else
    echo "⚠️  Orchestrator API not responding (may be stopped)"
fi

if curl -s -f "http://localhost:8888/search?q=test&format=json" > /dev/null 2>&1; then
    echo "✅ SearXNG API responding"
else
    echo "⚠️  SearXNG API not responding (may be stopped)"
fi

# Summary
echo -e "\n=== 📋 SAFETY CHECK SUMMARY ==="
echo "✅ Critical directories verified"
echo "✅ Backup available"
echo "✅ Sufficient disk space"
echo "⚠️  Remember to restart services after consolidation"

echo -e "\n🚦 Safe to proceed with consolidation!"