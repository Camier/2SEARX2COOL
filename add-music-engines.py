#!/usr/bin/env python3
"""
Add music engines to searxng-settings.yml
"""

import yaml
import os
import sys

# List of music engines to add
MUSIC_ENGINES = [
    {"name": "bandcamp", "engine": "bandcamp", "shortcut": "bc", "timeout": 5.0},
    {"name": "beatport", "engine": "beatport", "shortcut": "bp", "timeout": 5.0},
    {"name": "discogs", "engine": "discogs", "shortcut": "dc", "timeout": 5.0},
    {"name": "hypem", "engine": "hypem", "shortcut": "hm", "timeout": 5.0},
    {"name": "junodownload", "engine": "junodownload", "shortcut": "jd", "timeout": 5.0},
    {"name": "lastfm", "engine": "lastfm", "shortcut": "lf", "timeout": 5.0},
    {"name": "musicbrainz", "engine": "musicbrainz", "shortcut": "mb", "timeout": 5.0},
    {"name": "rateyourmusic", "engine": "rateyourmusic", "shortcut": "rym", "timeout": 5.0},
    {"name": "resident_advisor", "engine": "resident_advisor", "shortcut": "ra", "timeout": 5.0},
    {"name": "soulseek", "engine": "soulseek", "shortcut": "ss", "timeout": 5.0},
    {"name": "traxsource", "engine": "traxsource", "shortcut": "ts", "timeout": 5.0},
    {"name": "deezer", "engine": "deezer", "shortcut": "dz", "timeout": 5.0},
    {"name": "genius", "engine": "genius", "shortcut": "gn", "timeout": 5.0},
    {"name": "metal_archives", "engine": "metal_archives", "shortcut": "ma", "timeout": 5.0},
    {"name": "mixcloud", "engine": "mixcloud", "shortcut": "mc", "timeout": 5.0},
    {"name": "pitchfork", "engine": "pitchfork", "shortcut": "pf", "timeout": 5.0},
    {"name": "setlist_fm", "engine": "setlist_fm", "shortcut": "sf", "timeout": 5.0},
    {"name": "songkick", "engine": "songkick", "shortcut": "sk", "timeout": 5.0},
    {"name": "whosampled", "engine": "whosampled", "shortcut": "ws", "timeout": 5.0},
    {"name": "allmusic", "engine": "allmusic", "shortcut": "am", "timeout": 5.0},
    {"name": "apple_music", "engine": "apple_music", "shortcut": "apm", "timeout": 5.0},
    {"name": "jamendo", "engine": "jamendo", "shortcut": "jm", "timeout": 5.0},
    {"name": "musixmatch", "engine": "musixmatch", "shortcut": "mm", "timeout": 5.0},
    {"name": "tidal", "engine": "tidal", "shortcut": "td", "timeout": 5.0},
    {"name": "stereogum", "engine": "stereogum", "shortcut": "sg", "timeout": 5.0},
    {"name": "8tracks", "engine": "8tracks", "shortcut": "8t", "timeout": 5.0},
    {"name": "audiomack", "engine": "audiomack", "shortcut": "aum", "timeout": 5.0},
]

def add_music_engines():
    settings_path = "/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/searxng-settings.yml"
    
    # Read current settings
    with open(settings_path, 'r') as f:
        settings = yaml.safe_load(f)
    
    # Get current engines
    engines = settings.get('engines', [])
    
    # Get list of existing engine names
    existing_names = {e['name'] for e in engines if 'name' in e}
    
    # Add music engines that don't already exist
    added = 0
    for engine in MUSIC_ENGINES:
        if engine['name'] not in existing_names:
            engines.append(engine)
            added += 1
            print(f"✅ Added {engine['name']} engine")
        else:
            print(f"⏭️  {engine['name']} already exists")
    
    # Update settings
    settings['engines'] = engines
    
    # Write back
    with open(settings_path, 'w') as f:
        yaml.dump(settings, f, default_flow_style=False, sort_keys=False)
    
    print(f"\n🎉 Added {added} music engines to settings")
    print(f"📊 Total engines: {len(engines)}")

if __name__ == "__main__":
    add_music_engines()