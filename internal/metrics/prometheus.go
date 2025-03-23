package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Registry is the Prometheus registry for all metrics
	Registry = prometheus.NewRegistry()

	// Factory for creating metrics
	factory = promauto.With(Registry)

	// General metrics
	RequestsTotal = factory.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_layer_requests_total",
			Help: "Total number of API requests processed",
		},
		[]string{"method", "endpoint", "status"},
	)

	RequestDuration = factory.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "service_layer_request_duration_seconds",
			Help:    "Duration of API requests in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15), // from 1ms to ~16s
		},
		[]string{"method", "endpoint"},
	)

	// Function metrics
	FunctionExecutionsTotal = factory.NewCounterVec(
		prometheus.CounterOpts{
			Name: "function_executions_total",
			Help: "Total number of function executions",
		},
		[]string{"status", "function_id"},
	)

	FunctionExecutionDuration = factory.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "function_execution_duration_seconds",
			Help:    "Duration of function executions in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15), // from 1ms to ~16s
		},
		[]string{"function_id"},
	)

	FunctionMemoryUsage = factory.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "function_memory_usage_bytes",
			Help:    "Memory usage of function executions in bytes",
			Buckets: prometheus.ExponentialBuckets(1024*1024, 2, 10), // from 1MB to ~1GB
		},
		[]string{"function_id"},
	)

	// Blockchain metrics
	BlockchainOperationsTotal = factory.NewCounterVec(
		prometheus.CounterOpts{
			Name: "blockchain_operations_total",
			Help: "Total number of blockchain operations",
		},
		[]string{"operation", "status"},
	)

	BlockchainOperationDuration = factory.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "blockchain_operation_duration_seconds",
			Help:    "Duration of blockchain operations in seconds",
			Buckets: prometheus.ExponentialBuckets(0.01, 2, 10), // from 10ms to ~5s
		},
		[]string{"operation"},
	)

	// TEE metrics
	TEEOperationsTotal = factory.NewCounterVec(
		prometheus.CounterOpts{
			Name: "tee_operations_total",
			Help: "Total number of TEE operations",
		},
		[]string{"operation", "status"},
	)

	TEEAttestationDuration = factory.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "tee_attestation_duration_seconds",
			Help:    "Duration of TEE attestation in seconds",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 8), // from 100ms to ~12s
		},
		[]string{"provider"},
	)

	// Secret management metrics
	SecretOperationsTotal = factory.NewCounterVec(
		prometheus.CounterOpts{
			Name: "secret_operations_total",
			Help: "Total number of secret operations",
		},
		[]string{"operation", "status"},
	)

	SecretOperationDuration = factory.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "secret_operation_duration_seconds",
			Help:    "Duration of secret operations in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 10), // from 1ms to ~1s
		},
		[]string{"operation"},
	)

	// Database metrics
	DatabaseOperationsTotal = factory.NewCounterVec(
		prometheus.CounterOpts{
			Name: "database_operations_total",
			Help: "Total number of database operations",
		},
		[]string{"operation", "repository", "status"},
	)

	DatabaseOperationDuration = factory.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "database_operation_duration_seconds",
			Help:    "Duration of database operations in seconds",
			Buckets: prometheus.ExponentialBuckets(0.0005, 2, 12), // from 0.5ms to ~1s
		},
		[]string{"operation", "repository"},
	)

	// System metrics
	MemoryUsage = factory.NewGauge(
		prometheus.GaugeOpts{
			Name: "system_memory_usage_bytes",
			Help: "Current memory usage of the service",
		},
	)

	GoroutinesCount = factory.NewGauge(
		prometheus.GaugeOpts{
			Name: "system_goroutines_count",
			Help: "Current number of goroutines",
		},
	)

	OpenConnections = factory.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "system_open_connections",
			Help: "Current number of open connections",
		},
		[]string{"type"},
	)

	// Rate limiting metrics
	RateLimitExceededTotal = factory.NewCounter(
		prometheus.CounterOpts{
			Name: "rate_limit_exceeded_total",
			Help: "Total number of requests that exceeded the rate limit",
		},
	)
)

// Timer is a helper for measuring durations
type Timer struct {
	start    time.Time
	observer prometheus.Observer
}

// NewTimer creates a new timer that will observe the duration using the given observer
func NewTimer(observer prometheus.Observer) *Timer {
	return &Timer{
		start:    time.Now(),
		observer: observer,
	}
}

// ObserveDuration ends the timer and observes the duration
func (t *Timer) ObserveDuration() {
	duration := time.Since(t.start).Seconds()
	t.observer.Observe(duration)
}
