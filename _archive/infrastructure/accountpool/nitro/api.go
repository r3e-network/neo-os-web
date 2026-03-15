// Package neoaccounts provides API routes for the neoaccounts service.
package neoaccounts

import (
	"net/http"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/middleware"
)

// =============================================================================
// API Routes
// =============================================================================

// registerRoutes registers service-specific HTTP handlers.
// Note: /health, /ready, and standard /info are registered by BaseService.RegisterStandardRoutes().
// /pool-info is the neoaccounts-specific endpoint for pool statistics.
func (s *Service) registerRoutes() {
	router := s.Router()
	router.Handle("/master-key", middleware.RequireServiceAuth(http.HandlerFunc(s.handleMasterKey))).Methods(http.MethodGet)
	router.Handle("/pool-info", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInfo))).Methods(http.MethodGet)
	router.Handle("/accounts", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListAccounts))).Methods(http.MethodGet)
	router.Handle("/accounts/low-balance", middleware.RequireServiceAuth(http.HandlerFunc(s.handleListLowBalanceAccounts))).Methods(http.MethodGet)
	router.Handle("/request", middleware.RequireServiceAuth(http.HandlerFunc(s.handleRequestAccounts))).Methods(http.MethodPost)
	router.Handle("/release", middleware.RequireServiceAuth(http.HandlerFunc(s.handleReleaseAccounts))).Methods(http.MethodPost)
	router.Handle("/sign", middleware.RequireServiceAuth(http.HandlerFunc(s.handleSignTransaction))).Methods(http.MethodPost)
	router.Handle("/batch-sign", middleware.RequireServiceAuth(http.HandlerFunc(s.handleBatchSign))).Methods(http.MethodPost)
	router.Handle("/balance", middleware.RequireServiceAuth(http.HandlerFunc(s.handleUpdateBalance))).Methods(http.MethodPost)
	router.Handle("/transfer", middleware.RequireServiceAuth(http.HandlerFunc(s.handleTransfer))).Methods(http.MethodPost)
	router.Handle("/transfer-with-data", middleware.RequireServiceAuth(http.HandlerFunc(s.handleTransferWithData))).Methods(http.MethodPost)

	// Fund pool accounts from master wallet (TEE_PRIVATE_KEY)
	router.Handle("/fund", middleware.RequireServiceAuth(http.HandlerFunc(s.handleFundAccount))).Methods(http.MethodPost)

	// Allocate custodial wallet for social login users
	router.Handle("/user-wallet", middleware.RequireServiceAuth(http.HandlerFunc(s.handleAllocateUserWallet))).Methods(http.MethodPost)

	// Contract operations - all signing happens inside TEE
	router.Handle("/deploy", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDeployContract))).Methods(http.MethodPost)
	router.Handle("/deploy-master", middleware.RequireServiceAuth(http.HandlerFunc(s.handleDeployMaster))).Methods(http.MethodPost)
	router.Handle("/update-contract", middleware.RequireServiceAuth(http.HandlerFunc(s.handleUpdateContract))).Methods(http.MethodPost)
	router.Handle("/invoke", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInvokeContract))).Methods(http.MethodPost)
	router.Handle("/invoke-master", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInvokeMaster))).Methods(http.MethodPost)
	router.Handle("/simulate", middleware.RequireServiceAuth(http.HandlerFunc(s.handleSimulateContract))).Methods(http.MethodPost)
}
