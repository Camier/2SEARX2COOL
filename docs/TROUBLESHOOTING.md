# 2SEARX2COOL Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with 2SEARX2COOL in both web service and desktop application modes.

## Quick Diagnostics

### Health Check Script

Run the comprehensive health check:

```bash
# For web service mode
./scripts/health-check.sh --service

# For desktop mode
./scripts/health-check.sh --desktop

# Full system check
./scripts/health-check.sh --all
```

### Common Issues Checklist

- [ ] All required services running? (Redis, PostgreSQL if used)
- [ ] Correct ports available? (8888, 8889)
- [ ] Python virtual environment activated?
- [ ] All dependencies installed?
- [ ] Configuration files present and valid?
- [ ] Proper file permissions?
- [ ] Sufficient disk space?
- [ ] Network connectivity working?

## Installation Issues

### Python Dependencies

#### Issue: `pip install` fails

**Symptoms:**
```
ERROR: Could not find a version that satisfies the requirement...
```

**Solutions:**
```bash
# Update pip
python -m pip install --upgrade pip

# Install with verbose output
pip install -r requirements.txt -v

# Try installing problematic packages individually
pip install flask==2.3.2
pip install redis==4.5.5

# Use system packages if available
sudo apt install python3-flask python3-redis
```

#### Issue: Missing system dependencies

**Symptoms:**
```
error: Microsoft Visual C++ 14.0 is required (Windows)
fatal error: Python.h: No such file or directory (Linux)
```

**Solutions:**

Windows:
```powershell
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/
```

Linux:
```bash
# Install build dependencies
sudo apt install python3-dev build-essential

# For specific packages
sudo apt install libxml2-dev libxslt-dev  # for lxml
sudo apt install libpq-dev  # for psycopg2
```

### Node.js Dependencies

#### Issue: `npm install` fails

**Solutions:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use specific Node version
nvm use 18
npm install

# Install with legacy peer deps (if needed)
npm install --legacy-peer-deps
```

## Startup Issues

### Web Service Mode

#### Issue: SearXNG won't start

**Symptoms:**
```
Address already in use
ImportError: No module named 'searx'
```

**Diagnostics:**
```bash
# Check if port is in use
sudo lsof -i :8888
sudo netstat -tlnp | grep 8888

# Kill existing process
sudo kill -9 $(sudo lsof -t -i:8888)

# Check Python path
python -c "import sys; print(sys.path)"
python -c "import searx; print(searx.__file__)"
```

**Solutions:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall searx package
pip install -e .

# Run with explicit Python path
/path/to/venv/bin/python -m searx.webapp
```

#### Issue: Orchestrator connection errors

**Symptoms:**
```
ConnectionRefusedError: [Errno 111] Connection refused
Redis connection failed
```

**Solutions:**
```bash
# Start Redis
sudo systemctl start redis
# or
redis-server &

# Check Redis connection
redis-cli ping

# Start with custom Redis URL
REDIS_URL=redis://localhost:6379 python orchestrator/app.py
```

### Desktop Application Mode

#### Issue: Electron app won't start

**Symptoms:**
```
A JavaScript error occurred in the main process
Cannot find module 'electron'
```

**Solutions:**
```bash
# Rebuild electron
npm rebuild electron

# Clear Electron cache
rm -rf ~/.electron

# Run in debug mode
DEBUG=electron:* npm run dev

# Check electron installation
npx electron --version
```

#### Issue: Blank white screen

**Solutions:**
```bash
# Disable hardware acceleration
npm run dev -- --disable-gpu

# Clear application data
# Windows: %APPDATA%/2searx2cool
# macOS: ~/Library/Application Support/2searx2cool
# Linux: ~/.config/2searx2cool

# Check developer console
# Press Ctrl+Shift+I (Cmd+Option+I on macOS)
```

## Search Issues

### No Results Returned

#### Diagnostics:
```bash
# Test individual engines
curl "http://localhost:8888/search?q=test&engines=spotify&format=json"

# Check engine status
curl "http://localhost:8888/engines"

# View engine logs
tail -f logs/searxng.log | grep -E "spotify|soundcloud"
```

#### Common Causes:

1. **API Key Issues**
   ```bash
   # Check if API keys are set
   env | grep -E "DISCOGS|JAMENDO|SPOTIFY"
   
   # Test with curl
   curl -H "Authorization: Token YOUR_API_KEY" \
        "https://api.discogs.com/database/search?q=test"
   ```

2. **Rate Limiting**
   ```bash
   # Check Redis for rate limit keys
   redis-cli --scan --pattern "ratelimit:*"
   
   # Clear rate limits
   redis-cli --scan --pattern "ratelimit:*" | xargs redis-cli DEL
   ```

3. **Engine Timeouts**
   ```yaml
   # Increase timeout in config/music_engines.yml
   engines:
     spotify:
       timeout: 10  # Increase from default 5
   ```

### Slow Search Performance

#### Diagnostics:
```bash
# Enable performance logging
export LOG_PERFORMANCE=true
export LOG_LEVEL=DEBUG

# Monitor search times
grep "Search completed in" logs/searxng.log
```

#### Optimizations:

1. **Enable Caching**
   ```yaml
   # config/orchestrator.yml
   cache:
     enabled: true
     ttl: 3600
     max_size: 1000
   ```

2. **Limit Parallel Engines**
   ```bash
   # Reduce concurrent engines
   export MAX_PARALLEL_ENGINES=5
   ```

3. **Optimize Redis**
   ```bash
   # Check Redis memory usage
   redis-cli INFO memory
   
   # Enable Redis persistence
   redis-cli CONFIG SET save "900 1 300 10 60 10000"
   ```

## Database Issues

### PostgreSQL Connection Errors

#### Symptoms:
```
psycopg2.OperationalError: FATAL: password authentication failed
could not connect to server: Connection refused
```

#### Solutions:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U searxcool -d searxcool_db

# Check pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Ensure: local all all md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Migration Issues

```bash
# Reset database
python scripts/create_database_schema.py --drop

# Run specific migration
python scripts/migrate.py upgrade head

# Check migration status
python scripts/migrate.py current
```

## Network Issues

### SSL/TLS Errors

#### Symptoms:
```
SSL: CERTIFICATE_VERIFY_FAILED
requests.exceptions.SSLError
```

#### Solutions:
```bash
# Update certificates
pip install --upgrade certifi

# Disable SSL verification (development only!)
export PYTHONWARNINGS="ignore:Unverified HTTPS request"
export REQUESTS_CA_BUNDLE=""
```

### Proxy Issues

```bash
# Configure proxy
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1

# For Python requests
export REQUESTS_CA_BUNDLE=/path/to/cacert.pem
```

## Desktop Application Issues

### Auto-Update Problems

#### Issue: Updates fail to download

**Solutions:**
```javascript
// Disable certificate checking (dev only)
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Use custom update server
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://your-update-server.com'
});
```

### Plugin Loading Errors

#### Diagnostics:
```bash
# Check plugin directory
ls -la plugins/

# Validate plugin manifest
python scripts/validate-plugin.py plugins/my-plugin/manifest.json
```

#### Common Issues:

1. **Permission Errors**
   ```bash
   # Fix permissions
   chmod -R 755 plugins/
   chown -R $USER:$USER plugins/
   ```

2. **Dependency Conflicts**
   ```javascript
   // In plugin package.json
   {
     "peerDependencies": {
       "2searx2cool": "^1.0.0"
     }
   }
   ```

## Performance Debugging

### Memory Leaks

#### Desktop Application:
```javascript
// Enable memory profiling
app.commandLine.appendSwitch('enable-precise-memory-info');

// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 5000);
```

#### Python Services:
```python
# Memory profiling
from memory_profiler import profile

@profile
def search_handler(query):
    # Your code here
    pass

# Run with: python -m memory_profiler script.py
```

### CPU Usage

```bash
# Profile Python CPU usage
python -m cProfile -o profile.stats orchestrator/app.py

# Analyze profile
python -m pstats profile.stats
> sort cumtime
> stats 20
```

## Logging and Debugging

### Enable Debug Logging

#### Environment Variables:
```bash
# Maximum verbosity
export LOG_LEVEL=DEBUG
export FLASK_ENV=development
export NODE_ENV=development
export DEBUG=*

# Specific components
export DEBUG=electron:*
export DEBUG=searx:*
```

#### Configuration:
```yaml
# config/orchestrator.yml
logging:
  level: DEBUG
  format: '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
  handlers:
    - type: file
      filename: logs/orchestrator.log
    - type: console
```

### Log Locations

```bash
# Application logs
logs/searxng.log
logs/orchestrator.log
logs/electron.log

# System logs
/var/log/nginx/error.log
/var/log/redis/redis-server.log
/var/log/postgresql/postgresql-14-main.log

# Electron logs
# Windows: %USERPROFILE%\AppData\Roaming\2searx2cool\logs
# macOS: ~/Library/Logs/2searx2cool
# Linux: ~/.config/2searx2cool/logs
```

## Common Error Messages

### `ModuleNotFoundError: No module named 'searx'`
```bash
# Ensure you're in the right directory
cd /path/to/2SEARX2COOL-FINAL-INTEGRATED

# Install in development mode
pip install -e .
```

### `EADDRINUSE: Address already in use`
```bash
# Find and kill process
# Linux/macOS
lsof -ti:8888 | xargs kill -9

# Windows
netstat -ano | findstr :8888
taskkill /PID <PID> /F
```

### `CORS error in browser console`
```python
# Add to orchestrator/app.py
from flask_cors import CORS

CORS(app, origins=['http://localhost:3000', 'http://localhost:8888'])
```

### `Redis: MISCONF Redis is configured to save RDB snapshots`
```bash
# Fix Redis permissions
sudo chown redis:redis /var/lib/redis
sudo chmod 770 /var/lib/redis

# Or disable persistence
redis-cli CONFIG SET stop-writes-on-bgsave-error no
```

## Recovery Procedures

### Reset to Clean State

```bash
#!/bin/bash
# reset.sh

# Stop all services
sudo systemctl stop searxng orchestrator

# Clear caches
redis-cli FLUSHALL

# Reset database
dropdb searxcool_db
createdb searxcool_db
python scripts/create_database_schema.py

# Clear logs
rm -f logs/*.log

# Restart services
sudo systemctl start searxng orchestrator
```

### Backup and Restore

```bash
# Backup
pg_dump searxcool_db > backup.sql
redis-cli --rdb dump.rdb

# Restore
psql searxcool_db < backup.sql
redis-cli --rdb dump.rdb
```

## Getting Help

### Diagnostic Information to Collect

When reporting issues, include:

1. **System Information**
   ```bash
   python --version
   node --version
   npm --version
   redis-cli --version
   psql --version
   ```

2. **Error Logs**
   ```bash
   tail -n 100 logs/*.log
   ```

3. **Configuration**
   ```bash
   # Sanitize sensitive data first!
   cat .env | grep -v PASSWORD
   ```

4. **Steps to Reproduce**
   - Exact commands run
   - Expected behavior
   - Actual behavior

### Support Channels

- GitHub Issues: [https://github.com/Camier/2SEARX2COOL/issues](https://github.com/Camier/2SEARX2COOL/issues)
- Discussions: [https://github.com/Camier/2SEARX2COOL/discussions](https://github.com/Camier/2SEARX2COOL/discussions)
- Email: support@searxcool.com

### Debug Mode Helper Script

```bash
#!/bin/bash
# debug-mode.sh

echo "Starting 2SEARX2COOL in debug mode..."

# Set debug environment
export LOG_LEVEL=DEBUG
export FLASK_ENV=development
export NODE_ENV=development
export DEBUG=*

# Start with verbose logging
echo "Starting Redis..."
redis-server --loglevel debug &

echo "Starting SearXNG..."
python -m searx.webapp 2>&1 | tee logs/searxng-debug.log &

echo "Starting Orchestrator..."
cd orchestrator && python app.py 2>&1 | tee ../logs/orchestrator-debug.log &

echo "Debug mode active. Press Ctrl+C to stop."
wait
```