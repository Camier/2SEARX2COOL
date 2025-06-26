# SearXNG Docker to Python Migration Guide

## Current Docker Services to Migrate:
1. **searxng-convivial** - Main SearXNG instance (port 8080)
2. **searxng-auth-proxy** - Authentication proxy (port 8095) ← Main entry point
3. **searxng-auth** - Authentication service (port 5000)
4. **searxng-websocket** - WebSocket server (port 3000)
5. **searxng-api** - API service (port 5001)
6. **searxng-postgres** - PostgreSQL database (internal)
7. **searxng-redis-cache** - Redis for caching (internal)
8. **searxng-redis-pubsub** - Redis for pub/sub (internal)
9. **searxng-minio** - Object storage (ports 9000-9001)

## Critical Environment Variables Extracted:
- JWT_SECRET=585e7b911014c4131a13cfc46d206629dbc314f5bc981644942ff09ac9178424
- SECRET_KEY=c7f9e8d6b5a4c3f2e1d0b9a8c7f6e5d4b3c2f1e0d9c8b7a6f5e4d3c2b1a0f9e8
- SEARXNG_URL=http://searxng:8080
- AUTH_SERVICE_URL=http://auth-service:5000
- API_SERVICE_URL=http://api-service:5001
- REDIS_HOST=redis-cache

## Backup Status:
✅ Container configurations extracted
✅ Environment variables documented
✅ Themes and templates backed up
✅ Redis cache data saved
⚠️ PostgreSQL backup failed (need to retry with correct user)
✅ MinIO data backed up
✅ Volume list documented

## Next Steps After Docker Removal:
1. Install Python dependencies
2. Setup native Redis and PostgreSQL
3. Implement authentication middleware
4. Restore configurations and themes
5. Configure nginx proxy for port 8095
EOF < /dev/null
