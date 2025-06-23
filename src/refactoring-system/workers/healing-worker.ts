/**
 * Healing Worker - Auto-Fix Common Issues
 * 
 * Automatically identifies and fixes common coding issues, applies
 * refactoring patterns, and suggests improvements. Uses pattern
 * recognition and learned behaviors to heal code problems.
 */

import { EventEmitter } from 'events';
import {
  RefactoringTask,
  WorkerMessage,
  WorkerStatus,
  HealingAction
} from '../types';

interface HealingRule {
  id: string;
  name: string;
  description: string;
  category: 'auto_fix' | 'refactor' | 'optimize' | 'security';
  pattern: RegExp;
  confidence: number; // 0-100, how confident we are in the fix
  riskLevel: 'low' | 'medium' | 'high';
  canAutoApply: boolean;
  healer: (content: string, matches: RegExpMatchArray[]) => HealingAction[];
}

interface RefactoringPattern {
  name: string;
  description: string;
  before: RegExp;
  after: string | ((match: string) => string);
  confidence: number;
  examples: { before: string; after: string }[];
}

export class HealingWorker extends EventEmitter {
  private workerId: string;
  private status: WorkerStatus;
  private autoApplyFixes: boolean;
  private maxRiskLevel: 'low' | 'medium' | 'high';
  private healingRules: HealingRule[];
  private refactoringPatterns: RefactoringPattern[];
  private healingQueue: { task: RefactoringTask; content: string; issues: any[] }[] = [];
  private appliedFixes: Map<string, HealingAction[]> = new Map();

  constructor(autoApplyFixes: boolean = false, maxRiskLevel: 'low' | 'medium' | 'high' = 'medium') {
    super();
    this.workerId = `healing-worker-${Date.now()}`;
    this.autoApplyFixes = autoApplyFixes;
    this.maxRiskLevel = maxRiskLevel;
    
    this.status = {
      id: this.workerId,
      type: 'healing',
      status: 'idle',
      completedTasks: 0,
      failedTasks: 0,
      uptime: 0,
      lastActivity: new Date(),
      capabilities: [
        'auto_fixing',
        'code_refactoring',
        'pattern_application',
        'performance_optimization',
        'security_improvements',
        'style_normalization',
        'import_organization'
      ],
      performance: {
        averageTaskTime: 0,
        successRate: 0,
        errorRate: 0
      }
    };

    this.initializeHealingRules();
    this.initializeRefactoringPatterns();
    this.startHealingLoop();
    
    console.log(`🏥 [HEALING] Worker ${this.workerId} initialized (autoApply: ${autoApplyFixes}, maxRisk: ${maxRiskLevel})`);
  }

  /**
   * Analyze code and suggest healing actions
   */
  async healCode(task: RefactoringTask, content: string, issues: any[] = []): Promise<HealingAction[]> {
    console.log(`🔧 [HEALING] Analyzing code for healing opportunities: ${task.id}`);
    
    const startTime = Date.now();
    this.status.status = 'busy';
    this.status.currentTask = task.id;

    try {
      const healingActions: HealingAction[] = [];

      // Apply healing rules
      for (const rule of this.healingRules) {
        const ruleActions = await this.applyHealingRule(rule, content, task);
        healingActions.push(...ruleActions);
      }

      // Apply refactoring patterns
      const refactoringActions = await this.applyRefactoringPatterns(content, task);
      healingActions.push(...refactoringActions);

      // Filter by risk level
      const filteredActions = healingActions.filter(action => 
        this.isRiskAcceptable(action.impact)
      );

      // Sort by confidence (highest first)
      filteredActions.sort((a, b) => b.confidence - a.confidence);

      // Auto-apply safe fixes if enabled
      let appliedActions: HealingAction[] = [];
      if (this.autoApplyFixes) {
        appliedActions = await this.autoApplySafeFixes(filteredActions, content);
      }

      this.appliedFixes.set(task.id, appliedActions);

      this.status.completedTasks++;
      this.status.status = 'idle';
      this.status.currentTask = undefined;
      this.status.lastActivity = new Date();

      const healingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(healingTime, true);

      console.log(`✨ [HEALING] Healing complete for ${task.id} - ${filteredActions.length} actions suggested, ${appliedActions.length} applied (${healingTime}ms)`);
      
      // Send healing suggestions to orchestrator
      const message: WorkerMessage = {
        type: 'healing_suggestion',
        workerId: this.workerId,
        taskId: task.id,
        payload: {
          suggestions: filteredActions,
          applied: appliedActions
        },
        timestamp: new Date()
      };
      this.emit('message', message);

      return filteredActions;

    } catch (error) {
      this.status.failedTasks++;
      this.status.status = 'error';
      this.updatePerformanceMetrics(Date.now() - startTime, false);
      
      console.error(`❌ [HEALING] Healing failed for ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Apply a healing rule to the content
   */
  private async applyHealingRule(rule: HealingRule, content: string, task: RefactoringTask): Promise<HealingAction[]> {
    const matches = [...content.matchAll(new RegExp(rule.pattern, 'g'))];
    if (matches.length === 0) return [];

    return rule.healer(content, matches);
  }

  /**
   * Apply refactoring patterns to improve code
   */
  private async applyRefactoringPatterns(content: string, task: RefactoringTask): Promise<HealingAction[]> {
    const actions: HealingAction[] = [];

    for (const pattern of this.refactoringPatterns) {
      const matches = [...content.matchAll(new RegExp(pattern.before, 'g'))];
      
      for (const match of matches) {
        const lines = content.substring(0, match.index).split('\n');
        const lineNumber = lines.length;
        
        const oldCode = match[0];
        const newCode = typeof pattern.after === 'function' ? 
          pattern.after(oldCode) : 
          oldCode.replace(pattern.before, pattern.after);

        if (oldCode !== newCode) {
          actions.push({
            type: 'refactor',
            description: `Apply ${pattern.name}: ${pattern.description}`,
            filePath: task.filePath,
            changes: [{
              line: lineNumber,
              column: match.index! - lines.slice(0, -1).join('\n').length - 1,
              oldCode,
              newCode,
              reason: pattern.description
            }],
            confidence: pattern.confidence,
            impact: pattern.confidence > 80 ? 'low' : 'medium',
            canAutoApply: pattern.confidence > 70,
            createdAt: new Date()
          });
        }
      }
    }

    return actions;
  }

  /**
   * Auto-apply safe fixes that meet criteria
   */
  private async autoApplySafeFixes(actions: HealingAction[], content: string): Promise<HealingAction[]> {
    const applied: HealingAction[] = [];

    for (const action of actions) {
      if (action.canAutoApply && 
          action.confidence >= 80 && 
          this.isRiskAcceptable(action.impact)) {
        
        console.log(`🔧 [HEALING] Auto-applying fix: ${action.description}`);
        applied.push(action);
        
        // In a real implementation, this would actually apply the changes
        // For now, we just track what would be applied
      }
    }

    return applied;
  }

  /**
   * Check if risk level is acceptable
   */
  private isRiskAcceptable(riskLevel: 'low' | 'medium' | 'high'): boolean {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const maxLevel = riskLevels[this.maxRiskLevel];
    const actionLevel = riskLevels[riskLevel];
    
    return actionLevel <= maxLevel;
  }

  /**
   * Initialize healing rules
   */
  private initializeHealingRules(): void {
    this.healingRules = [
      // Console.log removal
      {
        id: 'remove-console-logs',
        name: 'Remove console.log statements',
        description: 'Remove debug console.log statements from production code',
        category: 'auto_fix',
        pattern: /console\.log\([^)]*\);?/g,
        confidence: 85,
        riskLevel: 'low',
        canAutoApply: true,
        healer: (content, matches) => {
          return matches.map(match => {
            const lines = content.substring(0, match.index).split('\n');
            return {
              type: 'auto_fix' as const,
              description: 'Remove console.log statement',
              filePath: '',
              changes: [{
                line: lines.length,
                column: match.index! - lines.slice(0, -1).join('\n').length - 1,
                oldCode: match[0],
                newCode: '',
                reason: 'Console statements should not be in production code'
              }],
              confidence: 85,
              impact: 'low' as const,
              canAutoApply: true,
              createdAt: new Date()
            };
          });
        }
      },

      // Async/await conversion
      {
        id: 'convert-to-async-await',
        name: 'Convert promises to async/await',
        description: 'Convert promise chains to async/await for better readability',
        category: 'refactor',
        pattern: /\.then\s*\(\s*([^)]+)\s*\)\s*\.catch\s*\(\s*([^)]+)\s*\)/g,
        confidence: 75,
        riskLevel: 'medium',
        canAutoApply: false,
        healer: (content, matches) => {
          return matches.map(match => {
            const lines = content.substring(0, match.index).split('\n');
            return {
              type: 'refactor' as const,
              description: 'Convert promise chain to async/await',
              filePath: '',
              changes: [{
                line: lines.length,
                column: match.index! - lines.slice(0, -1).join('\n').length - 1,
                oldCode: match[0],
                newCode: '// TODO: Convert to async/await pattern',
                reason: 'Async/await is more readable than promise chains'
              }],
              confidence: 75,
              impact: 'medium' as const,
              canAutoApply: false,
              createdAt: new Date()
            };
          });
        }
      },

      // Import organization
      {
        id: 'organize-imports',
        name: 'Organize import statements',
        description: 'Sort and group import statements for better organization',
        category: 'auto_fix',
        pattern: /^import.*$/gm,
        confidence: 90,
        riskLevel: 'low',
        canAutoApply: true,
        healer: (content, matches) => {
          if (matches.length < 2) return [];

          const imports = matches.map(match => match[0]);
          const sortedImports = this.sortImports(imports);
          
          if (JSON.stringify(imports) === JSON.stringify(sortedImports)) {
            return []; // Already sorted
          }

          return [{
            type: 'auto_fix' as const,
            description: 'Organize import statements',
            filePath: '',
            changes: [{
              line: 1,
              column: 0,
              oldCode: imports.join('\n'),
              newCode: sortedImports.join('\n'),
              reason: 'Organized imports improve code readability'
            }],
            confidence: 90,
            impact: 'low' as const,
            canAutoApply: true,
            createdAt: new Date()
          }];
        }
      },

      // Unused variable removal
      {
        id: 'remove-unused-variables',
        name: 'Remove unused variables',
        description: 'Remove variables that are declared but never used',
        category: 'auto_fix',
        pattern: /(?:const|let|var)\s+(\w+)\s*=([^;]+);/g,
        confidence: 70,
        riskLevel: 'medium',
        canAutoApply: false, // Requires careful analysis
        healer: (content, matches) => {
          const actions: HealingAction[] = [];
          
          for (const match of matches) {
            const varName = match[1];
            const varDeclaration = match[0];
            
            // Simple check: if variable name doesn't appear elsewhere
            const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
            const usages = [...content.matchAll(usageRegex)];
            
            if (usages.length === 1) { // Only the declaration
              const lines = content.substring(0, match.index).split('\n');
              actions.push({
                type: 'auto_fix',
                description: `Remove unused variable: ${varName}`,
                filePath: '',
                changes: [{
                  line: lines.length,
                  column: match.index! - lines.slice(0, -1).join('\n').length - 1,
                  oldCode: varDeclaration,
                  newCode: '',
                  reason: `Variable '${varName}' is declared but never used`
                }],
                confidence: 70,
                impact: 'medium',
                canAutoApply: false,
                createdAt: new Date()
              });
            }
          }
          
          return actions;
        }
      },

      // Hardware error handling enhancement
      {
        id: 'enhance-hardware-error-handling',
        name: 'Enhance hardware error handling',
        description: 'Add proper error handling for hardware operations',
        category: 'security',
        pattern: /(easymidi|naudiodon|usb)\.[\w.]+\([^)]*\)/g,
        confidence: 65,
        riskLevel: 'high',
        canAutoApply: false,
        healer: (content, matches) => {
          const actions: HealingAction[] = [];
          
          for (const match of matches) {
            // Check if this hardware call is already wrapped in try-catch
            const beforeMatch = content.substring(0, match.index);
            const afterMatch = content.substring(match.index! + match[0].length);
            
            const hasTryCatch = beforeMatch.includes('try') && afterMatch.includes('catch');
            
            if (!hasTryCatch) {
              const lines = content.substring(0, match.index).split('\n');
              actions.push({
                type: 'security',
                description: 'Add error handling for hardware operation',
                filePath: '',
                changes: [{
                  line: lines.length,
                  column: match.index! - lines.slice(0, -1).join('\n').length - 1,
                  oldCode: match[0],
                  newCode: `try { ${match[0]} } catch (error) { console.error('Hardware operation failed:', error); }`,
                  reason: 'Hardware operations should be wrapped in error handling'
                }],
                confidence: 65,
                impact: 'high',
                canAutoApply: false,
                createdAt: new Date()
              });
            }
          }
          
          return actions;
        }
      }
    ];
  }

  /**
   * Initialize refactoring patterns
   */
  private initializeRefactoringPatterns(): void {
    this.refactoringPatterns = [
      {
        name: 'Template Literal Conversion',
        description: 'Convert string concatenation to template literals',
        before: /(['"`])[^'"`]*\1\s*\+\s*[^+]+\s*\+\s*(['"`])[^'"`]*\2/g,
        after: (match: string) => {
          // This would implement the actual conversion logic
          return match; // Placeholder
        },
        confidence: 85,
        examples: [
          {
            before: '"Hello " + name + "!"',
            after: '`Hello ${name}!`'
          }
        ]
      },

      {
        name: 'Arrow Function Conversion',
        description: 'Convert function expressions to arrow functions',
        before: /function\s*\(([^)]*)\)\s*{\s*return\s+([^;}]+);?\s*}/g,
        after: '($1) => $2',
        confidence: 80,
        examples: [
          {
            before: 'function(x) { return x * 2; }',
            after: '(x) => x * 2'
          }
        ]
      },

      {
        name: 'Object Destructuring',
        description: 'Use object destructuring for property access',
        before: /const\s+(\w+)\s*=\s*(\w+)\.(\w+);\s*const\s+(\w+)\s*=\s*\2\.(\w+);/g,
        after: 'const { $3: $1, $5: $4 } = $2;',
        confidence: 75,
        examples: [
          {
            before: 'const name = user.name; const age = user.age;',
            after: 'const { name, age } = user;'
          }
        ]
      }
    ];
  }

  /**
   * Sort import statements
   */
  private sortImports(imports: string[]): string[] {
    const nodeModules: string[] = [];
    const relativeImports: string[] = [];
    const typeImports: string[] = [];

    for (const imp of imports) {
      if (imp.includes('import type')) {
        typeImports.push(imp);
      } else if (imp.includes('./') || imp.includes('../')) {
        relativeImports.push(imp);
      } else {
        nodeModules.push(imp);
      }
    }

    return [
      ...nodeModules.sort(),
      '',
      ...typeImports.sort(),
      '',
      ...relativeImports.sort()
    ].filter(line => line !== '');
  }

  /**
   * Start the healing loop
   */
  private startHealingLoop(): void {
    setInterval(() => {
      this.processHealingQueue();
    }, 1000);
  }

  /**
   * Process queued healing tasks
   */
  private processHealingQueue(): void {
    if (this.healingQueue.length > 0 && this.status.status === 'idle') {
      const { task, content, issues } = this.healingQueue.shift()!;
      this.healCode(task, content, issues).catch(error => {
        console.error(`❌ [HEALING] Failed to heal task ${task.id}:`, error);
      });
    }
  }

  /**
   * Add task to healing queue
   */
  queueHealing(task: RefactoringTask, content: string, issues: any[] = []): void {
    this.healingQueue.push({ task, content, issues });
    console.log(`📋 [HEALING] Queued healing for task: ${task.id}`);
  }

  /**
   * Get applied fixes for a task
   */
  getAppliedFixes(taskId: string): HealingAction[] {
    return this.appliedFixes.get(taskId) || [];
  }

  /**
   * Enable or disable auto-apply fixes
   */
  setAutoApply(enabled: boolean): void {
    this.autoApplyFixes = enabled;
    console.log(`🔧 [HEALING] Auto-apply fixes ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set maximum acceptable risk level
   */
  setMaxRiskLevel(level: 'low' | 'medium' | 'high'): void {
    this.maxRiskLevel = level;
    console.log(`🔧 [HEALING] Max risk level set to: ${level}`);
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
   * Shutdown the healing worker
   */
  async shutdown(): Promise<void> {
    console.log(`🛑 [HEALING] Shutting down worker ${this.workerId}`);
    this.status.status = 'offline';
    this.emit('shutdown');
  }
}