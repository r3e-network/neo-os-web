#!/bin/bash

# run_all_security_tests.sh - Master script to run all security tests
# This script orchestrates the execution of all security testing scripts

set -e

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Define output directory
OUTPUT_DIR="./security-reports"
mkdir -p "$OUTPUT_DIR"

# Define log file
LOG_FILE="$OUTPUT_DIR/security_scan_results.log"
> "$LOG_FILE" # Clear log file

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to run a security script and check result
run_security_script() {
    local script=$1
    local description=$2
    
    log "\n${YELLOW}===== Running $description =====${NC}"
    
    # Make script executable
    chmod +x "scripts/security/$script"
    
    # Run the script
    if "scripts/security/$script" 2>&1 | tee -a "$LOG_FILE"; then
        log "${GREEN}✓ $description completed successfully${NC}"
        return 0
    else
        log "${RED}✗ $description failed - see log for details${NC}"
        return 1
    fi
}

log "${YELLOW}===== Starting Comprehensive Security Testing Suite =====${NC}"
log "Date: $(date)"
log "Repository: Neo N3 Service Layer"

# Track failures
FAILURES=0

# Run Go security checks
if ! run_security_script "run_gosec.sh" "Go Security Scanning"; then
    FAILURES=$((FAILURES+1))
fi

# Run dependency vulnerability scanning
if ! run_security_script "scan_dependencies.sh" "Dependency Vulnerability Scanning"; then
    FAILURES=$((FAILURES+1))
fi

# Run secret detection
if ! run_security_script "detect_secrets.sh" "Secret and Credential Detection"; then
    FAILURES=$((FAILURES+1))
fi

# Run ZAP API scanning (only if API server is running)
if curl -s "http://localhost:8080/health" > /dev/null; then
    if ! run_security_script "run_zap_scan.sh" "OWASP ZAP API Security Scanning"; then
        FAILURES=$((FAILURES+1))
    fi
else
    log "\n${YELLOW}⚠ Skipping API Security Scanning - API server not detected${NC}"
    log "Start the API server with 'make run-api' to include API security scans"
fi

# Run unit tests with security focus
log "\n${YELLOW}===== Running Security-Focused Unit Tests =====${NC}"
if go test -v ./test/security/... -coverprofile="$OUTPUT_DIR/security_test_coverage.out" 2>&1 | tee -a "$LOG_FILE"; then
    log "${GREEN}✓ Security unit tests passed${NC}"
    
    # Generate coverage report
    go tool cover -html="$OUTPUT_DIR/security_test_coverage.out" -o "$OUTPUT_DIR/security_test_coverage.html"
    log "Coverage report generated at $OUTPUT_DIR/security_test_coverage.html"
else
    log "${RED}✗ Security unit tests failed${NC}"
    FAILURES=$((FAILURES+1))
fi

# Generate summary report
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
SUMMARY_FILE="$OUTPUT_DIR/security_summary.md"

cat > "$SUMMARY_FILE" << EOF
# Security Testing Summary

**Date:** $TIMESTAMP

## Overview

This report summarizes the results of automated security testing for the Neo N3 Service Layer.

## Test Results

| Test Type | Status | Details |
|-----------|--------|---------|
EOF

# Add results to summary
if grep -q "No high severity security issues found" "$LOG_FILE"; then
    echo "| Go Security Scanning | ✅ Pass | No high severity issues found |" >> "$SUMMARY_FILE"
else
    echo "| Go Security Scanning | ❌ Fail | High severity issues detected |" >> "$SUMMARY_FILE"
fi

if grep -q "No high severity vulnerabilities found" "$LOG_FILE"; then
    echo "| Dependency Scanning | ✅ Pass | No high severity vulnerabilities found |" >> "$SUMMARY_FILE"
else
    echo "| Dependency Scanning | ❌ Fail | High severity vulnerabilities detected |" >> "$SUMMARY_FILE"
fi

if grep -q "No obvious secrets or credentials found" "$LOG_FILE"; then
    echo "| Secret Detection | ✅ Pass | No secrets or credentials found |" >> "$SUMMARY_FILE"
else
    echo "| Secret Detection | ❌ Fail | Potential secrets detected |" >> "$SUMMARY_FILE"
fi

if grep -q "Security unit tests passed" "$LOG_FILE"; then
    echo "| Security Unit Tests | ✅ Pass | All tests passed |" >> "$SUMMARY_FILE"
else
    echo "| Security Unit Tests | ❌ Fail | Some tests failed |" >> "$SUMMARY_FILE"
fi

if grep -q "No high severity security issues found" "$LOG_FILE" && grep -q "OWASP ZAP API Security Scanning" "$LOG_FILE"; then
    echo "| API Security Scanning | ✅ Pass | No high severity issues found |" >> "$SUMMARY_FILE"
elif grep -q "Skipping API Security Scanning" "$LOG_FILE"; then
    echo "| API Security Scanning | ⚠️ Skipped | API server not running |" >> "$SUMMARY_FILE"
else
    echo "| API Security Scanning | ❌ Fail | High severity issues detected |" >> "$SUMMARY_FILE"
fi

# Add summary to the report
cat >> "$SUMMARY_FILE" << EOF

## Detailed Findings

For detailed findings, please review the individual reports in the \`$OUTPUT_DIR\` directory.

## Recommendations

1. Address all high severity issues before proceeding to production
2. Review all potential secrets and credentials for validity
3. Update vulnerable dependencies to secure versions
4. Implement fixes for any security unit test failures
5. Address API security issues detected by OWASP ZAP

## Next Steps

- Review all findings manually to eliminate false positives
- Implement fixes for confirmed security issues
- Re-run security tests to verify fixes
- Consider engaging a third-party for a comprehensive security audit
EOF

log "\n${YELLOW}===== Security Testing Summary =====${NC}"
log "Total tests run: 5"
log "Failures: $FAILURES"
log "Detailed logs: $LOG_FILE"
log "Summary report: $SUMMARY_FILE"

if [ $FAILURES -eq 0 ]; then
    log "${GREEN}✓ All security tests passed successfully!${NC}"
    exit 0
else
    log "${RED}✗ $FAILURES security tests failed. Please review the logs and reports.${NC}"
    exit 1
fi