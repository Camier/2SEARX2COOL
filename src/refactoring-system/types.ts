/**
 * Self-Optimizing Refactoring System - Core Types
 * 
 * Defines the interfaces and types for the intelligent refactoring system
 * that coordinates multiple workers for automated code improvement.
 */

export interface RefactoringTask {
  id: string;
  type: 'create' | 'update' | 'delete' | 'optimize' | 'fix' | 'validate';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  filePath: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  estimatedTime: number; // in seconds
  dependencies: string[]; // Task IDs that must complete first
  metadata: {
    category: string;
    difficulty: number; // 1-10 scale
    riskLevel: 'low' | 'medium' | 'high';
    affectedFiles: string[];
    requiredSkills: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkerMessage {
  type: 'task_assignment' | 'task_completion' | 'task_failure' | 'status_update' | 'prediction' | 'validation_result' | 'healing_suggestion';
  workerId: string;
  taskId?: string;
  payload: any;
  timestamp: Date;
}

export interface WorkerStatus {
  id: string;
  type: 'orchestrator' | 'prediction' | 'validation' | 'healing' | 'execution';
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  completedTasks: number;
  failedTasks: number;
  uptime: number;
  lastActivity: Date;
  capabilities: string[];
  performance: {
    averageTaskTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface PredictionResult {
  taskId: string;
  predictions: {
    potentialIssues: string[];
    suggestedApproach: string;
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
      mitigationStrategies: string[];
    };
    estimatedImpact: {
      performance: number; // -100 to +100
      maintainability: number; // -100 to +100
      reliability: number; // -100 to +100
    };
  };
  confidence: number; // 0-100%
  generatedAt: Date;
}

export interface ValidationResult {
  taskId: string;
  filePath: string;
  issues: {
    type: 'error' | 'warning' | 'suggestion';
    rule: string;
    message: string;
    line?: number;
    column?: number;
    severity: 'critical' | 'major' | 'minor';
    fixable: boolean;
    suggestion?: string;
  }[];
  metrics: {
    codeQuality: number; // 0-100
    maintainability: number; // 0-100
    testCoverage: number; // 0-100
    performance: number; // 0-100
  };
  passedChecks: number;
  totalChecks: number;
  validatedAt: Date;
}

export interface HealingAction {
  type: 'auto_fix' | 'suggestion' | 'refactor' | 'optimize';
  description: string;
  filePath: string;
  changes: {
    line: number;
    column: number;
    oldCode: string;
    newCode: string;
    reason: string;
  }[];
  confidence: number; // 0-100%
  impact: 'low' | 'medium' | 'high';
  canAutoApply: boolean;
  createdAt: Date;
}

export interface SystemMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  systemUptime: number;
  workerStatuses: WorkerStatus[];
  recentActivity: WorkerMessage[];
  performance: {
    tasksPerMinute: number;
    successRate: number;
    errorRate: number;
    healingRate: number;
  };
  codebaseHealth: {
    totalFiles: number;
    analyzedFiles: number;
    issuesFound: number;
    issuesFixed: number;
    codeQualityScore: number;
    testCoverage: number;
  };
}

export interface SystemConfig {
  maxConcurrentTasks: number;
  predictionWindowSeconds: number;
  validationThreshold: number;
  autoHealingEnabled: boolean;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  workers: {
    execution: {
      count: number;
      maxTasksPerWorker: number;
    };
    prediction: {
      lookAheadSeconds: number;
      analysisDepth: 'shallow' | 'deep';
    };
    validation: {
      realTimeChecks: boolean;
      strictMode: boolean;
    };
    healing: {
      autoApplyFixes: boolean;
      maxRiskLevel: 'low' | 'medium' | 'high';
    };
  };
  integrations: {
    memento: {
      enabled: boolean;
      trackingLevel: 'basic' | 'detailed';
    };
    git: {
      autoCommit: boolean;
      branchStrategy: 'main' | 'feature' | 'auto';
    };
  };
}

export interface ProjectAnalysis {
  totalFiles: number;
  fileTypes: Record<string, number>;
  dependencies: {
    runtime: string[];
    development: string[];
    optional: string[];
    hardware: string[];
  };
  missingFiles: string[];
  completionRate: number;
  technicalDebt: {
    level: 'low' | 'medium' | 'high';
    categories: string[];
    priority: string[];
  };
  riskFactors: {
    category: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
  }[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export interface RefactoringPlan {
  id: string;
  name: string;
  description: string;
  phases: {
    name: string;
    description: string;
    tasks: RefactoringTask[];
    estimatedTime: number;
    dependencies: string[];
  }[];
  totalEstimatedTime: number;
  riskLevel: 'low' | 'medium' | 'high';
  successCriteria: string[];
  rollbackPlan: string[];
  createdAt: Date;
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
}