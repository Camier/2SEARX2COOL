#!/bin/bash

# SearXNG 2SEARX2COOL Test Runner
# Consolidated test runner for all test types

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="${PROJECT_ROOT}/tests"
RESULTS_DIR="${PROJECT_ROOT}/test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  SearXNG 2SEARX2COOL Test Suite${NC}"
echo -e "${BLUE}======================================${NC}"
echo "Test run started at: $(date)"
echo "Project root: $PROJECT_ROOT"
echo "Results directory: $RESULTS_DIR"
echo ""

# Function to run unit tests
run_unit_tests() {
    echo -e "${YELLOW}Running Unit Tests...${NC}"
    cd "$PROJECT_ROOT"
    
    if command -v pytest &> /dev/null; then
        echo "Using pytest for unit tests"
        if pytest tests/unit/ -v --tb=short --json-report --json-report-file="$RESULTS_DIR/unit-tests-$TIMESTAMP.json"; then
            echo -e "${GREEN}Unit tests passed${NC}"
            return 0
        else
            echo -e "${RED}Unit tests failed${NC}"
            return 1
        fi
    else
        echo "pytest not found, running with python -m unittest"
        if python -m unittest discover -s tests/unit -p "test_*.py" -v; then
            echo -e "${GREEN}Unit tests passed${NC}"
            return 0
        else
            echo -e "${RED}Unit tests failed${NC}"
            return 1
        fi
    fi
}

# Function to run integration tests
run_integration_tests() {
    echo -e "${YELLOW}Running Integration Tests...${NC}"
    cd "$PROJECT_ROOT"
    
    # Check if SearXNG is running
    if ! curl -s http://localhost:8888 > /dev/null; then
        echo -e "${RED}Warning: SearXNG not running on localhost:8888${NC}"
        echo "Some integration tests may fail"
    fi
    
    local passed=0
    local total=0
    
    # Run comprehensive music engine tests
    if [[ -f "tests/integration/test_music_engines.py" ]]; then
        echo "Running comprehensive music engine test framework..."
        ((total++))
        if python tests/integration/test_music_engines.py > "$RESULTS_DIR/integration-music-engines-$TIMESTAMP.log" 2>&1; then
            echo -e "${GREEN}Music engine framework tests passed${NC}"
            ((passed++))
        else
            echo -e "${RED}Music engine framework tests failed${NC}"
            echo "Check log: $RESULTS_DIR/integration-music-engines-$TIMESTAMP.log"
        fi
    fi
    
    # Run simple engine tests
    if [[ -f "tests/integration/test_all_music_engines.py" ]]; then
        echo "Running simple music engine tests..."
        ((total++))
        if python tests/integration/test_all_music_engines.py > "$RESULTS_DIR/integration-simple-engines-$TIMESTAMP.log" 2>&1; then
            echo -e "${GREEN}Simple engine tests passed${NC}"
            ((passed++))
        else
            echo -e "${RED}Simple engine tests failed${NC}"
            echo "Check log: $RESULTS_DIR/integration-simple-engines-$TIMESTAMP.log"
        fi
    fi
    
    if [[ $passed -eq $total ]]; then
        echo -e "${GREEN}All integration tests passed ($passed/$total)${NC}"
        return 0
    else
        echo -e "${RED}Some integration tests failed ($passed/$total)${NC}"
        return 1
    fi
}

# Function to run engine tests
run_engine_tests() {
    echo -e "${YELLOW}Running Engine Tests...${NC}"
    cd "$PROJECT_ROOT"
    
    local passed=0
    local total=0
    
    # Run shell-based engine tests
    for test_script in tests/engines/*.sh; do
        if [[ -f "$test_script" ]]; then
            local script_name=$(basename "$test_script")
            echo "Running $script_name..."
            ((total++))
            
            if bash "$test_script" > "$RESULTS_DIR/engine-${script_name%.*}-$TIMESTAMP.log" 2>&1; then
                echo -e "${GREEN}$script_name passed${NC}"
                ((passed++))
            else
                echo -e "${RED}$script_name failed${NC}"
                echo "Check log: $RESULTS_DIR/engine-${script_name%.*}-$TIMESTAMP.log"
            fi
        fi
    done
    
    # Run Python-based engine tests
    for test_script in tests/engines/*.py; do
        if [[ -f "$test_script" ]]; then
            local script_name=$(basename "$test_script")
            echo "Running $script_name..."
            ((total++))
            
            if python "$test_script" > "$RESULTS_DIR/engine-${script_name%.*}-$TIMESTAMP.log" 2>&1; then
                echo -e "${GREEN}$script_name passed${NC}"
                ((passed++))
            else
                echo -e "${RED}$script_name failed${NC}"
                echo "Check log: $RESULTS_DIR/engine-${script_name%.*}-$TIMESTAMP.log"
            fi
        fi
    done
    
    if [[ $total -eq 0 ]]; then
        echo -e "${YELLOW}No engine tests found${NC}"
        return 0
    elif [[ $passed -eq $total ]]; then
        echo -e "${GREEN}All engine tests passed ($passed/$total)${NC}"
        return 0
    else
        echo -e "${RED}Some engine tests failed ($passed/$total)${NC}"
        return 1
    fi
}

# Function to generate test report
generate_report() {
    local unit_result=$1
    local integration_result=$2
    local engine_result=$3
    
    local report_file="$RESULTS_DIR/test-report-$TIMESTAMP.txt"
    
    echo "SearXNG 2SEARX2COOL Test Report" > "$report_file"
    echo "=================================" >> "$report_file"
    echo "Test run: $(date)" >> "$report_file"
    echo "Project: $PROJECT_ROOT" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "Test Results:" >> "$report_file"
    echo "=============" >> "$report_file"
    
    if [[ $unit_result -eq 0 ]]; then
        echo "Unit Tests: PASSED" >> "$report_file"
    else
        echo "Unit Tests: FAILED" >> "$report_file"
    fi
    
    if [[ $integration_result -eq 0 ]]; then
        echo "Integration Tests: PASSED" >> "$report_file"
    else
        echo "Integration Tests: FAILED" >> "$report_file"
    fi
    
    if [[ $engine_result -eq 0 ]]; then
        echo "Engine Tests: PASSED" >> "$report_file"
    else
        echo "Engine Tests: FAILED" >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    echo "Detailed logs available in: $RESULTS_DIR" >> "$report_file"
    
    echo "Test report generated: $report_file"
}

# Main execution
main() {
    local run_unit=true
    local run_integration=true
    local run_engines=true
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                run_integration=false
                run_engines=false
                shift
                ;;
            --integration-only)
                run_unit=false
                run_engines=false
                shift
                ;;
            --engines-only)
                run_unit=false
                run_integration=false
                shift
                ;;
            --skip-unit)
                run_unit=false
                shift
                ;;
            --skip-integration)
                run_integration=false
                shift
                ;;
            --skip-engines)
                run_engines=false
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --unit-only          Run only unit tests"
                echo "  --integration-only   Run only integration tests"
                echo "  --engines-only       Run only engine tests"
                echo "  --skip-unit          Skip unit tests"
                echo "  --skip-integration   Skip integration tests"
                echo "  --skip-engines       Skip engine tests"
                echo "  -v, --verbose        Verbose output"
                echo "  -h, --help           Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    local unit_result=0
    local integration_result=0
    local engine_result=0
    
    # Run tests based on options
    if [[ $run_unit == true ]]; then
        echo ""
        run_unit_tests
        unit_result=$?
    fi
    
    if [[ $run_integration == true ]]; then
        echo ""
        run_integration_tests
        integration_result=$?
    fi
    
    if [[ $run_engines == true ]]; then
        echo ""
        run_engine_tests
        engine_result=$?
    fi
    
    # Generate report
    echo ""
    generate_report $unit_result $integration_result $engine_result
    
    # Final summary
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  Test Run Summary${NC}"
    echo -e "${BLUE}======================================${NC}"
    
    local total_failed=0
    
    if [[ $run_unit == true ]]; then
        if [[ $unit_result -eq 0 ]]; then
            echo -e "Unit Tests: ${GREEN}PASSED${NC}"
        else
            echo -e "Unit Tests: ${RED}FAILED${NC}"
            ((total_failed++))
        fi
    fi
    
    if [[ $run_integration == true ]]; then
        if [[ $integration_result -eq 0 ]]; then
            echo -e "Integration Tests: ${GREEN}PASSED${NC}"
        else
            echo -e "Integration Tests: ${RED}FAILED${NC}"
            ((total_failed++))
        fi
    fi
    
    if [[ $run_engines == true ]]; then
        if [[ $engine_result -eq 0 ]]; then
            echo -e "Engine Tests: ${GREEN}PASSED${NC}"
        else
            echo -e "Engine Tests: ${RED}FAILED${NC}"
            ((total_failed++))
        fi
    fi
    
    echo ""
    echo "Test run completed at: $(date)"
    echo "Results directory: $RESULTS_DIR"
    
    if [[ $total_failed -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}$total_failed test suite(s) failed${NC}"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"