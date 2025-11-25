// Package framework provides the service development framework for the service layer.
package framework

import (
	"errors"
	"fmt"
)

// Standard framework errors.
var (
	// ErrBusUnavailable is returned when no bus engine is configured.
	ErrBusUnavailable = errors.New("bus unavailable")

	// ErrServiceNotReady is returned when a service is not ready to handle requests.
	ErrServiceNotReady = errors.New("service not ready")

	// ErrServiceNotStarted is returned when trying to use a service that hasn't been started.
	ErrServiceNotStarted = errors.New("service not started")

	// ErrServiceAlreadyStarted is returned when trying to start a service that's already running.
	ErrServiceAlreadyStarted = errors.New("service already started")

	// ErrServiceStartFailed is returned when a service fails to start.
	ErrServiceStartFailed = errors.New("service start failed")

	// ErrServiceStopFailed is returned when a service fails to stop gracefully.
	ErrServiceStopFailed = errors.New("service stop failed")

	// ErrInvalidConfig is returned when service configuration is invalid.
	ErrInvalidConfig = errors.New("invalid configuration")

	// ErrMissingDependency is returned when a required dependency is not available.
	ErrMissingDependency = errors.New("missing dependency")

	// ErrDependencyCycle is returned when a circular dependency is detected.
	ErrDependencyCycle = errors.New("dependency cycle detected")

	// ErrTimeout is returned when an operation times out.
	ErrTimeout = errors.New("operation timed out")

	// ErrCanceled is returned when an operation is canceled.
	ErrCanceled = errors.New("operation canceled")

	// ErrInvalidManifest is returned when a service manifest is invalid.
	ErrInvalidManifest = errors.New("invalid manifest")

	// ErrHookFailed is returned when a lifecycle hook fails.
	ErrHookFailed = errors.New("lifecycle hook failed")

	// ErrResourceExhausted is returned when a resource limit is reached.
	ErrResourceExhausted = errors.New("resource exhausted")

	// ErrQuotaExceeded is returned when a quota limit is exceeded.
	ErrQuotaExceeded = errors.New("quota exceeded")

	// ErrPermissionDenied is returned when an operation is not permitted.
	ErrPermissionDenied = errors.New("permission denied")
)

// ServiceError wraps an error with service context.
type ServiceError struct {
	Service string // Service name
	Op      string // Operation that failed
	Err     error  // Underlying error
}

// Error implements the error interface.
func (e *ServiceError) Error() string {
	if e.Op != "" {
		return fmt.Sprintf("%s: %s: %v", e.Service, e.Op, e.Err)
	}
	return fmt.Sprintf("%s: %v", e.Service, e.Err)
}

// Unwrap returns the underlying error.
func (e *ServiceError) Unwrap() error {
	return e.Err
}

// NewServiceError creates a new ServiceError.
func NewServiceError(service, op string, err error) *ServiceError {
	return &ServiceError{
		Service: service,
		Op:      op,
		Err:     err,
	}
}

// WrapServiceError wraps an error with service context.
// If err is nil, returns nil.
func WrapServiceError(service, op string, err error) error {
	if err == nil {
		return nil
	}
	return NewServiceError(service, op, err)
}

// ConfigError represents a configuration validation error.
type ConfigError struct {
	Field   string // Configuration field name
	Value   any    // Invalid value (optional)
	Message string // Error message
}

// Error implements the error interface.
func (e *ConfigError) Error() string {
	if e.Value != nil {
		return fmt.Sprintf("config error: %s=%v: %s", e.Field, e.Value, e.Message)
	}
	return fmt.Sprintf("config error: %s: %s", e.Field, e.Message)
}

// Unwrap returns ErrInvalidConfig.
func (e *ConfigError) Unwrap() error {
	return ErrInvalidConfig
}

// NewConfigError creates a new ConfigError.
func NewConfigError(field, message string) *ConfigError {
	return &ConfigError{
		Field:   field,
		Message: message,
	}
}

// NewConfigErrorWithValue creates a new ConfigError with the invalid value.
func NewConfigErrorWithValue(field string, value any, message string) *ConfigError {
	return &ConfigError{
		Field:   field,
		Value:   value,
		Message: message,
	}
}

// DependencyError represents a dependency-related error.
type DependencyError struct {
	Service    string   // Service that has the dependency issue
	Missing    []string // Missing dependencies
	Cycle      []string // Cycle path (if cycle detected)
	Underlying error    // Underlying error
}

// Error implements the error interface.
func (e *DependencyError) Error() string {
	if len(e.Cycle) > 0 {
		return fmt.Sprintf("%s: dependency cycle: %v", e.Service, e.Cycle)
	}
	if len(e.Missing) > 0 {
		return fmt.Sprintf("%s: missing dependencies: %v", e.Service, e.Missing)
	}
	if e.Underlying != nil {
		return fmt.Sprintf("%s: dependency error: %v", e.Service, e.Underlying)
	}
	return fmt.Sprintf("%s: dependency error", e.Service)
}

// Unwrap returns the underlying error or ErrMissingDependency.
func (e *DependencyError) Unwrap() error {
	if e.Underlying != nil {
		return e.Underlying
	}
	if len(e.Cycle) > 0 {
		return ErrDependencyCycle
	}
	return ErrMissingDependency
}

// NewMissingDependencyError creates a new DependencyError for missing dependencies.
func NewMissingDependencyError(service string, missing ...string) *DependencyError {
	return &DependencyError{
		Service: service,
		Missing: missing,
	}
}

// NewDependencyCycleError creates a new DependencyError for a dependency cycle.
func NewDependencyCycleError(service string, cycle []string) *DependencyError {
	return &DependencyError{
		Service: service,
		Cycle:   cycle,
	}
}

// HookError represents a lifecycle hook error.
type HookError struct {
	Service  string // Service name
	HookType string // Hook type (PreStart, PostStart, PreStop, PostStop)
	HookName string // Optional hook name
	Err      error  // Underlying error
}

// Error implements the error interface.
func (e *HookError) Error() string {
	if e.HookName != "" {
		return fmt.Sprintf("%s: %s hook %q failed: %v", e.Service, e.HookType, e.HookName, e.Err)
	}
	return fmt.Sprintf("%s: %s hook failed: %v", e.Service, e.HookType, e.Err)
}

// Unwrap returns the underlying error.
func (e *HookError) Unwrap() error {
	return e.Err
}

// NewHookError creates a new HookError.
func NewHookError(service, hookType string, err error) *HookError {
	return &HookError{
		Service:  service,
		HookType: hookType,
		Err:      err,
	}
}

// NewNamedHookError creates a new HookError with a hook name.
func NewNamedHookError(service, hookType, hookName string, err error) *HookError {
	return &HookError{
		Service:  service,
		HookType: hookType,
		HookName: hookName,
		Err:      err,
	}
}

// IsServiceNotReady returns true if the error indicates a service is not ready.
func IsServiceNotReady(err error) bool {
	return errors.Is(err, ErrServiceNotReady)
}

// IsTimeout returns true if the error indicates a timeout.
func IsTimeout(err error) bool {
	return errors.Is(err, ErrTimeout)
}

// IsCanceled returns true if the error indicates a canceled operation.
func IsCanceled(err error) bool {
	return errors.Is(err, ErrCanceled)
}

// IsConfigError returns true if the error is a configuration error.
func IsConfigError(err error) bool {
	return errors.Is(err, ErrInvalidConfig)
}

// IsDependencyError returns true if the error is a dependency error.
func IsDependencyError(err error) bool {
	return errors.Is(err, ErrMissingDependency) || errors.Is(err, ErrDependencyCycle)
}

// IsHookError returns true if the error is a hook error.
func IsHookError(err error) bool {
	return errors.Is(err, ErrHookFailed)
}
