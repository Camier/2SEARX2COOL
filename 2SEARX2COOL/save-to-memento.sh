#!/bin/bash
# Save 2SEARX2COOL project info to Memento

echo "Saving 2SEARX2COOL to knowledge base..."

# Use the qsave alias if available
if command -v qsave &> /dev/null; then
    qsave "2SEARX2COOL - Consolidated music search platform at /home/mik/SEARXNG/2SEARX2COOL with 27 custom engines, Flask orchestrator with WebSocket support for 10k+ connections. Replaces all previous searxng-cool versions."
    echo "✓ Saved to Memento via qsave"
else
    echo "qsave command not found. Manual entry needed."
    echo ""
    echo "Project info to save:"
    echo "Name: 2SEARX2COOL"
    echo "Location: /home/mik/SEARXNG/2SEARX2COOL"
    echo "Description: Consolidated music search platform with 27 engines"
    echo "Replaces: searxng-cool, searxng-cool-old, searxng-cool-complete"
fi