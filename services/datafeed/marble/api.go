// Package neofeeds provides API routes for the price feed aggregation service.
package neofeeds

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP routes.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	router := s.Router()
	// Accept both canonical symbols (e.g., BTC-USD) and legacy slash symbols (e.g., BTC/USD).
	// Note: `{pair:.+}` is required so Gorilla mux matches slashes in the path segment.
	router.HandleFunc("/price/{pair:.+}", s.handleGetPrice).Methods("GET")
	router.HandleFunc("/prices", s.handleGetPrices).Methods("GET")
	router.HandleFunc("/feeds", s.handleListFeeds).Methods("GET")
	router.HandleFunc("/config", s.handleGetConfig).Methods("GET")
	router.HandleFunc("/sources", s.handleListSources).Methods("GET")
}
