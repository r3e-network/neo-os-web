// Package middleware provides HTTP middleware for the service layer.
//
// This file contains error types and constructors previously in
// infrastructure/errors, inlined here because middleware is the sole consumer.
package middleware

import (
	"errors"
	"fmt"
	"net/http"
)

// ErrorCode represents a unique error code.
type ErrorCode string

const (
	// Authentication errors
	ErrCodeUnauthorized ErrorCode = "AUTH_1001"
	ErrCodeInvalidToken ErrorCode = "AUTH_1002"

	// Authorization errors
	ErrCodeForbidden ErrorCode = "AUTHZ_2001"

	// Validation errors
	ErrCodeInvalidFormat ErrorCode = "VAL_3003"

	// Service errors
	ErrCodeInternal          ErrorCode = "SVC_5001"
	ErrCodeRateLimitExceeded ErrorCode = "SVC_5006"
)

// ServiceError represents a structured error with code, message, and HTTP status.
type ServiceError struct {
	Code       ErrorCode              `json:"code"`
	Message    string                 `json:"message"`
	HTTPStatus int                    `json:"-"`
	Details    map[string]interface{} `json:"details,omitempty"`
	Err        error                  `json:"-"`
}

// Error implements the error interface.
func (e *ServiceError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Unwrap returns the underlying error.
func (e *ServiceError) Unwrap() error {
	return e.Err
}

// WithDetails adds additional details to the error.
func (e *ServiceError) WithDetails(key string, value interface{}) *ServiceError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// newServiceError creates a new ServiceError.
func newServiceError(code ErrorCode, message string, httpStatus int) *ServiceError {
	return &ServiceError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
	}
}

// wrapServiceError wraps an existing error with a ServiceError.
func wrapServiceError(code ErrorCode, message string, httpStatus int, err error) *ServiceError {
	return &ServiceError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
		Err:        err,
	}
}

// errUnauthorized creates an unauthorized error.
func errUnauthorized(message string) *ServiceError {
	return newServiceError(ErrCodeUnauthorized, message, http.StatusUnauthorized)
}

// errInvalidToken creates an invalid token error.
func errInvalidToken(err error) *ServiceError {
	return wrapServiceError(ErrCodeInvalidToken, "Invalid authentication token", http.StatusUnauthorized, err)
}

// errForbidden creates a forbidden error.
func errForbidden(message string) *ServiceError {
	return newServiceError(ErrCodeForbidden, message, http.StatusForbidden)
}

// errInvalidFormat creates an invalid format error.
func errInvalidFormat(field, expected string) *ServiceError {
	return newServiceError(ErrCodeInvalidFormat, "Invalid format", http.StatusBadRequest).
		WithDetails("field", field).
		WithDetails("expected", expected)
}

// errInternal creates an internal server error.
func errInternal(message string, err error) *ServiceError {
	return wrapServiceError(ErrCodeInternal, message, http.StatusInternalServerError, err)
}

// errRateLimitExceeded creates a rate limit exceeded error.
func errRateLimitExceeded(limit int, window string) *ServiceError {
	return newServiceError(ErrCodeRateLimitExceeded, "Rate limit exceeded", http.StatusTooManyRequests).
		WithDetails("limit", limit).
		WithDetails("window", window)
}

// getServiceError extracts a ServiceError from an error chain.
func getServiceError(err error) *ServiceError {
	var serviceErr *ServiceError
	if errors.As(err, &serviceErr) {
		return serviceErr
	}
	return nil
}
