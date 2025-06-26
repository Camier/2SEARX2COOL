"""
Morning Coffee Plugin for Searxng
Daily digest of yesterday's collective discoveries
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
import openai
from searx import settings
from searx.plugins import logger

name = "Morning Coffee"
description = "Daily digest of friend discoveries"
default_on = True

# Plugin settings
preference_section = 'convivial'
preferences = {
    'morning_coffee_enabled': True,
    'digest_hour': 8,  # 8 AM local time
    'include_ai_summary': True
}

# Connections
redis_cache = None
pg_pool = None

def init(app):
    """Initialize plugin connections"""
    global redis_cache, pg_pool
    
    try:
        redis_cache = redis.Redis(
            host=settings.get('redis', {}).get('cache_host', 'redis-cache'),
            port=6379,
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
        
        # Schedule daily digest
        asyncio.create_task(_schedule_morning_coffee())
        
        logger.info("Morning Coffee plugin initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize Morning Coffee: {e}")

async def _schedule_morning_coffee():
    """Run morning coffee generation daily"""
    while True:
        try:
            now = datetime.now()
            digest_hour = settings.get('convivial', {}).get('morning_coffee_hour', 8)
            
            # Calculate next run time
            next_run = now.replace(hour=digest_hour, minute=0, second=0, microsecond=0)
            if now >= next_run:
                next_run += timedelta(days=1)
            
            # Wait until next run
            wait_seconds = (next_run - now).total_seconds()
            await asyncio.sleep(wait_seconds)
            
            # Generate digest
            await generate_morning_coffee()
            
        except Exception as e:
            logger.error(f"Morning coffee scheduler error: {e}")
            await asyncio.sleep(3600)  # Retry in 1 hour

async def generate_morning_coffee():
    """Generate the morning coffee digest"""
    try:
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        yesterday_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        with pg_pool.cursor() as cursor:
            # Get yesterday's discoveries
            cursor.execute("""
                SELECT 
                    d.id,
                    d.query,
                    d.result_title,
                    d.result_url,
                    d.result_snippet,
                    d.engine,
                    d.discovered_at,
                    u.username,
                    u.display_name
                FROM discoveries d
                JOIN users u ON u.id = d.user_id
                WHERE d.discovered_at BETWEEN %s AND %s
                AND d.is_gift = FALSE
                ORDER BY d.discovered_at DESC
            """, (yesterday_start, yesterday_end))
            
            discoveries = cursor.fetchall()
            
            if not discoveries:
                logger.info("No discoveries yesterday for morning coffee")
                return
            
            # Get search sessions for themes
            cursor.execute("""
                SELECT DISTINCT query, COUNT(*) as count
                FROM search_sessions
                WHERE session_start BETWEEN %s AND %s
                GROUP BY query
                ORDER BY count DESC
                LIMIT 10
            """, (yesterday_start, yesterday_end))
            
            popular_queries = cursor.fetchall()
            
            # Get collisions
            cursor.execute("""
                SELECT 
                    c.query,
                    c.collision_type,
                    u1.username as user1,
                    u2.username as user2
                FROM collisions c
                JOIN users u1 ON u1.id = c.user1_id
                JOIN users u2 ON u2.id = c.user2_id
                WHERE c.occurred_at BETWEEN %s AND %s
            """, (yesterday_start, yesterday_end))
            
            collisions = cursor.fetchall()
            
            # Create digest data
            digest_data = {
                'date': yesterday.date().isoformat(),
                'discoveries': _format_discoveries(discoveries),
                'themes': _extract_themes(discoveries, popular_queries),
                'collisions': _format_collisions(collisions),
                'stats': {
                    'total_discoveries': len(discoveries),
                    'total_searches': sum(q['count'] for q in popular_queries),
                    'unique_engines': len(set(d['engine'] for d in discoveries)),
                    'collision_count': len(collisions)
                }
            }
            
            # Generate AI summary if enabled
            summary = None
            if settings.get('convivial', {}).get('include_ai_summary', True):
                summary = await _generate_ai_summary(digest_data)
            
            # Store digest
            cursor.execute("""
                INSERT INTO morning_coffee (digest_date, discoveries, generated_summary)
                VALUES (%s, %s, %s)
                ON CONFLICT (digest_date) DO UPDATE
                SET discoveries = EXCLUDED.discoveries,
                    generated_summary = EXCLUDED.generated_summary
            """, (yesterday.date(), json.dumps(digest_data), summary))
            
            pg_pool.commit()
            
            # Cache for quick access
            redis_cache.setex(
                f"morning_coffee:{yesterday.date().isoformat()}",
                86400 * 7,  # Keep for 7 days
                json.dumps({
                    'digest': digest_data,
                    'summary': summary,
                    'generated_at': datetime.now(timezone.utc).isoformat()
                })
            )
            
            # Notify WebSocket server
            redis_cache.publish('morning_coffee:ready', json.dumps({
                'date': yesterday.date().isoformat(),
                'discovery_count': len(discoveries)
            }))
            
            logger.info(f"Morning coffee generated for {yesterday.date()}")
            
    except Exception as e:
        logger.error(f"Failed to generate morning coffee: {e}")
        if pg_pool:
            pg_pool.rollback()

def _format_discoveries(discoveries: List[Dict]) -> List[Dict]:
    """Format discoveries for digest"""
    formatted = []
    
    for disc in discoveries[:20]:  # Top 20 discoveries
        formatted.append({
            'id': disc['id'],
            'title': disc['result_title'],
            'url': disc['result_url'],
            'snippet': disc['result_snippet'][:200] + '...' if len(disc['result_snippet']) > 200 else disc['result_snippet'],
            'query': disc['query'],
            'engine': disc['engine'],
            'discovered_by': disc['display_name'] or disc['username'],
            'time': disc['discovered_at'].strftime('%H:%M')
        })
    
    return formatted

def _extract_themes(discoveries: List[Dict], popular_queries: List[Dict]) -> List[str]:
    """Extract main themes from yesterday's searches"""
    themes = []
    
    # Extract from popular queries
    for query in popular_queries[:5]:
        if query['count'] > 1:
            themes.append(f"{query['query']} ({query['count']} searches)")
    
    # Extract from discovery topics
    topics = {}
    for disc in discoveries:
        words = disc['query'].lower().split()
        for word in words:
            if len(word) > 4:  # Skip short words
                topics[word] = topics.get(word, 0) + 1
    
    # Add top topics
    top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:3]
    for topic, count in top_topics:
        if count > 2:
            themes.append(f"{topic.title()} theme")
    
    return themes[:5]  # Max 5 themes

def _format_collisions(collisions: List[Dict]) -> List[Dict]:
    """Format collision moments"""
    formatted = []
    
    for coll in collisions:
        formatted.append({
            'users': f"{coll['user1']} & {coll['user2']}",
            'query': coll['query'],
            'type': coll['collision_type'],
            'emoji': '✨' if coll['collision_type'] == 'simultaneous' else '🔄'
        })
    
    return formatted

async def _generate_ai_summary(digest_data: Dict) -> str:
    """Generate AI summary of the day's discoveries"""
    if not settings.get('openai_api_key'):
        return None
    
    try:
        openai.api_key = settings.get('openai_api_key')
        
        # Create prompt
        discoveries_text = "\n".join([
            f"- {d['discovered_by']} found '{d['title']}' while searching for '{d['query']}'"
            for d in digest_data['discoveries'][:10]
        ])
        
        themes_text = ", ".join(digest_data['themes']) if digest_data['themes'] else "various topics"
        
        prompt = f"""
        Write a warm, friendly 2-3 sentence summary of yesterday's search discoveries by a small group of friends.
        
        Key themes: {themes_text}
        
        Some discoveries:
        {discoveries_text}
        
        Stats: {digest_data['stats']['total_discoveries']} discoveries, {digest_data['stats']['collision_count']} coincidental finds
        
        Keep it conversational and highlight interesting connections or patterns. Use a cozy, morning coffee tone.
        """
        
        response = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.7
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        logger.error(f"Failed to generate AI summary: {e}")
        return None

def on_request(request, search):
    """Hook to serve morning coffee on homepage"""
    if request.path == '/' and request.method == 'GET':
        # Inject morning coffee data into template context
        try:
            today = datetime.now().date()
            coffee_key = f"morning_coffee:{today.isoformat()}"
            
            coffee_data = redis_cache.get(coffee_key)
            if coffee_data:
                request.morning_coffee = json.loads(coffee_data)
        except Exception as e:
            logger.error(f"Failed to load morning coffee: {e}")
    
    return True

def add_coffee_reaction(user_id: str, reaction: str):
    """Add a coffee reaction (☕☕☕)"""
    try:
        today = datetime.now().date()
        
        with pg_pool.cursor() as cursor:
            cursor.execute("""
                UPDATE morning_coffee
                SET coffee_reactions = 
                    CASE 
                        WHEN coffee_reactions IS NULL THEN jsonb_build_object(%s, %s)
                        ELSE coffee_reactions || jsonb_build_object(%s, %s)
                    END
                WHERE digest_date = %s
            """, (user_id, reaction, user_id, reaction, today))
            
            pg_pool.commit()
            
            # Update cache
            coffee_key = f"morning_coffee:{today.isoformat()}"
            coffee_data = redis_cache.get(coffee_key)
            if coffee_data:
                data = json.loads(coffee_data)
                if 'reactions' not in data:
                    data['reactions'] = {}
                data['reactions'][user_id] = reaction
                redis_cache.setex(coffee_key, 86400 * 7, json.dumps(data))
                
    except Exception as e:
        logger.error(f"Failed to add coffee reaction: {e}")
        if pg_pool:
            pg_pool.rollback()