#!/usr/bin/env python3
"""
Fix JWT authentication to allow development access
Updates API routes to use conditional JWT
"""

import os
import re

def update_jwt_imports(content):
    """Update imports to include conditional JWT"""
    # Replace jwt_required import
    content = re.sub(
        r'from flask_jwt_extended import jwt_required',
        'from flask_jwt_extended import jwt_required as flask_jwt_required\nfrom jwt_config import conditional_jwt_required as jwt_required',
        content
    )
    return content

def process_file(filepath):
    """Process a single file to update JWT"""
    print(f"Processing {filepath}...")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Update imports
    if 'from flask_jwt_extended import jwt_required' in content:
        content = update_jwt_imports(content)
    
    # Write back if changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"✅ Updated {filepath}")
    else:
        print(f"⏭️  No changes needed for {filepath}")

def main():
    """Update JWT in API routes"""
    print("🔧 Updating JWT authentication for development mode...")
    
    # API routes that need updating
    api_files = [
        'orchestrator/blueprints/api/routes.py',
        'orchestrator/blueprints/api/music_routes.py',
        'orchestrator/blueprints/api/music_aggregation_routes.py'
    ]
    
    for filepath in api_files:
        if os.path.exists(filepath):
            process_file(filepath)
    
    print("\n✅ JWT authentication updated for development mode")
    print("ℹ️  API endpoints will now work without authentication when DEBUG=true")

if __name__ == "__main__":
    main()