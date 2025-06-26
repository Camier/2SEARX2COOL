"""
Redis Caching Service for 2SEARX2COOL
Provides high-performance caching for search results
"""

import json
import time
import hashlib
import logging
from typing import Optional, Dict, Any, List
import redis
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class CacheService:
    """Redis-based caching service for search results"""
    
    def __init__(self, redis_url: str = 'redis://localhost:6379/2', 
                 default_ttl: int = 3600,
                 max_results_per_query: int = 100):
        """
        Initialize cache service
        
        Args:
            redis_url: Redis connection URL
            default_ttl: Default TTL in seconds (1 hour)
            max_results_per_query: Maximum results to cache per query
        """
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self.max_results_per_query = max_results_per_query
        self.redis_client = None
        self._connect()
    
    def _connect(self):
        """Establish Redis connection with retry logic"""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            self.redis_client.ping()
            logger.info("✅ Redis cache connected successfully")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self.redis_client = None
    
    def _generate_cache_key(self, query: str, engines: Optional[List[str]] = None,
                          categories: Optional[List[str]] = None) -> str:
        """Generate consistent cache key for search parameters"""
        # Normalize parameters
        query_lower = query.lower().strip()
        engines_str = ",".join(sorted(engines)) if engines else "all"
        categories_str = ",".join(sorted(categories)) if categories else "all"
        
        # Create composite key
        key_parts = [
            f"query:{query_lower}",
            f"engines:{engines_str}",
            f"categories:{categories_str}"
        ]
        
        # Generate hash for consistent key
        key_string = "|".join(key_parts)
        key_hash = hashlib.md5(key_string.encode()).hexdigest()[:16]
        
        return f"search:v1:{key_hash}"
    
    def get(self, query: str, engines: Optional[List[str]] = None,
            categories: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
        """
        Get cached search results
        
        Returns:
            Cached results dict or None if not found/expired
        """
        if not self.redis_client:
            return None
        
        cache_key = self._generate_cache_key(query, engines, categories)
        
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                result = json.loads(cached_data)
                logger.info(f"✅ Cache hit for query: {query}")
                
                # Update hit count
                self.redis_client.hincrby("cache:stats", "hits", 1)
                
                return result
            else:
                # Update miss count
                self.redis_client.hincrby("cache:stats", "misses", 1)
                
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        
        return None
    
    def set(self, query: str, results: Dict[str, Any],
            engines: Optional[List[str]] = None,
            categories: Optional[List[str]] = None,
            ttl: Optional[int] = None) -> bool:
        """
        Cache search results
        
        Args:
            query: Search query
            results: Results to cache
            engines: List of engines used
            categories: List of categories
            ttl: Time to live in seconds
            
        Returns:
            True if cached successfully
        """
        if not self.redis_client:
            return False
        
        cache_key = self._generate_cache_key(query, engines, categories)
        ttl = ttl or self.default_ttl
        
        try:
            # Limit number of results to cache
            if 'results' in results and len(results['results']) > self.max_results_per_query:
                results = results.copy()
                results['results'] = results['results'][:self.max_results_per_query]
                results['truncated'] = True
            
            # Add cache metadata
            cache_data = {
                **results,
                'cached_at': datetime.utcnow().isoformat(),
                'cache_ttl': ttl,
                'cache_key': cache_key
            }
            
            # Store in Redis
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(cache_data)
            )
            
            # Update stats
            self.redis_client.hincrby("cache:stats", "sets", 1)
            
            # Track query frequency
            query_key = f"query:freq:{query.lower().strip()}"
            self.redis_client.zincrby("popular:queries", 1, query)
            
            logger.info(f"✅ Cached results for query: {query} (TTL: {ttl}s)")
            return True
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    def invalidate(self, pattern: Optional[str] = None) -> int:
        """
        Invalidate cached entries
        
        Args:
            pattern: Optional pattern to match keys (e.g., "search:v1:*")
            
        Returns:
            Number of keys deleted
        """
        if not self.redis_client:
            return 0
        
        try:
            if pattern:
                keys = self.redis_client.keys(pattern)
                if keys:
                    return self.redis_client.delete(*keys)
            else:
                # Clear all search cache
                keys = self.redis_client.keys("search:v1:*")
                if keys:
                    return self.redis_client.delete(*keys)
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
        
        return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.redis_client:
            return {"status": "disconnected"}
        
        try:
            stats = self.redis_client.hgetall("cache:stats")
            
            # Get popular queries
            popular_queries = self.redis_client.zrevrange(
                "popular:queries", 0, 9, withscores=True
            )
            
            # Get cache size
            cache_keys = len(self.redis_client.keys("search:v1:*"))
            
            return {
                "status": "connected",
                "hits": int(stats.get("hits", 0)),
                "misses": int(stats.get("misses", 0)),
                "sets": int(stats.get("sets", 0)),
                "hit_rate": self._calculate_hit_rate(stats),
                "cache_entries": cache_keys,
                "popular_queries": [
                    {"query": q, "count": int(score)} 
                    for q, score in popular_queries
                ]
            }
        except Exception as e:
            logger.error(f"Stats error: {e}")
            return {"status": "error", "error": str(e)}
    
    def _calculate_hit_rate(self, stats: Dict[str, str]) -> float:
        """Calculate cache hit rate"""
        hits = int(stats.get("hits", 0))
        misses = int(stats.get("misses", 0))
        total = hits + misses
        
        if total == 0:
            return 0.0
        
        return round((hits / total) * 100, 2)
    
    def warm_cache(self, popular_queries: List[str]) -> int:
        """
        Pre-warm cache with popular queries
        
        Args:
            popular_queries: List of queries to pre-cache
            
        Returns:
            Number of queries warmed
        """
        warmed = 0
        
        # This would typically call the search service
        # For now, just count
        for query in popular_queries:
            logger.info(f"Would warm cache for: {query}")
            warmed += 1
        
        return warmed
    
    def cleanup_expired(self) -> int:
        """
        Clean up expired entries (Redis handles this automatically)
        Returns 0 as Redis manages TTL
        """
        return 0

# Singleton instance
_cache_service = None

def get_cache_service() -> CacheService:
    """Get or create cache service singleton"""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service