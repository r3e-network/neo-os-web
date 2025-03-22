package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	github.com/R3E-Network/service_layerinternal/api/common"
	github.com/R3E-Network/service_layerinternal/blockchain"
	github.com/R3E-Network/service_layerinternal/models"
)

// TransactionHandlers contains handlers for transaction-related endpoints
type TransactionHandlers struct {
	txService *blockchain.TransactionService
}

// NewTransactionHandlers creates a new TransactionHandlers
func NewTransactionHandlers(txService *blockchain.TransactionService) *TransactionHandlers {
	return &TransactionHandlers{
		txService: txService,
	}
}

// RegisterRoutes registers transaction routes
func (h *TransactionHandlers) RegisterRoutes(r chi.Router) {
	r.Route("/api/v1/transactions", func(r chi.Router) {
		r.Post("/", h.CreateTransaction)
		r.Get("/", h.ListTransactions)
		r.Get("/{id}", h.GetTransaction)
		r.Post("/{id}/retry", h.RetryTransaction)
		r.Post("/{id}/cancel", h.CancelTransaction)
		r.Get("/{id}/events", h.GetTransactionEvents)

		// Wallet management routes
		r.Route("/wallets", func(r chi.Router) {
			r.Post("/", h.CreateServiceWallet)
			r.Get("/{service}", h.GetServiceWallet)
			r.Get("/{service}/all", h.ListServiceWallets)
		})
	})
}

// CreateTransaction creates a new transaction
// @Summary Create a new transaction
// @Description Create a new transaction and submit it to the blockchain
// @Tags transactions
// @Accept json
// @Produce json
// @Param transaction body models.CreateTransactionRequest true "Transaction request"
// @Success 201 {object} models.Transaction
// @Failure 400 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions [post]
func (h *TransactionHandlers) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var req models.CreateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.RespondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	tx, err := h.txService.CreateTransaction(r.Context(), req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create transaction")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to create transaction", err)
		return
	}

	common.RespondWithJSON(w, http.StatusCreated, tx)
}

// GetTransaction gets a transaction by ID
// @Summary Get a transaction by ID
// @Description Get a transaction by its unique identifier
// @Tags transactions
// @Produce json
// @Param id path string true "Transaction ID"
// @Success 200 {object} models.Transaction
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions/{id} [get]
func (h *TransactionHandlers) GetTransaction(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		common.RespondWithError(w, http.StatusBadRequest, "Invalid transaction ID", err)
		return
	}

	tx, err := h.txService.GetTransaction(r.Context(), id)
	if err != nil {
		log.Error().Err(err).Str("id", idStr).Msg("Failed to get transaction")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to get transaction", err)
		return
	}

	if tx == nil {
		common.RespondWithError(w, http.StatusNotFound, "Transaction not found", nil)
		return
	}

	common.RespondWithJSON(w, http.StatusOK, tx)
}

// ListTransactions lists transactions with filtering
// @Summary List transactions
// @Description List transactions with optional filtering
// @Tags transactions
// @Produce json
// @Param service query string false "Service filter"
// @Param status query string false "Status filter"
// @Param entityId query string false "Entity ID filter"
// @Param page query int false "Page number (default: 1)"
// @Param limit query int false "Items per page (default: 20)"
// @Success 200 {object} models.TransactionListResponse
// @Failure 400 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions [get]
func (h *TransactionHandlers) ListTransactions(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	service := r.URL.Query().Get("service")
	statusStr := r.URL.Query().Get("status")
	entityIDStr := r.URL.Query().Get("entityId")
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	var status models.TransactionStatus
	if statusStr != "" {
		status = models.TransactionStatus(statusStr)
	}

	var entityID *uuid.UUID
	if entityIDStr != "" {
		id, err := uuid.Parse(entityIDStr)
		if err != nil {
			common.RespondWithError(w, http.StatusBadRequest, "Invalid entity ID", err)
			return
		}
		entityID = &id
	}

	page := 1
	if pageStr != "" {
		p, err := strconv.Atoi(pageStr)
		if err == nil && p > 0 {
			page = p
		}
	}

	limit := 20
	if limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err == nil && l > 0 {
			limit = l
		}
	}

	// Get transactions
	response, err := h.txService.ListTransactions(r.Context(), service, status, entityID, page, limit)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list transactions")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to list transactions", err)
		return
	}

	common.RespondWithJSON(w, http.StatusOK, response)
}

// RetryTransaction retries a failed transaction
// @Summary Retry a failed transaction
// @Description Retry a transaction that previously failed
// @Tags transactions
// @Produce json
// @Param id path string true "Transaction ID"
// @Success 200 {object} models.Transaction
// @Failure 400 {object} common.ErrorResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions/{id}/retry [post]
func (h *TransactionHandlers) RetryTransaction(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		common.RespondWithError(w, http.StatusBadRequest, "Invalid transaction ID", err)
		return
	}

	tx, err := h.txService.RetryTransaction(r.Context(), id)
	if err != nil {
		log.Error().Err(err).Str("id", idStr).Msg("Failed to retry transaction")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to retry transaction", err)
		return
	}

	common.RespondWithJSON(w, http.StatusOK, tx)
}

// CancelTransaction cancels a pending transaction
// @Summary Cancel a pending transaction
// @Description Cancel a transaction that is pending and has not yet been confirmed
// @Tags transactions
// @Produce json
// @Param id path string true "Transaction ID"
// @Success 200 {object} models.Transaction
// @Failure 400 {object} common.ErrorResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions/{id}/cancel [post]
func (h *TransactionHandlers) CancelTransaction(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		common.RespondWithError(w, http.StatusBadRequest, "Invalid transaction ID", err)
		return
	}

	tx, err := h.txService.CancelTransaction(r.Context(), id)
	if err != nil {
		log.Error().Err(err).Str("id", idStr).Msg("Failed to cancel transaction")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to cancel transaction", err)
		return
	}

	common.RespondWithJSON(w, http.StatusOK, tx)
}

// GetTransactionEvents gets events for a transaction
// @Summary Get events for a transaction
// @Description Get the history of events for a transaction
// @Tags transactions
// @Produce json
// @Param id path string true "Transaction ID"
// @Success 200 {array} models.TransactionEvent
// @Failure 400 {object} common.ErrorResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions/{id}/events [get]
func (h *TransactionHandlers) GetTransactionEvents(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		common.RespondWithError(w, http.StatusBadRequest, "Invalid transaction ID", err)
		return
	}

	events, err := h.txService.GetTransactionEvents(r.Context(), id)
	if err != nil {
		log.Error().Err(err).Str("id", idStr).Msg("Failed to get transaction events")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to get transaction events", err)
		return
	}

	common.RespondWithJSON(w, http.StatusOK, events)
}

// CreateServiceWallet creates a new wallet for a service
// @Summary Create a new wallet for a service
// @Description Create a new wallet for a specific service
// @Tags transactions,wallets
// @Accept json
// @Produce json
// @Param service body struct{Service string `json:"service"`} true "Service identifier"
// @Success 201 {object} models.WalletAccount
// @Failure 400 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions/wallets [post]
func (h *TransactionHandlers) CreateServiceWallet(w http.ResponseWriter, r *http.Request) {
	var req models.CreateWalletRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		common.RespondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.Service == "" {
		common.RespondWithError(w, http.StatusBadRequest, "Service is required", nil)
		return
	}

	wallet, err := h.txService.CreateServiceWallet(r.Context(), req.Service)
	if err != nil {
		log.Error().Err(err).Str("service", req.Service).Msg("Failed to create service wallet")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to create service wallet", err)
		return
	}

	common.RespondWithJSON(w, http.StatusCreated, wallet)
}

// GetServiceWallet gets a wallet for a service
// @Summary Get a wallet for a service
// @Description Get the wallet for a specific service
// @Tags transactions,wallets
// @Produce json
// @Param service path string true "Service identifier"
// @Success 200 {object} models.WalletAccount
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions/wallets/{service} [get]
func (h *TransactionHandlers) GetServiceWallet(w http.ResponseWriter, r *http.Request) {
	service := chi.URLParam(r, "service")

	wallet, err := h.txService.GetServiceWallet(r.Context(), service)
	if err != nil {
		log.Error().Err(err).Str("service", service).Msg("Failed to get service wallet")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to get service wallet", err)
		return
	}

	if wallet == nil {
		common.RespondWithError(w, http.StatusNotFound, "Wallet not found for service", nil)
		return
	}

	common.RespondWithJSON(w, http.StatusOK, wallet)
}

// ListServiceWallets lists all wallets for a service
// @Summary List all wallets for a service
// @Description List all wallets for a specific service
// @Tags transactions,wallets
// @Produce json
// @Param service path string true "Service identifier"
// @Success 200 {array} models.WalletAccount
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/transactions/wallets/{service}/all [get]
func (h *TransactionHandlers) ListServiceWallets(w http.ResponseWriter, r *http.Request) {
	service := chi.URLParam(r, "service")

	wallets, err := h.txService.ListServiceWallets(r.Context(), service)
	if err != nil {
		log.Error().Err(err).Str("service", service).Msg("Failed to list service wallets")
		common.RespondWithError(w, http.StatusInternalServerError, "Failed to list service wallets", err)
		return
	}

	common.RespondWithJSON(w, http.StatusOK, wallets)
} 