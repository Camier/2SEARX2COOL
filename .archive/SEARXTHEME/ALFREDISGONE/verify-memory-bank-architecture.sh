#!/bin/bash
# Memory Bank Architecture Verification Script
# Usage: ./verify_memory_bank.sh [--flexible]
# Run with --flexible to allow for variations in file names and locations

echo "Verifying Memory Bank Architecture Implementation..."
echo "----------------------------------------------------"
echo ""

# Initialize counters
total_checks=0
passed_checks=0

# Add a command-line parameter for strict/flexible mode
strict_mode=1  # Default to strict mode
if [ "$1" == "--flexible" ]; then
  strict_mode=0
  echo "Running in flexible verification mode..."
  echo "This will check for existence of key components without requiring exact names or locations."
  echo ""
fi

# Function to check if a file or directory exists (strict mode)
check_exists() {
  local item=$1
  local type=$2  # "file" or "directory"
  local description=$3
  
  total_checks=$((total_checks + 1))
  
  if [ "$type" == "directory" ]; then
    if [ -d "$item" ]; then
      echo "✅ PASS: $description ($item exists)"
      passed_checks=$((passed_checks + 1))
      return 0
    else
      echo "❌ FAIL: $description ($item does not exist)"
      return 1
    fi
  elif [ "$type" == "file" ]; then
    if [ -f "$item" ]; then
      echo "✅ PASS: $description ($item exists)"
      passed_checks=$((passed_checks + 1))
      return 0
    else
      echo "❌ FAIL: $description ($item does not exist)"
      return 1
    fi
  fi
}

# Function to check for a file flexibly (looks in subdirectories)
check_exists_flexible() {
  local pattern=$1
  local type=$2  # "file" or "directory"
  local description=$3
  
  total_checks=$((total_checks + 1))
  
  if [ "$type" == "file" ]; then
    if find . -type f -name "$pattern" | grep -q .; then
      echo "✅ PASS: $description (found matching $pattern)"
      passed_checks=$((passed_checks + 1))
      return 0
    else
      echo "❌ FAIL: $description (no file matching $pattern found)"
      return 1
    fi
  elif [ "$type" == "directory" ]; then
    if find . -type d -name "$pattern" | grep -q .; then
      echo "✅ PASS: $description (found matching $pattern)"
      passed_checks=$((passed_checks + 1))
      return 0
    else
      echo "❌ FAIL: $description (no directory matching $pattern found)"
      return 1
    fi
  fi
}

# Function to check if a file contains specific text
check_content() {
  local file=$1
  local search_text=$2
  local description=$3
  
  total_checks=$((total_checks + 1))
  
  if grep -q "$search_text" "$file" 2>/dev/null; then
    echo "✅ PASS: $description (found in $file)"
    passed_checks=$((passed_checks + 1))
    return 0
  else
    echo "❌ FAIL: $description (not found in $file)"
    return 1
  fi
}

# Function to check content flexibly
check_content_flexible() {
  local pattern=$1
  local search_text=$2
  local description=$3
  
  total_checks=$((total_checks + 1))
  
  found=0
  for file in $(find . -type f -name "$pattern"); do
    if grep -q "$search_text" "$file" 2>/dev/null; then
      echo "✅ PASS: $description (found in $file)"
      passed_checks=$((passed_checks + 1))
      found=1
      break
    fi
  done
  
  if [ $found -eq 0 ]; then
    echo "❌ FAIL: $description (not found in any matching file)"
    return 1
  fi
  
  return 0
}

# Check for main directories
echo "Checking main directories..."
if [ $strict_mode -eq 1 ]; then
  check_exists "docs" "directory" "Documentation directory"
  check_exists "scripts" "directory" "Scripts directory"
  check_exists "configs" "directory" "Configuration directory"
else
  check_exists_flexible "docs" "directory" "Documentation directory"
  check_exists_flexible "scripts" "directory" "Scripts directory"
  check_exists_flexible "configs" "directory" "Configuration directory"
fi
echo ""

# Check for README files
echo "Checking README files..."
if [ $strict_mode -eq 1 ]; then
  check_exists "docs/README.md" "file" "Documentation README"
  check_exists "scripts/README.md" "file" "Scripts README"
  check_exists "configs/README.md" "file" "Configurations README"
else
  check_exists_flexible "*/README.md" "file" "README files in directories"
fi
echo ""

# Check for critical files
echo "Checking critical files..."
if [ $strict_mode -eq 1 ]; then
  # Config files
  check_exists "configs/settings.yml" "file" "Settings configuration file"
  check_exists "configs/docker-compose.yml" "file" "Docker Compose configuration"
  
  # Script files
  check_exists "scripts/fix_browser_tests.sh" "file" "Browser tests setup script"
  check_exists "scripts/restart-searxng.sh" "file" "Service restart script"
  
  # Documentation files
  check_exists "docs/status_current.md" "file" "Current status document"
  check_exists "docs/guide_dev_environment.md" "file" "Development environment guide"
  check_exists "docs/guide_browser_testing.md" "file" "Browser testing guide"
  
  # Index file
  check_exists "INDEX.md" "file" "Navigation index file"
else
  # Check for config files flexibly
  check_exists_flexible "*settings*.yml" "file" "Settings configuration file"
  check_exists_flexible "*docker-compose*.yml" "file" "Docker Compose configuration"
  
  # Check for script files flexibly
  check_exists_flexible "*browser*test*.sh" "file" "Browser tests script"
  check_exists_flexible "*restart*.sh" "file" "Restart script"
  
  # Check for documentation files flexibly
  check_exists_flexible "*status*.md" "file" "Status document"
  check_exists_flexible "*dev*environment*.md" "file" "Development environment guide"
  check_exists_flexible "*browser*testing*.md" "file" "Browser testing guide"
  
  # Check for index file flexibly
  check_exists_flexible "*INDEX*.md" "file" "Navigation index file"
fi
echo ""

# Check INDEX.md content if it exists
index_file=""
if [ $strict_mode -eq 1 ]; then
  if [ -f "INDEX.md" ]; then
    index_file="INDEX.md"
  fi
else
  index_file=$(find . -name "*INDEX*.md" | head -n 1)
fi

if [ -n "$index_file" ]; then
  echo "Checking index file content..."
  if [ $strict_mode -eq 1 ]; then
    check_content "$index_file" "docs/status_current.md" "Reference to current status document"
    check_content "$index_file" "docs/guide_dev_environment.md" "Reference to development environment guide"
    check_content "$index_file" "docs/guide_browser_testing.md" "Reference to browser testing guide"
    check_content "$index_file" "configs/settings.yml" "Reference to settings configuration"
    check_content "$index_file" "configs/docker-compose.yml" "Reference to docker configuration"
    check_content "$index_file" "scripts/fix_browser_tests.sh" "Reference to browser tests script"
    check_content "$index_file" "scripts/restart-searxng.sh" "Reference to restart script"
  else
    check_content "$index_file" "status" "Reference to status document"
    check_content "$index_file" "environment" "Reference to environment guide"
    check_content "$index_file" "testing" "Reference to testing guide"
    check_content "$index_file" "settings" "Reference to settings configuration"
    check_content "$index_file" "docker" "Reference to docker configuration"
    check_content "$index_file" "test" "Reference to tests script"
    check_content "$index_file" "restart" "Reference to restart script"
  fi
  echo ""
fi

# Calculate success percentage
success_percentage=$((passed_checks * 100 / total_checks))

# Display summary
echo "Verification Summary"
echo "------------------"
echo "Total checks: $total_checks"
echo "Passed checks: $passed_checks"
echo "Success rate: $success_percentage%"
echo ""

# Provide overall assessment
if [ $success_percentage -eq 100 ]; then
  echo "🎉 VERIFICATION RESULT: COMPLETE SUCCESS"
  echo "The Memory Bank Architecture has been implemented correctly!"
elif [ $success_percentage -ge 80 ]; then
  echo "✅ VERIFICATION RESULT: MOSTLY SUCCESSFUL"
  echo "The Memory Bank Architecture has been implemented with minor issues."
  echo "Please review the failed checks and address them if necessary."
elif [ $success_percentage -ge 50 ]; then
  echo "⚠️ VERIFICATION RESULT: PARTIALLY SUCCESSFUL"
  echo "The Memory Bank Architecture has been partially implemented."
  echo "Several important elements are missing or incorrect."
  echo "Please review the failed checks and address them."
else
  echo "❌ VERIFICATION RESULT: IMPLEMENTATION FAILED"
  echo "The Memory Bank Architecture implementation has significant issues."
  echo "Most of the checks have failed. Please review the implementation."
fi