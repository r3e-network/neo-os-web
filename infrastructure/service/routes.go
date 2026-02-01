// Package service provides common service infrastructure for marble services.
package service

import (
	"net/http"
	"time"

	"github.com/gorilla/mux"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/httputil"
)

// =============================================================================
// Standard Response Types
// =============================================================================

// HealthResponse is the standard response for /health endpoint.
type HealthResponse struct {
	Status    string         `json:"status"`
	Service   string         `json:"service"`
	Version   string         `json:"version"`
	Enclave   bool           `json:"enclave"`
	Timestamp string         `json:"timestamp"`
	Details   map[string]any `json:"details,omitempty"`
}

// InfoResponse is the standard response for /info endpoint.
type InfoResponse struct {
	Status     string         `json:"status"`
	Service    string         `json:"service"`
	Version    string         `json:"version"`
	Enclave    bool           `json:"enclave"`
	Timestamp  string         `json:"timestamp"`
	Statistics map[string]any `json:"statistics,omitempty"`
}

// =============================================================================
// Standard Handlers
// =============================================================================

// HealthHandler returns a standardized /health handler for BaseService.
func HealthHandler(s *BaseService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := "healthy"
		var details map[string]any

		// Check if service implements HealthChecker for custom status
		if checker, ok := interface{}(s).(HealthChecker); ok {
			status = checker.HealthStatus()
			if status != "healthy" {
				details = checker.HealthDetails()
			}
		}

		resp := HealthResponse{
			Status:    status,
			Service:   s.Name(),
			Version:   s.Version(),
			Enclave:   s.Marble().IsEnclave(),
			Timestamp: time.Now().Format(time.RFC3339),
			Details:   details,
		}
		httputil.WriteJSON(w, http.StatusOK, resp)
	}
}

// ReadinessHandler returns a readiness probe handler suitable for k8s.
func ReadinessHandler(s *BaseService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := "healthy"
		var details map[string]any

		if checker, ok := interface{}(s).(HealthChecker); ok {
			status = checker.HealthStatus()
			if status != "healthy" {
				details = checker.HealthDetails()
			}
		}

		resp := HealthResponse{
			Status:    status,
			Service:   s.Name(),
			Version:   s.Version(),
			Enclave:   s.Marble().IsEnclave(),
			Timestamp: time.Now().Format(time.RFC3339),
			Details:   details,
		}

		code := http.StatusOK
		if status != "healthy" {
			code = http.StatusServiceUnavailable
		}

		httputil.WriteJSON(w, code, resp)
	}
}

// InfoHandler returns a standardized /info handler for BaseService.
// It includes statistics from the registered stats function if available.
func InfoHandler(s *BaseService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := InfoResponse{
			Status:    "active",
			Service:   s.Name(),
			Version:   s.Version(),
			Enclave:   s.Marble().IsEnclave(),
			Timestamp: time.Now().Format(time.RFC3339),
		}

		// Include statistics if provider is registered
		if s.statsFn != nil {
			resp.Statistics = s.statsFn()
		}

		httputil.WriteJSON(w, http.StatusOK, resp)
	}
}

// =============================================================================
// Route Group Helper
// =============================================================================

// RouteGroup simplifies route registration with common middleware patterns.
// It provides a fluent API for chaining middleware and registering handlers.
type RouteGroup struct {
	router     *mux.Router
	prefix     string
	middleware []mux.MiddlewareFunc
	lastRoute  *mux.Route
}

// NewRouteGroup creates a new RouteGroup for the given router.
func NewRouteGroup(router *mux.Router) *RouteGroup {
	return &RouteGroup{
		router:     router,
		middleware: make([]mux.MiddlewareFunc, 0),
	}
}

// WithPrefix sets a path prefix for all routes in this group.
func (rg *RouteGroup) WithPrefix(prefix string) *RouteGroup {
	rg.prefix = prefix
	return rg
}

// WithTimeout adds timeout middleware to the route group.
func (rg *RouteGroup) WithTimeout(timeout time.Duration) *RouteGroup {
	rg.middleware = append(rg.middleware, func(next http.Handler) http.Handler {
		return http.TimeoutHandler(next, timeout, `{"error":"request timeout"}`)
	})
	return rg
}

// Handle registers a handler with all configured middleware.
func (rg *RouteGroup) Handle(path string, handler http.Handler) *RouteGroup {
	// Apply all middleware
	h := handler
	for i := len(rg.middleware) - 1; i >= 0; i-- {
		h = rg.middleware[i](h)
	}
	rg.lastRoute = rg.router.Handle(rg.prefix+path, h)
	return rg
}

// HandleFunc registers a handler function with all configured middleware.
func (rg *RouteGroup) HandleFunc(path string, f http.HandlerFunc) *RouteGroup {
	return rg.Handle(path, f)
}

// Methods registers the last route with specific HTTP methods.
func (rg *RouteGroup) Methods(methods ...string) *RouteGroup {
	if rg.lastRoute == nil {
		return rg
	}
	rg.lastRoute.Methods(methods...)
	return rg
}

// =============================================================================
// Route Registration
// =============================================================================

// RouteOptions configures which standard routes to register.
type RouteOptions struct {
	SkipInfo bool // Skip /info registration (for services with custom /info)
}

// RegisterStandardRoutes registers the standard /health, /ready, and /info endpoints.
// This should be called by services that want consistent endpoint behavior.
func (b *BaseService) RegisterStandardRoutes() {
	b.RegisterStandardRoutesWithOptions(RouteOptions{})
}

// RegisterStandardRoutesWithOptions registers standard routes with configurable options.
// Use SkipInfo: true when the service provides a custom /info endpoint.
func (b *BaseService) RegisterStandardRoutesWithOptions(opts RouteOptions) {
	router := b.Router()
	router.HandleFunc("/health", HealthHandler(b)).Methods("GET")
	router.HandleFunc("/ready", ReadinessHandler(b)).Methods("GET")
	if !opts.SkipInfo {
		router.HandleFunc("/info", InfoHandler(b)).Methods("GET")
	}
}
