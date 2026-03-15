// Package neocompute provides API routes for the neocompute service.
package neocompute

import (
	"net/http"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP handlers.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	router := s.Router()
	router.HandleFunc("/execute", httputil.WithUserAuth(s.handleExecute)).Methods(http.MethodPost)
	router.HandleFunc("/jobs/{id}", httputil.WithUserAuth(s.handleGetJob)).Methods(http.MethodGet)
	router.HandleFunc("/jobs", httputil.WithUserAuth(s.handleListJobs)).Methods(http.MethodGet)
}
