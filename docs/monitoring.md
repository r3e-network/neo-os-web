# Monitoring

The Service Layer includes comprehensive monitoring capabilities for tracking performance, health, and usage statistics.

## Monitoring Components

The monitoring system consists of several key components:

1. **Metrics Collection**: Automatic collection of system, process, and application metrics using Prometheus
2. **Health Checks**: Endpoints for checking the health of the service and its dependencies
3. **Logging**: Structured logging with different verbosity levels
4. **Dashboards**: Grafana dashboards for visualizing metrics and system health

## Metrics

The Service Layer exposes a wide range of metrics for monitoring via the `/metrics` endpoint. These metrics are organized into several categories:

### System Metrics

- Memory usage (total, heap, stack)
- CPU usage (system and process level)
- Disk usage and I/O
- Goroutine count
- GC statistics
- Uptime

### API Metrics

- Request counts (by endpoint and status code)
- Request duration (by endpoint)
- Error rates

### Service-Specific Metrics

- **Functions**: Execution count, duration, memory usage
- **TEE**: Attestation operations, verify operations
- **Blockchain**: Transaction count, confirmation time
- **Gas Bank**: Transaction volume, balance
- **Oracle**: Request count, response time
- **Secrets**: Operation count, access patterns
- **Price Feed**: Update frequency, latency

### Database Metrics

- Query counts and duration
- Connection pool statistics
- Slow query tracking

## Health Check Endpoints

The service provides several endpoints for monitoring its health:

### `/health`

The main health check endpoint returns the overall status of the service and its components.

Example response:
```json
{
  "status": "healthy",        // "healthy", "degraded", or "unhealthy"
  "version": "0.1.0",
  "components": {
    "database": {
      "status": "healthy",
      "details": {
        "open_connections": 10,
        "in_use": 2,
        "idle": 8,
        "wait_count": 0,
        "wait_duration": "0s",
        "max_idle_closed": 0,
        "max_lifetime_closed": 0
      }
    },
    "blockchain": {
      "status": "healthy",
      "details": {
        "current_height": 12345
      }
    },
    "tee": {
      "status": "healthy",
      "details": {
        "attestation_status": "verified",
        "provider": "azure"
      }
    }
  },
  "system": {
    "uptime": "3h12m45s",
    "goroutines": 24,
    "memory": {
      "alloc": "45.21 MB",
      "total_alloc": "138.45 MB",
      "sys": "72.56 MB",
      "heap_alloc": "42.18 MB",
      "heap_sys": "64.00 MB",
      "num_gc": 12
    },
    "environment": "production"
  },
  "timestamp": "2023-08-15T12:34:56Z"
}
```

### `/health/readiness`

Indicates whether the service is ready to accept requests. Returns a 200 status code if ready, 503 otherwise.

### `/health/liveness`

Indicates whether the service is running. Returns a 200 status code if alive.

## Metrics Collector

The service includes an automatic metrics collector that gathers system and process metrics at regular intervals. This collector:

1. Runs in the background with minimal overhead
2. Collects memory, CPU, disk, and goroutine metrics
3. Updates Prometheus metrics that can be scraped via the /metrics endpoint
4. Provides real-time visibility into system performance

The metrics collector is configured via the `monitoring` section in the configuration file:

```yaml
monitoring:
  prometheus:
    enabled: true
    collect_interval_seconds: 15
  logging:
    level: "info"
    format: "json"
    output: "stdout"
```

## Prometheus Integration

The Service Layer exports metrics in Prometheus format via the `/metrics` endpoint. To configure Prometheus to scrape these metrics:

1. Add the Service Layer to your Prometheus configuration:

```yaml
scrape_configs:
  - job_name: 'service_layer'
    metrics_path: /metrics
    static_configs:
      - targets: ['service_layer:8080']
```

2. Prometheus will automatically scrape metrics at the configured interval.

## Grafana Dashboards

The Service Layer includes pre-built Grafana dashboards for visualizing metrics:

1. **System Overview**: Shows system-level metrics including CPU, memory, and disk usage
2. **API Performance**: Displays request counts, latencies, and error rates by endpoint
3. **Service Metrics**: Shows metrics specific to each service component
4. **Database Performance**: Displays database query performance and connection pool statistics

To import these dashboards into Grafana:

1. Go to Dashboards > Import
2. Upload the JSON files from the `devops/grafana/dashboards` directory
3. Select the Prometheus data source

## Alerting

The monitoring system can be configured to send alerts when certain conditions are met. Example alert rules for Prometheus:

```yaml
groups:
- name: service_layer_alerts
  rules:
  - alert: HighMemoryUsage
    expr: service_layer_memory_usage_bytes / service_layer_system_memory_total_bytes > 0.8
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is over 80% for more than 5 minutes"

  - alert: HighCPUUsage
    expr: service_layer_process_cpu_usage_percent > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage"
      description: "CPU usage is over 80% for more than 5 minutes"

  - alert: HighErrorRate
    expr: sum(rate(service_layer_requests_total{status=~"5.."}[5m])) / sum(rate(service_layer_requests_total[5m])) > 0.1
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "High error rate"
      description: "Error rate is over 10% for more than 1 minute"
```

## Monitoring Best Practices

1. **Set up dashboards**: Import the provided Grafana dashboards for a quick overview of system health.
2. **Configure alerts**: Set up alerts for critical metrics to be notified of issues.
3. **Regular review**: Periodically review metrics to identify trends and potential optimizations.
4. **Adjust retention**: Configure appropriate retention periods for metrics based on your needs.
5. **Monitor disk space**: Ensure enough disk space for metrics storage.
6. **Performance impact**: Be aware of the performance impact of high-frequency metrics collection.