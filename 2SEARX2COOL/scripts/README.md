# SearXNG-Cool Scripts

This directory contains startup and utility scripts for the SearXNG-Cool project.

## Main Scripts

### `start.sh`
Main startup script with different modes for various use cases.

```bash
# Default simple mode
./start.sh

# Minimal mode - no checks, quick startup
./start.sh --mode=minimal

# Simple mode - basic startup with cleanup (default)
./start.sh --mode=simple

# WSL2 mode - enables external access
./start.sh --mode=wsl2
```

### `development/start-dev.sh`
Development startup script with debugging and troubleshooting options.

```bash
# Normal development startup
./development/start-dev.sh

# Debug mode with verbose output
./development/start-dev.sh --debug

# Fixed mode for known issues
./development/start-dev.sh --fixed

# Skip Redis connectivity check
./development/start-dev.sh --no-redis

# Combine multiple flags
./development/start-dev.sh --debug --no-redis
```

## Directory Structure

```
scripts/
├── start.sh                    # Main startup script (consolidated)
├── archived/                   # Old versions of scripts
│   ├── start-minimal.sh       # Original minimal startup
│   ├── start-simple.sh        # Original simple startup
│   ├── start-wsl2-fixed.sh    # Original WSL2 startup
│   ├── start-dev-debug.sh     # Original dev debug script
│   ├── start-dev-fixed.sh     # Original dev fixed script
│   └── start-dev-noredis.sh   # Original dev no-redis script
├── deployment/                 # Production deployment scripts
├── development/                # Development scripts
│   ├── start-dev.sh           # Consolidated development startup
│   └── tests/                 # Test scripts
└── utilities/                  # Utility scripts
```

## Consolidation History

The scripts have been consolidated to reduce duplication and improve maintainability:

1. **Development Scripts**: The following scripts were merged into `development/start-dev.sh`:
   - `start-dev-debug.sh` → `--debug` flag
   - `start-dev-fixed.sh` → `--fixed` flag
   - `start-dev-noredis.sh` → `--no-redis` flag

2. **Main Scripts**: The following scripts were merged into `start.sh`:
   - `start-minimal.sh` → `--mode=minimal`
   - `start-simple.sh` → `--mode=simple`
   - `start-wsl2-fixed.sh` → `--mode=wsl2`

Original scripts have been preserved in the `archived/` directory for reference.

## Common Use Cases

### Quick Development Start
```bash
./scripts/development/start-dev.sh
```

### Production-like Environment
```bash
./scripts/start.sh --mode=simple
```

### Debugging Issues
```bash
./scripts/development/start-dev.sh --debug
```

### WSL2 External Access
```bash
./scripts/start.sh --mode=wsl2
```

### Skip Redis Check (for troubleshooting)
```bash
./scripts/development/start-dev.sh --no-redis
```