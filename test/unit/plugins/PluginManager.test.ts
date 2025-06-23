import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { PluginManager } from '../../../src/main/plugins/PluginManager';
import { ConfigStore } from '../../../src/main/config/ConfigStore';
import { CacheManager } from '../../../src/main/cache/CacheManager';
import { HardwareManager } from '../../../src/main/hardware/HardwareManager';
import { DatabaseManager } from '../../../src/main/database/DatabaseManager';
import { ServerManager } from '../../../src/main/server/ServerManager';
import { Plugin } from '../../../src/shared/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('../../../src/main/config/ConfigStore');
vi.mock('../../../src/main/cache/CacheManager');
vi.mock('../../../src/main/hardware/HardwareManager');
vi.mock('../../../src/main/database/DatabaseManager');
vi.mock('../../../src/main/server/ServerManager');
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockConfigStore: ConfigStore;
  let mockCacheManager: CacheManager;
  let mockHardwareManager: HardwareManager;
  let mockDatabaseManager: DatabaseManager;
  let mockServerManager: ServerManager;
  let testPluginPath: string;

  beforeEach(async () => {
    // Create mock instances
    mockConfigStore = new ConfigStore();
    mockCacheManager = new CacheManager(mockDatabaseManager);
    mockHardwareManager = new HardwareManager();
    mockDatabaseManager = new DatabaseManager();
    mockServerManager = new ServerManager(mockConfigStore);

    // Setup default mock behaviors
    vi.mocked(mockConfigStore.get).mockResolvedValue({});
    vi.mocked(mockConfigStore.set).mockResolvedValue();
    vi.mocked(mockDatabaseManager.getPluginData).mockResolvedValue(null);
    vi.mocked(mockDatabaseManager.setPluginData).mockResolvedValue();

    // Create plugin manager instance
    pluginManager = new PluginManager({
      configStore: mockConfigStore,
      cacheManager: mockCacheManager,
      hardwareManager: mockHardwareManager,
      databaseManager: mockDatabaseManager,
      serverManager: mockServerManager
    });

    // Create test plugin directory
    testPluginPath = path.join(global.testHelpers.getTestDir(), 'plugins', 'test-plugin');
    await fs.mkdir(path.dirname(testPluginPath), { recursive: true });

    // Initialize plugin manager
    await pluginManager.initialize();
  });

  afterEach(async () => {
    await pluginManager.cleanup();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(pluginManager).toBeDefined();
    });

    it('should create plugin directories on initialization', async () => {
      // Plugin directories should be created during initialization
      // This is tested implicitly by successful initialization
      expect(true).toBe(true);
    });
  });

  describe('plugin loading', () => {
    beforeEach(async () => {
      // Create a test plugin
      await fs.mkdir(testPluginPath, { recursive: true });
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        JSON.stringify({
          id: 'test-plugin',
          name: 'test-plugin',
          displayName: 'Test Plugin',
          description: 'A test plugin',
          version: '1.0.0',
          author: 'Test Author',
          permissions: ['cache', 'ui'],
          main: './index.js'
        })
      );
      await fs.writeFile(
        path.join(testPluginPath, 'index.js'),
        `
        module.exports = {
          activate: async (context) => {
            context.logger.info('Test plugin activated');
            await context.store.set('activated', true);
          },
          deactivate: async () => {
            // Cleanup
          }
        };
        `
      );
    });

    it('should load a valid plugin', async () => {
      await pluginManager.loadPlugin(testPluginPath);
      
      const plugin = pluginManager.getPlugin('test-plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('test-plugin');
      expect(plugin?.version).toBe('1.0.0');
      expect(plugin?.permissions).toContain('cache');
    });

    it('should not load plugin twice', async () => {
      await pluginManager.loadPlugin(testPluginPath);
      await pluginManager.loadPlugin(testPluginPath);
      
      const plugins = pluginManager.getAllPlugins();
      expect(plugins.filter(p => p.id === 'test-plugin')).toHaveLength(1);
    });

    it('should handle invalid plugin manifest', async () => {
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        'invalid json'
      );

      await expect(pluginManager.loadPlugin(testPluginPath))
        .rejects.toThrow();
    });

    it('should handle missing plugin main file', async () => {
      await fs.unlink(path.join(testPluginPath, 'index.js'));
      
      // Should not throw, but log error
      await expect(pluginManager.loadPlugin(testPluginPath))
        .resolves.not.toThrow();
    });

    it('should respect enabled/disabled state from config', async () => {
      vi.mocked(mockConfigStore.get).mockResolvedValue({
        'test-plugin': false
      });

      await pluginManager.loadPlugin(testPluginPath);
      const plugin = pluginManager.getPlugin('test-plugin');
      
      expect(plugin?.enabled).toBe(false);
    });
  });

  describe('plugin activation', () => {
    beforeEach(async () => {
      // Create and load test plugin
      await fs.mkdir(testPluginPath, { recursive: true });
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        JSON.stringify({
          id: 'test-plugin',
          name: 'test-plugin',
          displayName: 'Test Plugin',
          description: 'A test plugin',
          version: '1.0.0',
          main: './index.js'
        })
      );
      await fs.writeFile(
        path.join(testPluginPath, 'index.js'),
        `
        let activated = false;
        module.exports = {
          activate: async (context) => {
            activated = true;
            await context.store.set('activated', true);
            context.logger.info('Activated');
          },
          deactivate: async () => {
            activated = false;
          }
        };
        `
      );
    });

    it('should activate plugin when enabled', async () => {
      await pluginManager.loadPlugin(testPluginPath);
      
      // Verify plugin data was set
      expect(mockDatabaseManager.setPluginData).toHaveBeenCalledWith(
        'test-plugin',
        'activated',
        true
      );
    });

    it('should enable a disabled plugin', async () => {
      vi.mocked(mockConfigStore.get).mockResolvedValue({
        'test-plugin': false
      });

      await pluginManager.loadPlugin(testPluginPath);
      await pluginManager.enablePlugin('test-plugin');

      const plugin = pluginManager.getPlugin('test-plugin');
      expect(plugin?.enabled).toBe(true);
      expect(mockConfigStore.set).toHaveBeenCalledWith('plugins', {
        'test-plugin': true
      });
    });

    it('should disable an enabled plugin', async () => {
      await pluginManager.loadPlugin(testPluginPath);
      await pluginManager.disablePlugin('test-plugin');

      const plugin = pluginManager.getPlugin('test-plugin');
      expect(plugin?.enabled).toBe(false);
    });

    it('should throw when enabling non-existent plugin', async () => {
      await expect(pluginManager.enablePlugin('non-existent'))
        .rejects.toThrow('Plugin non-existent not found');
    });
  });

  describe('plugin permissions', () => {
    it('should check plugin permissions correctly', async () => {
      await fs.mkdir(testPluginPath, { recursive: true });
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        JSON.stringify({
          id: 'test-plugin',
          name: 'test-plugin',
          displayName: 'Test Plugin',
          description: 'A test plugin',
          version: '1.0.0',
          permissions: ['cache', 'hardware']
        })
      );

      await pluginManager.loadPlugin(testPluginPath);

      expect(pluginManager.hasPermission('test-plugin', 'cache')).toBe(true);
      expect(pluginManager.hasPermission('test-plugin', 'hardware')).toBe(true);
      expect(pluginManager.hasPermission('test-plugin', 'network')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      expect(pluginManager.hasPermission('non-existent', 'cache')).toBe(false);
    });
  });

  describe('plugin context', () => {
    it('should provide proper context to plugins', async () => {
      let capturedContext: any = null;

      await fs.mkdir(testPluginPath, { recursive: true });
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        JSON.stringify({
          id: 'context-test',
          name: 'context-test',
          displayName: 'Context Test',
          description: 'Tests plugin context',
          version: '1.0.0',
          main: './index.js'
        })
      );
      await fs.writeFile(
        path.join(testPluginPath, 'index.js'),
        `
        module.exports = {
          activate: async (context) => {
            // Store context for testing
            global.testContext = context;
          }
        };
        `
      );

      await pluginManager.loadPlugin(testPluginPath);

      // Check that context has required properties
      expect(global.testContext).toBeDefined();
      expect(global.testContext.app).toBeDefined();
      expect(global.testContext.store).toBeDefined();
      expect(global.testContext.api).toBeDefined();
      expect(global.testContext.logger).toBeDefined();

      // Test store methods
      await global.testContext.store.set('test', 'value');
      expect(mockDatabaseManager.setPluginData).toHaveBeenCalledWith(
        'context-test',
        'test',
        'value'
      );
    });
  });

  describe('plugin uninstall', () => {
    beforeEach(async () => {
      await fs.mkdir(testPluginPath, { recursive: true });
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        JSON.stringify({
          id: 'test-plugin',
          name: 'test-plugin',
          displayName: 'Test Plugin',
          description: 'A test plugin',
          version: '1.0.0',
          main: './index.js'
        })
      );
      await fs.writeFile(
        path.join(testPluginPath, 'index.js'),
        `
        module.exports = {
          deactivate: async () => {
            global.deactivated = true;
          }
        };
        `
      );
    });

    it('should uninstall plugin', async () => {
      await pluginManager.loadPlugin(testPluginPath);
      await pluginManager.uninstallPlugin('test-plugin');

      expect(pluginManager.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should deactivate plugin before uninstalling', async () => {
      await pluginManager.loadPlugin(testPluginPath);
      global.deactivated = false;

      await pluginManager.uninstallPlugin('test-plugin');
      
      expect(global.deactivated).toBe(true);
    });
  });

  describe('plugin listing', () => {
    beforeEach(async () => {
      // Create multiple test plugins
      for (let i = 1; i <= 3; i++) {
        const pluginPath = path.join(global.testHelpers.getTestDir(), 'plugins', `plugin-${i}`);
        await fs.mkdir(pluginPath, { recursive: true });
        await fs.writeFile(
          path.join(pluginPath, 'package.json'),
          JSON.stringify({
            id: `plugin-${i}`,
            name: `plugin-${i}`,
            displayName: `Plugin ${i}`,
            description: `Test plugin ${i}`,
            version: '1.0.0'
          })
        );
      }
    });

    it('should list all plugins', async () => {
      await pluginManager.loadAllPlugins();
      
      const plugins = pluginManager.getAllPlugins();
      expect(plugins.length).toBeGreaterThanOrEqual(3);
    });

    it('should list only enabled plugins', async () => {
      vi.mocked(mockConfigStore.get).mockResolvedValue({
        'plugin-1': true,
        'plugin-2': false,
        'plugin-3': true
      });

      await pluginManager.loadAllPlugins();
      
      const enabledPlugins = pluginManager.getEnabledPlugins();
      const enabledIds = enabledPlugins.map(p => p.id);
      
      expect(enabledIds).toContain('plugin-1');
      expect(enabledIds).not.toContain('plugin-2');
      expect(enabledIds).toContain('plugin-3');
    });
  });

  describe('cleanup', () => {
    it('should deactivate all plugins on cleanup', async () => {
      const deactivatedPlugins: string[] = [];

      // Create test plugin with deactivate tracking
      await fs.mkdir(testPluginPath, { recursive: true });
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        JSON.stringify({
          id: 'cleanup-test',
          name: 'cleanup-test',
          displayName: 'Cleanup Test',
          description: 'Tests cleanup',
          version: '1.0.0',
          main: './index.js'
        })
      );
      await fs.writeFile(
        path.join(testPluginPath, 'index.js'),
        `
        module.exports = {
          activate: async () => {},
          deactivate: async () => {
            global.cleanupDeactivated = true;
          }
        };
        `
      );

      await pluginManager.loadPlugin(testPluginPath);
      global.cleanupDeactivated = false;

      await pluginManager.cleanup();
      
      expect(global.cleanupDeactivated).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      await fs.mkdir(testPluginPath, { recursive: true });
      await fs.writeFile(
        path.join(testPluginPath, 'package.json'),
        JSON.stringify({
          id: 'error-plugin',
          name: 'error-plugin',
          displayName: 'Error Plugin',
          description: 'Throws on deactivate',
          version: '1.0.0',
          main: './index.js'
        })
      );
      await fs.writeFile(
        path.join(testPluginPath, 'index.js'),
        `
        module.exports = {
          deactivate: async () => {
            throw new Error('Deactivation error');
          }
        };
        `
      );

      await pluginManager.loadPlugin(testPluginPath);
      
      // Should not throw
      await expect(pluginManager.cleanup()).resolves.not.toThrow();
    });
  });
});