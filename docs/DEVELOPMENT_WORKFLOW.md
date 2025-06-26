# 2SEARX2COOL Development Workflow

## Overview

This guide covers the development workflow for 2SEARX2COOL, including setup, coding standards, testing, and contribution processes.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Development Tools](#development-tools)
4. [Coding Standards](#coding-standards)
5. [Testing Strategy](#testing-strategy)
6. [Git Workflow](#git-workflow)
7. [Adding Features](#adding-features)
8. [Debugging](#debugging)
9. [Performance Optimization](#performance-optimization)
10. [Release Process](#release-process)

## Development Setup

### Prerequisites

```bash
# Required software
- Python 3.8+
- Node.js 18+
- Git
- Redis
- PostgreSQL (optional)
- Visual Studio Code (recommended)
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/Camier/2SEARX2COOL.git
cd 2SEARX2COOL/2SEARX2COOL-FINAL-INTEGRATED

# Create Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Install Node dependencies
npm install

# Setup pre-commit hooks
pre-commit install

# Copy environment template
cp .env.example .env
# Edit .env with your configuration

# Initialize database (if using PostgreSQL)
python scripts/create_database_schema.py
```

### IDE Setup

#### Visual Studio Code

Recommended extensions:
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-tslint-plugin",
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens",
    "mhutchie.git-graph",
    "gruntfuggly.todo-tree",
    "yzhang.markdown-all-in-one"
  ]
}
```

Settings (`.vscode/settings.json`):
```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "python.testing.pytestEnabled": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

## Project Structure

```
2SEARX2COOL-FINAL-INTEGRATED/
├── src/                        # TypeScript/Electron source
│   ├── main/                   # Main process code
│   │   ├── index.ts           # Entry point
│   │   ├── ipc.ts             # IPC handlers
│   │   ├── server.ts          # Server management
│   │   └── plugins.ts         # Plugin system
│   ├── renderer/              # Renderer process (React)
│   │   ├── App.tsx            # Main component
│   │   ├── pages/             # Page components
│   │   └── components/        # Reusable components
│   ├── preload/               # Preload scripts
│   └── shared/                # Shared types/constants
├── engines/                   # Python search engines
│   ├── base_music.py          # Base engine class
│   ├── spotify.py             # Engine implementations
│   └── tests/                 # Engine tests
├── engine-bridge/             # JSON-RPC bridge
│   ├── engine_service.py      # Bridge service
│   ├── protocol.py            # Protocol definitions
│   └── engine_registry.py     # Engine management
├── orchestrator/              # Flask backend
│   ├── app.py                 # Main application
│   ├── blueprints/            # API routes
│   ├── services/              # Business logic
│   └── models/                # Data models
├── config/                    # Configuration files
│   ├── unified/               # Unified config system
│   └── *.yml                  # Service configs
├── scripts/                   # Utility scripts
│   ├── dev-tools/             # Development tools
│   └── deployment/            # Deployment scripts
├── test/                      # Test suites
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── e2e/                   # End-to-end tests
└── docs/                      # Documentation
```

## Development Tools

### Refactoring System

The project includes an advanced refactoring system:

```bash
# Run refactoring analysis
npm run refactor:analyze

# Apply refactoring suggestions
npm run refactor:apply

# Custom refactoring rules
node scripts/refactoring-system/index.ts --rule custom-rule.js
```

### Code Quality Tools

```bash
# Python linting
flake8 engines/ orchestrator/
pylint engines/ orchestrator/
black engines/ orchestrator/ --check

# TypeScript linting
npm run lint
npm run lint:fix

# Code formatting
npm run format

# Type checking
npm run typecheck
```

### Performance Monitoring

```bash
# Start with performance monitoring
npm run dev:perf

# Python profiling
python -m cProfile -o profile.stats orchestrator/app.py

# Memory profiling
mprof run orchestrator/app.py
mprof plot
```

## Coding Standards

### Python Style Guide

Follow PEP 8 with these additions:

```python
# File structure
"""Module docstring."""

# Standard library imports
import os
import sys
from typing import List, Dict, Optional

# Third-party imports
import flask
from redis import Redis

# Local imports
from engines.base_music import MusicEngine
from config.loader import ConfigLoader


class SpotifyEngine(MusicEngine):
    """Spotify search engine implementation.
    
    Attributes:
        api_client: Spotify Web API client
        cache: Redis cache instance
    """
    
    def __init__(self, config: Dict[str, any]) -> None:
        """Initialize Spotify engine.
        
        Args:
            config: Engine configuration dictionary
        """
        super().__init__(config)
        self.api_client = self._init_client()
    
    def search(self, query: str, params: Optional[Dict] = None) -> List[Dict]:
        """Search for music on Spotify.
        
        Args:
            query: Search query string
            params: Optional search parameters
            
        Returns:
            List of search results
            
        Raises:
            EngineError: If search fails
        """
        params = params or {}
        # Implementation
```

### TypeScript Style Guide

Follow the Airbnb TypeScript style guide:

```typescript
// File structure
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Types
interface SearchProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
}

// Component
export const SearchBar: React.FC<SearchProps> = ({ 
  onSearch, 
  initialQuery = '' 
}) => {
  const [query, setQuery] = useState(initialQuery);
  const dispatch = useDispatch();
  
  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependency]);
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for music..."
      />
    </form>
  );
};
```

### Commit Message Convention

Follow Conventional Commits:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Test changes
- `chore`: Build/tool changes

Examples:
```bash
feat(engines): add Tidal music engine support

- Implement Tidal API integration
- Add authentication flow
- Support track, album, and artist search

Closes #123

fix(desktop): resolve memory leak in plugin system

The plugin loader was not properly cleaning up event listeners
when plugins were deactivated.

perf(search): optimize Redis caching strategy

- Implement LRU eviction policy
- Add compression for large results
- Reduce cache key size

Improves search response time by 40%
```

## Testing Strategy

### Test Structure

```
test/
├── unit/                 # Isolated component tests
│   ├── engines/         # Engine unit tests
│   ├── components/      # React component tests
│   └── services/        # Service layer tests
├── integration/         # Component interaction tests
│   ├── api/            # API integration tests
│   ├── database/       # Database tests
│   └── cache/          # Redis tests
└── e2e/                # End-to-end tests
    ├── search.spec.ts  # Search flow tests
    └── settings.spec.ts # Settings tests
```

### Running Tests

```bash
# All tests
npm test

# Python tests
pytest
pytest --cov=engines --cov=orchestrator

# JavaScript/TypeScript tests
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Tests

#### Python Tests (pytest)

```python
# test_spotify_engine.py
import pytest
from unittest.mock import Mock, patch
from engines.spotify import SpotifyEngine


class TestSpotifyEngine:
    @pytest.fixture
    def engine(self):
        """Create engine instance for testing."""
        config = {'api_key': 'test_key'}
        return SpotifyEngine(config)
    
    @pytest.fixture
    def mock_response(self):
        """Mock API response."""
        return {
            'tracks': {
                'items': [
                    {
                        'id': '123',
                        'name': 'Test Song',
                        'artists': [{'name': 'Test Artist'}]
                    }
                ]
            }
        }
    
    @patch('engines.spotify.requests.get')
    def test_search_success(self, mock_get, engine, mock_response):
        """Test successful search."""
        mock_get.return_value.json.return_value = mock_response
        
        results = engine.search('test query')
        
        assert len(results) == 1
        assert results[0]['title'] == 'Test Song'
        assert results[0]['artist'] == 'Test Artist'
    
    def test_search_with_empty_query(self, engine):
        """Test search with empty query."""
        with pytest.raises(ValueError):
            engine.search('')
```

#### TypeScript Tests (Jest/Vitest)

```typescript
// SearchBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('renders with placeholder', () => {
    render(<SearchBar onSearch={jest.fn()} />);
    
    expect(screen.getByPlaceholderText('Search for music...')).toBeInTheDocument();
  });
  
  it('calls onSearch with query on submit', () => {
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);
    
    const input = screen.getByPlaceholderText('Search for music...');
    const form = screen.getByRole('form');
    
    fireEvent.change(input, { target: { value: 'pink floyd' } });
    fireEvent.submit(form);
    
    expect(onSearch).toHaveBeenCalledWith('pink floyd');
  });
  
  it('initializes with provided query', () => {
    render(<SearchBar onSearch={jest.fn()} initialQuery="test" />);
    
    const input = screen.getByPlaceholderText('Search for music...') as HTMLInputElement;
    expect(input.value).toBe('test');
  });
});
```

#### E2E Tests (Playwright)

```typescript
// search.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Search Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });
  
  test('performs search and displays results', async ({ page }) => {
    // Enter search query
    await page.fill('[data-testid="search-input"]', 'Beatles');
    await page.click('[data-testid="search-button"]');
    
    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]');
    
    // Verify results
    const results = await page.$$('[data-testid="result-item"]');
    expect(results.length).toBeGreaterThan(0);
    
    // Check first result
    const firstResult = await results[0].textContent();
    expect(firstResult).toContain('Beatles');
  });
  
  test('filters results by engine', async ({ page }) => {
    // Perform search
    await page.fill('[data-testid="search-input"]', 'Music');
    await page.click('[data-testid="search-button"]');
    
    // Apply filter
    await page.click('[data-testid="filter-spotify"]');
    
    // Verify filtered results
    const results = await page.$$('[data-engine="spotify"]');
    const totalResults = await page.$$('[data-testid="result-item"]');
    
    expect(results.length).toBe(totalResults.length);
  });
});
```

## Git Workflow

### Branch Strategy

```
main
├── develop
│   ├── feature/add-tidal-engine
│   ├── feature/improve-caching
│   └── feature/ui-redesign
├── release/v1.2.0
└── hotfix/fix-memory-leak
```

### Workflow

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/add-tidal-engine
   ```

2. **Develop Feature**
   ```bash
   # Make changes
   git add .
   git commit -m "feat(engines): add Tidal engine skeleton"
   
   # Continue development
   git commit -m "feat(engines): implement Tidal search"
   git commit -m "test(engines): add Tidal engine tests"
   ```

3. **Keep Branch Updated**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/add-tidal-engine
   git rebase develop
   ```

4. **Create Pull Request**
   ```bash
   git push origin feature/add-tidal-engine
   # Create PR on GitHub
   ```

### Code Review Process

1. **Self Review**
   - Run all tests
   - Check code coverage
   - Verify documentation
   - Test manually

2. **PR Checklist**
   - [ ] Tests pass
   - [ ] Code coverage maintained/improved
   - [ ] Documentation updated
   - [ ] Changelog updated
   - [ ] No linting errors
   - [ ] Performance impact considered

3. **Review Guidelines**
   - Be constructive
   - Suggest improvements
   - Check for security issues
   - Verify error handling

## Adding Features

### Adding a New Search Engine

1. **Create Engine File**
   ```bash
   # Create new engine
   touch engines/tidal.py
   ```

2. **Implement Engine**
   ```python
   # engines/tidal.py
   from engines.base_music import MusicEngine
   
   class TidalEngine(MusicEngine):
       name = "tidal"
       categories = ["music"]
       
       def search(self, query, params):
           # Implementation
           pass
   ```

3. **Add Configuration**
   ```yaml
   # config/music_engines.yml
   engines:
     tidal:
       enabled: true
       api_url: https://api.tidal.com
       timeout: 5
   ```

4. **Write Tests**
   ```python
   # test/unit/engines/test_tidal.py
   def test_tidal_search():
       # Test implementation
       pass
   ```

5. **Update Documentation**
   ```markdown
   # docs/engines/tidal.md
   # Tidal Engine
   
   Configuration and usage...
   ```

### Adding UI Components

1. **Create Component**
   ```typescript
   // src/renderer/components/MusicPlayer.tsx
   export const MusicPlayer: React.FC = () => {
     // Implementation
   };
   ```

2. **Add to Page**
   ```typescript
   // src/renderer/pages/Search.tsx
   import { MusicPlayer } from '../components/MusicPlayer';
   ```

3. **Style Component**
   ```css
   /* src/renderer/styles/MusicPlayer.css */
   .music-player {
     /* Styles */
   }
   ```

4. **Test Component**
   ```typescript
   // test/unit/components/MusicPlayer.test.tsx
   ```

## Debugging

### Debug Configuration

VS Code launch.json:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "program": "${workspaceFolder}/src/main/index.ts",
      "args": ["--remote-debugging-port=9223"],
      "outputCapture": "std"
    },
    {
      "name": "Debug Python",
      "type": "python",
      "request": "launch",
      "module": "orchestrator.app",
      "env": {
        "FLASK_ENV": "development",
        "FLASK_DEBUG": "1"
      }
    }
  ]
}
```

### Debug Tools

```bash
# Electron DevTools
npm run dev -- --inspect

# Python debugger
python -m pdb orchestrator/app.py

# Redis monitoring
redis-cli monitor

# Network debugging
mitmproxy -p 8080
```

## Performance Optimization

### Profiling

```bash
# JavaScript profiling
npm run dev -- --inspect-brk
# Open chrome://inspect

# Python profiling
python -m cProfile -o profile.stats orchestrator/app.py
snakeviz profile.stats
```

### Optimization Techniques

1. **Caching Strategy**
   ```python
   from functools import lru_cache
   from redis import Redis
   
   redis_client = Redis()
   
   @lru_cache(maxsize=1000)
   def expensive_operation(param):
       # Check Redis first
       cached = redis_client.get(f"cache:{param}")
       if cached:
           return json.loads(cached)
       
       # Compute result
       result = compute_result(param)
       
       # Cache in Redis
       redis_client.setex(
           f"cache:{param}", 
           3600, 
           json.dumps(result)
       )
       
       return result
   ```

2. **Lazy Loading**
   ```typescript
   // Lazy load heavy components
   const HeavyComponent = lazy(() => import('./HeavyComponent'));
   
   // Use with Suspense
   <Suspense fallback={<Loading />}>
     <HeavyComponent />
   </Suspense>
   ```

3. **Database Optimization**
   ```python
   # Use connection pooling
   from sqlalchemy.pool import QueuePool
   
   engine = create_engine(
       DATABASE_URL,
       poolclass=QueuePool,
       pool_size=10,
       max_overflow=20
   )
   ```

## Release Process

### Version Numbering

Follow Semantic Versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

### Release Steps

1. **Prepare Release**
   ```bash
   # Create release branch
   git checkout -b release/v1.2.0 develop
   
   # Update version
   npm version minor
   
   # Update changelog
   npm run changelog
   ```

2. **Test Release**
   ```bash
   # Full test suite
   npm run test:all
   
   # Build all platforms
   npm run build:all
   
   # Test builds
   npm run test:dist
   ```

3. **Create Release**
   ```bash
   # Merge to main
   git checkout main
   git merge --no-ff release/v1.2.0
   git tag -a v1.2.0 -m "Release version 1.2.0"
   
   # Merge back to develop
   git checkout develop
   git merge --no-ff release/v1.2.0
   ```

4. **Publish Release**
   ```bash
   # Push to GitHub
   git push origin main develop --tags
   
   # Publish to npm (if applicable)
   npm publish
   
   # Upload binaries to GitHub Releases
   # Automated via CI/CD
   ```

### CI/CD Pipeline

GitHub Actions workflow:
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Package
        run: npm run dist
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist-${{ matrix.os }}
          path: dist/
          
  release:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v3
        
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist-*/*
          draft: false
          prerelease: false
```

## Best Practices

### Code Organization

1. **Single Responsibility**: Each module/component should have one clear purpose
2. **DRY**: Don't Repeat Yourself - extract common functionality
3. **KISS**: Keep It Simple, Stupid - avoid over-engineering
4. **YAGNI**: You Aren't Gonna Need It - don't add functionality until needed

### Security

1. **Input Validation**: Always validate user input
2. **Sanitization**: Sanitize data before output
3. **Authentication**: Use proper authentication mechanisms
4. **Secrets**: Never commit secrets to version control
5. **Dependencies**: Keep dependencies updated

### Documentation

1. **Code Comments**: Explain why, not what
2. **API Documentation**: Document all public APIs
3. **README Files**: Keep README files updated
4. **Examples**: Provide usage examples
5. **Changelog**: Maintain detailed changelog

### Performance

1. **Measure First**: Profile before optimizing
2. **Cache Wisely**: Cache expensive operations
3. **Async Operations**: Use async/await for I/O
4. **Batch Operations**: Batch database queries
5. **Resource Cleanup**: Always clean up resources