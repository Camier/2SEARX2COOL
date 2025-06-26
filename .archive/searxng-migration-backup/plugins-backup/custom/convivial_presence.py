"""
Convivial Presence Plugin for Searxng
Tracks friend presence and search activity in a warm, ambient way
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from searx import settings
from searx.plugins import logger

name = "Convivial Presence"
description = "Ambient awareness of friends' search journeys"
default_on = True

# Plugin settings
preference_section = 'convivial'
preferences = {
    'ghost_mode': False,
    'share_fascinations': True,
    'collision_alerts': True
}

# Redis connections
redis_cache = None
redis_pubsub = None
pg_pool = None

def init(app):
    """Initialize plugin connections"""
    global redis_cache, redis_pubsub, pg_pool
    
    try:
        # Cache instance for search data
        redis_cache = redis.Redis(
            host=settings.get('redis', {}).get('cache_host', 'redis-cache'),
            port=6379,
            decode_responses=True
        )
        
        # Pub/Sub instance for real-time
        redis_pubsub = redis.Redis(
            host=settings.get('redis', {}).get('pubsub_host', 'redis-pubsub'),
            port=6380,
            decode_responses=True
        )
        
        # PostgreSQL connection
        pg_config = settings.get('postgres', {})
        pg_pool = psycopg2.connect(
            host=pg_config.get('host', 'postgres'),
            database=pg_config.get('database', 'searxng_convivial'),
            user=pg_config.get('user', 'searxng'),
            password=pg_config.get('password'),
            cursor_factory=RealDictCursor
        )
        
        logger.info("Convivial Presence plugin initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize Convivial Presence: {e}")

def on_request(request, search):
    """Pre-search hook: broadcast search intent"""
    if not redis_pubsub:
        return True
        
    user = get_current_user(request)
    if not user or user.get('is_ghost'):
        return True
    
    try:
        # Non-blocking broadcast
        asyncio.create_task(_broadcast_search_intent(user, search))
    except Exception as e:
        logger.error(f"Presence broadcast error: {e}")
    
    return True

async def _broadcast_search_intent(user: Dict, search: Dict):
    """Broadcast search activity to friends"""
    try:
        presence_data = {
            'user_id': user['id'],
            'username': user['username'],
            'mood': user.get('current_mood', ''),
            'query_hint': _anonymize_query(search.query) if search.query else '',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'event': 'search_started'
        }
        
        # Publish to presence channel
        await redis_pubsub.publish('presence:search', json.dumps(presence_data))
        
        # Update last seen
        await redis_cache.setex(
            f"presence:{user['id']}",
            300,  # 5 minute TTL
            json.dumps({
                'status': 'searching',
                'mood': user.get('current_mood', ''),
                'last_seen': presence_data['timestamp']
            })
        )
        
    except Exception as e:
        logger.error(f"Failed to broadcast presence: {e}")

def post_search(request, search):
    """Post-search hook: track discoveries and detect collisions"""
    if not pg_pool:
        return True
        
    user = get_current_user(request)
    if not user:
        return True
    
    try:
        # Process results asynchronously
        asyncio.create_task(_process_search_results(user, search))
    except Exception as e:
        logger.error(f"Post-search processing error: {e}")
    
    return True

async def _process_search_results(user: Dict, search: Dict):
    """Store discoveries and check for collisions"""
    try:
        with pg_pool.cursor() as cursor:
            # Record search session
            cursor.execute("""
                INSERT INTO search_sessions (user_id, query, mood)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (user['id'], search.query, user.get('current_mood')))
            
            session_id = cursor.fetchone()['id']
            
            # Check for collisions
            cursor.execute("""
                SELECT DISTINCT ss.user_id, u.username
                FROM search_sessions ss
                JOIN users u ON u.id = ss.user_id
                WHERE ss.user_id != %s
                AND ss.query = %s
                AND ss.session_start > NOW() - INTERVAL '1 hour'
            """, (user['id'], search.query))
            
            collisions = cursor.fetchall()
            
            if collisions:
                # Record collision event
                for collision in collisions:
                    cursor.execute("""
                        INSERT INTO collisions (user1_id, user2_id, query, collision_type)
                        VALUES (%s, %s, %s, 'simultaneous')
                    """, (user['id'], collision['user_id'], search.query))
                
                # Broadcast collision event
                collision_event = {
                    'event': 'collision_detected',
                    'users': [user['username']] + [c['username'] for c in collisions],
                    'query': search.query,
                    'type': 'simultaneous',
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                
                await redis_pubsub.publish('presence:collisions', json.dumps(collision_event))
            
            pg_pool.commit()
            
    except Exception as e:
        logger.error(f"Failed to process search results: {e}")
        if pg_pool:
            pg_pool.rollback()

def get_current_user(request) -> Optional[Dict]:
    """Get current user from session"""
    # This would integrate with your auth system
    # For now, return mock user
    return {
        'id': 'user-123',
        'username': 'alice',
        'current_mood': '🌺 Sunday morning botanical',
        'is_ghost': False
    }

def _anonymize_query(query: str) -> str:
    """Create a hint about search without revealing details"""
    if len(query) < 5:
        return "✨"
    
    words = query.split()
    if len(words) == 1:
        return f"{query[0]}{'*' * (len(query) - 1)}"
    else:
        return f"{len(words)} words about {query[0]}..."

# WebSocket integration points
def get_active_friends():
    """Get currently active friends for UI"""
    if not redis_cache:
        return []
    
    try:
        friends = []
        for key in redis_cache.scan_iter("presence:*"):
            data = redis_cache.get(key)
            if data:
                friends.append(json.loads(data))
        return friends
    except Exception as e:
        logger.error(f"Failed to get active friends: {e}")
        return []