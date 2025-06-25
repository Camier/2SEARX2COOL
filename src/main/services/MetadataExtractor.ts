import * as musicMetadata from 'music-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { FingerprintService, FingerprintResult } from './FingerprintService';
import { fingerprintConfig } from '../config/FingerprintConfig';

export interface AudioMetadata {
  // Basic metadata
  title?: string;
  artist?: string;
  album?: string;
  albumartist?: string;
  year?: number;
  track?: {
    no?: number;
    of?: number;
  };
  disk?: {
    no?: number;
    of?: number;
  };
  genre?: string[];
  
  // Technical metadata
  duration?: number; // in seconds
  bitrate?: number;
  sampleRate?: number;
  format?: string;
  codec?: string;
  
  // File metadata
  filePath: string;
  fileName: string;
  fileSize: number;
  lastModified: Date;
  
  // Enhanced metadata from ACRCloud
  fingerprint?: {
    identified: boolean;
    confidence?: number;
    acrid?: string;
    label?: string;
    releaseDate?: string;
    enhancedTitle?: string;
    enhancedArtist?: string;
    enhancedAlbum?: string;
    source: 'acrcloud' | 'local' | 'hybrid';
  };
  
  // Extraction metadata
  extractedAt: Date;
  extractionSource: 'local' | 'fingerprint' | 'hybrid';
}

export interface ExtractionOptions {
  useFingerprinting?: boolean;
  fingerprintFallback?: boolean; // Use fingerprinting if local metadata is poor
  minConfidence?: number; // Minimum confidence for ACRCloud results
  skipDuration?: boolean; // Skip if duration calculation is slow
}

/**
 * Enhanced Metadata Extractor with ACRCloud Integration
 * Week 3 Day 1: Combines local metadata extraction with audio fingerprinting
 */
export class MetadataExtractor {
  private fingerprintService?: FingerprintService;
  private supportedFormats = [
    '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav', 
    '.opus', '.wma', '.mp4', '.aiff', '.ape', '.wv'
  ];
  
  constructor() {
    this.initializeFingerprintService();
  }
  
  /**
   * Initialize fingerprinting service if configured
   */
  private initializeFingerprintService(): void {
    try {
      const config = fingerprintConfig.getConfig();
      if (config && fingerprintConfig.isConfigured()) {
        this.fingerprintService = new FingerprintService(config);
        console.log('ACRCloud fingerprinting service initialized');
      } else {
        console.log('ACRCloud not configured - fingerprinting disabled');
      }
    } catch (error) {
      console.warn('Failed to initialize fingerprinting service:', error.message);
    }
  }
  
  /**
   * Extract metadata from audio file with optional fingerprinting
   */
  async extractMetadata(filePath: string, options: ExtractionOptions = {}): Promise<AudioMetadata> {
    const defaults: ExtractionOptions = {
      useFingerprinting: false,
      fingerprintFallback: true,
      minConfidence: 70,
      skipDuration: false
    };
    
    const opts = { ...defaults, ...options };
    
    try {
      // Get file stats
      const stats = await fs.promises.stat(filePath);
      
      // Extract local metadata first
      const localMetadata = await this.extractLocalMetadata(filePath, stats);
      
      // Determine if we should use fingerprinting
      const shouldFingerprint = this.shouldUseFingerprinting(localMetadata, opts);
      
      if (shouldFingerprint && this.fingerprintService) {
        console.log(`Attempting to fingerprint: ${path.basename(filePath)}`);
        const fingerprintResult = await this.fingerprintService.identifyFile(filePath);
        
        if (fingerprintResult.success && fingerprintResult.data) {
          return this.mergeMetadata(localMetadata, fingerprintResult, opts);
        }
      }
      
      return localMetadata;
      
    } catch (error) {
      console.error(`Failed to extract metadata for ${filePath}:`, error);
      
      // Return minimal metadata on error
      const stats = await fs.promises.stat(filePath).catch(() => null);
      return {
        filePath,
        fileName: path.basename(filePath),
        fileSize: stats?.size || 0,
        lastModified: stats?.mtime || new Date(),
        extractedAt: new Date(),
        extractionSource: 'local',
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist'
      };
    }
  }
  
  /**
   * Extract metadata using music-metadata library
   */
  private async extractLocalMetadata(filePath: string, stats: fs.Stats): Promise<AudioMetadata> {
    try {
      const metadata = await musicMetadata.parseFile(filePath);
      const common = metadata.common;
      const format = metadata.format;
      
      return {
        // Basic metadata
        title: common.title,
        artist: common.artist,
        album: common.album,
        albumartist: common.albumartist,
        year: common.year,
        track: common.track,
        disk: common.disk,
        genre: common.genre,
        
        // Technical metadata
        duration: format.duration ? Math.round(format.duration) : undefined,
        bitrate: format.bitrate,
        sampleRate: format.sampleRate,
        format: format.container,
        codec: format.codec,
        
        // File metadata
        filePath,
        fileName: path.basename(filePath),
        fileSize: stats.size,
        lastModified: stats.mtime,
        
        // Extraction metadata
        extractedAt: new Date(),
        extractionSource: 'local'
      };
      
    } catch (error) {
      console.error(`Failed to parse metadata for ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Determine if fingerprinting should be used
   */
  private shouldUseFingerprinting(metadata: AudioMetadata, options: ExtractionOptions): boolean {
    // Always use if explicitly requested
    if (options.useFingerprinting) {
      return true;
    }
    
    // Use fingerprinting as fallback for poor metadata
    if (options.fingerprintFallback) {
      const hasTitle = metadata.title && metadata.title.trim().length > 0;
      const hasArtist = metadata.artist && metadata.artist.trim().length > 0;
      
      // Use fingerprinting if essential metadata is missing
      if (!hasTitle || !hasArtist) {
        return true;
      }
      
      // Use fingerprinting if metadata looks like filename
      const titleIsFilename = metadata.title === path.basename(metadata.filePath, path.extname(metadata.filePath));
      if (titleIsFilename) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Merge local metadata with fingerprinting results
   */
  private mergeMetadata(
    localMetadata: AudioMetadata, 
    fingerprintResult: FingerprintResult,
    options: ExtractionOptions
  ): AudioMetadata {
    const fpData = fingerprintResult.data!;
    const confidence = fpData.confidence || 0;
    
    // Only use fingerprint data if confidence is high enough
    if (confidence < (options.minConfidence || 70)) {
      console.log(`Low confidence fingerprint (${confidence}%), keeping local metadata`);
      return {
        ...localMetadata,
        fingerprint: {
          identified: true,
          confidence,
          acrid: fpData.acrid,
          source: 'acrcloud'
        }
      };
    }
    
    // Create hybrid metadata
    const hybridMetadata: AudioMetadata = {
      ...localMetadata,
      
      // Use fingerprint data if local data is poor or missing
      title: this.chooseBestValue(localMetadata.title, fpData.title, localMetadata.fileName),
      artist: this.chooseBestValue(localMetadata.artist, fpData.artist, 'Unknown Artist'),
      album: this.chooseBestValue(localMetadata.album, fpData.album),
      
      // Enhanced duration from fingerprint if more accurate
      duration: fpData.duration || localMetadata.duration,
      
      // Add fingerprint information
      fingerprint: {
        identified: true,
        confidence,
        acrid: fpData.acrid,
        label: fpData.label,
        releaseDate: fpData.releaseDate,
        enhancedTitle: fpData.title,
        enhancedArtist: fpData.artist,
        enhancedAlbum: fpData.album,
        source: 'hybrid'
      },
      
      extractionSource: 'hybrid'
    };
    
    console.log(`Enhanced metadata for "${hybridMetadata.title}" by ${hybridMetadata.artist} (${confidence}% confidence)`);
    return hybridMetadata;
  }
  
  /**
   * Choose the best value between local and fingerprint data
   */
  private chooseBestValue(localValue?: string, fingerprintValue?: string, fallback?: string): string | undefined {
    // If fingerprint has a value and local doesn't, use fingerprint
    if (fingerprintValue && !localValue) {
      return fingerprintValue;
    }
    
    // If local has a value and fingerprint doesn't, use local
    if (localValue && !fingerprintValue) {
      return localValue;
    }
    
    // If both have values, prefer the more descriptive one
    if (localValue && fingerprintValue) {
      // Prefer fingerprint if local looks like a filename
      if (localValue.includes('_') || localValue.includes('-') || localValue.includes('.')) {
        return fingerprintValue;
      }
      
      // Otherwise prefer local metadata
      return localValue;
    }
    
    // Neither has a value, use fallback
    return fallback;
  }
  
  /**
   * Check if file format is supported
   */
  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }
  
  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }
  
  /**
   * Get fingerprinting service status
   */
  getFingerprintStatus() {
    if (!this.fingerprintService) {
      return {
        available: false,
        reason: 'Not configured'
      };
    }
    
    const stats = this.fingerprintService.getCacheStats();
    return {
      available: true,
      remainingRequests: stats.remainingRequests,
      maxRequests: stats.maxRequests,
      cacheSize: stats.keys
    };
  }
  
  /**
   * Force reinitialize fingerprinting service
   */
  reinitializeFingerprinting(): void {
    this.initializeFingerprintService();
  }
}