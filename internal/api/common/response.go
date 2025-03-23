package common

import (
	"github.com/gin-gonic/gin"
)

// SuccessResponse is a standardized success response with data
type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
}

// RespondWithSuccess sends a standardized success response
func RespondWithSuccess(c *gin.Context, statusCode int, data interface{}) {
	c.JSON(statusCode, SuccessResponse{
		Success: true,
		Data:    data,
	})
}

// RespondWithErrorMessage is a simplified version of the error response function
// that only takes a message without an error object
func RespondWithErrorMessage(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, ErrorResponse{
		Error: message,
	})
}
