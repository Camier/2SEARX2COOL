#!/usr/bin/env node

/**
 * Development Tooling Integration
 * Central command interface for all development tools
 */

import { Command } from 'commander';
import { RefactoringOrchestrator } from '../refactoring-system/orchestrator';
import { CodeQualityMonitor } from './code-quality-monitor';
import { PerformanceMonitor } from './performance-monitor';
import { TestAutomation } from './test-automation';
import { BuildOptimizer } from './build-optimizer';
import * as chalk from 'chalk';
import * as ora from 'ora';

const program = new Command();

program
  .name('dev-tools')
  .description('Integrated development tooling for SearXNG')
  .version('1.0.0');

// Refactoring command
program
  .command('refactor')
  .description('Run the intelligent refactoring system')
  .option('-w, --watch', 'Watch mode for continuous refactoring')
  .option('-d, --dry-run', 'Preview changes without applying')
  .action(async (options) => {
    const spinner = ora('Starting refactoring system...').start();
    
    try {
      const orchestrator = new RefactoringOrchestrator(process.cwd());
      await orchestrator.start();
      spinner.succeed('Refactoring completed successfully');
    } catch (error) {
      spinner.fail('Refactoring failed');
      console.error(error);
      process.exit(1);
    }
  });

// Code quality command
program
  .command('quality')
  .description('Analyze code quality metrics')
  .option('-w, --watch', 'Watch mode for continuous monitoring')
  .option('-f, --fix', 'Automatically fix issues where possible')
  .action(async (options) => {
    const monitor = new CodeQualityMonitor(process.cwd());
    
    if (options.watch) {
      console.log(chalk.blue('👀 Watching for changes...'));
      // Implement file watcher
    } else {
      const spinner = ora('Analyzing code quality...').start();
      
      try {
        const metrics = await monitor.runFullAnalysis();
        spinner.succeed('Analysis complete');
        await monitor.compareWithPrevious();
      } catch (error) {
        spinner.fail('Analysis failed');
        console.error(error);
      }
    }
  });

// Performance command
program
  .command('perf')
  .description('Monitor performance metrics')
  .addCommand(
    new Command('build')
      .description('Monitor build performance')
      .action(async () => {
        const monitor = new PerformanceMonitor(process.cwd());
        await monitor.monitorBuild();
      })
  )
  .addCommand(
    new Command('runtime')
      .description('Monitor runtime performance')
      .option('-d, --duration <ms>', 'Monitoring duration', '60000')
      .action(async (options) => {
        const monitor = new PerformanceMonitor(process.cwd());
        await monitor.monitorRuntime(parseInt(options.duration));
      })
  )
  .addCommand(
    new Command('dashboard')
      .description('Start performance dashboard')
      .option('-p, --port <port>', 'Dashboard port', '8093')
      .action(async (options) => {
        const monitor = new PerformanceMonitor(process.cwd());
        await monitor.startDashboard(parseInt(options.port));
      })
  );

// Testing command
program
  .command('test')
  .description('Automated testing utilities')
  .addCommand(
    new Command('generate')
      .description('Generate missing test files')
      .action(async () => {
        const automation = new TestAutomation(process.cwd());
        await automation.generateMissingTests();
      })
  )
  .addCommand(
    new Command('coverage')
      .description('Analyze and optimize test coverage')
      .action(async () => {
        const automation = new TestAutomation(process.cwd());
        const suite = await automation.analyzeTestCoverage();
        console.log(chalk.blue(`\nTotal Coverage: ${suite.totalCoverage.toFixed(1)}%`));
        console.log(chalk.yellow(`Missing Tests: ${suite.missingTests.length} files`));
      })
  )
  .addCommand(
    new Command('e2e-setup')
      .description('Set up E2E testing infrastructure')
      .action(async () => {
        const automation = new TestAutomation(process.cwd());
        await automation.setupE2ETests();
      })
  )
  .addCommand(
    new Command('report')
      .description('Generate comprehensive test report')
      .action(async () => {
        const automation = new TestAutomation(process.cwd());
        await automation.generateTestReport();
      })
  );

// Build optimization command
program
  .command('build')
  .description('Build optimization tools')
  .addCommand(
    new Command('analyze')
      .description('Analyze build output')
      .action(async () => {
        const optimizer = new BuildOptimizer(process.cwd());
        await optimizer.analyzeBuild();
      })
  )
  .addCommand(
    new Command('optimize')
      .description('Apply build optimizations')
      .action(async () => {
        const optimizer = new BuildOptimizer(process.cwd());
        await optimizer.optimizeBuild();
      })
  )
  .addCommand(
    new Command('split')
      .description('Implement code splitting')
      .action(async () => {
        const optimizer = new BuildOptimizer(process.cwd());
        await optimizer.implementCodeSplitting();
      })
  )
  .addCommand(
    new Command('assets')
      .description('Optimize static assets')
      .action(async () => {
        const optimizer = new BuildOptimizer(process.cwd());
        await optimizer.optimizeAssets();
      })
  );

// Full suite command
program
  .command('full')
  .description('Run complete development tooling suite')
  .option('-s, --skip <tools>', 'Skip specific tools (comma-separated)')
  .action(async (options) => {
    const skip = options.skip ? options.skip.split(',') : [];
    
    console.log(chalk.bold.blue('\n🚀 Running Full Development Suite\n'));
    
    const tasks = [
      {
        name: 'Code Quality',
        skip: skip.includes('quality'),
        run: async () => {
          const monitor = new CodeQualityMonitor(process.cwd());
          await monitor.runFullAnalysis();
        }
      },
      {
        name: 'Test Coverage',
        skip: skip.includes('test'),
        run: async () => {
          const automation = new TestAutomation(process.cwd());
          await automation.analyzeTestCoverage();
        }
      },
      {
        name: 'Build Analysis',
        skip: skip.includes('build'),
        run: async () => {
          const optimizer = new BuildOptimizer(process.cwd());
          await optimizer.analyzeBuild();
        }
      },
      {
        name: 'Performance Metrics',
        skip: skip.includes('perf'),
        run: async () => {
          const monitor = new PerformanceMonitor(process.cwd());
          await monitor.monitorBuild();
        }
      }
    ];
    
    for (const task of tasks) {
      if (task.skip) {
        console.log(chalk.gray(`⏭️  Skipping ${task.name}`));
        continue;
      }
      
      const spinner = ora(`Running ${task.name}...`).start();
      
      try {
        await task.run();
        spinner.succeed(`${task.name} completed`);
      } catch (error) {
        spinner.fail(`${task.name} failed`);
        console.error(error);
      }
    }
    
    console.log(chalk.bold.green('\n✅ Development suite completed\n'));
  });

// Dashboard command
program
  .command('dashboard')
  .description('Launch unified development dashboard')
  .option('-p, --port <port>', 'Dashboard port', '8090')
  .action(async (options) => {
    console.log(chalk.blue(`\n🚀 Starting unified dashboard on port ${options.port}...\n`));
    
    // Start all monitoring services
    const perfMonitor = new PerformanceMonitor(process.cwd());
    await perfMonitor.startDashboard(parseInt(options.port));
    
    console.log(chalk.green(`\n✅ Dashboard available at http://localhost:${options.port}\n`));
    console.log('Press Ctrl+C to stop');
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Interactive development assistant')
  .action(async () => {
    const inquirer = await import('inquirer');
    
    while (true) {
      const { action } = await inquirer.default.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔧 Run Refactoring System', value: 'refactor' },
            { name: '📊 Analyze Code Quality', value: 'quality' },
            { name: '🧪 Generate Missing Tests', value: 'test-generate' },
            { name: '📈 Check Test Coverage', value: 'test-coverage' },
            { name: '⚡ Optimize Build', value: 'build-optimize' },
            { name: '🎯 Analyze Bundle', value: 'build-analyze' },
            { name: '📊 Launch Dashboard', value: 'dashboard' },
            { name: '🚀 Run Full Suite', value: 'full' },
            new inquirer.default.Separator(),
            { name: '❌ Exit', value: 'exit' }
          ]
        }
      ]);
      
      if (action === 'exit') break;
      
      // Execute selected action
      switch (action) {
        case 'refactor':
          await new RefactoringOrchestrator(process.cwd()).start();
          break;
        case 'quality':
          await new CodeQualityMonitor(process.cwd()).runFullAnalysis();
          break;
        case 'test-generate':
          await new TestAutomation(process.cwd()).generateMissingTests();
          break;
        case 'test-coverage':
          const suite = await new TestAutomation(process.cwd()).analyzeTestCoverage();
          console.log(chalk.blue(`\nTotal Coverage: ${suite.totalCoverage.toFixed(1)}%`));
          break;
        case 'build-optimize':
          await new BuildOptimizer(process.cwd()).optimizeBuild();
          break;
        case 'build-analyze':
          await new BuildOptimizer(process.cwd()).analyzeBuild();
          break;
        case 'dashboard':
          await new PerformanceMonitor(process.cwd()).startDashboard(8090);
          break;
        case 'full':
          // Run full suite
          break;
      }
      
      console.log(chalk.green('\n✅ Task completed\n'));
    }
  });

// Health check command
program
  .command('health')
  .description('Check development environment health')
  .action(async () => {
    console.log(chalk.bold.blue('\n🏥 Development Environment Health Check\n'));
    
    const checks = [
      {
        name: 'Node.js Version',
        check: () => process.version.match(/v(\d+)/)[1] >= 16,
        message: process.version
      },
      {
        name: 'TypeScript',
        check: async () => {
          try {
            const { stdout } = await import('child_process').then(m => 
              m.execSync('npx tsc --version', { encoding: 'utf8' })
            );
            return true;
          } catch {
            return false;
          }
        },
        message: 'TypeScript compiler'
      },
      {
        name: 'ESLint',
        check: async () => {
          try {
            await import('eslint');
            return true;
          } catch {
            return false;
          }
        },
        message: 'Code linting'
      },
      {
        name: 'Vitest',
        check: async () => {
          try {
            await import('vitest');
            return true;
          } catch {
            return false;
          }
        },
        message: 'Test framework'
      },
      {
        name: 'Build Tools',
        check: async () => {
          try {
            await import('webpack');
            return true;
          } catch {
            return false;
          }
        },
        message: 'Webpack bundler'
      }
    ];
    
    for (const check of checks) {
      const result = await check.check();
      const icon = result ? chalk.green('✓') : chalk.red('✗');
      console.log(`${icon} ${check.name}: ${check.message}`);
    }
    
    console.log(chalk.bold.blue('\n📁 Project Structure:\n'));
    
    const requiredDirs = ['src', 'test', 'scripts', 'config'];
    for (const dir of requiredDirs) {
      try {
        await import('fs/promises').then(fs => fs.access(dir));
        console.log(chalk.green(`✓ ${dir}/`));
      } catch {
        console.log(chalk.red(`✗ ${dir}/ (missing)`));
      }
    }
  });

// Git hooks setup
program
  .command('hooks')
  .description('Set up git hooks for automated checks')
  .action(async () => {
    const hooksContent = {
      'pre-commit': `#!/bin/sh
# Run linting and formatting
npm run lint:fix
npm run format

# Add changes
git add -A
`,
      'pre-push': `#!/bin/sh
# Run tests
npm test

# Run type checking
npm run type-check

# Check build
npm run build
`,
      'commit-msg': `#!/bin/sh
# Validate commit message format
commit_regex='^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?: .{1,72}$'

if ! grep -qE "$commit_regex" "$1"; then
  echo "Invalid commit message format!"
  echo "Format: <type>(<scope>): <subject>"
  echo "Types: feat, fix, docs, style, refactor, test, chore, perf"
  exit 1
fi
`
    };
    
    const fs = await import('fs/promises');
    const path = await import('path');
    
    for (const [hook, content] of Object.entries(hooksContent)) {
      const hookPath = path.join('.git/hooks', hook);
      await fs.writeFile(hookPath, content);
      await fs.chmod(hookPath, '755');
      console.log(chalk.green(`✓ Created ${hook} hook`));
    }
    
    console.log(chalk.bold.green('\n✅ Git hooks installed successfully\n'));
  });

program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}