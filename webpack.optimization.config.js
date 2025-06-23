const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { DuplicatesPlugin } = require('inspectpack/plugin');

module.exports = {
  optimization: {
    // Split runtime code into a separate chunk
    runtimeChunk: 'single',
    
    // Module IDs based on hashes for long-term caching
    moduleIds: 'deterministic',
    
    // Advanced code splitting
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      maxSize: 244000,
      cacheGroups: {
        // Vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            // Extract package name
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `vendor.${packageName.replace('@', '')}`;
          },
          priority: 20
        },
        
        // Common modules used across the app
        common: {
          minChunks: 2,
          priority: 10,
          reuseExistingChunk: true,
          enforce: true
        },
        
        // Electron specific modules
        electron: {
          test: /[\\/]electron[\\/]|@electron-toolkit/,
          name: 'electron-vendor',
          priority: 30
        },
        
        // React and related
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react-vendor',
          priority: 30
        },
        
        // UI libraries
        ui: {
          test: /[\\/]node_modules[\\/](@mui|@emotion|styled-components)[\\/]/,
          name: 'ui-vendor',
          priority: 25
        },
        
        // Utility libraries
        utils: {
          test: /[\\/]node_modules[\\/](lodash|moment|date-fns|axios)[\\/]/,
          name: 'utils-vendor',
          priority: 25
        },
        
        // Async chunks
        async: {
          chunks: 'async',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true
        }
      }
    },
    
    // Minimize in production
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: process.env.NODE_ENV === 'production',
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
            passes: 2
          },
          mangle: {
            safari10: true,
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true,
          },
        },
      }),
    ],
    
    // Tree shaking
    usedExports: true,
    sideEffects: false,
  },
  
  plugins: [
    // Gzip compression
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
    
    // Brotli compression
    new CompressionPlugin({
      filename: '[path][base].br',
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg)$/,
      threshold: 10240,
      minRatio: 0.8,
      compressionOptions: {
        level: 11,
      },
    }),
    
    // Bundle analyzer (only in analyze mode)
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
      generateStatsFile: true,
      statsFilename: 'bundle-stats.json',
    }),
    
    // Detect duplicate modules
    new DuplicatesPlugin({
      emitErrors: false,
      emitHandler: undefined,
      ignoredPackages: [],
      verbose: true,
    }),
  ].filter(Boolean),
  
  // Performance hints
  performance: {
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
    hints: 'warning',
    assetFilter: function(assetFilename) {
      return assetFilename.endsWith('.js');
    },
  },
  
  // Module resolution optimizations
  resolve: {
    // Cache module resolutions
    cache: true,
    
    // Prefer module field over main
    mainFields: ['module', 'main'],
    
    // Only necessary extensions
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    
    // Alias heavy modules to lighter alternatives
    alias: {
      'moment': 'dayjs',
      'lodash': 'lodash-es',
      // Ensure we use the production build of React
      'react': process.env.NODE_ENV === 'production' 
        ? 'react/cjs/react.production.min.js' 
        : 'react',
      'react-dom': process.env.NODE_ENV === 'production'
        ? 'react-dom/cjs/react-dom.production.min.js'
        : 'react-dom',
    },
  },
  
  // Externals for Electron main process
  externals: {
    // Don't bundle native modules
    'better-sqlite3': 'commonjs better-sqlite3',
    'node-hid': 'commonjs node-hid',
    'usb': 'commonjs usb',
    'serialport': 'commonjs serialport',
    
    // Electron internals
    electron: 'commonjs electron',
    
    // Optional dependencies that might not be used
    'fsevents': 'commonjs fsevents',
    'cpu-features': 'commonjs cpu-features',
  },
};