#!/bin/bash
# Fix imports in music engines

ENGINES_DIR="/home/mik/SEARXNG/searxng-wttr/searx/engines"

echo "Fixing imports in music engines..."

# Fix all relative imports to use base_music
for file in "$ENGINES_DIR"/*.py; do
    if [[ -f "$file" && "$(basename "$file")" != "__init__.py" && "$(basename "$file")" != "base_music.py" ]]; then
        # Check if file has the problematic import
        if grep -q "from \.base import" "$file"; then
            echo "Fixing imports in $(basename "$file")"
            sed -i 's/from \.base import/from searx.engines.base_music import/g' "$file"
        fi
    fi
done

# Also check for any files that might use "from base import"
for file in "$ENGINES_DIR"/*.py; do
    if [[ -f "$file" && "$(basename "$file")" != "__init__.py" && "$(basename "$file")" != "base_music.py" ]]; then
        if grep -q "^from base import" "$file"; then
            echo "Fixing absolute imports in $(basename "$file")"
            sed -i 's/^from base import/from searx.engines.base_music import/g' "$file"
        fi
    fi
done

echo "Import fixes complete!"