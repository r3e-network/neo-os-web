#!/bin/bash

# Performance testing script for Service Layer
# This script runs the performance tests and generates reports

set -e

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:8080/v1"}
DURATION=${DURATION:-120}  # Test duration in seconds
OUTPUT_DIR=${OUTPUT_DIR:-"./performance_results"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_DIR="${OUTPUT_DIR}/${TIMESTAMP}"
TEST_LEVELS=("light" "medium" "heavy")  # Test load levels
AUTH_TOKEN=${AUTH_TOKEN:-""}  # Auth token for API access
FUNCTION_ID=${FUNCTION_ID:-1}  # Function ID to test

# Create output directories
mkdir -p "${RESULT_DIR}"
mkdir -p "${RESULT_DIR}/charts"

# Log configuration
echo "Performance Test Configuration:" | tee "${RESULT_DIR}/config.txt"
echo "- Base URL: ${BASE_URL}" | tee -a "${RESULT_DIR}/config.txt"
echo "- Test Duration: ${DURATION} seconds" | tee -a "${RESULT_DIR}/config.txt"
echo "- Timestamp: ${TIMESTAMP}" | tee -a "${RESULT_DIR}/config.txt"
echo "- Function ID: ${FUNCTION_ID}" | tee -a "${RESULT_DIR}/config.txt"
echo "" | tee -a "${RESULT_DIR}/config.txt"

# Login and get auth token if not provided
if [ -z "${AUTH_TOKEN}" ]; then
    echo "Auth token not provided, attempting to login..."
    
    # Replace with actual credentials from environment or config
    USERNAME=${TEST_USERNAME:-"testuser"}
    PASSWORD=${TEST_PASSWORD:-"password123"}
    
    LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username_or_email\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
    
    # Extract token
    AUTH_TOKEN=$(echo "${LOGIN_RESPONSE}" | jq -r '.data.access_token')
    
    if [ "${AUTH_TOKEN}" == "null" ] || [ -z "${AUTH_TOKEN}" ]; then
        echo "Failed to get auth token. Response: ${LOGIN_RESPONSE}"
        exit 1
    fi
    
    echo "Successfully obtained auth token."
fi

# Function to run Go performance tests
run_go_performance_test() {
    load_level=$1
    users=$2
    
    echo "Running ${load_level} load test with ${users} concurrent users..."
    
    # Set environment variables for the test
    export PERF_TEST_BASE_URL="${BASE_URL}"
    export PERF_TEST_AUTH_TOKEN="${AUTH_TOKEN}"
    export PERF_TEST_CONCURRENT_USERS="${users}"
    export PERF_TEST_DURATION="${DURATION}"
    export PERF_TEST_FUNCTION_ID="${FUNCTION_ID}"
    
    # Run the test
    go test -v -timeout 30m ./function_performance_test.go \
        -args -test.run=TestFunctionExecutionPerformance \
        | tee "${RESULT_DIR}/${load_level}_load_test.log"
    
    # Extract metrics from log for reporting
    avg_response=$(grep "Avg response time:" "${RESULT_DIR}/${load_level}_load_test.log" | awk '{print $4}')
    p95_response=$(grep "95th percentile:" "${RESULT_DIR}/${load_level}_load_test.log" | awk '{print $3}')
    throughput=$(grep "Throughput:" "${RESULT_DIR}/${load_level}_load_test.log" | awk '{print $2}')
    error_rate=$(grep "Error rate:" "${RESULT_DIR}/${load_level}_load_test.log" | awk '{print $3}')
    
    # Add to summary
    echo "${load_level},${users},${avg_response},${p95_response},${throughput},${error_rate}" >> "${RESULT_DIR}/summary.csv"
}

# Initialize summary CSV
echo "Load Level,Users,Avg Response (ms),P95 Response (ms),Throughput (req/s),Error Rate (%)" > "${RESULT_DIR}/summary.csv"

# Execute tests with different load levels
run_go_performance_test "light" 10
run_go_performance_test "medium" 50
run_go_performance_test "heavy" 200

# Generate HTML report
cat > "${RESULT_DIR}/report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Results - ${TIMESTAMP}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .chart { width: 100%; height: 400px; margin-top: 30px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; }
        .pass { color: green; }
        .fail { color: red; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="header">
        <h1>Performance Test Results</h1>
        <p>Date: ${TIMESTAMP}</p>
    </div>
    
    <h2>Test Configuration</h2>
    <pre>$(cat "${RESULT_DIR}/config.txt")</pre>
    
    <h2>Summary Results</h2>
    <table>
        <tr>
            <th>Load Level</th>
            <th>Users</th>
            <th>Avg Response (ms)</th>
            <th>P95 Response (ms)</th>
            <th>Throughput (req/s)</th>
            <th>Error Rate (%)</th>
            <th>Status</th>
        </tr>
EOF

# Add table rows from CSV
tail -n +2 "${RESULT_DIR}/summary.csv" | while IFS=, read -r level users avg p95 throughput error; do
    # Determine pass/fail status
    status="PASS"
    statusClass="pass"
    
    # Criteria for failure (adjust as needed)
    if (( $(echo "$p95 > 500" | bc -l) )) || (( $(echo "$error > 1.0" | bc -l) )); then
        status="FAIL"
        statusClass="fail"
    fi
    
    echo "<tr>" >> "${RESULT_DIR}/report.html"
    echo "    <td>${level}</td>" >> "${RESULT_DIR}/report.html"
    echo "    <td>${users}</td>" >> "${RESULT_DIR}/report.html"
    echo "    <td>${avg}</td>" >> "${RESULT_DIR}/report.html"
    echo "    <td>${p95}</td>" >> "${RESULT_DIR}/report.html"
    echo "    <td>${throughput}</td>" >> "${RESULT_DIR}/report.html"
    echo "    <td>${error}</td>" >> "${RESULT_DIR}/report.html"
    echo "    <td class=\"${statusClass}\">${status}</td>" >> "${RESULT_DIR}/report.html"
    echo "</tr>" >> "${RESULT_DIR}/report.html"
done

# Add canvas for charts
cat >> "${RESULT_DIR}/report.html" << EOF
    </table>
    
    <h2>Response Time Chart</h2>
    <div class="chart-container">
        <canvas id="responseChart"></canvas>
    </div>
    
    <h2>Throughput Chart</h2>
    <div class="chart-container">
        <canvas id="throughputChart"></canvas>
    </div>
    
    <script>
        // Extract data from the table
        const table = document.querySelector('table');
        const rows = Array.from(table.querySelectorAll('tr')).slice(1); // Skip header row
        
        const labels = rows.map(row => row.cells[0].textContent);
        const avgResponseData = rows.map(row => parseFloat(row.cells[2].textContent));
        const p95ResponseData = rows.map(row => parseFloat(row.cells[3].textContent));
        const throughputData = rows.map(row => parseFloat(row.cells[4].textContent));
        
        // Response Time Chart
        const ctxResponse = document.getElementById('responseChart').getContext('2d');
        new Chart(ctxResponse, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Average Response Time (ms)',
                        data: avgResponseData,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '95th Percentile Response Time (ms)',
                        data: p95ResponseData,
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Response Time (ms)'
                        }
                    }
                }
            }
        });
        
        // Throughput Chart
        const ctxThroughput = document.getElementById('throughputChart').getContext('2d');
        new Chart(ctxThroughput, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Throughput (req/s)',
                    data: throughputData,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Requests per Second'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
EOF

echo "Performance tests completed. Results saved to ${RESULT_DIR}"
echo "HTML report available at: ${RESULT_DIR}/report.html"

# Create a symlink to the latest results
ln -sf "${TIMESTAMP}" "${OUTPUT_DIR}/latest"
echo "Latest results symlink: ${OUTPUT_DIR}/latest"