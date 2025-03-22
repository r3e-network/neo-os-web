#!/bin/bash

# run_gosec.sh - Script to run Gosec security scanner on the codebase
# This script checks for security vulnerabilities in Go code

set -e

echo "===== Running Gosec Security Scanner ====="

# Check if Gosec is installed
if ! command -v gosec &> /dev/null; then
    echo "Gosec not found. Installing Gosec..."
    go install github.com/securego/gosec/v2/cmd/gosec@latest
fi

# Define output directory
OUTPUT_DIR="./security-reports"
mkdir -p "$OUTPUT_DIR"

# Define output formats
FORMATS=("json" "html" "text")

# Run Gosec with different output formats
for FORMAT in "${FORMATS[@]}"; do
    echo "Running Gosec with $FORMAT output..."
    
    # Define output file
    OUTPUT_FILE="$OUTPUT_DIR/gosec-report.$FORMAT"
    
    # Run Gosec
    if [ "$FORMAT" == "html" ]; then
        gosec -fmt=html -out="$OUTPUT_FILE" ./...
    else
        gosec -fmt="$FORMAT" -out="$OUTPUT_FILE" ./...
    fi
    
    echo "Gosec report saved to $OUTPUT_FILE"
done

# Run Gosec with specific severity level (high and critical only)
echo "Running Gosec for high and critical severity issues..."
gosec -severity=high -fmt=text -out="$OUTPUT_DIR/gosec-high-severity.txt" ./...

# Run Gosec for specific test cases (customize as needed)
echo "Running Gosec for specific security checks..."
# G101: Look for hard coded credentials
# G102: Bind to all interfaces
# G104: Audit use of crypto rand
# G107: Url provided to HTTP request as taint input
gosec -include=G101,G102,G104,G107 -fmt=text -out="$OUTPUT_DIR/gosec-specific-checks.txt" ./...

echo "===== Gosec Security Scanning Complete ====="

# Check if any high severity issues were found
if grep -q "High:" "$OUTPUT_DIR/gosec-high-severity.txt"; then
    echo "WARNING: High severity security issues found!"
    grep -A 3 "High:" "$OUTPUT_DIR/gosec-high-severity.txt"
    exit 1
else
    echo "No high severity security issues found."
    exit 0
fi