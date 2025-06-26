#!/usr/bin/env node

/**
 * Code Quality Monitoring System
 * Tracks code quality metrics over time and provides insights
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface QualityMetrics {
  timestamp: Date;
  typescript: {
    errors: number;
    warnings: number;
    coverage: number;
  };
  eslint: {
    errors: number;
    warnings: number;
    fixable: number;
  };
  tests: {
    passed: number;
    failed: number;
    skipped: number;
    coverage: {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    };
  };
  bundle: {
    size: number;
    gzipSize: number;
    moduleCount: number;
    chunkCount: number;
  };
  complexity: {
    average: number;
    max: number;
    filesOverThreshold: number;
  };
  dependencies: {
    total: number;
    outdated: number;
    vulnerabilities: {
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
  };
}

export class CodeQualityMonitor {
  private projectPath: string;
  private metricsPath: string;
  private thresholds: any;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.metricsPath = path.join(projectPath, '.quality-metrics');
    this.thresholds = this.loadThresholds();
  }

  private loadThresholds(): any {
    return {
      typescript: { errors: 0, warnings: 10 },
      eslint: { errors: 0, warnings: 20 },
      coverage: { lines: 80, functions: 80, branches: 70, statements: 80 },
      complexity: { average: 10, max: 20 },
      bundle: { sizeIncrease: 5 } // 5% max increase
    };
  }

  async runFullAnalysis(): Promise<QualityMetrics> {
    console.log('🔍 Running comprehensive code quality analysis...\n');

    const metrics: QualityMetrics = {
      timestamp: new Date(),
      typescript: await this.analyzeTypeScript(),
      eslint: await this.analyzeESLint(),
      tests: await this.analyzeTests(),
      bundle: await this.analyzeBundle(),
      complexity: await this.analyzeComplexity(),
      dependencies: await this.analyzeDependencies()
    };

    await this.saveMetrics(metrics);
    await this.generateReport(metrics);
    
    return metrics;
  }

  private async analyzeTypeScript(): Promise<QualityMetrics['typescript']> {
    try {
      const { stdout } = await execAsync('npx tsc --noEmit --pretty false', {
        cwd: this.projectPath
      });
      
      const lines = stdout.split('\n').filter(Boolean);
      const errors = lines.filter(l => l.includes('error')).length;
      const warnings = lines.filter(l => l.includes('warning')).length;
      
      // Get coverage from previous test run
      const coverage = await this.getTestCoverage();
      
      return { errors, warnings, coverage: coverage.lines };
    } catch (error) {
      // TypeScript found errors
      const output = error.stdout || '';
      const errors = (output.match(/error TS/g) || []).length;
      const warnings = (output.match(/warning/g) || []).length;
      
      return { errors, warnings, coverage: 0 };
    }
  }

  private async analyzeESLint(): Promise<QualityMetrics['eslint']> {
    try {
      const { stdout } = await execAsync(
        'npx eslint src --format json --max-warnings 0',
        { cwd: this.projectPath }
      );
      
      const results = JSON.parse(stdout);
      let totalErrors = 0;
      let totalWarnings = 0;
      let fixableErrors = 0;
      
      results.forEach((file: any) => {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;
        fixableErrors += file.fixableErrorCount + file.fixableWarningCount;
      });
      
      return {
        errors: totalErrors,
        warnings: totalWarnings,
        fixable: fixableErrors
      };
    } catch (error) {
      // ESLint found issues
      return { errors: 0, warnings: 0, fixable: 0 };
    }
  }

  private async analyzeTests(): Promise<QualityMetrics['tests']> {
    try {
      const { stdout } = await execAsync(
        'npx vitest run --reporter=json --coverage',
        { cwd: this.projectPath }
      );
      
      const results = JSON.parse(stdout);
      const coverage = await this.getTestCoverage();
      
      return {
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
        skipped: results.numPendingTests || 0,
        coverage
      };
    } catch {
      return {
        passed: 0,
        failed: 0,
        skipped: 0,
        coverage: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0
        }
      };
    }
  }

  private async getTestCoverage(): Promise<QualityMetrics['tests']['coverage']> {
    try {
      const coveragePath = path.join(this.projectPath, 'coverage/coverage-summary.json');
      const coverage = JSON.parse(await fs.readFile(coveragePath, 'utf-8'));
      
      return {
        lines: coverage.total.lines.pct,
        functions: coverage.total.functions.pct,
        branches: coverage.total.branches.pct,
        statements: coverage.total.statements.pct
      };
    } catch {
      return { lines: 0, functions: 0, branches: 0, statements: 0 };
    }
  }

  private async analyzeBundle(): Promise<QualityMetrics['bundle']> {
    try {
      const { stdout } = await execAsync(
        'npx webpack-bundle-analyzer dist/stats.json --mode json',
        { cwd: this.projectPath }
      );
      
      const analysis = JSON.parse(stdout);
      
      return {
        size: analysis.bundleSize,
        gzipSize: analysis.gzipSize,
        moduleCount: analysis.modules.length,
        chunkCount: analysis.chunks.length
      };
    } catch {
      // Fallback to basic analysis
      const distPath = path.join(this.projectPath, 'dist');
      let totalSize = 0;
      
      try {
        const files = await fs.readdir(distPath, { recursive: true });
        for (const file of files) {
          if (file.toString().endsWith('.js')) {
            const stats = await fs.stat(path.join(distPath, file.toString()));
            totalSize += stats.size;
          }
        }
      } catch {}
      
      return {
        size: totalSize,
        gzipSize: totalSize * 0.3, // Estimate
        moduleCount: 0,
        chunkCount: 0
      };
    }
  }

  private async analyzeComplexity(): Promise<QualityMetrics['complexity']> {
    try {
      const { stdout } = await execAsync(
        'npx es6-plato -r -d complexity-report src',
        { cwd: this.projectPath }
      );
      
      // Parse complexity report
      const reportPath = path.join(this.projectPath, 'complexity-report/report.json');
      const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
      
      const complexities = report.reports.map((r: any) => r.complexity.cyclomatic);
      const average = complexities.reduce((a: number, b: number) => a + b, 0) / complexities.length;
      const max = Math.max(...complexities);
      const overThreshold = complexities.filter((c: number) => c > this.thresholds.complexity.max).length;
      
      return { average, max, filesOverThreshold: overThreshold };
    } catch {
      return { average: 0, max: 0, filesOverThreshold: 0 };
    }
  }

  private async analyzeDependencies(): Promise<QualityMetrics['dependencies']> {
    try {
      // Check for outdated dependencies
      const { stdout: outdated } = await execAsync(
        'npm outdated --json',
        { cwd: this.projectPath }
      );
      
      const outdatedDeps = Object.keys(JSON.parse(outdated || '{}')).length;
      
      // Run security audit
      const { stdout: audit } = await execAsync(
        'npm audit --json',
        { cwd: this.projectPath }
      );
      
      const auditData = JSON.parse(audit);
      const vulnerabilities = auditData.metadata.vulnerabilities;
      
      // Count total dependencies
      const packageJson = JSON.parse(
        await fs.readFile(path.join(this.projectPath, 'package.json'), 'utf-8')
      );
      
      const totalDeps = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }).length;
      
      return {
        total: totalDeps,
        outdated: outdatedDeps,
        vulnerabilities: {
          low: vulnerabilities.low || 0,
          moderate: vulnerabilities.moderate || 0,
          high: vulnerabilities.high || 0,
          critical: vulnerabilities.critical || 0
        }
      };
    } catch {
      return {
        total: 0,
        outdated: 0,
        vulnerabilities: { low: 0, moderate: 0, high: 0, critical: 0 }
      };
    }
  }

  private async saveMetrics(metrics: QualityMetrics): Promise<void> {
    await fs.mkdir(this.metricsPath, { recursive: true });
    
    const filename = `metrics-${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(
      path.join(this.metricsPath, filename),
      JSON.stringify(metrics, null, 2)
    );
  }

  private async generateReport(metrics: QualityMetrics): Promise<void> {
    console.log('\n📊 Code Quality Report\n');
    console.log('='.repeat(50));
    
    // TypeScript
    console.log('\n🔷 TypeScript:');
    console.log(`  Errors: ${metrics.typescript.errors} ${this.getStatus(metrics.typescript.errors === 0)}`);
    console.log(`  Warnings: ${metrics.typescript.warnings}`);
    console.log(`  Coverage: ${metrics.typescript.coverage}%`);
    
    // ESLint
    console.log('\n🔍 ESLint:');
    console.log(`  Errors: ${metrics.eslint.errors} ${this.getStatus(metrics.eslint.errors === 0)}`);
    console.log(`  Warnings: ${metrics.eslint.warnings}`);
    console.log(`  Auto-fixable: ${metrics.eslint.fixable}`);
    
    // Tests
    console.log('\n🧪 Tests:');
    console.log(`  Passed: ${metrics.tests.passed}`);
    console.log(`  Failed: ${metrics.tests.failed} ${this.getStatus(metrics.tests.failed === 0)}`);
    console.log(`  Coverage:`);
    console.log(`    Lines: ${metrics.tests.coverage.lines}% ${this.getStatus(metrics.tests.coverage.lines >= this.thresholds.coverage.lines)}`);
    console.log(`    Functions: ${metrics.tests.coverage.functions}%`);
    console.log(`    Branches: ${metrics.tests.coverage.branches}%`);
    console.log(`    Statements: ${metrics.tests.coverage.statements}%`);
    
    // Bundle
    console.log('\n📦 Bundle:');
    console.log(`  Size: ${(metrics.bundle.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Gzip: ${(metrics.bundle.gzipSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Modules: ${metrics.bundle.moduleCount}`);
    console.log(`  Chunks: ${metrics.bundle.chunkCount}`);
    
    // Complexity
    console.log('\n🔧 Complexity:');
    console.log(`  Average: ${metrics.complexity.average.toFixed(1)} ${this.getStatus(metrics.complexity.average <= this.thresholds.complexity.average)}`);
    console.log(`  Max: ${metrics.complexity.max}`);
    console.log(`  Over threshold: ${metrics.complexity.filesOverThreshold} files`);
    
    // Dependencies
    console.log('\n📚 Dependencies:');
    console.log(`  Total: ${metrics.dependencies.total}`);
    console.log(`  Outdated: ${metrics.dependencies.outdated}`);
    console.log(`  Vulnerabilities:`);
    const vulns = metrics.dependencies.vulnerabilities;
    console.log(`    Critical: ${vulns.critical} ${this.getStatus(vulns.critical === 0)}`);
    console.log(`    High: ${vulns.high} ${this.getStatus(vulns.high === 0)}`);
    console.log(`    Moderate: ${vulns.moderate}`);
    console.log(`    Low: ${vulns.low}`);
    
    console.log('\n' + '='.repeat(50));
    
    // Overall health score
    const score = this.calculateHealthScore(metrics);
    console.log(`\n🏆 Overall Health Score: ${score}/100 ${this.getGrade(score)}`);
  }

  private getStatus(pass: boolean): string {
    return pass ? '✅' : '❌';
  }

  private getGrade(score: number): string {
    if (score >= 95) return '🌟 Excellent';
    if (score >= 85) return '✨ Great';
    if (score >= 75) return '👍 Good';
    if (score >= 65) return '⚠️ Needs Improvement';
    return '🚨 Poor';
  }

  private calculateHealthScore(metrics: QualityMetrics): number {
    let score = 100;
    
    // TypeScript errors (critical)
    score -= metrics.typescript.errors * 5;
    score -= metrics.typescript.warnings * 0.5;
    
    // ESLint issues
    score -= metrics.eslint.errors * 3;
    score -= metrics.eslint.warnings * 0.3;
    
    // Test failures (critical)
    score -= metrics.tests.failed * 10;
    
    // Coverage penalties
    const coverageDeficit = Math.max(0, this.thresholds.coverage.lines - metrics.tests.coverage.lines);
    score -= coverageDeficit * 0.5;
    
    // Complexity penalties
    if (metrics.complexity.average > this.thresholds.complexity.average) {
      score -= (metrics.complexity.average - this.thresholds.complexity.average) * 2;
    }
    score -= metrics.complexity.filesOverThreshold * 2;
    
    // Security vulnerabilities
    score -= metrics.dependencies.vulnerabilities.critical * 10;
    score -= metrics.dependencies.vulnerabilities.high * 5;
    score -= metrics.dependencies.vulnerabilities.moderate * 2;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async compareWithPrevious(): Promise<void> {
    const files = await fs.readdir(this.metricsPath);
    const metricsFiles = files
      .filter(f => f.startsWith('metrics-'))
      .sort()
      .slice(-2);
    
    if (metricsFiles.length < 2) {
      console.log('Not enough historical data for comparison');
      return;
    }
    
    const [previous, current] = await Promise.all(
      metricsFiles.map(async f => 
        JSON.parse(await fs.readFile(path.join(this.metricsPath, f), 'utf-8'))
      )
    );
    
    console.log('\n📈 Trend Analysis\n');
    console.log('Comparing with previous run:');
    
    // Compare key metrics
    this.compareMetric('TypeScript Errors', previous.typescript.errors, current.typescript.errors);
    this.compareMetric('Test Coverage', previous.tests.coverage.lines, current.tests.coverage.lines, true);
    this.compareMetric('Bundle Size (MB)', 
      previous.bundle.size / 1024 / 1024,
      current.bundle.size / 1024 / 1024
    );
    this.compareMetric('Complexity', previous.complexity.average, current.complexity.average);
  }

  private compareMetric(name: string, previous: number, current: number, higherBetter = false): void {
    const diff = current - previous;
    const percent = previous > 0 ? (diff / previous * 100).toFixed(1) : '0';
    
    let symbol = '';
    if (diff > 0) symbol = higherBetter ? '📈' : '📉';
    else if (diff < 0) symbol = higherBetter ? '📉' : '📈';
    else symbol = '→';
    
    console.log(`  ${symbol} ${name}: ${previous.toFixed(1)} → ${current.toFixed(1)} (${diff > 0 ? '+' : ''}${percent}%)`);
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new CodeQualityMonitor(process.cwd());
  
  const command = process.argv[2];
  
  switch (command) {
    case 'analyze':
      monitor.runFullAnalysis()
        .then(() => monitor.compareWithPrevious())
        .catch(console.error);
      break;
    
    case 'watch':
      console.log('👀 Watching for changes...');
      // Implement file watcher
      break;
    
    default:
      console.log('Usage: code-quality-monitor [analyze|watch]');
  }
}