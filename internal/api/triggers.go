package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/gin-gonic/gin"
)

// CreateTriggerRequest represents a request to create a trigger
type CreateTriggerRequest struct {
	Name          string          `json:"name" binding:"required"`
	Description   string          `json:"description"`
	FunctionID    int             `json:"function_id" binding:"required"`
	TriggerType   string          `json:"trigger_type" binding:"required"`
	TriggerConfig json.RawMessage `json:"trigger_config" binding:"required"`
}

// UpdateTriggerRequest represents a request to update a trigger
type UpdateTriggerRequest struct {
	Name          string          `json:"name" binding:"required"`
	Description   string          `json:"description"`
	FunctionID    int             `json:"function_id" binding:"required"`
	TriggerType   string          `json:"trigger_type" binding:"required"`
	TriggerConfig json.RawMessage `json:"trigger_config" binding:"required"`
}

// listTriggersHandler handles trigger listing
func (s *Server) listTriggersHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse pagination parameters
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	// Get triggers
	triggers, err := s.automationService.ListTriggers(userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to list triggers: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    triggers,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			// TODO: Add total count
		},
	})
}

// getTriggerHandler handles trigger retrieval
func (s *Server) getTriggerHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse trigger ID
	triggerID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid trigger ID"})
		return
	}

	// Get trigger
	trigger, err := s.automationService.GetTrigger(triggerID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get trigger: " + err.Error()})
		return
	}

	if trigger == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Trigger not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trigger})
}

// createTriggerHandler handles trigger creation
func (s *Server) createTriggerHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse request
	var req CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	// Parse trigger type
	var triggerType models.TriggerType
	switch req.TriggerType {
	case "cron":
		triggerType = models.TriggerTypeCron
	case "price":
		triggerType = models.TriggerTypePrice
	case "blockchain":
		triggerType = models.TriggerTypeBlockchain
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid trigger type"})
		return
	}

	// Create trigger
	trigger, err := s.automationService.CreateTrigger(
		userID,
		req.FunctionID,
		req.Name,
		req.Description,
		triggerType,
		req.TriggerConfig,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create trigger: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": trigger})
}

// updateTriggerHandler handles trigger updates
func (s *Server) updateTriggerHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse trigger ID
	triggerID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid trigger ID"})
		return
	}

	// Parse request
	var req UpdateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	// Parse trigger type
	var triggerType models.TriggerType
	switch req.TriggerType {
	case "cron":
		triggerType = models.TriggerTypeCron
	case "price":
		triggerType = models.TriggerTypePrice
	case "blockchain":
		triggerType = models.TriggerTypeBlockchain
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid trigger type"})
		return
	}

	// Update trigger
	trigger, err := s.automationService.UpdateTrigger(
		triggerID,
		userID,
		req.FunctionID,
		req.Name,
		req.Description,
		triggerType,
		req.TriggerConfig,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to update trigger: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trigger})
}

// deleteTriggerHandler handles trigger deletion
func (s *Server) deleteTriggerHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse trigger ID
	triggerID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid trigger ID"})
		return
	}

	// Delete trigger
	err = s.automationService.DeleteTrigger(triggerID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to delete trigger: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"id": triggerID, "deleted": true}})
}

// getTriggerHistoryHandler handles trigger history retrieval
func (s *Server) getTriggerHistoryHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse trigger ID
	triggerID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid trigger ID"})
		return
	}

	// Parse pagination parameters
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	// Get trigger history
	events, err := s.automationService.GetTriggerHistory(triggerID, userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get trigger history: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    events,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			// TODO: Add total count
		},
	})
}

// executeTriggerHandler handles manual trigger execution
func (s *Server) executeTriggerHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse trigger ID
	triggerID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid trigger ID"})
		return
	}

	// Execute trigger
	event, err := s.automationService.ExecuteTrigger(c.Request.Context(), triggerID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to execute trigger: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": event})
}
