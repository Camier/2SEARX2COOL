# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

We take the security of 2SEARX2COOL seriously. If you have discovered a security vulnerability, please follow these steps:

### 1. Do NOT Create a Public Issue

Security vulnerabilities should **never** be reported through public GitHub issues.

### 2. Email Security Team

Send details to: security@2searx2cool.com

Include:
- Type of vulnerability
- Full paths of affected source files
- Location of affected code (tag/branch/commit or direct URL)
- Steps to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Resolution Timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 90 days

## Security Measures

### Application Security

1. **Process Isolation**
   - Main and renderer processes are strictly isolated
   - Context isolation enabled by default
   - Node integration disabled in renderer

2. **Input Validation**
   - All user inputs are sanitized
   - URL validation for external links
   - Path traversal prevention

3. **Secure Communication**
   - IPC messages are validated and typed
   - HTTPS enforced for external requests
   - Certificate pinning for critical services

4. **Data Protection**
   - Local data encrypted at rest
   - Secure credential storage
   - No sensitive data in logs

### Plugin Security

1. **Permission System**
   - Plugins must declare required permissions
   - Granular permission control
   - Runtime permission checks

2. **Sandboxing**
   - Plugins run in isolated contexts
   - Limited API access
   - Resource usage limits

3. **Code Verification**
   - Plugin signatures verified
   - Automatic security scanning
   - Manual review for registry

### Network Security

1. **Request Validation**
   - User-agent spoofing prevention
   - Rate limiting implemented
   - Request timeout enforcement

2. **Privacy Protection**
   - Do Not Track header support
   - No telemetry without consent
   - IP address anonymization

## Security Best Practices

### For Users

1. **Keep Updated**
   - Enable automatic updates
   - Install patches promptly
   - Check for security advisories

2. **Plugin Safety**
   - Only install trusted plugins
   - Review plugin permissions
   - Report suspicious behavior

3. **Configuration**
   - Use strong passwords
   - Enable security features
   - Regular data backups

### For Developers

1. **Code Review**
   - All PRs require security review
   - Use automated scanning tools
   - Follow secure coding guidelines

2. **Dependencies**
   - Regular dependency updates
   - Vulnerability scanning
   - License compliance

3. **Testing**
   - Security test suite
   - Penetration testing
   - Fuzzing critical inputs

## Known Security Features

### Content Security Policy

```javascript
{
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "https:"],
  "connect-src": ["'self'", "https://api.2searx2cool.com"],
  "font-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"]
}
```

### Secure Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

## Security Advisories

Security advisories will be published on:
- GitHub Security Advisories
- Our security mailing list
- Discord announcements

## Bug Bounty Program

We maintain a bug bounty program for security researchers:

- **Scope**: Core application, official plugins
- **Rewards**: $100 - $5,000 based on severity
- **Rules**: Responsible disclosure required
- **Contact**: bounty@2searx2cool.com

### Qualifying Vulnerabilities

- Remote Code Execution (RCE)
- Local Privilege Escalation
- Cross-Site Scripting (XSS)
- SQL/NoSQL Injection
- Authentication Bypass
- Information Disclosure
- Cross-Site Request Forgery (CSRF)

### Out of Scope

- Denial of Service attacks
- Social engineering
- Physical attacks
- Third-party plugin vulnerabilities

## Compliance

2SEARX2COOL follows industry standards:

- OWASP Top 10 mitigation
- CWE/SANS Top 25 addressed
- GDPR compliance for EU users
- CCPA compliance for California users

## Contact

- Security Team: security@2searx2cool.com
- PGP Key: [Download](https://2searx2cool.com/security.asc)
- Security Advisory List: [Subscribe](https://2searx2cool.com/security/advisories)

## Acknowledgments

We thank the following researchers for responsibly disclosing vulnerabilities:

- [Security Hall of Fame](https://2searx2cool.com/security/thanks)