#!/bin/bash

# scan_dependencies.sh - Script to scan Go and JavaScript dependencies for vulnerabilities
# This script checks for known vulnerabilities in project dependencies

set -e

echo "===== Running Dependency Vulnerability Scan ====="

# Define output directory
OUTPUT_DIR="./security-reports"
mkdir -p "$OUTPUT_DIR"

# Scan Go dependencies
echo "Scanning Go dependencies..."

# Check if Nancy is installed (for Go dependency scanning)
if ! command -v nancy &> /dev/null; then
    echo "Nancy not found. Installing Nancy..."
    go install github.com/sonatype-nexus-community/nancy@latest
fi

# Run Nancy with go list
echo "Running Nancy on Go dependencies..."
go list -json -m all | nancy sleuth -o "$OUTPUT_DIR/nancy-report.json"

# Alternative: Use govulncheck if available
if command -v govulncheck &> /dev/null; then
    echo "Running govulncheck for additional Go vulnerability scanning..."
    govulncheck -json ./... > "$OUTPUT_DIR/govulncheck-report.json"
else
    echo "govulncheck not installed. Skipping additional Go vulnerability scanning."
    echo "To install: go install golang.org/x/vuln/cmd/govulncheck@latest"
fi

# Check for web directory with package.json
if [ -d "./web" ] && [ -f "./web/package.json" ]; then
    echo "Scanning JavaScript dependencies..."
    
    # Navigate to web directory
    cd ./web
    
    # Check if npm is installed
    if command -v npm &> /dev/null; then
        # Run npm audit
        echo "Running npm audit..."
        npm audit --json > "../$OUTPUT_DIR/npm-audit-report.json" || true
        
        # Run snyk if available
        if command -v snyk &> /dev/null; then
            echo "Running Snyk for JavaScript dependencies..."
            snyk test --json > "../$OUTPUT_DIR/snyk-js-report.json" || true
        else
            echo "Snyk not installed. Skipping additional JavaScript vulnerability scanning."
            echo "To install: npm install -g snyk"
        fi
    else
        echo "npm not found. Skipping JavaScript dependency scanning."
    fi
    
    # Return to root directory
    cd ..
else
    echo "No web directory or package.json found. Skipping JavaScript dependency scanning."
fi

echo "===== Dependency Vulnerability Scanning Complete ====="

# Check if high severity issues were found in Go dependencies
if grep -q "Critical\|High" "$OUTPUT_DIR/nancy-report.json"; then
    echo "WARNING: High severity vulnerabilities found in Go dependencies!"
    jq '.vulnerable[] | select(.severity == "Critical" or .severity == "High") | {name: .coordinates, severity: .severity, description: .description}' "$OUTPUT_DIR/nancy-report.json"
    FOUND_HIGH_GO=1
else
    echo "No high severity vulnerabilities found in Go dependencies."
    FOUND_HIGH_GO=0
fi

# Check if high severity issues were found in JavaScript dependencies
if [ -f "$OUTPUT_DIR/npm-audit-report.json" ] && grep -q "\"severity\":\"high\"\|\"severity\":\"critical\"" "$OUTPUT_DIR/npm-audit-report.json"; then
    echo "WARNING: High severity vulnerabilities found in JavaScript dependencies!"
    FOUND_HIGH_JS=1
else
    echo "No high severity vulnerabilities found in JavaScript dependencies."
    FOUND_HIGH_JS=0
fi

# Exit with error if high severity issues were found
if [ $FOUND_HIGH_GO -eq 1 ] || [ $FOUND_HIGH_JS -eq 1 ]; then
    echo "High severity vulnerabilities found. Please address these issues."
    exit 1
else
    echo "Dependency scan completed successfully with no high severity issues."
    exit 0
fi