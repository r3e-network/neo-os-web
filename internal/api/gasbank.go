package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/willtech-services/service_layer/internal/core/gasbank"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// GasBankHandler handles Gas Bank API requests
type GasBankHandler struct {
	logger          *logger.Logger
	gasBankService  *gasbank.Service
}

// NewGasBankHandler creates a new gas bank handler
func NewGasBankHandler(logger *logger.Logger, gasBankService *gasbank.Service) *GasBankHandler {
	return &GasBankHandler{
		logger:          logger,
		gasBankService:  gasBankService,
	}
}

// RegisterRoutes registers the gas bank routes
func (h *GasBankHandler) RegisterRoutes(router *mux.Router) {
	// Admin API routes
	adminRouter := router.PathPrefix("/api/v1/gasbank").Subrouter()
	adminRouter.Use(AuthMiddleware)

	adminRouter.HandleFunc("/accounts", h.GetAccounts).Methods("GET")
	adminRouter.HandleFunc("/accounts/{address}", h.GetAccount).Methods("GET")
	adminRouter.HandleFunc("/transactions", h.GetTransactions).Methods("GET")
	adminRouter.HandleFunc("/accounts/{address}/transactions", h.GetAccountTransactions).Methods("GET")
	adminRouter.HandleFunc("/estimate", h.EstimateGas).Methods("POST")

	// Deposit/Withdraw routes
	adminRouter.HandleFunc("/deposit", h.DepositGas).Methods("POST")
	adminRouter.HandleFunc("/withdraw", h.WithdrawGas).Methods("POST")
}

// GetAccounts returns all gas accounts for a user
func (h *GasBankHandler) GetAccounts(w http.ResponseWriter, r *http.Request) {
	userID := GetUserIDFromContext(r.Context())

	accounts, err := h.gasBankService.GetAccounts(userID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get accounts: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, accounts)
}

// GetAccount returns a specific gas account
func (h *GasBankHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	address := vars["address"]
	userID := GetUserIDFromContext(r.Context())

	account, err := h.gasBankService.GetAccount(userID, address)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get account: "+err.Error())
		return
	}

	if account == nil {
		RespondWithError(w, http.StatusNotFound, "Account not found")
		return
	}

	RespondWithJSON(w, http.StatusOK, account)
}

// GetTransactions returns all gas transactions for a user
func (h *GasBankHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	userID := GetUserIDFromContext(r.Context())

	// Get pagination parameters
	page, err := strconv.Atoi(r.URL.Query().Get("page"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	transactions, err := h.gasBankService.GetTransactions(userID, page, limit)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get transactions: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, transactions)
}

// GetAccountTransactions returns transactions for a specific account
func (h *GasBankHandler) GetAccountTransactions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	address := vars["address"]
	userID := GetUserIDFromContext(r.Context())

	// Get pagination parameters
	page, err := strconv.Atoi(r.URL.Query().Get("page"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	transactions, err := h.gasBankService.GetAccountTransactions(userID, address, page, limit)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to get account transactions: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, transactions)
}

// DepositGas handles gas deposits
func (h *GasBankHandler) DepositGas(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Address string  `json:"address"`
		Amount  float64 `json:"amount"`
		TxHash  string  `json:"tx_hash"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := GetUserIDFromContext(r.Context())

	transaction, err := h.gasBankService.DepositGas(r.Context(), userID, request.Address, request.Amount, request.TxHash)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to deposit gas: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusCreated, transaction)
}

// WithdrawGas handles gas withdrawals
func (h *GasBankHandler) WithdrawGas(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Address       string  `json:"address"`
		Amount        float64 `json:"amount"`
		TargetAddress string  `json:"target_address"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := GetUserIDFromContext(r.Context())

	transaction, err := h.gasBankService.WithdrawGas(r.Context(), userID, request.Address, request.Amount, request.TargetAddress)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to withdraw gas: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, transaction)
}

// EstimateGas estimates gas for an operation
func (h *GasBankHandler) EstimateGas(w http.ResponseWriter, r *http.Request) {
	var request struct {
		OperationType string                 `json:"operation_type"`
		Params        map[string]interface{} `json:"params"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if request.OperationType == "" {
		RespondWithError(w, http.StatusBadRequest, "Operation type is required")
		return
	}

	estimatedGas, err := h.gasBankService.EstimateGas(r.Context(), request.OperationType, request.Params)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Failed to estimate gas: "+err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, map[string]float64{
		"estimated_gas": estimatedGas,
	})
} 