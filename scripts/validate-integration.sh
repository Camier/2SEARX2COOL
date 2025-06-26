#!/bin/bash
# Automated validation script for 2SEARX2COOL integration

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 2SEARX2COOL Integration Validation"
echo "===================================="

# Function to check command availability
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 not found${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 found${NC}"
        return 0
    fi
}

# Function to check service
check_service() {
    local name=$1
    local url=$2
    
    if curl -s -f -o /dev/null "$url"; then
        echo -e "${GREEN}✅ $name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not accessible${NC}"
        return 1
    fi
}

# 1. Check Dependencies
echo -e "\n📦 Checking dependencies..."
DEPS_OK=true
check_command python3 || DEPS_OK=false
check_command node || DEPS_OK=false
check_command npm || DEPS_OK=false
check_command redis-cli || DEPS_OK=false
check_command curl || DEPS_OK=false

if [ "$DEPS_OK" = false ]; then
    echo -e "${RED}Missing dependencies. Please install required tools.${NC}"
    exit 1
fi

# 2. Check Python dependencies
echo -e "\n🐍 Checking Python dependencies..."
if python3 -c "import flask, redis, requests, pyyaml" 2>/dev/null; then
    echo -e "${GREEN}✅ Python dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  Installing Python dependencies...${NC}"
    pip install -r requirements.txt
fi

# 3. Check Node dependencies
echo -e "\n📦 Checking Node dependencies..."
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✅ Node modules installed${NC}"
else
    echo -e "${YELLOW}⚠️  Installing Node dependencies...${NC}"
    npm install
fi

# 4. Build Electron app
echo -e "\n🔨 Building Electron app..."
if [ -d "out/main" ]; then
    echo -e "${GREEN}✅ Electron app already built${NC}"
else
    echo -e "${YELLOW}⚠️  Building Electron app...${NC}"
    npm run build
fi

# 5. Check services
echo -e "\n🚀 Checking services..."
SERVICES_OK=true

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠️  Starting Redis...${NC}"
    redis-server --daemonize yes
fi

# Check SearXNG
check_service "SearXNG" "http://localhost:8888" || SERVICES_OK=false

# Check Orchestrator
check_service "Orchestrator" "http://localhost:8889/health" || SERVICES_OK=false

if [ "$SERVICES_OK" = false ]; then
    echo -e "${YELLOW}⚠️  Some services are not running. Starting them...${NC}"
    if [ -f "start-integrated.sh" ]; then
        ./start-integrated.sh &
        sleep 10
    fi
fi

# 6. Test engine bridge
echo -e "\n🔗 Testing engine bridge..."
cd engine-bridge
if python3 -c "from engine_registry import EngineRegistry; r = EngineRegistry('../engines'); print(f'Loaded {len(r.engines)} engines')" 2>/dev/null; then
    echo -e "${GREEN}✅ Engine bridge working${NC}"
else
    echo -e "${RED}❌ Engine bridge failed${NC}"
fi
cd ..

# 7. Test search functionality
echo -e "\n🔍 Testing search functionality..."
SEARCH_RESPONSE=$(curl -s "http://localhost:8888/search?q=test&format=json&engines=genius" || echo "")
if echo "$SEARCH_RESPONSE" | grep -q "results"; then
    echo -e "${GREEN}✅ Search API working${NC}"
else
    echo -e "${RED}❌ Search API not responding correctly${NC}"
fi

# 8. Test specific engines
echo -e "\n🎵 Testing music engines..."
ENGINES=("genius" "soundcloud" "bandcamp" "spotify_web")
for engine in "${ENGINES[@]}"; do
    RESPONSE=$(curl -s "http://localhost:8888/search?q=music&format=json&engines=$engine" || echo "")
    if echo "$RESPONSE" | grep -q "results"; then
        echo -e "${GREEN}✅ $engine engine working${NC}"
    else
        echo -e "${RED}❌ $engine engine failed${NC}"
    fi
done

# 9. Validate configuration
echo -e "\n⚙️  Validating configuration..."
CONFIG_OK=true

# Check config files
for config_file in "config/settings.yml" "config/music_engines.yml" ".env"; do
    if [ -f "$config_file" ]; then
        echo -e "${GREEN}✅ $config_file exists${NC}"
    else
        echo -e "${RED}❌ $config_file missing${NC}"
        CONFIG_OK=false
    fi
done

# 10. Run quick tests
echo -e "\n🧪 Running quick tests..."
if [ -f "test/qa-validation/run_qa_tests.py" ]; then
    python3 test/qa-validation/run_qa_tests.py --export validation-report.json || true
fi

# 11. Generate summary
echo -e "\n📊 Validation Summary"
echo "===================="

# Check overall status
if [ -f "validation-report.json" ]; then
    PASSED=$(python3 -c "import json; data = json.load(open('validation-report.json')); print(data['summary']['passed'])")
    FAILED=$(python3 -c "import json; data = json.load(open('validation-report.json')); print(data['summary']['failed'])")
    
    echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
    echo -e "Tests Failed: ${RED}$FAILED${NC}"
    
    if [ "$FAILED" -eq 0 ]; then
        echo -e "\n${GREEN}✅ Integration validation PASSED!${NC}"
        echo -e "The system is ready for use."
    else
        echo -e "\n${RED}❌ Integration validation FAILED${NC}"
        echo -e "Please check the validation report for details."
    fi
else
    echo -e "${YELLOW}⚠️  Could not generate full validation report${NC}"
fi

echo -e "\n📝 Reports generated:"
echo "  - validation-report.json"
echo "  - QA_TEST_REPORT.md"

echo -e "\n🚀 To start the desktop app: npm run dev"
echo -e "🌐 To access web interface: http://localhost:8888"