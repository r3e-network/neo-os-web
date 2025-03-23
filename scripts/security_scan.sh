#!/bin/bash

# Security scanning script for Service Layer
# This script runs various security tools to check the codebase for vulnerabilities

set -e

# Print a header
echo "==============================================="
echo "Service Layer Security Scanner"
echo "==============================================="

# Check if gosec is installed
if ! command -v gosec &> /dev/null; then
    echo "Installing gosec..."
    go install github.com/securego/gosec/v2/cmd/gosec@latest
fi

# Check if nancy is installed
if ! command -v nancy &> /dev/null; then
    echo "Installing nancy..."
    go install github.com/sonatype-nexus-community/nancy@latest
fi

# Create a directory for security reports
mkdir -p ./security-reports

# Function to display results
display_results() {
    if [ $1 -eq 0 ]; then
        echo -e "\033[0;32m✓ $2 completed successfully\033[0m"
    else
        echo -e "\033[0;31m✗ $2 failed\033[0m"
        exit 1
    fi
}

echo
echo "Running gosec for static code analysis..."
echo "-----------------------------------------------"
gosec -quiet -fmt=json -out=./security-reports/gosec-report.json ./...
gosec -quiet ./...
display_results $? "Gosec scan"

echo
echo "Running dependency check with nancy..."
echo "-----------------------------------------------"
go list -json -deps ./... | nancy sleuth -o ./security-reports/nancy-report.json
display_results $? "Nancy dependency scan"

echo
echo "Checking for hard-coded secrets..."
echo "-----------------------------------------------"
# Basic grep for potential hardcoded secrets (will have false positives)
# This is just a simple example, a real implementation would use a more sophisticated tool
grep -r --include="*.go" --include="*.json" --exclude-dir=".git" "password\|secret\|key\|token" . | grep -v "Password\|Secret\|Key\|Token" > ./security-reports/hardcoded-secrets.txt
echo "Potential hardcoded secrets report saved to ./security-reports/hardcoded-secrets.txt"

echo
echo "Checking for insecure configurations..."
echo "-----------------------------------------------"
# Check for common insecure configurations
grep -r --include="*.go" --include="*.json" "tls.Config.*Insecure\|InsecureSkipVerify.*true\|AllowInsecureAuth.*true" . > ./security-reports/insecure-configs.txt
echo "Potential insecure configurations saved to ./security-reports/insecure-configs.txt"

echo
echo "==============================================="
echo "Security scan complete! Reports saved to ./security-reports/"
echo "===============================================" 