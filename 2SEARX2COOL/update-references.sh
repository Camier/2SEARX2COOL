#!/bin/bash
# Update references from old searxng-cool to 2SEARX2COOL

echo "=== Updating References to 2SEARX2COOL ==="
echo ""

# Update any config files that might reference the old path
echo "1. Updating configuration files..."

# Update orchestrator config if it has path references
if [ -f "orchestrator/config_loader.py" ]; then
    echo "   - Updating orchestrator config loader"
    sed -i 's|searxng-cool|2SEARX2COOL|g' orchestrator/config_loader.py
fi

# Update any scripts that reference the old directory
echo "2. Updating scripts..."
find scripts -type f -name "*.sh" -exec sed -i 's|searxng-cool|2SEARX2COOL|g' {} \;
find scripts -type f -name "*.py" -exec sed -i 's|searxng-cool|2SEARX2COOL|g' {} \;

# Update deployment scripts
echo "3. Updating deployment configurations..."
if [ -f "config/searxng-cool.service" ]; then
    mv config/searxng-cool.service config/2searx2cool.service
    sed -i 's|searxng-cool|2SEARX2COOL|g' config/2searx2cool.service
fi

# Update nginx configs
echo "4. Updating nginx configurations..."
for conf in config/nginx*.conf; do
    if [ -f "$conf" ]; then
        sed -i 's|searxng-cool|2SEARX2COOL|g' "$conf"
    fi
done

# Create a Neo4j update script
echo "5. Creating Neo4j update script..."
cat > update-neo4j-references.py << 'EOF'
#!/usr/bin/env python3
"""Update Neo4j/Memento references to use 2SEARX2COOL"""

import os
from datetime import datetime

# Create a memento-compatible knowledge entry
knowledge_entry = {
    "project": "2SEARX2COOL",
    "type": "migration",
    "timestamp": datetime.now().isoformat(),
    "description": "Consolidated SearXNG music search platform",
    "location": "/home/mik/SEARXNG/2SEARX2COOL",
    "replaces": [
        "searxng-cool",
        "searxng-cool-old", 
        "searxng-cool-complete",
        "searxng-cool-restored"
    ],
    "features": {
        "engines": 27,
        "architecture": "multi-tier",
        "performance": "10k+ concurrent connections",
        "components": ["orchestrator", "engines", "music", "config", "scripts", "docs", "tests"]
    }
}

# Save to a JSON file that can be imported
import json
with open("2SEARX2COOL-knowledge.json", "w") as f:
    json.dump(knowledge_entry, f, indent=2)

print("Created 2SEARX2COOL-knowledge.json for knowledge base import")
EOF

chmod +x update-neo4j-references.py
python3 update-neo4j-references.py

# Update any remaining references in config files
echo "6. Final sweep for remaining references..."
grep -r "searxng-cool" config/ 2>/dev/null | grep -v "2SEARX2COOL" || echo "   ✓ No remaining old references in config"
grep -r "searxng-cool" orchestrator/ 2>/dev/null | grep -v "2SEARX2COOL" || echo "   ✓ No remaining old references in orchestrator"

echo ""
echo "=== Update Complete ==="
echo "✓ Configuration files updated"
echo "✓ Scripts updated"
echo "✓ Service files renamed"
echo "✓ Knowledge base entry created"
echo ""
echo "Note: To update Neo4j/Memento, you may need to:"
echo "1. Restart memento service"
echo "2. Import the 2SEARX2COOL-knowledge.json"
echo "3. Update any external references"