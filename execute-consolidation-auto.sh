#!/bin/bash

# Execute Consolidation Script with Auto-Confirmation
# This wrapper bypasses interactive prompts for automated execution

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Log file for tracking
LOG_FILE="consolidation_$(date +%Y%m%d_%H%M%S).log"

echo -e "${GREEN}=== Consolidation Execution Wrapper ===${NC}"
echo "Log file: $LOG_FILE"
echo ""

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Check if consolidation script exists
if [[ ! -f "consolidate_python_projects.sh" ]]; then
    log "${RED}ERROR: consolidate_python_projects.sh not found!${NC}"
    exit 1
fi

# Make sure the script is executable
chmod +x consolidate_python_projects.sh

log "${GREEN}Starting automated consolidation...${NC}"
log "Services are running but backup exists - proceeding safely"
log ""

# Execute the consolidation script with 'yes' piped to handle prompts
# Also capture both stdout and stderr
if yes | ./consolidate_python_projects.sh 2>&1 | tee -a "$LOG_FILE"; then
    log ""
    log "${GREEN}✓ Consolidation completed successfully!${NC}"
    
    # Show summary of what was done
    echo -e "\n${YELLOW}=== Consolidation Summary ===${NC}"
    
    # Check if the PYTHON directory was created
    if [[ -d "PYTHON" ]]; then
        echo "✓ PYTHON directory created"
        echo "  Contents:"
        find PYTHON -maxdepth 2 -type d | sort | sed 's/^/    /'
    fi
    
    # Check for any errors in the log
    if grep -i "error" "$LOG_FILE" > /dev/null 2>&1; then
        echo -e "\n${YELLOW}⚠ Warning: Some errors were logged. Review the log file for details.${NC}"
    fi
    
    # Show final statistics
    echo -e "\n${GREEN}Statistics:${NC}"
    echo "- Python files moved: $(find PYTHON -name "*.py" 2>/dev/null | wc -l || echo 0)"
    echo "- Directories consolidated: $(find PYTHON -maxdepth 1 -type d | wc -l || echo 0)"
    echo "- Log file: $LOG_FILE"
    
else
    log "${RED}✗ Consolidation failed!${NC}"
    log "Check the log file for details: $LOG_FILE"
    exit 1
fi

# Optional: Show the last few lines of the log
echo -e "\n${YELLOW}=== Last 10 log entries ===${NC}"
tail -10 "$LOG_FILE"

echo -e "\n${GREEN}Done! Full log available at: $LOG_FILE${NC}"