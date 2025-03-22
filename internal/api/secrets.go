package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// CreateSecretRequest represents a request to create a secret
type CreateSecretRequest struct {
	Name  string `json:"name" binding:"required"`
	Value string `json:"value" binding:"required"`
}

// UpdateSecretRequest represents a request to update a secret
type UpdateSecretRequest struct {
	Value string `json:"value" binding:"required"`
}

// listSecretsHandler handles secret listing
func (s *Server) listSecretsHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Get secrets
	secrets, err := s.secretService.ListSecrets(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to list secrets: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": secrets})
}

// getSecretHandler handles secret retrieval
func (s *Server) getSecretHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Get secret name
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Secret name is required"})
		return
	}

	// Get secret
	secret, err := s.secretService.GetSecretByName(userID, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get secret: " + err.Error()})
		return
	}

	if secret == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Secret not found"})
		return
	}

	// Return metadata only
	c.JSON(http.StatusOK, gin.H{"success": true, "data": secret.ToMetadata()})
}

// createSecretHandler handles secret creation
func (s *Server) createSecretHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse request
	var req CreateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	// Create secret
	secretMetadata, err := s.secretService.CreateSecret(c.Request.Context(), userID, req.Name, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create secret: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": secretMetadata})
}

// updateSecretHandler handles secret updates
func (s *Server) updateSecretHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Get secret name
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Secret name is required"})
		return
	}

	// Parse request
	var req UpdateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	// Get secret by name
	secret, err := s.secretService.GetSecretByName(userID, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get secret: " + err.Error()})
		return
	}

	if secret == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Secret not found"})
		return
	}

	// Update secret
	secretMetadata, err := s.secretService.UpdateSecret(c.Request.Context(), secret.ID, userID, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to update secret: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": secretMetadata})
}

// deleteSecretHandler handles secret deletion
func (s *Server) deleteSecretHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Get secret name
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Secret name is required"})
		return
	}

	// Get secret by name
	secret, err := s.secretService.GetSecretByName(userID, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get secret: " + err.Error()})
		return
	}

	if secret == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Secret not found"})
		return
	}

	// Delete secret
	err = s.secretService.DeleteSecret(c.Request.Context(), secret.ID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to delete secret: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"name": name, "deleted": true}})
}