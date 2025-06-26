# SearXNG Music Engine Fixes

## Error Analysis & Solutions

### 1. Radio Paradise Engine
**Error**: `'list' object has no attribute 'get'`
**Status**: Already fixed in code (lines 90-95)
**Solution**: The engine already handles both list and dict responses

### 2. Apple Music Web Engine
**Error**: `KeyError: 'key'`
**Cause**: Result object missing required 'key' field
**Status**: Using standardize_result() but still failing

The issue is likely in `/searx/results.py` line 139 expecting a 'key' field. The standardize_result method may not be adding this field.

**Fix needed in base_music.py**:
```python
def standardize_result(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
    # ... existing code ...
    
    # Add the 'key' field that SearXNG expects
    if 'key' not in result:
        # Generate a unique key from title and URL
        import hashlib
        key_string = f"{result.get('title', '')}{result.get('url', '')}"
        result['key'] = hashlib.md5(key_string.encode()).hexdigest()[:16]
    
    return result
```

### 3. Pitchfork Engine
**Error**: Timeout (5s) and redirect issues
**Solution**: Increase timeout and allow redirects in settings.yml

**Add to settings.yml**:
```yaml
engines:
  - name: pitchfork
    engine: pitchfork
    shortcut: pf
    timeout: 15.0  # Increase from default 5s
    max_redirects: 2  # Allow redirects
```

### 4. Musixmatch Engine
**Error**: HTTP 403 Forbidden - CloudFlare blocking
**Status**: Aggressive anti-bot protection
**Options**:
1. Enhanced headers (already in code)
2. Use proxy/VPN
3. Disable engine if continues to fail

### 5. SQLite Warning
**Warning**: Multi-thread mode
**Solution**: Create limiter config

Create `/etc/searxng/limiter.toml`:
```toml
[botdetection.ip_limit]
# Enable IP-based rate limiting
enable = true
# Number of requests per time window
limit = 100
# Time window in seconds
window = 300

[botdetection.link_token]
# Enable link token checks
enable = false

[real_ip]
# X-Forwarded-For header depth
x_forwarded_for = 1
```

## Quick Fix Script

Run this to apply the base_music.py fix:

```bash
#!/bin/bash
# fix_engines.sh

# Backup original
cp /home/mik/SEARXNG/searxng-cool/searxng-core/searxng-core/searx/engines/base_music.py \
   /home/mik/SEARXNG/searxng-cool/searxng-core/searxng-core/searx/engines/base_music.py.bak

# Apply fix to base_music.py
python3 << 'EOF'
import re

file_path = '/home/mik/SEARXNG/searxng-cool/searxng-core/searxng-core/searx/engines/base_music.py'

with open(file_path, 'r') as f:
    content = f.read()

# Find the standardize_result method
if "result['key']" not in content:
    # Add key generation before the return statement
    new_code = """
        # Add the 'key' field that SearXNG expects
        if 'key' not in result:
            # Generate a unique key from title and URL
            import hashlib
            key_string = f"{result.get('title', '')}{result.get('url', '')}"
            result['key'] = hashlib.md5(key_string.encode()).hexdigest()[:16]
        
        return result"""
    
    # Replace the return statement
    content = re.sub(
        r'(\s+)(return result)',
        new_code.replace('return result', r'\1\2'),
        content
    )
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print("✅ Fixed base_music.py - added 'key' field generation")
else:
    print("ℹ️  base_music.py already has 'key' field handling")
EOF

# Create limiter config
sudo mkdir -p /etc/searxng
sudo tee /etc/searxng/limiter.toml > /dev/null << 'EOF'
[botdetection.ip_limit]
enable = true
limit = 100
window = 300

[botdetection.link_token]
enable = false

[real_ip]
x_forwarded_for = 1
EOF

echo "✅ Created /etc/searxng/limiter.toml"

# Restart SearXNG
echo "🔄 Restarting SearXNG..."
sudo systemctl restart searxng || echo "⚠️  Please restart SearXNG manually"

echo "✅ Fixes applied! Test with: python3 test_music_engines_fixed.py"
```

## Testing

After applying fixes, test each engine:

```bash
# Test individual engines
curl "http://localhost:8888/search?q=test&engines=radio%20paradise&format=json"
curl "http://localhost:8888/search?q=test&engines=apple%20music%20web&format=json"
curl "http://localhost:8888/search?q=test&engines=pitchfork&format=json"
```