#!/bin/bash

# run_performance_tests.sh - Script to run all performance tests
# This script executes both Go benchmark tests and k6 load tests

set -e

echo "===== Running Performance Tests ====="

# Define output directory
OUTPUT_DIR="./performance-reports"
mkdir -p "$OUTPUT_DIR"

# Define timestamp for this test run
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_REPORT_DIR="$OUTPUT_DIR/$TIMESTAMP"
mkdir -p "$TEST_REPORT_DIR"

# Define log file
LOG_FILE="$TEST_REPORT_DIR/performance_test.log"
touch "$LOG_FILE"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Run Go benchmark tests
run_go_benchmarks() {
    log "\n===== Running Go Benchmark Tests ====="
    
    # Define benchmark flags
    BENCHMARK_FLAGS="-benchmem -benchtime=5s"
    
    # Run function benchmark tests
    log "\nRunning Function Benchmark Tests..."
    go test -bench=BenchmarkFunction -run=^$ $BENCHMARK_FLAGS ./test/performance/ > "$TEST_REPORT_DIR/function_benchmark.txt" || true
    
    # Run database benchmark tests (skip by default)
    log "\nDatabase benchmark tests are skipped by default (requires database connection)"
    log "To run database benchmarks manually use: go test -bench=BenchmarkDatabase -run=^$ ./test/performance/"
    
    # Display summary of benchmark results
    log "\nBenchmark Summary:"
    grep "Benchmark" "$TEST_REPORT_DIR/function_benchmark.txt"
}

# Run k6 load tests
run_k6_load_tests() {
    log "\n===== Running k6 Load Tests ====="
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log "k6 is not installed. Please install k6 to run load tests:"
        log "  - macOS: brew install k6"
        log "  - Linux: follow instructions at https://k6.io/docs/getting-started/installation/"
        log "Skipping k6 load tests..."
        return
    }
    
    # Check if API server is running
    if ! curl -s http://localhost:8080/health > /dev/null; then
        log "API server is not running. Please start the server before running load tests."
        log "Skipping k6 load tests..."
        return
    }
    
    # Define k6 test script
    K6_SCRIPT="./test/performance/api_load_test.js"
    
    # Run k6 with background load test
    log "\nRunning API background load test..."
    k6 run --out json="$TEST_REPORT_DIR/background_load.json" --summary-export="$TEST_REPORT_DIR/background_load_summary.json" --tag testcase=background $K6_SCRIPT --duration 1m --scenario background_load > "$TEST_REPORT_DIR/background_load.txt" || true
    
    # Run k6 with API stress test
    log "\nRunning API stress test..."
    k6 run --out json="$TEST_REPORT_DIR/api_stress.json" --summary-export="$TEST_REPORT_DIR/api_stress_summary.json" --tag testcase=stress $K6_SCRIPT --duration 2m --scenario api_stress > "$TEST_REPORT_DIR/api_stress.txt" || true
    
    # Run k6 with function execution test
    log "\nRunning function execution test..."
    k6 run --out json="$TEST_REPORT_DIR/function_execution.json" --summary-export="$TEST_REPORT_DIR/function_execution_summary.json" --tag testcase=function $K6_SCRIPT --duration 1m --scenario function_execution > "$TEST_REPORT_DIR/function_execution.txt" || true
    
    # Run k6 with transaction test
    log "\nRunning transaction management test..."
    k6 run --out json="$TEST_REPORT_DIR/transaction.json" --summary-export="$TEST_REPORT_DIR/transaction_summary.json" --tag testcase=transaction $K6_SCRIPT --duration 1m --scenario transaction_test > "$TEST_REPORT_DIR/transaction.txt" || true
    
    # Display summary of k6 results
    log "\nLoad Test Summary:"
    grep "checks\|http_req_duration\|http_reqs" "$TEST_REPORT_DIR/api_stress.txt" | tail -n 10
}

# Generate performance report
generate_report() {
    log "\n===== Generating Performance Report ====="
    
    # Create HTML report
    REPORT_HTML="$TEST_REPORT_DIR/performance_report.html"
    
    cat > "$REPORT_HTML" << EOL
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Results - ${TIMESTAMP}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background-color: #f9f9f9;
            border-radius: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            border: 1px solid #ddd;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
        tr:nth-child(even) {
            background-color: #f5f5f5;
        }
        .summary {
            font-weight: bold;
            background-color: #e9f7ef;
        }
        pre {
            background-color: #f8f8f8;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Neo N3 Service Layer Performance Test Results</h1>
        <p>Test run: ${TIMESTAMP}</p>
        
        <div class="section">
            <h2>Go Benchmark Tests</h2>
            <h3>Function Benchmark Results</h3>
            <pre>$(cat "$TEST_REPORT_DIR/function_benchmark.txt" 2>/dev/null || echo "No benchmark results available")</pre>
        </div>
        
        <div class="section">
            <h2>K6 Load Tests</h2>
            
            <h3>API Background Load Test</h3>
            <pre>$(grep "checks\|http_req_duration\|http_reqs" "$TEST_REPORT_DIR/background_load.txt" 2>/dev/null | tail -n 15 || echo "No load test results available")</pre>
            
            <h3>API Stress Test</h3>
            <pre>$(grep "checks\|http_req_duration\|http_reqs" "$TEST_REPORT_DIR/api_stress.txt" 2>/dev/null | tail -n 15 || echo "No stress test results available")</pre>
            
            <h3>Function Execution Test</h3>
            <pre>$(grep "checks\|http_req_duration\|function_executions" "$TEST_REPORT_DIR/function_execution.txt" 2>/dev/null | tail -n 15 || echo "No function execution test results available")</pre>
            
            <h3>Transaction Management Test</h3>
            <pre>$(grep "checks\|http_req_duration\|transaction" "$TEST_REPORT_DIR/transaction.txt" 2>/dev/null | tail -n 15 || echo "No transaction test results available")</pre>
        </div>
        
        <div class="section">
            <h2>Summary</h2>
            <p>Overall performance test results summary:</p>
            <ul>
                <li>Go benchmark tests: $(if [ -f "$TEST_REPORT_DIR/function_benchmark.txt" ]; then echo "Completed"; else echo "Not run"; fi)</li>
                <li>API load tests: $(if [ -f "$TEST_REPORT_DIR/api_stress.txt" ]; then echo "Completed"; else echo "Not run"; fi)</li>
                <li>Function execution tests: $(if [ -f "$TEST_REPORT_DIR/function_execution.txt" ]; then echo "Completed"; else echo "Not run"; fi)</li>
                <li>Transaction tests: $(if [ -f "$TEST_REPORT_DIR/transaction.txt" ]; then echo "Completed"; else echo "Not run"; fi)</li>
            </ul>
            <p>For detailed results, please check the individual test files in the $TEST_REPORT_DIR directory.</p>
        </div>
    </div>
</body>
</html>
EOL
    
    log "Performance report generated at: $REPORT_HTML"
}

# Main execution
main() {
    log "Starting performance tests at $(date)"
    log "Test results will be saved to: $TEST_REPORT_DIR"
    
    # Run Go benchmarks
    run_go_benchmarks
    
    # Run k6 load tests
    run_k6_load_tests
    
    # Generate report
    generate_report
    
    log "\nPerformance tests completed at $(date)"
    log "Test results are available in: $TEST_REPORT_DIR"
    log "Performance report: $TEST_REPORT_DIR/performance_report.html"
}

# Execute main function
main