package common

import (
	"github.com/gin-gonic/gin"
)

// ErrorResponse is a standardized error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// RespondWithError sends a standardized error response
func RespondWithError(c *gin.Context, statusCode int, message string, err error) {
	var errorStr string
	if err != nil {
		errorStr = err.Error()
	}

	c.JSON(statusCode, ErrorResponse{
		Error:   message,
		Message: errorStr,
	})
} 