/**
 * SecurityManager.ts - Comprehensive Security Management
 *
 * Handles all security aspects including:
 * - Content Security Policy (CSP)
 * - Encryption/Decryption
 * - Certificate validation
 * - Secure communication
 * - Input sanitization
 * - Authentication
 */

import { app, session, webContents, BrowserWindow, shell } from 'electron';
import { createHash, createCipher, createDecipher, randomBytes } from 'crypto';
import { URL } from 'url';
import { EventEmitter } from 'events';
import { configStore } from '../config/ConfigStore';

interface SecurityPolicy {
  csp: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
  permissions: {
    allowedOrigins: string[];
    blockedOrigins: string[];
    allowInsecureContent: boolean;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
  };
  authentication: {
    required: boolean;
    methods: string[];
  };
}

interface ThreatAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  threats: string[];
  recommendations: string[];
}

export class SecurityManager extends EventEmitter {
  private policy: SecurityPolicy;
  private encryptionKey: Buffer;
  private trustedDomains = new Set<string>();
  private blockedDomains = new Set<string>();
  private requestCache = new Map<string, boolean>();

  constructor() {
    super();

    this.policy = this.createDefaultPolicy();
    this.encryptionKey = this.generateEncryptionKey();
    
    // Initialize trusted domains asynchronously
    this.initializeTrustedDomains().catch(err => {
      console.error('Failed to initialize trusted domains:', err);
    });
    
    // Delay session-dependent setup until app is ready
    if (app.isReady()) {
      this.setupSecurityHeaders();
      this.setupContentFiltering();
      this.setupRequestInterception();
    } else {
      app.once('ready', () => {
        this.setupSecurityHeaders();
        this.setupContentFiltering();
        this.setupRequestInterception();
      });
    }

    console.log('🔒 [SECURITY-MANAGER] Initialized with enhanced security policies');
  }

  /**
   * Initialize Content Security Policy
   */
  initialize(): void {
    this.initializeCSP();
  }

  initializeCSP(): void {
    if (!this.policy.csp.enabled) {
      console.log('⚠️ [SECURITY-MANAGER] CSP is disabled');
      return;
    }

    const cspDirectives = Object.entries(this.policy.csp.directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');

    // Apply CSP to all web contents
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [cspDirectives]
        }
      });
    });

    console.log('🛡️ [SECURITY-MANAGER] CSP initialized:', cspDirectives);
  }

  /**
   * Setup security headers for all requests
   */
  private setupSecurityHeaders(): void {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = {
        ...details.responseHeaders,
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
        'Permissions-Policy': ['geolocation=(), microphone=(), camera=()']
      };

      // Add HSTS for HTTPS
      if (details.url.startsWith('https://')) {
        headers['Strict-Transport-Security'] = ['max-age=31536000; includeSubDomains'];
      }

      callback({ responseHeaders: headers });
    });

    console.log('🔐 [SECURITY-MANAGER] Security headers configured');
  }

  /**
   * Setup content filtering and validation
   */
  private setupContentFiltering(): void {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url);
      const domain = url.hostname;

      // Check blocked domains
      if (this.blockedDomains.has(domain)) {
        console.warn(`🚫 [SECURITY-MANAGER] Blocked request to: ${domain}`);
        callback({ cancel: true });
        return;
      }

      // Validate request
      const validation = this.validateRequest(details);
      if (!validation.allowed) {
        console.warn(`🚫 [SECURITY-MANAGER] Request blocked: ${validation.reason}`);
        callback({ cancel: true });
        return;
      }

      callback({ cancel: false });
    });
  }

  /**
   * Setup request interception for enhanced security
   */
  private setupRequestInterception(): void {
    session.defaultSession.protocol.interceptHttpProtocol('http', (request, callback) => {
      // Upgrade HTTP to HTTPS for known secure domains
      const url = new URL(request.url);
      if (this.trustedDomains.has(url.hostname)) {
        const httpsUrl = request.url.replace('http://', 'https://');
        console.log(`🔄 [SECURITY-MANAGER] Upgraded to HTTPS: ${httpsUrl}`);
        callback({ url: httpsUrl });
      } else {
        callback({ url: request.url });
      }
    });
  }

  /**
   * Validate incoming requests
   */
  private validateRequest(details: Electron.OnBeforeRequestListenerDetails): {
    allowed: boolean;
    reason?: string;
  } {
    const url = new URL(details.url);

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(details.url)) {
      return { allowed: false, reason: 'Suspicious URL pattern detected' };
    }

    // Validate file extensions for downloads
    if (details.resourceType === 'other') {
      const extension = url.pathname.split('.').pop()?.toLowerCase();
      if (extension && this.isBlockedFileType(extension)) {
        return { allowed: false, reason: `Blocked file type: ${extension}` };
      }
    }

    // Check request frequency (basic rate limiting)
    const cacheKey = `${url.hostname}-${Math.floor(Date.now() / 1000)}`;
    if (this.requestCache.has(cacheKey)) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }
    this.requestCache.set(cacheKey, true);

    return { allowed: true };
  }

  /**
   * Check for suspicious URL patterns
   */
  private containsSuspiciousPatterns(url: string): boolean {
    const suspiciousPatterns = [
      /javascript:/i,
      /data:(?!image)/i,
      /vbscript:/i,
      /<script/i,
      /on\w+=/i,
      /\.\./,  // Path traversal
      /%2e%2e/i,  // URL encoded path traversal
      /\.(exe|bat|cmd|scr|pif|com)$/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Check if file type is blocked
   */
  private isBlockedFileType(extension: string): boolean {
    const blockedTypes = [
      'exe', 'bat', 'cmd', 'scr', 'pif', 'com', 'msi', 'dll',
      'vbs', 'js', 'jar', 'app', 'deb', 'rpm', 'dmg'
    ];
    return blockedTypes.includes(extension);
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string): string {
    try {
      const cipher = createCipher(this.policy.encryption.algorithm, this.encryptionKey);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('❌ [SECURITY-MANAGER] Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    try {
      const decipher = createDecipher(this.policy.encryption.algorithm, this.encryptionKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('❌ [SECURITY-MANAGER] Decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate secure hash
   */
  generateHash(data: string, algorithm = 'sha256'): string {
    return createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/javascript:/gi, '') // Remove JS protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate URL safety
   */
  isUrlSafe(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Block dangerous protocols
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
      if (dangerousProtocols.some(protocol => url.toLowerCase().startsWith(protocol))) {
        return false;
      }

      // Check against blocked domains
      if (this.blockedDomains.has(urlObj.hostname)) {
        return false;
      }

      // Check for suspicious patterns
      if (this.containsSuspiciousPatterns(url)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add trusted domain
   */
  addTrustedDomain(domain: string): void {
    this.trustedDomains.add(domain);
    console.log(`✅ [SECURITY-MANAGER] Added trusted domain: ${domain}`);
  }

  /**
   * Remove trusted domain
   */
  removeTrustedDomain(domain: string): void {
    this.trustedDomains.delete(domain);
    console.log(`🗑️ [SECURITY-MANAGER] Removed trusted domain: ${domain}`);
  }

  /**
   * Add blocked domain
   */
  addBlockedDomain(domain: string): void {
    this.blockedDomains.add(domain);
    console.log(`🚫 [SECURITY-MANAGER] Added blocked domain: ${domain}`);
  }

  /**
   * Remove blocked domain
   */
  removeBlockedDomain(domain: string): void {
    this.blockedDomains.delete(domain);
    console.log(`✅ [SECURITY-MANAGER] Removed blocked domain: ${domain}`);
  }

  /**
   * Assess security threat level
   */
  assessThreat(url: string, context: any = {}): ThreatAssessment {
    const threats: string[] = [];
    let level: ThreatAssessment['level'] = 'low';

    // Check URL
    if (!this.isUrlSafe(url)) {
      threats.push('Unsafe URL detected');
      level = 'high';
    }

    // Check domain reputation
    try {
      const urlObj = new URL(url);
      if (this.blockedDomains.has(urlObj.hostname)) {
        threats.push('Blocked domain');
        level = 'critical';
      }
    } catch {
      threats.push('Invalid URL format');
      level = 'medium';
    }

    // Assess content type
    if (context.contentType && context.contentType.includes('executable')) {
      threats.push('Executable content detected');
      level = level === 'critical' ? 'critical' : 'high';
    }

    const recommendations = this.generateRecommendations(threats);

    return { level, threats, recommendations };
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(threats: string[]): string[] {
    const recommendations: string[] = [];

    if (threats.includes('Unsafe URL detected')) {
      recommendations.push('Block the request and notify user');
    }

    if (threats.includes('Blocked domain')) {
      recommendations.push('Maintain domain blocklist');
    }

    if (threats.includes('Executable content detected')) {
      recommendations.push('Scan with antivirus before allowing');
    }

    return recommendations;
  }

  /**
   * Create default security policy
   */
  private createDefaultPolicy(): SecurityPolicy {
    return {
      csp: {
        enabled: configStore.get('security', 'enableCSP'),
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'", 'wss:', 'https:'],
          'media-src': ["'self'"],
          'object-src': ["'none'"],
          'child-src': ["'none'"],
          'worker-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'base-uri': ["'self'"],
          'manifest-src': ["'self'"]
        }
      },
      permissions: {
        allowedOrigins: configStore.get('security', 'trustedDomains'),
        blockedOrigins: [],
        allowInsecureContent: configStore.get('security', 'allowInsecureContent')
      },
      encryption: {
        algorithm: 'aes256',
        keyLength: 32
      },
      authentication: {
        required: false,
        methods: ['local']
      }
    };
  }

  /**
   * Initialize trusted domains from configuration
   */
  private async initializeTrustedDomains(): Promise<void> {
    // Get allowed origins from preferences or use defaults
    const preferences = await configStore.get('preferences');
    const allowedOrigins = this.policy.permissions.allowedOrigins || [];
    allowedOrigins.forEach(domain => this.trustedDomains.add(domain));

    // Add default trusted domains for search engines
    const defaultTrusted = [
      'searx.org',
      'searxng.org', 
      'duckduckgo.com',
      'startpage.com',
      'github.com'
    ];
    
    defaultTrusted.forEach(domain => this.trustedDomains.add(domain));
    
    console.log(`🔒 [SECURITY-MANAGER] Initialized ${this.trustedDomains.size} trusted domains`);
  }

  /**
   * Generate encryption key
   */
  private generateEncryptionKey(): Buffer {
    return randomBytes(this.policy.encryption.keyLength);
  }

  /**
   * Get current security status
   */
  getSecurityStatus(): any {
    return {
      cspEnabled: this.policy.csp.enabled,
      trustedDomains: Array.from(this.trustedDomains),
      blockedDomains: Array.from(this.blockedDomains),
      encryptionEnabled: true,
      securityLevel: this.calculateSecurityLevel()
    };
  }

  /**
   * Calculate overall security level
   */
  private calculateSecurityLevel(): string {
    let score = 0;
    
    if (this.policy.csp.enabled) score += 25;
    if (this.trustedDomains.size > 0) score += 25;
    if (this.blockedDomains.size > 0) score += 25;
    if (!this.policy.permissions.allowInsecureContent) score += 25;

    if (score >= 90) return 'high';
    if (score >= 70) return 'medium';
    if (score >= 50) return 'low';
    return 'minimal';
  }

  /**
   * Update security policy
   */
  updatePolicy(updates: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    
    if (updates.csp) {
      this.initializeCSP();
    }
    
    this.emit('policy-updated', this.policy);
    console.log('🔄 [SECURITY-MANAGER] Security policy updated');
  }

  /**
   * Export security configuration
   */
  exportConfig(): any {
    return {
      policy: this.policy,
      trustedDomains: Array.from(this.trustedDomains),
      blockedDomains: Array.from(this.blockedDomains),
      status: this.getSecurityStatus()
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.requestCache.clear();
    this.removeAllListeners();
    console.log('🧹 [SECURITY-MANAGER] Cleanup completed');
  }
}

// Create singleton instance
// Export a lazy-initialized singleton
let _securityManager: SecurityManager | null = null;

export function getSecurityManager(): SecurityManager {
  if (!_securityManager) {
    _securityManager = new SecurityManager();
  }
  return _securityManager;
}

// For backward compatibility
export const securityManager = {
  get instance() {
    return getSecurityManager();
  }
};

// Export types
export type { SecurityPolicy, ThreatAssessment };