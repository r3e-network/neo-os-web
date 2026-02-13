package neogasbank

import (
	"net/http"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
)

// registerRoutes registers the service-specific HTTP routes.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	router := s.Router()

	// User-facing endpoints (user auth handled in handler via httputil.RequireUserID)
	router.HandleFunc("/account", s.handleGetAccount()).Methods(http.MethodGet)
	router.HandleFunc("/transactions", s.handleGetTransactions).Methods(http.MethodGet)
	router.HandleFunc("/deposits", s.handleGetDeposits).Methods(http.MethodGet)

	// Service-to-service endpoints (require mTLS service authentication)
	router.Handle("/deduct", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDeductFee))).Methods(http.MethodPost)
	router.Handle("/reserve", middleware.RequireServiceAuth(http.HandlerFunc(s.handleReserveFunds))).Methods(http.MethodPost)
	router.Handle("/release", middleware.RequireServiceAuth(http.HandlerFunc(s.handleReleaseFunds))).Methods(http.MethodPost)
}
