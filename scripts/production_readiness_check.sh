#!/bin/bash
# Production Readiness Check Script
# Scans codebase for TODO, FIXME, placeholder, and other non-production patterns

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "========================================"
echo "  Production Readiness Check"
echo "========================================"
echo ""
echo "Project: $PROJECT_ROOT"
echo ""

ISSUES_FOUND=0
WARNINGS_FOUND=0

# Patterns to search for (case-insensitive)
CRITICAL_PATTERNS=(
    "TODO"
    "FIXME"
    "XXX"
    "HACK"
)

WARNING_PATTERNS=(
    # Target temporary stub comments, not legitimate UI/schema placeholder fields.
    "placeholder[[:space:]]+(for|-)"
    "for now"
    "dev-only"
    "workaround"
)

check_enclave_signing_key() {
    local strict_signing="${EGO_STRICT_SIGNING:-1}"
    local key_file="${EGO_PRIVATE_KEY_FILE:-$PROJECT_ROOT/private.pem}"

    if [[ "$key_file" != /* ]]; then
        key_file="$PROJECT_ROOT/$key_file"
    fi

    echo -e "${BLUE}=== Checking enclave signing key (strict mode) ===${NC}"
    echo ""

    if [[ "$strict_signing" != "1" ]]; then
        echo -e "${YELLOW}[warning] EGO_STRICT_SIGNING=${strict_signing}; strict enclave signing is disabled${NC}"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
        echo ""
        return
    fi

    if [[ ! -f "$key_file" ]]; then
        echo -e "${RED}[critical] missing enclave signing key file: ${key_file}${NC}"
        echo "  Provide a real key via ./scripts/up.sh --signing-key /path/to/private.pem"
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        return
    fi

    if ! openssl pkey -in "$key_file" -noout >/dev/null 2>&1; then
        echo -e "${RED}[critical] invalid enclave signing key in ${key_file}${NC}"
        echo "  This file is likely a placeholder and SGX image builds will fail."
        echo "  Use ./scripts/up.sh --signing-key /path/to/private.pem or --signing-key-dir /path/to/keys"
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        return
    fi

    local key_meta
    key_meta="$(openssl rsa -in "$key_file" -text -noout 2>/dev/null || true)"
    if ! grep -q "Private-Key: (3072 bit" <<<"$key_meta"; then
        echo -e "${RED}[critical] invalid enclave signing key size in ${key_file}${NC}"
        echo "  SGX signing requires RSA-3072."
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        return
    fi
    if ! grep -q "publicExponent: 3 (0x3)" <<<"$key_meta"; then
        echo -e "${RED}[critical] invalid enclave signing key exponent in ${key_file}${NC}"
        echo "  SGX signing requires publicExponent=3."
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        return
    fi

    echo -e "${GREEN}Valid enclave signing key detected: ${key_file}${NC}"
    echo ""
}

check_pattern() {
    local pattern=$1
    local severity=$2
    local color=$RED
    local count=0
    local word_flag=""

    if [[ "$severity" == "warning" ]]; then
        color=$YELLOW
    fi

    # Avoid false positives for patterns like "1xxx" or UUID format examples.
    # Apply whole-word matching for simple token patterns (TODO/FIXME/XXX/HACK).
    if [[ "$pattern" =~ ^[A-Za-z]+$ ]]; then
        word_flag="-w"
    fi

    # Search with exclusions using find + grep (more reliable for exclusions)
    local results=$(find "$PROJECT_ROOT" \
        -type f \( -name "*.go" -o -name "*.cs" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/.git/*" \
        ! -path "*/vendor/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -path "*/__pycache__/*" \
        ! -path "*/.next/*" \
        ! -path "*/coverage/*" \
        ! -path "*/test/*" \
        ! -path "*/tests/*" \
        ! -path "*/__tests__/*" \
        ! -name "*_test.go" \
        ! -name "*_test.cs" \
        ! -name "*.test.ts" \
        ! -name "*.test.tsx" \
        ! -name "*.spec.ts" \
        ! -name "*.spec.tsx" \
        ! -name "production_readiness_check.sh" \
        -exec grep -lEni $word_flag "$pattern" {} \; 2>/dev/null | while read -r file; do
            grep -Eni $word_flag "$pattern" "$file" 2>/dev/null | while read -r line; do
                echo "$file:$line"
            done
        done || true)

    # Filter out known false positives by pattern.
    if [[ -n "$results" && "$pattern" == "placeholder[[:space:]]+(for|-)" ]]; then
        results=$(echo "$results" | \
            grep -Evi "StatusTemporaryRedirect|build-time-placeholder|SENDER placeholder|bug bounty|bounty\.hunter" || true)
    fi

    if [[ -n "$results" ]]; then
        count=$(echo "$results" | wc -l)
        echo -e "${color}[$severity] Found '$pattern': $count occurrence(s)${NC}"

        echo "$results" | while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                # Make path relative
                local rel_line="${line#$PROJECT_ROOT/}"
                # Truncate long lines
                local display_line="${rel_line:0:150}"
                if [[ ${#rel_line} -gt 150 ]]; then
                    display_line="$display_line..."
                fi
                echo "  $display_line"
            fi
        done
        echo ""

        if [[ "$severity" == "critical" ]]; then
            ISSUES_FOUND=$((ISSUES_FOUND + count))
        else
            WARNINGS_FOUND=$((WARNINGS_FOUND + count))
        fi
    fi
}

echo -e "${BLUE}=== Checking for CRITICAL patterns ===${NC}"
echo ""

for pattern in "${CRITICAL_PATTERNS[@]}"; do
    check_pattern "$pattern" "critical"
done

echo -e "${BLUE}=== Checking for WARNING patterns ===${NC}"
echo ""

for pattern in "${WARNING_PATTERNS[@]}"; do
    check_pattern "$pattern" "warning"
done

check_enclave_signing_key

echo "========================================"
echo "  Summary"
echo "========================================"
echo ""

if [[ $ISSUES_FOUND -gt 0 ]]; then
    echo -e "${RED}CRITICAL ISSUES: $ISSUES_FOUND${NC}"
fi

if [[ $WARNINGS_FOUND -gt 0 ]]; then
    echo -e "${YELLOW}WARNINGS: $WARNINGS_FOUND${NC}"
fi

if [[ $ISSUES_FOUND -eq 0 && $WARNINGS_FOUND -eq 0 ]]; then
    echo -e "${GREEN}No production readiness issues found!${NC}"
    exit 0
elif [[ $ISSUES_FOUND -gt 0 ]]; then
    echo ""
    echo -e "${RED}FAILED: Critical issues must be resolved before production deployment${NC}"
    exit 1
else
    echo ""
    echo -e "${YELLOW}WARNING: Review warnings before production deployment${NC}"
    exit 0
fi
