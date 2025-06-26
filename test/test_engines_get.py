#!/usr/bin/env python3
"""
Test music engines using GET method
"""

import requests
import time
from urllib.parse import urlencode

def test_music_search():
    """Test music search with GET method"""
    print("🎵 Testing Music Search with GET method")
    print("=" * 50)
    
    # Test basic search
    base_url = "http://localhost:8888/search"
    
    # Test 1: Simple music search
    params = {
        'q': 'daft punk',
        'categories': 'music'
    }
    
    url = f"{base_url}?{urlencode(params)}"
    print(f"\n📍 Testing: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            # Count results in HTML
            text = response.text
            result_count = text.count('result result-default')
            engine_count = text.count('class="engine-name"')
            
            print(f"  ✅ Found {result_count} results")
            
            # Extract which engines were used
            if 'id="engines_msg-table"' in text:
                engines_section = text.split('id="engines_msg-table"')[1].split('</table>')[0]
                engines = []
                for line in engines_section.split('\n'):
                    if 'class="engine-name"' in line and '<a href="/stats' in line:
                        engine = line.split('engine=')[1].split('"')[0]
                        engines.append(engine)
                
                print(f"  📊 Engines used: {', '.join(engines)}")
                
                # Check if any music engines were used
                music_engines = ['bandcamp', 'soundcloud', 'deezer', 'genius', 'mixcloud',
                               'beatport', 'lastfm', 'musicbrainz']
                used_music_engines = [e for e in engines if e in music_engines]
                
                if used_music_engines:
                    print(f"  🎵 Music engines active: {', '.join(used_music_engines)}")
                else:
                    print(f"  ⚠️  No music engines were used in this search")
                    
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test 2: Check available engines
    print("\n📍 Checking available engines...")
    url = "http://localhost:8888/stats"
    
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            text = response.text
            
            # Extract music engines from stats page
            print("\n  🎵 Music engines found in stats:")
            for engine in ['bandcamp', 'soundcloud', 'deezer', 'genius', 'mixcloud',
                          'beatport', 'discogs_music', 'lastfm', 'musicbrainz',
                          'spotify_web', 'apple_music_web']:
                if engine in text:
                    # Check if engine is enabled
                    if f'>{engine}<' in text:
                        # Try to find if it's disabled
                        section = text.split(f'>{engine}<')[0][-200:]  # Look back 200 chars
                        if 'disabled' in section.lower():
                            print(f"    ⚠️  {engine} - found but may be disabled")
                        else:
                            print(f"    ✅ {engine} - available")
                    else:
                        print(f"    ❓ {engine} - status unclear")
    except Exception as e:
        print(f"  ❌ Cannot access stats: {e}")

    # Test 3: Direct engine test
    print("\n📍 Testing specific music engine searches...")
    
    test_queries = [
        ('bandcamp', 'electronic music'),
        ('beatport', 'techno'),
        ('lastfm', 'rock music'),
        ('musicbrainz', 'jazz')
    ]
    
    for engine, query in test_queries:
        params = {
            'q': query,
            'engines': engine
        }
        url = f"{base_url}?{urlencode(params)}"
        
        try:
            print(f"\n  Testing {engine} with '{query}'...")
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                result_count = response.text.count('result result-default')
                if result_count > 0:
                    print(f"    ✅ {result_count} results")
                else:
                    print(f"    ⚠️  No results")
            else:
                print(f"    ❌ HTTP {response.status_code}")
                
        except Exception as e:
            print(f"    ❌ Error: {e}")

if __name__ == "__main__":
    test_music_search()