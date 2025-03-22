#!/bin/bash

# detect_secrets.sh - Script to detect secrets and credentials in the codebase
# This script checks for hardcoded secrets, API keys, and credentials

set -e

echo "===== Running Secret Detection ====="

# Define output directory
OUTPUT_DIR="./security-reports"
mkdir -p "$OUTPUT_DIR"

# Check if gitleaks is installed
if ! command -v gitleaks &> /dev/null; then
    echo "Gitleaks not found. You can install it with: go install github.com/zricethezav/gitleaks/v8@latest"
    echo "Falling back to git grep for basic detection..."
    
    # Simple patterns to search for potential secrets
    echo "Looking for potential hardcoded secrets or credentials..."
    git grep -n "password\|secret\|api[_-]key\|token\|Bearer\|auth[_-]key" -- '*.go' '*.js' '*.ts' > "$OUTPUT_DIR/potential_secrets.txt" || true
    
    # Count number of potential findings
    FINDINGS=$(wc -l < "$OUTPUT_DIR/potential_secrets.txt" | tr -d ' ')
    echo "Found $FINDINGS potential secret patterns. Please review $OUTPUT_DIR/potential_secrets.txt"
else
    # Run gitleaks
    echo "Running Gitleaks for secret detection..."
    gitleaks detect --source . --report-format json --report-path "$OUTPUT_DIR/gitleaks-report.json" || true
    
    # Run gitleaks with verbose output
    echo "Generating human-readable report..."
    gitleaks detect --source . --verbose > "$OUTPUT_DIR/gitleaks-report.txt" || true
    
    # Count findings 
    if [ -f "$OUTPUT_DIR/gitleaks-report.json" ]; then
        FINDINGS=$(jq '. | length' "$OUTPUT_DIR/gitleaks-report.json")
        echo "Gitleaks found $FINDINGS potential secrets."
        
        if [ "$FINDINGS" -gt 0 ]; then
            echo "Top findings:"
            jq '.[] | {description: .Description, file: .File, line: .StartLine, match: .Secret}' "$OUTPUT_DIR/gitleaks-report.json" | head -20
        fi
    else
        echo "No Gitleaks report generated."
    fi
fi

# Look for common security issues in configuration files
echo "Checking configuration files for security issues..."
find . -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" -o -name "*.env.example" | xargs grep -l "password\|secret\|key\|token" > "$OUTPUT_DIR/config_files_with_credentials.txt" || true

# Check for private keys
echo "Checking for private key files..."
find . -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.pfx" > "$OUTPUT_DIR/private_key_files.txt" || true

echo "===== Secret Detection Complete ====="

# Check if any findings were discovered
if [ "$FINDINGS" -gt 0 ] || [ -s "$OUTPUT_DIR/potential_secrets.txt" ] || [ -s "$OUTPUT_DIR/config_files_with_credentials.txt" ] || [ -s "$OUTPUT_DIR/private_key_files.txt" ]; then
    echo "WARNING: Potential credentials or secrets found!"
    echo "Please review the reports in $OUTPUT_DIR"
    echo "This may include false positives, but each finding should be reviewed carefully."
    exit 1
else
    echo "No obvious secrets or credentials found."
    exit 0
fi