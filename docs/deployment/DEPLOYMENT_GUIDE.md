# 2SEARX2COOL Deployment Guide

## Overview

This guide covers deployment options for 2SEARX2COOL in its various modes:
- **Web Service**: Server deployment for multi-user access
- **Desktop Application**: End-user installation
- **Hybrid Mode**: Desktop app with embedded services

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Web Service Deployment](#web-service-deployment)
3. [Desktop Application Deployment](#desktop-application-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Production Configuration](#production-configuration)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

#### Web Service
- **OS**: Ubuntu 20.04+ / Debian 11+ / RHEL 8+ / Any modern Linux
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB minimum
- **Python**: 3.8 or higher
- **Node.js**: 18.0.0 or higher (for building)

#### Desktop Application
- **Windows**: Windows 10 version 1903+
- **macOS**: macOS 10.13+
- **Linux**: Ubuntu 18.04+, Fedora 32+, Debian 10+
- **RAM**: 4GB minimum
- **Storage**: 500MB for app + cache space

### Required Services

#### For Web Service Mode
- **Redis**: 6.0+
- **PostgreSQL**: 12+ (optional, for user management)
- **Nginx**: (recommended for reverse proxy)

## Web Service Deployment

### 1. Manual Installation

#### Step 1: System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    git \
    redis-server \
    postgresql \
    nginx \
    certbot \
    python3-certbot-nginx \
    supervisor

# Install Node.js (for asset building)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Step 2: Create Application User

```bash
# Create dedicated user
sudo useradd -m -s /bin/bash searxcool
sudo usermod -aG sudo searxcool

# Switch to app user
sudo su - searxcool
```

#### Step 3: Clone and Setup

```bash
# Clone repository
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install Node dependencies and build assets
npm install
npm run build
```

#### Step 4: Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

Example `.env`:
```bash
# Application Mode
APP_MODE=service

# Service Ports
SEARXNG_PORT=8888
ORCHESTRATOR_PORT=8889

# Database
DATABASE_URL=postgresql://searxcool:password@localhost/searxcool_db
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET_KEY=$(openssl rand -hex 32)
SECRET_KEY=$(openssl rand -hex 32)

# API Keys (optional)
DISCOGS_API_TOKEN=your_token_here
JAMENDO_API_KEY=your_key_here

# Environment
FLASK_ENV=production
LOG_LEVEL=INFO
```

#### Step 5: Database Setup

```bash
# Create PostgreSQL database and user
sudo -u postgres psql <<EOF
CREATE USER searxcool WITH PASSWORD 'secure_password';
CREATE DATABASE searxcool_db OWNER searxcool;
GRANT ALL PRIVILEGES ON DATABASE searxcool_db TO searxcool;
EOF

# Run migrations
python scripts/create_database_schema.py
```

#### Step 6: Configure Nginx

Create `/etc/nginx/sites-available/2searx2cool`:

```nginx
upstream searxng {
    server 127.0.0.1:8888;
}

upstream orchestrator {
    server 127.0.0.1:8889;
}

server {
    listen 80;
    server_name search.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name search.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/search.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/search.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy no-referrer;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:";
    
    # Main application
    location / {
        proxy_pass http://searxng;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Orchestrator API
    location /api/ {
        proxy_pass http://orchestrator/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files
    location /static/ {
        alias /home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED/searx/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Favicon
    location /favicon.ico {
        alias /home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED/searx/static/themes/simple/img/favicon.png;
        expires 1y;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/2searx2cool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 7: SSL Certificate

```bash
# Obtain SSL certificate
sudo certbot --nginx -d search.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### Step 8: Create Systemd Services

Create `/etc/systemd/system/searxng.service`:

```ini
[Unit]
Description=SearXNG Service
After=network.target redis.service postgresql.service
Wants=redis.service

[Service]
Type=simple
User=searxcool
Group=searxcool
WorkingDirectory=/home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED
Environment="PATH=/home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED/venv/bin"
ExecStart=/home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED/venv/bin/python -m searx.webapp
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/orchestrator.service`:

```ini
[Unit]
Description=2SEARX2COOL Orchestrator Service
After=network.target redis.service postgresql.service searxng.service
Wants=redis.service searxng.service

[Service]
Type=simple
User=searxcool
Group=searxcool
WorkingDirectory=/home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED/orchestrator
Environment="PATH=/home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED/venv/bin"
Environment="FLASK_ENV=production"
ExecStart=/home/searxcool/2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED/venv/bin/python app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable searxng orchestrator
sudo systemctl start searxng orchestrator
sudo systemctl status searxng orchestrator
```

### 2. Using Deployment Scripts

For automated deployment:

```bash
# Production deployment with all optimizations
cd scripts/deployment
./deploy-production.sh --domain search.yourdomain.com --email admin@yourdomain.com
```

## Desktop Application Deployment

### 1. Building for Distribution

#### Prerequisites
```bash
# Install build dependencies
npm install --save-dev electron-builder

# Install platform-specific tools
# macOS: Xcode Command Line Tools
# Windows: windows-build-tools
# Linux: build-essential
```

#### Build Commands

```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux

# Build for all platforms (requires appropriate OS or CI)
npm run dist:all
```

#### Build Configuration

`electron-builder.yml`:
```yaml
productName: 2SEARX2COOL
appId: com.searxcool.app
directories:
  output: dist
  buildResources: build

files:
  - src/
  - engines/
  - config/
  - node_modules/
  - package.json

win:
  target:
    - nsis
    - zip
  icon: build/icon.ico
  publisherName: "2SEARX2COOL Team"
  certificateFile: "${WINDOWS_CERTIFICATE}"
  certificatePassword: "${WINDOWS_CERTIFICATE_PASSWORD}"

mac:
  target:
    - dmg
    - zip
  icon: build/icon.icns
  category: public.app-category.utilities
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize:
    teamId: "${APPLE_TEAM_ID}"

linux:
  target:
    - AppImage
    - deb
    - rpm
  icon: build/icons
  category: Network
  maintainer: admin@searxcool.com

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  menuCategory: true
  
dmg:
  contents:
    - x: 410
      y: 150
      type: link
      path: /Applications
    - x: 130
      y: 150
      type: file

appImage:
  license: LICENSE
```

### 2. Code Signing

#### Windows
```bash
# Sign with certificate
electron-builder --win --p always
```

#### macOS
```bash
# Requires Apple Developer account
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="XXXXXXXXXX"

# Build and notarize
npm run dist:mac
```

### 3. Auto-Update Setup

Configure `electron-updater`:

```javascript
// src/main/updater.ts
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdater() {
  // Configure update server
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Camier',
    repo: '2SEARX2COOL'
  });
  
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();
  
  // Update events
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    // Prompt user to restart
  });
}
```

## Docker Deployment

### 1. Single Container

`Dockerfile`:
```dockerfile
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Create app directory
WORKDIR /app

# Copy application files
COPY . .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN npm ci --production

# Build assets
RUN npm run build

# Expose ports
EXPOSE 8888 8889

# Start services
CMD ["./scripts/start-unified.sh", "--service"]
```

### 2. Docker Compose

`docker-compose.yml`:
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: searxcool_db
      POSTGRES_USER: searxcool
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U searxcool"]
      interval: 30s
      timeout: 10s
      retries: 3

  searxng:
    build: .
    restart: unless-stopped
    ports:
      - "8888:8888"
    environment:
      - SEARXNG_PORT=8888
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://searxcool:${DB_PASSWORD}@postgres/searxcool_db
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    volumes:
      - ./config:/app/config
      - searxng_data:/app/data
    command: python -m searx.webapp

  orchestrator:
    build: .
    restart: unless-stopped
    ports:
      - "8889:8889"
    environment:
      - ORCHESTRATOR_PORT=8889
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://searxcool:${DB_PASSWORD}@postgres/searxcool_db
      - SEARXNG_URL=http://searxng:8888
    depends_on:
      - searxng
      - redis
      - postgres
    volumes:
      - ./config:/app/config
    working_dir: /app/orchestrator
    command: python app.py

volumes:
  redis_data:
  postgres_data:
  searxng_data:
```

### 3. Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests:
- `namespace.yaml`
- `configmap.yaml`
- `secret.yaml`
- `deployment.yaml`
- `service.yaml`
- `ingress.yaml`

## Production Configuration

### 1. Performance Tuning

#### Redis Configuration
```conf
# /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save ""
appendonly no
```

#### PostgreSQL Tuning
```conf
# postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

#### Nginx Optimization
```nginx
# nginx.conf
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Caching
    open_file_cache max=200000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml;
}
```

### 2. Monitoring Setup

#### Prometheus Metrics
```python
# orchestrator/metrics.py
from prometheus_client import Counter, Histogram, Gauge

search_requests = Counter('search_requests_total', 'Total search requests')
search_duration = Histogram('search_duration_seconds', 'Search request duration')
active_engines = Gauge('active_engines', 'Number of active search engines')
```

#### Grafana Dashboard
Import dashboard from `monitoring/grafana-dashboard.json`

## Security Hardening

### 1. Application Security

```bash
# Disable debug mode
export FLASK_ENV=production
export FLASK_DEBUG=0

# Set secure headers
# In nginx configuration (see above)

# Enable rate limiting
# config/orchestrator.yml
rate_limit:
  enabled: true
  requests_per_minute: 60
  burst: 20
```

### 2. System Security

```bash
# Firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban
sudo apt install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
# Configure in jail.local

# Security updates
sudo unattended-upgrades
```

### 3. SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
```

## Monitoring & Maintenance

### 1. Health Checks

```bash
# Create health check endpoint
curl https://search.yourdomain.com/healthz

# Automated monitoring
# Add to monitoring system (Uptime Robot, Pingdom, etc.)
```

### 2. Backup Strategy

```bash
#!/bin/bash
# backup.sh

# Backup database
pg_dump searxcool_db > backup_$(date +%Y%m%d).sql

# Backup configuration
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/

# Upload to S3 or backup location
aws s3 cp backup_$(date +%Y%m%d).sql s3://backup-bucket/
```

### 3. Log Management

```bash
# Configure log rotation
# /etc/logrotate.d/2searx2cool
/var/log/2searx2cool/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 searxcool searxcool
    sharedscripts
    postrotate
        systemctl reload searxng orchestrator
    endscript
}
```

## Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check logs
sudo journalctl -u searxng -f
sudo journalctl -u orchestrator -f

# Check permissions
ls -la /home/searxcool/2SEARX2COOL/

# Verify Python environment
source venv/bin/activate
python --version
pip list
```

#### 2. Database Connection Issues
```bash
# Test connection
psql -h localhost -U searxcool -d searxcool_db

# Check PostgreSQL status
sudo systemctl status postgresql
```

#### 3. Redis Connection Issues
```bash
# Test Redis
redis-cli ping

# Check Redis logs
sudo journalctl -u redis -f
```

#### 4. Nginx Issues
```bash
# Test configuration
sudo nginx -t

# Check error logs
tail -f /var/log/nginx/error.log
```

### Performance Issues

```bash
# Monitor resource usage
htop
iotop

# Check slow queries
# PostgreSQL
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Redis
redis-cli SLOWLOG GET 10
```

### Debug Mode

For troubleshooting only:
```bash
# Enable debug logging
export FLASK_ENV=development
export LOG_LEVEL=DEBUG

# Run manually
python -m searx.webapp
```

## Maintenance Tasks

### Weekly
- Check disk space
- Review error logs
- Verify backups

### Monthly
- Update dependencies
- Security patches
- Performance review

### Quarterly
- Full system audit
- Capacity planning
- Disaster recovery test