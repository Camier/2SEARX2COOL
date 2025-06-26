# SearXNG Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Instances](#instances)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Networking & Access](#networking--access)
6. [Theme Development](#theme-development)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

---

## Overview

SearXNG is a privacy-respecting metasearch engine. This guide covers three instances:

### Instance Summary
| Instance | Purpose | Port | Theme | Special Features |
|----------|---------|------|-------|------------------|
| **wttr** | Production | 8888 | Simple | Weather integration, Tailscale |
| **Convivial** | Community | 8890 | Custom | Real-time presence, collections |
| **ALFREDISGONE** | Memorial | 8888/8890 | Deadcat | Matrix rain effects |

---

## Instances

### 1. Main Instance (searxng-wttr)
**Location**: `/home/mik/SEARXNG/searxng-wttr/`

**Features**:
- 246 search engines
- Weather integration (wttr.in)
- Tailscale secured access
- Redis caching
- Simple theme

**Key Configurations**:
- Bandcamp, SoundCloud for music
- Google Scholar, arXiv, PubMed for research
- Privacy-first settings
- Auto-language detection

### 2. Convivial Instance
**Location**: `/home/mik/SEARXNG/searxng-convivial/`

**Philosophy**: A "digital salon" for 2-3 close friends to share discoveries

**Unique Features**:
- **Real-time presence**: See when friends are searching
- **Morning Coffee**: Daily digest of yesterday's discoveries
- **Gift Wrapper**: Share findings with time delay
- **Search Moods**: Different UI themes (late night, botanical, chaos mode)
- **Collision Detection**: Celebrate when friends search similar things
- **Time Capsules**: Schedule future discoveries

**Technical Stack**:
- Docker Compose orchestration
- Auth proxy with JWT
- PostgreSQL for persistent data
- Redis for real-time features
- WebSocket server for presence
- Nginx reverse proxy

### 3. ALFREDISGONE Memorial
**Location**: `/home/mik/SEARXNG/SEARXTHEME/ALFREDISGONE/`

**Purpose**: Memorial instance for a beloved cat

**Theme Features**:
- Custom "deadcat" dark theme
- Matrix rain effects (attempted)
- Memorial dedication

**Access**: alfredisgone.duckdns.org:34628 → Internal port

---

## Installation

### Quick Install (Docker Compose)

1. **Basic Setup**:
```bash
# Create directory
mkdir -p ~/searxng-instance
cd ~/searxng-instance

# Create docker-compose.yml (see SEARXNG_CONFIGS.yml)
# Create settings directory
mkdir -p searxng

# Generate secrets
echo "SEARXNG_SECRET_KEY=$(openssl rand -hex 32)" > .env
```

2. **Start Services**:
```bash
docker compose up -d
```

### Tailscale Integration

1. **Install Tailscale**:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

2. **Configure Access**:
```bash
tailscale serve https / http://localhost:8890
```

### Full Installation Script
Use the provided installer:
```bash
bash /home/mik/SEARXNG/searxng-tailscale-installer.sh
```

---

## Configuration

### Essential settings.yml
```yaml
use_default_settings: true

general:
  instance_name: "My SearXNG"
  enable_metrics: false

search:
  safe_search: 0
  autocomplete: "duckduckgo"
  default_lang: "auto"

ui:
  infinite_scroll: true
  default_theme: "simple"

redis:
  url: redis://redis:6379/0

# See SEARXNG_CONFIGS.yml for complete examples
```

### Environment Variables
```bash
# .env file
SEARXNG_HOSTNAME=localhost
SEARXNG_SECRET_KEY=change_me_to_random_value
JWT_SECRET=another_random_value
POSTGRES_PASSWORD=secure_password
```

---

## Networking & Access

### WSL2 Specific Issues

**Problem**: Port conflicts between Windows and WSL2

**Solutions**:

1. **Use Alternative Ports**:
   - 8890 instead of 8888
   - 8899 for direct access

2. **Windows Firewall**:
```powershell
# In PowerShell (Admin)
New-NetFirewallRule -DisplayName "SearXNG" -Direction Inbound -LocalPort 8890 -Protocol TCP -Action Allow
```

3. **Port Forwarding Script**:
```bash
# Create ~/setup-searxng-ports.bat for Windows
netsh interface portproxy add v4tov4 listenport=8890 listenaddress=0.0.0.0 connectport=8890 connectaddress=192.168.1.11
```

### Access Methods

1. **Local Access**:
   - http://localhost:8890 (with auth)
   - http://localhost:8899 (direct)

2. **Network Access**:
   - http://[WSL2-IP]:8890
   - Via Tailscale network

3. **External Access**:
   - Configure router port forwarding
   - Use Tailscale Serve
   - ngrok for temporary access

---

## Theme Development

### Theme Structure
```
themes/
└── custom-theme/
    ├── static/
    │   ├── css/
    │   ├── js/
    │   └── img/
    └── templates/
        ├── base.html
        ├── index.html
        └── results.html
```

### Creating Custom Theme

1. **Copy Base Theme**:
```bash
cp -r searx/static/themes/simple searx/static/themes/mytheme
```

2. **Modify Templates**:
- Keep Jinja2 logic intact
- Add CSS classes for styling
- Test incrementally

3. **Known Issues**:
- Deadcat theme has template corruption
- Multiple patch attempts caused syntax errors
- Solution: Start fresh from simple theme

### Matrix Rain Effect
For the attempted matrix rain effect, see the backup files in:
`/home/mik/BACKUPS/correct_theme_backup_20250524_045250/`

---

## Troubleshooting

### Common Issues

1. **Port Already in Use**:
```bash
# Find process
sudo lsof -i :8890
# Kill if needed
sudo kill -9 [PID]
```

2. **Cookie Loop Issues**:
```yaml
# In docker-compose.yml
environment:
  - SESSION_COOKIE_DOMAIN=
  - SESSION_COOKIE_SECURE=false
```

3. **Can't Access from Windows**:
- Run port forwarding script as Administrator
- Check Windows Defender Firewall
- Verify WSL2 IP hasn't changed

4. **Theme Not Loading**:
```bash
# Clear cache
docker compose exec searxng rm -rf /var/cache/searxng/*
docker compose restart searxng
```

### Debug Commands
```bash
# View logs
docker compose logs -f searxng

# Check configuration
docker compose exec searxng cat /etc/searxng/settings.yml

# Test connectivity
curl -I http://localhost:8890

# Check services
docker compose ps
```

---

## Maintenance

### Backup
```bash
# Backup configurations
tar -czf searxng-backup-$(date +%Y%m%d).tar.gz searxng/ docker-compose.yml .env

# Backup with data
docker compose exec postgres pg_dump -U searxng searxng_convivial > backup.sql
```

### Update
```bash
# Update images
docker compose pull
docker compose up -d

# Update configuration
docker compose restart searxng
```

### Cleanup Old Files
After centralizing to this guide, you can remove:
- Duplicate documentation files
- Old backup directories (after archiving)
- Test instances
- Redundant scripts

### Monitor Performance
```bash
# Check resource usage
docker stats

# Monitor logs
docker compose logs -f --tail=100
```

---

## Advanced Features

### Convivial Plugins
Located in `/plugins/`:
- `convivial_presence.py`: Real-time awareness
- `discovery_feed.py`: Shared findings
- `gift_wrapper.py`: Delayed sharing
- `search_moods.py`: UI themes
- `collision_detector.py`: Serendipity detection

### API Access
```bash
# Search API
curl "http://localhost:8890/search?q=test&format=json"

# Autocomplete
curl "http://localhost:8890/autocomplete?q=tes"
```

### Federation (Future)
Plans for connecting multiple instances:
- Shared discovery network
- Privacy-preserving sync
- Cross-instance search

---

## Quick Reference Card

### Essential Commands
```bash
# Start
docker compose up -d

# Stop
docker compose down

# Restart
docker compose restart searxng

# View logs
docker compose logs -f

# Access shell
docker compose exec searxng /bin/sh
```

### Important Files
- Configuration: `searxng/settings.yml`
- Environment: `.env`
- Compose: `docker-compose.yml`
- Themes: `searx/static/themes/`

### Default Credentials
- Username: alice
- Password: alice123
- Alternatives: bob/bob123, carol/carol123

---

*This guide consolidates all SearXNG knowledge. For specific configurations, see SEARXNG_CONFIGS.yml*