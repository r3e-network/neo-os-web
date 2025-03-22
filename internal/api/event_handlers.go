package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/willtech-services/service_layer/internal/blockchain"
	"github.com/willtech-services/service_layer/internal/database"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// EventHandler handles event-related API requests
type EventHandler struct {
	eventRepo    *database.EventRepository
	eventMonitor *blockchain.EventMonitor
	logger       *logger.Logger
}

// NewEventHandler creates a new event handler
func NewEventHandler(
	eventRepo *database.EventRepository,
	eventMonitor *blockchain.EventMonitor,
	logger *logger.Logger,
) *EventHandler {
	return &EventHandler{
		eventRepo:    eventRepo,
		eventMonitor: eventMonitor,
		logger:       logger,
	}
}

// RegisterRoutes registers the event routes
func (h *EventHandler) RegisterRoutes(r chi.Router) {
	r.Route("/events", func(r chi.Router) {
		r.Post("/subscribe", h.CreateSubscription)
		r.Get("/subscriptions", h.GetSubscriptions)
		r.Get("/subscriptions/{id}", h.GetSubscription)
		r.Put("/subscriptions/{id}", h.UpdateSubscription)
		r.Delete("/subscriptions/{id}", h.DeleteSubscription)
		r.Get("/", h.GetEvents)
	})
}

// CreateSubscription handles the subscription creation request
func (h *EventHandler) CreateSubscription(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req models.EventSubscriptionRequest
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

	// Convert parameters to JSON
	var parametersJSON json.RawMessage
	if req.Parameters != nil {
		var err error
		parametersJSON, err = json.Marshal(req.Parameters)
		if err != nil {
			ResponseError(w, http.StatusBadRequest, "Invalid parameters")
			return
		}
	}

	// Create subscription
	subscription := models.NewEventSubscription(
		userID,
		req.Name,
		req.Description,
		req.ContractAddress,
		req.EventName,
		parametersJSON,
		req.StartBlock,
		req.EndBlock,
		req.CallbackURL,
		models.NotificationType(req.NotificationType),
	)

	// Store subscription
	if err := h.eventRepo.CreateSubscription(r.Context(), subscription); err != nil {
		h.logger.Errorf("Failed to create subscription: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to create subscription")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusCreated, subscription.ToResponse())
}

// GetSubscriptions handles the subscriptions retrieval request
func (h *EventHandler) GetSubscriptions(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context
	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		ResponseError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get subscriptions
	subscriptions, err := h.eventRepo.GetSubscriptionsByUserID(r.Context(), userID)
	if err != nil {
		h.logger.Errorf("Failed to get subscriptions: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to get subscriptions")
		return
	}

	// Convert to responses
	responses := make([]*models.EventSubscriptionResponse, len(subscriptions))
	for i, subscription := range subscriptions {
		responses[i] = subscription.ToResponse()
	}

	// Return response
	ResponseJSON(w, http.StatusOK, map[string]interface{}{
		"subscriptions": responses,
		"total":         len(responses),
	})
}

// GetSubscription handles the subscription retrieval request
func (h *EventHandler) GetSubscription(w http.ResponseWriter, r *http.Request) {
	// Get subscription ID from URL
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		ResponseError(w, http.StatusBadRequest, "Subscription ID is required")
		return
	}

	// Parse subscription ID
	id, err := uuid.Parse(idStr)
	if err != nil {
		ResponseError(w, http.StatusBadRequest, "Invalid subscription ID")
		return
	}

	// Get user ID from context
	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		ResponseError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get subscription
	subscription, err := h.eventRepo.GetSubscriptionByID(r.Context(), id)
	if err != nil {
		h.logger.Errorf("Failed to get subscription: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to get subscription")
		return
	}

	// Check if the subscription belongs to the user
	if subscription.UserID != userID {
		ResponseError(w, http.StatusForbidden, "Forbidden")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusOK, subscription.ToResponse())
}

// UpdateSubscription handles the subscription update request
func (h *EventHandler) UpdateSubscription(w http.ResponseWriter, r *http.Request) {
	// Get subscription ID from URL
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		ResponseError(w, http.StatusBadRequest, "Subscription ID is required")
		return
	}

	// Parse subscription ID
	id, err := uuid.Parse(idStr)
	if err != nil {
		ResponseError(w, http.StatusBadRequest, "Invalid subscription ID")
		return
	}

	// Parse request body
	var req models.EventSubscriptionRequest
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

	// Get subscription
	subscription, err := h.eventRepo.GetSubscriptionByID(r.Context(), id)
	if err != nil {
		h.logger.Errorf("Failed to get subscription: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to get subscription")
		return
	}

	// Check if the subscription belongs to the user
	if subscription.UserID != userID {
		ResponseError(w, http.StatusForbidden, "Forbidden")
		return
	}

	// Update subscription fields
	subscription.Name = req.Name
	subscription.Description = req.Description
	if req.ContractAddress != "" {
		subscription.ContractAddress = req.ContractAddress
	}
	if req.EventName != "" {
		subscription.EventName = req.EventName
	}
	if req.Parameters != nil {
		parametersJSON, err := json.Marshal(req.Parameters)
		if err != nil {
			ResponseError(w, http.StatusBadRequest, "Invalid parameters")
			return
		}
		subscription.Parameters = parametersJSON
	}
	if req.StartBlock != nil {
		subscription.StartBlock = req.StartBlock
	}
	if req.EndBlock != nil {
		subscription.EndBlock = req.EndBlock
	}
	if req.CallbackURL != "" {
		subscription.CallbackURL = req.CallbackURL
	}
	if req.NotificationType != "" {
		subscription.NotificationType = models.NotificationType(req.NotificationType)
	}

	// Update subscription
	if err := h.eventRepo.UpdateSubscription(r.Context(), subscription); err != nil {
		h.logger.Errorf("Failed to update subscription: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to update subscription")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusOK, subscription.ToResponse())
}

// DeleteSubscription handles the subscription deletion request
func (h *EventHandler) DeleteSubscription(w http.ResponseWriter, r *http.Request) {
	// Get subscription ID from URL
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		ResponseError(w, http.StatusBadRequest, "Subscription ID is required")
		return
	}

	// Parse subscription ID
	id, err := uuid.Parse(idStr)
	if err != nil {
		ResponseError(w, http.StatusBadRequest, "Invalid subscription ID")
		return
	}

	// Get user ID from context
	userID := GetUserIDFromContext(r.Context())
	if userID == 0 {
		ResponseError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get subscription
	subscription, err := h.eventRepo.GetSubscriptionByID(r.Context(), id)
	if err != nil {
		h.logger.Errorf("Failed to get subscription: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to get subscription")
		return
	}

	// Check if the subscription belongs to the user
	if subscription.UserID != userID {
		ResponseError(w, http.StatusForbidden, "Forbidden")
		return
	}

	// Delete subscription
	if err := h.eventRepo.DeleteSubscription(r.Context(), id); err != nil {
		h.logger.Errorf("Failed to delete subscription: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to delete subscription")
		return
	}

	// Return response
	ResponseJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}

// GetEvents handles the events retrieval request
func (h *EventHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	contractAddress := r.URL.Query().Get("contractAddress")
	eventName := r.URL.Query().Get("eventName")
	fromBlockStr := r.URL.Query().Get("fromBlock")
	toBlockStr := r.URL.Query().Get("toBlock")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	// Parse parameters
	fromBlock := 0
	if fromBlockStr != "" {
		var err error
		fromBlock, err = strconv.Atoi(fromBlockStr)
		if err != nil {
			ResponseError(w, http.StatusBadRequest, "Invalid fromBlock parameter")
			return
		}
	}

	toBlock := 0
	if toBlockStr != "" {
		var err error
		toBlock, err = strconv.Atoi(toBlockStr)
		if err != nil {
			ResponseError(w, http.StatusBadRequest, "Invalid toBlock parameter")
			return
		}
	}

	limit := 10
	if limitStr != "" {
		var err error
		limit, err = strconv.Atoi(limitStr)
		if err != nil {
			ResponseError(w, http.StatusBadRequest, "Invalid limit parameter")
			return
		}
		if limit <= 0 || limit > 100 {
			limit = 10
		}
	}

	offset := 0
	if offsetStr != "" {
		var err error
		offset, err = strconv.Atoi(offsetStr)
		if err != nil {
			ResponseError(w, http.StatusBadRequest, "Invalid offset parameter")
			return
		}
		if offset < 0 {
			offset = 0
		}
	}

	// Get events
	events, err := h.eventRepo.GetEvents(r.Context(), contractAddress, eventName, fromBlock, toBlock, limit, offset)
	if err != nil {
		h.logger.Errorf("Failed to get events: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to get events")
		return
	}

	// Get total count
	totalCount, err := h.eventRepo.CountEvents(r.Context(), contractAddress, eventName, fromBlock, toBlock)
	if err != nil {
		h.logger.Errorf("Failed to count events: %v", err)
		ResponseError(w, http.StatusInternalServerError, "Failed to count events")
		return
	}

	// Convert to responses
	responses := make([]*models.BlockchainEventResponse, len(events))
	for i, event := range events {
		responses[i] = event.ToResponse()
	}

	// Return response
	ResponseJSON(w, http.StatusOK, map[string]interface{}{
		"events": responses,
		"total":  totalCount,
	})
} 