# Unified Configuration System

The unified configuration system enables seamless operation between web service mode and desktop application mode for 2SEARX2COOL.

## Overview

This system merges Python service configurations with Electron app settings, providing:
- **Dual-mode operation**: Service-only, Desktop-only, or Hybrid mode
- **Configuration synchronization**: Changes in one system reflect in the other
- **Type safety**: Validated configurations with schemas
- **Hot reloading**: Automatic detection of configuration changes
- **Environment flexibility**: Support for different deployment scenarios

## Architecture

```
config/
├── unified/
│   ├── config-manager.js         # Node.js configuration manager
│   ├── config_loader.py          # Python configuration loader
│   ├── config_bridge.py          # Auto-generated Python bridge
│   ├── unified-config.json       # Merged configuration
│   ├── app-settings.json         # Electron app settings
│   └── user-preferences.json     # User preferences
├── music_engines.yml             # Music engine configurations
├── orchestrator.yml              # Orchestrator service config
└── searxng-settings.yml          # SearXNG core settings
```

## Operating Modes

### 1. Service Mode (`APP_MODE=service`)
- Only Python services run (SearXNG + Orchestrator)
- No Electron GUI
- Suitable for server deployments

### 2. Desktop Mode (`APP_MODE=desktop`)
- Electron app connects to external services
- Services must be running separately
- Suitable for distributed setups

### 3. Hybrid Mode (`APP_MODE=hybrid`) - Default
- Electron app starts internal services
- All-in-one desktop application
- Best for typical desktop users

## Configuration Files

### Python Service Configurations

#### `music_engines.yml`
Contains music engine configurations including:
- API credentials (use environment variables)
- Rate limiting settings
- Cache configuration
- Fallback chains for search types

#### `orchestrator.yml`
Defines orchestrator service settings:
- Database connection
- JWT configuration
- Redis settings
- CORS policies

#### `searxng-settings.yml`
Core SearXNG configuration:
- Search settings
- Engine definitions
- UI preferences

### Electron App Configurations

#### `app-settings.json`
Application-level settings:
```json
{
  "theme": "system",
  "language": "en",
  "serverPort": 8888,
  "orchestratorPort": 8889,
  "autoStart": false,
  "minimizeToTray": true,
  "globalShortcuts": true
}
```

#### `user-preferences.json`
User-specific preferences:
```json
{
  "defaultEngine": "all",
  "safeSearch": "moderate",
  "resultsPerPage": 20,
  "openInNewTab": true,
  "searchHistory": {
    "enabled": true,
    "maxItems": 1000,
    "clearOnExit": false
  }
}
```

### Unified Configuration

#### `unified-config.json`
Auto-generated merged configuration containing all settings in a structured format.

## Usage

### Node.js/Electron

```javascript
const UnifiedConfigManager = require('./config/unified/config-manager');
const configManager = new UnifiedConfigManager();

// Get configuration value
const port = configManager.get('service.searxng.port');

// Set configuration value
configManager.set('appSettings.theme', 'dark');

// Listen for changes
configManager.on('config:changed', (path, value) => {
  console.log(`Config ${path} changed to ${value}`);
});

// Validate configuration
const validation = configManager.validate();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Python

```python
from config.unified.config_loader import get_config_loader

# Get configuration loader
config = get_config_loader()

# Load service configuration
service_config = config.get_service_config()
print(f"SearXNG Port: {service_config.searxng_port}")

# Get specific engine config
discogs_config = config.get_music_engine_config('discogs')

# Check operating mode
if config.is_desktop_mode():
    print("Running in desktop mode")

# Validate configuration
validation = config.validate()
if not validation['valid']:
    print("Errors:", validation['errors'])
```

### TypeScript (Electron Main Process)

```typescript
import { unifiedConfigManager } from './config/UnifiedConfigManager';

// Get configuration
const config = await unifiedConfigManager.getUnified();

// Set operating mode
await unifiedConfigManager.setMode('hybrid');

// Listen for configuration changes
unifiedConfigManager.on('config:reloaded', (configName) => {
  console.log(`${configName} was reloaded`);
});

// Export for Python services
const pythonConfig = unifiedConfigManager.exportForPython();
```

## Synchronization

### Manual Sync
```bash
# Sync configurations
node scripts/sync-config.js

# Watch for changes and auto-sync
node scripts/sync-config.js --watch
```

### Automatic Sync
The configuration managers automatically sync when:
- Files are modified
- Electron ConfigStore changes
- Manual reload is triggered

## Environment Variables

The system respects these environment variables:
- `APP_MODE`: Operating mode (service/desktop/hybrid)
- `DATABASE_URL`: PostgreSQL connection string
- `DISCOGS_API_TOKEN`: Discogs API token
- `JAMENDO_API_KEY`: Jamendo API key
- `JWT_SECRET_KEY`: JWT signing key

## Starting the Application

### Unified Startup
```bash
# Default hybrid mode
./scripts/start-unified.sh

# Service mode only
./scripts/start-unified.sh --service

# Desktop mode only
./scripts/start-unified.sh --desktop

# Sync config before start
./scripts/start-unified.sh --sync-config

# Development mode
./scripts/start-unified.sh --dev
```

## Best Practices

1. **API Keys**: Store in environment variables, not in config files
2. **Validation**: Always validate configuration before use
3. **Defaults**: Provide sensible defaults for all settings
4. **Backwards Compatibility**: Maintain compatibility with existing configs
5. **Type Safety**: Use schemas to validate configuration structure

## Troubleshooting

### Configuration Not Loading
- Check file permissions
- Verify YAML/JSON syntax
- Look for error messages in logs

### Port Conflicts
- Ensure SearXNG and Orchestrator use different ports
- Check no other services are using the ports

### Service Connection Issues
- Verify Redis is running
- Check PostgreSQL connection
- Ensure correct mode is set

## Development

### Adding New Configuration Options

1. Update the schema in `UnifiedConfigManager.ts`
2. Add defaults in `config-manager.js`
3. Update `config_loader.py` if needed
4. Run sync to regenerate unified config
5. Document the new option

### Testing Configuration Changes

```bash
# Validate all configurations
cd config/unified
python config_loader.py

# Test configuration sync
node scripts/sync-config.js
```

## Migration from Separate Configs

If migrating from separate Python/Electron setups:

1. Copy existing config files to `config/` directory
2. Run `node scripts/sync-config.js`
3. Verify `unified-config.json` contains all settings
4. Test in each operating mode

## Security Considerations

- API keys are stored as environment variables
- JWT secrets should be changed in production
- Database credentials should use secure storage
- Configuration files should have restricted permissions

## Future Enhancements

- [ ] Configuration UI in Electron app
- [ ] Remote configuration management
- [ ] Configuration profiles
- [ ] Automatic backup/restore
- [ ] Configuration migration tools