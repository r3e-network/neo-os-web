package api

import (
	"encoding/json"
	"net/http"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/go-chi/chi/v5"
)

// ContractHandler handles contract-related API requests
type ContractHandler struct {
	contractService *blockchain.ContractService
	logger          *logger.Logger
}

// NewContractHandler creates a new contract handler
func NewContractHandler(contractService *blockchain.ContractService, logger *logger.Logger) *ContractHandler {
	return &ContractHandler{
		contractService: contractService,
		logger:          logger,
	}
}

// RegisterRoutes registers the contract routes
func (h *ContractHandler) RegisterRoutes(r chi.Router) {
	r.Route("/contracts", func(r chi.Router) {
		r.Post("/deploy", h.DeployContract)
		r.Get("/{id}", h.GetContract)
		r.Get("/", h.GetUserContracts)
		r.Post("/verify", h.VerifyContract)
	})
}

// DeployContract handles the contract deployment request
func (h *ContractHandler) DeployContract(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req models.ContractDeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		ResponseError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate request
	if err := validate.Struct(req); err != nil {
		ResponseValidationError(w, err)
		return
	}

	// Get user ID from context
	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		ResponseError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Deploy contract
	response, err := h.contractService.DeployContract(r.Context(), &req, userID)
	if err != nil {
		h.logger.Errorf("Failed to deploy contract: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to deploy contract")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusAccepted, response)
}

// GetContract handles the contract retrieval request
func (h *ContractHandler) GetContract(w http.ResponseWriter, r *http.Request) {
	// Get contract ID from URL
	contractID := chi.URLParam(r, "id")
	if contractID == "" {
		ResponseError(w, http.StatusBadRequest, "Contract ID is required")
		return
	}

	// Get user ID from context
	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		ResponseError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get contract
	contract, err := h.contractService.GetContract(r.Context(), contractID)
	if err != nil {
		h.logger.Errorf("Failed to get contract: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to get contract")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusOK, contract)
}

// GetUserContracts handles the user contracts retrieval request
func (h *ContractHandler) GetUserContracts(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context
	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		ResponseError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get contracts
	contracts, err := h.contractService.GetContractsByUser(r.Context(), userID)
	if err != nil {
		h.logger.Errorf("Failed to get user contracts: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to get user contracts")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusOK, contracts)
}

// VerifyContract handles the contract verification request
func (h *ContractHandler) VerifyContract(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req models.ContractVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		ResponseError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate request
	if err := validate.Struct(req); err != nil {
		ResponseValidationError(w, err)
		return
	}

	// Get user ID from context
	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		ResponseError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Verify contract
	response, err := h.contractService.VerifyContract(r.Context(), &req, userID)
	if err != nil {
		h.logger.Errorf("Failed to verify contract: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to verify contract")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusOK, response)
}
