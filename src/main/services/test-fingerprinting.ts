import { MetadataExtractor } from './MetadataExtractor';
import { fingerprintConfig } from '../config/FingerprintConfig';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test script for ACRCloud fingerprinting integration
 * Week 3 Day 1: Verify the fingerprinting service works correctly
 */

async function testFingerprinting() {
  console.log('🎵 Testing ACRCloud Fingerprinting Integration\n');
  
  // Initialize configuration from environment
  fingerprintConfig.initializeFromEnv();
  
  // Check configuration status
  const status = fingerprintConfig.getStatus();
  console.log('Configuration Status:');
  console.log(`- Configured: ${status.configured}`);
  console.log(`- Host: ${status.host}`);
  console.log(`- Has Credentials: ${status.hasCredentials}`);
  console.log(`- Timeout: ${status.timeout}ms`);
  console.log();
  
  if (!status.configured) {
    console.log('❌ ACRCloud not configured. Please set environment variables:');
    console.log('   export ACRCLOUD_ACCESS_KEY="your_access_key"');
    console.log('   export ACRCLOUD_ACCESS_SECRET="your_access_secret"');
    console.log('   export ACRCLOUD_HOST="identify-eu-west-1.acrcloud.com"');
    return;
  }
  
  // Initialize metadata extractor
  const extractor = new MetadataExtractor();
  
  // Check fingerprinting status
  const fpStatus = extractor.getFingerprintStatus();
  console.log('Fingerprinting Status:');
  console.log(`- Available: ${fpStatus.available}`);
  if (fpStatus.available) {
    console.log(`- Remaining Requests: ${fpStatus.remainingRequests}`);
    console.log(`- Max Requests: ${fpStatus.maxRequests}`);
    console.log(`- Cache Size: ${fpStatus.cacheSize} entries`);
  } else {
    console.log(`- Reason: ${fpStatus.reason}`);
  }
  console.log();
  
  // Find test audio files
  const testDirectories = [
    '/home/mik/Music',
    '/home/mik/Downloads',
    '/mnt/c/Users/micka/Music',
    path.join(process.cwd(), 'test-audio')
  ];
  
  let testFiles: string[] = [];
  
  for (const dir of testDirectories) {
    try {
      if (fs.existsSync(dir)) {
        const files = await findAudioFiles(dir, 3); // Find max 3 files
        testFiles.push(...files);
        if (testFiles.length > 0) break;
      }
    } catch (error) {
      console.log(`Could not access ${dir}:`, error.message);
    }
  }
  
  if (testFiles.length === 0) {
    console.log('❌ No audio files found for testing');
    console.log('Please place some audio files in:');
    testDirectories.forEach(dir => console.log(`   ${dir}`));
    return;
  }
  
  console.log(`Found ${testFiles.length} test files:\n`);
  
  // Test each file
  for (const filePath of testFiles) {
    console.log(`🔍 Testing: ${path.basename(filePath)}`);
    
    try {
      // Test without fingerprinting first
      console.log('   📁 Local metadata only...');
      const localResult = await extractor.extractMetadata(filePath, {
        useFingerprinting: false
      });
      
      console.log(`   Title: ${localResult.title || 'Unknown'}`);
      console.log(`   Artist: ${localResult.artist || 'Unknown'}`);
      console.log(`   Album: ${localResult.album || 'Unknown'}`);
      console.log(`   Duration: ${localResult.duration ? `${localResult.duration}s` : 'Unknown'}`);
      
      // Test with fingerprinting if available
      if (fpStatus.available && fpStatus.remainingRequests > 0) {
        console.log('   🎵 With fingerprinting...');
        const fpResult = await extractor.extractMetadata(filePath, {
          useFingerprinting: true,
          minConfidence: 60
        });
        
        if (fpResult.fingerprint?.identified) {
          console.log(`   ✅ Identified with ${fpResult.fingerprint.confidence}% confidence`);
          console.log(`   Enhanced Title: ${fpResult.fingerprint.enhancedTitle || 'N/A'}`);
          console.log(`   Enhanced Artist: ${fpResult.fingerprint.enhancedArtist || 'N/A'}`);
          console.log(`   Label: ${fpResult.fingerprint.label || 'N/A'}`);
          console.log(`   ACRID: ${fpResult.fingerprint.acrid || 'N/A'}`);
        } else {
          console.log(`   ❌ Could not identify track`);
        }
      } else {
        console.log('   ⏭️  Skipping fingerprinting (not available or no requests remaining)');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log();
  }
  
  // Final status
  const finalStatus = extractor.getFingerprintStatus();
  if (finalStatus.available) {
    console.log(`Final status: ${finalStatus.remainingRequests} requests remaining`);
  }
}

/**
 * Find audio files in directory
 */
async function findAudioFiles(directory: string, maxFiles: number): Promise<string[]> {
  const audioExtensions = ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav'];
  const files: string[] = [];
  
  try {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (audioExtensions.includes(ext)) {
          files.push(path.join(directory, entry.name));
        }
      }
    }
  } catch (error) {
    console.log(`Error reading directory ${directory}:`, error.message);
  }
  
  return files;
}

// Run the test if this file is executed directly
if (require.main === module) {
  testFingerprinting().catch(console.error);
}

export { testFingerprinting };