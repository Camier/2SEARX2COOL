/**
 * Self-Optimizing Refactoring System
 * 
 * Main entry point and coordinator for the intelligent refactoring system.
 * Orchestrates multiple workers to perform automated code improvements
 * with predictive analysis, validation, and healing capabilities.
 */

import { EventEmitter } from 'events';
import { OrchestratorWorker } from './workers/orchestrator-worker';
import { PredictionWorker } from './workers/prediction-worker';
import { ValidationWorker } from './workers/validation-worker';
import { HealingWorker } from './workers/healing-worker';
import { ExecutionWorker } from './workers/execution-worker';
import {
  SystemConfig,
  SystemMetrics,
  RefactoringPlan,
  ProjectAnalysis,
  WorkerStatus,
  RefactoringTask
} from './types';

export class RefactoringSystem extends EventEmitter {
  private config: SystemConfig;
  private orchestrator: OrchestratorWorker;
  private predictionWorker: PredictionWorker;
  private validationWorker: ValidationWorker;
  private healingWorker: HealingWorker;
  private executionWorkers: ExecutionWorker[] = [];
  private isInitialized = false;
  private startTime = new Date();

  constructor(config?: Partial<SystemConfig>) {
    super();
    
    this.config = this.mergeConfig(config);
    
    // Initialize workers
    this.orchestrator = new OrchestratorWorker(this.config);
    this.predictionWorker = new PredictionWorker(this.config.workers.prediction.lookAheadSeconds);
    this.validationWorker = new ValidationWorker(
      this.config.workers.validation.realTimeChecks,
      this.config.workers.validation.strictMode
    );
    this.healingWorker = new HealingWorker(
      this.config.workers.healing.autoApplyFixes,
      this.config.workers.healing.maxRiskLevel
    );

    // Create execution workers
    for (let i = 0; i < this.config.workers.execution.count; i++) {
      const worker = new ExecutionWorker(this.config.workers.execution.maxTasksPerWorker);
      this.executionWorkers.push(worker);
    }

    this.setupWorkerCommunication();
    
    console.log(`🚀 [REFACTORING-SYSTEM] Initialized with ${this.executionWorkers.length} execution workers`);
  }

  /**
   * Initialize the refactoring system
   */
  async initialize(projectPath: string): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ [REFACTORING-SYSTEM] Already initialized');
      return;
    }

    console.log(`🔧 [REFACTORING-SYSTEM] Initializing for project: ${projectPath}`);

    try {
      // Register all workers with orchestrator
      this.registerWorkers();

      // Analyze the project
      const analysis = await this.orchestrator.analyzeProject(projectPath);
      console.log(`📊 [REFACTORING-SYSTEM] Project analysis complete: ${analysis.completionRate}% complete`);

      // Create refactoring plan
      const plan = await this.orchestrator.createRefactoringPlan(analysis);
      console.log(`📋 [REFACTORING-SYSTEM] Refactoring plan created: ${plan.phases.length} phases`);

      // Update Memento knowledge graph
      await this.updateKnowledgeGraph(analysis, plan);

      this.isInitialized = true;
      this.emit('initialized', { analysis, plan });

      console.log(`✅ [REFACTORING-SYSTEM] System initialized successfully`);

    } catch (error) {
      console.error(`❌ [REFACTORING-SYSTEM] Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Start the refactoring process
   */
  async startRefactoring(projectPath: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(projectPath);
    }

    console.log(`🚀 [REFACTORING-SYSTEM] Starting refactoring process`);

    try {
      // Get the latest analysis and plan
      const analysis = await this.orchestrator.analyzeProject(projectPath);
      const plan = await this.orchestrator.createRefactoringPlan(analysis);

      // Execute the plan
      await this.orchestrator.executePlan(plan);

      console.log(`🎉 [REFACTORING-SYSTEM] Refactoring completed successfully!`);
      this.emit('refactoring-complete', plan);

    } catch (error) {
      console.error(`❌ [REFACTORING-SYSTEM] Refactoring failed:`, error);
      this.emit('refactoring-failed', error);
      throw error;
    }
  }

  /**
   * Add a custom task to the refactoring queue
   */
  addTask(task: RefactoringTask): void {
    console.log(`📝 [REFACTORING-SYSTEM] Adding custom task: ${task.description}`);
    this.orchestrator.addTask(task);
  }

  /**
   * Get current system metrics
   */
  getMetrics(): SystemMetrics {
    const orchestratorMetrics = this.orchestrator.getMetrics();
    
    // Enhance with worker-specific metrics
    orchestratorMetrics.workerStatuses = [
      this.orchestrator.getStatus(),
      this.predictionWorker.getStatus(),
      this.validationWorker.getStatus(),
      this.healingWorker.getStatus(),
      ...this.executionWorkers.map(w => w.getStatus())
    ];

    return orchestratorMetrics;
  }

  /**
   * Get system configuration
   */
  getConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * Update system configuration
   */
  updateConfig(updates: Partial<SystemConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Apply config changes to workers
    this.validationWorker.setStrictMode(this.config.workers.validation.strictMode);
    this.healingWorker.setAutoApply(this.config.workers.healing.autoApplyFixes);
    this.healingWorker.setMaxRiskLevel(this.config.workers.healing.maxRiskLevel);

    console.log(`🔧 [REFACTORING-SYSTEM] Configuration updated`);
    this.emit('config-updated', this.config);
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(userConfig?: Partial<SystemConfig>): SystemConfig {
    const defaultConfig: SystemConfig = {
      maxConcurrentTasks: 8,
      predictionWindowSeconds: 10,
      validationThreshold: 80,
      autoHealingEnabled: true,
      riskTolerance: 'moderate',
      workers: {
        execution: {
          count: 4,
          maxTasksPerWorker: 3
        },
        prediction: {
          lookAheadSeconds: 10,
          analysisDepth: 'deep'
        },
        validation: {
          realTimeChecks: true,
          strictMode: false
        },
        healing: {
          autoApplyFixes: false,
          maxRiskLevel: 'medium'
        }
      },
      integrations: {
        memento: {
          enabled: true,
          trackingLevel: 'detailed'
        },
        git: {
          autoCommit: true,
          branchStrategy: 'main'
        }
      }
    };

    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Register workers with orchestrator
   */
  private registerWorkers(): void {
    // Register each worker with the orchestrator
    this.orchestrator.emit('worker_registered', this.predictionWorker.getStatus());
    this.orchestrator.emit('worker_registered', this.validationWorker.getStatus());
    this.orchestrator.emit('worker_registered', this.healingWorker.getStatus());
    
    this.executionWorkers.forEach(worker => {
      this.orchestrator.emit('worker_registered', worker.getStatus());
    });

    console.log(`👥 [REFACTORING-SYSTEM] Registered ${this.executionWorkers.length + 3} workers`);
  }

  /**
   * Setup inter-worker communication
   */
  private setupWorkerCommunication(): void {
    // Prediction worker messages
    this.predictionWorker.on('message', (message) => {
      this.orchestrator.handleWorkerMessage(message);
    });

    // Validation worker messages
    this.validationWorker.on('message', (message) => {
      this.orchestrator.handleWorkerMessage(message);
    });

    // Healing worker messages
    this.healingWorker.on('message', (message) => {
      this.orchestrator.handleWorkerMessage(message);
    });

    // Execution worker messages
    this.executionWorkers.forEach(worker => {
      worker.on('message', (message) => {
        this.orchestrator.handleWorkerMessage(message);
      });
    });

    // Orchestrator requests
    this.orchestrator.on('request_prediction', (task) => {
      this.predictionWorker.queueTask(task);
    });

    this.orchestrator.on('request_healing', (task) => {
      this.healingWorker.queueHealing(task, '', []); // Would get actual content
    });

    // Worker assignments
    this.orchestrator.on('worker_message', (message) => {
      if (message.type === 'task_assignment') {
        const worker = this.findWorkerById(message.workerId);
        if (worker && 'executeTask' in worker) {
          worker.executeTask(message.payload).catch(error => {
            console.error(`❌ [REFACTORING-SYSTEM] Task execution failed:`, error);
          });
        }
      }
    });

    console.log(`🔗 [REFACTORING-SYSTEM] Worker communication established`);
  }

  /**
   * Find worker by ID
   */
  private findWorkerById(workerId: string): any {
    if (this.orchestrator.getStatus().id === workerId) {
      return this.orchestrator;
    }
    if (this.predictionWorker.getStatus().id === workerId) {
      return this.predictionWorker;
    }
    if (this.validationWorker.getStatus().id === workerId) {
      return this.validationWorker;
    }
    if (this.healingWorker.getStatus().id === workerId) {
      return this.healingWorker;
    }
    
    return this.executionWorkers.find(w => w.getStatus().id === workerId);
  }

  /**
   * Update Memento knowledge graph with refactoring progress
   */
  private async updateKnowledgeGraph(analysis: ProjectAnalysis, plan: RefactoringPlan): Promise<void> {
    if (!this.config.integrations.memento.enabled) return;

    try {
      // This would integrate with Memento MCP to track refactoring progress
      console.log(`📊 [REFACTORING-SYSTEM] Updating knowledge graph with refactoring data`);
      
      // Track analysis results
      // Track plan creation
      // Track task progress
      // Learn from outcomes

    } catch (error) {
      console.warn(`⚠️ [REFACTORING-SYSTEM] Failed to update knowledge graph:`, error);
    }
  }

  /**
   * Get worker statuses summary
   */
  getWorkerSummary(): { [key: string]: WorkerStatus } {
    return {
      orchestrator: this.orchestrator.getStatus(),
      prediction: this.predictionWorker.getStatus(),
      validation: this.validationWorker.getStatus(),
      healing: this.healingWorker.getStatus(),
      ...Object.fromEntries(
        this.executionWorkers.map((worker, index) => [
          `execution-${index}`,
          worker.getStatus()
        ])
      )
    };
  }

  /**
   * Check system health
   */
  checkHealth(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check if all workers are responsive
    const workers = [
      this.orchestrator,
      this.predictionWorker,
      this.validationWorker,
      this.healingWorker,
      ...this.executionWorkers
    ];

    workers.forEach(worker => {
      const status = worker.getStatus();
      if (status.status === 'error') {
        issues.push(`Worker ${status.id} is in error state`);
      }
      if (status.status === 'offline') {
        issues.push(`Worker ${status.id} is offline`);
      }
    });

    // Check execution worker capacity
    const busyWorkers = this.executionWorkers.filter(w => w.getStatus().status === 'busy').length;
    if (busyWorkers === this.executionWorkers.length) {
      issues.push('All execution workers are busy - may need more workers');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 [REFACTORING-SYSTEM] Shutting down...');

    try {
      // Shutdown all workers
      await Promise.all([
        this.orchestrator.shutdown(),
        this.predictionWorker.shutdown(),
        this.validationWorker.shutdown(),
        this.healingWorker.shutdown(),
        ...this.executionWorkers.map(w => w.shutdown())
      ]);

      this.isInitialized = false;
      this.emit('shutdown');
      
      console.log('✅ [REFACTORING-SYSTEM] Shutdown complete');

    } catch (error) {
      console.error('❌ [REFACTORING-SYSTEM] Shutdown error:', error);
      throw error;
    }
  }

  /**
   * Get system uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Export system state for debugging
   */
  exportState(): any {
    return {
      config: this.config,
      initialized: this.isInitialized,
      uptime: this.getUptime(),
      metrics: this.getMetrics(),
      workerSummary: this.getWorkerSummary(),
      health: this.checkHealth()
    };
  }
}

// Create singleton instance with default configuration
export const refactoringSystem = new RefactoringSystem();

// Export for custom configurations
export { RefactoringSystem };