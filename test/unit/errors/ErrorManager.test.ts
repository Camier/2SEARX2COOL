import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorManager, ErrorInfo } from '../../../src/main/errors/ErrorManager';
import { app, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/test/user/data'),
    getVersion: vi.fn(() => '1.0.0'),
    quit: vi.fn(),
    relaunch: vi.fn()
  },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 2 })) // Continue by default
  },
  crashReporter: {
    start: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
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

describe('ErrorManager', () => {
  let errorManager: ErrorManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    errorManager = new ErrorManager();
    
    // Mock fs operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.appendFile).mockResolvedValue();
  });

  afterEach(async () => {
    await errorManager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await errorManager.initialize();
      
      // Should create error log directory
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('logs/errors'),
        { recursive: true }
      );
    });

    it('should not initialize twice', async () => {
      await errorManager.initialize();
      await errorManager.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledTimes(1);
    });

    it('should load previous errors on initialization', async () => {
      const mockErrorFiles = ['error_123.json', 'error_456.json', 'other.txt'];
      const mockError: ErrorInfo = {
        id: '123',
        timestamp: Date.now(),
        error: new Error('Previous error'),
        severity: 'medium',
        source: 'main',
        handled: true,
        sessionId: 'old-session'
      };

      vi.mocked(fs.readdir).mockResolvedValue(mockErrorFiles as any);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockError));

      await errorManager.initialize();

      const errors = await errorManager.getErrors();
      expect(errors).toHaveLength(2); // Both error files
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await errorManager.initialize();
    });

    it('should handle and store errors', async () => {
      const error = new Error('Test error');
      
      await errorManager.handleError({
        error,
        severity: 'medium',
        source: 'main',
        handled: true,
        context: { test: true }
      });

      const errors = await errorManager.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error.message).toBe('Test error');
      expect(errors[0].severity).toBe('medium');
      expect(errors[0].context).toEqual({ test: true });
    });

    it('should persist errors to disk', async () => {
      const error = new Error('Persistent error');
      
      await errorManager.handleError({
        error,
        severity: 'high',
        source: 'renderer',
        handled: false
      });

      // Should write JSON file
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('Persistent error'),
        'utf-8'
      );

      // Should append to daily log
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('.log'),
        expect.stringContaining('HIGH - renderer - Persistent error'),
        'utf-8'
      );
    });

    it('should handle critical errors with dialog', async () => {
      const error = new Error('Critical error');
      
      await errorManager.handleError({
        error,
        severity: 'critical',
        source: 'main',
        handled: false
      });

      expect(dialog.showMessageBox).toHaveBeenCalledWith({
        type: 'error',
        title: 'Critical Error',
        message: 'A critical error has occurred',
        detail: 'Critical error',
        buttons: ['Restart', 'Quit', 'Continue'],
        defaultId: 0,
        cancelId: 2
      });
    });

    it('should emit error events', async () => {
      const errorHandler = vi.fn();
      errorManager.on('error', errorHandler);

      const error = new Error('Event error');
      await errorManager.handleError({
        error,
        severity: 'low',
        source: 'plugin',
        handled: true
      });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Event error' }),
          severity: 'low',
          source: 'plugin'
        })
      );
    });

    it('should limit stored errors', async () => {
      // Set a small limit for testing
      (errorManager as any).maxErrors = 5;

      // Add more errors than the limit
      for (let i = 0; i < 10; i++) {
        await errorManager.handleError({
          error: new Error(`Error ${i}`),
          severity: 'low',
          source: 'main',
          handled: true
        });
      }

      const errors = await errorManager.getErrors();
      expect(errors).toHaveLength(5);
      
      // Should keep the most recent errors
      expect(errors[0].error.message).toBe('Error 9');
      expect(errors[4].error.message).toBe('Error 5');
    });
  });

  describe('recovery strategies', () => {
    beforeEach(async () => {
      await errorManager.initialize();
    });

    it('should attempt recovery for known error types', async () => {
      const recoveryHandler = vi.fn();
      errorManager.on('recovery', recoveryHandler);

      // Mock successful recovery
      const mockStrategy = vi.fn().mockResolvedValue(true);
      (errorManager as any).recoveryStrategies.set('test-error', mockStrategy);

      await errorManager.handleError({
        error: new Error('test-error: Something failed'),
        severity: 'high',
        source: 'main',
        handled: false
      });

      expect(mockStrategy).toHaveBeenCalled();
      expect(recoveryHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'test-error'
        })
      );
    });

    it('should handle recovery failures gracefully', async () => {
      const mockStrategy = vi.fn().mockRejectedValue(new Error('Recovery failed'));
      (errorManager as any).recoveryStrategies.set('failing-recovery', mockStrategy);

      // Should not throw
      await expect(errorManager.handleError({
        error: new Error('failing-recovery: Test'),
        severity: 'high',
        source: 'main',
        handled: false
      })).resolves.not.toThrow();
    });
  });

  describe('error querying', () => {
    beforeEach(async () => {
      await errorManager.initialize();
      
      // Add various test errors
      const errors = [
        { message: 'Error 1', severity: 'low', source: 'main' },
        { message: 'Error 2', severity: 'medium', source: 'renderer' },
        { message: 'Error 3', severity: 'high', source: 'plugin' },
        { message: 'Error 4', severity: 'critical', source: 'server' },
        { message: 'Error 5', severity: 'medium', source: 'main' }
      ];

      for (const err of errors) {
        await errorManager.handleError({
          error: new Error(err.message),
          severity: err.severity as any,
          source: err.source as any,
          handled: true
        });
      }
    });

    it('should filter errors by severity', async () => {
      const mediumErrors = await errorManager.getErrors({ severity: 'medium' });
      expect(mediumErrors).toHaveLength(2);
      expect(mediumErrors.every(e => e.severity === 'medium')).toBe(true);
    });

    it('should filter errors by source', async () => {
      const mainErrors = await errorManager.getErrors({ source: 'main' });
      expect(mainErrors).toHaveLength(2);
      expect(mainErrors.every(e => e.source === 'main')).toBe(true);
    });

    it('should filter errors by time', async () => {
      const since = Date.now() - 1000;
      const recentErrors = await errorManager.getErrors({ since });
      expect(recentErrors).toHaveLength(5); // All errors are recent
    });

    it('should limit error results', async () => {
      const limitedErrors = await errorManager.getErrors({ limit: 3 });
      expect(limitedErrors).toHaveLength(3);
    });

    it('should return errors sorted by timestamp descending', async () => {
      const errors = await errorManager.getErrors();
      
      for (let i = 1; i < errors.length; i++) {
        expect(errors[i].timestamp).toBeLessThanOrEqual(errors[i - 1].timestamp);
      }
    });
  });

  describe('error reporting', () => {
    beforeEach(async () => {
      await errorManager.initialize();
    });

    it('should generate error report', async () => {
      // Add test errors
      await errorManager.handleError({
        error: new Error('Test 1'),
        severity: 'low',
        source: 'main',
        handled: true
      });

      await errorManager.handleError({
        error: new Error('Test 2'),
        severity: 'high',
        source: 'renderer',
        handled: false
      });

      const report = await errorManager.generateReport();
      
      expect(report.summary.total).toBe(2);
      expect(report.summary.bySeverity).toEqual({
        low: 1,
        high: 1
      });
      expect(report.summary.bySource).toEqual({
        main: 1,
        renderer: 1
      });
      expect(report.errors).toHaveLength(2);
    });

    it('should generate report for time range', async () => {
      const now = Date.now();
      
      // Add old error
      await errorManager.handleError({
        error: new Error('Old error'),
        severity: 'low',
        source: 'main',
        handled: true
      });
      
      // Manually set timestamp to old
      const errors = (errorManager as any).errors;
      const oldError = Array.from(errors.values())[0] as ErrorInfo;
      oldError.timestamp = now - 10000;

      // Add recent error
      await errorManager.handleError({
        error: new Error('Recent error'),
        severity: 'medium',
        source: 'main',
        handled: true
      });

      const report = await errorManager.generateReport({
        start: now - 5000,
        end: now + 1000
      });

      expect(report.summary.total).toBe(1);
      expect(report.errors[0].error.message).toBe('Recent error');
    });
  });

  describe('error cleanup', () => {
    beforeEach(async () => {
      await errorManager.initialize();
    });

    it('should clear all errors', async () => {
      // Add errors
      for (let i = 0; i < 5; i++) {
        await errorManager.handleError({
          error: new Error(`Error ${i}`),
          severity: 'low',
          source: 'main',
          handled: true
        });
      }

      await errorManager.clearErrors();
      
      const errors = await errorManager.getErrors();
      expect(errors).toHaveLength(0);
    });

    it('should clear errors before specified time', async () => {
      const now = Date.now();
      
      // Add old and new errors
      for (let i = 0; i < 3; i++) {
        await errorManager.handleError({
          error: new Error(`Old error ${i}`),
          severity: 'low',
          source: 'main',
          handled: true
        });
      }

      // Set old timestamps
      const errors = (errorManager as any).errors;
      let index = 0;
      for (const [id, error] of errors) {
        if (index < 2) {
          error.timestamp = now - 10000;
        }
        index++;
      }

      await errorManager.clearErrors(now - 5000);
      
      const remainingErrors = await errorManager.getErrors();
      expect(remainingErrors).toHaveLength(1);
    });

    it('should clean up old error files', async () => {
      const mockFiles = ['error_old.json', 'error_new.json'];
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      
      const now = Date.now();
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify({ 
          timestamp: now - 10000 
        }))
        .mockResolvedValueOnce(JSON.stringify({ 
          timestamp: now 
        }));
      
      vi.mocked(fs.unlink).mockResolvedValue();

      await errorManager.clearErrors(now - 5000);

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('error_old.json')
      );
      expect(fs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining('error_new.json')
      );
    });
  });

  describe('global error handlers', () => {
    it('should handle uncaught exceptions', async () => {
      await errorManager.initialize();
      
      const error = new Error('Uncaught test error');
      process.emit('uncaughtException', error);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errors = await errorManager.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('critical');
      expect(errors[0].context.type).toBe('uncaughtException');
    });

    it('should handle unhandled rejections', async () => {
      await errorManager.initialize();
      
      const reason = new Error('Unhandled rejection');
      process.emit('unhandledRejection', reason, Promise.reject(reason));

      await new Promise(resolve => setTimeout(resolve, 100));

      const errors = await errorManager.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('high');
      expect(errors[0].context.type).toBe('unhandledRejection');
    });
  });
});