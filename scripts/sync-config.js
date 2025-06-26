#!/usr/bin/env node
/**
 * Configuration Synchronization Script
 * Ensures configurations are consistent between Electron app and Python services
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ConfigSync {
  constructor() {
    this.configDir = path.join(__dirname, '..', 'config');
    this.unifiedDir = path.join(this.configDir, 'unified');
    
    // Ensure unified directory exists
    if (!fs.existsSync(this.unifiedDir)) {
      fs.mkdirSync(this.unifiedDir, { recursive: true });
    }
  }
  
  /**
   * Load YAML file
   */
  loadYaml(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      return null;
    }
  }
  
  /**
   * Load JSON file
   */
  loadJson(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Error loading ${filePath}:`, error.message);
      }
      return null;
    }
  }
  
  /**
   * Save JSON file
   */
  saveJson(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✓ Saved ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`Error saving ${filePath}:`, error.message);
    }
  }
  
  /**
   * Initialize default configurations
   */
  initializeDefaults() {
    // Default app settings
    const appSettingsPath = path.join(this.unifiedDir, 'app-settings.json');
    if (!fs.existsSync(appSettingsPath)) {
      this.saveJson(appSettingsPath, {
        theme: 'system',
        language: 'en',
        serverPort: 8888,
        orchestratorPort: 8889,
        autoStart: false,
        minimizeToTray: true,
        globalShortcuts: true,
        startInTray: false,
        showDeveloperTools: false
      });
    }
    
    // Default user preferences
    const userPrefsPath = path.join(this.unifiedDir, 'user-preferences.json');
    if (!fs.existsSync(userPrefsPath)) {
      this.saveJson(userPrefsPath, {
        defaultEngine: 'all',
        safeSearch: 'moderate',
        resultsPerPage: 20,
        openInNewTab: true,
        searchHistory: {
          enabled: true,
          maxItems: 1000,
          clearOnExit: false
        },
        recentSearches: [],
        favoriteEngines: [],
        blockedDomains: []
      });
    }
  }
  
  /**
   * Sync configuration files
   */
  sync() {
    console.log('🔄 Starting configuration synchronization...\n');
    
    // Initialize defaults
    this.initializeDefaults();
    
    // Load all configurations
    const configs = {
      musicEngines: this.loadYaml(path.join(this.configDir, 'music_engines.yml')),
      orchestrator: this.loadYaml(path.join(this.configDir, 'orchestrator.yml')),
      searxngSettings: this.loadYaml(path.join(this.configDir, 'searxng-settings.yml')),
      appSettings: this.loadJson(path.join(this.unifiedDir, 'app-settings.json')),
      userPreferences: this.loadJson(path.join(this.unifiedDir, 'user-preferences.json'))
    };
    
    // Validate configurations
    const errors = this.validate(configs);
    if (errors.length > 0) {
      console.error('❌ Configuration validation failed:');
      errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }
    
    // Create unified configuration
    const unified = this.createUnifiedConfig(configs);
    
    // Save unified configuration
    this.saveJson(path.join(this.unifiedDir, 'unified-config.json'), unified);
    
    // Create Python config bridge
    this.createPythonBridge(unified);
    
    // Create environment file
    this.createEnvFile(unified);
    
    console.log('\n✅ Configuration synchronization complete!');
    
    // Display summary
    this.displaySummary(unified);
  }
  
  /**
   * Validate configurations
   */
  validate(configs) {
    const errors = [];
    
    // Check required configurations
    if (!configs.musicEngines) {
      errors.push('music_engines.yml not found');
    }
    
    if (!configs.orchestrator) {
      errors.push('orchestrator.yml not found');
    }
    
    if (!configs.searxngSettings) {
      errors.push('searxng-settings.yml not found');
    }
    
    // Validate ports
    if (configs.appSettings) {
      const { serverPort, orchestratorPort } = configs.appSettings;
      
      if (serverPort === orchestratorPort) {
        errors.push('Server and orchestrator ports must be different');
      }
      
      if (serverPort < 1024 || serverPort > 65535) {
        errors.push('Server port must be between 1024 and 65535');
      }
      
      if (orchestratorPort < 1024 || orchestratorPort > 65535) {
        errors.push('Orchestrator port must be between 1024 and 65535');
      }
    }
    
    return errors;
  }
  
  /**
   * Create unified configuration
   */
  createUnifiedConfig(configs) {
    const appSettings = configs.appSettings || {};
    
    return {
      mode: process.env.APP_MODE || 'hybrid',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      
      service: {
        searxng: {
          port: appSettings.serverPort || 8888,
          host: '0.0.0.0',
          settings: configs.searxngSettings || {}
        },
        orchestrator: {
          port: appSettings.orchestratorPort || 8889,
          host: '0.0.0.0',
          database: configs.orchestrator?.DATABASE,
          redis: configs.orchestrator?.REDIS,
          jwt: configs.orchestrator?.JWT,
          websocket: configs.orchestrator?.WEBSOCKET,
          cors: configs.orchestrator?.CORS
        },
        engines: {
          music: configs.musicEngines || {}
        }
      },
      
      app: {
        settings: appSettings,
        preferences: configs.userPreferences || {}
      },
      
      shared: {
        redis: {
          host: 'localhost',
          port: 6379,
          databases: {
            cache: 0,
            websocket: 1,
            sessions: 2,
            pubsub: 3
          }
        },
        database: {
          url: process.env.DATABASE_URL || 
               configs.orchestrator?.DATABASE?.SQLALCHEMY_DATABASE_URI ||
               'postgresql:///searxng_cool_music'
        },
        api: {
          baseUrl: `http://localhost:${appSettings.serverPort || 8888}`,
          orchestratorUrl: `http://localhost:${appSettings.orchestratorPort || 8889}`,
          websocketUrl: `ws://localhost:${appSettings.orchestratorPort || 8889}`
        },
        paths: {
          config: this.configDir,
          unified: this.unifiedDir,
          root: path.dirname(this.configDir)
        }
      }
    };
  }
  
  /**
   * Create Python configuration bridge
   */
  createPythonBridge(unified) {
    const bridgeContent = `# Auto-generated Python configuration bridge
# Generated at: ${new Date().toISOString()}

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Service ports
SEARXNG_PORT = ${unified.service.searxng.port}
ORCHESTRATOR_PORT = ${unified.service.orchestrator.port}

# Redis configuration
REDIS_HOST = '${unified.shared.redis.host}'
REDIS_PORT = ${unified.shared.redis.port}
REDIS_CACHE_DB = ${unified.shared.redis.databases.cache}
REDIS_WEBSOCKET_DB = ${unified.shared.redis.databases.websocket}
REDIS_SESSIONS_DB = ${unified.shared.redis.databases.sessions}

# Database
DATABASE_URL = '${unified.shared.database.url}'

# API URLs
SEARXNG_URL = '${unified.shared.api.baseUrl}'
ORCHESTRATOR_URL = '${unified.shared.api.orchestratorUrl}'
WEBSOCKET_URL = '${unified.shared.api.websocketUrl}'

# Operating mode
APP_MODE = '${unified.mode}'

# Paths
CONFIG_DIR = Path('${unified.shared.paths.config}')
UNIFIED_DIR = Path('${unified.shared.paths.unified}')
ROOT_DIR = Path('${unified.shared.paths.root}')
`;
    
    const bridgePath = path.join(this.unifiedDir, 'config_bridge.py');
    fs.writeFileSync(bridgePath, bridgeContent);
    console.log('✓ Created Python configuration bridge');
  }
  
  /**
   * Create environment file
   */
  createEnvFile(unified) {
    const envContent = `# Auto-generated environment configuration
# Generated at: ${new Date().toISOString()}

# Application mode
APP_MODE=${unified.mode}

# Service ports
SEARXNG_PORT=${unified.service.searxng.port}
ORCHESTRATOR_PORT=${unified.service.orchestrator.port}

# Redis
REDIS_HOST=${unified.shared.redis.host}
REDIS_PORT=${unified.shared.redis.port}

# Database
DATABASE_URL=${unified.shared.database.url}

# JWT Secret (change in production!)
JWT_SECRET_KEY=${unified.service.orchestrator.jwt?.JWT_SECRET_KEY || 'change-me-in-production'}

# CORS Origins
CORS_ORIGINS=${JSON.stringify(unified.service.orchestrator.cors?.ORIGINS || [])}

# API Keys (add your keys here)
# DISCOGS_API_TOKEN=your-token-here
# JAMENDO_API_KEY=your-key-here
`;
    
    const envPath = path.join(this.configDir, '..', '.env');
    
    // Only create if doesn't exist (don't overwrite existing)
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, envContent);
      console.log('✓ Created .env file (add your API keys)');
    } else {
      console.log('ℹ️  .env file already exists (skipped)');
    }
  }
  
  /**
   * Display configuration summary
   */
  displaySummary(unified) {
    console.log('\n📊 Configuration Summary:');
    console.log('─'.repeat(40));
    console.log(`Mode: ${unified.mode}`);
    console.log(`SearXNG Port: ${unified.service.searxng.port}`);
    console.log(`Orchestrator Port: ${unified.service.orchestrator.port}`);
    console.log(`Redis: ${unified.shared.redis.host}:${unified.shared.redis.port}`);
    console.log(`Database: ${unified.shared.database.url.split('///')[1] || 'configured'}`);
    
    // Count enabled engines
    let enabledEngines = 0;
    if (unified.service.engines.music?.engines) {
      Object.values(unified.service.engines.music.engines).forEach(engine => {
        if (engine.enabled) enabledEngines++;
      });
    }
    console.log(`Enabled Music Engines: ${enabledEngines}`);
    
    console.log('─'.repeat(40));
  }
  
  /**
   * Watch for configuration changes
   */
  watch() {
    console.log('👁️  Watching for configuration changes...');
    
    const configFiles = [
      path.join(this.configDir, 'music_engines.yml'),
      path.join(this.configDir, 'orchestrator.yml'),
      path.join(this.configDir, 'searxng-settings.yml'),
      path.join(this.unifiedDir, 'app-settings.json'),
      path.join(this.unifiedDir, 'user-preferences.json')
    ];
    
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.watchFile(file, { interval: 2000 }, () => {
          console.log(`\n🔄 ${path.basename(file)} changed, re-syncing...`);
          this.sync();
        });
      }
    });
    
    console.log('Press Ctrl+C to stop watching\n');
  }
}

// CLI interface
if (require.main === module) {
  const sync = new ConfigSync();
  const args = process.argv.slice(2);
  
  if (args.includes('--watch') || args.includes('-w')) {
    sync.sync();
    sync.watch();
  } else {
    sync.sync();
  }
}

module.exports = ConfigSync;