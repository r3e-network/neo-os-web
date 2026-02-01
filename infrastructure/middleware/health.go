// Package middleware provides HTTP middleware for the service layer.
package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"runtime"
	"sync"
	"time"
)

// HealthStatus represents the health check response.
type HealthStatus struct {
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Version   string            `json:"version,omitempty"`
	Checks    map[string]string `json:"checks,omitempty"`
	Uptime    string            `json:"uptime,omitempty"`
}

// HealthChecker provides health check functionality.
type HealthChecker struct {
	mu        sync.RWMutex
	version   string
	startTime time.Time
	checks    map[string]func() error
}

// NewHealthChecker creates a new health checker.
func NewHealthChecker(version string) *HealthChecker {
	return &HealthChecker{
		version:   version,
		startTime: time.Now(),
		checks:    make(map[string]func() error),
	}
}

// RegisterCheck adds a health check function.
func (h *HealthChecker) RegisterCheck(name string, check func() error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checks[name] = check
}

// Handler returns the health check HTTP handler.
func (h *HealthChecker) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h.mu.RLock()
		defer h.mu.RUnlock()

		status := HealthStatus{
			Status:    "healthy",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Version:   h.version,
			Uptime:    time.Since(h.startTime).String(),
			Checks:    make(map[string]string),
		}

		// Run all registered checks
		for name, check := range h.checks {
			if err := check(); err != nil {
				status.Status = "unhealthy"
				status.Checks[name] = err.Error()
			} else {
				status.Checks[name] = "ok"
			}
		}

		w.Header().Set("Content-Type", "application/json")
		if status.Status != "healthy" {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		if encodeErr := json.NewEncoder(w).Encode(status); encodeErr != nil {
			log.Printf("health handler encode failed: %v", encodeErr)
		}
	}
}

// LivenessHandler returns a simple liveness probe handler.
func LivenessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if encodeErr := json.NewEncoder(w).Encode(map[string]string{
			"status": "alive",
		}); encodeErr != nil {
			log.Printf("liveness handler encode failed: %v", encodeErr)
		}
	}
}

// ReadinessHandler returns a readiness probe handler.
func ReadinessHandler(ready *bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if ready != nil && *ready {
			if encodeErr := json.NewEncoder(w).Encode(map[string]string{
				"status": "ready",
			}); encodeErr != nil {
				log.Printf("readiness handler encode failed: %v", encodeErr)
			}
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			if encodeErr := json.NewEncoder(w).Encode(map[string]string{
				"status": "not_ready",
			}); encodeErr != nil {
				log.Printf("readiness handler encode failed: %v", encodeErr)
			}
		}
	}
}

// RuntimeStats returns runtime statistics.
func RuntimeStats() map[string]interface{} {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return map[string]interface{}{
		"goroutines": runtime.NumGoroutine(),
		"alloc_mb":   m.Alloc / 1024 / 1024,
		"sys_mb":     m.Sys / 1024 / 1024,
		"num_gc":     m.NumGC,
		"go_version": runtime.Version(),
		"num_cpu":    runtime.NumCPU(),
	}
}
