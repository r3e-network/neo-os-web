package httputil

import (
	"context"
	"net/http"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

// ---------------------------------------------------------------------------
// Typed error types for handler error mapping
// ---------------------------------------------------------------------------

// NotFoundError maps to 404 Not Found.
type NotFoundError struct{ Message string }

func (e *NotFoundError) Error() string { return e.Message }

// ValidationError maps to 400 Bad Request.
type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

// UnauthorizedError maps to 401 Unauthorized.
type UnauthorizedError struct{ Message string }

func (e *UnauthorizedError) Error() string { return e.Message }

// ConflictError maps to 409 Conflict.
type ConflictError struct{ Message string }

func (e *ConflictError) Error() string { return e.Message }

// ServiceUnavailableError maps to 503 Service Unavailable.
type ServiceUnavailableError struct{ Message string }

func (e *ServiceUnavailableError) Error() string { return e.Message }

// handleError logs the error and writes the appropriate HTTP status based on
// the error's concrete type.
func handleError(w http.ResponseWriter, r *http.Request, logger *logging.Logger, err error) {
	if logger != nil {
		logger.WithContext(r.Context()).WithError(err).Error("handler failed")
	}

	switch e := err.(type) {
	case *NotFoundError:
		NotFound(w, e.Error())
	case *ValidationError:
		BadRequest(w, e.Error())
	case *UnauthorizedError:
		Unauthorized(w, e.Error())
	case *ConflictError:
		Conflict(w, e.Error())
	case *ServiceUnavailableError:
		ServiceUnavailable(w, e.Error())
	default:
		InternalError(w, "internal server error")
	}
}

// ---------------------------------------------------------------------------
// Generic handler wrappers
// ---------------------------------------------------------------------------

// HandleJSON decodes a JSON request body into Req, calls fn, and writes the
// result as a JSON response. It eliminates the repeated
// decode → execute → respond boilerplate.
func HandleJSON[Req any, Resp any](
	logger *logging.Logger,
	fn func(ctx context.Context, req *Req) (Resp, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req Req
		if !DecodeJSON(w, r, &req) {
			return
		}
		resp, err := fn(r.Context(), &req)
		if err != nil {
			handleError(w, r, logger, err)
			return
		}
		WriteJSON(w, http.StatusOK, resp)
	}
}

// HandleJSONWithUserAuth is like HandleJSON but first extracts and validates
// the user ID from the request.
func HandleJSONWithUserAuth[Req any, Resp any](
	logger *logging.Logger,
	fn func(ctx context.Context, userID string, req *Req) (Resp, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := RequireUserID(w, r)
		if !ok {
			return
		}
		var req Req
		if !DecodeJSON(w, r, &req) {
			return
		}
		resp, err := fn(r.Context(), userID, &req)
		if err != nil {
			handleError(w, r, logger, err)
			return
		}
		WriteJSON(w, http.StatusOK, resp)
	}
}

// HandleNoBody handles requests that carry no JSON body (typically GET).
// It calls fn and writes the result as JSON.
func HandleNoBody[Resp any](
	logger *logging.Logger,
	fn func(ctx context.Context) (Resp, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp, err := fn(r.Context())
		if err != nil {
			handleError(w, r, logger, err)
			return
		}
		WriteJSON(w, http.StatusOK, resp)
	}
}

// HandleNoBodyWithUserAuth handles body-less requests that require user
// authentication.
func HandleNoBodyWithUserAuth[Resp any](
	logger *logging.Logger,
	fn func(ctx context.Context, userID string) (Resp, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := RequireUserID(w, r)
		if !ok {
			return
		}
		resp, err := fn(r.Context(), userID)
		if err != nil {
			handleError(w, r, logger, err)
			return
		}
		WriteJSON(w, http.StatusOK, resp)
	}
}

// HandleJSONWithServiceAuth is like HandleJSON but first extracts and
// validates the service ID from the request (mTLS / service-to-service).
func HandleJSONWithServiceAuth[Req any, Resp any](
	logger *logging.Logger,
	fn func(ctx context.Context, serviceID string, req *Req) (Resp, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serviceID, ok := RequireServiceID(w, r)
		if !ok {
			return
		}
		var req Req
		if !DecodeJSON(w, r, &req) {
			return
		}
		resp, err := fn(r.Context(), serviceID, &req)
		if err != nil {
			handleError(w, r, logger, err)
			return
		}
		WriteJSON(w, http.StatusOK, resp)
	}
}

// ---------------------------------------------------------------------------
// Legacy HandlerHelper (kept for backward compatibility)
// ---------------------------------------------------------------------------

// HandlerHelper provides common HTTP handler utilities to reduce boilerplate.
//
// Deprecated: Use the generic free functions (HandleJSON, HandleNoBodyWithUserAuth, etc.) instead.
type HandlerHelper struct {
	Logger *logging.Logger
}

// NewHandlerHelper creates a new handler helper with the given logger.
//
// Deprecated: Use the generic free functions instead.
func NewHandlerHelper(logger *logging.Logger) *HandlerHelper {
	return &HandlerHelper{Logger: logger}
}

// HandlerFunc is a function that handles an HTTP request and returns a response or error.
//
// Deprecated: Use the generic free functions instead.
type HandlerFunc func(ctx context.Context, userID string) (interface{}, error)

// HandleAuthenticated wraps a handler function with common authentication and error handling logic.
//
// Deprecated: Use HandleNoBodyWithUserAuth instead.
func (h *HandlerHelper) HandleAuthenticated(w http.ResponseWriter, r *http.Request, handler HandlerFunc) {
	userID, ok := RequireUserID(w, r)
	if !ok {
		return
	}
	result, err := handler(r.Context(), userID)
	if err != nil {
		handleError(w, r, h.Logger, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}

// HandleAuthenticatedWithRequest wraps a handler that needs request body parsing.
//
// Deprecated: Use HandleJSONWithUserAuth instead.
func (h *HandlerHelper) HandleAuthenticatedWithRequest(w http.ResponseWriter, r *http.Request, req interface{}, handler func(ctx context.Context, userID string, req interface{}) (interface{}, error)) {
	userID, ok := RequireUserID(w, r)
	if !ok {
		return
	}
	if !DecodeJSON(w, r, req) {
		return
	}
	result, err := handler(r.Context(), userID, req)
	if err != nil {
		handleError(w, r, h.Logger, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}

// HandlePublic wraps a handler that doesn't require authentication.
//
// Deprecated: Use HandleNoBody instead.
func (h *HandlerHelper) HandlePublic(w http.ResponseWriter, r *http.Request, handler func(ctx context.Context) (interface{}, error)) {
	result, err := handler(r.Context())
	if err != nil {
		handleError(w, r, h.Logger, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}

// ---------------------------------------------------------------------------
// Convenience helpers (kept from previous version)
// ---------------------------------------------------------------------------

// DecodeAndValidate decodes JSON and runs a validation function.
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

// RespondCreated writes a 201 Created response with the given data.
func RespondCreated(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusCreated, data)
}

// RespondNoContent writes a 204 No Content response.
func RespondNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// RequireJSONContentType checks that the request has application/json content type.
func RequireJSONContentType(w http.ResponseWriter, r *http.Request) bool {
	contentType := r.Header.Get("Content-Type")
	if contentType != "application/json" {
		BadRequest(w, "Content-Type must be application/json")
		return false
	}
	return true
}
