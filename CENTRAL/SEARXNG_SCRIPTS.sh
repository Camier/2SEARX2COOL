#!/bin/bash
# SearXNG Scripts Collection
# All useful scripts consolidated in one file

#################################################
# TABLE OF CONTENTS
#################################################
# 1. INSTALLATION SCRIPTS
# 2. QUICK START SCRIPTS  
# 3. NETWORKING FIXES
# 4. MAINTENANCE SCRIPTS
# 5. THEME DEVELOPMENT
# 6. DEBUGGING TOOLS
#################################################

#################################################
# 1. INSTALLATION SCRIPTS
#################################################

# Complete SearXNG + Tailscale Installation
install_searxng_tailscale() {
    echo "🚀 Installing SearXNG with Tailscale"
    
    # Install Tailscale
    curl -fsSL https://tailscale.com/install.sh | sh
    sudo tailscale up
    
    # Create SearXNG directory
    mkdir -p ~/searxng-instance
    cd ~/searxng-instance
    
    # Generate secrets
    echo "SEARXNG_SECRET_KEY=$(openssl rand -hex 32)" > .env
    echo "SEARXNG_HOSTNAME=$(tailscale ip -4)" >> .env
    
    # Create docker-compose.yml
    cat > docker-compose.yml << 'EOF'
version: '3.7'
services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    ports:
      - "8890:8080"
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=https://${SEARXNG_HOSTNAME}/
      - SEARXNG_SECRET_KEY=${SEARXNG_SECRET_KEY}
    depends_on:
      - redis
  redis:
    image: redis:alpine
    container_name: searxng-redis
    restart: unless-stopped
    command: redis-server --save 30 1
    volumes:
      - redis-data:/data
volumes:
  redis-data:
EOF
    
    # Create settings
    mkdir -p searxng
    cat > searxng/settings.yml << 'EOF'
use_default_settings: true
server:
  secret_key: "$(openssl rand -hex 16)"
  limiter: true
  image_proxy: true
redis:
  url: redis://redis:6379/0
ui:
  default_theme: simple
  infinite_scroll: true
search:
  safe_search: 0
  autocomplete: "duckduckgo"
EOF
    
    # Start services
    docker compose up -d
    
    echo "✅ Installation complete!"
    echo "Access at: http://$(tailscale ip -4):8890"
}

# Clean previous installations
cleanup_searxng() {
    echo "🧹 Cleaning up previous SearXNG installations"
    
    # Stop all SearXNG containers
    docker ps -a | grep searxng | awk '{print $1}' | xargs -r docker stop
    docker ps -a | grep searxng | awk '{print $1}' | xargs -r docker rm
    
    # Remove volumes
    docker volume ls | grep searxng | awk '{print $2}' | xargs -r docker volume rm
    
    # Stop systemd services if any
    sudo systemctl stop searxng 2>/dev/null || true
    sudo systemctl disable searxng 2>/dev/null || true
    
    echo "✅ Cleanup complete"
}

#################################################
# 2. QUICK START SCRIPTS
#################################################

# Start Convivial Instance
start_convivial() {
    cd /home/mik/SEARXNG/searxng-convivial/searxng-convivial-instance
    docker compose up -d
    echo "✅ Convivial instance starting at http://localhost:8090"
    echo "   Username: alice / Password: alice123"
}

# Start ALFREDISGONE
start_alfredisgone() {
    cd /home/mik/SEARXNG/SEARXTHEME/ALFREDISGONE
    
    # Try different ports if 8888 is blocked
    for port in 8888 8890 8891; do
        if ! lsof -i:$port >/dev/null 2>&1; then
            echo "Starting on port $port"
            sed -i "s/port: [0-9]*/port: $port/" searx/settings.yml
            python -m searx.webapp --port=$port
            break
        fi
    done
}

# Start with ngrok
start_with_ngrok() {
    # Download ngrok if not present
    if ! command -v ngrok &> /dev/null; then
        wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
        tar xvzf ngrok-v3-stable-linux-amd64.tgz
        sudo mv ngrok /usr/local/bin/
    fi
    
    # Start SearXNG
    cd ~/searxng-instance
    docker compose up -d
    
    # Start ngrok
    ngrok http 8890
}

#################################################
# 3. NETWORKING FIXES
#################################################

# Fix WSL2 Networking
fix_wsl2_networking() {
    echo "🔧 Fixing WSL2 Networking"
    
    WSL_IP=$(hostname -I | awk '{print $1}')
    echo "WSL2 IP: $WSL_IP"
    
    # Create Windows batch script
    cat > ~/setup-searxng-ports.bat << EOF
@echo off
echo Setting up SearXNG port forwarding...
netsh interface portproxy delete v4tov4 listenport=8890
netsh interface portproxy delete v4tov4 listenport=8899
netsh interface portproxy add v4tov4 listenport=8890 listenaddress=0.0.0.0 connectport=8890 connectaddress=$WSL_IP
netsh interface portproxy add v4tov4 listenport=8899 listenaddress=0.0.0.0 connectport=8080 connectaddress=$WSL_IP
netsh advfirewall firewall add rule name="SearXNG" dir=in action=allow protocol=TCP localport=8890,8899
echo Done! Access at http://localhost:8890
pause
EOF
    
    echo "✅ Created setup-searxng-ports.bat"
    echo "   Run this file as Administrator in Windows"
}

# Fix Cookie Domain Issues
fix_cookie_domain() {
    echo "🍪 Fixing cookie domain issues"
    
    # Add to docker-compose override
    cat > docker-compose.override.yml << 'EOF'
services:
  auth-proxy:
    environment:
      - SESSION_COOKIE_DOMAIN=
      - SESSION_COOKIE_SECURE=false
      - FLASK_ENV=development
  searxng:
    ports:
      - "8899:8080"  # Direct access port
EOF
    
    docker compose up -d
    echo "✅ Cookie domain fixed. Direct access at http://localhost:8899"
}

#################################################
# 4. MAINTENANCE SCRIPTS
#################################################

# Backup SearXNG
backup_searxng() {
    BACKUP_NAME="searxng-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p ~/backups/$BACKUP_NAME
    
    # Backup configurations
    cp -r searxng ~/backups/$BACKUP_NAME/
    cp docker-compose.yml ~/backups/$BACKUP_NAME/
    cp .env ~/backups/$BACKUP_NAME/
    
    # Backup database if using PostgreSQL
    if docker ps | grep postgres; then
        docker exec searxng-postgres pg_dump -U searxng searxng_convivial > ~/backups/$BACKUP_NAME/database.sql
    fi
    
    # Create archive
    cd ~/backups
    tar -czf $BACKUP_NAME.tar.gz $BACKUP_NAME/
    rm -rf $BACKUP_NAME/
    
    echo "✅ Backup created: ~/backups/$BACKUP_NAME.tar.gz"
}

# Update SearXNG
update_searxng() {
    echo "🔄 Updating SearXNG"
    
    cd ~/searxng-instance
    
    # Backup first
    backup_searxng
    
    # Pull latest images
    docker compose pull
    
    # Restart services
    docker compose up -d
    
    echo "✅ Update complete"
}

# View logs
view_logs() {
    SERVICE=${1:-searxng}
    docker compose logs -f $SERVICE
}

#################################################
# 5. THEME DEVELOPMENT
#################################################

# Create new theme
create_theme() {
    THEME_NAME=${1:-mytheme}
    echo "🎨 Creating theme: $THEME_NAME"
    
    cd ~/searxng-instance
    
    # Create theme structure
    mkdir -p themes/$THEME_NAME/static/{css,js,img}
    mkdir -p themes/$THEME_NAME/templates
    
    # Copy base theme
    docker compose exec searxng cp -r /usr/local/searxng/searx/static/themes/simple/* /etc/searxng/themes/$THEME_NAME/
    
    # Create basic CSS
    cat > themes/$THEME_NAME/static/css/style.css << 'EOF'
/* Custom theme styles */
:root {
    --color-primary: #3b82f6;
    --color-background: #1a1a1a;
    --color-text: #ffffff;
}

body {
    background: var(--color-background);
    color: var(--color-text);
}
EOF
    
    echo "✅ Theme created at themes/$THEME_NAME"
}

# Test theme
test_theme() {
    THEME_NAME=${1:-mytheme}
    
    # Update settings to use custom theme
    sed -i "s/default_theme: .*/default_theme: $THEME_NAME/" searxng/settings.yml
    
    # Restart to apply
    docker compose restart searxng
    
    echo "✅ Theme $THEME_NAME activated"
}

#################################################
# 6. DEBUGGING TOOLS
#################################################

# Check all services
check_services() {
    echo "🔍 Checking SearXNG services"
    
    # Docker services
    echo -e "\n📦 Docker Services:"
    docker compose ps
    
    # Port status
    echo -e "\n🔌 Port Status:"
    for port in 8080 8888 8890 8899; do
        if lsof -i:$port >/dev/null 2>&1; then
            echo "Port $port: IN USE"
        else
            echo "Port $port: FREE"
        fi
    done
    
    # Test endpoints
    echo -e "\n🌐 Endpoint Tests:"
    for port in 8890 8899; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200\|302"; then
            echo "http://localhost:$port: ✅ OK"
        else
            echo "http://localhost:$port: ❌ FAIL"
        fi
    done
    
    # WSL2 IP
    echo -e "\n💻 WSL2 IP: $(hostname -I | awk '{print $1}')"
}

# Debug configuration
debug_config() {
    echo "🐛 Debugging SearXNG configuration"
    
    # Check settings syntax
    docker compose exec searxng python -c "import yaml; yaml.safe_load(open('/etc/searxng/settings.yml'))"
    if [ $? -eq 0 ]; then
        echo "✅ settings.yml syntax OK"
    else
        echo "❌ settings.yml has syntax errors"
    fi
    
    # Show effective configuration
    echo -e "\n📋 Effective configuration:"
    docker compose exec searxng cat /etc/searxng/settings.yml | head -20
    
    # Environment variables
    echo -e "\n🔐 Environment variables:"
    docker compose exec searxng env | grep SEARXNG
}

# Interactive menu
show_menu() {
    echo "
╔════════════════════════════════════════╗
║        SearXNG Management Menu         ║
╚════════════════════════════════════════╝

1) Install SearXNG with Tailscale
2) Start Convivial Instance
3) Start ALFREDISGONE Memorial
4) Fix WSL2 Networking
5) Check All Services
6) View Logs
7) Backup Instance
8) Update SearXNG
9) Create New Theme
0) Exit

Enter choice: "
    read choice
    
    case $choice in
        1) install_searxng_tailscale ;;
        2) start_convivial ;;
        3) start_alfredisgone ;;
        4) fix_wsl2_networking ;;
        5) check_services ;;
        6) view_logs ;;
        7) backup_searxng ;;
        8) update_searxng ;;
        9) create_theme ;;
        0) exit 0 ;;
        *) echo "Invalid choice" ;;
    esac
}

# Run menu if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    show_menu
fi

# Export functions for use in other scripts
export -f install_searxng_tailscale
export -f start_convivial
export -f start_alfredisgone
export -f fix_wsl2_networking
export -f check_services
export -f backup_searxng
export -f update_searxng