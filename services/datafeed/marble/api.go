// Package neofeeds provides API routes for the price feed aggregation service.
package neofeeds

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
	// Accept both canonical symbols (e.g., BTC-USD) and legacy slash symbols (e.g., BTC/USD).
	// Note: `{pair:.+}` is required so Gorilla mux matches slashes in the path segment.
	router.Handle("/price/{pair:.+}", middleware.RequireServiceAuth(http.HandlerFunc(s.handleGetPrice))).Methods(http.MethodGet)
	router.Handle("/prices", middleware.RequireServiceAuth(http.HandlerFunc(s.handleGetPrices))).Methods(http.MethodGet)
	router.Handle("/feeds", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListFeeds))).Methods(http.MethodGet)
	router.Handle("/config", middleware.RequireServiceAuth(http.HandlerFunc(s.handleGetConfig))).Methods(http.MethodGet)
	router.Handle("/sources", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListSources))).Methods(http.MethodGet)
}
