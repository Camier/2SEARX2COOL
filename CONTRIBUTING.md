# Contributing to 2SEARX2COOL

First off, thank you for considering contributing to 2SEARX2COOL! It's people like you that make 2SEARX2COOL such a great tool. We welcome contributions from everyone, regardless of their experience level.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Process](#development-process)
- [Style Guides](#style-guides)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by the [2SEARX2COOL Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@2searx2cool.org](mailto:conduct@2searx2cool.org).

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git
- Python 3.8+ (for node-gyp)
- Build tools:
  - **Windows**: `npm install -g windows-build-tools`
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `sudo apt-get install build-essential` (Debian/Ubuntu)

### Setting Up Your Development Environment

1. **Fork the Repository**
   - Go to [2SEARX2COOL repository](https://github.com/Camier/2SEARX2COOL)
   - Click the "Fork" button in the top right

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/2SEARX2COOL.git
   cd 2SEARX2COOL/2SEARX2COOL-refactored
   ```

3. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/Camier/2SEARX2COOL.git
   ```

4. **Install Dependencies**
   ```bash
   npm install
   ```

5. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

6. **Run Development Mode**
   ```bash
   npm run dev
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear and descriptive title**
- **Steps to reproduce** the behavior
- **Expected behavior** description
- **Screenshots** if applicable
- **System information**:
  - OS and version
  - Node.js version
  - Application version
  - Relevant hardware (for hardware-related issues)

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md).

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **Clear and descriptive title**
- **Detailed description** of the proposed feature
- **Use cases** and examples
- **Mockups or wireframes** if applicable
- **Alternative solutions** you've considered

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

### Code Contributions

#### First Time Contributors

Look for issues labeled with:
- `good first issue` - Simple issues perfect for beginners
- `help wanted` - Issues where we need community help
- `documentation` - Documentation improvements

#### Areas for Contribution

- **Core Features**: Search optimization, performance improvements
- **Plugin Development**: Create new plugins or improve existing ones
- **UI/UX**: Interface improvements and new components
- **Documentation**: Tutorials, guides, API documentation
- **Testing**: Unit tests, integration tests, E2E tests
- **Localization**: Translate the application to new languages

## Development Process

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions/changes
- `chore/description` - Maintenance tasks

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or changes
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

**Examples:**
```bash
feat(search): add fuzzy search support
fix(plugin): resolve memory leak in plugin loader
docs(api): update plugin API documentation
perf(startup): optimize module loading sequence
```

### Development Workflow

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clean, readable code
   - Follow the style guides
   - Add/update tests
   - Update documentation

3. **Test Your Changes**
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Keep Your Fork Updated**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

6. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

## Style Guides

### TypeScript Style Guide

We use ESLint and Prettier for code formatting. Key conventions:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Type annotations**: Always include types
- **File naming**: 
  - Components: `PascalCase.tsx`
  - Utilities: `camelCase.ts`
  - Constants: `UPPER_SNAKE_CASE.ts`

**Example:**
```typescript
import { EventEmitter } from 'events';

export interface SearchOptions {
  query: string;
  engines?: string[];
  limit?: number;
}

export class SearchManager extends EventEmitter {
  private cache: Map<string, SearchResult>;

  constructor() {
    super();
    this.cache = new Map();
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    // Implementation
  }
}
```

### React/JSX Style Guide

- Use functional components with hooks
- Use TypeScript for all components
- Extract complex logic to custom hooks
- Keep components small and focused

**Example:**
```tsx
import React, { useState, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = 'Search...' 
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  }, [query, onSearch]);

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
    </form>
  );
};
```

### CSS/Styling Guidelines

- Use CSS Modules for component styling
- Follow BEM naming convention for classes
- Use CSS variables for theming
- Ensure responsive design

### Documentation Style

- Use JSDoc for TypeScript documentation
- Include examples in documentation
- Keep README files up to date
- Document breaking changes

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

#### Unit Tests

Located in `test/unit/`. Test individual functions and classes.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SearchOptimizer } from '@/main/search/SearchOptimizer';

describe('SearchOptimizer', () => {
  it('should cache search results', async () => {
    // Test implementation
  });
});
```

#### Integration Tests

Located in `test/integration/`. Test interactions between modules.

#### E2E Tests

Located in `test/e2e/`. Test complete user workflows.

```typescript
import { test, expect } from '@playwright/test';

test('user can perform search', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="search-input"]', 'test query');
  await page.click('[data-testid="search-button"]');
  await expect(page.locator('[data-testid="results"]')).toBeVisible();
});
```

### Test Coverage

We aim for:
- **80%** overall coverage
- **90%** coverage for critical paths
- **100%** coverage for utility functions

## Pull Request Process

1. **Before Submitting**
   - [ ] Tests pass (`npm test`)
   - [ ] No TypeScript errors (`npm run typecheck`)
   - [ ] Code is linted (`npm run lint`)
   - [ ] Documentation is updated
   - [ ] Commit messages follow guidelines
   - [ ] Branch is up to date with main

2. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Screenshots (if applicable)
   
   ## Checklist
   - [ ] My code follows the style guidelines
   - [ ] I have performed a self-review
   - [ ] I have commented my code where necessary
   - [ ] I have updated the documentation
   - [ ] My changes generate no new warnings
   ```

3. **Review Process**
   - At least one maintainer review required
   - All CI checks must pass
   - No merge conflicts
   - Conversations resolved

4. **After Merge**
   - Delete your feature branch
   - Update your local main branch
   - Celebrate! 🎉

## Plugin Development

### Creating a Plugin

1. **Use the Plugin Template**
   ```bash
   npm run create-plugin my-plugin-name
   ```

2. **Follow Plugin Guidelines**
   - Keep plugins focused on a single feature
   - Use the provided APIs
   - Handle errors gracefully
   - Document your plugin thoroughly

3. **Submit to Plugin Registry**
   - Ensure plugin passes validation
   - Include screenshots/demo
   - Provide clear documentation

See the [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT.md) for details.

## Release Process

We use semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

Releases are automated through GitHub Actions when tags are pushed.

## Community

### Getting Help

- **Discord**: [Join our server](https://discord.gg/2searx2cool)
- **Discussions**: [GitHub Discussions](https://github.com/Camier/2SEARX2COOL/discussions)
- **Stack Overflow**: Tag questions with `2searx2cool`

### Ways to Contribute Beyond Code

- **Answer questions** in discussions
- **Review pull requests**
- **Improve documentation**
- **Share your plugins**
- **Report bugs**
- **Suggest features**
- **Help with translations**
- **Write tutorials**

## Recognition

Contributors are recognized in:
- [CONTRIBUTORS.md](CONTRIBUTORS.md) - All contributors
- Release notes - Per-release contributors
- Website - Major contributors
- README - Core team

## Questions?

Feel free to:
- Open an issue for clarification
- Ask in discussions
- Contact maintainers directly

Thank you for contributing to 2SEARX2COOL! 🎵

---

<div align="center">
  <sub>Happy coding! Remember, every contribution makes a difference.</sub>
</div>