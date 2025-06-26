# Redis Consolidation - Single Instance Setup

## ✅ Consolidation Complete

### Previous Setup (Dual Redis)
- **Port 6379**: Orchestrator and WebSocket (user: mik)
- **Port 6380**: SearXNG cache (user: redis) - **REMOVED**

### Current Setup (Single Redis)
- **Port 6379**: All services consolidated
  - Database 0: Orchestrator operations
  - Database 1: WebSocket/SocketIO + Music engine cache
  - Database 2: SearXNG search cache

## Changes Made

1. **Stopped Redis on port 6380**
   ```bash
   sudo systemctl stop redis-server
   ```

2. **Updated Configurations**
   - `config/searxng-settings.yml`: Changed `redis://localhost:6380/2` → `redis://localhost:6379/2`
   - All development scripts in `scripts/development/`: Updated to use port 6379

3. **Database Allocation**
   ```
   DB0: Orchestrator (config/orchestrator.yml)
   DB1: WebSocket + Music cache (config/music_engines.yml)
   DB2: SearXNG cache (config/searxng-settings.yml)
   ```

## Benefits
- **Simplified Management**: Single Redis instance to monitor
- **Resource Efficiency**: ~50MB RAM saved
- **Easier Configuration**: One port, one service
- **Better Performance**: Less context switching

## Verification
```bash
# Check Redis is running
redis-cli ping
# Response: PONG

# Check database usage
redis-cli -n 0 dbsize  # Orchestrator
redis-cli -n 1 dbsize  # WebSocket/Music
redis-cli -n 2 dbsize  # SearXNG cache
```

## To Disable Auto-start of Redis 6380
```bash
sudo systemctl disable redis-server
```

## Configuration Summary
All services now use `redis://localhost:6379/<db>`:
- Orchestrator: DB 0
- WebSocket/Music: DB 1  
- SearXNG: DB 2

The consolidation is complete and all services are configured to use the single Redis instance on port 6379!