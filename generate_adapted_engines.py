#!/usr/bin/env python3
"""
Generate SearXNG-compatible versions of custom music engines
"""

import os
import sys
from pathlib import Path

# Template for adapted engines
ENGINE_TEMPLATE = '''# SPDX-License-Identifier: AGPL-3.0-or-later
"""
{engine_name} music search engine - SearXNG adapted version
Auto-generated from custom 2SEARX2COOL engine
"""

# Standard imports
from urllib.parse import urlencode, quote_plus
from lxml import html
from searx.utils import extract_text, eval_xpath
from datetime import datetime
import json
import re

# Engine metadata
about = {{
    "website": "{website}",
    "wikidata_id": None,
    "official_api_documentation": None,
    "use_official_api": False,
    "require_api_key": False,
    "results": "HTML",
}}

categories = ['music']
paging = True
time_range_support = False

# URL mappings
base_url = "{base_url}"
search_url = base_url + "{search_path}"

def request(query, params):
    """Build search request"""
    args = {{
        'q': query,
        'page': params.get('pageno', 1)
    }}
    
    params['url'] = search_url.format(query=quote_plus(query))
    if params.get('pageno', 1) > 1:
        params['url'] += '&page=' + str(params['pageno'])
    
    return params

def response(resp):
    """Parse search response"""
    results = []
    
    # Try JSON parsing first
    try:
        data = json.loads(resp.text)
        if isinstance(data, dict) and 'results' in data:
            for item in data['results']:
                result = parse_result(item)
                if result:
                    results.append(result)
        return results
    except:
        pass
    
    # Fallback to HTML parsing
    try:
        dom = html.fromstring(resp.text)
        # Generic selectors - will need customization per engine
        for item in dom.xpath('//div[@class="result"]'):
            result = {{
                'url': extract_text(eval_xpath(item, './/a/@href')),
                'title': extract_text(eval_xpath(item, './/h3')),
                'content': extract_text(eval_xpath(item, './/p')),
                'template': 'music.html',
            }}
            
            # Extract music-specific fields
            artist = extract_text(eval_xpath(item, './/*[@class="artist"]'))
            if artist:
                result['artist'] = artist
                
            results.append(result)
    except Exception as e:
        pass
    
    return results

def parse_result(item):
    """Parse a single result item"""
    try:
        result = {{
            'url': item.get('url', ''),
            'title': item.get('title', ''),
            'content': item.get('description', ''),
            'template': 'music.html',
        }}
        
        # Map custom fields to SearXNG format
        if 'artist' in item:
            result['artist'] = item['artist']
        if 'album' in item:
            result['album'] = item['album']
        if 'duration' in item:
            result['duration'] = item['duration']
        if 'thumbnail' in item:
            result['img_src'] = item['thumbnail']
            
        return result
    except:
        return None
'''

# Engine configurations
ENGINE_CONFIGS = {
    'beatport': {
        'website': 'https://www.beatport.com',
        'base_url': 'https://www.beatport.com',
        'search_path': '/search?q={query}',
    },
    'discogs_music': {
        'website': 'https://www.discogs.com',
        'base_url': 'https://api.discogs.com',
        'search_path': '/database/search?q={query}&type=release',
    },
    'lastfm': {
        'website': 'https://www.last.fm',
        'base_url': 'https://www.last.fm',
        'search_path': '/search?q={query}',
    },
    'musicbrainz': {
        'website': 'https://musicbrainz.org',
        'base_url': 'https://musicbrainz.org',
        'search_path': '/ws/2/release/?query={query}&fmt=json',
    },
    'allmusic': {
        'website': 'https://www.allmusic.com',
        'base_url': 'https://www.allmusic.com',
        'search_path': '/search/all/{query}',
    },
    'apple_music_web': {
        'website': 'https://music.apple.com',
        'base_url': 'https://music.apple.com',
        'search_path': '/search?term={query}',
    },
    'spotify_web': {
        'website': 'https://open.spotify.com',
        'base_url': 'https://open.spotify.com',
        'search_path': '/search/{query}',
    },
    'youtube_music': {
        'website': 'https://music.youtube.com',
        'base_url': 'https://music.youtube.com',
        'search_path': '/search?q={query}',
    },
    'soundcloud_enhanced': {
        'website': 'https://soundcloud.com',
        'base_url': 'https://api-v2.soundcloud.com',
        'search_path': '/search?q={query}',
    },
    'bandcamp_enhanced': {
        'website': 'https://bandcamp.com',
        'base_url': 'https://bandcamp.com',
        'search_path': '/search?q={query}',
    },
    'tidal_web': {
        'website': 'https://tidal.com',
        'base_url': 'https://tidal.com',
        'search_path': '/search?q={query}',
    },
    'deezer': {
        'website': 'https://www.deezer.com',
        'base_url': 'https://www.deezer.com',
        'search_path': '/search/{query}',
    },
}

def generate_adapted_engines():
    """Generate adapted versions of all music engines"""
    output_dir = Path('/home/mik/SEARXNG/2SEARX2COOL-FINAL-INTEGRATED/adapted_engines')
    output_dir.mkdir(exist_ok=True)
    
    generated = []
    
    for engine_name, config in ENGINE_CONFIGS.items():
        try:
            # Generate engine code
            engine_code = ENGINE_TEMPLATE.format(
                engine_name=engine_name.replace('_', ' ').title(),
                website=config['website'],
                base_url=config['base_url'],
                search_path=config['search_path'],
            )
            
            # Write to file
            output_file = output_dir / f"{engine_name}_adapted.py"
            with open(output_file, 'w') as f:
                f.write(engine_code)
            
            generated.append(engine_name)
            print(f"✅ Generated adapted engine: {engine_name}")
            
        except Exception as e:
            print(f"❌ Failed to generate {engine_name}: {e}")
    
    print(f"\n🎉 Generated {len(generated)} adapted engines in {output_dir}")
    return generated

if __name__ == "__main__":
    generate_adapted_engines()