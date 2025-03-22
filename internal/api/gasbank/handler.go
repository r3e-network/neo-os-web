package gasbank

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/willtech-services/service_layer/internal/api/common"
	"github.com/willtech-services/service_layer/internal/core/gasbank"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Handler handles Gas Bank API requests
type Handler struct {
	logger          *logger.Logger
	gasBankService  *gasbank.Service
}

// NewHandler creates a new gas bank handler
func NewHandler(gasBankService *gasbank.Service, logger *logger.Logger) *Handler {
	return &Handler{
		logger:          logger,
		gasBankService:  gasBankService,
	}
}

// Register registers the gas bank routes
func (h *Handler) Register(router *gin.RouterGroup) {
	gasBankRoutes := router.Group("/gasbank")

	// Admin API routes
	gasBankRoutes.GET("/accounts", h.GetAccounts)
	gasBankRoutes.GET("/accounts/:address", h.GetAccount)
	gasBankRoutes.GET("/transactions", h.GetTransactions)
	gasBankRoutes.GET("/accounts/:address/transactions", h.GetAccountTransactions)
	gasBankRoutes.POST("/estimate", h.EstimateGas)

	// Deposit/Withdraw routes
	gasBankRoutes.POST("/deposit", h.DepositGas)
	gasBankRoutes.POST("/withdraw", h.WithdrawGas)
}

// GetAccounts returns all gas accounts for a user
func (h *Handler) GetAccounts(c *gin.Context) {
	userID := common.GetUserID(c)

	accounts, err := h.gasBankService.GetAccounts(userID)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get accounts: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, accounts)
}

// GetAccount returns a specific gas account
func (h *Handler) GetAccount(c *gin.Context) {
	address := c.Param("address")
	userID := common.GetUserID(c)

	account, err := h.gasBankService.GetAccount(userID, address)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get account: "+err.Error())
		return
	}

	if account == nil {
		common.RespondWithError(c, http.StatusNotFound, "Account not found")
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, account)
}

// GetTransactions returns all gas transactions for a user
func (h *Handler) GetTransactions(c *gin.Context) {
	userID := common.GetUserID(c)

	// Get pagination parameters
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	transactions, err := h.gasBankService.GetTransactions(userID, page, limit)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get transactions: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, transactions)
}

// GetAccountTransactions returns transactions for a specific account
func (h *Handler) GetAccountTransactions(c *gin.Context) {
	address := c.Param("address")
	userID := common.GetUserID(c)

	// Get pagination parameters
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	transactions, err := h.gasBankService.GetAccountTransactions(userID, address, page, limit)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get account transactions: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, transactions)
}

// DepositGas handles gas deposits
func (h *Handler) DepositGas(c *gin.Context) {
	var request struct {
		Address string  `json:"address" binding:"required"`
		Amount  float64 `json:"amount" binding:"required"`
		TxHash  string  `json:"tx_hash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := common.GetUserID(c)

	transaction, err := h.gasBankService.DepositGas(c.Request.Context(), userID, request.Address, request.Amount, request.TxHash)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to deposit gas: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusCreated, transaction)
}

// WithdrawGas handles gas withdrawals
func (h *Handler) WithdrawGas(c *gin.Context) {
	var request struct {
		Address       string  `json:"address" binding:"required"`
		Amount        float64 `json:"amount" binding:"required"`
		TargetAddress string  `json:"target_address" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := common.GetUserID(c)

	transaction, err := h.gasBankService.WithdrawGas(c.Request.Context(), userID, request.Address, request.Amount, request.TargetAddress)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to withdraw gas: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, transaction)
}

// EstimateGas estimates gas for an operation
func (h *Handler) EstimateGas(c *gin.Context) {
	var request struct {
		OperationType string                 `json:"operation_type" binding:"required"`
		Params        map[string]interface{} `json:"params"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	estimatedGas, err := h.gasBankService.EstimateGas(c.Request.Context(), request.OperationType, request.Params)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to estimate gas: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, gin.H{
		"estimated_gas": estimatedGas,
	})
} 