// Package neoflow provides API routes for the task neoflow service.
package neoflow

import (
	"net/http"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/middleware"
)

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP routes.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	router := s.Router()
	router.Handle("/triggers", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListTriggers))).Methods("GET")
	router.Handle("/triggers", middleware.RequireServiceAuth(http.HandlerFunc(s.handleCreateTrigger))).Methods("POST")
	router.Handle("/triggers/{id}", middleware.RequireServiceAuth(http.HandlerFunc(s.handleGetTrigger))).Methods("GET")
	router.Handle("/triggers/{id}", middleware.RequireServiceAuth(http.HandlerFunc(s.handleUpdateTrigger))).Methods("PUT")
	router.Handle("/triggers/{id}", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDeleteTrigger))).Methods("DELETE")
	router.Handle("/triggers/{id}/enable", middleware.RequireServiceAuth(http.HandlerFunc(s.handleEnableTrigger))).Methods("POST")
	router.Handle("/triggers/{id}/disable", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDisableTrigger))).Methods("POST")
	router.Handle("/triggers/{id}/executions", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListExecutions))).Methods("GET")
	router.Handle("/triggers/{id}/resume", middleware.RequireServiceAuth(http.HandlerFunc(s.handleResumeTrigger))).Methods("POST")
}
