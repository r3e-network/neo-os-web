package monitoring

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Function execution metrics
	FunctionExecutionCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_layer_function_executions_total",
			Help: "The total number of function executions",
		},
		[]string{"function_id", "user_id", "status"},
	)

	FunctionExecutionDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "service_layer_function_execution_duration_seconds",
			Help:    "Function execution duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15), // From 1ms to ~16s
		},
		[]string{"function_id", "user_id"},
	)

	FunctionMemoryUsage = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "service_layer_function_memory_usage_bytes",
			Help:    "Function memory usage in bytes",
			Buckets: prometheus.ExponentialBuckets(1024*1024, 2, 10), // From 1MB to ~1GB
		},
		[]string{"function_id", "user_id"},
	)

	// Secret management metrics
	SecretOperationsCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_layer_secret_operations_total",
			Help: "The total number of secret operations",
		},
		[]string{"user_id", "operation", "status"},
	)

	SecretCount = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "service_layer_secrets_count",
			Help: "The number of secrets stored per user",
		},
		[]string{"user_id"},
	)

	// TEE metrics
	TEEAttestationCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_layer_tee_attestations_total",
			Help: "The total number of TEE attestation operations",
		},
		[]string{"status"},
	)

	TEEAttestationDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "service_layer_tee_attestation_duration_seconds",
			Help:    "TEE attestation duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.01, 2, 10), // From 10ms to ~5s
		},
	)

	// API metrics
	APIRequestsCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_layer_api_requests_total",
			Help: "The total number of API requests",
		},
		[]string{"path", "method", "status"},
	)

	APIRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "service_layer_api_request_duration_seconds",
			Help:    "API request duration in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15), // From 1ms to ~16s
		},
		[]string{"path", "method"},
	)

	// Health metrics
	SystemUptime = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "service_layer_uptime_seconds_total",
			Help: "The total uptime of the service layer in seconds",
		},
	)

	DatabaseConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "service_layer_database_connections",
			Help: "The number of active database connections",
		},
	)

	BlockchainConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "service_layer_blockchain_connections",
			Help: "The number of active blockchain node connections",
		},
	)

	// Gas bank metrics
	GasBankBalance = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "service_layer_gas_bank_balance",
			Help: "The current balance of the gas bank",
		},
		[]string{"asset"},
	)

	GasBankTransactionsCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_layer_gas_bank_transactions_total",
			Help: "The total number of gas bank transactions",
		},
		[]string{"operation", "status"},
	)

	// Error metrics
	ErrorsCount = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_layer_errors_total",
			Help: "The total number of errors",
		},
		[]string{"component", "error_type"},
	)

	// System resource metrics
	SystemCPUUsage = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "service_layer_system_cpu_usage",
			Help: "The CPU usage of the service layer",
		},
	)

	SystemMemoryUsage = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "service_layer_system_memory_bytes",
			Help: "The memory usage of the service layer in bytes",
		},
	)

	SystemGoroutines = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "service_layer_goroutines",
			Help: "The number of goroutines",
		},
	)
)

// RecordFunctionExecution records metrics for a function execution
func RecordFunctionExecution(functionID, userID string, durationSeconds float64, memoryBytes float64, status string) {
	FunctionExecutionCount.WithLabelValues(functionID, userID, status).Inc()
	FunctionExecutionDuration.WithLabelValues(functionID, userID).Observe(durationSeconds)
	FunctionMemoryUsage.WithLabelValues(functionID, userID).Observe(memoryBytes)
}

// RecordSecretOperation records metrics for a secret operation
func RecordSecretOperation(userID string, operation string, status string) {
	SecretOperationsCount.WithLabelValues(userID, operation, status).Inc()
}

// UpdateSecretCount updates the count of secrets for a user
func UpdateSecretCount(userID string, count int) {
	SecretCount.WithLabelValues(userID).Set(float64(count))
}

// RecordTEEAttestation records metrics for a TEE attestation
func RecordTEEAttestation(durationSeconds float64, status string) {
	TEEAttestationCount.WithLabelValues(status).Inc()
	TEEAttestationDuration.Observe(durationSeconds)
}

// RecordAPIRequest records metrics for an API request
func RecordAPIRequest(path, method, status string, durationSeconds float64) {
	APIRequestsCount.WithLabelValues(path, method, status).Inc()
	APIRequestDuration.WithLabelValues(path, method).Observe(durationSeconds)
}

// RecordError records an error
func RecordError(component, errorType string) {
	ErrorsCount.WithLabelValues(component, errorType).Inc()
}

// UpdateGasBankBalance updates the gas bank balance
func UpdateGasBankBalance(asset string, balance float64) {
	GasBankBalance.WithLabelValues(asset).Set(balance)
}

// RecordGasBankTransaction records a gas bank transaction
func RecordGasBankTransaction(operation, status string) {
	GasBankTransactionsCount.WithLabelValues(operation, status).Inc()
}

// UpdateSystemMetrics updates system resource metrics
func UpdateSystemMetrics(cpuUsage, memoryBytes float64, goroutines int) {
	SystemCPUUsage.Set(cpuUsage)
	SystemMemoryUsage.Set(memoryBytes)
	SystemGoroutines.Set(float64(goroutines))
}

// UpdateDatabaseConnections updates the active database connections metric
func UpdateDatabaseConnections(connections int) {
	DatabaseConnections.Set(float64(connections))
}

// UpdateBlockchainConnections updates the active blockchain connections metric
func UpdateBlockchainConnections(connections int) {
	BlockchainConnections.Set(float64(connections))
}
