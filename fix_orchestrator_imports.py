#!/usr/bin/env python3
"""
Fix orchestrator import issues
"""

import os
import re

def fix_imports_in_file(filepath):
    """Fix imports in a single file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace orchestrator imports with relative imports
    original = content
    content = re.sub(r'from orchestrator\.', 'from ', content)
    content = re.sub(r'import orchestrator\.', 'import ', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed imports in {filepath}")
        return True
    return False

def fix_all_imports():
    """Fix imports in all orchestrator files"""
    orchestrator_dir = '/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/orchestrator'
    
    fixed_count = 0
    for root, dirs, files in os.walk(orchestrator_dir):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                if fix_imports_in_file(filepath):
                    fixed_count += 1
    
    print(f"\nFixed imports in {fixed_count} files")

if __name__ == "__main__":
    fix_all_imports()