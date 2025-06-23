#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const htmlMinifier = require('html-minifier-terser');

class AssetOptimizer {
  constructor() {
    this.distPath = path.join(__dirname, '..', 'dist');
    this.stats = {
      images: { count: 0, savedBytes: 0 },
      js: { count: 0, savedBytes: 0 },
      css: { count: 0, savedBytes: 0 },
      html: { count: 0, savedBytes: 0 }
    };
  }

  async optimize() {
    console.log('🚀 Starting asset optimization...\n');
    
    await this.optimizeImages();
    await this.optimizeJavaScript();
    await this.optimizeCSS();
    await this.optimizeHTML();
    
    this.printReport();
  }

  async optimizeImages() {
    console.log('🖼️  Optimizing images...');
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    
    await this.walkDirectory(this.distPath, async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!imageExtensions.includes(ext)) return;
      
      try {
        const originalSize = (await fs.stat(filePath)).size;
        const tempPath = filePath + '.tmp';
        
        // Optimize based on format
        if (ext === '.png') {
          await sharp(filePath)
            .png({ quality: 85, compressionLevel: 9 })
            .toFile(tempPath);
        } else if (ext === '.jpg' || ext === '.jpeg') {
          await sharp(filePath)
            .jpeg({ quality: 85, progressive: true })
            .toFile(tempPath);
        } else if (ext === '.webp') {
          await sharp(filePath)
            .webp({ quality: 85 })
            .toFile(tempPath);
        }
        
        const newSize = (await fs.stat(tempPath)).size;
        
        if (newSize < originalSize) {
          await fs.rename(tempPath, filePath);
          this.stats.images.count++;
          this.stats.images.savedBytes += originalSize - newSize;
        } else {
          await fs.unlink(tempPath);
        }
      } catch (error) {
        console.error(`Failed to optimize ${filePath}:`, error.message);
      }
    });
  }

  async optimizeJavaScript() {
    console.log('📦 Optimizing JavaScript...');
    
    await this.walkDirectory(this.distPath, async (filePath) => {
      if (!filePath.endsWith('.js') || filePath.endsWith('.min.js')) return;
      
      try {
        const code = await fs.readFile(filePath, 'utf8');
        const originalSize = Buffer.byteLength(code);
        
        const result = await minify(code, {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug', 'console.info'],
            passes: 2,
            unsafe: true,
            unsafe_comps: true,
            unsafe_math: true,
            unsafe_methods: true,
            unsafe_proto: true,
            unsafe_regexp: true
          },
          mangle: {
            properties: {
              regex: /^_/
            }
          },
          format: {
            comments: false,
            ascii_only: true
          },
          module: true,
          toplevel: true
        });
        
        if (result.code) {
          const newSize = Buffer.byteLength(result.code);
          if (newSize < originalSize) {
            await fs.writeFile(filePath, result.code);
            this.stats.js.count++;
            this.stats.js.savedBytes += originalSize - newSize;
          }
        }
      } catch (error) {
        console.error(`Failed to optimize ${filePath}:`, error.message);
      }
    });
  }

  async optimizeCSS() {
    console.log('🎨 Optimizing CSS...');
    const cleanCSS = new CleanCSS({
      level: {
        1: {
          all: true,
          normalizeUrls: false
        },
        2: {
          restructureRules: true
        }
      }
    });
    
    await this.walkDirectory(this.distPath, async (filePath) => {
      if (!filePath.endsWith('.css') || filePath.endsWith('.min.css')) return;
      
      try {
        const css = await fs.readFile(filePath, 'utf8');
        const originalSize = Buffer.byteLength(css);
        
        const result = cleanCSS.minify(css);
        
        if (!result.errors.length) {
          const newSize = Buffer.byteLength(result.styles);
          if (newSize < originalSize) {
            await fs.writeFile(filePath, result.styles);
            this.stats.css.count++;
            this.stats.css.savedBytes += originalSize - newSize;
          }
        }
      } catch (error) {
        console.error(`Failed to optimize ${filePath}:`, error.message);
      }
    });
  }

  async optimizeHTML() {
    console.log('📄 Optimizing HTML...');
    
    await this.walkDirectory(this.distPath, async (filePath) => {
      if (!filePath.endsWith('.html')) return;
      
      try {
        const html = await fs.readFile(filePath, 'utf8');
        const originalSize = Buffer.byteLength(html);
        
        const result = await htmlMinifier.minify(html, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          removeAttributeQuotes: true,
          minifyCSS: true,
          minifyJS: true,
          minifyURLs: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true
        });
        
        const newSize = Buffer.byteLength(result);
        if (newSize < originalSize) {
          await fs.writeFile(filePath, result);
          this.stats.html.count++;
          this.stats.html.savedBytes += originalSize - newSize;
        }
      } catch (error) {
        console.error(`Failed to optimize ${filePath}:`, error.message);
      }
    });
  }

  async walkDirectory(dir, callback) {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        await this.walkDirectory(filePath, callback);
      } else {
        await callback(filePath);
      }
    }
  }

  printReport() {
    console.log('\n📊 Optimization Report:\n');
    
    const totalSaved = Object.values(this.stats).reduce(
      (total, stat) => total + stat.savedBytes, 0
    );
    
    console.log(`Images: ${this.stats.images.count} files, saved ${this.formatBytes(this.stats.images.savedBytes)}`);
    console.log(`JavaScript: ${this.stats.js.count} files, saved ${this.formatBytes(this.stats.js.savedBytes)}`);
    console.log(`CSS: ${this.stats.css.count} files, saved ${this.formatBytes(this.stats.css.savedBytes)}`);
    console.log(`HTML: ${this.stats.html.count} files, saved ${this.formatBytes(this.stats.html.savedBytes)}`);
    console.log(`\nTotal saved: ${this.formatBytes(totalSaved)}`);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Additional optimization: Remove unused dependencies
async function removeUnusedDependencies() {
  console.log('\n🧹 Checking for unused dependencies...');
  
  try {
    const { execSync } = require('child_process');
    const output = execSync('npx depcheck --json', { encoding: 'utf8' });
    const result = JSON.parse(output);
    
    if (result.dependencies.length > 0) {
      console.log('Unused dependencies found:');
      result.dependencies.forEach(dep => console.log(`  - ${dep}`));
      console.log('\nRun: npm uninstall', result.dependencies.join(' '));
    }
    
    if (result.devDependencies.length > 0) {
      console.log('\nUnused devDependencies found:');
      result.devDependencies.forEach(dep => console.log(`  - ${dep}`));
      console.log('\nRun: npm uninstall -D', result.devDependencies.join(' '));
    }
    
    if (result.missing) {
      const missing = Object.keys(result.missing);
      if (missing.length > 0) {
        console.log('\nMissing dependencies:');
        missing.forEach(dep => console.log(`  - ${dep}`));
      }
    }
  } catch (error) {
    console.log('Install depcheck to check for unused dependencies: npm install -g depcheck');
  }
}

// Run optimizations
async function main() {
  const optimizer = new AssetOptimizer();
  await optimizer.optimize();
  await removeUnusedDependencies();
  
  console.log('\n✅ Asset optimization complete!');
}

main().catch(error => {
  console.error('❌ Optimization failed:', error);
  process.exit(1);
});