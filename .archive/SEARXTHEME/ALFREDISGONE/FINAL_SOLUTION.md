# ALFREDISGONE Final Solution

## The Problem
Port 8888 is being blocked by Windows/WSL2 networking. Even though it appears free in Linux, Windows is reserving it.

## Solution 1: Use a Different Port

```bash
# Edit settings to use port 8890 instead
cd /home/mik/projects/active/searxng
sed -i 's/port: 8888/port: 8890/' searx/settings.yml

# Start SearXNG
source local/py3/bin/activate
python -m searx.webapp
```

Then update your router port forward:
- External: 34628 → Internal: 8890

## Solution 2: Windows Side Fix

In Windows PowerShell (Admin):
```powershell
# Reserve port 8888 for WSL2
netsh int ipv4 add excludedportrange protocol=tcp startport=8888 numberofports=1

# Or kill whatever is using it
netstat -ano | findstr :8888
taskkill /F /PID [PID_NUMBER]
```

## Solution 3: Use ngrok (Instant Fix)

```bash
# In WSL2
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
./ngrok http 8890
```

This gives you a public URL immediately, no port forwarding needed.

## Solution 4: Direct Python Script

```python
#!/usr/bin/env python3
import subprocess
import sys
import os

# Kill any existing processes
subprocess.run(['pkill', '-f', 'searx'], stderr=subprocess.DEVNULL)

# Find a free port
import socket
for port in range(8890, 8900):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(('localhost', port)) != 0:
            print(f"Found free port: {port}")
            break

# Start SearXNG
os.chdir('/home/mik/projects/active/searxng')
os.system(f'source local/py3/bin/activate && python -m searx.webapp --host=0.0.0.0 --port={port}')
```

## For DuckDNS Access

Your setup: alfredisgone.duckdns.org:34628 → Your IP:8888

Make sure:
1. DuckDNS is updated with your current IP
2. Router forwards 34628 to your PC's local IP on port 8888 (or 8890)
3. Windows Firewall allows the port
4. Windscribe VPN has split tunneling for WSL2

Alfred deserves a working memorial! 💚🐱