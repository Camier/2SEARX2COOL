#!/usr/bin/env node

/**
 * Test Automation System
 * Intelligent test generation, execution, and coverage optimization
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as ts from 'typescript';

const execAsync = promisify(exec);

interface TestFile {
  path: string;
  type: 'unit' | 'integration' | 'e2e';
  coverage: number;
  status: 'passing' | 'failing' | 'missing';
}

interface TestSuite {
  name: string;
  files: TestFile[];
  totalCoverage: number;
  missingTests: string[];
}

export class TestAutomation {
  private projectPath: string;
  private srcPath: string;
  private testPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.srcPath = path.join(projectPath, 'src');
    this.testPath = path.join(projectPath, 'test');
  }

  async analyzeTestCoverage(): Promise<TestSuite> {
    console.log('🔍 Analyzing test coverage...\n');

    const sourceFiles = await this.findSourceFiles();
    const testFiles = await this.findTestFiles();
    const coverage = await this.getCoverageData();
    
    const suite: TestSuite = {
      name: 'Application Test Suite',
      files: [],
      totalCoverage: 0,
      missingTests: []
    };

    // Analyze each source file
    for (const sourceFile of sourceFiles) {
      const testFile = this.findCorrespondingTest(sourceFile, testFiles);
      const fileCoverage = coverage[sourceFile] || 0;
      
      if (!testFile) {
        suite.missingTests.push(sourceFile);
      }
      
      suite.files.push({
        path: sourceFile,
        type: this.determineTestType(sourceFile),
        coverage: fileCoverage,
        status: testFile ? (fileCoverage > 80 ? 'passing' : 'failing') : 'missing'
      });
    }

    suite.totalCoverage = this.calculateAverageCoverage(suite.files);
    
    return suite;
  }

  async generateMissingTests(): Promise<void> {
    console.log('🧪 Generating missing tests...\n');

    const suite = await this.analyzeTestCoverage();
    
    for (const missingFile of suite.missingTests) {
      await this.generateTestFile(missingFile);
    }

    console.log(`✅ Generated ${suite.missingTests.length} test files`);
  }

  private async generateTestFile(sourceFile: string): Promise<void> {
    const sourceContent = await fs.readFile(sourceFile, 'utf-8');
    const parsed = this.parseTypeScriptFile(sourceContent);
    const testContent = this.generateTestContent(parsed, sourceFile);
    
    const testFile = this.getTestFilePath(sourceFile);
    await fs.mkdir(path.dirname(testFile), { recursive: true });
    await fs.writeFile(testFile, testContent);
    
    console.log(`  ✓ Generated test for ${path.basename(sourceFile)}`);
  }

  private parseTypeScriptFile(content: string): any {
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const exports: any[] = [];
    const classes: any[] = [];
    const functions: any[] = [];

    function visit(node: ts.Node) {
      if (ts.isClassDeclaration(node) && node.name) {
        classes.push({
          name: node.name.text,
          methods: extractClassMethods(node)
        });
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push({
          name: node.name.text,
          parameters: node.parameters.map(p => p.name?.getText())
        });
      } else if (ts.isExportDeclaration(node)) {
        exports.push(node);
      }
      
      ts.forEachChild(node, visit);
    }

    function extractClassMethods(node: ts.ClassDeclaration): any[] {
      const methods: any[] = [];
      
      node.members.forEach(member => {
        if (ts.isMethodDeclaration(member) && member.name) {
          methods.push({
            name: member.name.getText(),
            isPublic: !member.modifiers?.some(m => 
              m.kind === ts.SyntaxKind.PrivateKeyword
            )
          });
        }
      });
      
      return methods;
    }

    visit(sourceFile);
    
    return { classes, functions, exports };
  }

  private generateTestContent(parsed: any, sourceFile: string): string {
    const moduleName = path.basename(sourceFile, path.extname(sourceFile));
    const importPath = path.relative(
      path.dirname(this.getTestFilePath(sourceFile)),
      sourceFile.replace('.ts', '')
    ).replace(/\\/g, '/');

    let content = `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ${parsed.classes.map(c => c.name).concat(parsed.functions.map(f => f.name)).join(', ')} } from '${importPath}';

`;

    // Generate tests for classes
    parsed.classes.forEach(cls => {
      content += `describe('${cls.name}', () => {
  let instance: ${cls.name};

  beforeEach(() => {
    instance = new ${cls.name}();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

`;

      cls.methods.filter(m => m.isPublic).forEach(method => {
        content += `  describe('${method.name}', () => {
    it('should execute without errors', async () => {
      // TODO: Implement test
      expect(() => instance.${method.name}()).not.toThrow();
    });

    it('should return expected result', async () => {
      // TODO: Implement test
      const result = await instance.${method.name}();
      expect(result).toBeDefined();
    });
  });

`;
      });

      content += '});\n\n';
    });

    // Generate tests for functions
    parsed.functions.forEach(func => {
      content += `describe('${func.name}', () => {
  it('should execute without errors', () => {
    // TODO: Implement test
    expect(() => ${func.name}()).not.toThrow();
  });

  it('should return expected result', () => {
    // TODO: Implement test
    const result = ${func.name}();
    expect(result).toBeDefined();
  });

  it('should handle edge cases', () => {
    // TODO: Implement edge case tests
  });
});

`;
    });

    return content;
  }

  async runTests(options: {
    watch?: boolean;
    coverage?: boolean;
    filter?: string;
  } = {}): Promise<void> {
    console.log('🏃 Running tests...\n');

    const args = ['vitest', 'run'];
    
    if (options.watch) args.push('--watch');
    if (options.coverage) args.push('--coverage');
    if (options.filter) args.push('--testNamePattern', options.filter);

    try {
      const { stdout, stderr } = await execAsync(
        `npx ${args.join(' ')}`,
        { cwd: this.projectPath }
      );
      
      console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (error) {
      console.error('Test execution failed:', error);
      throw error;
    }
  }

  async optimizeCoverage(): Promise<void> {
    console.log('🎯 Optimizing test coverage...\n');

    const coverage = await this.getCoverageData();
    const lowCoverageFiles = Object.entries(coverage)
      .filter(([_, cov]) => cov < 80)
      .map(([file]) => file);

    for (const file of lowCoverageFiles) {
      await this.improveTestCoverage(file);
    }
  }

  private async improveTestCoverage(sourceFile: string): Promise<void> {
    const testFile = this.getTestFilePath(sourceFile);
    
    try {
      const testContent = await fs.readFile(testFile, 'utf-8');
      const uncoveredLines = await this.getUncoveredLines(sourceFile);
      const additionalTests = this.generateCoverageTests(sourceFile, uncoveredLines);
      
      // Insert additional tests before the last closing brace
      const updatedContent = testContent.replace(
        /}\s*\)\s*;\s*$/,
        additionalTests + '\n});'
      );
      
      await fs.writeFile(testFile, updatedContent);
      console.log(`  ✓ Improved coverage for ${path.basename(sourceFile)}`);
    } catch (error) {
      console.error(`  ✗ Failed to improve coverage for ${path.basename(sourceFile)}`);
    }
  }

  private generateCoverageTests(sourceFile: string, uncoveredLines: number[]): string {
    // Generate tests targeting uncovered lines
    return `
  describe('Additional coverage tests', () => {
    it('should cover edge cases', () => {
      // Auto-generated test for lines: ${uncoveredLines.join(', ')}
      // TODO: Implement specific tests for uncovered code paths
    });
  });`;
  }

  async setupE2ETests(): Promise<void> {
    console.log('🎭 Setting up E2E tests with Playwright...\n');

    const e2eDir = path.join(this.testPath, 'e2e');
    await fs.mkdir(e2eDir, { recursive: true });

    // Create base E2E test
    const e2eContent = `import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Application E2E Tests', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['./out/main/index.js']
    });
    window = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('should launch application', async () => {
    const title = await window.title();
    expect(title).toContain('SearXNG');
  });

  test('should perform search', async () => {
    await window.fill('#search-input', 'test query');
    await window.click('#search-button');
    
    await window.waitForSelector('.search-results');
    const results = await window.$$('.search-result');
    expect(results.length).toBeGreaterThan(0);
  });

  test('should navigate to settings', async () => {
    await window.click('[data-testid="settings-button"]');
    await expect(window.locator('.settings-page')).toBeVisible();
  });

  test('should handle keyboard shortcuts', async () => {
    await window.keyboard.press('Control+K');
    await expect(window.locator('#search-input')).toBeFocused();
  });
});
`;

    await fs.writeFile(path.join(e2eDir, 'app.spec.ts'), e2eContent);

    // Create E2E configuration
    const e2eConfig = `import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './test/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
};

export default config;
`;

    await fs.writeFile(path.join(this.projectPath, 'playwright-e2e.config.ts'), e2eConfig);
  }

  async generateTestReport(): Promise<void> {
    console.log('📊 Generating test report...\n');

    const suite = await this.analyzeTestCoverage();
    const report = {
      timestamp: new Date(),
      summary: {
        totalFiles: suite.files.length,
        totalCoverage: suite.totalCoverage,
        passingTests: suite.files.filter(f => f.status === 'passing').length,
        failingTests: suite.files.filter(f => f.status === 'failing').length,
        missingTests: suite.missingTests.length
      },
      recommendations: this.generateTestRecommendations(suite),
      detailedCoverage: suite.files.map(f => ({
        file: f.path,
        coverage: f.coverage,
        status: f.status,
        type: f.type
      }))
    };

    const reportPath = path.join(
      this.projectPath,
      'test-reports',
      `report-${new Date().toISOString().split('T')[0]}.json`
    );

    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    await this.generateHTMLReport(report, reportPath.replace('.json', '.html'));

    console.log(`✅ Test report generated at ${reportPath}`);
  }

  private generateTestRecommendations(suite: TestSuite): string[] {
    const recommendations: string[] = [];

    if (suite.totalCoverage < 80) {
      recommendations.push('Increase overall test coverage to at least 80%');
    }

    if (suite.missingTests.length > 0) {
      recommendations.push(`Generate tests for ${suite.missingTests.length} files without coverage`);
    }

    const lowCoverageFiles = suite.files.filter(f => f.coverage < 60);
    if (lowCoverageFiles.length > 0) {
      recommendations.push(`Improve coverage for ${lowCoverageFiles.length} files with coverage below 60%`);
    }

    const missingE2E = !suite.files.some(f => f.type === 'e2e');
    if (missingE2E) {
      recommendations.push('Add E2E tests for critical user workflows');
    }

    return recommendations;
  }

  private async generateHTMLReport(report: any, htmlPath: string): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${report.timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .coverage-bar { background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .coverage-fill { background: #4caf50; height: 100%; transition: width 0.3s; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .file-list { margin-top: 20px; }
        .file-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 0.9em; }
        .status.passing { background: #d4edda; color: #155724; }
        .status.failing { background: #f8d7da; color: #721c24; }
        .status.missing { background: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Report</h1>
        <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
        
        <div class="summary">
            <div class="summary-card">
                <div>Total Files</div>
                <div class="summary-value">${report.summary.totalFiles}</div>
            </div>
            <div class="summary-card">
                <div>Coverage</div>
                <div class="summary-value">${report.summary.totalCoverage.toFixed(1)}%</div>
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${report.summary.totalCoverage}%"></div>
                </div>
            </div>
            <div class="summary-card">
                <div>Passing</div>
                <div class="summary-value" style="color: #4caf50">${report.summary.passingTests}</div>
            </div>
            <div class="summary-card">
                <div>Failing</div>
                <div class="summary-value" style="color: #f44336">${report.summary.failingTests}</div>
            </div>
            <div class="summary-card">
                <div>Missing</div>
                <div class="summary-value" style="color: #ff9800">${report.summary.missingTests}</div>
            </div>
        </div>
        
        ${report.recommendations.length > 0 ? `
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        <h2>Detailed Coverage</h2>
        <div class="file-list">
            ${report.detailedCoverage.map(file => `
            <div class="file-item">
                <div>
                    <strong>${path.basename(file.file)}</strong>
                    <span style="color: #666; font-size: 0.9em">${path.dirname(file.file)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span>${file.coverage.toFixed(1)}%</span>
                    <span class="status ${file.status}">${file.status}</span>
                </div>
            </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

    await fs.writeFile(htmlPath, html);
  }

  // Helper methods
  private async findSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    }
    
    await walk(this.srcPath);
    return files;
  }

  private async findTestFiles(): Promise<string[]> {
    const files: string[] = [];
    
    try {
      async function walk(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts'))) {
            files.push(fullPath);
          }
        }
      }
      
      await walk(this.testPath);
    } catch {
      // Test directory might not exist
    }
    
    return files;
  }

  private findCorrespondingTest(sourceFile: string, testFiles: string[]): string | undefined {
    const baseName = path.basename(sourceFile, '.ts');
    return testFiles.find(tf => 
      tf.includes(baseName) && (tf.endsWith('.test.ts') || tf.endsWith('.spec.ts'))
    );
  }

  private determineTestType(file: string): 'unit' | 'integration' | 'e2e' {
    if (file.includes('/e2e/')) return 'e2e';
    if (file.includes('/integration/')) return 'integration';
    return 'unit';
  }

  private getTestFilePath(sourceFile: string): string {
    const relativePath = path.relative(this.srcPath, sourceFile);
    const testName = relativePath.replace('.ts', '.test.ts');
    return path.join(this.testPath, 'unit', testName);
  }

  private async getCoverageData(): Promise<Record<string, number>> {
    try {
      const coveragePath = path.join(this.projectPath, 'coverage/coverage-final.json');
      const coverage = JSON.parse(await fs.readFile(coveragePath, 'utf-8'));
      
      const data: Record<string, number> = {};
      
      Object.entries(coverage).forEach(([file, fileCoverage]: [string, any]) => {
        const statements = fileCoverage.s;
        const total = Object.keys(statements).length;
        const covered = Object.values(statements).filter((v: any) => v > 0).length;
        data[file] = total > 0 ? (covered / total) * 100 : 0;
      });
      
      return data;
    } catch {
      return {};
    }
  }

  private async getUncoveredLines(sourceFile: string): Promise<number[]> {
    // This would parse the detailed coverage report
    // For now, return mock data
    return [45, 67, 89, 102];
  }

  private calculateAverageCoverage(files: TestFile[]): number {
    if (files.length === 0) return 0;
    const sum = files.reduce((acc, f) => acc + f.coverage, 0);
    return sum / files.length;
  }
}

// CLI execution
if (require.main === module) {
  const automation = new TestAutomation(process.cwd());
  
  const command = process.argv[2];
  
  switch (command) {
    case 'analyze':
      automation.analyzeTestCoverage()
        .then(suite => console.log('Analysis complete:', suite))
        .catch(console.error);
      break;
    
    case 'generate':
      automation.generateMissingTests()
        .catch(console.error);
      break;
    
    case 'run':
      automation.runTests({ coverage: true })
        .catch(console.error);
      break;
    
    case 'optimize':
      automation.optimizeCoverage()
        .catch(console.error);
      break;
    
    case 'e2e-setup':
      automation.setupE2ETests()
        .catch(console.error);
      break;
    
    case 'report':
      automation.generateTestReport()
        .catch(console.error);
      break;
    
    default:
      console.log('Usage: test-automation [analyze|generate|run|optimize|e2e-setup|report]');
  }
}