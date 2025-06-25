import { ACRCloudApi } from 'acrcloud';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import NodeCache from 'node-cache';

const readFile = promisify(fs.readFile);

export interface FingerprintResult {
  success: boolean;
  data?: {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    label?: string;
    releaseDate?: string;
    genres?: string[];
    acrid?: string;
    confidence: number;
  };
  error?: string;
  cached?: boolean;
}

export interface FingerprintConfig {
  host: string;
  accessKey: string;
  accessSecret: string;
  timeout?: number;
  sampleRate?: number;
  sampleDuration?: number;
}

/**
 * Week 3 Day 1: ACRCloud Audio Fingerprinting Service
 * 
 * Features:
 * - Automatic song identification for unknown tracks
 * - Rate limiting to respect ACRCloud API limits
 * - Intelligent caching (fingerprints don't change)
 * - Integration with existing MetadataExtractor
 * - Confidence scoring for result validation
 */
export class FingerprintService {
  private acrcloud: ACRCloudApi;
  private cache: NodeCache;
  private rateLimiter: Map<string, number> = new Map();
  private config: FingerprintConfig;
  
  // Rate limiting: 500 requests per day for free tier
  private readonly MAX_REQUESTS_PER_DAY = 450; // Leave buffer
  private readonly RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  
  constructor(config: FingerprintConfig) {
    this.config = {
      timeout: 10000,
      sampleRate: 8000,
      sampleDuration: 12,
      ...config
    };
    
    this.acrcloud = new ACRCloudApi({
      host: this.config.host,
      access_key: this.config.accessKey,
      access_secret: this.config.accessSecret,
      timeout: this.config.timeout
    });
    
    // Cache fingerprint results indefinitely (they don't change)
    this.cache = new NodeCache({
      stdTTL: 0, // Never expire
      checkperiod: 0, // No automatic cleanup
      maxKeys: 10000 // Limit to prevent memory issues
    });
    
    this.loadCacheFromDisk();
  }
  
  /**
   * Identify audio file using ACRCloud fingerprinting
   */
  async identifyFile(filePath: string): Promise<FingerprintResult> {
    try {
      // Generate cache key from file path and size
      const stats = await fs.promises.stat(filePath);
      const cacheKey = `${filePath}_${stats.size}_${stats.mtime.getTime()}`;
      
      // Check cache first
      const cachedResult = this.cache.get<FingerprintResult>(cacheKey);
      if (cachedResult) {
        return { ...cachedResult, cached: true };
      }
      
      // Check rate limit
      if (!this.canMakeRequest()) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        };
      }
      
      // Read and prepare audio sample
      const audioBuffer = await this.prepareAudioSample(filePath);
      if (!audioBuffer) {
        return {
          success: false,
          error: 'Failed to read audio file'
        };
      }
      
      // Perform fingerprinting
      const result = await this.performFingerprinting(audioBuffer);
      
      // Cache successful results
      if (result.success) {
        this.cache.set(cacheKey, result);
        this.saveCacheToDisk();
      }
      
      this.recordRequest();
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: `Fingerprinting failed: ${error.message}`
      };
    }
  }
  
  /**
   * Prepare audio sample for fingerprinting
   */
  private async prepareAudioSample(filePath: string): Promise<Buffer | null> {
    try {
      // For now, read the entire file
      // In production, we'd want to extract a specific sample
      const audioBuffer = await readFile(filePath);
      
      // ACRCloud expects first 12 seconds typically
      // For simplicity, we'll send the file as-is for now
      return audioBuffer;
      
    } catch (error) {
      console.error('Failed to prepare audio sample:', error);
      return null;
    }
  }
  
  /**
   * Perform actual fingerprinting with ACRCloud
   */
  private async performFingerprinting(audioBuffer: Buffer): Promise<FingerprintResult> {
    try {
      const response = await this.acrcloud.identify(audioBuffer);
      
      if (response.status.code === 0 && response.metadata?.music?.[0]) {
        const music = response.metadata.music[0];
        
        return {
          success: true,
          data: {
            title: music.title || 'Unknown',
            artist: music.artists?.[0]?.name || 'Unknown Artist',
            album: music.album?.name,
            duration: music.duration_ms ? Math.round(music.duration_ms / 1000) : undefined,
            label: music.label,
            releaseDate: music.release_date,
            genres: music.genres?.map(g => g.name) || [],
            acrid: music.acrid,
            confidence: response.status.score || 0
          }
        };
      } else {
        return {
          success: false,
          error: response.status.msg || 'No match found'
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: `ACRCloud API error: ${error.message}`
      };
    }
  }
  
  /**
   * Check if we can make another API request (rate limiting)
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    const dayStart = now - (now % this.RATE_LIMIT_WINDOW);
    const requestsToday = this.rateLimiter.get(dayStart.toString()) || 0;
    
    return requestsToday < this.MAX_REQUESTS_PER_DAY;
  }
  
  /**
   * Record an API request for rate limiting
   */
  private recordRequest(): void {
    const now = Date.now();
    const dayStart = now - (now % this.RATE_LIMIT_WINDOW);
    const key = dayStart.toString();
    const current = this.rateLimiter.get(key) || 0;
    
    this.rateLimiter.set(key, current + 1);
    
    // Clean up old entries
    for (const [k] of this.rateLimiter) {
      if (parseInt(k) < dayStart - this.RATE_LIMIT_WINDOW) {
        this.rateLimiter.delete(k);
      }
    }
  }
  
  /**
   * Get remaining API requests for today
   */
  getRemainingRequests(): number {
    const now = Date.now();
    const dayStart = now - (now % this.RATE_LIMIT_WINDOW);
    const requestsToday = this.rateLimiter.get(dayStart.toString()) || 0;
    
    return Math.max(0, this.MAX_REQUESTS_PER_DAY - requestsToday);
  }
  
  /**
   * Load cache from disk for persistence
   */
  private loadCacheFromDisk(): void {
    try {
      const cacheFile = path.join(__dirname, '../../../cache/fingerprint-cache.json');
      if (fs.existsSync(cacheFile)) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        for (const [key, value] of Object.entries(data)) {
          this.cache.set(key, value);
        }
      }
    } catch (error) {
      console.warn('Failed to load fingerprint cache:', error.message);
    }
  }
  
  /**
   * Save cache to disk for persistence
   */
  private saveCacheToDisk(): void {
    try {
      const cacheFile = path.join(__dirname, '../../../cache/fingerprint-cache.json');
      const cacheDir = path.dirname(cacheFile);
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      const data = {};
      for (const key of this.cache.keys()) {
        data[key] = this.cache.get(key);
      }
      
      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save fingerprint cache:', error.message);
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      keys: this.cache.keys().length,
      remainingRequests: this.getRemainingRequests(),
      maxRequests: this.MAX_REQUESTS_PER_DAY
    };
  }
}