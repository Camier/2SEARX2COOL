#!/usr/bin/env python3
"""
Fix music engine names in searxng-settings.yml to match actual engine files
"""

import yaml
import os

# Mapping of incorrect names to correct names based on our actual engine files
ENGINE_NAME_FIXES = {
    "beatport": "beatport",  # correct
    "discogs": "discogs_music",  # was discogs, should be discogs_music
    "hypem": None,  # we don't have this
    "junodownload": None,  # we don't have this
    "lastfm": "lastfm",  # correct
    "musicbrainz": "musicbrainz",  # correct
    "rateyourmusic": None,  # we don't have this
    "resident_advisor": None,  # we don't have this
    "soulseek": None,  # we don't have this
    "traxsource": None,  # we don't have this
    "metal_archives": None,  # we don't have this
    "pitchfork": "pitchfork",  # correct
    "setlist_fm": None,  # we don't have this
    "songkick": None,  # we don't have this
    "whosampled": None,  # we don't have this
    "allmusic": "allmusic",  # correct
    "apple_music": "apple_music_web",  # was apple_music, should be apple_music_web
    "jamendo": "jamendo_music",  # was jamendo, should be jamendo_music
    "musixmatch": "musixmatch",  # correct
    "tidal": "tidal_web",  # was tidal, should be tidal_web
    "stereogum": None,  # we don't have this
    "8tracks": None,  # we don't have this
    "audiomack": None,  # we don't have this
}

# Additional engines we have that weren't in the list
ADDITIONAL_ENGINES = [
    {"name": "bandcamp_enhanced", "engine": "bandcamp_enhanced", "shortcut": "bce", "timeout": 5.0},
    {"name": "free_music_archive", "engine": "free_music_archive", "shortcut": "fma", "timeout": 5.0},
    {"name": "genius_lyrics", "engine": "genius_lyrics", "shortcut": "gl", "timeout": 5.0},
    {"name": "mixcloud_enhanced", "engine": "mixcloud_enhanced", "shortcut": "mce", "timeout": 5.0},
    {"name": "musictoscrape", "engine": "musictoscrape", "shortcut": "mts", "timeout": 5.0},
    {"name": "radio_paradise", "engine": "radio_paradise", "shortcut": "rp", "timeout": 5.0},
    {"name": "soundcloud_enhanced", "engine": "soundcloud_enhanced", "shortcut": "sce", "timeout": 5.0},
    {"name": "spotify", "engine": "spotify", "shortcut": "sp", "timeout": 5.0},
    {"name": "spotify_web", "engine": "spotify_web", "shortcut": "spw", "timeout": 5.0},
    {"name": "youtube_music", "engine": "youtube_music", "shortcut": "ytm", "timeout": 5.0},
    {"name": "yandex_music", "engine": "yandex_music", "shortcut": "ym", "timeout": 5.0},
]

def fix_music_engines():
    settings_path = "/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/searxng-settings.yml"
    
    # Read current settings
    with open(settings_path, 'r') as f:
        settings = yaml.safe_load(f)
    
    # Get current engines
    engines = settings.get('engines', [])
    
    # Remove engines that don't exist and fix names
    fixed_engines = []
    removed = 0
    fixed = 0
    
    for engine in engines:
        engine_name = engine.get('name', '')
        
        # Check if it's one of our music engines that needs fixing
        if engine_name in ENGINE_NAME_FIXES:
            correct_name = ENGINE_NAME_FIXES[engine_name]
            if correct_name is None:
                # Remove engines we don't have
                removed += 1
                print(f"❌ Removed {engine_name} (engine file doesn't exist)")
                continue
            elif correct_name != engine_name:
                # Fix the engine name
                engine['engine'] = correct_name
                fixed += 1
                print(f"✅ Fixed {engine_name} → {correct_name}")
        
        fixed_engines.append(engine)
    
    # Add additional engines we have
    existing_names = {e['name'] for e in fixed_engines}
    added = 0
    
    for engine in ADDITIONAL_ENGINES:
        if engine['name'] not in existing_names:
            fixed_engines.append(engine)
            added += 1
            print(f"✅ Added {engine['name']} engine")
    
    # Update settings
    settings['engines'] = fixed_engines
    
    # Write back
    with open(settings_path, 'w') as f:
        yaml.dump(settings, f, default_flow_style=False, sort_keys=False)
    
    print(f"\n🎉 Summary:")
    print(f"  - Removed {removed} non-existent engines")
    print(f"  - Fixed {fixed} engine names")
    print(f"  - Added {added} additional engines")
    print(f"  - Total engines: {len(fixed_engines)}")

if __name__ == "__main__":
    fix_music_engines()