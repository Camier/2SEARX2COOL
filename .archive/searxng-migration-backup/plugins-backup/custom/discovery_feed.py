"""
Discovery Feed Plugin for Searxng
Real-time feed of friend discoveries with social features
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from searx import settings
from searx.plugins import logger

name = "Discovery Feed"
description = "Share and see friend discoveries in real-time"
default_on = True

# Plugin settings
preference_section = 'convivial'
preferences = {
    'share_discoveries': True,
    'feed_size': 20,
    'auto_gift_keywords': []  # Keywords that trigger gift suggestions
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
        
        logger.info("Discovery Feed plugin initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize Discovery Feed: {e}")

def post_search(request, search):
    """Track interesting discoveries after search"""
    if not redis_pubsub or not pg_pool:
        return True
        
    user = get_current_user(request)
    if not user or not user.get('share_discoveries', True):
        return True
    
    try:
        # Process discoveries asynchronously
        asyncio.create_task(_process_discoveries(user, search))
    except Exception as e:
        logger.error(f"Discovery processing error: {e}")
    
    return True

async def _process_discoveries(user: Dict, search: Dict):
    """Extract and share interesting discoveries"""
    try:
        results = search.result_container.results[:5]  # Top 5 results
        query = search.search_query.query
        
        # Check for gift keywords
        gift_keywords = settings.get('convivial', {}).get('auto_gift_keywords', [])
        is_gift_worthy = any(kw.lower() in query.lower() for kw in gift_keywords)
        
        discoveries = []
        
        for result in results:
            # Calculate interestingness score
            score = _calculate_interest_score(result, query)
            
            if score > 0.5:  # Threshold for sharing
                discovery = {
                    'user_id': user['id'],
                    'username': user['username'],
                    'query': query,
                    'url': result.get('url', ''),
                    'title': result.get('title', ''),
                    'snippet': result.get('content', '')[:300],
                    'engine': result.get('engine', ''),
                    'score': score,
                    'is_gift_worthy': is_gift_worthy,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                
                discoveries.append(discovery)
                
                # Store in database
                with pg_pool.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO discoveries 
                        (user_id, query, result_url, result_title, result_snippet, engine, result_data)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        user['id'], query, discovery['url'], 
                        discovery['title'], discovery['snippet'], 
                        discovery['engine'], json.dumps({'score': score})
                    ))
                    
                    discovery['id'] = cursor.fetchone()['id']
                    pg_pool.commit()
        
        if discoveries:
            # Update feed cache
            feed_key = "discovery_feed:global"
            
            # Add to Redis sorted set (score = timestamp)
            for disc in discoveries:
                redis_cache.zadd(
                    feed_key,
                    {json.dumps(disc): datetime.now().timestamp()}
                )
            
            # Keep only recent items
            redis_cache.zremrangebyrank(feed_key, 0, -101)  # Keep last 100
            
            # Publish to real-time feed
            await redis_pubsub.publish(
                'discovery_feed:new',
                json.dumps({
                    'user': user['username'],
                    'count': len(discoveries),
                    'top_discovery': discoveries[0] if discoveries else None
                })
            )
            
            # Check for gift opportunities
            if is_gift_worthy and len(discoveries) > 0:
                await _suggest_gift(user, discoveries[0])
                
    except Exception as e:
        logger.error(f"Failed to process discoveries: {e}")
        if pg_pool:
            pg_pool.rollback()

def _calculate_interest_score(result: Dict, query: str) -> float:
    """Calculate how interesting/shareworthy a result is"""
    score = 0.0
    
    # Title relevance
    title = result.get('title', '').lower()
    if query.lower() in title:
        score += 0.3
    
    # Special domains boost
    url = result.get('url', '')
    interesting_domains = [
        'bandcamp.com', 'archive.org', 'gallica.bnf.fr',
        'biodiversitylibrary.org', 'jstor.org', 'arxiv.org'
    ]
    if any(domain in url for domain in interesting_domains):
        score += 0.4
    
    # Content richness
    content = result.get('content', '')
    if len(content) > 200:
        score += 0.2
    
    # Media presence
    if result.get('img_src') or result.get('thumbnail'):
        score += 0.1
    
    # Academic indicators
    academic_terms = ['doi:', 'isbn:', 'pmid:', 'arxiv:']
    if any(term in content.lower() or term in url.lower() for term in academic_terms):
        score += 0.3
    
    return min(score, 1.0)

async def _suggest_gift(user: Dict, discovery: Dict):
    """Suggest gifting a discovery to a friend"""
    try:
        # Find friends who might enjoy this
        with pg_pool.cursor() as cursor:
            # Properly escape the LIKE pattern to prevent issues
            search_term = discovery.get('query', '').split()[0] if discovery.get('query') else ''
            # Escape special characters in LIKE patterns
            search_term = search_term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
            
            cursor.execute("""
                SELECT DISTINCT u.id, u.username, COUNT(*) as shared_interests
                FROM users u
                JOIN search_sessions ss ON ss.user_id = u.id
                WHERE u.id != %s
                AND ss.query ILIKE %s
                GROUP BY u.id, u.username
                ORDER BY shared_interests DESC
                LIMIT 1
            """, (user['id'], f"%{search_term}%"))
            
            potential_recipient = cursor.fetchone()
            
            if potential_recipient:
                # Create gift suggestion
                suggestion = {
                    'from_user': user['username'],
                    'to_user': potential_recipient['username'],
                    'discovery': discovery,
                    'reason': f"They've searched similar topics {potential_recipient['shared_interests']} times",
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                
                # Cache suggestion
                redis_cache.setex(
                    f"gift_suggestion:{user['id']}:{discovery['id']}",
                    3600,  # 1 hour TTL
                    json.dumps(suggestion)
                )
                
                # Notify via WebSocket
                await redis_pubsub.publish(
                    'gift:suggestion',
                    json.dumps(suggestion)
                )
                
    except Exception as e:
        logger.error(f"Failed to suggest gift: {e}")

def get_discovery_feed(user_id: Optional[str] = None, limit: int = 20) -> List[Dict]:
    """Get recent discoveries for display"""
    if not redis_cache:
        return []
    
    try:
        feed_key = f"discovery_feed:user:{user_id}" if user_id else "discovery_feed:global"
        
        # Get recent items from sorted set
        items = redis_cache.zrevrange(feed_key, 0, limit - 1)
        
        discoveries = []
        for item in items:
            try:
                discoveries.append(json.loads(item))
            except:
                continue
                
        return discoveries
        
    except Exception as e:
        logger.error(f"Failed to get discovery feed: {e}")
        return []

def share_discovery(user_id: str, discovery_id: str, message: Optional[str] = None):
    """Explicitly share a discovery"""
    try:
        with pg_pool.cursor() as cursor:
            # Get discovery details
            cursor.execute("""
                SELECT d.*, u.username
                FROM discoveries d
                JOIN users u ON u.id = d.user_id
                WHERE d.id = %s
            """, (discovery_id,))
            
            discovery = cursor.fetchone()
            if not discovery:
                return False
            
            # Create share event
            share_event = {
                'type': 'explicit_share',
                'user_id': user_id,
                'discovery': discovery,
                'message': message,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            # Add to feeds
            redis_cache.zadd(
                "discovery_feed:global",
                {json.dumps(share_event): datetime.now().timestamp()}
            )
            
            # Notify
            redis_pubsub.publish(
                'discovery:shared',
                json.dumps(share_event)
            )
            
            return True
            
    except Exception as e:
        logger.error(f"Failed to share discovery: {e}")
        return False

def get_trending_topics(hours: int = 24) -> List[Dict]:
    """Get trending topics from recent discoveries"""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        with pg_pool.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    query,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(*) as total_discoveries,
                    MAX(discovered_at) as last_seen
                FROM discoveries
                WHERE discovered_at > %s
                GROUP BY query
                HAVING COUNT(DISTINCT user_id) > 1
                ORDER BY unique_users DESC, total_discoveries DESC
                LIMIT 10
            """, (cutoff,))
            
            trends = []
            for row in cursor.fetchall():
                trends.append({
                    'topic': row['query'],
                    'users': row['unique_users'],
                    'discoveries': row['total_discoveries'],
                    'momentum': 'rising' if row['unique_users'] > 2 else 'steady',
                    'last_seen': row['last_seen'].isoformat()
                })
                
            return trends
            
    except Exception as e:
        logger.error(f"Failed to get trending topics: {e}")
        return []

def get_current_user(request) -> Optional[Dict]:
    """Get current user from session"""
    # This would integrate with your auth system
    return {
        'id': 'user-123',
        'username': 'alice',
        'share_discoveries': True
    }

# Template helper functions for UI integration
def get_feed_html():
    """Generate HTML for discovery feed widget"""
    discoveries = get_discovery_feed(limit=10)
    
    html = ['<div class="discovery-feed">']
    html.append('<h3>Recent Discoveries</h3>')
    
    for disc in discoveries:
        html.append(f'''
            <div class="discovery-item" data-id="{disc.get('id', '')}">
                <div class="discovery-header">
                    <span class="user">{disc['username']}</span>
                    <span class="time" title="{disc['timestamp']}">just now</span>
                </div>
                <div class="discovery-content">
                    <a href="{disc['url']}" target="_blank">{disc['title']}</a>
                    <p class="snippet">{disc['snippet']}</p>
                    <div class="discovery-meta">
                        <span class="query">while searching: {disc['query']}</span>
                        <span class="engine">via {disc['engine']}</span>
                    </div>
                </div>
                <div class="discovery-actions">
                    <button class="gift-btn" title="Gift this discovery">🎁</button>
                    <button class="save-btn" title="Save to collection">💾</button>
                    <button class="react-btn" title="React">✨</button>
                </div>
            </div>
        ''')
    
    html.append('</div>')
    return '\n'.join(html)