// Package neoflow provides API routes for the task neoflow service.
package neoflow

import (
	"net/http"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/middleware"
)

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP routes.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	router := s.Router()
	router.Handle("/triggers", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleListTriggers)))).Methods(http.MethodGet)
	router.Handle("/triggers", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleCreateTrigger)))).Methods(http.MethodPost)
	router.Handle("/triggers/{id}", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleGetTrigger)))).Methods(http.MethodGet)
	router.Handle("/triggers/{id}", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleUpdateTrigger)))).Methods(http.MethodPut)
	router.Handle("/triggers/{id}", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleDeleteTrigger)))).Methods(http.MethodDelete)
	router.Handle("/triggers/{id}/enable", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleEnableTrigger)))).Methods(http.MethodPost)
	router.Handle("/triggers/{id}/disable", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleDisableTrigger)))).Methods(http.MethodPost)
	router.Handle("/triggers/{id}/executions", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleListExecutions)))).Methods(http.MethodGet)
	router.Handle("/triggers/{id}/resume", middleware.RequireServiceAuth(httputil.WithUserAuth(s.withRepo(s.handleResumeTrigger)))).Methods(http.MethodPost)
}
