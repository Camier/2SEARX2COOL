#!/bin/bash

# Development Environment Setup Script
# Sets up the complete development tooling environment

set -e

echo "🚀 Setting up Development Environment..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}❌ Node.js version 16 or higher required${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js version check passed${NC}"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Set up Husky
echo ""
echo "🐶 Setting up Husky..."
npx husky install

# Create git hooks
echo ""
echo "🪝 Creating git hooks..."
npm run dev:hooks

# Create necessary directories
echo ""
echo "📁 Creating project structure..."
mkdir -p test/unit
mkdir -p test/integration
mkdir -p test/e2e
mkdir -p coverage
mkdir -p .quality-metrics
mkdir -p .performance
mkdir -p build-reports
mkdir -p test-reports

# Initialize TypeScript paths
echo ""
echo "🔧 Configuring TypeScript paths..."
cat > tsconfig.paths.json << EOF
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@preload/*": ["src/preload/*"]
    }
  }
}
EOF

# Create initial test structure
echo ""
echo "🧪 Creating test structure..."

# Unit test example
cat > test/unit/example.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
EOF

# Integration test example
cat > test/integration/example.test.ts << 'EOF'
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Integration Example', () => {
  beforeAll(async () => {
    // Setup
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should integrate components', async () => {
    expect(true).toBe(true);
  });
});
EOF

# E2E test setup
cat > test/e2e/example.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test.describe('E2E Example', () => {
  test('should load application', async ({ page }) => {
    // E2E test will be configured after app structure is ready
    expect(true).toBe(true);
  });
});
EOF

# Create development scripts
echo ""
echo "📝 Creating development scripts..."

# Quick start script
cat > scripts/quick-start.sh << 'EOF'
#!/bin/bash

echo "🚀 Quick Start Development Environment"
echo ""

# Start all services
echo "Starting development services..."

# Start performance dashboard in background
npm run perf:dashboard &
PERF_PID=$!

# Start development server
npm run dev &
DEV_PID=$!

echo ""
echo "✅ Development environment started!"
echo ""
echo "📊 Performance Dashboard: http://localhost:8093"
echo "🖥️  Application: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and handle shutdown
trap "kill $PERF_PID $DEV_PID 2>/dev/null" EXIT
wait
EOF

chmod +x scripts/quick-start.sh

# Create workflow automation
cat > scripts/dev-workflow.sh << 'EOF'
#!/bin/bash

echo "🔄 Development Workflow Automation"
echo ""

# Run quality checks
echo "📊 Running code quality analysis..."
npm run quality

# Run tests
echo "🧪 Running tests..."
npm run test:coverage

# Check build
echo "🏗️ Checking build..."
npm run build

# Generate reports
echo "📈 Generating reports..."
npm run test:auto report
npm run build:analyze

echo ""
echo "✅ Workflow completed!"
EOF

chmod +x scripts/dev-workflow.sh

# Create environment check script
cat > scripts/check-env.sh << 'EOF'
#!/bin/bash

echo "🔍 Checking Development Environment..."
echo ""

# Function to check command
check_command() {
    if command -v $1 &> /dev/null; then
        echo "✅ $1: $(command -v $1)"
    else
        echo "❌ $1: Not found"
        return 1
    fi
}

# Check required tools
check_command node
check_command npm
check_command git
check_command python3

# Check optional tools
echo ""
echo "Optional tools:"
check_command docker || echo "   (Optional for containerized testing)"
check_command rg || echo "   (Ripgrep for fast searching)"

# Check Node modules
echo ""
echo "📦 Checking key dependencies..."
[ -f "node_modules/typescript/bin/tsc" ] && echo "✅ TypeScript" || echo "❌ TypeScript"
[ -f "node_modules/eslint/bin/eslint.js" ] && echo "✅ ESLint" || echo "❌ ESLint"
[ -f "node_modules/vitest/dist/cli.js" ] && echo "✅ Vitest" || echo "❌ Vitest"
[ -f "node_modules/@playwright/test/cli.js" ] && echo "✅ Playwright" || echo "❌ Playwright"

echo ""
echo "Done!"
EOF

chmod +x scripts/check-env.sh

# Create VS Code workspace settings
echo ""
echo "📝 Creating VS Code settings..."
mkdir -p .vscode

cat > .vscode/settings.json << 'EOF'
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/out": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/out": true,
    "**/coverage": true,
    "**/*.log": true
  },
  "jest.autoRun": "off",
  "testing.automaticallyOpenPeekView": "never"
}
EOF

cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "christian-kohler.path-intellisense",
    "aaron-bond.better-comments",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens",
    "wix.vscode-import-cost",
    "yoavbls.pretty-ts-errors",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright"
  ]
}
EOF

cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "args": ["."],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "envFile": "${workspaceFolder}/.env",
      "sourceMaps": true
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": [
        "${workspaceFolder}",
        "--remote-debugging-port=9223"
      ],
      "webRoot": "${workspaceFolder}",
      "timeout": 30000
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${file}"],
      "console": "integratedTerminal"
    }
  ],
  "compounds": [
    {
      "name": "Debug All",
      "configurations": ["Debug Main Process", "Debug Renderer Process"]
    }
  ]
}
EOF

# Create README for dev tools
cat > scripts/dev-tools/README.md << 'EOF'
# Development Tooling

This directory contains advanced development tools for the SearXNG project.

## Available Tools

### 🔧 Refactoring System
- Multi-worker intelligent refactoring
- Automated code generation
- Dependency management
- `npm run refactor`

### 📊 Code Quality Monitor
- Real-time quality metrics
- Coverage tracking
- Complexity analysis
- `npm run quality`

### ⚡ Performance Monitor
- Build performance tracking
- Runtime metrics
- Visual dashboards
- `npm run perf:dashboard`

### 🧪 Test Automation
- Automatic test generation
- Coverage optimization
- E2E test setup
- `npm run test:auto`

### 📦 Build Optimizer
- Bundle analysis
- Code splitting
- Asset optimization
- `npm run build:analyze`

## Quick Commands

```bash
# Run full development suite
npm run dev:full

# Check environment health
npm run dev:health

# Interactive mode
npm run dev-tools interactive

# Quick start everything
./scripts/quick-start.sh
```

## Workflows

### Daily Development
1. `npm run dev` - Start development
2. `npm run quality:watch` - Monitor quality
3. `npm run test -- --watch` - Run tests

### Before Commit
1. `npm run dev:full` - Full suite check
2. `npm run build` - Verify build
3. Git hooks will handle the rest

### Performance Optimization
1. `npm run build:analyze` - Analyze bundle
2. `npm run build:optimize` - Apply optimizations
3. `npm run perf:dashboard` - Monitor results
EOF

echo ""
echo -e "${GREEN}✅ Development environment setup complete!${NC}"
echo ""
echo "📚 Next steps:"
echo "  1. Run ${YELLOW}npm run dev:health${NC} to verify setup"
echo "  2. Run ${YELLOW}npm run dev-tools${NC} to see all available commands"
echo "  3. Run ${YELLOW}./scripts/quick-start.sh${NC} to start development"
echo ""
echo "📖 See scripts/dev-tools/README.md for detailed documentation"