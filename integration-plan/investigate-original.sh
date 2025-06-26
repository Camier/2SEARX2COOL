#!/bin/bash
# Investigation script for understanding the original 2SEARX2COOL setup

set -e

echo "🔍 2SEARX2COOL Original System Investigation"
echo "==========================================="

ORIGINAL_DIR="/home/mik/SEARXNG/2SEARX2COOL"
REPORT_DIR="./integration-plan/investigation-results"

# Create report directory
mkdir -p "$REPORT_DIR"

echo ""
echo "📁 1. Directory Structure Analysis..."
echo "-------------------------------------"

# Map directory structure
echo "Mapping directory structure..."
tree -d -L 3 "$ORIGINAL_DIR" > "$REPORT_DIR/directory-structure.txt" 2>/dev/null || \
    find "$ORIGINAL_DIR" -type d -not -path "*/node_modules/*" -not -path "*/__pycache__/*" | \
    sort > "$REPORT_DIR/directory-structure.txt"

# Find key directories
echo "Finding key directories..."
{
    echo "Virtual Environments:"
    find "$ORIGINAL_DIR" -name "*venv*" -type d 2>/dev/null
    echo ""
    echo "Configuration Directories:"
    find "$ORIGINAL_DIR" -name "config*" -type d 2>/dev/null
    echo ""
    echo "Log Directories:"
    find "$ORIGINAL_DIR" -name "log*" -type d 2>/dev/null
} > "$REPORT_DIR/key-directories.txt"

echo ""
echo "📄 2. Configuration Files Audit..."
echo "----------------------------------"

# Find all configuration files
echo "Finding configuration files..."
{
    echo "YAML Files:"
    find "$ORIGINAL_DIR" -name "*.yml" -o -name "*.yaml" 2>/dev/null | grep -v node_modules
    echo ""
    echo "JSON Files:"
    find "$ORIGINAL_DIR" -name "*.json" 2>/dev/null | grep -v node_modules | grep -v package
    echo ""
    echo "Environment Files:"
    find "$ORIGINAL_DIR" -name ".env*" -o -name "*.env" 2>/dev/null
    echo ""
    echo "INI Files:"
    find "$ORIGINAL_DIR" -name "*.ini" 2>/dev/null
} > "$REPORT_DIR/config-files.txt"

echo ""
echo "🐍 3. Python Environment Analysis..."
echo "------------------------------------"

# Analyze Python requirements
echo "Finding requirements files..."
{
    echo "Requirements Files:"
    find "$ORIGINAL_DIR" -name "requirements*.txt" -o -name "Pipfile" 2>/dev/null
    echo ""
    echo "Setup Files:"
    find "$ORIGINAL_DIR" -name "setup.py" -o -name "setup.cfg" 2>/dev/null
} > "$REPORT_DIR/python-deps.txt"

# Check for virtual environments
echo "Checking virtual environments..."
{
    echo "Virtual Environment Details:"
    for venv in $(find "$ORIGINAL_DIR" -name "*venv*" -type d 2>/dev/null); do
        echo ""
        echo "Environment: $venv"
        if [ -f "$venv/bin/python" ]; then
            echo "Python Version: $($venv/bin/python --version 2>&1)"
            echo "Pip Packages:"
            $venv/bin/pip list 2>/dev/null | head -20 || echo "Could not list packages"
        fi
    done
} > "$REPORT_DIR/venv-analysis.txt"

echo ""
echo "🚀 4. Startup Scripts Analysis..."
echo "---------------------------------"

# Find startup scripts
echo "Finding startup scripts..."
{
    echo "Shell Scripts:"
    find "$ORIGINAL_DIR" -name "start*.sh" -o -name "run*.sh" 2>/dev/null
    echo ""
    echo "Python Scripts:"
    find "$ORIGINAL_DIR" -name "start*.py" -o -name "run*.py" -o -name "main.py" 2>/dev/null
    echo ""
    echo "Service Files:"
    find "$ORIGINAL_DIR" -name "*.service" 2>/dev/null
} > "$REPORT_DIR/startup-scripts.txt"

echo ""
echo "🔗 5. Service Communication Analysis..."
echo "---------------------------------------"

# Analyze service configurations
echo "Analyzing service configurations..."
{
    echo "Port Configurations (from files):"
    grep -r "port.*[0-9]\{4\}" "$ORIGINAL_DIR" --include="*.yml" --include="*.yaml" \
         --include="*.json" --include="*.py" --include="*.sh" 2>/dev/null | \
         grep -E "(8888|8889|8095|6379|5432)" | head -20 || echo "No port configs found"
    
    echo ""
    echo "API Endpoints:"
    grep -r "http://\|https://" "$ORIGINAL_DIR" --include="*.py" --include="*.js" \
         --include="*.ts" 2>/dev/null | grep -E "(localhost|127.0.0.1)" | head -20 || \
         echo "No API endpoints found"
} > "$REPORT_DIR/service-communication.txt"

echo ""
echo "🎵 6. Music Engine Analysis..."
echo "------------------------------"

# Analyze engines
echo "Analyzing music engines..."
{
    echo "Engine Files:"
    ls -la "$ORIGINAL_DIR/engines/"*.py 2>/dev/null | wc -l
    echo ""
    echo "Engine List:"
    ls "$ORIGINAL_DIR/engines/"*.py 2>/dev/null | grep -v __pycache__ | grep -v __init__
    echo ""
    echo "Base Classes:"
    grep -l "class.*Engine" "$ORIGINAL_DIR/engines/"*.py 2>/dev/null | head -10
} > "$REPORT_DIR/engine-analysis.txt"

echo ""
echo "📊 7. Import Structure Analysis..."
echo "----------------------------------"

# Analyze imports
echo "Analyzing Python imports..."
{
    echo "Unique Import Patterns:"
    grep -h "^from\|^import" "$ORIGINAL_DIR"/**/*.py 2>/dev/null | \
         grep -E "(searx|orchestrator|engines)" | sort | uniq | head -30
    echo ""
    echo "Relative Imports:"
    grep -h "from \." "$ORIGINAL_DIR"/**/*.py 2>/dev/null | sort | uniq | head -20
} > "$REPORT_DIR/import-analysis.txt"

echo ""
echo "📝 8. Documentation Review..."
echo "-----------------------------"

# Find documentation
echo "Finding documentation..."
{
    echo "README Files:"
    find "$ORIGINAL_DIR" -name "README*" -o -name "readme*" 2>/dev/null
    echo ""
    echo "Documentation Files:"
    find "$ORIGINAL_DIR" -name "*.md" 2>/dev/null | grep -E "(INSTALL|SETUP|CONFIG|ARCH)" | head -20
} > "$REPORT_DIR/documentation.txt"

echo ""
echo "✅ Investigation Complete!"
echo ""
echo "📁 Results saved to: $REPORT_DIR/"
echo ""
echo "Key files to review:"
echo "  - directory-structure.txt"
echo "  - config-files.txt"
echo "  - startup-scripts.txt"
echo "  - service-communication.txt"
echo ""
echo "Next step: Review these findings to understand the system architecture"