// Package middleware provides HTTP middleware components for the Service Layer.
package middleware

import (
	"fmt"

	"github.com/R3E-Network/service_layer/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// ErrorHandler is a middleware that handles errors and standardizes the error response format.
// It captures errors from gin's error chain, converts them to ServiceError types,
// adds request IDs, logs errors, and sends standardized error responses to clients.
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate a request ID if not already set
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
			c.Header("X-Request-ID", requestID)
		}

		// Process the request
		c.Next()

		// Check if there were any errors
		if len(c.Errors) > 0 {
			// Get the last error
			err := c.Errors.Last().Err

			// Convert to ServiceError if it's not already
			var svcErr *errors.ServiceError
			if e, ok := err.(*errors.ServiceError); ok {
				svcErr = e
			} else {
				// Default to internal server error for unknown errors
				svcErr = errors.NewInternalError(err.Error())
			}

			// Add request ID to the error
			svcErr = svcErr.WithRequestID(requestID)

			// Log the error with context
			logError(c, svcErr)

			// Respond with error
			c.JSON(svcErr.HTTPCode, svcErr.ToResponse())
			c.Abort()
		}
	}
}

// logError logs an error with context information
func logError(c *gin.Context, err *errors.ServiceError) {
	// Prepare log fields
	logContext := map[string]interface{}{
		"requestId":   err.RequestID,
		"errorCode":   err.Code,
		"httpStatus":  err.HTTPCode,
		"clientIP":    c.ClientIP(),
		"method":      c.Request.Method,
		"path":        c.Request.URL.Path,
		"queryParams": c.Request.URL.RawQuery,
	}

	// Add user ID if available
	if userID, exists := c.Get("userId"); exists {
		logContext["userId"] = userID
	}

	// Add details if available
	if err.Details != nil {
		logContext["errorDetails"] = err.Details
	}

	// Log at the appropriate level based on HTTP status
	logger := log.With().Fields(logContext).Logger()

	if err.HTTPCode >= 500 {
		logger.Error().Msg(fmt.Sprintf("Server error: %s", err.Message))
	} else {
		logger.Info().Msg(fmt.Sprintf("Client error: %s", err.Message))
	}
}

// ValidationErrorHandler is a middleware that handles validation errors.
// It should be used with validators like go-playground/validator.
func ValidationErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check for validation errors
		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				// Check if this is a validation error that hasn't been handled yet
				// This would typically be set by a validation middleware
				if _, exists := c.Get("validation_handled"); !exists && e.Type == gin.ErrorTypeBind {
					// Create a validation error
					validationErr := errors.NewInvalidFormatError("Invalid request format")

					// Add request ID
					requestID := c.GetHeader("X-Request-ID")
					if requestID == "" {
						requestID = uuid.New().String()
						c.Header("X-Request-ID", requestID)
					}
					validationErr = validationErr.WithRequestID(requestID)

					// Log the error
					logError(c, validationErr)

					// Respond with the error
					c.JSON(validationErr.HTTPCode, validationErr.ToResponse())
					c.Abort()
					return
				}
			}
		}
	}
}

// RequestLogger is a middleware that logs all incoming requests.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate a request ID if not already set
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
			c.Header("X-Request-ID", requestID)
		}

		// Log the request
		log.Info().
			Str("requestId", requestID).
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Str("query", c.Request.URL.RawQuery).
			Str("ip", c.ClientIP()).
			Str("userAgent", c.Request.UserAgent()).
			Msg("Request received")

		// Process the request
		c.Next()

		// Log the response
		log.Info().
			Str("requestId", requestID).
			Int("status", c.Writer.Status()).
			Int("size", c.Writer.Size()).
			Float64("duration", float64(c.GetDuration("duration").Milliseconds())).
			Msg("Response sent")
	}
}
