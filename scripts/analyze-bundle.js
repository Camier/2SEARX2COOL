#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class BundleAnalyzer {
  constructor() {
    this.distPath = path.join(__dirname, '..', 'dist');
    this.results = {
      totalSize: 0,
      files: [],
      warnings: [],
      suggestions: []
    };
  }

  async analyze() {
    console.log(chalk.blue('🔍 Analyzing bundle size...\n'));

    // Check if dist directory exists
    if (!fs.existsSync(this.distPath)) {
      console.error(chalk.red('❌ Dist directory not found. Please build the project first.'));
      process.exit(1);
    }

    // Analyze files
    this.analyzeDirectory(this.distPath);
    
    // Check for common issues
    this.checkForIssues();
    
    // Generate report
    this.generateReport();
    
    // Save detailed report
    this.saveDetailedReport();
  }

  analyzeDirectory(dirPath, prefix = '') {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        this.analyzeDirectory(fullPath, path.join(prefix, item));
      } else if (stats.isFile()) {
        const fileInfo = {
          path: path.join(prefix, item),
          size: stats.size,
          extension: path.extname(item),
          gzipSize: this.getGzipSize(fullPath)
        };
        
        this.results.files.push(fileInfo);
        this.results.totalSize += fileInfo.size;
        
        // Check for large files
        if (fileInfo.size > 1024 * 1024) { // 1MB
          this.results.warnings.push({
            file: fileInfo.path,
            message: `Large file (${this.formatSize(fileInfo.size)})`,
            severity: fileInfo.size > 5 * 1024 * 1024 ? 'high' : 'medium'
          });
        }
      }
    }
  }

  getGzipSize(filePath) {
    try {
      const gzipPath = filePath + '.gz';
      if (fs.existsSync(gzipPath)) {
        return fs.statSync(gzipPath).size;
      }
      
      // Calculate gzip size if .gz file doesn't exist
      const output = execSync(`gzip -c "${filePath}" | wc -c`, { encoding: 'utf8' });
      return parseInt(output.trim());
    } catch (error) {
      return 0;
    }
  }

  checkForIssues() {
    // Group files by type
    const fileGroups = {};
    for (const file of this.results.files) {
      const ext = file.extension;
      if (!fileGroups[ext]) {
        fileGroups[ext] = { count: 0, totalSize: 0, files: [] };
      }
      fileGroups[ext].count++;
      fileGroups[ext].totalSize += file.size;
      fileGroups[ext].files.push(file);
    }

    // Check for duplicate packages
    const jsFiles = fileGroups['.js']?.files || [];
    const packagePattern = /vendor\.([\w-]+)/;
    const packages = new Map();
    
    for (const file of jsFiles) {
      const match = file.path.match(packagePattern);
      if (match) {
        const pkg = match[1];
        if (packages.has(pkg)) {
          packages.get(pkg).push(file);
        } else {
          packages.set(pkg, [file]);
        }
      }
    }
    
    // Find potential duplicates
    for (const [pkg, files] of packages) {
      if (files.length > 1) {
        this.results.warnings.push({
          file: pkg,
          message: `Potential duplicate package (${files.length} chunks)`,
          severity: 'medium'
        });
      }
    }

    // Check for source maps in production
    const sourceMaps = this.results.files.filter(f => f.path.endsWith('.map'));
    if (sourceMaps.length > 0) {
      const mapSize = sourceMaps.reduce((total, f) => total + f.size, 0);
      this.results.suggestions.push({
        category: 'Source Maps',
        message: `Consider removing source maps in production (${this.formatSize(mapSize)} total)`,
        impact: 'high'
      });
    }

    // Check for uncompressed assets
    const uncompressed = this.results.files.filter(f => 
      (f.extension === '.js' || f.extension === '.css') && 
      f.gzipSize === 0
    );
    if (uncompressed.length > 0) {
      this.results.suggestions.push({
        category: 'Compression',
        message: `${uncompressed.length} files are not pre-compressed`,
        impact: 'medium'
      });
    }

    // Large image files
    const images = this.results.files.filter(f => 
      ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(f.extension)
    );
    const largeImages = images.filter(f => f.size > 100 * 1024); // 100KB
    if (largeImages.length > 0) {
      this.results.suggestions.push({
        category: 'Images',
        message: `${largeImages.length} images could be optimized (>100KB each)`,
        impact: 'medium'
      });
    }
  }

  generateReport() {
    console.log(chalk.yellow('📊 Bundle Size Report\n'));
    console.log(chalk.white(`Total Size: ${chalk.bold(this.formatSize(this.results.totalSize))}`));
    console.log(chalk.white(`Total Files: ${chalk.bold(this.results.files.length)}\n`));

    // Top 10 largest files
    console.log(chalk.cyan('🏆 Largest Files:'));
    const largestFiles = [...this.results.files]
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    for (const file of largestFiles) {
      const gzipInfo = file.gzipSize > 0 
        ? chalk.gray(` (${this.formatSize(file.gzipSize)} gzipped)`)
        : '';
      console.log(`  ${file.path}: ${chalk.yellow(this.formatSize(file.size))}${gzipInfo}`);
    }

    // Warnings
    if (this.results.warnings.length > 0) {
      console.log(chalk.red('\n⚠️  Warnings:'));
      for (const warning of this.results.warnings) {
        const icon = warning.severity === 'high' ? '❗' : '⚡';
        console.log(`  ${icon} ${warning.file}: ${warning.message}`);
      }
    }

    // Suggestions
    if (this.results.suggestions.length > 0) {
      console.log(chalk.green('\n💡 Optimization Suggestions:'));
      for (const suggestion of this.results.suggestions) {
        const icon = suggestion.impact === 'high' ? '🔥' : '✨';
        console.log(`  ${icon} ${chalk.bold(suggestion.category)}: ${suggestion.message}`);
      }
    }

    // File type breakdown
    console.log(chalk.magenta('\n📁 File Type Breakdown:'));
    const typeBreakdown = {};
    for (const file of this.results.files) {
      const ext = file.extension || 'no-ext';
      if (!typeBreakdown[ext]) {
        typeBreakdown[ext] = { count: 0, size: 0 };
      }
      typeBreakdown[ext].count++;
      typeBreakdown[ext].size += file.size;
    }
    
    const sortedTypes = Object.entries(typeBreakdown)
      .sort((a, b) => b[1].size - a[1].size);
    
    for (const [ext, data] of sortedTypes) {
      const percentage = ((data.size / this.results.totalSize) * 100).toFixed(1);
      console.log(`  ${ext}: ${data.count} files, ${this.formatSize(data.size)} (${percentage}%)`);
    }
  }

  saveDetailedReport() {
    const reportPath = path.join(__dirname, '..', 'bundle-analysis.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSize: this.results.totalSize,
        totalFiles: this.results.files.length,
        warnings: this.results.warnings.length,
        suggestions: this.results.suggestions.length
      },
      ...this.results
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.blue(`\n📄 Detailed report saved to: ${chalk.bold('bundle-analysis.json')}`));
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// Check for additional optimization opportunities
function checkOptimizationOpportunities() {
  console.log(chalk.cyan('\n🔧 Checking optimization opportunities...\n'));

  const packageJson = require(path.join(__dirname, '..', 'package.json'));
  const suggestions = [];

  // Check for large dependencies
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const largePackages = [
    { name: 'moment', alternative: 'dayjs or date-fns', savingEstimate: '~60KB' },
    { name: 'lodash', alternative: 'lodash-es or individual imports', savingEstimate: '~40KB' },
    { name: 'jquery', alternative: 'Native DOM APIs', savingEstimate: '~85KB' },
    { name: 'axios', alternative: 'Native fetch or ky', savingEstimate: '~15KB' },
  ];

  for (const pkg of largePackages) {
    if (dependencies[pkg.name]) {
      suggestions.push(`Consider replacing ${chalk.bold(pkg.name)} with ${pkg.alternative} (save ${pkg.savingEstimate})`);
    }
  }

  // Check webpack config
  const webpackConfigPath = path.join(__dirname, '..', 'webpack.config.js');
  if (fs.existsSync(webpackConfigPath)) {
    const config = fs.readFileSync(webpackConfigPath, 'utf8');
    
    if (!config.includes('optimization')) {
      suggestions.push('Add optimization configuration to webpack.config.js');
    }
    
    if (!config.includes('splitChunks')) {
      suggestions.push('Enable code splitting with splitChunks');
    }
    
    if (!config.includes('TerserPlugin')) {
      suggestions.push('Use TerserPlugin for better minification');
    }
  }

  if (suggestions.length > 0) {
    console.log(chalk.yellow('Additional optimization opportunities:'));
    suggestions.forEach(s => console.log(`  • ${s}`));
  } else {
    console.log(chalk.green('✅ No additional optimization opportunities found!'));
  }
}

// Run analysis
const analyzer = new BundleAnalyzer();
analyzer.analyze().then(() => {
  checkOptimizationOpportunities();
}).catch(error => {
  console.error(chalk.red('❌ Analysis failed:'), error);
  process.exit(1);
});