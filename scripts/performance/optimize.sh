#!/bin/bash

# Performance Optimization Script for Neo N3 Service Layer
# This script analyzes and optimizes performance bottlenecks

set -e

echo "Starting performance optimization analysis..."

# Create output directory
OUTPUT_DIR="./performance_reports"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="${OUTPUT_DIR}/optimization_report_${TIMESTAMP}.md"

# Service configuration
SERVICE_HOST=${1:-"localhost"}
SERVICE_PORT=${2:-"8080"}
SERVICE_URL="http://${SERVICE_HOST}:${SERVICE_PORT}"
DATABASE_HOST=${3:-"localhost"}
DATABASE_PORT=${4:-"5432"}
DATABASE_NAME=${5:-"service_layer"}
DATABASE_USER=${6:-"postgres"}
DATABASE_PASSWORD=${7:-"postgres"}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Install required tools if not already installed
install_tools() {
  echo "Checking and installing required tools..."
  
  # Check and install go
  if ! command_exists go; then
    echo "Go is required but not installed. Please install Go first."
    exit 1
  fi
  
  # Check and install pprof
  if ! command_exists go tool pprof; then
    echo "Installing pprof..."
    go install github.com/google/pprof@latest
  fi
  
  # Check and install hey (HTTP load generator)
  if ! command_exists hey; then
    echo "Installing hey..."
    go install github.com/rakyll/hey@latest
  fi
  
  # Check and install jq
  if ! command_exists jq; then
    echo "Installing jq..."
    if command_exists apt-get; then
      sudo apt-get install -y jq
    elif command_exists brew; then
      brew install jq
    else
      echo "Please install jq manually from https://stedolan.github.io/jq/download/"
      exit 1
    fi
  fi
  
  # Check and install pgbench
  if ! command_exists pgbench; then
    echo "Installing pgbench..."
    if command_exists apt-get; then
      sudo apt-get install -y postgresql-contrib
    elif command_exists brew; then
      brew install postgresql
    else
      echo "Please install postgresql-contrib manually to get pgbench"
      exit 1
    fi
  fi
}

# Verify service is running
verify_service() {
  echo "Verifying service is running at ${SERVICE_URL}..."
  if ! curl -s --head "${SERVICE_URL}/api/v1/health" > /dev/null; then
    echo "Error: Service at ${SERVICE_URL} is not reachable"
    exit 1
  fi
  echo "Service is running"
}

# Run API endpoint performance tests
run_api_performance_tests() {
  echo "Running API endpoint performance tests..."
  mkdir -p "${OUTPUT_DIR}/api_tests"
  
  # List of endpoints to test with their expected load
  declare -A ENDPOINTS=(
    ["/api/v1/health"]="100:10"             # 100 requests per second for 10 seconds
    ["/api/v1/functions"]="50:10"           # 50 requests per second for 10 seconds
    ["/api/v1/price-feed/latest"]="200:10"  # 200 requests per second for 10 seconds
    ["/api/v1/random/info"]="30:10"         # 30 requests per second for 10 seconds
    ["/api/v1/oracle/sources"]="40:10"      # 40 requests per second for 10 seconds
  )
  
  echo "### API Endpoint Performance Tests" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "| Endpoint | RPS | Avg Response Time | 90th Percentile | 99th Percentile | Status Codes |" >> "${REPORT_FILE}"
  echo "|----------|-----|-------------------|-----------------|-----------------|--------------|" >> "${REPORT_FILE}"
  
  for endpoint in "${!ENDPOINTS[@]}"; do
    IFS=":" read -r rps duration <<< "${ENDPOINTS[$endpoint]}"
    echo "Testing endpoint: ${endpoint} at ${rps} RPS for ${duration} seconds..."
    
    result_file="${OUTPUT_DIR}/api_tests/$(echo ${endpoint} | tr '/' '_')_${TIMESTAMP}.txt"
    hey -n "$((rps * duration))" -c "${rps}" -t 30 "${SERVICE_URL}${endpoint}" > "${result_file}"
    
    # Extract performance metrics
    avg_response=$(grep "Average" "${result_file}" | awk '{print $2}')
    p90_response=$(grep "90%" "${result_file}" | awk '{print $2}')
    p99_response=$(grep "99%" "${result_file}" | awk '{print $2}')
    status_codes=$(grep -A5 "Status code distribution:" "${result_file}" | grep -v "Status code distribution:" | tr '\n' ' ')
    
    # Add to report
    echo "| ${endpoint} | ${rps} | ${avg_response} | ${p90_response} | ${p99_response} | ${status_codes} |" >> "${REPORT_FILE}"
  done
  
  echo "" >> "${REPORT_FILE}"
  echo "Detailed results are available in the \`${OUTPUT_DIR}/api_tests\` directory." >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
}

# Run database performance tests
run_database_performance_tests() {
  echo "Running database performance tests..."
  DB_TEST_DIR="${OUTPUT_DIR}/db_tests"
  mkdir -p "${DB_TEST_DIR}"
  
  echo "### Database Performance Tests" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  
  # Define test queries
  QUERIES=(
    "SELECT * FROM users LIMIT 100"
    "SELECT * FROM functions ORDER BY created_at DESC LIMIT 20"
    "SELECT * FROM transactions WHERE status = 'confirmed' LIMIT 50"
    "SELECT * FROM price_feeds JOIN price_data ON price_feeds.id = price_data.feed_id LIMIT 30"
    "SELECT * FROM random_requests WHERE status = 'completed' ORDER BY created_at DESC LIMIT 20"
  )
  
  echo "| Query | Execution Time (ms) | Index Used | Recommendations |" >> "${REPORT_FILE}"
  echo "|-------|---------------------|------------|-----------------|" >> "${REPORT_FILE}"
  
  for query in "${QUERIES[@]}"; do
    echo "Testing query: ${query}"
    
    # Execute explain analyze
    explain_file="${DB_TEST_DIR}/explain_$(echo ${query} | md5sum | cut -d' ' -f1)_${TIMESTAMP}.txt"
    PGPASSWORD="${DATABASE_PASSWORD}" psql -h "${DATABASE_HOST}" -p "${DATABASE_PORT}" -U "${DATABASE_USER}" -d "${DATABASE_NAME}" \
      -c "EXPLAIN ANALYZE ${query}" > "${explain_file}" 2>/dev/null || echo "Query failed: ${query}" >> "${explain_file}"
    
    # Extract metrics
    execution_time=$(grep "Execution Time" "${explain_file}" | awk '{print $3}' || echo "N/A")
    index_used=$(grep "Index" "${explain_file}" | head -1 | awk '{print $2}' || echo "None")
    
    # Generate recommendations
    if grep -q "Seq Scan" "${explain_file}"; then
      recommendations="Consider adding index to avoid sequential scan"
    elif grep -q "cost=" "${explain_file}" | awk -F'=' '{print $2}' | awk '{print $1}' | awk -F'..' '{print $1}' | grep -q "^[0-9]\+$" && [ $(grep "cost=" "${explain_file}" | awk -F'=' '{print $2}' | awk '{print $1}' | awk -F'..' '{print $1}') -gt 1000 ]; then
      recommendations="High cost query, consider optimization"
    else
      recommendations="Query performs well"
    fi
    
    # Add to report
    echo "| \`${query}\` | ${execution_time} | ${index_used} | ${recommendations} |" >> "${REPORT_FILE}"
  done
  
  echo "" >> "${REPORT_FILE}"
  echo "Detailed query plans are available in the \`${DB_TEST_DIR}\` directory." >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
}

# Analyze service memory and CPU usage
analyze_resource_usage() {
  echo "Analyzing service resource usage..."
  
  echo "### Resource Usage Analysis" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  
  # Get service process IDs
  SERVICE_PIDS=$(pgrep -f "service_layer" || echo "")
  
  if [ -z "${SERVICE_PIDS}" ]; then
    echo "Warning: Could not find service process IDs. Resource usage analysis skipped." | tee -a "${REPORT_FILE}"
    echo "" >> "${REPORT_FILE}"
    return
  fi
  
  echo "#### Memory Usage" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "| Process | PID | Memory Usage (MB) | CPU % |" >> "${REPORT_FILE}"
  echo "|---------|-----|------------------|-------|" >> "${REPORT_FILE}"
  
  for pid in ${SERVICE_PIDS}; do
    process_name=$(ps -p ${pid} -o comm= || echo "unknown")
    memory_usage=$(ps -p ${pid} -o rss= | awk '{print $1/1024}' || echo "N/A")
    cpu_usage=$(ps -p ${pid} -o %cpu= | tr -d ' ' || echo "N/A")
    
    echo "| ${process_name} | ${pid} | ${memory_usage} | ${cpu_usage} |" >> "${REPORT_FILE}"
  done
  
  echo "" >> "${REPORT_FILE}"
}

# Identify slow database queries from logs
analyze_slow_queries() {
  echo "Analyzing slow database queries..."
  LOG_FILE="/var/log/postgresql/postgresql-slow.log"
  
  if [ ! -f "${LOG_FILE}" ]; then
    echo "Slow query log not found at ${LOG_FILE}. Skipping slow query analysis."
    return
  fi
  
  echo "### Slow Database Queries" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  
  # Extract slow queries from the last 24 hours
  slow_queries=$(grep "duration:" "${LOG_FILE}" | grep -v "duration: 0" | tail -50)
  
  if [ -z "${slow_queries}" ]; then
    echo "No slow queries found in the logs." >> "${REPORT_FILE}"
    echo "" >> "${REPORT_FILE}"
    return
  fi
  
  echo "| Query | Duration (ms) | Time Observed |" >> "${REPORT_FILE}"
  echo "|-------|---------------|---------------|" >> "${REPORT_FILE}"
  
  echo "${slow_queries}" | while read -r line; do
    query=$(echo "${line}" | sed -E 's/.*LOG:  //g' | sed -E 's/duration:.+//g' | tr -d '\n')
    duration=$(echo "${line}" | grep -o "duration: [0-9.]*" | awk '{print $2}')
    timestamp=$(echo "${line}" | grep -o "^[0-9-]* [0-9:]*" || echo "unknown")
    
    # Truncate query if too long
    if [ ${#query} -gt 100 ]; then
      query="${query:0:100}..."
    fi
    
    echo "| \`${query}\` | ${duration} | ${timestamp} |" >> "${REPORT_FILE}"
  done
  
  echo "" >> "${REPORT_FILE}"
  echo "Consider optimizing these slow queries by adding appropriate indexes or rewriting them." >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
}

# Generate optimization recommendations
generate_recommendations() {
  echo "Generating optimization recommendations..."
  
  echo "## Performance Optimization Recommendations" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  
  # API Optimization
  echo "### API Optimization" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "1. **Implement Response Caching**" >> "${REPORT_FILE}"
  echo "   - Add Redis caching for frequently accessed endpoints" >> "${REPORT_FILE}"
  echo "   - Implement cache invalidation strategies for real-time data" >> "${REPORT_FILE}"
  echo "   - Consider browser caching with appropriate cache headers" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "2. **Optimize API Responses**" >> "${REPORT_FILE}"
  echo "   - Implement pagination for list endpoints" >> "${REPORT_FILE}"
  echo "   - Support field filtering to return only required data" >> "${REPORT_FILE}"
  echo "   - Use compression (gzip) for response bodies" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  
  # Database Optimization
  echo "### Database Optimization" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "1. **Index Optimization**" >> "${REPORT_FILE}"
  echo "   - Analyze and add missing indexes for frequent queries" >> "${REPORT_FILE}"
  echo "   - Consider composite indexes for multi-column filters" >> "${REPORT_FILE}"
  echo "   - Remove unused indexes to improve write performance" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "2. **Query Optimization**" >> "${REPORT_FILE}"
  echo "   - Rewrite complex joins to use more efficient query patterns" >> "${REPORT_FILE}"
  echo "   - Use database-specific optimizations (e.g., EXPLAIN ANALYZE)" >> "${REPORT_FILE}"
  echo "   - Consider database denormalization for read-heavy tables" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  
  # System Optimization
  echo "### System Optimization" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "1. **Resource Allocation**" >> "${REPORT_FILE}"
  echo "   - Adjust go service garbage collection parameters" >> "${REPORT_FILE}"
  echo "   - Optimize PostgreSQL configuration (shared_buffers, work_mem, etc.)" >> "${REPORT_FILE}"
  echo "   - Consider vertical scaling for critical components" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
  echo "2. **Concurrency Improvements**" >> "${REPORT_FILE}"
  echo "   - Implement or optimize connection pooling" >> "${REPORT_FILE}"
  echo "   - Consider asynchronous processing for non-critical operations" >> "${REPORT_FILE}"
  echo "   - Implement rate limiting to prevent overload" >> "${REPORT_FILE}"
  echo "" >> "${REPORT_FILE}"
}

# Generate the report header
generate_report_header() {
  cat > "${REPORT_FILE}" << EOF
# Neo N3 Service Layer Performance Optimization Report

**Generated:** $(date)

This report provides an analysis of the performance characteristics of the Neo N3 Service Layer and recommends optimizations to improve performance, scalability, and resource utilization.

## Environment

- **Service URL:** ${SERVICE_URL}
- **Database:** PostgreSQL ${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}

## Performance Analysis

EOF
}

# Main execution
main() {
  install_tools
  verify_service
  
  # Initialize the report
  generate_report_header
  
  # Run performance tests
  run_api_performance_tests
  run_database_performance_tests
  analyze_resource_usage
  analyze_slow_queries
  
  # Generate recommendations
  generate_recommendations
  
  echo "Performance optimization analysis completed. Report saved to: ${REPORT_FILE}"
}

main 