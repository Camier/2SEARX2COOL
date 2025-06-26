# 2SEARX2COOL Maintenance Guide
*Keep your project structure clean and optimized*

## 🎯 Quick Reference

### Essential Commands
```bash
# Start development environment
./scripts/development/start-dev.sh

# Start production environment  
./scripts/deployment/start-production.sh

# Run comprehensive tests
./tests/run-tests.sh

# Check project health
./scripts/audit-features.sh
```

---

## 📁 Structure Maintenance

### Directory Organization Rules
1. **engines/**: Only music search engine files (*.py)
2. **orchestrator/**: Main application code only
3. **config/**: System configuration files only
4. **docs/**: Documentation organized by purpose
5. **scripts/**: Utilities organized by function
6. **tests/**: Test files matching source structure

### File Naming Conventions
- **Engines**: `{service_name}.py` or `{service_name}_enhanced.py`
- **Scripts**: `{action}-{purpose}.sh` (kebab-case)
- **Configs**: `{service}-{purpose}.yml` (kebab-case)
- **Docs**: `{PURPOSE}_GUIDE.md` (CAPS for guides)

---

## 🔧 Daily Maintenance

### Development Workflow
```bash
# 1. Check current status
git status

# 2. Start development environment
cd /home/mik/SEARXNG/2SEARX2COOL
./scripts/development/start-dev.sh

# 3. Make changes, then test
./tests/run-tests.sh

# 4. Commit changes
git add .
git commit -m "Description of changes"
```

### Code Quality Checks
```bash
# Python syntax validation
find . -name "*.py" -exec python3 -m py_compile {} \;

# Configuration validation
find config/ -name "*.yml" -exec python3 -c "import yaml; yaml.safe_load(open('{}'))" \;

# Shell script validation
find scripts/ -name "*.sh" -exec shellcheck {} \;
```

---

## 📊 Weekly Maintenance

### Structure Audit
```bash
# Check for duplicate files
find . -name "*.py" -exec basename {} \; | sort | uniq -d

# Find large files that might need attention
find . -type f -size +1M -exec ls -lh {} \;

# Check documentation coverage
ls docs/ | wc -l  # Should be proportional to feature count
```

### Performance Monitoring
```bash
# Database connection test
python3 -c "
import psycopg2
try:
    conn = psycopg2.connect('postgresql:///searxng_cool_music')
    print('✅ Database connection successful')
    conn.close()
except Exception as e:
    print(f'❌ Database connection failed: {e}')
"

# Redis connection test
python3 -c "
import redis
try:
    r = redis.Redis()
    r.ping()
    print('✅ Redis connection successful')
except Exception as e:
    print(f'❌ Redis connection failed: {e}')
"
```

---

## 🗃️ Monthly Cleanup

### Archive Old Documentation
```bash
# Move old reports to archive
find docs/ -name "*_REPORT.md" -mtime +30 -exec mv {} docs/archive/ \;

# Clean up test results
find test-results/ -type f -mtime +30 -delete
```

### Dependency Updates
```bash
# Update Python dependencies
pip list --outdated
pip install --upgrade package_name

# Update orchestrator requirements
cd orchestrator/
pip freeze > requirements.txt
```

### Configuration Review
```bash
# Check for unused configuration options
grep -r "unused\|deprecated\|todo" config/

# Validate all configurations
for file in config/*.yml; do
    echo "Checking $file..."
    python3 -c "import yaml; yaml.safe_load(open('$file'))"
done
```

---

## 🚨 Troubleshooting Common Issues

### Import Errors
```bash
# Check Python path issues
python3 -c "import sys; print('\n'.join(sys.path))"

# Verify package structure
find . -name "__init__.py" -exec dirname {} \;
```

### Configuration Issues
```bash
# Test configuration loading
python3 -c "
import yaml
with open('config/orchestrator.yml') as f:
    config = yaml.safe_load(f)
    print('✅ Config loaded successfully')
    print(f'Database: {config.get(\"DATABASE\", {})}')
"
```

### Service Connection Issues
```bash
# Check service ports
netstat -tlnp | grep -E ":(8888|8889|5432|6379)"

# Test service endpoints
curl -f http://localhost:8888/search?q=test 2>/dev/null && echo "✅ SearXNG OK" || echo "❌ SearXNG Down"
curl -f http://localhost:8889/api/health 2>/dev/null && echo "✅ Orchestrator OK" || echo "❌ Orchestrator Down"
```

---

## 📈 Optimization Opportunities

### Performance Improvements
1. **Engine Response Time**: Monitor slow engines, implement timeouts
2. **Database Queries**: Add indexes for frequently searched fields
3. **Redis Caching**: Optimize cache expiration times
4. **Memory Usage**: Profile memory consumption during peak usage

### Code Quality Improvements
1. **Type Hints**: Add Python type annotations
2. **Documentation**: Ensure all functions have docstrings
3. **Error Handling**: Comprehensive exception handling
4. **Logging**: Structured logging with appropriate levels

### Structure Improvements
1. **Test Coverage**: Aim for >80% code coverage
2. **Configuration**: Move hardcoded values to config files
3. **Modularity**: Extract common functionality into shared modules
4. **Documentation**: Keep docs synchronized with code changes

---

## 🎯 Quality Gates

### Before Each Release
- [ ] All tests pass: `./tests/run-tests.sh`
- [ ] No Python syntax errors: `find . -name "*.py" -exec python3 -m py_compile {} \;`
- [ ] Configuration files valid: `find config/ -name "*.yml" -exec python3 -c "import yaml; yaml.safe_load(open('{}'))" \;`
- [ ] Documentation updated: Review and update relevant docs
- [ ] Dependencies updated: Check for security updates

### Monthly Health Check
- [ ] Structure audit completed
- [ ] Performance metrics within acceptable ranges
- [ ] Old files archived appropriately
- [ ] Dependencies up to date
- [ ] Documentation reflects current state

---

## 📋 Maintenance Schedule

### Daily (Automated)
- Code syntax validation
- Service health checks
- Log rotation

### Weekly (Manual)
- Structure audit
- Performance review
- Documentation updates

### Monthly (Scheduled)
- Dependency updates
- Archive cleanup
- Comprehensive testing
- Configuration review

### Quarterly (Planned)
- Full architecture review
- Performance benchmarking
- Security audit
- Documentation overhaul

---

## 🔗 Quick Reference Links

- **Development Scripts**: `./scripts/development/`
- **Deployment Scripts**: `./scripts/deployment/`
- **Configuration Files**: `./config/`
- **Documentation**: `./docs/`
- **Test Suite**: `./tests/`
- **Architecture Docs**: `./docs/architecture/`
- **Operational Guides**: `./docs/operational/`

---

*Last Updated: June 23, 2025*  
*Keep this guide updated as the project evolves*