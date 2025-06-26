#!/bin/bash
# Pre-consolidation analysis script

echo "=== 2SEARX2COOL Consolidation Analysis ==="
echo ""

# Check for nested duplicate
if [ -d "2SEARX2COOL-FINAL-INTEGRATED" ]; then
    echo "⚠️  CRITICAL: Found nested duplicate directory!"
    echo "   Size: $(du -sh 2SEARX2COOL-FINAL-INTEGRATED 2>/dev/null | cut -f1)"
fi

# Count startup scripts
echo ""
echo "📄 Redundant startup scripts found:"
ls -1 start-*.sh fix-*.sh run_*.sh 2>/dev/null | wc -l

# Count log files
echo ""
echo "📊 Log files in root directory:"
ls -1 *.log 2>/dev/null | wc -l

# Count test files
echo ""
echo "🧪 Test files in root directory:"
ls -1 test_*.py 2>/dev/null | wc -l

# Count documentation files
echo ""
echo "📚 Documentation files in root:"
ls -1 *.md 2>/dev/null | wc -l

# Check legacy directories
echo ""
echo "📁 Legacy directories found:"
for dir in searxng-migration-backup searxng-convivial SEARXTHEME adapted_engines; do
    [ -d "$dir" ] && echo "   - $dir ($(du -sh "$dir" 2>/dev/null | cut -f1))"
done

# Total size before consolidation
echo ""
echo "💾 Total project size: $(du -sh . 2>/dev/null | cut -f1)"
echo ""
echo "Estimated savings: 40-60% after consolidation"