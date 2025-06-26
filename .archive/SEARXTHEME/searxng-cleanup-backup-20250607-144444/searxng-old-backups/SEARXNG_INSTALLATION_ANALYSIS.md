# SearXNG Development Installation Analysis

## Installation Details

### Location and Structure
- **Main Directory**: `/home/mik/projects/active/searxng`
- **Symlink**: `/home/mik/searxng` → `/home/mik/projects/active/searxng`
- **Virtual Environment**: `/home/mik/searxng/searxng-env/`
- **Python Version**: Using virtual environment Python at `/home/mik/searxng/searxng-env/bin/python`

### Service Configuration
- **Port**: 8888 (configured in settings.yml)
- **Bind Address**: 0.0.0.0 
- **Process**: Running as user 'mik' via systemd service
- **Method**: POST (default for searches)
- **Protocol**: HTTP/1.0

### Theme Configuration
- **Active Theme**: `deadcat` (custom terminal-style theme)
- **Theme Location**: `searx/templates/deadcat/`
- **Purpose**: Memorial search engine for a cat named Alfred
- **Aesthetic**: Terminal green on black, Matrix-style interface
- **URL**: https://alfredisgone.duckdns.org:22760

### Issue Analysis and Resolution

#### Problem
Plugin results (calculator, hash functions, unit conversions) were displaying as Python object representations instead of formatted results.

**Example of broken output**:
```
Answer(url=None, template='answer/legacy.html', engine='plugin: calculator', parsed_url=None, answer='2+2 = 4')
```

#### Root Cause
The `results.html` template in the deadcat theme had:
1. Duplicate answer rendering blocks
2. Broken Jinja2 syntax with orphaned tags
3. Incorrect access to answer objects (using `{{ answer }}` instead of `{{ answer.answer }}`)
4. Multiple failed patch attempts that compounded the issues

#### Solution Applied
Created a clean, properly structured template that:
- Correctly iterates over answers: `{% for answer in answers %}`
- Properly accesses answer content: `{{ answer.answer }}`
- Maintains terminal aesthetic with proper styling
- Includes all necessary features (pagination, categories, time filters)

### Active Plugins
Based on settings.yml, these plugins are enabled:
- Calculator (`searx.plugins.calculator`)
- Hash Plugin (`searx.plugins.hash_plugin`) 
- Self Info (`searx.plugins.self_info`)
- Unit Converter (`searx.plugins.unit_converter`)
- Ahmia Filter (`searx.plugins.ahmia_filter`)
- Hostnames (`searx.plugins.hostnames`)

### Key Features
1. **Categories**: general, images, videos, news, map, music, it, science, files, social media
2. **Search Engines**: Multiple engines configured including DuckDuckGo, Google, Bing, Wikipedia
3. **Autocomplete**: Using DuckDuckGo autocomplete
4. **Time Range Support**: Past day, week, month, year filters
5. **Language**: Auto-detection enabled

### Testing the Fix
To verify plugin results display correctly:

1. **Calculator Test**: Search "2+2"
   - Should show: `4` in a styled terminal box

2. **Hash Test**: Search "sha256 test"  
   - Should show the SHA256 hash value

3. **Unit Conversion Test**: Search "10 miles to km"
   - Should show: `16.0934 kilometers`

### File Backups
Multiple backups exist for the results.html template:
- `results.html.backup.20250526_094755`
- `results.html.backup.20250526_100103`
- `results.html.backup.20250526_104010`
- `results.html.backup.20250526_104147`
- `results.html.backup.20250526_105523`
- `results.html.backup.20250526_125332`
- `results.html.backup.20250526_125423`
- `results.html.backup.20250526_125451`

### Maintenance Scripts
Numerous maintenance and fix scripts are available:
- `restart_searxng_test.sh` - Restart service with cache clear
- `check_searxng_logs.sh` - View service logs
- `fix_searxng_service.sh` - Service repair script
- `test_plugin_fix.sh` - Test plugin functionality

### Memorial Elements
The search engine serves as a memorial with:
- Terminal prompt: `search@alfredisgone:~$`
- Window title: `SEARCH_RESULTS.EXE`
- Green terminal aesthetic representing "system terminated"
- French memorial messages preserved in the interface

## Recommendations

1. **Monitor Logs**: Check for template errors after changes
2. **Test Thoroughly**: Verify all plugin types work correctly
3. **Preserve Backups**: Keep working template backups before modifications
4. **Document Changes**: Track all template modifications for troubleshooting

The installation is now functional with plugin results displaying correctly while maintaining the memorial terminal aesthetic.
