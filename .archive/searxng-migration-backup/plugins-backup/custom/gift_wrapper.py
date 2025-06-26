"""
Gift Wrapper Plugin for Searxng
Share discoveries as wrapped gifts with delayed reveals
"""

import asyncio
import json
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from searx import settings
from searx.plugins import logger

name = "Gift Wrapper"
description = "Wrap discoveries as gifts for friends"
default_on = True

# Plugin settings
preference_section = 'convivial'
preferences = {
    'enable_gifting': True,
    'default_reveal_hours': 24,
    'gift_wrap_styles': ['classic', 'birthday', 'mystery', 'seasonal']
}

# Gift wrap themes
GIFT_THEMES = {
    'classic': {
        'emoji': '🎁',
        'colors': ['#e74c3c', '#f39c12', '#2ecc71'],
        'pattern': 'ribbons',
        'message': 'A discovery awaits!'
    },
    'birthday': {
        'emoji': '🎂',
        'colors': ['#ff69b4', '#ffd700', '#87ceeb'],
        'pattern': 'confetti',
        'message': 'Happy discovery day!'
    },
    'mystery': {
        'emoji': '🎭',
        'colors': ['#4a148c', '#311b92', '#1a237e'],
        'pattern': 'question_marks',
        'message': 'Mystery unfolds...'
    },
    'seasonal': {
        'spring': {
            'emoji': '🌸',
            'colors': ['#ffc0cb', '#98fb98', '#e6e6fa'],
            'pattern': 'flowers'
        },
        'summer': {
            'emoji': '☀️',
            'colors': ['#ffd700', '#ff8c00', '#00ced1'],
            'pattern': 'waves'
        },
        'autumn': {
            'emoji': '🍂',
            'colors': ['#ff8c00', '#d2691e', '#8b4513'],
            'pattern': 'leaves'
        },
        'winter': {
            'emoji': '❄️',
            'colors': ['#b0e0e6', '#4682b4', '#191970'],
            'pattern': 'snowflakes'
        }
    }
}

# Connections
redis_cache = None
redis_pubsub = None
pg_pool = None

def init(app):
    """Initialize plugin connections"""
    global redis_cache, redis_pubsub, pg_pool
    
    try:
        redis_cache = redis.Redis(
            host=settings.get('redis', {}).get('cache_host', 'redis-cache'),
            port=6379,
            decode_responses=True
        )
        
        redis_pubsub = redis.Redis(
            host=settings.get('redis', {}).get('pubsub_host', 'redis-pubsub'),
            port=6380,
            decode_responses=True
        )
        
        pg_config = settings.get('postgres', {})
        pg_pool = psycopg2.connect(
            host=pg_config.get('host', 'postgres'),
            database=pg_config.get('database', 'searxng_convivial'),
            user=pg_config.get('user', 'searxng'),
            password=pg_config.get('password'),
            cursor_factory=RealDictCursor
        )
        
        # Schedule gift reveal checker
        asyncio.create_task(_gift_reveal_scheduler())
        
        logger.info("Gift Wrapper plugin initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize Gift Wrapper: {e}")

async def _gift_reveal_scheduler():
    """Background task to reveal gifts when time comes"""
    while True:
        try:
            await _check_and_reveal_gifts()
            await asyncio.sleep(300)  # Check every 5 minutes
        except Exception as e:
            logger.error(f"Gift reveal scheduler error: {e}")
            await asyncio.sleep(60)

async def _check_and_reveal_gifts():
    """Check for gifts ready to be revealed"""
    try:
        with pg_pool.cursor() as cursor:
            # Find gifts ready to reveal
            cursor.execute("""
                SELECT 
                    tc.*,
                    d.result_title,
                    d.result_url,
                    d.result_snippet,
                    u_from.username as from_username,
                    u_to.username as to_username
                FROM time_capsules tc
                JOIN discoveries d ON d.id = tc.discovery_id
                JOIN users u_from ON u_from.id = tc.creator_id
                JOIN users u_to ON u_to.id = tc.recipient_id
                WHERE tc.reveal_at <= NOW()
                AND tc.revealed = FALSE
            """)
            
            gifts_to_reveal = cursor.fetchall()
            
            for gift in gifts_to_reveal:
                # Mark as revealed
                cursor.execute("""
                    UPDATE time_capsules 
                    SET revealed = TRUE 
                    WHERE id = %s
                """, (gift['id'],))
                
                # Create reveal event
                reveal_event = {
                    'type': 'gift_revealed',
                    'gift_id': gift['id'],
                    'from': gift['from_username'],
                    'to': gift['to_username'],
                    'discovery': {
                        'title': gift['result_title'],
                        'url': gift['result_url'],
                        'snippet': gift['result_snippet']
                    },
                    'message': gift['message'],
                    'wrapped_at': gift['created_at'].isoformat(),
                    'revealed_at': datetime.now(timezone.utc).isoformat()
                }
                
                # Notify recipient
                await redis_pubsub.publish(
                    f"gift:revealed:{gift['recipient_id']}",
                    json.dumps(reveal_event)
                )
                
                # Add to recipient's gift inbox
                redis_cache.lpush(
                    f"gifts:inbox:{gift['recipient_id']}",
                    json.dumps(reveal_event)
                )
                redis_cache.ltrim(f"gifts:inbox:{gift['recipient_id']}", 0, 99)  # Keep last 100
                
                logger.info(f"Gift revealed: {gift['id']} from {gift['from_username']} to {gift['to_username']}")
            
            pg_pool.commit()
            
    except Exception as e:
        logger.error(f"Failed to check and reveal gifts: {e}")
        if pg_pool:
            pg_pool.rollback()

def wrap_gift(
    user_id: str,
    discovery_id: str,
    recipient_id: str,
    message: Optional[str] = None,
    reveal_hours: Optional[int] = None,
    theme: Optional[str] = None
) -> Optional[str]:
    """Wrap a discovery as a gift"""
    try:
        reveal_hours = reveal_hours or settings.get('convivial', {}).get('default_reveal_hours', 24)
        reveal_at = datetime.now(timezone.utc) + timedelta(hours=reveal_hours)
        
        # Get theme
        if not theme:
            theme = _get_seasonal_theme() if random.random() > 0.5 else 'classic'
        
        with pg_pool.cursor() as cursor:
            # Create time capsule
            cursor.execute("""
                INSERT INTO time_capsules 
                (creator_id, recipient_id, discovery_id, message, reveal_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (user_id, recipient_id, discovery_id, message, reveal_at))
            
            gift_id = cursor.fetchone()['id']
            
            # Get discovery details for preview
            cursor.execute("""
                SELECT d.*, u.username as from_username
                FROM discoveries d
                JOIN users u ON u.id = d.user_id
                WHERE d.id = %s
            """, (discovery_id,))
            
            discovery = cursor.fetchone()
            
            # Get recipient info
            cursor.execute("""
                SELECT username FROM users WHERE id = %s
            """, (recipient_id,))
            
            recipient = cursor.fetchone()
            
            pg_pool.commit()
            
            # Create wrapped gift object
            wrapped_gift = {
                'id': gift_id,
                'from_id': user_id,
                'from_username': discovery['from_username'],
                'to_id': recipient_id,
                'to_username': recipient['username'],
                'theme': theme,
                'theme_data': _get_theme_data(theme),
                'reveal_at': reveal_at.isoformat(),
                'reveal_in_hours': reveal_hours,
                'teaser': _create_teaser(discovery, message),
                'wrapped_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Cache wrapped gift
            redis_cache.setex(
                f"gift:wrapped:{gift_id}",
                int(reveal_hours * 3600 * 1.1),  # TTL slightly longer than reveal time
                json.dumps(wrapped_gift)
            )
            
            # Notify recipient
            redis_pubsub.publish(
                f"gift:received:{recipient_id}",
                json.dumps({
                    'type': 'new_gift',
                    'gift': wrapped_gift
                })
            )
            
            # Add to pending gifts
            redis_cache.zadd(
                f"gifts:pending:{recipient_id}",
                {gift_id: reveal_at.timestamp()}
            )
            
            return gift_id
            
    except Exception as e:
        logger.error(f"Failed to wrap gift: {e}")
        if pg_pool:
            pg_pool.rollback()
        return None

def _get_seasonal_theme() -> str:
    """Get current seasonal theme"""
    month = datetime.now().month
    if month in [3, 4, 5]:
        return 'seasonal:spring'
    elif month in [6, 7, 8]:
        return 'seasonal:summer'
    elif month in [9, 10, 11]:
        return 'seasonal:autumn'
    else:
        return 'seasonal:winter'

def _get_theme_data(theme: str) -> Dict:
    """Get theme configuration"""
    if ':' in theme:
        main_theme, sub_theme = theme.split(':')
        if main_theme == 'seasonal' and sub_theme in GIFT_THEMES['seasonal']:
            return GIFT_THEMES['seasonal'][sub_theme]
    
    return GIFT_THEMES.get(theme, GIFT_THEMES['classic'])

def _create_teaser(discovery: Dict, message: Optional[str]) -> Dict:
    """Create a teaser for the wrapped gift"""
    teaser = {
        'hint': '',
        'preview': '',
        'excitement_level': random.choice(['!', '!!', '!!!'])
    }
    
    # Create hints based on discovery
    if discovery.get('engine') == 'bandcamp':
        teaser['hint'] = '🎵 Musical discovery'
    elif discovery.get('engine') in ['gallica', 'archives_nationales']:
        teaser['hint'] = '📜 Historical treasure'
    elif discovery.get('engine') in ['gbif', 'plants_of_world']:
        teaser['hint'] = '🌿 Botanical find'
    else:
        teaser['hint'] = '✨ Special discovery'
    
    # Add word count hint
    title_words = len(discovery.get('result_title', '').split())
    teaser['preview'] = f"A {title_words}-word discovery"
    
    # Add custom message teaser if provided
    if message:
        if len(message) > 20:
            teaser['message_preview'] = message[:17] + '...'
        else:
            teaser['message_preview'] = '💌 Personal note attached'
    
    return teaser

def get_pending_gifts(user_id: str) -> List[Dict]:
    """Get all pending gifts for a user"""
    try:
        # Get gift IDs sorted by reveal time
        gift_ids = redis_cache.zrange(f"gifts:pending:{user_id}", 0, -1)
        
        gifts = []
        for gift_id in gift_ids:
            gift_data = redis_cache.get(f"gift:wrapped:{gift_id}")
            if gift_data:
                gift = json.loads(gift_data)
                # Calculate time remaining
                reveal_time = datetime.fromisoformat(gift['reveal_at'].replace('Z', '+00:00'))
                remaining = reveal_time - datetime.now(timezone.utc)
                gift['time_remaining'] = {
                    'hours': int(remaining.total_seconds() // 3600),
                    'minutes': int((remaining.total_seconds() % 3600) // 60),
                    'human': _humanize_time(remaining)
                }
                gifts.append(gift)
        
        return gifts
        
    except Exception as e:
        logger.error(f"Failed to get pending gifts: {e}")
        return []

def get_gift_inbox(user_id: str, limit: int = 20) -> List[Dict]:
    """Get revealed gifts from inbox"""
    try:
        # Get recent revealed gifts
        gift_data = redis_cache.lrange(f"gifts:inbox:{user_id}", 0, limit - 1)
        
        gifts = []
        for data in gift_data:
            try:
                gifts.append(json.loads(data))
            except:
                continue
        
        return gifts
        
    except Exception as e:
        logger.error(f"Failed to get gift inbox: {e}")
        return []

def _humanize_time(delta: timedelta) -> str:
    """Convert timedelta to human-readable string"""
    total_seconds = delta.total_seconds()
    
    if total_seconds < 60:
        return "less than a minute"
    elif total_seconds < 3600:
        minutes = int(total_seconds // 60)
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    elif total_seconds < 86400:
        hours = int(total_seconds // 3600)
        return f"{hours} hour{'s' if hours != 1 else ''}"
    else:
        days = int(total_seconds // 86400)
        return f"{days} day{'s' if days != 1 else ''}"

def shake_gift(gift_id: str, user_id: str) -> Optional[Dict]:
    """Shake a gift for an additional hint"""
    try:
        gift_data = redis_cache.get(f"gift:wrapped:{gift_id}")
        if not gift_data:
            return None
        
        gift = json.loads(gift_data)
        
        # Only recipient can shake
        if gift['to_id'] != user_id:
            return None
        
        # Check if already shaken today
        shake_key = f"gift:shaken:{gift_id}:{user_id}"
        if redis_cache.exists(shake_key):
            return {'error': 'Already shaken today!'}
        
        # Get discovery for more hints
        with pg_pool.cursor() as cursor:
            cursor.execute("""
                SELECT d.*, tc.message
                FROM discoveries d
                JOIN time_capsules tc ON tc.discovery_id = d.id
                WHERE tc.id = %s
            """, (gift_id,))
            
            discovery = cursor.fetchone()
        
        # Generate additional hint
        hints = []
        
        # Domain hint
        if discovery.get('result_url'):
            domain = discovery['result_url'].split('/')[2] if '/' in discovery['result_url'] else ''
            if domain:
                hints.append(f"Found on {domain[:3]}***")
        
        # Query length hint
        if discovery.get('query'):
            query_len = len(discovery['query'])
            hints.append(f"Discovered with a {query_len}-character search")
        
        # Time of discovery hint
        if discovery.get('discovered_at'):
            hour = discovery['discovered_at'].hour
            time_period = 'morning' if hour < 12 else 'afternoon' if hour < 18 else 'evening'
            hints.append(f"Found in the {time_period}")
        
        shake_result = {
            'gift_id': gift_id,
            'new_hint': random.choice(hints) if hints else "The gift remains mysterious!",
            'shake_count': redis_cache.incr(f"gift:total_shakes:{gift_id}")
        }
        
        # Mark as shaken today
        redis_cache.setex(shake_key, 86400, '1')  # 24 hour cooldown
        
        # Notify gift giver about the shake
        redis_pubsub.publish(
            f"gift:shaken:{gift['from_id']}",
            json.dumps({
                'gift_id': gift_id,
                'shaker': gift['to_username'],
                'excitement_level': shake_result['shake_count']
            })
        )
        
        return shake_result
        
    except Exception as e:
        logger.error(f"Failed to shake gift: {e}")
        return None

# UI Helper Functions
def get_gift_button_html(discovery_id: str) -> str:
    """Generate HTML for gift button on search results"""
    friends = _get_friends_list()
    
    html = f'''
    <div class="gift-wrapper-widget" data-discovery-id="{discovery_id}">
        <button class="gift-btn" title="Gift this discovery">🎁</button>
        <div class="gift-menu" style="display:none;">
            <h4>Gift to:</h4>
            <div class="friend-list">
    '''
    
    for friend in friends:
        html += f'''
            <div class="friend-option" data-friend-id="{friend['id']}">
                <span class="friend-avatar">{friend['avatar']}</span>
                <span class="friend-name">{friend['name']}</span>
            </div>
        '''
    
    html += '''
            </div>
            <textarea class="gift-message" placeholder="Add a message (optional)"></textarea>
            <div class="gift-options">
                <select class="reveal-time">
                    <option value="1">Reveal in 1 hour</option>
                    <option value="24" selected>Reveal in 24 hours</option>
                    <option value="72">Reveal in 3 days</option>
                    <option value="168">Reveal in 1 week</option>
                </select>
                <select class="gift-theme">
                    <option value="classic">Classic wrap 🎁</option>
                    <option value="birthday">Birthday style 🎂</option>
                    <option value="mystery">Mystery box 🎭</option>
                    <option value="seasonal">Seasonal ✨</option>
                </select>
            </div>
            <button class="send-gift">Send Gift</button>
        </div>
    </div>
    '''
    
    return html

def _get_friends_list() -> List[Dict]:
    """Get list of friends for gifting"""
    # This would get actual friends from database
    return [
        {'id': 'user-456', 'name': 'Bob', 'avatar': '🎵'},
        {'id': 'user-789', 'name': 'Carol', 'avatar': '📚'}
    ]