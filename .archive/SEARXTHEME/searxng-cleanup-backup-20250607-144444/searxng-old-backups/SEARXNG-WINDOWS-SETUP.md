# SearXNG Windows Setup for WSL2 + Windscribe VPN

## 🚀 Quick Start

### 1. Start SearXNG in WSL2:
```bash
./searxng-direct-start.sh
```

### 2. Windows Port Forwarding (Run PowerShell as Admin):

```powershell
# Get WSL2 IP
$wslIp = (wsl hostname -I).Trim().Split()[0]
Write-Host "WSL2 IP: $wslIp"

# Remove old rules
netsh interface portproxy reset

# Forward ports to WSL2
netsh interface portproxy add v4tov4 listenport=8888 listenaddress=0.0.0.0 connectport=8888 connectaddress=$wslIp
netsh interface portproxy add v4tov4 listenport=22760 listenaddress=0.0.0.0 connectport=8888 connectaddress=$wslIp

# Show rules
netsh interface portproxy show v4tov4

# Firewall rules
New-NetFirewallRule -DisplayName "SearXNG" -Direction Inbound -Protocol TCP -LocalPort 8888,22760 -Action Allow
```

### 3. Windscribe VPN Split Tunneling:

1. Open Windscribe
2. Settings → Connection → Split Tunneling
3. Add to "Bypass VPN":
   - `127.0.0.1`
   - `localhost`
   - `192.168.1.11`
   - Windows Terminal app

### 4. Test Access:

- **From WSL2**: http://localhost:8888
- **From Windows**: http://localhost:8888
- **From LAN**: http://192.168.1.11:8888
- **External**: https://alfredisgone.duckdns.org:22760

### 5. Router Port Forwarding:

Forward external port `22760` to your Windows PC IP on port `22760`

## 🛠️ Troubleshooting

### If SearXNG won't start:
```bash
# Check for errors
cd /home/mik/projects/active/searxng
source /home/mik/searxng/searxng-env/bin/activate
python -m searx.webapp --debug
```

### If network issues persist:
```bash
# Test without VPN
# Disconnect Windscribe and try again
```

### Alternative WSL2 config (C:\Users\[YourName]\.wslconfig):
```ini
[wsl2]
memory=8GB
processors=4

[experimental]
networkingMode=mirrored
dnsTunneling=true
firewall=false
```

Then restart WSL: `wsl --shutdown`