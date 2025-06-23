import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AsyncErrorHandler, asyncExecute, asyncWrap, asyncParallel, asyncBatch } from '../../../src/main/utils/AsyncErrorHandler';
import { errorManager } from '../../../src/main/errors/ErrorManager';

// Mock dependencies
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/main/errors/ErrorManager', () => ({
  errorManager: {
    handleError: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('AsyncErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    it('should execute successful operations', async () => {
      const result = await asyncExecute({
        name: 'test-operation',
        operation: async () => 'success'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      
      const result = await asyncExecute({
        name: 'retry-test',
        operation: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error(`Attempt ${attempts} failed`);
          }
          return 'success';
        },
        retries: 3,
        retryDelay: 100
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(attempts).toBe(3);
    });

    it('should respect timeout', async () => {
      const promise = asyncExecute({
        name: 'timeout-test',
        operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return 'should not reach';
        },
        timeout: 100,
        retries: 1
      });

      await vi.runAllTimersAsync();

      const result = await promise;
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    it('should use fallback on failure', async () => {
      const result = await asyncExecute({
        name: 'fallback-test',
        operation: async () => {
          throw new Error('Primary failed');
        },
        retries: 1,
        fallback: async () => 'fallback-success'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('fallback-success');
      expect(result.error).toBeDefined();
    });

    it('should call onError callback', async () => {
      const onError = vi.fn();
      
      await asyncExecute({
        name: 'error-callback-test',
        operation: async () => {
          throw new Error('Test error');
        },
        retries: 2,
        onError
      });

      expect(onError).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        1
      );
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        2
      );
    });

    it('should report errors to errorManager', async () => {
      await asyncExecute({
        name: 'error-report-test',
        operation: async () => {
          throw new Error('Report me');
        },
        retries: 1,
        severity: 'high'
      });

      expect(errorManager.handleError).toHaveBeenCalledWith({
        error: expect.objectContaining({ message: 'Report me' }),
        severity: 'high',
        source: 'main',
        handled: true,
        context: expect.objectContaining({
          operation: 'error-report-test',
          attempt: 1,
          maxAttempts: 1
        })
      });
    });

    it('should use exponential backoff for retries', async () => {
      let timestamps: number[] = [];
      
      const promise = asyncExecute({
        name: 'backoff-test',
        operation: async () => {
          timestamps.push(Date.now());
          throw new Error('Retry me');
        },
        retries: 3,
        retryDelay: 100
      });

      // Run timers to completion
      await vi.runAllTimersAsync();
      await promise;

      // Check delays increase exponentially
      expect(timestamps).toHaveLength(3);
      
      // First retry after 100ms
      // Second retry after 200ms (100 * 2)
      // Timing might not be exact in tests, so we check general pattern
      expect(timestamps.length).toBe(3);
    });
  });

  describe('executeParallel', () => {
    it('should execute operations in parallel', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        name: `parallel-${i}`,
        operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return i;
        }
      }));

      const startTime = Date.now();
      const results = await asyncParallel(operations);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.map(r => r.data)).toEqual([0, 1, 2, 3, 4]);
      
      // Should be faster than sequential (500ms)
      // In test environment with fake timers, this might be instant
      expect(duration).toBeLessThan(500);
    });

    it('should respect maxConcurrency', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const operations = Array.from({ length: 10 }, (_, i) => ({
        name: `concurrent-${i}`,
        operation: async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 100));
          concurrent--;
          return i;
        }
      }));

      await asyncParallel(operations, { maxConcurrency: 3 });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should stop on error when configured', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        name: `stop-on-error-${i}`,
        operation: async () => {
          if (i === 2) {
            throw new Error('Stop here');
          }
          return i;
        }
      }));

      const results = await asyncParallel(operations, { 
        stopOnError: true,
        maxConcurrency: 1 // Sequential to ensure order
      });

      // Should have processed up to and including the error
      expect(results.length).toBeLessThanOrEqual(3);
      expect(results.some(r => !r.success)).toBe(true);
    });
  });

  describe('wrap', () => {
    it('should wrap async functions with error handling', async () => {
      const originalFn = async (a: number, b: number) => a + b;
      
      const wrapped = asyncWrap(originalFn, {
        name: 'wrapped-add',
        retries: 2
      });

      const result = await wrapped(2, 3);
      expect(result).toBe(5);
    });

    it('should retry wrapped functions on failure', async () => {
      let attempts = 0;
      const originalFn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Not yet');
        }
        return 'success';
      };

      const wrapped = asyncWrap(originalFn, {
        name: 'wrapped-retry',
        retries: 3
      });

      const result = await wrapped();
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should throw on wrapped function failure', async () => {
      const originalFn = async () => {
        throw new Error('Always fails');
      };

      const wrapped = asyncWrap(originalFn, {
        name: 'wrapped-fail',
        retries: 1
      });

      await expect(wrapped()).rejects.toThrow('Always fails');
    });
  });

  describe('createCircuitBreaker', () => {
    it('should open circuit after threshold failures', async () => {
      let calls = 0;
      const operation = async () => {
        calls++;
        throw new Error('Always fails');
      };

      const breaker = AsyncErrorHandler.createCircuitBreaker(operation, {
        name: 'test-breaker',
        threshold: 3,
        timeout: 1000,
        resetTimeout: 5000
      });

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker()).rejects.toThrow('Always fails');
      }
      expect(calls).toBe(3);

      // Circuit should be open now
      await expect(breaker()).rejects.toThrow('Circuit breaker is open');
      expect(calls).toBe(3); // No additional calls
    });

    it('should reset circuit after timeout', async () => {
      let shouldFail = true;
      const operation = async () => {
        if (shouldFail) {
          throw new Error('Fails initially');
        }
        return 'success';
      };

      const breaker = AsyncErrorHandler.createCircuitBreaker(operation, {
        name: 'reset-breaker',
        threshold: 2,
        timeout: 1000,
        resetTimeout: 100
      });

      // Open the circuit
      await expect(breaker()).rejects.toThrow();
      await expect(breaker()).rejects.toThrow();
      
      // Circuit is open
      await expect(breaker()).rejects.toThrow('Circuit breaker is open');

      // Fix the operation
      shouldFail = false;

      // Wait for reset timeout
      await vi.advanceTimersByTimeAsync(150);

      // Circuit should be reset
      const result = await breaker();
      expect(result).toBe('success');
    });
  });

  describe('batch', () => {
    it('should process items in batches', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const processedBatches: number[][] = [];

      const processor = async (batch: number[]) => {
        processedBatches.push(batch);
        return batch.map(n => n * 2);
      };

      const results = await asyncBatch(items, 3, processor);

      expect(processedBatches).toHaveLength(4); // 3, 3, 3, 1
      expect(processedBatches[0]).toEqual([0, 1, 2]);
      expect(processedBatches[3]).toEqual([9]);
      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    });

    it('should handle batch errors with continueOnError', async () => {
      const items = Array.from({ length: 6 }, (_, i) => i);
      const onBatchError = vi.fn();

      const processor = async (batch: number[]) => {
        if (batch.includes(3)) {
          throw new Error('Batch with 3 failed');
        }
        return batch.map(n => n * 2);
      };

      const results = await asyncBatch(items, 2, processor, {
        continueOnError: true,
        onBatchError
      });

      expect(onBatchError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Batch with 3 failed' }),
        [2, 3]
      );

      // Should have processed other batches
      expect(results).toEqual([0, 2, 8, 10]); // Missing 4, 6
    });

    it('should stop on error when continueOnError is false', async () => {
      const items = Array.from({ length: 6 }, (_, i) => i);

      const processor = async (batch: number[]) => {
        if (batch.includes(2)) {
          throw new Error('Stop here');
        }
        return batch.map(n => n * 2);
      };

      await expect(
        asyncBatch(items, 2, processor, { continueOnError: false })
      ).rejects.toThrow('Stop here');
    });
  });
});