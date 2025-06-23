/**
 * Validation Worker - Real-time Best Practices Validation
 * 
 * Continuously validates code against best practices, coding standards,
 * security guidelines, and project-specific rules. Provides real-time
 * feedback and suggestions for improvement.
 */

import { EventEmitter } from 'events';
import {
  RefactoringTask,
  WorkerMessage,
  WorkerStatus,
  ValidationResult
} from '../types';

interface ValidationRule {
  id: string;
  name: string;
  category: 'security' | 'performance' | 'maintainability' | 'style' | 'best_practice';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  pattern?: RegExp;
  validator: (content: string, task: RefactoringTask) => ValidationIssue[];
  fixable: boolean;
  autoFix?: (content: string, issue: ValidationIssue) => string;
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'suggestion';
  rule: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'critical' | 'major' | 'minor';
  fixable: boolean;
  suggestion?: string;
}

interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  duplicatedLines: number;
  testCoverage: number;
}

export class ValidationWorker extends EventEmitter {
  private workerId: string;
  private status: WorkerStatus;
  private validationRules: ValidationRule[];
  private realTimeChecks: boolean;
  private strictMode: boolean;
  private validationQueue: { task: RefactoringTask; content: string }[] = [];
  private metricsCache: Map<string, CodeMetrics> = new Map();

  constructor(realTimeChecks: boolean = true, strictMode: boolean = false) {
    super();
    this.workerId = `validation-worker-${Date.now()}`;
    this.realTimeChecks = realTimeChecks;
    this.strictMode = strictMode;
    
    this.status = {
      id: this.workerId,
      type: 'validation',
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
      uptime: 0,
      lastActivity: new Date(),
      capabilities: [
        'code_validation',
        'best_practices',
        'security_checks',
        'performance_analysis',
        'style_enforcement',
        'metrics_calculation',
        'auto_fixing'
      ],
      performance: {
        averageTaskTime: 0,
        successRate: 0,
        errorRate: 0
      }
    };

    this.initializeValidationRules();
    this.startValidationLoop();
    
    console.log(`✓ [VALIDATION] Worker ${this.workerId} initialized (realTime: ${realTimeChecks}, strict: ${strictMode})`);
  }

  /**
   * Validate code content against all rules
   */
  async validateCode(task: RefactoringTask, content: string): Promise<ValidationResult> {
    console.log(`🔍 [VALIDATION] Validating code for task: ${task.id}`);
    
    const startTime = Date.now();
    this.status.status = 'busy';
    this.status.currentTask = task.id;

    try {
      const issues: ValidationIssue[] = [];
      let passedChecks = 0;
      let totalChecks = 0;

      // Run all validation rules
      for (const rule of this.validationRules) {
        totalChecks++;
        
        try {
          const ruleIssues = rule.validator(content, task);
          if (ruleIssues.length === 0) {
            passedChecks++;
          } else {
            issues.push(...ruleIssues);
          }
        } catch (error) {
          console.warn(`⚠️ [VALIDATION] Rule ${rule.id} failed:`, error);
          // Don't count failed rules
          totalChecks--;
        }
      }

      // Calculate code metrics
      const metrics = await this.calculateMetrics(content, task);
      
      // Apply strict mode filtering
      const filteredIssues = this.strictMode ? issues : 
        issues.filter(issue => issue.severity !== 'minor');

      const result: ValidationResult = {
        taskId: task.id,
        filePath: task.filePath,
        issues: filteredIssues,
        metrics,
        passedChecks,
        totalChecks,
        validatedAt: new Date()
      };

      this.status.completedTasks++;
      this.status.status = 'idle';
      this.status.currentTask = undefined;
      this.status.lastActivity = new Date();

      const validationTime = Date.now() - startTime;
      this.updatePerformanceMetrics(validationTime, true);

      console.log(`✅ [VALIDATION] Validation complete for ${task.id} - ${issues.length} issues found (${validationTime}ms)`);
      
      // Send validation result to orchestrator
      const message: WorkerMessage = {
        type: 'validation_result',
        workerId: this.workerId,
        taskId: task.id,
        payload: result,
        timestamp: new Date()
      };
      this.emit('message', message);

      return result;

    } catch (error) {
      this.status.failedTasks++;
      this.status.status = 'error';
      this.updatePerformanceMetrics(Date.now() - startTime, false);
      
      console.error(`❌ [VALIDATION] Validation failed for ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate code metrics for quality assessment
   */
  private async calculateMetrics(content: string, task: RefactoringTask): Promise<any> {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    const metrics = {
      codeQuality: this.calculateCodeQuality(content),
      maintainability: this.calculateMaintainability(content),
      testCoverage: this.estimateTestCoverage(task),
      performance: this.assessPerformanceCharacteristics(content)
    };

    return metrics;
  }

  /**
   * Calculate code quality score (0-100)
   */
  private calculateCodeQuality(content: string): number {
    let score = 100;
    
    // Deduct points for various issues
    const lines = content.split('\n');
    
    // Check for long lines
    const longLines = lines.filter(line => line.length > 120).length;
    score -= longLines * 2;
    
    // Check for deeply nested code
    let maxNesting = 0;
    let currentNesting = 0;
    for (const line of lines) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      currentNesting += openBraces - closeBraces;
      maxNesting = Math.max(maxNesting, currentNesting);
    }
    if (maxNesting > 4) score -= (maxNesting - 4) * 5;
    
    // Check for TODO/FIXME comments
    const todoCount = (content.match(/TODO|FIXME|XXX/gi) || []).length;
    score -= todoCount * 3;
    
    // Check for console.log statements
    const consoleCount = (content.match(/console\.(log|error|warn)/g) || []).length;
    score -= consoleCount * 2;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate maintainability score (0-100)
   */
  private calculateMaintainability(content: string): number {
    let score = 100;
    
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // Deduct for function length
    const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g) || [];
    for (const func of functionMatches) {
      const funcLines = func.split('\n').length;
      if (funcLines > 20) score -= (funcLines - 20) * 2;
    }
    
    // Check for descriptive naming
    const shortVarNames = (content.match(/\b[a-z]{1,2}\b/g) || []).length;
    score -= shortVarNames * 1;
    
    // Check for comments
    const commentLines = lines.filter(line => line.trim().startsWith('//') || 
                                      line.trim().startsWith('*') ||
                                      line.trim().startsWith('/*')).length;
    const commentRatio = commentLines / nonEmptyLines.length;
    if (commentRatio < 0.1) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate test coverage based on task type and file
   */
  private estimateTestCoverage(task: RefactoringTask): number {
    // This would integrate with actual test coverage tools
    // For now, estimate based on patterns
    
    if (task.filePath.includes('.test.') || task.filePath.includes('.spec.')) {
      return 100; // Test files have 100% coverage by definition
    }
    
    if (task.type === 'create') {
      return 0; // New files start with 0% coverage
    }
    
    // Estimate based on file type and complexity
    let coverage = 60; // Base estimate
    
    if (task.metadata.difficulty > 7) {
      coverage -= 20; // Complex files likely have lower coverage
    }
    
    if (task.filePath.includes('utils') || task.filePath.includes('helpers')) {
      coverage += 20; // Utility files often well-tested
    }
    
    return Math.max(0, Math.min(100, coverage));
  }

  /**
   * Assess performance characteristics
   */
  private assessPerformanceCharacteristics(content: string): number {
    let score = 100;
    
    // Check for sync operations
    const syncOps = (content.match(/Sync\(/g) || []).length;
    score -= syncOps * 10;
    
    // Check for nested loops
    const nestedLoops = (content.match(/for\s*\([^)]*\)[^{]*{[^}]*for\s*\(/g) || []).length;
    score -= nestedLoops * 15;
    
    // Check for large object/array operations
    const largeOperations = (content.match(/\.map\(.*\.filter\(/g) || []).length;
    score -= largeOperations * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      // Security Rules
      {
        id: 'no-eval',
        name: 'No eval() usage',
        category: 'security',
        severity: 'critical',
        description: 'eval() function poses security risks',
        pattern: /\beval\s*\(/,
        validator: (content) => {
          const matches = content.match(/\beval\s*\(/g);
          return matches ? matches.map((_, index) => ({
            type: 'error' as const,
            rule: 'no-eval',
            message: 'eval() function is dangerous and should be avoided',
            severity: 'critical' as const,
            fixable: false,
            suggestion: 'Use safer alternatives like JSON.parse() for data parsing'
          })) : [];
        },
        fixable: false
      },

      {
        id: 'no-console-in-production',
        name: 'No console statements in production',
        category: 'best_practice',
        severity: 'minor',
        description: 'Console statements should not be in production code',
        validator: (content, task) => {
          if (task.filePath.includes('.test.') || task.filePath.includes('.spec.')) {
            return []; // Allow in test files
          }
          
          const lines = content.split('\n');
          const issues: ValidationIssue[] = [];
          
          lines.forEach((line, index) => {
            if (line.match(/console\.(log|error|warn|info)/)) {
              issues.push({
                type: 'warning',
                rule: 'no-console-in-production',
                message: 'Console statement found in production code',
                line: index + 1,
                severity: 'minor',
                fixable: true,
                suggestion: 'Use proper logging library instead'
              });
            }
          });
          
          return issues;
        },
        fixable: true,
        autoFix: (content, issue) => {
          return content.replace(/console\.(log|error|warn|info)/g, 'logger.$1');
        }
      },

      // Performance Rules
      {
        id: 'no-sync-operations',
        name: 'Avoid synchronous operations',
        category: 'performance',
        severity: 'major',
        description: 'Synchronous operations block the event loop',
        validator: (content) => {
          const syncPatterns = [
            /fs\.readFileSync/g,
            /fs\.writeFileSync/g,
            /fs\.existsSync/g,
            /\.execSync\(/g
          ];
          
          const issues: ValidationIssue[] = [];
          
          syncPatterns.forEach(pattern => {
            const matches = [...content.matchAll(pattern)];
            matches.forEach(match => {
              const lines = content.substring(0, match.index).split('\n');
              issues.push({
                type: 'warning',
                rule: 'no-sync-operations',
                message: `Synchronous operation ${match[0]} blocks the event loop`,
                line: lines.length,
                severity: 'major',
                fixable: true,
                suggestion: 'Use async equivalent with await'
              });
            });
          });
          
          return issues;
        },
        fixable: true
      },

      // Maintainability Rules
      {
        id: 'function-length',
        name: 'Function length limit',
        category: 'maintainability',
        severity: 'minor',
        description: 'Functions should not be too long',
        validator: (content) => {
          const functionRegex = /function\s+\w+\s*\([^)]*\)\s*{[^}]*}/gs;
          const matches = [...content.matchAll(functionRegex)];
          const issues: ValidationIssue[] = [];
          
          matches.forEach(match => {
            const funcContent = match[0];
            const lineCount = funcContent.split('\n').length;
            
            if (lineCount > 30) {
              const lines = content.substring(0, match.index).split('\n');
              issues.push({
                type: 'suggestion',
                rule: 'function-length',
                message: `Function is ${lineCount} lines long, consider breaking it down`,
                line: lines.length,
                severity: 'minor',
                fixable: false,
                suggestion: 'Extract smaller functions or use composition'
              });
            }
          });
          
          return issues;
        },
        fixable: false
      },

      // Hardware-specific Rules
      {
        id: 'hardware-error-handling',
        name: 'Hardware error handling',
        category: 'best_practice',
        severity: 'major',
        description: 'Hardware operations must have proper error handling',
        validator: (content, task) => {
          if (!task.filePath.includes('hardware') && !task.filePath.includes('Hardware')) {
            return [];
          }
          
          const issues: ValidationIssue[] = [];
          
          // Check for MIDI operations without error handling
          if (content.includes('easymidi') || content.includes('midi')) {
            const hasTryCatch = content.includes('try') && content.includes('catch');
            const hasErrorHandling = content.includes('.on(\'error\'') || content.includes('.catch(');
            
            if (!hasTryCatch && !hasErrorHandling) {
              issues.push({
                type: 'error',
                rule: 'hardware-error-handling',
                message: 'MIDI operations must include error handling',
                severity: 'major',
                fixable: false,
                suggestion: 'Add try-catch blocks or .on(\'error\') handlers'
              });
            }
          }
          
          return issues;
        },
        fixable: false
      },

      // TypeScript-specific Rules
      {
        id: 'explicit-return-types',
        name: 'Explicit return types',
        category: 'style',
        severity: 'minor',
        description: 'Functions should have explicit return types',
        validator: (content, task) => {
          if (!task.filePath.endsWith('.ts')) return [];
          
          const functionRegex = /function\s+\w+\s*\([^)]*\)\s*{/g;
          const arrowFunctionRegex = /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{/g;
          const issues: ValidationIssue[] = [];
          
          [...content.matchAll(functionRegex), ...content.matchAll(arrowFunctionRegex)]
            .forEach(match => {
              if (!match[0].includes('):')) {
                const lines = content.substring(0, match.index).split('\n');
                issues.push({
                  type: 'suggestion',
                  rule: 'explicit-return-types',
                  message: 'Function should have explicit return type',
                  line: lines.length,
                  severity: 'minor',
                  fixable: false,
                  suggestion: 'Add return type annotation'
                });
              }
            });
          
          return issues;
        },
        fixable: false
      }
    ];
  }

  /**
   * Start the validation loop for real-time checking
   */
  private startValidationLoop(): void {
    if (this.realTimeChecks) {
      setInterval(() => {
        this.processValidationQueue();
      }, 500); // Check every 500ms for real-time validation
    }
  }

  /**
   * Process queued validation tasks
   */
  private processValidationQueue(): void {
    if (this.validationQueue.length > 0 && this.status.status === 'idle') {
      const { task, content } = this.validationQueue.shift()!;
      this.validateCode(task, content).catch(error => {
        console.error(`❌ [VALIDATION] Failed to validate task ${task.id}:`, error);
      });
    }
  }

  /**
   * Add task to validation queue
   */
  queueValidation(task: RefactoringTask, content: string): void {
    this.validationQueue.push({ task, content });
    console.log(`📋 [VALIDATION] Queued validation for task: ${task.id}`);
  }

  /**
   * Get validation rules for a specific category
   */
  getRules(category?: string): ValidationRule[] {
    if (!category) return this.validationRules;
    return this.validationRules.filter(rule => rule.category === category);
  }

  /**
   * Enable or disable strict mode
   */
  setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
    console.log(`🔧 [VALIDATION] Strict mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(taskTime: number, success: boolean): void {
    const currentAvg = this.status.performance.averageTaskTime;
    const count = this.status.completedTasks + this.status.failedTasks;
    
    this.status.performance.averageTaskTime = 
      (currentAvg * (count - 1) + taskTime) / count;

    if (success) {
      this.status.performance.successRate = 
        (this.status.completedTasks / count) * 100;
    }

    this.status.performance.errorRate = 
      (this.status.failedTasks / count) * 100;
  }

  /**
   * Get current status
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Shutdown the validation worker
   */
  async shutdown(): Promise<void> {
    console.log(`🛑 [VALIDATION] Shutting down worker ${this.workerId}`);
    this.status.status = 'offline';
    this.emit('shutdown');
  }
}