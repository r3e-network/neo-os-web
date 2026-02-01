package httputil

import (
	"context"
	"net/http"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

// HandlerHelper provides common HTTP handler utilities to reduce boilerplate
type HandlerHelper struct {
	Logger *logging.Logger
}

// NewHandlerHelper creates a new handler helper with the given logger
func NewHandlerHelper(logger *logging.Logger) *HandlerHelper {
	return &HandlerHelper{Logger: logger}
}

// HandlerFunc is a function that handles an HTTP request and returns a response or error
type HandlerFunc func(ctx context.Context, userID string) (interface{}, error)

// HandleAuthenticated wraps a handler function with common authentication and error handling logic.
// It extracts the user ID, handles errors consistently, and logs appropriately.
func (h *HandlerHelper) HandleAuthenticated(w http.ResponseWriter, r *http.Request, handler HandlerFunc) {
	// Extract user ID
	userID, ok := RequireUserID(w, r)
	if !ok {
		return
	}

	// Call handler
	result, err := handler(r.Context(), userID)
	if err != nil {
		h.handleError(w, r, err)
		return
	}

	// Write success response
	WriteJSON(w, http.StatusOK, result)
}

// HandleAuthenticatedWithRequest wraps a handler that needs request body parsing
func (h *HandlerHelper) HandleAuthenticatedWithRequest(w http.ResponseWriter, r *http.Request, req interface{}, handler func(ctx context.Context, userID string, req interface{}) (interface{}, error)) {
	// Extract user ID
	userID, ok := RequireUserID(w, r)
	if !ok {
		return
	}

	// Decode request
	if !DecodeJSON(w, r, req) {
		return
	}

	// Call handler
	result, err := handler(r.Context(), userID, req)
	if err != nil {
		h.handleError(w, r, err)
		return
	}

	// Write success response
	WriteJSON(w, http.StatusOK, result)
}

// HandlePublic wraps a handler that doesn't require authentication
func (h *HandlerHelper) HandlePublic(w http.ResponseWriter, r *http.Request, handler func(ctx context.Context) (interface{}, error)) {
	result, err := handler(r.Context())
	if err != nil {
		h.handleError(w, r, err)
		return
	}

	WriteJSON(w, http.StatusOK, result)
}

// handleError handles errors consistently across handlers
func (h *HandlerHelper) handleError(w http.ResponseWriter, r *http.Request, err error) {
	// Log error
	if h.Logger != nil {
		h.Logger.WithContext(r.Context()).WithError(err).Error("handler error")
	}

	// Check for specific error types and map to appropriate HTTP status
	switch e := err.(type) {
	case *NotFoundError:
		NotFound(w, e.Error())
	case *ValidationError:
		BadRequest(w, e.Error())
	case *UnauthorizedError:
		Unauthorized(w, e.Error())
	case *ConflictError:
		Conflict(w, e.Error())
	default:
		InternalError(w, "internal server error")
	}
}

// Common error types for handler error mapping
type NotFoundError struct{ Message string }

func (e *NotFoundError) Error() string { return e.Message }

type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

type UnauthorizedError struct{ Message string }

func (e *UnauthorizedError) Error() string { return e.Message }

type ConflictError struct{ Message string }

func (e *ConflictError) Error() string { return e.Message }

// DecodeAndValidate decodes JSON and runs validation
func DecodeAndValidate(w http.ResponseWriter, r *http.Request, req interface{}, validate func() error) bool {
	if !DecodeJSON(w, r, req) {
		return false
	}

	if err := validate(); err != nil {
		BadRequest(w, err.Error())
		return false
	}

	return true
}

// RespondCreated writes a 201 Created response with the given data
func RespondCreated(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusCreated, data)
}

// RespondNoContent writes a 204 No Content response
func RespondNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// RequireJSONContentType checks that the request has application/json content type
func RequireJSONContentType(w http.ResponseWriter, r *http.Request) bool {
	contentType := r.Header.Get("Content-Type")
	if contentType != "application/json" {
		BadRequest(w, "Content-Type must be application/json")
		return false
	}
	return true
}
