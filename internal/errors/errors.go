package errors

import (
	"fmt"
	"net/http"
	"strings"
)

// ServiceError is the base error type for the service
type ServiceError struct {
	Code       string                 `json:"code"`
	Message    string                 `json:"message"`
	Details    map[string]interface{} `json:"details,omitempty"`
	HelpURL    string                 `json:"help_url,omitempty"`
	HTTPStatus int                    `json:"-"`
	cause      error                  `json:"-"`
}

// Error implements the error interface
func (e *ServiceError) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %s)", e.Code, e.Message, e.cause.Error())
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the cause of this error
func (e *ServiceError) Unwrap() error {
	return e.cause
}

// ToResponse returns the error as an API response
func (e *ServiceError) ToResponse() map[string]interface{} {
	return map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"code":     e.Code,
			"message":  e.Message,
			"details":  e.Details,
			"help_url": e.HelpURL,
		},
	}
}

// New creates a new ServiceError
func New(code string, message string, httpStatus int) *ServiceError {
	return &ServiceError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
		Details:    make(map[string]interface{}),
		HelpURL:    fmt.Sprintf("https://docs.service-layer.io/errors/%s", code),
	}
}

// WithDetails adds details to the error
func (e *ServiceError) WithDetails(details map[string]interface{}) *ServiceError {
	e.Details = details
	return e
}

// WithDetail adds a single detail to the error
func (e *ServiceError) WithDetail(key string, value interface{}) *ServiceError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// WithCause adds the underlying cause to the error
func (e *ServiceError) WithCause(err error) *ServiceError {
	e.cause = err
	return e
}

// WithHelpURL sets a custom help URL for the error
func (e *ServiceError) WithHelpURL(url string) *ServiceError {
	e.HelpURL = url
	return e
}

// === Validation Errors ===

// ValidationError creates a new validation error
func ValidationError(message string) *ServiceError {
	return New("VALIDATION_ERROR", message, http.StatusBadRequest)
}

// FieldValidationError creates a validation error for specific fields
func FieldValidationError(fieldErrors map[string]string) *ServiceError {
	var fieldMsgs []string
	for field, msg := range fieldErrors {
		fieldMsgs = append(fieldMsgs, fmt.Sprintf("%s: %s", field, msg))
	}
	
	message := "One or more fields are invalid"
	if len(fieldMsgs) > 0 {
		message = fmt.Sprintf("%s: %s", message, strings.Join(fieldMsgs, "; "))
	}
	
	return ValidationError(message).WithDetail("fields", fieldErrors)
}

// === Authentication Errors ===

// AuthenticationError creates a new authentication error
func AuthenticationError(message string) *ServiceError {
	return New("AUTH_ERROR", message, http.StatusUnauthorized)
}

// TokenExpiredError creates a token expired error
func TokenExpiredError() *ServiceError {
	return New("AUTH_TOKEN_EXPIRED", "Authentication token has expired", http.StatusUnauthorized)
}

// TokenInvalidError creates a token invalid error
func TokenInvalidError(reason string) *ServiceError {
	return New("AUTH_TOKEN_INVALID", fmt.Sprintf("Authentication token is invalid: %s", reason), http.StatusUnauthorized)
}

// PermissionDeniedError creates a permission denied error
func PermissionDeniedError(resource string, action string) *ServiceError {
	return New(
		"AUTH_PERMISSION_DENIED",
		fmt.Sprintf("You don't have permission to %s this %s", action, resource),
		http.StatusForbidden,
	)
}

// === Resource Errors ===

// ResourceNotFoundError creates a new resource not found error
func ResourceNotFoundError(resourceType string, id interface{}) *ServiceError {
	code := fmt.Sprintf("RESOURCE_%s_NOT_FOUND", strings.ToUpper(resourceType))
	return New(
		code,
		fmt.Sprintf("%s with ID %v not found", resourceType, id),
		http.StatusNotFound,
	).WithDetail("resource_type", resourceType).WithDetail("id", id)
}

// ResourceAlreadyExistsError creates a resource already exists error
func ResourceAlreadyExistsError(resourceType string, key string, value interface{}) *ServiceError {
	code := fmt.Sprintf("RESOURCE_%s_ALREADY_EXISTS", strings.ToUpper(resourceType))
	return New(
		code,
		fmt.Sprintf("%s with %s %v already exists", resourceType, key, value),
		http.StatusConflict,
	).WithDetail("resource_type", resourceType).WithDetail(key, value)
}

// ResourceConflictError creates a resource conflict error
func ResourceConflictError(resourceType string, reason string) *ServiceError {
	code := fmt.Sprintf("RESOURCE_%s_CONFLICT", strings.ToUpper(resourceType))
	return New(
		code,
		fmt.Sprintf("%s conflict: %s", resourceType, reason),
		http.StatusConflict,
	).WithDetail("resource_type", resourceType)
}

// === System Errors ===

// InternalServerError creates a new internal server error
func InternalServerError(message string) *ServiceError {
	return New("SYSTEM_INTERNAL_ERROR", message, http.StatusInternalServerError)
}

// DatabaseError creates a database error
func DatabaseError(message string) *ServiceError {
	return New("SYSTEM_DATABASE_ERROR", message, http.StatusInternalServerError)
}

// ConfigurationError creates a configuration error
func ConfigurationError(message string) *ServiceError {
	return New("SYSTEM_CONFIGURATION_ERROR", message, http.StatusInternalServerError)
}

// ExternalServiceError creates an external service error
func ExternalServiceError(service string, message string) *ServiceError {
	return New(
		"SYSTEM_EXTERNAL_SERVICE_ERROR",
		fmt.Sprintf("%s service error: %s", service, message),
		http.StatusBadGateway,
	).WithDetail("service", service)
}

// === Blockchain Errors ===

// BlockchainError creates a blockchain error
func BlockchainError(message string) *ServiceError {
	return New("BLOCKCHAIN_ERROR", message, http.StatusInternalServerError)
}

// TransactionError creates a blockchain transaction error
func TransactionError(txid string, message string) *ServiceError {
	return New(
		"BLOCKCHAIN_TRANSACTION_ERROR",
		message,
		http.StatusBadRequest,
	).WithDetail("transaction_id", txid)
}

// ContractError creates a blockchain contract error
func ContractError(contract string, message string) *ServiceError {
	return New(
		"BLOCKCHAIN_CONTRACT_ERROR",
		fmt.Sprintf("Contract error in %s: %s", contract, message),
		http.StatusBadRequest,
	).WithDetail("contract", contract)
}

// === Function Errors ===

// FunctionError creates a function error
func FunctionError(message string) *ServiceError {
	return New("FUNCTION_ERROR", message, http.StatusInternalServerError)
}

// FunctionExecutionError creates a function execution error
func FunctionExecutionError(functionID int, message string) *ServiceError {
	return New(
		"FUNCTION_EXECUTION_ERROR",
		message,
		http.StatusInternalServerError,
	).WithDetail("function_id", functionID)
}

// FunctionTimeoutError creates a function timeout error
func FunctionTimeoutError(functionID int, timeout int) *ServiceError {
	return New(
		"FUNCTION_EXECUTION_TIMEOUT",
		fmt.Sprintf("Function execution timed out after %d seconds", timeout),
		http.StatusGatewayTimeout,
	).WithDetail("function_id", functionID).WithDetail("timeout", timeout)
}

// FunctionMemoryLimitError creates a function memory limit error
func FunctionMemoryLimitError(functionID int, limit int) *ServiceError {
	return New(
		"FUNCTION_MEMORY_LIMIT_EXCEEDED",
		fmt.Sprintf("Function exceeded memory limit of %d MB", limit),
		http.StatusInternalServerError,
	).WithDetail("function_id", functionID).WithDetail("memory_limit_mb", limit)
}

// FunctionCompilationError creates a function compilation error
func FunctionCompilationError(message string) *ServiceError {
	return New("FUNCTION_COMPILATION_ERROR", message, http.StatusBadRequest)
}

// === Rate Limiting Errors ===

// RateLimitExceededError creates a rate limit exceeded error
func RateLimitExceededError(limit int, windowSeconds int) *ServiceError {
	return New(
		"RATE_LIMIT_EXCEEDED",
		fmt.Sprintf("Rate limit of %d requests per %d seconds exceeded", limit, windowSeconds),
		http.StatusTooManyRequests,
	).WithDetail("limit", limit).WithDetail("window_seconds", windowSeconds)
}