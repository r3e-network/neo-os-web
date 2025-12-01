#!/bin/bash
# Mixer Service Integration and Smoke Tests Runner
# Runs tests with SGX SIM mode configuration
#
# Usage:
#   ./scripts/run_mixer_tests.sh [smoke|integration|all]
#
# Environment Variables:
#   SGX_MODE=SIM|HW (default: SIM)
#   TEST_TIMEOUT=duration (default: 5m)
#   VERBOSE=1 (enable verbose output)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
SGX_MODE="${SGX_MODE:-SIM}"
TEST_TIMEOUT="${TEST_TIMEOUT:-5m}"
TEST_TYPE="${1:-all}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_header() {
    echo ""
    echo "========================================"
    echo " $1"
    echo "========================================"
    echo ""
}

# Check SGX environment
check_sgx_env() {
    print_header "SGX Environment Check"

    log_info "SGX Mode: $SGX_MODE"

    if [ "$SGX_MODE" = "HW" ]; then
        # Check for SGX hardware support
        if [ -e /dev/sgx_enclave ] || [ -e /dev/isgx ]; then
            log_success "SGX device found"
        else
            log_warn "SGX device not found, falling back to SIM mode"
            SGX_MODE="SIM"
        fi

        # Check for SGX SDK
        if [ -n "$SGX_SDK" ]; then
            log_success "SGX SDK found at: $SGX_SDK"
        else
            log_warn "SGX_SDK not set, using simulation mode"
            SGX_MODE="SIM"
        fi
    fi

    if [ "$SGX_MODE" = "SIM" ]; then
        log_info "Running in SGX Simulation mode"
        export SGX_MODE=SIM
    fi
}

# Run smoke tests
run_smoke_tests() {
    print_header "Running Smoke Tests"

    log_info "Timeout: $TEST_TIMEOUT"

    cd "$PROJECT_ROOT"

    VERBOSE_FLAG=""
    if [ -n "$VERBOSE" ]; then
        VERBOSE_FLAG="-v"
    fi

    if go test $VERBOSE_FLAG -tags=smoke -timeout="$TEST_TIMEOUT" ./tests/smoke/...; then
        log_success "Smoke tests passed"
        return 0
    else
        log_error "Smoke tests failed"
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_header "Running Integration Tests"

    log_info "Timeout: $TEST_TIMEOUT"

    cd "$PROJECT_ROOT"

    VERBOSE_FLAG=""
    if [ -n "$VERBOSE" ]; then
        VERBOSE_FLAG="-v"
    fi

    if go test $VERBOSE_FLAG -tags=integration -timeout="$TEST_TIMEOUT" ./tests/integration/mixer/...; then
        log_success "Integration tests passed"
        return 0
    else
        log_error "Integration tests failed"
        return 1
    fi
}

# Run TEE-specific tests
run_tee_tests() {
    print_header "Running TEE System Tests"

    cd "$PROJECT_ROOT"

    VERBOSE_FLAG=""
    if [ -n "$VERBOSE" ]; then
        VERBOSE_FLAG="-v"
    fi

    if go test $VERBOSE_FLAG -timeout="$TEST_TIMEOUT" ./system/tee/...; then
        log_success "TEE tests passed"
        return 0
    else
        log_error "TEE tests failed"
        return 1
    fi
}

# Run mixer unit tests
run_mixer_unit_tests() {
    print_header "Running Mixer Unit Tests"

    cd "$PROJECT_ROOT"

    VERBOSE_FLAG=""
    if [ -n "$VERBOSE" ]; then
        VERBOSE_FLAG="-v"
    fi

    if go test $VERBOSE_FLAG -timeout="$TEST_TIMEOUT" ./packages/com.r3e.services.mixer/...; then
        log_success "Mixer unit tests passed"
        return 0
    else
        log_error "Mixer unit tests failed"
        return 1
    fi
}

# Main execution
main() {
    print_header "Mixer Service Test Suite"

    log_info "Project root: $PROJECT_ROOT"
    log_info "Test type: $TEST_TYPE"

    check_sgx_env

    FAILED=0

    case "$TEST_TYPE" in
        smoke)
            run_smoke_tests || FAILED=1
            ;;
        integration)
            run_integration_tests || FAILED=1
            ;;
        tee)
            run_tee_tests || FAILED=1
            ;;
        unit)
            run_mixer_unit_tests || FAILED=1
            ;;
        all)
            run_mixer_unit_tests || FAILED=1
            run_tee_tests || FAILED=1
            run_smoke_tests || FAILED=1
            run_integration_tests || FAILED=1
            ;;
        *)
            log_error "Unknown test type: $TEST_TYPE"
            echo "Usage: $0 [smoke|integration|tee|unit|all]"
            exit 1
            ;;
    esac

    print_header "Test Summary"

    if [ $FAILED -eq 0 ]; then
        log_success "All tests passed!"
        exit 0
    else
        log_error "Some tests failed"
        exit 1
    fi
}

main "$@"
