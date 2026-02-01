// Package neofeeds provides API routes for the price feed aggregation service.
package neofeeds

import (
	"net/http"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
)

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP routes.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	router := s.Router()

	// Create timeout and rate limiting middleware
	timeoutMiddleware := middleware.NewTimeoutMiddleware(s.requestTimeout)

	// Register routes with middleware
	router.Handle("/price/{pair:.+}", timeoutMiddleware.Handler(
		s.rateLimiter.Handler(http.HandlerFunc(s.handleGetPrice)))).Methods("GET")
	router.Handle("/prices", timeoutMiddleware.Handler(
		s.rateLimiter.Handler(http.HandlerFunc(s.handleGetPrices)))).Methods("GET")
	router.Handle("/feeds", timeoutMiddleware.Handler(
		s.rateLimiter.Handler(http.HandlerFunc(s.handleListFeeds)))).Methods("GET")
	router.Handle("/config", timeoutMiddleware.Handler(
		s.rateLimiter.Handler(http.HandlerFunc(s.handleGetConfig)))).Methods("GET")
	router.Handle("/sources", timeoutMiddleware.Handler(
		s.rateLimiter.Handler(http.HandlerFunc(s.handleListSources)))).Methods("GET")
}
