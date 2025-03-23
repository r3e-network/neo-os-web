package middleware

import (
	"strconv"
	"time"

	"github.com/R3E-Network/service_layer/internal/metrics"
	"github.com/gin-gonic/gin"
)

// MetricsMiddleware collects metrics for all HTTP requests
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		
		// Process request
		c.Next()
		
		// Skip metrics for prometheus endpoint to avoid circular dependencies
		if c.Request.URL.Path == "/metrics" {
			return
		}
		
		// Record request duration
		duration := time.Since(start).Seconds()
		
		// Extract path, method and status
		path := c.FullPath()
		if path == "" {
			path = "unknown"
		}
		
		method := c.Request.Method
		status := strconv.Itoa(c.Writer.Status())
		
		// Record metrics
		metrics.RequestsTotal.WithLabelValues(method, path, status).Inc()
		metrics.RequestDuration.WithLabelValues(method, path).Observe(duration)
	}
}

// TrackDatabaseOperation creates a timer to track database operations
func TrackDatabaseOperation(operation string, repository string) *metrics.Timer {
	return metrics.NewTimer(metrics.DatabaseOperationDuration.WithLabelValues(operation, repository))
}

// RecordDatabaseOperation records a database operation
func RecordDatabaseOperation(operation string, repository string, status string, err error) {
	if err == nil {
		metrics.DatabaseOperationsTotal.WithLabelValues(operation, repository, "success").Inc()
	} else {
		metrics.DatabaseOperationsTotal.WithLabelValues(operation, repository, "error").Inc()
	}
}

// TrackFunctionExecution creates a timer for tracking function execution
func TrackFunctionExecution(functionID string) *metrics.Timer {
	return metrics.NewTimer(metrics.FunctionExecutionDuration.WithLabelValues(functionID))
}

// RecordFunctionExecution records a function execution
func RecordFunctionExecution(functionID string, status string, memoryUsageBytes int64) {
	metrics.FunctionExecutionsTotal.WithLabelValues(status, functionID).Inc()
	if memoryUsageBytes > 0 {
		metrics.FunctionMemoryUsage.WithLabelValues(functionID).Observe(float64(memoryUsageBytes))
	}
}

// TrackBlockchainOperation creates a timer for tracking blockchain operations
func TrackBlockchainOperation(operation string) *metrics.Timer {
	return metrics.NewTimer(metrics.BlockchainOperationDuration.WithLabelValues(operation))
}

// RecordBlockchainOperation records a blockchain operation
func RecordBlockchainOperation(operation string, status string) {
	metrics.BlockchainOperationsTotal.WithLabelValues(operation, status).Inc()
}

// TrackTEEOperation creates a timer for tracking TEE operations
func TrackTEEOperation(provider string) *metrics.Timer {
	return metrics.NewTimer(metrics.TEEAttestationDuration.WithLabelValues(provider))
}

// RecordTEEOperation records a TEE operation
func RecordTEEOperation(operation string, status string) {
	metrics.TEEOperationsTotal.WithLabelValues(operation, status).Inc()
}

// TrackSecretOperation creates a timer for tracking secret operations
func TrackSecretOperation(operation string) *metrics.Timer {
	return metrics.NewTimer(metrics.SecretOperationDuration.WithLabelValues(operation))
}

// RecordSecretOperation records a secret operation
func RecordSecretOperation(operation string, status string) {
	metrics.SecretOperationsTotal.WithLabelValues(operation, status).Inc()
}