#!/bin/bash

# run_full_system_test.sh - Script to run full system performance tests
# This script orchestrates all system performance tests including system resource monitoring

set -e

echo "===== Running Full System Performance Tests ====="

# Define output directory
OUTPUT_DIR="./performance-reports"
mkdir -p "$OUTPUT_DIR"

# Define timestamp for this test run
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_REPORT_DIR="$OUTPUT_DIR/system_test_$TIMESTAMP"
mkdir -p "$TEST_REPORT_DIR"

# Define log file
LOG_FILE="$TEST_REPORT_DIR/full_system_test.log"
touch "$LOG_FILE"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to check if necessary services are running
check_services() {
    log "Checking if necessary services are running..."
    
    # Check if the API server is running
    if ! curl -s http://localhost:8080/health > /dev/null; then
        log "ERROR: API server is not running. Please start the server before running full system tests."
        log "You can start the server with: make run"
        return 1
    fi
    
    log "API server is running."
    
    # Optional: Check database connection
    if command -v psql &> /dev/null; then
        if grep -q DB_CONNECTION_STRING .env; then
            DB_CONNECTION=$(grep DB_CONNECTION_STRING .env | cut -d '=' -f2)
            log "Checking database connection..."
            if ! psql "$DB_CONNECTION" -c "SELECT 1" &> /dev/null; then
                log "WARNING: Could not connect to database. Some functionality may not work correctly."
            else
                log "Database connection successful."
            fi
        else
            log "WARNING: DB_CONNECTION_STRING not found in .env file. Skipping database check."
        fi
    else
        log "psql not available. Skipping database check."
    fi
    
    return 0
}

# Function to extract test credentials if available
extract_credentials() {
    log "Extracting test credentials..."
    
    # Default values
    TEST_USERNAME="performance_test_user"
    TEST_PASSWORD="performance_test_password"
    
    # Try to get credentials from .env file
    if grep -q "TEST_USERNAME" .env; then
        TEST_USERNAME=$(grep "TEST_USERNAME" .env | cut -d '=' -f2)
    fi
    
    if grep -q "TEST_PASSWORD" .env; then
        TEST_PASSWORD=$(grep "TEST_PASSWORD" .env | cut -d '=' -f2)
    fi
    
    # Check if the test user exists or needs to be created
    if curl -s -X POST "http://localhost:8080/api/v1/auth/login" \
         -H "Content-Type: application/json" \
         -d "{\"username_or_email\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}" | grep -q "success"; then
        log "Test user authentication successful."
    else
        log "WARNING: Could not authenticate with test credentials. Some tests may fail."
        log "Consider creating a test user with username '$TEST_USERNAME' and password '$TEST_PASSWORD'."
    fi
    
    log "Using test username: $TEST_USERNAME"
    # Don't log the password for security reasons
}

# Function to run k6 system load test
run_k6_load_test() {
    log "Running k6 system load test..."
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log "ERROR: k6 is not installed. Please install k6 to run system load tests."
        log "Installation instructions: https://k6.io/docs/getting-started/installation/"
        return 1
    fi
    
    # Set test duration from argument or use default
    # Default duration structure is 27 minutes based on the stages in system_load_test.js
    TEST_DURATION=${1:-1620}
    log "Test duration: $TEST_DURATION seconds"
    
    # Set number of virtual users
    VU_COUNT=${2:-50}
    log "Virtual users: $VU_COUNT"
    
    # Define k6 test script and options
    K6_SCRIPT="./test/performance/system_load_test.js"
    
    # Check if the script exists
    if [ ! -f "$K6_SCRIPT" ]; then
        log "ERROR: k6 test script not found at $K6_SCRIPT"
        return 1
    fi
    
    # Run k6 with the specified options
    log "Starting k6 load test..."
    
    # Build the command with credentials and parameters
    K6_CMD="k6 run \
      --out json=$TEST_REPORT_DIR/k6_results.json \
      --summary-export=$TEST_REPORT_DIR/k6_summary.json \
      --console-output=$TEST_REPORT_DIR/k6_console.txt"
    
    # Add environment variables
    K6_ENV="-e BASE_URL=http://localhost:8080 \
      -e AUTH_USERNAME=$TEST_USERNAME \
      -e AUTH_PASSWORD=$TEST_PASSWORD \
      -e VU_COUNT=$VU_COUNT"
    
    # Execute k6 test in the background
    eval "$K6_CMD $K6_ENV $K6_SCRIPT" &
    K6_PID=$!
    
    log "K6 load test started with PID: $K6_PID"
    
    return 0
}

# Function to start system resource monitoring
start_resource_monitoring() {
    log "Starting system resource monitoring..."
    
    # Make sure the script is executable
    chmod +x ./scripts/performance/monitor_system_resources.sh
    
    # Run resource monitoring script in the background
    ./scripts/performance/monitor_system_resources.sh $TEST_DURATION &
    MONITOR_PID=$!
    
    log "Resource monitoring started with PID: $MONITOR_PID"
    
    return 0
}

# Function to wait for tests to complete
wait_for_completion() {
    log "Waiting for tests to complete..."
    
    # Wait for k6 test to complete
    if [ ! -z ${K6_PID+x} ]; then
        log "Waiting for k6 test (PID: $K6_PID) to complete..."
        wait $K6_PID || log "K6 process exited with non-zero status"
    fi
    
    # Wait for resource monitoring to complete
    if [ ! -z ${MONITOR_PID+x} ]; then
        log "Waiting for resource monitoring (PID: $MONITOR_PID) to complete..."
        wait $MONITOR_PID || log "Resource monitoring process exited with non-zero status"
    fi
    
    log "All tests completed."
    
    return 0
}

# Function to generate HTML report
generate_report() {
    log "Generating full system test report..."
    
    # Create HTML report
    REPORT_HTML="$TEST_REPORT_DIR/full_system_report.html"
    
    cat > "$REPORT_HTML" << EOL
<!DOCTYPE html>
<html>
<head>
    <title>Full System Performance Test Results - ${TIMESTAMP}</title>
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
        .chart {
            width: 100%;
            height: 400px;
            margin: 20px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Neo N3 Service Layer - Full System Performance Test Results</h1>
        <p>Test run: ${TIMESTAMP}</p>
        <p>Test duration: ${TEST_DURATION} seconds</p>
        <p>Virtual users: ${VU_COUNT}</p>
        
        <div class="section">
            <h2>Test Summary</h2>
            <pre>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.' 2>/dev/null || echo "No k6 summary data available")</pre>
            
            <h3>Key Metrics</h3>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Avg</th>
                    <th>Min</th>
                    <th>Med</th>
                    <th>Max</th>
                    <th>p(90)</th>
                    <th>p(95)</th>
                </tr>
                <tr>
                    <td>HTTP Request Duration</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".avg // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".min // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".med // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".max // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".p90 // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".p95 // "N/A"' 2>/dev/null)</td>
                </tr>
                <tr>
                    <td>Function Call Success Rate</td>
                    <td colspan="6">$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."function_call_success".rate // "N/A"' 2>/dev/null)</td>
                </tr>
                <tr>
                    <td>Transaction Success Rate</td>
                    <td colspan="6">$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."transaction_success".rate // "N/A"' 2>/dev/null)</td>
                </tr>
                <tr>
                    <td>System Response Time</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."system_response_time".avg // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."system_response_time".min // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."system_response_time".med // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."system_response_time".max // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."system_response_time".p90 // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."system_response_time".p95 // "N/A"' 2>/dev/null)</td>
                </tr>
            </table>
        </div>
        
        <div class="section">
            <h2>System Resource Utilization</h2>
            
            <h3>CPU and Memory</h3>
            <pre>$(find "$OUTPUT_DIR/system-metrics" -type f -name "summary.md" -print0 | xargs -0 ls -t | head -1 | xargs cat 2>/dev/null || echo "No system metrics data available")</pre>
        </div>
        
        <div class="section">
            <h2>Service Performance</h2>
            
            <h3>API Endpoint Performance</h3>
            <table>
                <tr>
                    <th>Endpoint Group</th>
                    <th>Avg (ms)</th>
                    <th>p(95) (ms)</th>
                    <th>Success Rate</th>
                </tr>
                <tr>
                    <td>Functions</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::functions}".avg // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::functions}".p95 // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."function_call_success".rate // "N/A"' 2>/dev/null)</td>
                </tr>
                <tr>
                    <td>Transactions</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::transactions}".avg // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::transactions}".p95 // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."transaction_success".rate // "N/A"' 2>/dev/null)</td>
                </tr>
                <tr>
                    <td>Price Feeds</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::price_feeds}".avg // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::price_feeds}".p95 // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."price_feed_success".rate // "N/A"' 2>/dev/null)</td>
                </tr>
                <tr>
                    <td>Oracles</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::oracles}".avg // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::oracles}".p95 // "N/A"' 2>/dev/null)</td>
                    <td>$(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."oracle_fetch_success".rate // "N/A"' 2>/dev/null)</td>
                </tr>
            </table>
        </div>
        
        <div class="section">
            <h2>Conclusion and Recommendations</h2>
            <p>This report presents the results of a full system performance test of the Neo N3 Service Layer.</p>
            <p>Key findings:</p>
            <ul>
                <li>API response times: $(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".avg // "N/A"' 2>/dev/null) ms average, $(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration".p95 // "N/A"' 2>/dev/null) ms at 95th percentile</li>
                <li>Overall success rate: $(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."checks".rate // "N/A"' 2>/dev/null)</li>
                <li>Function execution performance: Function calls completed in $(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::functions}".avg // "N/A"' 2>/dev/null) ms average</li>
                <li>Transaction processing performance: Transactions processed in $(cat "$TEST_REPORT_DIR/k6_summary.json" 2>/dev/null | jq -r '.metrics."http_req_duration{group:::transactions}".avg // "N/A"' 2>/dev/null) ms average</li>
            </ul>
            
            <p>For detailed analysis and raw data, refer to the JSON files in the test report directory: $TEST_REPORT_DIR</p>
        </div>
    </div>
</body>
</html>
EOL
    
    log "Performance report generated at: $REPORT_HTML"
    
    return 0
}

# Main function
main() {
    log "Starting full system performance test at $(date)"
    
    # Set test duration from argument or default to 5 minutes (300 seconds)
    # Use a shorter duration for testing the script
    TEST_DURATION=${1:-300}
    log "Test duration: $TEST_DURATION seconds"
    
    # Set number of virtual users from argument or default
    VU_COUNT=${2:-50}
    log "Virtual users: $VU_COUNT"
    
    # Check if services are running
    if ! check_services; then
        log "ERROR: Required services are not running. Aborting test."
        return 1
    fi
    
    # Extract test credentials
    extract_credentials
    
    # Start system resource monitoring
    if ! start_resource_monitoring; then
        log "WARNING: Failed to start resource monitoring. Continuing with test..."
    fi
    
    # Run k6 load test
    if ! run_k6_load_test $TEST_DURATION $VU_COUNT; then
        log "ERROR: Failed to start k6 load test. Aborting test."
        return 1
    fi
    
    # Wait for tests to complete
    wait_for_completion
    
    # Generate report
    generate_report
    
    log "Full system performance test completed at $(date)"
    log "Test results are available in: $TEST_REPORT_DIR"
    log "Performance report: $TEST_REPORT_DIR/full_system_report.html"
    
    return 0
}

# Run the main function with the provided arguments
main $1 $2