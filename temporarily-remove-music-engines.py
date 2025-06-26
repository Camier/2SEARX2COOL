#!/usr/bin/env python3
"""
Temporarily remove all custom music engines to get SearXNG running
"""

import yaml

def remove_music_engines():
    settings_path = "/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/config/searxng-settings.yml"
    
    # Read current settings
    with open(settings_path, 'r') as f:
        settings = yaml.safe_load(f)
    
    engines = settings.get('engines', [])
    
    # Music engines to remove temporarily
    music_engines = [
        'beatport', 'discogs', 'lastfm', 'musicbrainz', 'pitchfork',
        'allmusic', 'apple_music', 'jamendo', 'musixmatch', 'tidal',
        'bandcamp_enhanced', 'free_music_archive', 'genius_lyrics',
        'mixcloud_enhanced', 'musictoscrape', 'radio_paradise',
        'soundcloud_enhanced', 'spotify', 'spotify_web', 'youtube_music',
        'yandex_music'
    ]
    
    # Filter out music engines
    filtered_engines = []
    removed_count = 0
    
    for engine in engines:
        name = engine.get('name')
        if name not in music_engines:
            filtered_engines.append(engine)
        else:
            removed_count += 1
            print(f"❌ Temporarily removed {name}")
    
    # Update settings
    settings['engines'] = filtered_engines
    
    # Write back
    with open(settings_path, 'w') as f:
        yaml.dump(settings, f, default_flow_style=False, sort_keys=False)
    
    print(f"\n🎉 Temporarily removed {removed_count} music engines")
    print("📝 SearXNG should now start. We'll add them back once it's running.")

if __name__ == "__main__":
    remove_music_engines()