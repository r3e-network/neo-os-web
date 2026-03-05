// Package neooracle provides API routes for the neooracle service.
package neooracle

import "net/http"

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP handlers.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	r := s.Router()
	r.HandleFunc("/query", s.handleQuery).Methods(http.MethodPost)
	// Backward-compatible alias used by older clients/UI.
	r.HandleFunc("/fetch", s.handleQuery).Methods(http.MethodPost)
}
