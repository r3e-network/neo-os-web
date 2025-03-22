package random

import (
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/willtech-services/service_layer/internal/api/common"
	"github.com/willtech-services/service_layer/internal/core/random"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Handler handles random number generation API endpoints
type Handler struct {
	randomService *random.Service
	logger        *logger.Logger
}

// NewHandler creates a new random handler
func NewHandler(randomService *random.Service, logger *logger.Logger) *Handler {
	return &Handler{
		randomService: randomService,
		logger:        logger,
	}
}

// CreateRandomRequest is the request body for creating a random number request
type CreateRandomRequest struct {
	CallbackAddress string  `json:"callback_address"`
	CallbackMethod  string  `json:"callback_method"`
	Seed            string  `json:"seed"`
	NumBytes        int     `json:"num_bytes"`
	DelayBlocks     int     `json:"delay_blocks"`
	GasFee          float64 `json:"gas_fee"`
}

// RandomResponse is the response body for a random number
type RandomResponse struct {
	ID              int     `json:"id"`
	Status          string  `json:"status"`
	RandomNumber    string  `json:"random_number,omitempty"`
	CommitmentHash  string  `json:"commitment_hash,omitempty"`
	CallbackAddress string  `json:"callback_address,omitempty"`
	NumBytes        int     `json:"num_bytes"`
	CreatedAt       string  `json:"created_at"`
	RevealedAt      string  `json:"revealed_at,omitempty"`
}

// VerifyRequest is the request body for verifying a random number
type VerifyRequest struct {
	RandomNumber string `json:"random_number"`
	Proof        string `json:"proof"`
}

// Register registers random number generation routes with the given router
func (h *Handler) Register(router *gin.RouterGroup) {
	// Admin API endpoints
	adminRouter := router.Group("/random")
	{
		adminRouter.GET("/requests", h.ListRandomRequests)
		adminRouter.GET("/requests/:id", h.GetRandomRequest)
		adminRouter.POST("/requests", h.CreateRandomRequest)
		adminRouter.GET("/analysis", h.GetRandomAnalysis)
	}

	// Public API endpoints
	publicRouter := router.Group("/public/random")
	{
		publicRouter.POST("", h.GenerateRandomNumber)
		publicRouter.GET("/:id", h.GetRandomNumber)
		publicRouter.GET("/:id/verify", h.VerifyRandomNumber)
	}
}

// ListRandomRequests lists all random number requests for a user
// @Summary List random requests
// @Description Get a list of random number requests for the authenticated user
// @Tags random
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {array} RandomResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/random/requests [get]
func (h *Handler) ListRandomRequests(c *gin.Context) {
	// Get user ID from context
	userID := getUserIDFromContext(c)

	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit

	// Get requests
	requests, err := h.randomService.ListRequests(c.Request.Context(), userID, offset, limit)
	if err != nil {
		h.logger.Errorf("Failed to list random requests: %v", err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to list random requests", err)
		return
	}

	// Convert to response format
	var response []RandomResponse
	for _, req := range requests {
		randomNumberStr := ""
		if req.RandomNumber != nil {
			randomNumberStr = base64.StdEncoding.EncodeToString(req.RandomNumber)
		}

		revealedAt := ""
		if !req.RevealedAt.IsZero() {
			revealedAt = req.RevealedAt.Format(http.TimeFormat)
		}

		response = append(response, RandomResponse{
			ID:              req.ID,
			Status:          string(req.Status),
			RandomNumber:    randomNumberStr,
			CommitmentHash:  req.CommitmentHash,
			CallbackAddress: req.CallbackAddress,
			NumBytes:        req.NumBytes,
			CreatedAt:       req.CreatedAt.Format(http.TimeFormat),
			RevealedAt:      revealedAt,
		})
	}

	c.JSON(http.StatusOK, response)
}

// GetRandomRequest gets a random number request by ID
// @Summary Get random request
// @Description Get details of a specific random number request
// @Tags random
// @Produce json
// @Param id path int true "Request ID"
// @Success 200 {object} RandomResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/random/requests/{id} [get]
func (h *Handler) GetRandomRequest(c *gin.Context) {
	// Get user ID from context
	userID := getUserIDFromContext(c)

	// Get request ID
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request ID", err)
		return
	}

	// Get request
	request, err := h.randomService.GetRequest(c.Request.Context(), id)
	if err != nil {
		h.logger.Errorf("Failed to get random request %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get random request", err)
		return
	}

	if request == nil {
		common.RespondWithError(c, http.StatusNotFound, "Random request not found", nil)
		return
	}

	// Check ownership
	if request.UserID != userID {
		common.RespondWithError(c, http.StatusForbidden, "Not authorized to access this request", nil)
		return
	}

	// Convert to response format
	randomNumberStr := ""
	if request.RandomNumber != nil {
		randomNumberStr = base64.StdEncoding.EncodeToString(request.RandomNumber)
	}

	revealedAt := ""
	if !request.RevealedAt.IsZero() {
		revealedAt = request.RevealedAt.Format(http.TimeFormat)
	}

	response := RandomResponse{
		ID:              request.ID,
		Status:          string(request.Status),
		RandomNumber:    randomNumberStr,
		CommitmentHash:  request.CommitmentHash,
		CallbackAddress: request.CallbackAddress,
		NumBytes:        request.NumBytes,
		CreatedAt:       request.CreatedAt.Format(http.TimeFormat),
		RevealedAt:      revealedAt,
	}

	c.JSON(http.StatusOK, response)
}

// CreateRandomRequest creates a new random number request
// @Summary Create random request
// @Description Create a new random number request
// @Tags random
// @Accept json
// @Produce json
// @Param request body CreateRandomRequest true "Random Request"
// @Success 201 {object} RandomResponse
// @Failure 400 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/random/requests [post]
func (h *Handler) CreateRandomRequest(c *gin.Context) {
	// Get user ID from context
	userID := getUserIDFromContext(c)

	// Parse request
	var req CreateRandomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Decode seed
	var seed []byte
	var err error
	if req.Seed != "" {
		seed, err = base64.StdEncoding.DecodeString(req.Seed)
		if err != nil {
			common.RespondWithError(c, http.StatusBadRequest, "Invalid seed format, must be base64 encoded", err)
			return
		}
	}

	// Create request
	request, err := h.randomService.CreateRequest(
		c.Request.Context(),
		userID,
		req.CallbackAddress,
		req.CallbackMethod,
		seed,
		req.NumBytes,
		req.DelayBlocks,
		req.GasFee,
	)
	if err != nil {
		h.logger.Errorf("Failed to create random request: %v", err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to create random request", err)
		return
	}

	// Convert to response format
	response := RandomResponse{
		ID:              request.ID,
		Status:          string(request.Status),
		CommitmentHash:  request.CommitmentHash,
		CallbackAddress: request.CallbackAddress,
		NumBytes:        request.NumBytes,
		CreatedAt:       request.CreatedAt.Format(http.TimeFormat),
	}

	c.JSON(http.StatusCreated, response)
}

// GetRandomAnalysis gets statistics for random number generation
// @Summary Get random analysis
// @Description Get statistics for random number generation
// @Tags random
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/random/analysis [get]
func (h *Handler) GetRandomAnalysis(c *gin.Context) {
	// Get statistics
	stats, err := h.randomService.GetRandomStatistics(c.Request.Context())
	if err != nil {
		h.logger.Errorf("Failed to get random statistics: %v", err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get random statistics", err)
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GenerateRandomNumber generates a new random number (public API)
// @Summary Generate random number
// @Description Generate a new random number
// @Tags public
// @Accept json
// @Produce json
// @Param request body CreateRandomRequest true "Random Request"
// @Success 201 {object} RandomResponse
// @Failure 400 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/public/random [post]
func (h *Handler) GenerateRandomNumber(c *gin.Context) {
	// For public API, use a fixed user ID (can be configured or use anonymous user)
	userID := 1 // Anonymous user ID

	// Parse request
	var req CreateRandomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Decode seed
	var seed []byte
	var err error
	if req.Seed != "" {
		seed, err = base64.StdEncoding.DecodeString(req.Seed)
		if err != nil {
			common.RespondWithError(c, http.StatusBadRequest, "Invalid seed format, must be base64 encoded", err)
			return
		}
	}

	// Create request
	request, err := h.randomService.CreateRequest(
		c.Request.Context(),
		userID,
		req.CallbackAddress,
		req.CallbackMethod,
		seed,
		req.NumBytes,
		req.DelayBlocks,
		req.GasFee,
	)
	if err != nil {
		h.logger.Errorf("Failed to create random request: %v", err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to create random request", err)
		return
	}

	// Convert to response format
	response := RandomResponse{
		ID:              request.ID,
		Status:          string(request.Status),
		CommitmentHash:  request.CommitmentHash,
		CallbackAddress: request.CallbackAddress,
		NumBytes:        request.NumBytes,
		CreatedAt:       request.CreatedAt.Format(http.TimeFormat),
	}

	c.JSON(http.StatusCreated, response)
}

// GetRandomNumber gets a random number by ID (public API)
// @Summary Get random number
// @Description Get a specific random number by ID
// @Tags public
// @Produce json
// @Param id path int true "Request ID"
// @Success 200 {object} RandomResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/public/random/{id} [get]
func (h *Handler) GetRandomNumber(c *gin.Context) {
	// Get request ID
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request ID", err)
		return
	}

	// Get request
	request, err := h.randomService.GetRequest(c.Request.Context(), id)
	if err != nil {
		h.logger.Errorf("Failed to get random request %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get random request", err)
		return
	}

	if request == nil {
		common.RespondWithError(c, http.StatusNotFound, "Random request not found", nil)
		return
	}

	// Only allow access to revealed random numbers
	if request.Status != models.RandomRequestStatusRevealed && request.Status != models.RandomRequestStatusCallbackSent {
		common.RespondWithError(c, http.StatusNotFound, "Random number not yet available", nil)
		return
	}

	// Convert to response format
	randomNumberStr := ""
	if request.RandomNumber != nil {
		randomNumberStr = base64.StdEncoding.EncodeToString(request.RandomNumber)
	}

	revealedAt := ""
	if !request.RevealedAt.IsZero() {
		revealedAt = request.RevealedAt.Format(http.TimeFormat)
	}

	response := RandomResponse{
		ID:              request.ID,
		Status:          string(request.Status),
		RandomNumber:    randomNumberStr,
		CommitmentHash:  request.CommitmentHash,
		NumBytes:        request.NumBytes,
		CreatedAt:       request.CreatedAt.Format(http.TimeFormat),
		RevealedAt:      revealedAt,
	}

	c.JSON(http.StatusOK, response)
}

// VerifyRandomNumber verifies a random number (public API)
// @Summary Verify random number
// @Description Verify a random number against its commitment
// @Tags public
// @Accept json
// @Produce json
// @Param id path int true "Request ID"
// @Param request body VerifyRequest true "Verification Data"
// @Success 200 {object} map[string]bool
// @Failure 400 {object} common.ErrorResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/public/random/{id}/verify [get]
func (h *Handler) VerifyRandomNumber(c *gin.Context) {
	// Get request ID
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request ID", err)
		return
	}

	// Parse verification request
	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Decode random number and proof
	randomNumber, err := base64.StdEncoding.DecodeString(req.RandomNumber)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid random number format, must be base64 encoded", err)
		return
	}

	proof, err := hex.DecodeString(req.Proof)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid proof format, must be hex encoded", err)
		return
	}

	// Verify random number
	isValid, err := h.randomService.VerifyRandomNumber(c.Request.Context(), id, randomNumber, proof)
	if err != nil {
		h.logger.Errorf("Failed to verify random number %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to verify random number", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid": isValid,
	})
}

// getUserIDFromContext gets the user ID from context
func getUserIDFromContext(c *gin.Context) int {
	userID, exists := c.Get("userID")
	if !exists {
		return 0
	}

	id, ok := userID.(int)
	if !ok {
		return 0
	}

	return id
} 