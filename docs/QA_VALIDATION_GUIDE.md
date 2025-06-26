# Quality Assurance Validation Guide

## Overview

This guide provides comprehensive instructions for validating the 2SEARX2COOL integrated system, ensuring all components work correctly in both web service and desktop modes.

## Testing Framework

### 1. Automated Testing

#### Quick Validation
```bash
# Run the automated validation script
./scripts/validate-integration.sh
```

This script will:
- Check all dependencies
- Verify service health
- Test engine functionality
- Validate configuration
- Generate reports

#### Comprehensive QA Suite
```bash
# Run full QA test suite
cd test/qa-validation
python3 run_qa_tests.py
```

Options:
- `--monitor`: Run in continuous monitoring mode
- `--export <file>`: Export results to JSON
- `--interval <seconds>`: Set monitoring interval

### 2. Health Monitoring

#### Real-time Health Check
```bash
# Run health check
python3 scripts/health-check.py

# Continuous monitoring
python3 scripts/health-check.py --monitor --interval 5
```

#### Service Status
- **Redis**: Port 6379
- **SearXNG**: http://localhost:8888
- **Orchestrator**: http://localhost:8889
- **Desktop App**: Electron application

### 3. Test Categories

#### Unit Tests
Tests individual components in isolation:
- Engine parsing functions
- Configuration loaders
- Utility functions
- Data transformations

#### Integration Tests
Tests component interactions:
- Engine bridge communication
- JSON-RPC protocol
- Service endpoints
- Cache functionality

#### End-to-End Tests
Tests complete workflows:
- Search from desktop app
- Multi-engine queries
- Result aggregation
- Error handling

#### Performance Tests
Tests system performance:
- Response times
- Concurrent requests
- Resource usage
- Cache effectiveness

## Manual Testing Checklist

### Web Service Mode

- [ ] **SearXNG Interface**
  - [ ] Access http://localhost:8888
  - [ ] Perform basic search
  - [ ] Filter by music category
  - [ ] Test each engine individually

- [ ] **API Endpoints**
  - [ ] `/search` with JSON format
  - [ ] `/healthz` health check
  - [ ] `/engines` list engines
  - [ ] `/config` view configuration

- [ ] **Music Engines** (Test each with query "test")
  ```bash
  curl "http://localhost:8888/search?q=test&format=json&engines=genius"
  curl "http://localhost:8888/search?q=test&format=json&engines=spotify_web"
  curl "http://localhost:8888/search?q=test&format=json&engines=soundcloud"
  curl "http://localhost:8888/search?q=test&format=json&engines=bandcamp"
  ```

### Desktop Mode

- [ ] **Application Launch**
  - [ ] Run `npm run dev` for development
  - [ ] Verify window opens correctly
  - [ ] Check system tray icon

- [ ] **UI Features**
  - [ ] Search input works
  - [ ] Results display correctly
  - [ ] Settings are accessible
  - [ ] Keyboard shortcuts function

- [ ] **Desktop Integration**
  - [ ] Global hotkeys work
  - [ ] Notifications appear
  - [ ] System tray menu functions
  - [ ] Window state persistence

### Engine Bridge

- [ ] **JSON-RPC Communication**
  ```python
  # Test engine service directly
  cd engine-bridge
  echo '{"jsonrpc":"2.0","method":"list_engines","id":1}' | python3 engine_service.py ../engines
  ```

- [ ] **Engine Loading**
  - [ ] All 27+ engines load
  - [ ] No import errors
  - [ ] Metadata correct

### Configuration

- [ ] **File Structure**
  - [ ] `config/settings.yml` exists
  - [ ] `config/music_engines.yml` valid
  - [ ] `.env` configured correctly

- [ ] **Environment Variables**
  - [ ] SEARXNG_PORT=8888
  - [ ] ORCHESTRATOR_PORT=8889
  - [ ] REDIS_PORT=6379

## Validation Reports

### Generated Files

1. **qa-test-report.json**
   - Detailed test results
   - Component status
   - Performance metrics

2. **QA_TEST_REPORT.md**
   - Human-readable summary
   - Pass/fail status
   - Recommendations

3. **health-status.json**
   - Real-time system health
   - Resource usage
   - Service availability

### Success Criteria

The system is considered validated when:
- ✅ All automated tests pass
- ✅ Manual checklist complete
- ✅ Performance meets targets (<5s average response)
- ✅ No critical errors in logs
- ✅ All 27+ music engines functional

## Troubleshooting

### Common Issues

1. **Services Not Starting**
   ```bash
   # Check ports
   netstat -tlnp | grep -E '6379|8888|8889'
   
   # Start manually
   redis-server &
   ./start-integrated.sh
   ```

2. **Engine Failures**
   ```bash
   # Check engine logs
   tail -f logs/searxng.log
   
   # Test engine directly
   cd engines
   python3 -c "import genius; print('OK')"
   ```

3. **Desktop App Issues**
   ```bash
   # Rebuild
   npm run build
   
   # Check electron logs
   npm run dev -- --verbose
   ```

## Performance Benchmarks

### Target Metrics
- Search response: <2s average, <5s max
- Engine loading: <1s
- Memory usage: <500MB
- CPU usage: <50% during search

### Load Testing
```bash
# Simple load test (10 concurrent requests)
for i in {1..10}; do
  curl "http://localhost:8888/search?q=test$i&format=json" &
done
wait
```

## Continuous Integration

### Pre-commit Checks
```bash
# Run before committing
npm run lint
npm run test
python3 -m pytest
```

### Build Validation
```bash
# Full build test
npm run build
npm run dist
```

## Security Validation

- [ ] No API keys in code
- [ ] Environment variables used
- [ ] CORS configured properly
- [ ] Input sanitization working
- [ ] Rate limiting active

## Final Checklist

Before marking as production-ready:

- [ ] All tests passing
- [ ] Documentation complete
- [ ] Performance acceptable
- [ ] Security validated
- [ ] Builds for all platforms
- [ ] Error handling robust
- [ ] Logging configured
- [ ] Monitoring enabled

## Support

For issues during validation:
1. Check logs in `logs/` directory
2. Run health check script
3. Review error messages
4. Consult integration documentation