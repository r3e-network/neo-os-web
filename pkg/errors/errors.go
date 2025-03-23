// Package errors provides standardized error types for the Service Layer.
package errors

import (
	"fmt"
	"net/http"
)

// Error codes - Input Validation Errors
const (
	CodeInvalidParameter = "INVALID_PARAMETER"
	CodeMissingParameter = "MISSING_PARAMETER"
	CodeInvalidFormat    = "INVALID_FORMAT"
	CodeInvalidState     = "INVALID_STATE"
)

// Error codes - Authentication and Authorization Errors
const (
	CodeUnauthorized       = "UNAUTHORIZED"
	CodeInvalidCredentials = "INVALID_CREDENTIALS"
	CodeTokenExpired       = "TOKEN_EXPIRED"
	CodePermissionDenied   = "PERMISSION_DENIED"
)

// Error codes - Resource Errors
const (
	CodeResourceNotFound      = "RESOURCE_NOT_FOUND"
	CodeResourceAlreadyExists = "RESOURCE_ALREADY_EXISTS"
	CodeResourceConflict      = "RESOURCE_CONFLICT"
)

// Error codes - Service Errors
const (
	CodeInternalError         = "INTERNAL_ERROR"
	CodeDatabaseError         = "DATABASE_ERROR"
	CodeBlockchainError       = "BLOCKCHAIN_ERROR"
	CodeServiceUnavailable    = "SERVICE_UNAVAILABLE"
	CodeRateLimitExceeded     = "RATE_LIMIT_EXCEEDED"
	CodeAPIDeprecated         = "API_DEPRECATED"
	CodeAPIVersionUnsupported = "API_VERSION_UNSUPPORTED"
)

// Error codes - TEE-Specific Errors
const (
	CodeExecutionTimeout     = "EXECUTION_TIMEOUT"
	CodeMemoryLimitExceeded  = "MEMORY_LIMIT_EXCEEDED"
	CodeSandboxViolation     = "SANDBOX_VIOLATION"
	CodeSecretAccessDenied   = "SECRET_ACCESS_DENIED"
	CodeFunctionCompileError = "FUNCTION_COMPILE_ERROR"
	CodeFunctionRuntimeError = "FUNCTION_RUNTIME_ERROR"
)

// Error codes - Blockchain-Specific Errors
const (
	CodeTxVerificationFailed    = "TX_VERIFICATION_FAILED"
	CodeContractExecutionFailed = "CONTRACT_EXECUTION_FAILED"
	CodeInsufficientGas         = "INSUFFICIENT_GAS"
	CodeNetworkFeeTooLow        = "NETWORK_FEE_TOO_LOW"
)

// ServiceError represents a standardized error returned by the service.
type ServiceError struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	HTTPCode  int                    `json:"-"` // Not serialized in JSON responses
	RequestID string                 `json:"requestId,omitempty"`
}

// Error implements the error interface.
func (e *ServiceError) Error() string {
	if len(e.Details) > 0 {
		return fmt.Sprintf("%s: %s (details: %v)", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// WithDetails adds details to the error.
func (e *ServiceError) WithDetails(details map[string]interface{}) *ServiceError {
	e.Details = details
	return e
}

// WithRequestID adds a request ID to the error.
func (e *ServiceError) WithRequestID(requestID string) *ServiceError {
	e.RequestID = requestID
	return e
}

// WithDetailField adds a single detail field to the error.
func (e *ServiceError) WithDetailField(key string, value interface{}) *ServiceError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// FromError converts a standard error to a ServiceError.
// If the error is already a ServiceError, it is returned as is.
func FromError(err error) *ServiceError {
	if err == nil {
		return nil
	}

	if serviceErr, ok := err.(*ServiceError); ok {
		return serviceErr
	}

	// Default to internal error
	return NewInternalError(err.Error())
}

// ToResponse converts a ServiceError to a standardized API response.
func (e *ServiceError) ToResponse() map[string]interface{} {
	return map[string]interface{}{
		"error": map[string]interface{}{
			"code":      e.Code,
			"message":   e.Message,
			"details":   e.Details,
			"requestId": e.RequestID,
		},
	}
}

// 1. Input Validation Errors

// NewInvalidParameterError creates a new invalid parameter error.
func NewInvalidParameterError(paramName, reason string) *ServiceError {
	return &ServiceError{
		Code:     CodeInvalidParameter,
		Message:  fmt.Sprintf("Invalid parameter: %s", paramName),
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"parameter": paramName,
			"reason":    reason,
		},
	}
}

// NewMissingParameterError creates a new missing parameter error.
func NewMissingParameterError(paramName string) *ServiceError {
	return &ServiceError{
		Code:     CodeMissingParameter,
		Message:  fmt.Sprintf("Missing required parameter: %s", paramName),
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"parameter": paramName,
		},
	}
}

// NewInvalidFormatError creates a new invalid format error.
func NewInvalidFormatError(message string) *ServiceError {
	return &ServiceError{
		Code:     CodeInvalidFormat,
		Message:  message,
		HTTPCode: http.StatusBadRequest,
	}
}

// NewInvalidStateError creates a new invalid state error.
func NewInvalidStateError(message string) *ServiceError {
	return &ServiceError{
		Code:     CodeInvalidState,
		Message:  message,
		HTTPCode: http.StatusBadRequest,
	}
}

// 2. Authentication and Authorization Errors

// NewUnauthorizedError creates a new unauthorized error.
func NewUnauthorizedError() *ServiceError {
	return &ServiceError{
		Code:     CodeUnauthorized,
		Message:  "Authentication is required to access this resource",
		HTTPCode: http.StatusUnauthorized,
	}
}

// NewInvalidCredentialsError creates a new invalid credentials error.
func NewInvalidCredentialsError() *ServiceError {
	return &ServiceError{
		Code:     CodeInvalidCredentials,
		Message:  "Invalid credentials provided",
		HTTPCode: http.StatusUnauthorized,
	}
}

// NewTokenExpiredError creates a new token expired error.
func NewTokenExpiredError() *ServiceError {
	return &ServiceError{
		Code:     CodeTokenExpired,
		Message:  "Authentication token has expired",
		HTTPCode: http.StatusUnauthorized,
	}
}

// NewPermissionDeniedError creates a new permission denied error.
func NewPermissionDeniedError(resource, action string) *ServiceError {
	return &ServiceError{
		Code:     CodePermissionDenied,
		Message:  "You don't have permission to perform this action",
		HTTPCode: http.StatusForbidden,
		Details: map[string]interface{}{
			"resource": resource,
			"action":   action,
		},
	}
}

// 3. Resource Errors

// NewResourceNotFoundError creates a new resource not found error.
func NewResourceNotFoundError(resourceType, resourceID string) *ServiceError {
	return &ServiceError{
		Code:     CodeResourceNotFound,
		Message:  fmt.Sprintf("%s not found: %s", resourceType, resourceID),
		HTTPCode: http.StatusNotFound,
		Details: map[string]interface{}{
			"resourceType": resourceType,
			"resourceId":   resourceID,
		},
	}
}

// NewResourceAlreadyExistsError creates a new resource already exists error.
func NewResourceAlreadyExistsError(resourceType, resourceID string) *ServiceError {
	return &ServiceError{
		Code:     CodeResourceAlreadyExists,
		Message:  fmt.Sprintf("%s already exists: %s", resourceType, resourceID),
		HTTPCode: http.StatusConflict,
		Details: map[string]interface{}{
			"resourceType": resourceType,
			"resourceId":   resourceID,
		},
	}
}

// NewResourceConflictError creates a new resource conflict error.
func NewResourceConflictError(resourceType, resourceID, reason string) *ServiceError {
	return &ServiceError{
		Code:     CodeResourceConflict,
		Message:  fmt.Sprintf("Conflict with %s: %s", resourceType, resourceID),
		HTTPCode: http.StatusConflict,
		Details: map[string]interface{}{
			"resourceType": resourceType,
			"resourceId":   resourceID,
			"reason":       reason,
		},
	}
}

// 4. Service Errors

// NewInternalError creates a new internal error.
func NewInternalError(message string) *ServiceError {
	return &ServiceError{
		Code:     CodeInternalError,
		Message:  message,
		HTTPCode: http.StatusInternalServerError,
	}
}

// NewDatabaseError creates a new database error.
func NewDatabaseError(operation string, err error) *ServiceError {
	return &ServiceError{
		Code:     CodeDatabaseError,
		Message:  fmt.Sprintf("Database error during %s", operation),
		HTTPCode: http.StatusInternalServerError,
		Details: map[string]interface{}{
			"operation": operation,
			"error":     err.Error(),
		},
	}
}

// NewBlockchainError creates a new blockchain error.
func NewBlockchainError(operation string, err error) *ServiceError {
	return &ServiceError{
		Code:     CodeBlockchainError,
		Message:  fmt.Sprintf("Blockchain error during %s", operation),
		HTTPCode: http.StatusInternalServerError,
		Details: map[string]interface{}{
			"operation": operation,
			"error":     err.Error(),
		},
	}
}

// NewServiceUnavailableError creates a new service unavailable error.
func NewServiceUnavailableError(reason string) *ServiceError {
	return &ServiceError{
		Code:     CodeServiceUnavailable,
		Message:  "Service temporarily unavailable",
		HTTPCode: http.StatusServiceUnavailable,
		Details: map[string]interface{}{
			"reason": reason,
		},
	}
}

// NewRateLimitExceededError creates a new rate limit exceeded error.
func NewRateLimitExceededError(limit int, timeWindow string) *ServiceError {
	return &ServiceError{
		Code:     CodeRateLimitExceeded,
		Message:  "Rate limit exceeded",
		HTTPCode: http.StatusTooManyRequests,
		Details: map[string]interface{}{
			"limit":      limit,
			"timeWindow": timeWindow,
			"retryAfter": "60s",
		},
	}
}

// 5. TEE-Specific Errors

// NewExecutionTimeoutError creates a new execution timeout error.
func NewExecutionTimeoutError(functionID string, timeout int) *ServiceError {
	return &ServiceError{
		Code:     CodeExecutionTimeout,
		Message:  "Function execution timed out",
		HTTPCode: http.StatusRequestTimeout,
		Details: map[string]interface{}{
			"functionId": functionID,
			"timeout":    timeout,
		},
	}
}

// NewMemoryLimitExceededError creates a new memory limit exceeded error.
func NewMemoryLimitExceededError(functionID string, limit int) *ServiceError {
	return &ServiceError{
		Code:     CodeMemoryLimitExceeded,
		Message:  "Function exceeded memory limit",
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"functionId": functionID,
			"limit":      limit,
		},
	}
}

// NewSandboxViolationError creates a new sandbox violation error.
func NewSandboxViolationError(functionID, violation string) *ServiceError {
	return &ServiceError{
		Code:     CodeSandboxViolation,
		Message:  "Function attempted to violate the sandbox",
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"functionId": functionID,
			"violation":  violation,
		},
	}
}

// NewSecretAccessDeniedError creates a new secret access denied error.
func NewSecretAccessDeniedError(functionID, secretName string) *ServiceError {
	return &ServiceError{
		Code:     CodeSecretAccessDenied,
		Message:  "Function attempted to access unauthorized secret",
		HTTPCode: http.StatusForbidden,
		Details: map[string]interface{}{
			"functionId": functionID,
			"secretName": secretName,
		},
	}
}

// 6. Blockchain-Specific Errors

// NewTxVerificationFailedError creates a new transaction verification failed error.
func NewTxVerificationFailedError(reason string) *ServiceError {
	return &ServiceError{
		Code:     CodeTxVerificationFailed,
		Message:  "Transaction verification failed",
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"reason": reason,
		},
	}
}

// NewContractExecutionFailedError creates a new contract execution failed error.
func NewContractExecutionFailedError(contractHash, operation, reason string) *ServiceError {
	return &ServiceError{
		Code:     CodeContractExecutionFailed,
		Message:  "Smart contract execution failed",
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"contractHash": contractHash,
			"operation":    operation,
			"reason":       reason,
		},
	}
}

// NewInsufficientGasError creates a new insufficient gas error.
func NewInsufficientGasError(required, available int64) *ServiceError {
	return &ServiceError{
		Code:     CodeInsufficientGas,
		Message:  "Insufficient gas for transaction",
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"required":  required,
			"available": available,
		},
	}
}

// NewNetworkFeeTooLowError creates a new network fee too low error.
func NewNetworkFeeTooLowError(required, provided int64) *ServiceError {
	return &ServiceError{
		Code:     CodeNetworkFeeTooLow,
		Message:  "Network fee is too low",
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"required": required,
			"provided": provided,
		},
	}
}

// 7. Additional API Errors

// NewAPIDeprecatedError creates a new API deprecated error.
func NewAPIDeprecatedError(version string, sunsetDate string) *ServiceError {
	return &ServiceError{
		Code:     CodeAPIDeprecated,
		Message:  fmt.Sprintf("API version %s is deprecated and will be removed after %s", version, sunsetDate),
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"version":    version,
			"sunsetDate": sunsetDate,
			"upgradeUrl": "https://docs.service-layer.io/api/upgrade",
		},
	}
}

// NewAPIVersionUnsupportedError creates a new API version unsupported error.
func NewAPIVersionUnsupportedError(requestedVersion string, supportedVersions []string) *ServiceError {
	return &ServiceError{
		Code:     CodeAPIVersionUnsupported,
		Message:  fmt.Sprintf("API version %s is not supported", requestedVersion),
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"requestedVersion":  requestedVersion,
			"supportedVersions": supportedVersions,
			"docsUrl":           "https://docs.service-layer.io/api/versions",
		},
	}
}

// 8. Function-Specific Errors

// NewFunctionCompileError creates a new function compile error.
func NewFunctionCompileError(functionID string, errors []string) *ServiceError {
	return &ServiceError{
		Code:     CodeFunctionCompileError,
		Message:  "Function compilation failed",
		HTTPCode: http.StatusBadRequest,
		Details: map[string]interface{}{
			"functionId": functionID,
			"errors":     errors,
		},
	}
}

// NewFunctionRuntimeError creates a new function runtime error.
func NewFunctionRuntimeError(functionID string, errorMessage string, stackTrace string) *ServiceError {
	return &ServiceError{
		Code:     CodeFunctionRuntimeError,
		Message:  "Function execution failed at runtime",
		HTTPCode: http.StatusInternalServerError,
		Details: map[string]interface{}{
			"functionId": functionID,
			"error":      errorMessage,
			"stackTrace": stackTrace,
		},
	}
}
