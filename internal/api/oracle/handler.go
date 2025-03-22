package oracle

import (
	"net/http"
	"strconv"

	"github.com/R3E-Network/service_layer/internal/api/common"
	"github.com/R3E-Network/service_layer/internal/core/oracle"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/gin-gonic/gin"
)

// Handler handles Oracle API requests
type Handler struct {
	logger        *logger.Logger
	oracleService *oracle.Service
}

// NewHandler creates a new oracle handler
func NewHandler(oracleService *oracle.Service, logger *logger.Logger) *Handler {
	return &Handler{
		logger:        logger,
		oracleService: oracleService,
	}
}

// Register registers the oracle routes
func (h *Handler) Register(router *gin.RouterGroup) {
	oracleRoutes := router.Group("/oracles")

	// Admin API routes
	oracleRoutes.GET("", h.ListOracles)
	oracleRoutes.GET("/:id", h.GetOracle)
	oracleRoutes.POST("", h.CreateOracle)
	oracleRoutes.PUT("/:id", h.UpdateOracle)
	oracleRoutes.DELETE("/:id", h.DeleteOracle)
	oracleRoutes.GET("/:id/requests", h.ListOracleRequests)
	oracleRoutes.GET("/requests/:id", h.GetOracleRequest)
	oracleRoutes.GET("/statistics", h.GetOracleStatistics)

	// API Key protected routes
	publicRoutes := router.Group("/public/oracles")
	publicRoutes.Use(common.APIKeyMiddleware())

	publicRoutes.POST("/request", h.CreateOracleRequest)
	publicRoutes.GET("/request/:id", h.CheckRequestStatus)
	publicRoutes.GET("/data/:id", h.GetHistoricalData)
}

// ListOracles returns a list of oracles
func (h *Handler) ListOracles(c *gin.Context) {
	userID := common.GetUserID(c)

	// Get pagination parameters
	offset, limit := common.GetPaginationParams(c)

	oracles, err := h.oracleService.ListOracles(c.Request.Context(), userID, offset, limit)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to list oracles: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, oracles)
}

// GetOracle returns a specific oracle
func (h *Handler) GetOracle(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	oracle, err := h.oracleService.GetOracle(c.Request.Context(), id)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get oracle: "+err.Error())
		return
	}

	if oracle == nil {
		common.RespondWithError(c, http.StatusNotFound, "Oracle not found")
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, oracle)
}

// CreateOracle creates a new oracle
func (h *Handler) CreateOracle(c *gin.Context) {
	var request struct {
		Name        string                      `json:"name" binding:"required"`
		Description string                      `json:"description"`
		SourceType  models.OracleDataSourceType `json:"source_type"`
		URL         string                      `json:"url" binding:"required"`
		Method      string                      `json:"method"`
		Headers     map[string]interface{}      `json:"headers"`
		Body        string                      `json:"body"`
		AuthType    models.OracleAuthType       `json:"auth_type"`
		AuthParams  map[string]interface{}      `json:"auth_params"`
		Path        string                      `json:"path"`
		Transform   string                      `json:"transform"`
		Schedule    string                      `json:"schedule"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := common.GetUserID(c)

	oracle, err := h.oracleService.CreateOracle(
		c.Request.Context(),
		request.Name,
		request.Description,
		request.SourceType,
		request.URL,
		request.Method,
		request.Headers,
		request.Body,
		request.AuthType,
		request.AuthParams,
		request.Path,
		request.Transform,
		request.Schedule,
		userID,
	)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to create oracle: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusCreated, oracle)
}

// UpdateOracle updates an existing oracle
func (h *Handler) UpdateOracle(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	var request struct {
		Name        string                      `json:"name"`
		Description string                      `json:"description"`
		SourceType  models.OracleDataSourceType `json:"source_type"`
		URL         string                      `json:"url"`
		Method      string                      `json:"method"`
		Headers     map[string]interface{}      `json:"headers"`
		Body        string                      `json:"body"`
		AuthType    models.OracleAuthType       `json:"auth_type"`
		AuthParams  map[string]interface{}      `json:"auth_params"`
		Path        string                      `json:"path"`
		Transform   string                      `json:"transform"`
		Schedule    string                      `json:"schedule"`
		Active      bool                        `json:"active"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := common.GetUserID(c)

	oracle, err := h.oracleService.UpdateOracle(
		c.Request.Context(),
		id,
		request.Name,
		request.Description,
		request.SourceType,
		request.URL,
		request.Method,
		request.Headers,
		request.Body,
		request.AuthType,
		request.AuthParams,
		request.Path,
		request.Transform,
		request.Schedule,
		request.Active,
		userID,
	)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to update oracle: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, oracle)
}

// DeleteOracle deletes an oracle
func (h *Handler) DeleteOracle(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	userID := common.GetUserID(c)

	if err := h.oracleService.DeleteOracle(c.Request.Context(), id, userID); err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to delete oracle: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, gin.H{"message": "Oracle deleted successfully"})
}

// CreateOracleRequest creates a new oracle data request
func (h *Handler) CreateOracleRequest(c *gin.Context) {
	var request struct {
		OracleID        int                    `json:"oracle_id" binding:"required"`
		Params          map[string]interface{} `json:"params"`
		CallbackAddress string                 `json:"callback_address" binding:"required"`
		CallbackMethod  string                 `json:"callback_method" binding:"required"`
		GasFee          float64                `json:"gas_fee"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	userID := common.GetUserID(c)
	if userID == 0 {
		userID = common.GetAPIKeyUserID(c)
	}

	oracleRequest, err := h.oracleService.CreateOracleRequest(
		c.Request.Context(),
		request.OracleID,
		userID,
		request.Params,
		request.CallbackAddress,
		request.CallbackMethod,
		request.GasFee,
	)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to create oracle request: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusCreated, oracleRequest)
}

// GetOracleRequest returns a specific oracle request
func (h *Handler) GetOracleRequest(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request ID")
		return
	}

	request, err := h.oracleService.GetOracleRequest(c.Request.Context(), id)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get oracle request: "+err.Error())
		return
	}

	if request == nil {
		common.RespondWithError(c, http.StatusNotFound, "Oracle request not found")
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, request)
}

// ListOracleRequests returns a list of oracle requests for a specific oracle
func (h *Handler) ListOracleRequests(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid oracle ID")
		return
	}

	// Get pagination parameters
	offset, limit := common.GetPaginationParams(c)

	requests, err := h.oracleService.ListOracleRequests(c.Request.Context(), id, offset, limit)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to list oracle requests: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, requests)
}

// CheckRequestStatus checks the status of an oracle request
func (h *Handler) CheckRequestStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request ID")
		return
	}

	request, err := h.oracleService.GetOracleRequest(c.Request.Context(), id)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get oracle request: "+err.Error())
		return
	}

	if request == nil {
		common.RespondWithError(c, http.StatusNotFound, "Oracle request not found")
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, request)
}

// GetHistoricalData returns historical oracle data
func (h *Handler) GetHistoricalData(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid data ID")
		return
	}

	// For now, we just return the oracle request data
	// In a more advanced implementation, we might have a separate historical data store
	request, err := h.oracleService.GetOracleRequest(c.Request.Context(), id)
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get historical data: "+err.Error())
		return
	}

	if request == nil {
		common.RespondWithError(c, http.StatusNotFound, "Historical data not found")
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, gin.H{
		"id":        request.ID,
		"timestamp": request.CreatedAt,
		"data":      request.Result,
	})
}

// GetOracleStatistics returns statistics about the oracle service
func (h *Handler) GetOracleStatistics(c *gin.Context) {
	stats, err := h.oracleService.GetOracleStatistics(c.Request.Context())
	if err != nil {
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get oracle statistics: "+err.Error())
		return
	}

	common.RespondWithSuccess(c, http.StatusOK, stats)
}
