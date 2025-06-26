#!/usr/bin/env node

/**
 * Entry point for the advanced refactoring system
 */

import { runRefactoring } from './orchestrator';
import * as path from 'path';

const projectPath = path.resolve(__dirname, '../..');

console.log('🚀 Starting Advanced Refactoring System...');
console.log(`📁 Project Path: ${projectPath}\n`);

runRefactoring(projectPath)
  .then(() => {
    console.log('\n✅ Refactoring completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Refactoring failed:', error);
    process.exit(1);
  });