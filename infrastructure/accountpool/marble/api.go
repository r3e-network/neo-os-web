// Package neoaccounts provides API routes for the neoaccounts service.
package neoaccounts

import (
	"net/http"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
)

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP handlers.
// Note: /health, /ready, and standard /info are registered by BaseService.RegisterStandardRoutes().
// /pool-info is the neoaccounts-specific endpoint for pool statistics.
func (s *Service) registerRoutes() {
	router := s.Router()
	router.Handle("/master-key", middleware.RequireServiceAuth(http.HandlerFunc(s.handleMasterKey))).Methods("GET")
	router.Handle("/pool-info", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInfo))).Methods("GET")
	router.Handle("/accounts", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListAccounts))).Methods("GET")
	router.Handle("/accounts/low-balance", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListLowBalanceAccounts))).Methods("GET")
	router.Handle("/request", middleware.RequireServiceAuth(http.HandlerFunc(s.handleRequestAccounts))).Methods("POST")
	router.Handle("/release", middleware.RequireServiceAuth(http.HandlerFunc(s.handleReleaseAccounts))).Methods("POST")
	router.Handle("/sign", middleware.RequireServiceAuth(http.HandlerFunc(s.handleSignTransaction))).Methods("POST")
	router.Handle("/batch-sign", middleware.RequireServiceAuth(http.HandlerFunc(s.handleBatchSign))).Methods("POST")
	router.Handle("/balance", middleware.RequireServiceAuth(http.HandlerFunc(s.handleUpdateBalance))).Methods("POST")
	router.Handle("/transfer", middleware.RequireServiceAuth(http.HandlerFunc(s.handleTransfer))).Methods("POST")
	router.Handle("/transfer-with-data", middleware.RequireServiceAuth(http.HandlerFunc(s.handleTransferWithData))).Methods("POST")

	// Fund pool accounts from master wallet (TEE_PRIVATE_KEY)
	router.Handle("/fund", middleware.RequireServiceAuth(http.HandlerFunc(s.handleFundAccount))).Methods("POST")

	// Contract operations - all signing happens inside TEE
	router.Handle("/deploy", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDeployContract))).Methods("POST")
	router.Handle("/deploy-master", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDeployMaster))).Methods("POST")
	router.Handle("/update-contract", middleware.RequireServiceAuth(http.HandlerFunc(s.handleUpdateContract))).Methods("POST")
	router.Handle("/invoke", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInvokeContract))).Methods("POST")
	router.Handle("/invoke-master", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInvokeMaster))).Methods("POST")
	router.Handle("/simulate", middleware.RequireServiceAuth(http.HandlerFunc(s.handleSimulateContract))).Methods("POST")
}
