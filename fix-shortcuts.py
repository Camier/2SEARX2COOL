#!/usr/bin/env python3
"""
Fix duplicate shortcuts in searxng settings
"""

import yaml

def fix_shortcuts():
    settings_path = "/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/searxng-settings.yml"
    
    # Read current settings
    with open(settings_path, 'r') as f:
        settings = yaml.safe_load(f)
    
    engines = settings.get('engines', [])
    
    # Track used shortcuts
    used_shortcuts = {}
    conflicts = []
    
    # First pass - identify conflicts
    for engine in engines:
        shortcut = engine.get('shortcut')
        name = engine.get('name')
        if shortcut:
            if shortcut in used_shortcuts:
                conflicts.append((shortcut, used_shortcuts[shortcut], name))
            else:
                used_shortcuts[shortcut] = name
    
    # Fix conflicts
    shortcut_fixes = {
        # apm conflict (apple maps vs apple_music)
        'apple_music': 'apmu',  # Change apple_music from apm to apmu
        # gl conflict (gitlab vs genius_lyrics)  
        'genius_lyrics': 'gly',  # Change genius_lyrics from gl to gly
        # sp conflict (startpage vs spotify)
        'spotify': 'spfy',  # Change spotify from sp to spfy
    }
    
    # Apply fixes
    for engine in engines:
        name = engine.get('name')
        if name in shortcut_fixes:
            old_shortcut = engine.get('shortcut')
            new_shortcut = shortcut_fixes[name]
            engine['shortcut'] = new_shortcut
            print(f"✅ Fixed {name}: {old_shortcut} → {new_shortcut}")
    
    # Write back
    with open(settings_path, 'w') as f:
        yaml.dump(settings, f, default_flow_style=False, sort_keys=False)
    
    print("\n🎉 Shortcut conflicts resolved!")

if __name__ == "__main__":
    fix_shortcuts()