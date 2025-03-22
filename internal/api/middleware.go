package api

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Prometheus metrics
var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10},
		},
		[]string{"method", "path"},
	)
)

func init() {
	// Register metrics with Prometheus
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
}

// corsMiddleware handles CORS headers
func corsMiddleware(corsConfig config.CORSConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Set CORS headers
		c.Writer.Header().Set("Access-Control-Allow-Origin", corsConfig.AllowedOrigins[0])
		c.Writer.Header().Set("Access-Control-Allow-Methods", joinStrings(corsConfig.AllowedMethods, ", "))
		c.Writer.Header().Set("Access-Control-Allow-Headers", joinStrings(corsConfig.AllowedHeaders, ", "))
		c.Writer.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", corsConfig.MaxAge))

		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// loggerMiddleware logs HTTP requests
func loggerMiddleware(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start timer
		start := time.Now()

		// Process request
		c.Next()

		// Calculate request duration
		duration := time.Since(start)

		// Log request
		log.WithFields(map[string]interface{}{
			"method":     c.Request.Method,
			"path":       c.Request.URL.Path,
			"status":     c.Writer.Status(),
			"duration":   duration.Seconds(),
			"client_ip":  c.ClientIP(),
			"user_agent": c.Request.UserAgent(),
		}).Info("HTTP request")
	}
}

// prometheusMiddleware collects Prometheus metrics for HTTP requests
func prometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start timer
		start := time.Now()

		// Process request
		c.Next()

		// Calculate request duration
		duration := time.Since(start).Seconds()

		// Update metrics
		httpRequestsTotal.With(prometheus.Labels{
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
			"status": fmt.Sprintf("%d", c.Writer.Status()),
		}).Inc()

		httpRequestDuration.With(prometheus.Labels{
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
		}).Observe(duration)
	}
}

// authMiddleware authenticates requests using JWT
func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// TODO: Implement proper JWT validation
		// This is a placeholder for the actual implementation

		// For now, just continue
		c.Next()
	}
}

// Helper function to join string slices
func joinStrings(strings []string, separator string) string {
	if len(strings) == 0 {
		return ""
	}

	result := strings[0]
	for i := 1; i < len(strings); i++ {
		result += separator + strings[i]
	}

	return result
}