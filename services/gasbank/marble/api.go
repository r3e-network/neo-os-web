package neogasbank

import (
	"net/http"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/middleware"
)

// registerRoutes registers the service-specific HTTP routes.
// Note: /health, /ready, and /info are registered by BaseService.RegisterStandardRoutes().
func (s *Service) registerRoutes() {
	router := s.Router()

	// User-facing endpoints (user auth via withUserAuth wrapper)
	router.HandleFunc("/account", httputil.WithUserAuth(s.handleGetAccount)).Methods(http.MethodGet)
	router.HandleFunc("/transactions", httputil.WithUserAuth(s.handleGetTransactions)).Methods(http.MethodGet)
	router.HandleFunc("/deposits", httputil.WithUserAuth(s.handleGetDeposits)).Methods(http.MethodGet)

	// Service-to-service endpoints (require mTLS service authentication)
	router.Handle("/deduct", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDeductFee))).Methods(http.MethodPost)
	router.Handle("/reserve", middleware.RequireServiceAuth(http.HandlerFunc(s.handleReserveFunds))).Methods(http.MethodPost)
	router.Handle("/release", middleware.RequireServiceAuth(http.HandlerFunc(s.handleReleaseFunds))).Methods(http.MethodPost)
}
