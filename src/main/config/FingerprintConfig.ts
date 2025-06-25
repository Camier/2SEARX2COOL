import { FingerprintConfig } from '../services/FingerprintService';

/**
 * ACRCloud Configuration for Audio Fingerprinting
 * 
 * To get ACRCloud credentials:
 * 1. Sign up at https://console.acrcloud.com/
 * 2. Create a new project with Audio & Video Recognition
 * 3. Copy Host, Access Key, and Access Secret
 * 
 * Free tier: 500 identifications per day
 * Paid tiers available for higher volumes
 */
export class FingerprintConfigManager {
  private static instance: FingerprintConfigManager;
  private config: FingerprintConfig | null = null;
  
  private constructor() {}
  
  static getInstance(): FingerprintConfigManager {
    if (!FingerprintConfigManager.instance) {
      FingerprintConfigManager.instance = new FingerprintConfigManager();
    }
    return FingerprintConfigManager.instance;
  }
  
  /**
   * Initialize ACRCloud configuration
   * This should be called during app startup with credentials
   */
  initialize(config: Partial<FingerprintConfig>): void {
    // Default ACRCloud configuration
    const defaultConfig: FingerprintConfig = {
      host: 'identify-eu-west-1.acrcloud.com',
      accessKey: '',
      accessSecret: '',
      timeout: 10000,
      sampleRate: 8000,
      sampleDuration: 12
    };
    
    this.config = { ...defaultConfig, ...config };
    
    // Validate required fields
    if (!this.config.accessKey || !this.config.accessSecret) {
      console.warn('ACRCloud credentials not configured. Fingerprinting will be disabled.');
      console.warn('Please set ACRCLOUD_ACCESS_KEY and ACRCLOUD_ACCESS_SECRET environment variables');
      console.warn('Or configure them in the app settings');
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): FingerprintConfig | null {
    return this.config;
  }
  
  /**
   * Check if ACRCloud is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config?.accessKey && this.config?.accessSecret);
  }
  
  /**
   * Initialize from environment variables
   */
  initializeFromEnv(): void {
    this.initialize({
      host: process.env.ACRCLOUD_HOST || 'identify-eu-west-1.acrcloud.com',
      accessKey: process.env.ACRCLOUD_ACCESS_KEY || '',
      accessSecret: process.env.ACRCLOUD_ACCESS_SECRET || '',
      timeout: parseInt(process.env.ACRCLOUD_TIMEOUT || '10000'),
      sampleRate: parseInt(process.env.ACRCLOUD_SAMPLE_RATE || '8000'),
      sampleDuration: parseInt(process.env.ACRCLOUD_SAMPLE_DURATION || '12')
    });
  }
  
  /**
   * Initialize from Electron Store
   */
  initializeFromStore(store: any): void {
    this.initialize({
      host: store.get('acrcloud.host', 'identify-eu-west-1.acrcloud.com'),
      accessKey: store.get('acrcloud.accessKey', ''),
      accessSecret: store.get('acrcloud.accessSecret', ''),
      timeout: store.get('acrcloud.timeout', 10000),
      sampleRate: store.get('acrcloud.sampleRate', 8000),
      sampleDuration: store.get('acrcloud.sampleDuration', 12)
    });
  }
  
  /**
   * Save configuration to Electron Store
   */
  saveToStore(store: any): void {
    if (this.config) {
      store.set('acrcloud.host', this.config.host);
      store.set('acrcloud.accessKey', this.config.accessKey);
      store.set('acrcloud.accessSecret', this.config.accessSecret);
      store.set('acrcloud.timeout', this.config.timeout);
      store.set('acrcloud.sampleRate', this.config.sampleRate);
      store.set('acrcloud.sampleDuration', this.config.sampleDuration);
    }
  }
  
  /**
   * Update specific configuration values
   */
  updateConfig(updates: Partial<FingerprintConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...updates };
    }
  }
  
  /**
   * Get configuration status for UI display
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      host: this.config?.host || 'Not set',
      hasCredentials: !!(this.config?.accessKey && this.config?.accessSecret),
      timeout: this.config?.timeout || 0,
      sampleRate: this.config?.sampleRate || 0,
      sampleDuration: this.config?.sampleDuration || 0
    };
  }
}

// Export singleton instance
export const fingerprintConfig = FingerprintConfigManager.getInstance();