#!/usr/bin/env python3
"""
Simple test for music engines in SearXNG
"""

import requests
import json
import time

def test_music_engine(engine_name: str, query: str = "daft punk"):
    """Test a single music engine"""
    print(f"\n🎵 Testing {engine_name}...")
    
    url = "http://localhost:8888/search"
    data = {
        'q': query,
        'categories': 'music',
        'engines': engine_name,
        'format': 'json'
    }
    
    try:
        start = time.time()
        # Use POST method as configured
        response = requests.post(url, data=data, timeout=10)
        elapsed = time.time() - start
        
        if response.status_code == 200:
            # Check if we got JSON or HTML
            content_type = response.headers.get('content-type', '')
            
            if 'json' in content_type:
                results = response.json()
                result_count = len(results.get('results', []))
                print(f"  ✅ Success: {result_count} results in {elapsed:.2f}s")
                
                # Show first result if any
                if result_count > 0:
                    first = results['results'][0]
                    print(f"     Example: {first.get('title', 'No title')}")
            else:
                # Try to parse HTML response for results
                text = response.text
                if 'result result-default' in text:
                    count = text.count('result result-default')
                    print(f"  ⚠️  HTML response but found {count} results in {elapsed:.2f}s")
                else:
                    print(f"  ❌ No results found in {elapsed:.2f}s")
        else:
            print(f"  ❌ HTTP {response.status_code}")
            
    except requests.Timeout:
        print(f"  ❌ Timeout")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def main():
    """Test all music engines"""
    print("🎵 Testing Music Engines in SearXNG")
    print("=" * 50)
    
    # Check if SearXNG is running
    try:
        response = requests.get("http://localhost:8888", timeout=2)
        if response.status_code != 200:
            print("❌ SearXNG is not running on port 8888")
            return
    except:
        print("❌ Cannot connect to SearXNG on port 8888")
        return
    
    print("✅ SearXNG is running\n")
    
    # Test standard music engines first
    print("📀 Testing Standard Music Engines:")
    standard_engines = [
        'bandcamp',
        'soundcloud',
        'deezer',
        'genius',
        'mixcloud'
    ]
    
    for engine in standard_engines:
        test_music_engine(engine)
    
    # Test custom music engines
    print("\n\n🎸 Testing Custom 2SEARX2COOL Music Engines:")
    custom_engines = [
        'beatport',
        'discogs_music',  # Note the underscore warning
        'lastfm',
        'musicbrainz',
        'spotify_web',  # Initially disabled
        'apple_music_web'  # Initially disabled
    ]
    
    for engine in custom_engines:
        test_music_engine(engine)
    
    # Test general music search
    print("\n\n🎼 Testing General Music Category Search:")
    url = "http://localhost:8888/search"
    data = {
        'q': 'electronic music',
        'categories': 'music',
        'format': 'json'
    }
    
    try:
        response = requests.post(url, data=data, timeout=10)
        if 'json' in response.headers.get('content-type', ''):
            results = response.json()
            engines_used = set()
            for result in results.get('results', []):
                if 'engines' in result:
                    engines_used.update(result['engines'])
            print(f"  📊 Engines used: {', '.join(sorted(engines_used))}")
            print(f"  📊 Total results: {len(results.get('results', []))}")
        else:
            print("  ⚠️  Got HTML response instead of JSON")
    except Exception as e:
        print(f"  ❌ Error: {e}")

if __name__ == "__main__":
    main()