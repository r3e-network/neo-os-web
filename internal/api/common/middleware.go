package common

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// APIKey represents a simple API key for public API access
type APIKey struct {
	UserID int
	Key    string
}

// APIKeyMiddleware validates API keys for public routes
func APIKeyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get API key from header
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			// Try to get from query parameter
			apiKey = c.Query("api_key")
		}

		if apiKey == "" {
			RespondWithError(c, http.StatusUnauthorized, "API key is required")
			c.Abort()
			return
		}

		// In a real implementation, we would validate the API key against a database
		// For now, we'll use a simple check (this should be replaced)
		if !strings.HasPrefix(apiKey, "sk_") {
			RespondWithError(c, http.StatusUnauthorized, "Invalid API key")
			c.Abort()
			return
		}

		// For demonstration, extract a mock user ID from the key
		// In a real implementation, we would look up the user ID from the database
		userID := 1 // Mock user ID

		// Set user ID in context for later use
		c.Set("api_key_user_id", userID)
		c.Next()
	}
}

// GetUserID extracts the authenticated user ID from the context
func GetUserID(c *gin.Context) int {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0
	}
	
	id, ok := userID.(int)
	if !ok {
		return 0
	}
	
	return id
}

// GetAPIKeyUserID extracts the API key user ID from the context
func GetAPIKeyUserID(c *gin.Context) int {
	userID, exists := c.Get("api_key_user_id")
	if !exists {
		return 0
	}
	
	id, ok := userID.(int)
	if !ok {
		return 0
	}
	
	return id
}

// GetPaginationParams extracts and validates pagination parameters
func GetPaginationParams(c *gin.Context) (int, int) {
	// Default values
	offset := 0
	limit := 20
	
	// Try to get page number
	page, err := getIntParam(c, "page", 1)
	if err == nil && page > 0 {
		offset = (page - 1) * limit
	}
	
	// Try to get limit
	newLimit, err := getIntParam(c, "limit", 20)
	if err == nil && newLimit > 0 && newLimit <= 100 {
		limit = newLimit
	}
	
	return offset, limit
}

// getIntParam is a helper to get an integer parameter with a default value
func getIntParam(c *gin.Context, param string, defaultValue int) (int, error) {
	valueStr := c.DefaultQuery(param, "")
	if valueStr == "" {
		return defaultValue, nil
	}
	
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue, err
	}
	
	return value, nil
} 