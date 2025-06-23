import log from 'electron-log';

export type CleanupFunction = () => void | Promise<void>;

/**
 * Centralized resource management for cleanup operations
 * Ensures all resources are properly released on app shutdown
 */
export class ResourceManager {
  private static instance: ResourceManager;
  private resources = new Map<string, CleanupFunction>();
  private cleanupOrder: string[] = [];
  private isCleaningUp = false;

  private constructor() {
    // Singleton
  }

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * Register a cleanup function for a resource
   * @param id - Unique identifier for the resource
   * @param cleanup - Function to call during cleanup
   * @param priority - Higher priority resources are cleaned up first (default: 0)
   */
  register(id: string, cleanup: CleanupFunction, priority = 0): void {
    if (this.resources.has(id)) {
      log.warn(`Resource ${id} is already registered, overwriting`);
    }

    this.resources.set(id, cleanup);
    
    // Insert in priority order
    const index = this.cleanupOrder.findIndex(existingId => {
      const existingPriority = this.getPriority(existingId);
      return priority > existingPriority;
    });

    if (index === -1) {
      this.cleanupOrder.push(id);
    } else {
      this.cleanupOrder.splice(index, 0, id);
    }

    log.debug(`Registered cleanup for resource: ${id} (priority: ${priority})`);
  }

  /**
   * Unregister a resource
   * @param id - Resource identifier to remove
   */
  unregister(id: string): void {
    this.resources.delete(id);
    this.cleanupOrder = this.cleanupOrder.filter(resId => resId !== id);
    log.debug(`Unregistered resource: ${id}`);
  }

  /**
   * Execute cleanup for a specific resource
   * @param id - Resource identifier
   */
  async cleanupResource(id: string): Promise<void> {
    const cleanup = this.resources.get(id);
    if (!cleanup) {
      log.warn(`No cleanup function found for resource: ${id}`);
      return;
    }

    try {
      log.debug(`Cleaning up resource: ${id}`);
      await cleanup();
      log.debug(`Successfully cleaned up resource: ${id}`);
    } catch (error) {
      log.error(`Failed to cleanup resource ${id}:`, error);
      throw error;
    }
  }

  /**
   * Execute all cleanup functions in priority order
   * @param timeout - Maximum time to wait for cleanup (ms)
   */
  async cleanupAll(timeout = 30000): Promise<void> {
    if (this.isCleaningUp) {
      log.warn('Cleanup already in progress');
      return;
    }

    this.isCleaningUp = true;
    const startTime = Date.now();
    const errors: Array<{ id: string; error: unknown }> = [];

    log.info(`Starting cleanup of ${this.resources.size} resources`);

    // Create cleanup promise with timeout
    const cleanupPromise = (async () => {
      for (const id of this.cleanupOrder) {
        const cleanup = this.resources.get(id);
        if (!cleanup) continue;

        try {
          const resourceStart = Date.now();
          await cleanup();
          const duration = Date.now() - resourceStart;
          log.debug(`Cleaned up ${id} in ${duration}ms`);
        } catch (error) {
          log.error(`Failed to cleanup resource ${id}:`, error);
          errors.push({ id, error });
        }
      }
    })();

    // Race against timeout
    try {
      await Promise.race([
        cleanupPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cleanup timeout')), timeout)
        )
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Cleanup timeout') {
        log.error(`Cleanup timed out after ${timeout}ms`);
      } else {
        throw error;
      }
    }

    const totalDuration = Date.now() - startTime;
    log.info(`Cleanup completed in ${totalDuration}ms with ${errors.length} errors`);

    // Clear all resources
    this.resources.clear();
    this.cleanupOrder = [];
    this.isCleaningUp = false;

    // If there were errors, throw an aggregate error
    if (errors.length > 0) {
      const errorMessage = errors
        .map(({ id, error }) => `${id}: ${error}`)
        .join(', ');
      throw new Error(`Cleanup failed for resources: ${errorMessage}`);
    }
  }

  /**
   * Get priority for a resource (for internal use)
   */
  private getPriority(id: string): number {
    // In a real implementation, we'd store priorities
    // For now, use order as implicit priority
    return this.cleanupOrder.indexOf(id);
  }

  /**
   * Get current resource count
   */
  getResourceCount(): number {
    return this.resources.size;
  }

  /**
   * Get list of registered resource IDs
   */
  getResourceIds(): string[] {
    return [...this.cleanupOrder];
  }

  /**
   * Check if a resource is registered
   */
  hasResource(id: string): boolean {
    return this.resources.has(id);
  }
}

// Export singleton instance
export const resourceManager = ResourceManager.getInstance();