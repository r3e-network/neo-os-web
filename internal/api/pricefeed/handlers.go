package pricefeed

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/willtech-services/service_layer/internal/api/common"
	"github.com/willtech-services/service_layer/internal/core/pricefeed"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Handler handles price feed API endpoints
type Handler struct {
	priceFeedService *pricefeed.PriceFeedService
	logger           *logger.Logger
}

// NewHandler creates a new price feed handler
func NewHandler(priceFeedService *pricefeed.PriceFeedService, logger *logger.Logger) *Handler {
	return &Handler{
		priceFeedService: priceFeedService,
		logger:           logger,
	}
}

// CreatePriceFeedRequest is the request body for creating a price feed
type CreatePriceFeedRequest struct {
	BaseToken          string  `json:"base_token" binding:"required"`
	QuoteToken         string  `json:"quote_token" binding:"required"`
	UpdateInterval     string  `json:"update_interval"`
	DeviationThreshold float64 `json:"deviation_threshold"`
	HeartbeatInterval  string  `json:"heartbeat_interval"`
	ContractAddress    string  `json:"contract_address"`
}

// UpdatePriceFeedRequest is the request body for updating a price feed
type UpdatePriceFeedRequest struct {
	BaseToken          string  `json:"base_token"`
	QuoteToken         string  `json:"quote_token"`
	UpdateInterval     string  `json:"update_interval"`
	DeviationThreshold float64 `json:"deviation_threshold"`
	HeartbeatInterval  string  `json:"heartbeat_interval"`
	ContractAddress    string  `json:"contract_address"`
	Active             bool    `json:"active"`
}

// Register registers price feed routes with the given router
func (h *Handler) Register(router *gin.RouterGroup) {
	// Admin API endpoints
	adminRouter := router.Group("/price-feeds")
	{
		adminRouter.GET("", h.ListPriceFeeds)
		adminRouter.GET("/:id", h.GetPriceFeed)
		adminRouter.GET("/:id/history", h.GetPriceFeedHistory)
		adminRouter.POST("", h.CreatePriceFeed)
		adminRouter.PUT("/:id", h.UpdatePriceFeed)
		adminRouter.DELETE("/:id", h.DeletePriceFeed)
		adminRouter.POST("/:id/trigger-update", h.TriggerPriceUpdate)
	}

	// Public API endpoints
	publicRouter := router.Group("/public/prices")
	{
		publicRouter.GET("", h.GetAllPrices)
		publicRouter.GET("/:id", h.GetPrice)
		publicRouter.GET("/:id/history", h.GetPriceHistory)
	}
}

// ListPriceFeeds lists all price feeds
// @Summary List all price feeds
// @Description Get a list of all configured price feeds
// @Tags price-feeds
// @Produce json
// @Success 200 {array} models.PriceFeed
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/price-feeds [get]
func (h *Handler) ListPriceFeeds(c *gin.Context) {
	feeds, err := h.priceFeedService.ListPriceFeeds()
	if err != nil {
		h.logger.Errorf("Failed to list price feeds: %v", err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to list price feeds", err)
		return
	}

	c.JSON(http.StatusOK, feeds)
}

// GetPriceFeed gets a price feed by ID
// @Summary Get a price feed
// @Description Get details of a specific price feed by ID
// @Tags price-feeds
// @Produce json
// @Param id path int true "Price Feed ID"
// @Success 200 {object} models.PriceFeed
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/price-feeds/{id} [get]
func (h *Handler) GetPriceFeed(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid price feed ID", err)
		return
	}

	feed, err := h.priceFeedService.GetPriceFeed(id)
	if err != nil {
		h.logger.Errorf("Failed to get price feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get price feed", err)
		return
	}

	if feed == nil {
		common.RespondWithError(c, http.StatusNotFound, "Price feed not found", nil)
		return
	}

	c.JSON(http.StatusOK, feed)
}

// GetPriceFeedHistory gets the price history for a price feed
// @Summary Get price history
// @Description Get historical price data for a specific price feed
// @Tags price-feeds
// @Produce json
// @Param id path int true "Price Feed ID"
// @Param limit query int false "Limit" default(100)
// @Param offset query int false "Offset" default(0)
// @Success 200 {array} models.PriceData
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/price-feeds/{id}/history [get]
func (h *Handler) GetPriceFeedHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid price feed ID", err)
		return
	}

	// Validate price feed exists
	feed, err := h.priceFeedService.GetPriceFeed(id)
	if err != nil {
		h.logger.Errorf("Failed to get price feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get price feed", err)
		return
	}

	if feed == nil {
		common.RespondWithError(c, http.StatusNotFound, "Price feed not found", nil)
		return
	}

	// Get pagination parameters
	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	// Get price history
	history, err := h.priceFeedService.GetPriceHistory(id, limit, offset)
	if err != nil {
		h.logger.Errorf("Failed to get price history for feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get price history", err)
		return
	}

	c.JSON(http.StatusOK, history)
}

// CreatePriceFeed creates a new price feed
// @Summary Create price feed
// @Description Create a new price feed configuration
// @Tags price-feeds
// @Accept json
// @Produce json
// @Param request body CreatePriceFeedRequest true "Price Feed Request"
// @Success 201 {object} models.PriceFeed
// @Failure 400 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/price-feeds [post]
func (h *Handler) CreatePriceFeed(c *gin.Context) {
	var req CreatePriceFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request", err)
		return
	}

	feed, err := h.priceFeedService.CreatePriceFeed(
		req.BaseToken,
		req.QuoteToken,
		req.UpdateInterval,
		req.DeviationThreshold,
		req.HeartbeatInterval,
		req.ContractAddress,
	)
	if err != nil {
		h.logger.Errorf("Failed to create price feed: %v", err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to create price feed", err)
		return
	}

	c.JSON(http.StatusCreated, feed)
}

// UpdatePriceFeed updates a price feed
// @Summary Update price feed
// @Description Update an existing price feed configuration
// @Tags price-feeds
// @Accept json
// @Produce json
// @Param id path int true "Price Feed ID"
// @Param request body UpdatePriceFeedRequest true "Price Feed Request"
// @Success 200 {object} models.PriceFeed
// @Failure 400 {object} common.ErrorResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/price-feeds/{id} [put]
func (h *Handler) UpdatePriceFeed(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid price feed ID", err)
		return
	}

	var req UpdatePriceFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid request", err)
		return
	}

	feed, err := h.priceFeedService.UpdatePriceFeed(
		id,
		req.BaseToken,
		req.QuoteToken,
		req.UpdateInterval,
		req.DeviationThreshold,
		req.HeartbeatInterval,
		req.ContractAddress,
		req.Active,
	)
	if err != nil {
		h.logger.Errorf("Failed to update price feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to update price feed", err)
		return
	}

	c.JSON(http.StatusOK, feed)
}

// DeletePriceFeed deletes a price feed
// @Summary Delete price feed
// @Description Delete a price feed configuration
// @Tags price-feeds
// @Produce json
// @Param id path int true "Price Feed ID"
// @Success 204 {object} nil
// @Failure 400 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/price-feeds/{id} [delete]
func (h *Handler) DeletePriceFeed(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid price feed ID", err)
		return
	}

	err = h.priceFeedService.DeletePriceFeed(id)
	if err != nil {
		h.logger.Errorf("Failed to delete price feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to delete price feed", err)
		return
	}

	c.Status(http.StatusNoContent)
}

// TriggerPriceUpdate manually triggers a price update
// @Summary Trigger price update
// @Description Manually trigger a price update for a specific feed
// @Tags price-feeds
// @Produce json
// @Param id path int true "Price Feed ID"
// @Success 204 {object} nil
// @Failure 400 {object} common.ErrorResponse
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/price-feeds/{id}/trigger-update [post]
func (h *Handler) TriggerPriceUpdate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid price feed ID", err)
		return
	}

	err = h.priceFeedService.TriggerPriceUpdate(id)
	if err != nil {
		h.logger.Errorf("Failed to trigger price update for feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to trigger price update", err)
		return
	}

	c.Status(http.StatusNoContent)
}

// GetAllPrices gets current prices for all feeds
// @Summary Get all prices
// @Description Get current prices for all feeds
// @Tags public
// @Produce json
// @Success 200 {array} models.PriceData
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/public/prices [get]
func (h *Handler) GetAllPrices(c *gin.Context) {
	feeds, err := h.priceFeedService.ListPriceFeeds()
	if err != nil {
		h.logger.Errorf("Failed to list price feeds: %v", err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to list price feeds", err)
		return
	}

	type PriceResponse struct {
		FeedID    int     `json:"feed_id"`
		Pair      string  `json:"pair"`
		Price     float64 `json:"price"`
		Timestamp string  `json:"timestamp"`
		RoundID   int64   `json:"round_id"`
	}

	var prices []PriceResponse

	for _, feed := range feeds {
		if !feed.Active {
			continue
		}

		latestPrice, err := h.priceFeedService.GetLatestPrice(feed.ID)
		if err != nil {
			h.logger.Errorf("Failed to get latest price for feed %d: %v", feed.ID, err)
			continue
		}

		if latestPrice != nil {
			prices = append(prices, PriceResponse{
				FeedID:    feed.ID,
				Pair:      feed.Pair,
				Price:     latestPrice.Price,
				Timestamp: latestPrice.Timestamp.Format(time.RFC3339),
				RoundID:   latestPrice.RoundID,
			})
		}
	}

	c.JSON(http.StatusOK, prices)
}

// GetPrice gets the current price for a specific feed
// @Summary Get price
// @Description Get current price for a specific feed
// @Tags public
// @Produce json
// @Param id path int true "Price Feed ID"
// @Success 200 {object} models.PriceData
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/public/prices/{id} [get]
func (h *Handler) GetPrice(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid price feed ID", err)
		return
	}

	// Validate price feed exists
	feed, err := h.priceFeedService.GetPriceFeed(id)
	if err != nil {
		h.logger.Errorf("Failed to get price feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get price feed", err)
		return
	}

	if feed == nil {
		common.RespondWithError(c, http.StatusNotFound, "Price feed not found", nil)
		return
	}

	if !feed.Active {
		common.RespondWithError(c, http.StatusNotFound, "Price feed is inactive", nil)
		return
	}

	latestPrice, err := h.priceFeedService.GetLatestPrice(id)
	if err != nil {
		h.logger.Errorf("Failed to get latest price for feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get latest price", err)
		return
	}

	if latestPrice == nil {
		common.RespondWithError(c, http.StatusNotFound, "No price data found", nil)
		return
	}

	c.JSON(http.StatusOK, latestPrice)
}

// GetPriceHistory gets the price history for a specific feed (public endpoint)
// @Summary Get price history
// @Description Get historical price data for a specific feed
// @Tags public
// @Produce json
// @Param id path int true "Price Feed ID"
// @Param limit query int false "Limit" default(100)
// @Param offset query int false "Offset" default(0)
// @Success 200 {array} models.PriceData
// @Failure 404 {object} common.ErrorResponse
// @Failure 500 {object} common.ErrorResponse
// @Router /api/v1/public/prices/{id}/history [get]
func (h *Handler) GetPriceHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.RespondWithError(c, http.StatusBadRequest, "Invalid price feed ID", err)
		return
	}

	// Validate price feed exists
	feed, err := h.priceFeedService.GetPriceFeed(id)
	if err != nil {
		h.logger.Errorf("Failed to get price feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get price feed", err)
		return
	}

	if feed == nil {
		common.RespondWithError(c, http.StatusNotFound, "Price feed not found", nil)
		return
	}

	// Get pagination parameters
	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	// Get price history
	history, err := h.priceFeedService.GetPriceHistory(id, limit, offset)
	if err != nil {
		h.logger.Errorf("Failed to get price history for feed %d: %v", id, err)
		common.RespondWithError(c, http.StatusInternalServerError, "Failed to get price history", err)
		return
	}

	c.JSON(http.StatusOK, history)
} 