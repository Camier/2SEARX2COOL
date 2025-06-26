# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Musicbrainz music search engine - SearXNG adapted version
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
about = {
    "website": "https://musicbrainz.org",
    "wikidata_id": None,
    "official_api_documentation": None,
    "use_official_api": False,
    "require_api_key": False,
    "results": "HTML",
}

categories = ['music']
paging = True
time_range_support = False

# URL mappings
base_url = "https://musicbrainz.org"
search_url = base_url + "/ws/2/release/?query={query}&fmt=json"

def request(query, params):
    """Build search request"""
    args = {
        'q': query,
        'page': params.get('pageno', 1)
    }
    
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
            result = {
                'url': extract_text(eval_xpath(item, './/a/@href')),
                'title': extract_text(eval_xpath(item, './/h3')),
                'content': extract_text(eval_xpath(item, './/p')),
                'template': 'music.html',
            }
            
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
        result = {
            'url': item.get('url', ''),
            'title': item.get('title', ''),
            'content': item.get('description', ''),
            'template': 'music.html',
        }
        
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
