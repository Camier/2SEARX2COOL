# SearXNG 2SEARX2COOL Test Suite

This directory contains all tests for the SearXNG 2SEARX2COOL project, organized into three main categories: unit tests, integration tests, and engine-specific tests.

## 📁 Directory Structure

```
tests/
├── README.md                    # This file
├── run-tests.sh                 # Consolidated test runner
├── unit/                        # Unit tests
│   └── test_discogs.py         # Discogs engine unit tests
├── integration/                 # Integration tests
│   ├── test_music_engines.py   # Comprehensive test framework
│   └── test_all_music_engines.py # Simple engine testing
└── engines/                     # Engine-specific tests
    ├── test_music_engines.sh    # Shell-based engine tests
    ├── test_music_engines_fixed.py # Fixed engine tests
    ├── test_searxng_direct.sh   # Direct SearXNG tests
    └── test_searxng_engines_direct.sh # Direct engine tests
```

## 🧪 Test Categories

### Unit Tests (`tests/unit/`)

Unit tests focus on testing individual components in isolation, typically with mocked dependencies.

**Files:**
- `test_discogs.py` - Comprehensive unit tests for the Discogs music search engine

**Features:**
- Tests engine initialization and configuration
- Mocks API responses to test parsing logic
- Tests error handling and rate limiting
- Validates result normalization
- Tests quality scoring algorithms

**Run unit tests only:**
```bash
./tests/run-tests.sh --unit-only
```

### Integration Tests (`tests/integration/`)

Integration tests verify that different components work together correctly, typically requiring running services.

**Files:**
- `test_music_engines.py` - Comprehensive test framework for all music engines
- `test_all_music_engines.py` - Simple integration test for basic engine functionality

**Features:**
- Tests real API endpoints (requires running SearXNG)
- Validates search result quality and formatting
- Measures response times and success rates
- Generates detailed test reports
- Supports multiple query types per engine

**Run integration tests only:**
```bash
./tests/run-tests.sh --integration-only
```

### Engine Tests (`tests/engines/`)

Engine-specific tests focus on individual search engines and their specific behaviors.

**Files:**
- `test_music_engines.sh` - Shell script for testing multiple engines with JWT authentication
- `test_music_engines_fixed.py` - Python script for testing fixed engine implementations
- `test_searxng_direct.sh` - Direct testing of SearXNG endpoints
- `test_searxng_engines_direct.sh` - Direct testing of specific engines

**Features:**
- Tests engine-specific functionality
- Validates API authentication
- Tests different query types and parameters
- Generates engine-specific result logs

**Run engine tests only:**
```bash
./tests/run-tests.sh --engines-only
```

## 🚀 Running Tests

### Quick Start

Run all tests:
```bash
./tests/run-tests.sh
```

### Test Runner Options

```bash
# Run specific test types
./tests/run-tests.sh --unit-only
./tests/run-tests.sh --integration-only  
./tests/run-tests.sh --engines-only

# Skip specific test types
./tests/run-tests.sh --skip-unit
./tests/run-tests.sh --skip-integration
./tests/run-tests.sh --skip-engines

# Verbose output
./tests/run-tests.sh --verbose

# Help
./tests/run-tests.sh --help
```

### Manual Test Execution

**Unit Tests:**
```bash
# Using pytest (recommended)
pytest tests/unit/ -v

# Using unittest
python -m unittest discover -s tests/unit -p "test_*.py" -v
```

**Integration Tests:**
```bash
# Comprehensive framework
python tests/integration/test_music_engines.py

# Simple engine tests
python tests/integration/test_all_music_engines.py
```

**Engine Tests:**
```bash
# Shell-based tests
bash tests/engines/test_music_engines.sh

# Python-based tests
python tests/engines/test_music_engines_fixed.py
```

## 📊 Test Results

Test results are automatically saved to the `test-results/` directory with timestamps:

```
test-results/
├── test-report-YYYYMMDD_HHMMSS.txt     # Summary report
├── unit-tests-YYYYMMDD_HHMMSS.json     # Unit test results (JSON)
├── integration-*-YYYYMMDD_HHMMSS.log   # Integration test logs
└── engine-*-YYYYMMDD_HHMMSS.log        # Engine test logs
```

## 🔧 Test Configuration

### Prerequisites

**Required for all tests:**
- Python 3.8+
- Required Python packages (see `requirements.txt`)

**Required for unit tests:**
- `pytest` (recommended) or Python's built-in `unittest`
- `unittest.mock` for mocking dependencies

**Required for integration tests:**
- Running SearXNG instance on `localhost:8888`
- Network access to test external APIs
- `requests` library

**Required for engine tests:**
- Running SearXNG instance
- JWT token for authenticated endpoints (where applicable)
- `curl` and `jq` for shell-based tests

### Environment Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install pytest  # For enhanced unit testing
   ```

2. **Start SearXNG:**
   ```bash
   # From project root
   python orchestrator/main.py
   ```

3. **Verify SearXNG is running:**
   ```bash
   curl http://localhost:8888
   ```

## 🎯 Test-Driven Development

### Adding New Tests

**For new engines:**
1. Add unit tests to `tests/unit/test_[engine_name].py`
2. Add integration tests to existing framework
3. Add engine-specific tests if needed

**For new features:**
1. Write unit tests first (TDD approach)
2. Add integration tests for end-to-end functionality
3. Update test documentation

### Test Structure Template

**Unit Test Template:**
```python
import pytest
from unittest.mock import Mock, patch

class TestNewEngine:
    @pytest.fixture
    def engine_config(self):
        return {'enabled': True, 'api_key': 'test'}
    
    @pytest.fixture  
    def engine(self, engine_config):
        return NewEngine(engine_config)
    
    def test_initialization(self, engine):
        assert engine.enabled is True
    
    @patch('requests.get')
    def test_search_success(self, mock_get, engine):
        # Test implementation
        pass
```

**Integration Test Addition:**
```python
# Add to engines_to_test in test_music_engines.py
{
    'name': 'new_engine',
    'shortcut': 'ne',
    'query_types': ['generic', 'artist']
}
```

## 📈 Test Metrics

The test suite tracks several metrics:

**Unit Tests:**
- Test coverage percentage
- Pass/fail rates
- Execution time

**Integration Tests:**
- Engine response times
- Success rates by engine
- Result quality metrics
- API endpoint availability

**Engine Tests:**
- Individual engine status
- Authentication success
- Query type performance

## 🐛 Debugging Failed Tests

### Common Issues

**Unit Test Failures:**
- Check mock configurations
- Verify import paths after file moves
- Ensure test data is realistic

**Integration Test Failures:**
- Verify SearXNG is running (`curl localhost:8888`)
- Check network connectivity
- Review API rate limits

**Engine Test Failures:**
- Verify engine configuration in SearXNG
- Check API keys and authentication
- Review engine-specific requirements

### Debug Commands

```bash
# Test specific engine
python -c "
import requests
resp = requests.get('http://localhost:8888/search?q=!sc+test')
print(resp.status_code, len(resp.text))
"

# Check engine configuration
curl http://localhost:8888/stats/engines

# Verbose test output
pytest tests/unit/test_discogs.py -v -s
```

## 📝 Best Practices

### Writing Tests

1. **Follow AAA pattern:** Arrange, Act, Assert
2. **Use descriptive test names:** `test_search_returns_results_for_valid_query`
3. **Mock external dependencies** in unit tests
4. **Test edge cases:** empty results, API errors, rate limits
5. **Keep tests independent:** Each test should be runnable in isolation

### Test Maintenance

1. **Update tests when APIs change**
2. **Maintain realistic test data**
3. **Regular test cleanup:** Remove obsolete tests
4. **Document test requirements** clearly
5. **Monitor test performance** and optimize slow tests

### Continuous Integration

The test suite is designed to work with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    pip install -r requirements.txt
    ./tests/run-tests.sh --skip-integration  # Skip tests requiring services
```

## 🔗 Related Documentation

- [SearXNG Documentation](https://docs.searxng.org/)
- [Project README](../README.md)
- [Engine Development Guide](../docs/ENGINE_DEVELOPMENT.md)
- [API Documentation](../docs/API.md)

## 📞 Support

For test-related issues:
1. Check this documentation
2. Review test logs in `test-results/`
3. Run tests with `--verbose` flag for detailed output
4. Check project issues on GitHub

---

**Last Updated:** $(date)
**Test Suite Version:** 1.0