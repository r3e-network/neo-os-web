package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	// RequestIDHeader is the header key for request ID
	RequestIDHeader = "X-Request-ID"
	
	// RequestIDKey is the context key for request ID
	RequestIDKey = "request_id"
)

// RequestID middleware adds a unique request ID to each request
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if request already has an ID
		requestID := c.GetHeader(RequestIDHeader)
		
		// Generate a new ID if not present
		if requestID == "" {
			requestID = uuid.New().String()
		}
		
		// Set the request ID in context
		c.Set(RequestIDKey, requestID)
		
		// Set the request ID in response headers
		c.Header(RequestIDHeader, requestID)
		
		c.Next()
	}
}

// GetRequestID gets the request ID from context
func GetRequestID(c *gin.Context) string {
	requestID, exists := c.Get(RequestIDKey)
	if !exists {
		return ""
	}
	
	return requestID.(string)
}