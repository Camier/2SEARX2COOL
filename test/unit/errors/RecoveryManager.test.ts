import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecoveryManager, RecoveryStrategy } from '../../../src/main/errors/RecoveryManager';
import { ErrorInfo } from '../../../src/main/errors/ErrorManager';
import { app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/test/user/data'),
    quit: vi.fn(),
    relaunch: vi.fn()
  },
  dialog: {
    showMessageBox: vi.fn(() => Promise.resolve({ response: 2 })) // Default to 'ignore'
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  },
  session: {
    defaultSession: {
      clearCache: vi.fn(() => Promise.resolve()),
      clearStorageData: vi.fn(() => Promise.resolve())
    }
  }
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('fs/promises');

// Mock other managers
vi.mock('../../../src/main/window', () => ({
  createWindow: vi.fn()
}));

vi.mock('../../../src/main/database/DatabaseManager', () => ({
  DatabaseManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../src/main/server/ServerManager', () => ({
  ServerManager: vi.fn().mockImplementation(() => ({
    stop: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../src/main/plugins/PluginManager', () => ({
  PluginManager: vi.fn().mockImplementation(() => ({
    disablePlugin: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../src/main/cache/CacheManager', () => ({
  CacheManager: vi.fn().mockImplementation(() => ({
    clear: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../src/main/config/ConfigStore', () => ({
  ConfigStore: vi.fn().mockImplementation(() => ({
    getAll: vi.fn().mockResolvedValue({}),
    clear: vi.fn().mockResolvedValue(undefined),
    setDefaults: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('RecoveryManager', () => {
  let recoveryManager: RecoveryManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    recoveryManager = new RecoveryManager();
    
    // Mock fs operations
    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.writeFile).mockResolvedValue();
  });

  afterEach(async () => {
    await recoveryManager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await recoveryManager.initialize();
      
      // Should have default strategies registered
      const stats = recoveryManager.getRecoveryStats();
      expect(stats).toBeDefined();
    });

    it('should load previous recovery state', async () => {
      const mockState = {
        lastRecoveryAttempt: Date.now() - 10000,
        recoveryCount: 3,
        failedRecoveries: ['test-strategy'],
        successfulRecoveries: ['window-recovery']
      };

      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockState));

      await recoveryManager.initialize();

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulStrategies).toContain('window-recovery');
      expect(stats.failedStrategies).toContain('test-strategy');
    });
  });

  describe('strategy registration', () => {
    it('should register custom strategies', async () => {
      await recoveryManager.initialize();

      const customStrategy: RecoveryStrategy = {
        name: 'custom-recovery',
        description: 'Custom recovery strategy',
        priority: 50,
        canRecover: (error) => error.error.message.includes('custom'),
        recover: async () => true
      };

      recoveryManager.registerStrategy(customStrategy);
      
      // Should use custom strategy for matching errors
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('custom error'),
        severity: 'medium',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      const result = await recoveryManager.attemptRecovery(error);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('custom-recovery');
    });
  });

  describe('recovery attempts', () => {
    beforeEach(async () => {
      await recoveryManager.initialize();
    });

    it('should attempt window recovery for renderer crashes', async () => {
      const mockWindow = {
        isDestroyed: vi.fn(() => true),
        reload: vi.fn(),
        webContents: { id: 1 }
      };

      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow as any]);

      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Renderer crashed'),
        severity: 'critical',
        source: 'renderer',
        handled: false,
        sessionId: 'test',
        context: {
          details: { reason: 'crashed' },
          webContentsId: 1
        }
      };

      const result = await recoveryManager.attemptRecovery(error);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('window-recovery');
    });

    it('should attempt database recovery for database errors', async () => {
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('SQLITE_CORRUPT: database disk image is malformed'),
        severity: 'high',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      const result = await recoveryManager.attemptRecovery(error);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('database-recovery');
    });

    it('should attempt server recovery for server errors', async () => {
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('EADDRINUSE: address already in use'),
        severity: 'high',
        source: 'server',
        handled: false,
        sessionId: 'test'
      };

      const result = await recoveryManager.attemptRecovery(error);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('server-recovery');
    });

    it('should try strategies in priority order', async () => {
      const executionOrder: string[] = [];

      // Register multiple strategies that all match
      recoveryManager.registerStrategy({
        name: 'low-priority',
        description: 'Low priority',
        priority: 10,
        canRecover: () => true,
        recover: async () => {
          executionOrder.push('low');
          return false; // Fail to try next
        }
      });

      recoveryManager.registerStrategy({
        name: 'high-priority',
        description: 'High priority',
        priority: 200,
        canRecover: () => true,
        recover: async () => {
          executionOrder.push('high');
          return false; // Fail to try next
        }
      });

      recoveryManager.registerStrategy({
        name: 'medium-priority',
        description: 'Medium priority',
        priority: 50,
        canRecover: () => true,
        recover: async () => {
          executionOrder.push('medium');
          return true; // Success
        }
      });

      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Test error'),
        severity: 'medium',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      const result = await recoveryManager.attemptRecovery(error);
      
      expect(executionOrder).toEqual(['high', 'medium']);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('medium-priority');
    });

    it('should skip previously failed strategies', async () => {
      // Set up recovery state with failed strategy
      (recoveryManager as any).recoveryState = {
        lastRecoveryAttempt: Date.now(),
        recoveryCount: 1,
        failedRecoveries: ['database-recovery'],
        successfulRecoveries: []
      };

      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('database error'),
        severity: 'high',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      const result = await recoveryManager.attemptRecovery(error);
      expect(result.success).toBe(false); // Database recovery should be skipped
    });
  });

  describe('recovery loop detection', () => {
    beforeEach(async () => {
      await recoveryManager.initialize();
    });

    it('should detect recovery loops', async () => {
      // Simulate multiple recovery attempts
      const state = (recoveryManager as any).recoveryState;
      state.lastRecoveryAttempt = Date.now() - 1000; // 1 second ago
      state.recoveryCount = 5; // Max attempts

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.isInRecoveryLoop).toBe(true);
    });

    it('should reset recovery count after time window', async () => {
      // Set old recovery state
      const state = (recoveryManager as any).recoveryState;
      state.lastRecoveryAttempt = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      state.recoveryCount = 5;
      state.failedRecoveries = ['test1', 'test2'];

      // Attempt new recovery
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('New error'),
        severity: 'medium',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      await recoveryManager.attemptRecovery(error);

      // Should have reset counters
      expect(state.recoveryCount).toBe(1);
      expect(state.failedRecoveries).toHaveLength(0);
    });

    it('should skip recovery when in loop', async () => {
      // Put manager in recovery loop state
      const state = (recoveryManager as any).recoveryState;
      state.lastRecoveryAttempt = Date.now() - 1000;
      state.recoveryCount = 10; // Well over limit

      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Another error'),
        severity: 'high',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      const result = await recoveryManager.attemptRecovery(error);
      expect(result.success).toBe(false);
      expect(result.strategy).toBeUndefined();
    });
  });

  describe('user prompts', () => {
    it('should prompt user for recovery options', async () => {
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Critical failure'),
        severity: 'critical',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      // Test different user responses
      const responses = [
        { response: 0, expected: 'retry' },
        { response: 1, expected: 'reset' },
        { response: 2, expected: 'ignore' },
        { response: 3, expected: 'quit' }
      ];

      for (const { response, expected } of responses) {
        vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response } as any);
        const result = await recoveryManager.promptUserForRecovery(error);
        expect(result).toBe(expected);
      }
    });
  });

  describe('specific recovery strategies', () => {
    beforeEach(async () => {
      await recoveryManager.initialize();
    });

    it('should recover from memory issues', async () => {
      // Mock global.gc
      global.gc = vi.fn();

      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('JavaScript heap out of memory'),
        severity: 'critical',
        source: 'main',
        handled: false,
        sessionId: 'test',
        systemInfo: {
          platform: 'linux',
          version: '1.0.0',
          memory: {
            rss: 1000000000,
            heapTotal: 500000000,
            heapUsed: 450000000, // 90% used
            external: 100000000,
            arrayBuffers: 50000000
          },
          uptime: 3600
        }
      };

      const result = await recoveryManager.attemptRecovery(error);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('memory-recovery');
      expect(global.gc).toHaveBeenCalled();
    });

    it('should recover from config errors', async () => {
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Unexpected token in JSON at position 0'),
        severity: 'high',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      const result = await recoveryManager.attemptRecovery(error);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('config-recovery');
    });

    it('should disable problematic plugins', async () => {
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Plugin crashed'),
        severity: 'high',
        source: 'plugin',
        handled: false,
        sessionId: 'test',
        context: {
          pluginId: 'problematic-plugin'
        }
      };

      const result = await recoveryManager.attemptRecovery(error);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('plugin-recovery');
    });
  });

  describe('state persistence', () => {
    it('should save recovery state', async () => {
      await recoveryManager.initialize();

      // Perform a recovery
      const error: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Test error'),
        severity: 'medium',
        source: 'main',
        handled: false,
        sessionId: 'test'
      };

      // Register a successful strategy
      recoveryManager.registerStrategy({
        name: 'test-success',
        description: 'Test',
        priority: 100,
        canRecover: () => true,
        recover: async () => true
      });

      await recoveryManager.attemptRecovery(error);

      // Should have saved state
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('recovery-state.json'),
        expect.stringContaining('test-success'),
        'utf-8'
      );
    });
  });
});