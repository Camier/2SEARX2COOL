"""
Search Moods Plugin for Searxng
Context-aware themes and search adjustments based on mood
"""

import json
import random
from datetime import datetime, time
from typing import Dict, List, Optional, Tuple
from searx import settings
from searx.plugins import logger

name = "Search Moods"
description = "Set the vibe for your search session"
default_on = True

# Plugin settings
preference_section = 'convivial'
preferences = {
    'default_mood': 'neutral',
    'auto_mood': True,  # Auto-detect mood based on time/query
    'mood_duration': 3600  # Mood persists for 1 hour
}

# Mood definitions
MOODS = {
    'late-night': {
        'name': '🌙 Late night rabbit hole',
        'description': 'Deep dives and weird finds',
        'time_range': (22, 4),  # 10pm - 4am
        'boost_engines': ['wikipedia', 'arxiv', 'archive.org'],
        'keywords': ['weird', 'strange', 'theory', 'conspiracy', 'ancient'],
        'theme': {
            'background': '#1a1a2e',
            'primary': '#e94560',
            'text': '#eaeaea'
        }
    },
    'botanical': {
        'name': '🌺 Sunday morning botanical',
        'description': 'Nature, plants, and peaceful discoveries',
        'time_range': (6, 11),  # 6am - 11am on Sunday
        'boost_engines': ['gbif', 'plants_of_world', 'inaturalist'],
        'keywords': ['plant', 'flower', 'garden', 'nature', 'botanical'],
        'theme': {
            'background': '#f7ede2',
            'primary': '#52734d',
            'text': '#2d2d2d'
        }
    },
    'vinyl-digging': {
        'name': '🎵 Vinyl digging simulation',
        'description': 'Crate digging for musical gems',
        'boost_engines': ['bandcamp', 'soundcloud', 'discogs'],
        'keywords': ['vinyl', 'album', 'band', 'music', 'jazz', 'funk'],
        'theme': {
            'background': '#2b2b2b',
            'primary': '#ff6b6b',
            'text': '#fafafa'
        }
    },
    'serious-research': {
        'name': '📚 Serious research mode',
        'description': 'Academic focus, minimal distractions',
        'boost_engines': ['google_scholar', 'pubmed', 'semantic_scholar'],
        'keywords': ['research', 'study', 'analysis', 'thesis', 'paper'],
        'theme': {
            'background': '#fafafa',
            'primary': '#2c3e50',
            'text': '#2c3e50'
        }
    },
    'weird-finds': {
        'name': '🍄 Weird finds only',
        'description': 'Embrace the strange and unusual',
        'boost_engines': ['archive.org', 'wiby'],
        'keywords': ['weird', 'unusual', 'bizarre', 'odd', 'strange'],
        'theme': {
            'background': '#6a0572',
            'primary': '#ff6b9d',
            'text': '#ffc8dd'
        }
    },
    'historical': {
        'name': '🗺️ Historical adventures',
        'description': 'Journey through time',
        'boost_engines': ['gallica', 'archives_nationales', 'europeana'],
        'keywords': ['history', 'ancient', 'medieval', 'archive', 'old'],
        'theme': {
            'background': '#f5e6d3',
            'primary': '#8b4513',
            'text': '#3a2317'
        }
    },
    'deep-science': {
        'name': '🔬 Deep science dive',
        'description': 'Complex topics, detailed results',
        'boost_engines': ['arxiv', 'pubmed', 'chembl'],
        'keywords': ['quantum', 'biology', 'chemistry', 'physics', 'research'],
        'theme': {
            'background': '#0a0e27',
            'primary': '#00d9ff',
            'text': '#e0e0e0'
        }
    },
    'chaos': {
        'name': '🎪 Anything goes chaos mode',
        'description': 'Random engines, surprising results',
        'randomize_engines': True,
        'keywords': ['random', 'surprise', 'anything', 'chaos'],
        'theme': {
            'background': 'linear-gradient(45deg, #ff006e, #8338ec, #3a86ff)',
            'primary': '#ffbe0b',
            'text': '#ffffff'
        }
    }
}

def on_request(request, search):
    """Apply mood before search"""
    # Get or detect mood
    mood = get_current_mood(request, search)
    
    if mood and mood in MOODS:
        # Apply mood effects
        apply_mood_settings(request, search, mood)
        
        # Store mood in request for UI
        request.form['current_mood'] = mood
        request.form['mood_data'] = MOODS[mood]
    
    return True

def get_current_mood(request, search) -> Optional[str]:
    """Determine current mood based on various factors"""
    # Check if mood explicitly set
    if 'mood' in request.form:
        return request.form['mood']
    
    # Check session mood
    if hasattr(request, 'session') and 'mood' in request.session:
        mood_data = request.session['mood']
        if mood_data.get('expires', 0) > datetime.now().timestamp():
            return mood_data.get('mood')
    
    # Auto-detect mood if enabled
    if settings.get('convivial', {}).get('auto_mood', True):
        # Check query keywords
        query = search.search_query.query.lower()
        for mood_id, mood_config in MOODS.items():
            if any(kw in query for kw in mood_config.get('keywords', [])):
                return mood_id
        
        # Check time-based moods
        current_hour = datetime.now().hour
        current_day = datetime.now().weekday()
        
        for mood_id, mood_config in MOODS.items():
            time_range = mood_config.get('time_range')
            if time_range:
                start, end = time_range
                if start <= current_hour < end or (start > end and (current_hour >= start or current_hour < end)):
                    # Special case for Sunday botanical
                    if mood_id == 'botanical' and current_day != 6:  # Not Sunday
                        continue
                    return mood_id
    
    return None

def apply_mood_settings(request, search, mood: str):
    """Apply mood-specific search modifications"""
    mood_config = MOODS.get(mood, {})
    
    # Boost specific engines
    if 'boost_engines' in mood_config:
        boost_engines = mood_config['boost_engines']
        # This would integrate with Searxng's engine weighting
        # For now, we'll add a preference hint
        search.search_query.engineref_list = boost_engines + search.search_query.engineref_list
    
    # Randomize engines for chaos mode
    if mood_config.get('randomize_engines'):
        engines = list(search.search_query.engines.keys())
        random.shuffle(engines)
        search.search_query.engines = {e: search.search_query.engines[e] for e in engines[:5]}
    
    # Add mood to search metadata
    if not hasattr(search, 'metadata'):
        search.metadata = {}
    search.metadata['mood'] = mood
    search.metadata['mood_name'] = mood_config.get('name', mood)

def set_mood(request, mood: str, duration: Optional[int] = None):
    """Explicitly set a mood"""
    if mood not in MOODS:
        return False
    
    duration = duration or settings.get('convivial', {}).get('mood_duration', 3600)
    
    if hasattr(request, 'session'):
        request.session['mood'] = {
            'mood': mood,
            'set_at': datetime.now().timestamp(),
            'expires': datetime.now().timestamp() + duration
        }
    
    # Broadcast mood change
    try:
        import redis
        r = redis.Redis(
            host=settings.get('redis', {}).get('pubsub_host', 'redis-pubsub'),
            port=6380,
            decode_responses=True
        )
        r.publish('mood:changed', json.dumps({
            'user': getattr(request, 'user', {}).get('username', 'anonymous'),
            'mood': mood,
            'mood_name': MOODS[mood]['name']
        }))
    except:
        pass
    
    return True

def get_mood_suggestions(query: str) -> List[Dict]:
    """Suggest moods based on search query"""
    suggestions = []
    query_lower = query.lower()
    
    for mood_id, mood_config in MOODS.items():
        score = 0
        
        # Keyword matching
        keywords = mood_config.get('keywords', [])
        matches = sum(1 for kw in keywords if kw in query_lower)
        if matches > 0:
            score = matches / len(keywords)
        
        # Time relevance
        time_range = mood_config.get('time_range')
        if time_range:
            current_hour = datetime.now().hour
            start, end = time_range
            if start <= current_hour < end or (start > end and (current_hour >= start or current_hour < end)):
                score += 0.3
        
        if score > 0:
            suggestions.append({
                'mood': mood_id,
                'name': mood_config['name'],
                'description': mood_config['description'],
                'score': score
            })
    
    # Sort by score
    suggestions.sort(key=lambda x: x['score'], reverse=True)
    return suggestions[:3]  # Top 3 suggestions

def get_mood_stats() -> Dict:
    """Get statistics about mood usage"""
    try:
        import redis
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # Connect to PostgreSQL
        pg_config = settings.get('postgres', {})
        conn = psycopg2.connect(
            host=pg_config.get('host', 'postgres'),
            database=pg_config.get('database', 'searxng_convivial'),
            user=pg_config.get('user', 'searxng'),
            password=pg_config.get('password'),
            cursor_factory=RealDictCursor
        )
        
        with conn.cursor() as cursor:
            # Get mood usage from search sessions
            cursor.execute("""
                SELECT 
                    mood,
                    COUNT(*) as usage_count,
                    COUNT(DISTINCT user_id) as unique_users
                FROM search_sessions
                WHERE mood IS NOT NULL
                AND session_start > NOW() - INTERVAL '7 days'
                GROUP BY mood
                ORDER BY usage_count DESC
            """)
            
            mood_usage = cursor.fetchall()
            
            # Get time distribution
            cursor.execute("""
                SELECT 
                    EXTRACT(HOUR FROM session_start) as hour,
                    mood,
                    COUNT(*) as count
                FROM search_sessions
                WHERE mood IS NOT NULL
                AND session_start > NOW() - INTERVAL '24 hours'
                GROUP BY hour, mood
                ORDER BY hour
            """)
            
            time_distribution = cursor.fetchall()
        
        return {
            'usage': mood_usage,
            'time_distribution': time_distribution,
            'available_moods': list(MOODS.keys())
        }
        
    except Exception as e:
        logger.error(f"Failed to get mood stats: {e}")
        return {'error': str(e)}

# UI Helper Functions
def get_mood_selector_html(current_mood: Optional[str] = None) -> str:
    """Generate HTML for mood selector widget"""
    html = ['<div class="mood-selector">']
    html.append('<div class="mood-current">')
    
    if current_mood and current_mood in MOODS:
        mood_data = MOODS[current_mood]
        html.append(f'<span class="mood-emoji">{mood_data["name"].split()[0]}</span>')
        html.append(f'<span class="mood-name">{mood_data["name"][2:]}</span>')
    else:
        html.append('<span class="mood-emoji">😊</span>')
        html.append('<span class="mood-name">Choose your vibe</span>')
    
    html.append('</div>')
    html.append('<div class="mood-dropdown" style="display:none;">')
    
    for mood_id, mood_data in MOODS.items():
        active = 'active' if mood_id == current_mood else ''
        html.append(f'''
            <div class="mood-option {active}" data-mood="{mood_id}">
                <span class="mood-emoji">{mood_data["name"].split()[0]}</span>
                <div class="mood-details">
                    <div class="mood-name">{mood_data["name"][2:]}</div>
                    <div class="mood-desc">{mood_data["description"]}</div>
                </div>
            </div>
        ''')
    
    html.append('</div>')
    html.append('</div>')
    
    return '\n'.join(html)

def get_mood_css(mood: str) -> str:
    """Generate CSS variables for current mood"""
    if mood not in MOODS:
        return ''
    
    theme = MOODS[mood].get('theme', {})
    css = [':root {']
    
    for key, value in theme.items():
        css.append(f'  --convivial-{key}: {value};')
    
    css.append('}')
    css.append(f'body {{ data-mood: "{mood}"; }}')
    
    return '\n'.join(css)