#!/bin/bash

# monitor_system_resources.sh - Script to monitor system resources during performance tests
# This script collects CPU, memory, disk I/O, and network metrics during a performance test

set -e

# Define output directory
OUTPUT_DIR="./performance-reports/system-metrics"
mkdir -p "$OUTPUT_DIR"

# Define timestamp for this run
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
METRICS_DIR="$OUTPUT_DIR/$TIMESTAMP"
mkdir -p "$METRICS_DIR"

# Define log file
LOG_FILE="$METRICS_DIR/system_metrics.log"
touch "$LOG_FILE"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Check if required tools are installed
check_prerequisites() {
    log "Checking prerequisites..."
    
    MISSING_TOOLS=()
    
    # Check for top/htop
    if ! command -v top &> /dev/null; then
        MISSING_TOOLS+=("top")
    fi
    
    # Check for iostat
    if ! command -v iostat &> /dev/null; then
        MISSING_TOOLS+=("iostat (sysstat)")
    fi
    
    # Check for netstat
    if ! command -v netstat &> /dev/null && ! command -v ss &> /dev/null; then
        MISSING_TOOLS+=("netstat or ss")
    fi
    
    # Check for docker stats if using docker
    if command -v docker &> /dev/null; then
        if ! docker ps &> /dev/null; then
            log "Docker is installed but not running or permission denied."
        fi
    else
        log "Docker not found. Container metrics will not be collected."
    fi
    
    # Report missing tools
    if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
        log "The following tools are missing and should be installed for complete metrics:"
        for tool in "${MISSING_TOOLS[@]}"; do
            log "  - $tool"
        done
    else
        log "All required tools are available."
    fi
}

# Collect CPU and memory metrics
collect_system_metrics() {
    log "Collecting system metrics (CPU, memory)..."
    
    # Collect CPU and memory metrics every 5 seconds
    top -b -d 5 -n $(( $DURATION / 5 )) > "$METRICS_DIR/top_output.txt" 2>&1 &
    TOP_PID=$!
    
    # If htop is available, use it for more detailed CPU info
    if command -v htop &> /dev/null; then
        htop --delay=20 --no-mouse --no-color -C > "$METRICS_DIR/htop_output.txt" 2>/dev/null &
        HTOP_PID=$!
    fi
    
    log "System metric collection started (PID: $TOP_PID)"
}

# Collect disk I/O metrics
collect_disk_metrics() {
    log "Collecting disk I/O metrics..."
    
    # Check if iostat is available
    if ! command -v iostat &> /dev/null; then
        log "iostat not found. Disk metrics will not be collected."
        return
    fi
    
    # Collect disk I/O metrics every 5 seconds
    iostat -xmt 5 $(( $DURATION / 5 )) > "$METRICS_DIR/iostat_output.txt" 2>&1 &
    IOSTAT_PID=$!
    
    log "Disk I/O metric collection started (PID: $IOSTAT_PID)"
}

# Collect network metrics
collect_network_metrics() {
    log "Collecting network metrics..."
    
    # Collect network metrics every 5 seconds
    if command -v netstat &> /dev/null; then
        (
            for i in $(seq 1 $(( $DURATION / 5 ))); do
                echo "==== Network stats at $(date) ===="
                netstat -s
                echo ""
                echo "==== Network connections at $(date) ===="
                netstat -an | grep -E "ESTABLISHED|LISTEN" | wc -l
                echo ""
                sleep 5
            done
        ) > "$METRICS_DIR/netstat_output.txt" 2>&1 &
        NETSTAT_PID=$!
    elif command -v ss &> /dev/null; then
        (
            for i in $(seq 1 $(( $DURATION / 5 ))); do
                echo "==== Network stats at $(date) ===="
                ss -s
                echo ""
                echo "==== Network connections at $(date) ===="
                ss -tan | grep -E "ESTAB|LISTEN" | wc -l
                echo ""
                sleep 5
            done
        ) > "$METRICS_DIR/ss_output.txt" 2>&1 &
        NETSTAT_PID=$!
    else
        log "Neither netstat nor ss found. Network metrics will not be collected."
        return
    fi
    
    log "Network metric collection started (PID: $NETSTAT_PID)"
}

# Collect Docker container metrics
collect_docker_metrics() {
    log "Collecting Docker container metrics..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log "Docker not found. Container metrics will not be collected."
        return
    fi
    
    # Check if Docker is running
    if ! docker ps &> /dev/null; then
        log "Docker is not running or permission denied. Container metrics will not be collected."
        return
    fi
    
    # Get container IDs for service layer
    CONTAINERS=$(docker ps --filter "name=service_layer" --format "{{.ID}}" || echo "")
    
    if [ -z "$CONTAINERS" ]; then
        log "No service_layer containers found. Checking for all containers..."
        CONTAINERS=$(docker ps --format "{{.ID}}" || echo "")
    fi
    
    if [ -z "$CONTAINERS" ]; then
        log "No running containers found. Container metrics will not be collected."
        return
    fi
    
    # Collect Docker stats
    docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" --no-stream > "$METRICS_DIR/docker_stats_initial.txt" 2>&1
    
    (
        for i in $(seq 1 $(( $DURATION / 10 ))); do
            echo "==== Docker stats at $(date) ===="
            docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" --no-stream
            echo ""
            sleep 10
        done
    ) > "$METRICS_DIR/docker_stats.txt" 2>&1 &
    DOCKER_PID=$!
    
    log "Docker metric collection started (PID: $DOCKER_PID)"
}

# Collect database metrics if possible
collect_database_metrics() {
    log "Collecting database metrics..."
    
    # This is a placeholder for database-specific monitoring
    # In a real implementation, you would add PostgreSQL or other database monitoring here
    
    log "Database metric collection not implemented."
}

# Generate a summary report
generate_summary() {
    log "Generating summary report..."
    
    SUMMARY_FILE="$METRICS_DIR/summary.md"
    
    cat > "$SUMMARY_FILE" << EOL
# System Resource Monitoring Summary

**Date:** $(date)
**Duration:** $DURATION seconds

## CPU Usage

\`\`\`
$(grep "%Cpu" "$METRICS_DIR/top_output.txt" | head -5)
\`\`\`

## Memory Usage

\`\`\`
$(grep "KiB Mem" "$METRICS_DIR/top_output.txt" | head -5)
$(grep "KiB Swap" "$METRICS_DIR/top_output.txt" | head -5)
\`\`\`

EOL

    # Add disk metrics if available
    if [ -f "$METRICS_DIR/iostat_output.txt" ]; then
        cat >> "$SUMMARY_FILE" << EOL
## Disk I/O

\`\`\`
$(grep -A 20 "Device" "$METRICS_DIR/iostat_output.txt" | head -10)
\`\`\`

EOL
    fi

    # Add network metrics if available
    if [ -f "$METRICS_DIR/netstat_output.txt" ]; then
        cat >> "$SUMMARY_FILE" << EOL
## Network Statistics

\`\`\`
$(grep -A 10 "Network stats" "$METRICS_DIR/netstat_output.txt" | head -10)
\`\`\`

EOL
    elif [ -f "$METRICS_DIR/ss_output.txt" ]; then
        cat >> "$SUMMARY_FILE" << EOL
## Network Statistics

\`\`\`
$(grep -A 10 "Network stats" "$METRICS_DIR/ss_output.txt" | head -10)
\`\`\`

EOL
    fi

    # Add Docker metrics if available
    if [ -f "$METRICS_DIR/docker_stats.txt" ]; then
        cat >> "$SUMMARY_FILE" << EOL
## Docker Container Metrics

\`\`\`
$(grep -A 10 "Docker stats" "$METRICS_DIR/docker_stats.txt" | head -10)
\`\`\`

EOL
    fi

    log "Summary report generated at $SUMMARY_FILE"
}

# Cleanup function to kill all monitoring processes
cleanup() {
    log "Stopping monitoring processes..."
    
    if [ ! -z ${TOP_PID+x} ]; then kill $TOP_PID 2>/dev/null || true; fi
    if [ ! -z ${HTOP_PID+x} ]; then kill $HTOP_PID 2>/dev/null || true; fi
    if [ ! -z ${IOSTAT_PID+x} ]; then kill $IOSTAT_PID 2>/dev/null || true; fi
    if [ ! -z ${NETSTAT_PID+x} ]; then kill $NETSTAT_PID 2>/dev/null || true; fi
    if [ ! -z ${DOCKER_PID+x} ]; then kill $DOCKER_PID 2>/dev/null || true; fi
    
    log "All monitoring processes stopped."
    log "Resource monitoring complete. Results are in: $METRICS_DIR"
}

# Main function
main() {
    log "Starting system resource monitoring at $(date)"
    
    # Set duration from argument or default to 5 minutes
    DURATION=${1:-300}
    log "Monitoring duration: $DURATION seconds"
    
    # Run in a trap to ensure cleanup on exit
    trap cleanup EXIT INT TERM
    
    # Check prerequisites
    check_prerequisites
    
    # Start all monitoring
    collect_system_metrics
    collect_disk_metrics
    collect_network_metrics
    collect_docker_metrics
    collect_database_metrics
    
    # Wait for the specified duration
    log "Monitoring in progress. Will run for $DURATION seconds..."
    sleep $DURATION
    
    # Generate summary
    generate_summary
    
    log "Monitoring completed at $(date)"
}

# Run the main function with the provided duration or default
main $1