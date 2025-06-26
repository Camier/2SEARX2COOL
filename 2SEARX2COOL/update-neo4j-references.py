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
