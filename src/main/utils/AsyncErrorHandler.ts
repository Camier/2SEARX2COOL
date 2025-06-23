import log from 'electron-log';
import { errorManager } from '../errors/ErrorManager';
import { ErrorInfo } from '../errors/ErrorManager';

export interface AsyncOperation<T = any> {
  name: string;
  operation: () => Promise<T>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  fallback?: () => T | Promise<T>;
  onError?: (error: Error, attempt: number) => void;
  severity?: ErrorInfo['severity'];
  context?: any;
}

export interface AsyncResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  duration: number;
}

export class AsyncErrorHandler {
  private static defaultTimeout = 30000; // 30 seconds
  private static defaultRetries = 3;
  private static defaultRetryDelay = 1000; // 1 second

  /**
   * Execute an async operation with error handling, retries, and timeout
   */
  static async execute<T>(options: AsyncOperation<T>): Promise<AsyncResult<T>> {
    const {
      name,
      operation,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      fallback,
      onError,
      severity = 'medium',
      context = {}
    } = options;

    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= retries; attempt++) {
      attempts = attempt;
      
      try {
        log.debug(`Executing async operation: ${name} (attempt ${attempt}/${retries})`);
        
        // Execute with timeout
        const result = await this.withTimeout(operation(), timeout, name);
        
        const duration = Date.now() - startTime;
        log.debug(`Async operation succeeded: ${name} (${duration}ms)`);
        
        return {
          success: true,
          data: result,
          attempts,
          duration
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        log.warn(`Async operation failed: ${name} (attempt ${attempt}/${retries})`, lastError);
        
        // Call error callback if provided
        if (onError) {
          try {
            onError(lastError, attempt);
          } catch (callbackError) {
            log.error('Error in onError callback:', callbackError);
          }
        }

        // Report to error manager (but don't wait)
        errorManager.handleError({
          error: lastError,
          severity: attempt === retries ? severity : 'low',
          source: 'main',
          handled: true,
          context: {
            ...context,
            operation: name,
            attempt,
            maxAttempts: retries
          }
        }).catch(e => log.error('Failed to report async error:', e));

        // Don't retry on the last attempt
        if (attempt < retries) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed, try fallback
    if (fallback) {
      try {
        log.info(`Attempting fallback for: ${name}`);
        const fallbackResult = await fallback();
        
        return {
          success: true,
          data: fallbackResult,
          error: lastError!,
          attempts,
          duration: Date.now() - startTime
        };
      } catch (fallbackError) {
        log.error(`Fallback also failed for: ${name}`, fallbackError);
        lastError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
      }
    }

    // Complete failure
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: lastError!,
      attempts,
      duration
    };
  }

  /**
   * Execute multiple async operations in parallel with error handling
   */
  static async executeParallel<T>(
    operations: AsyncOperation<T>[],
    options?: {
      maxConcurrency?: number;
      stopOnError?: boolean;
    }
  ): Promise<AsyncResult<T>[]> {
    const { maxConcurrency = 5, stopOnError = false } = options || {};
    
    const results: AsyncResult<T>[] = [];
    const queue = [...operations];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Start new operations up to concurrency limit
      while (executing.length < maxConcurrency && queue.length > 0) {
        const operation = queue.shift()!;
        
        const promise = this.execute(operation)
          .then(result => {
            results.push(result);
            
            if (stopOnError && !result.success) {
              // Clear the queue to stop processing
              queue.length = 0;
            }
          })
          .finally(() => {
            const index = executing.indexOf(promise);
            if (index > -1) {
              executing.splice(index, 1);
            }
          });

        executing.push(promise);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    return results;
  }

  /**
   * Create a wrapped version of an async function with automatic error handling
   */
  static wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: Omit<AsyncOperation, 'operation'>
  ): T {
    return (async (...args: any[]) => {
      const result = await this.execute({
        ...options,
        operation: () => fn(...args),
        context: {
          ...options.context,
          args
        }
      });

      if (!result.success) {
        throw result.error;
      }

      return result.data;
    }) as T;
  }

  /**
   * Execute an operation with a timeout
   */
  private static async withTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    name: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms: ${name}`));
      }, timeout);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a circuit breaker for an operation
   */
  static createCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: {
      name: string;
      threshold: number;
      timeout: number;
      resetTimeout: number;
    }
  ): () => Promise<T> {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return async () => {
      // Check if circuit should be reset
      if (isOpen && Date.now() - lastFailureTime > options.resetTimeout) {
        isOpen = false;
        failures = 0;
        log.info(`Circuit breaker reset: ${options.name}`);
      }

      // If circuit is open, fail fast
      if (isOpen) {
        throw new Error(`Circuit breaker is open: ${options.name}`);
      }

      try {
        const result = await this.withTimeout(operation(), options.timeout, options.name);
        
        // Success - reset failure count
        failures = 0;
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        if (failures >= options.threshold) {
          isOpen = true;
          log.error(`Circuit breaker opened: ${options.name} (${failures} failures)`);
        }

        throw error;
      }
    };
  }

  /**
   * Batch async operations with error handling
   */
  static async batch<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>,
    options?: {
      name?: string;
      onBatchError?: (error: Error, batch: T[]) => void;
      continueOnError?: boolean;
    }
  ): Promise<R[]> {
    const {
      name = 'batch-operation',
      onBatchError,
      continueOnError = true
    } = options || {};

    const results: R[] = [];
    const errors: Array<{ batch: T[]; error: Error }> = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ batch, error: err });

        if (onBatchError) {
          onBatchError(err, batch);
        }

        await errorManager.handleError({
          error: err,
          severity: 'medium',
          source: 'main',
          handled: true,
          context: {
            operation: name,
            batchIndex: Math.floor(i / batchSize),
            batchSize: batch.length
          }
        });

        if (!continueOnError) {
          throw err;
        }
      }
    }

    if (errors.length > 0 && !continueOnError) {
      throw new Error(`Batch operation failed with ${errors.length} errors`);
    }

    return results;
  }
}

// Export convenience functions
export const asyncExecute = AsyncErrorHandler.execute.bind(AsyncErrorHandler);
export const asyncWrap = AsyncErrorHandler.wrap.bind(AsyncErrorHandler);
export const asyncParallel = AsyncErrorHandler.executeParallel.bind(AsyncErrorHandler);
export const asyncBatch = AsyncErrorHandler.batch.bind(AsyncErrorHandler);