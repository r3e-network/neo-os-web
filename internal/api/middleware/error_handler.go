package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/R3E-Network/service_layer/internal/errors"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/gin-gonic/gin"
)

// ErrorHandler middleware for handling errors
func ErrorHandler(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Process request
		c.Next()

		// Check if there were any errors
		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err
			handleError(c, err, log)
		}
	}
}

// RecoveryHandler middleware to recover from panics
func RecoveryHandler(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				// Log the panic
				stackTrace := debug.Stack()
				log.Errorf("Panic recovered: %v\n%s", r, stackTrace)

				// Create an internal server error
				err := errors.InternalServerError("An unexpected error occurred")
				
				// In development, include stack trace
				if gin.Mode() != gin.ReleaseMode {
					err.WithDetail("stack_trace", string(stackTrace))
				}
				
				// Send error response
				c.JSON(http.StatusInternalServerError, err.ToResponse())
				c.Abort()
			}
		}()
		
		c.Next()
	}
}

// handleError handles different types of errors
func handleError(c *gin.Context, err error, log *logger.Logger) {
	// Get request information for logging
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = "unknown"
	}
	
	method := c.Request.Method
	path := c.Request.URL.Path
	clientIP := c.ClientIP()
	
	var serviceErr *errors.ServiceError
	
	// Check if it's already a ServiceError
	if svcErr, ok := err.(*errors.ServiceError); ok {
		serviceErr = svcErr
	} else {
		// Convert to ServiceError
		serviceErr = errors.InternalServerError(err.Error())
	}
	
	// Add request information to error details
	serviceErr.WithDetail("request_id", requestID)
	
	// Add help URL if not set
	if serviceErr.HelpURL == "" {
		serviceErr.HelpURL = fmt.Sprintf("https://docs.service-layer.io/errors/%s", serviceErr.Code)
	}
	
	// Determine log level based on status code
	logError := true
	switch {
	case serviceErr.HTTPStatus >= 500:
		// Server errors should be logged as errors
		log.WithFields(map[string]interface{}{
			"request_id": requestID,
			"method":     method,
			"path":       path,
			"client_ip":  clientIP,
			"status":     serviceErr.HTTPStatus,
			"error_code": serviceErr.Code,
		}).Errorf("Server Error: %s", err.Error())
	case serviceErr.HTTPStatus >= 400 && serviceErr.HTTPStatus < 500:
		// Client errors should be logged as warnings
		log.WithFields(map[string]interface{}{
			"request_id": requestID,
			"method":     method,
			"path":       path,
			"client_ip":  clientIP,
			"status":     serviceErr.HTTPStatus,
			"error_code": serviceErr.Code,
		}).Warnf("Client Error: %s", err.Error())
		
		// Don't log detailed error for client errors
		logError = false
	default:
		// Other status codes should be logged as info
		log.WithFields(map[string]interface{}{
			"request_id": requestID,
			"method":     method,
			"path":       path,
			"client_ip":  clientIP,
			"status":     serviceErr.HTTPStatus,
			"error_code": serviceErr.Code,
		}).Infof("Request Error: %s", err.Error())
		
		// Don't log detailed error for non-error statuses
		logError = false
	}
	
	// Log detailed error information if needed
	if logError {
		log.WithFields(map[string]interface{}{
			"request_id": requestID,
			"error_code": serviceErr.Code,
			"details":    serviceErr.Details,
		}).Debugf("Error Details: %+v", err)
	}
	
	// Send error response
	c.JSON(serviceErr.HTTPStatus, serviceErr.ToResponse())
}