package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"runtime"
	"time"

	"github.com/R3E-Network/service_layer/internal/metrics"
	"github.com/R3E-Network/service_layer/internal/version"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// startTime tracks the server start time
var startTime = time.Now()

// RegisterHealthRoutes registers health check endpoints
func (s *Server) RegisterHealthRoutes(router *gin.RouterGroup) {
	health := router.Group("/health")
	{
		health.GET("", s.healthCheckHandler)
		health.GET("/readiness", s.readinessCheckHandler)
		health.GET("/liveness", s.livenessCheckHandler)
	}

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.HandlerFor(metrics.Registry, promhttp.HandlerOpts{})))
}

// healthCheckHandler handles the overall health status endpoint
func (s *Server) healthCheckHandler(c *gin.Context) {
	componentChecks := map[string]map[string]interface{}{
		"database":   s.checkDatabase(),
		"blockchain": s.checkBlockchain(),
		"tee":        s.checkTEE(),
	}

	// Determine overall status
	overallStatus := "healthy"
	for _, check := range componentChecks {
		if check["status"] != "healthy" {
			overallStatus = "degraded"
			if check["status"] == "unhealthy" {
				overallStatus = "unhealthy"
				break
			}
		}
	}

	// Update system metrics
	updateSystemMetrics()

	// Response data
	response := gin.H{
		"status":     overallStatus,
		"version":    version.Version,
		"components": componentChecks,
		"system": gin.H{
			"uptime":      time.Since(startTime).String(),
			"goroutines":  runtime.NumGoroutine(),
			"memory":      getMemoryStats(),
			"environment": s.Config.Environment,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, response)
}

// readinessCheckHandler handles the readiness check endpoint
func (s *Server) readinessCheckHandler(c *gin.Context) {
	// Check database connectivity which is crucial for service readiness
	dbCheck := s.checkDatabase()

	if dbCheck["status"] == "healthy" {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "not ready",
			"reason": dbCheck["message"],
		})
	}
}

// livenessCheckHandler handles the liveness check endpoint
func (s *Server) livenessCheckHandler(c *gin.Context) {
	// For liveness, we just need to confirm the service is responding
	c.JSON(http.StatusOK, gin.H{"status": "alive"})
}

// checkDatabase checks the database connection health
func (s *Server) checkDatabase() map[string]interface{} {
	result := map[string]interface{}{
		"status": "healthy",
	}

	// Ping the database
	if s.DB != nil {
		err := s.DB.Ping()
		if err != nil {
			result["status"] = "unhealthy"
			result["message"] = fmt.Sprintf("Database ping failed: %v", err)
			return result
		}

		// Additional checks - query for a simple result with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		var dummy int
		err = s.DB.QueryRowContext(ctx, "SELECT 1").Scan(&dummy)
		if err != nil {
			result["status"] = "unhealthy"
			result["message"] = fmt.Sprintf("Database query failed: %v", err)
			return result
		}
	} else {
		result["status"] = "unhealthy"
		result["message"] = "Database connection not initialized"
		return result
	}

	// Get connection stats if available
	if db, ok := s.DB.(*sql.DB); ok {
		stats := db.Stats()
		result["details"] = map[string]interface{}{
			"open_connections":    stats.OpenConnections,
			"in_use":              stats.InUse,
			"idle":                stats.Idle,
			"wait_count":          stats.WaitCount,
			"wait_duration":       stats.WaitDuration.String(),
			"max_idle_closed":     stats.MaxIdleClosed,
			"max_lifetime_closed": stats.MaxLifetimeClosed,
		}

		// Update open connections metric
		metrics.OpenConnections.WithLabelValues("database").Set(float64(stats.OpenConnections))
	}

	return result
}

// checkBlockchain checks the blockchain node connection health
func (s *Server) checkBlockchain() map[string]interface{} {
	result := map[string]interface{}{
		"status": "healthy",
	}

	// Check if blockchain service is available
	if s.BlockchainService == nil {
		result["status"] = "unhealthy"
		result["message"] = "Blockchain service not initialized"
		return result
	}

	// Get the latest block height with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	height, err := s.BlockchainService.GetBlockHeight(ctx)
	if err != nil {
		result["status"] = "degraded"
		result["message"] = fmt.Sprintf("Blockchain node connection issue: %v", err)
		return result
	}

	result["details"] = map[string]interface{}{
		"current_height": height,
	}

	return result
}

// checkTEE checks the TEE environment health
func (s *Server) checkTEE() map[string]interface{} {
	result := map[string]interface{}{
		"status": "healthy",
	}

	// Check if TEE service is available
	if s.TEEService == nil {
		result["status"] = "unhealthy"
		result["message"] = "TEE service not initialized"
		return result
	}

	// Get TEE attestation status
	attestationStatus, err := s.TEEService.CheckAttestationStatus()
	if err != nil {
		result["status"] = "degraded"
		result["message"] = fmt.Sprintf("TEE attestation issue: %v", err)
		return result
	}

	result["details"] = map[string]interface{}{
		"attestation_status": attestationStatus,
		"provider":           s.Config.TEE.Provider,
	}

	return result
}

// getMemoryStats returns memory usage statistics
func getMemoryStats() map[string]interface{} {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Update memory usage metric
	metrics.MemoryUsage.Set(float64(memStats.Alloc))

	return map[string]interface{}{
		"alloc":       formatBytes(memStats.Alloc),
		"total_alloc": formatBytes(memStats.TotalAlloc),
		"sys":         formatBytes(memStats.Sys),
		"heap_alloc":  formatBytes(memStats.HeapAlloc),
		"heap_sys":    formatBytes(memStats.HeapSys),
		"num_gc":      memStats.NumGC,
	}
}

// updateSystemMetrics updates system-level metrics
func updateSystemMetrics() {
	// Update goroutines count
	metrics.GoroutinesCount.Set(float64(runtime.NumGoroutine()))

	// Update memory metrics
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	metrics.MemoryUsage.Set(float64(memStats.Alloc))
}

// formatBytes formats bytes to a human-readable string
func formatBytes(bytes uint64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}

	div, exp := uint64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	return fmt.Sprintf("%.2f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
