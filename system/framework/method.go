// Package framework provides service method declarations and invocation standards.
// This file defines the ServiceMethod interface and related types for declaring
// service methods with explicit initialization, invocation, and callback semantics.
package framework

import (
	"context"
	"fmt"
	"strings"
)

// MethodType defines the type of service method.
type MethodType string

const (
	// MethodTypeInit is called once when the service is deployed/initialized.
	// Init methods set up service state and cannot be called by external requests.
	MethodTypeInit MethodType = "init"

	// MethodTypeInvoke is a standard service method that can be called by contract events.
	// These methods process requests and optionally return results.
	MethodTypeInvoke MethodType = "invoke"

	// MethodTypeView is a read-only method that doesn't modify state.
	// View methods can be called without fees and don't trigger callbacks.
	MethodTypeView MethodType = "view"

	// MethodTypeAdmin is an administrative method requiring elevated permissions.
	MethodTypeAdmin MethodType = "admin"
)

// CallbackMode defines how the service engine handles method results.
type CallbackMode string

const (
	// CallbackNone means no callback is sent (void method).
	CallbackNone CallbackMode = "none"

	// CallbackRequired means a callback MUST be sent with the result.
	CallbackRequired CallbackMode = "required"

	// CallbackOptional means a callback is sent only if result is non-nil.
	CallbackOptional CallbackMode = "optional"

	// CallbackOnError means a callback is sent only on error.
	CallbackOnError CallbackMode = "on_error"
)

// MethodParam defines a parameter for a service method.
type MethodParam struct {
	Name        string `json:"name"`                  // Parameter name
	Type        string `json:"type"`                  // Type hint (string, int, bytes, json, etc.)
	Required    bool   `json:"required"`              // Whether the parameter is required
	Description string `json:"description,omitempty"` // Human-readable description
	Default     any    `json:"default,omitempty"`     // Default value if not provided
}

// MethodDeclaration defines a service method with its full specification.
// This is the standard way to declare methods that can be invoked by the engine.
type MethodDeclaration struct {
	// Identity
	Name        string `json:"name"`                  // Method name (e.g., "fetch", "generate")
	Description string `json:"description,omitempty"` // Human-readable description

	// Method type and behavior
	Type         MethodType   `json:"type"`          // init, invoke, view, admin
	CallbackMode CallbackMode `json:"callback_mode"` // How to handle results

	// Parameters
	Params []MethodParam `json:"params,omitempty"` // Input parameters

	// Callback configuration (for invoke methods)
	DefaultCallbackMethod string `json:"default_callback_method,omitempty"` // Default method to call on callback contract

	// Execution constraints
	MaxExecutionTime int64 `json:"max_execution_time,omitempty"` // Max execution time in milliseconds
	RequiresAuth     bool  `json:"requires_auth,omitempty"`      // Whether authentication is required
	MinFee           int64 `json:"min_fee,omitempty"`            // Minimum fee required

	// Documentation
	Example string `json:"example,omitempty"` // Example usage
}

// Validate checks if the method declaration is valid.
func (m *MethodDeclaration) Validate() error {
	if m.Name == "" {
		return fmt.Errorf("method name is required")
	}
	if m.Type == "" {
		m.Type = MethodTypeInvoke // Default to invoke
	}
	if m.CallbackMode == "" {
		// Set default callback mode based on method type
		switch m.Type {
		case MethodTypeInit, MethodTypeView:
			m.CallbackMode = CallbackNone
		case MethodTypeInvoke:
			m.CallbackMode = CallbackRequired
		case MethodTypeAdmin:
			m.CallbackMode = CallbackOptional
		}
	}
	return nil
}

// IsInit returns true if this is an initialization method.
func (m *MethodDeclaration) IsInit() bool {
	return m.Type == MethodTypeInit
}

// IsInvoke returns true if this is an invokable method.
func (m *MethodDeclaration) IsInvoke() bool {
	return m.Type == MethodTypeInvoke
}

// IsView returns true if this is a view method.
func (m *MethodDeclaration) IsView() bool {
	return m.Type == MethodTypeView
}

// IsAdmin returns true if this is an admin method.
func (m *MethodDeclaration) IsAdmin() bool {
	return m.Type == MethodTypeAdmin
}

// NeedsCallback returns true if this method requires a callback.
func (m *MethodDeclaration) NeedsCallback() bool {
	return m.CallbackMode == CallbackRequired
}

// MayCallback returns true if this method may send a callback.
func (m *MethodDeclaration) MayCallback() bool {
	return m.CallbackMode != CallbackNone
}

// ServiceMethodRegistry holds all method declarations for a service.
type ServiceMethodRegistry struct {
	serviceName string
	methods     map[string]*MethodDeclaration
	initMethod  *MethodDeclaration
}

// NewServiceMethodRegistry creates a new method registry for a service.
func NewServiceMethodRegistry(serviceName string) *ServiceMethodRegistry {
	return &ServiceMethodRegistry{
		serviceName: serviceName,
		methods:     make(map[string]*MethodDeclaration),
	}
}

// RegisterInit registers the initialization method (called once at deployment).
func (r *ServiceMethodRegistry) RegisterInit(method *MethodDeclaration) error {
	if method == nil {
		return fmt.Errorf("method cannot be nil")
	}
	method.Type = MethodTypeInit
	method.CallbackMode = CallbackNone
	if err := method.Validate(); err != nil {
		return err
	}
	r.initMethod = method
	r.methods[method.Name] = method
	return nil
}

// RegisterMethod registers a service method.
func (r *ServiceMethodRegistry) RegisterMethod(method *MethodDeclaration) error {
	if method == nil {
		return fmt.Errorf("method cannot be nil")
	}
	if err := method.Validate(); err != nil {
		return err
	}
	r.methods[method.Name] = method
	return nil
}

// GetMethod returns a method declaration by name.
func (r *ServiceMethodRegistry) GetMethod(name string) (*MethodDeclaration, bool) {
	m, ok := r.methods[strings.ToLower(name)]
	if !ok {
		// Try exact match
		m, ok = r.methods[name]
	}
	return m, ok
}

// GetInitMethod returns the initialization method.
func (r *ServiceMethodRegistry) GetInitMethod() *MethodDeclaration {
	return r.initMethod
}

// ListMethods returns all registered methods.
func (r *ServiceMethodRegistry) ListMethods() []*MethodDeclaration {
	methods := make([]*MethodDeclaration, 0, len(r.methods))
	for _, m := range r.methods {
		methods = append(methods, m)
	}
	return methods
}

// ListInvokeMethods returns only invokable methods.
func (r *ServiceMethodRegistry) ListInvokeMethods() []*MethodDeclaration {
	var methods []*MethodDeclaration
	for _, m := range r.methods {
		if m.IsInvoke() {
			methods = append(methods, m)
		}
	}
	return methods
}

// HasMethod checks if a method exists.
func (r *ServiceMethodRegistry) HasMethod(name string) bool {
	_, ok := r.GetMethod(name)
	return ok
}

// MethodHandler is a function that handles a method invocation.
type MethodHandler func(ctx context.Context, params map[string]any) (any, error)

// InvocableServiceV2 is the enhanced interface for services with explicit method declarations.
// Services implementing this interface can be automatically invoked by the ServiceEngine.
type InvocableServiceV2 interface {
	// ServiceName returns the unique service identifier.
	ServiceName() string

	// MethodRegistry returns the service's method declarations.
	MethodRegistry() *ServiceMethodRegistry

	// Initialize is called once when the service is deployed.
	// This method sets up any required state and is NOT called on subsequent starts.
	Initialize(ctx context.Context, params map[string]any) error

	// Invoke calls a method with the given parameters.
	// Returns the result and whether a callback should be sent.
	Invoke(ctx context.Context, method string, params map[string]any) (result any, err error)
}

// MethodBuilder provides a fluent API for building method declarations.
type MethodBuilder struct {
	method *MethodDeclaration
}

// NewMethod creates a new method builder.
func NewMethod(name string) *MethodBuilder {
	return &MethodBuilder{
		method: &MethodDeclaration{
			Name:         name,
			Type:         MethodTypeInvoke,
			CallbackMode: CallbackRequired,
			Params:       make([]MethodParam, 0),
		},
	}
}

// WithDescription sets the method description.
func (b *MethodBuilder) WithDescription(desc string) *MethodBuilder {
	b.method.Description = desc
	return b
}

// AsInit marks this as an initialization method.
func (b *MethodBuilder) AsInit() *MethodBuilder {
	b.method.Type = MethodTypeInit
	b.method.CallbackMode = CallbackNone
	return b
}

// AsView marks this as a view method.
func (b *MethodBuilder) AsView() *MethodBuilder {
	b.method.Type = MethodTypeView
	b.method.CallbackMode = CallbackNone
	return b
}

// AsAdmin marks this as an admin method.
func (b *MethodBuilder) AsAdmin() *MethodBuilder {
	b.method.Type = MethodTypeAdmin
	b.method.CallbackMode = CallbackOptional
	return b
}

// WithCallback sets the callback mode.
func (b *MethodBuilder) WithCallback(mode CallbackMode) *MethodBuilder {
	b.method.CallbackMode = mode
	return b
}

// NoCallback marks this method as not requiring a callback.
func (b *MethodBuilder) NoCallback() *MethodBuilder {
	b.method.CallbackMode = CallbackNone
	return b
}

// RequiresCallback marks this method as requiring a callback.
func (b *MethodBuilder) RequiresCallback() *MethodBuilder {
	b.method.CallbackMode = CallbackRequired
	return b
}

// OptionalCallback marks this method as optionally sending a callback.
func (b *MethodBuilder) OptionalCallback() *MethodBuilder {
	b.method.CallbackMode = CallbackOptional
	return b
}

// WithDefaultCallbackMethod sets the default callback method name.
func (b *MethodBuilder) WithDefaultCallbackMethod(method string) *MethodBuilder {
	b.method.DefaultCallbackMethod = method
	return b
}

// WithParam adds a required parameter.
func (b *MethodBuilder) WithParam(name, typ, description string) *MethodBuilder {
	b.method.Params = append(b.method.Params, MethodParam{
		Name:        name,
		Type:        typ,
		Required:    true,
		Description: description,
	})
	return b
}

// WithOptionalParam adds an optional parameter.
func (b *MethodBuilder) WithOptionalParam(name, typ, description string, defaultVal any) *MethodBuilder {
	b.method.Params = append(b.method.Params, MethodParam{
		Name:        name,
		Type:        typ,
		Required:    false,
		Description: description,
		Default:     defaultVal,
	})
	return b
}

// WithMaxExecutionTime sets the maximum execution time.
func (b *MethodBuilder) WithMaxExecutionTime(ms int64) *MethodBuilder {
	b.method.MaxExecutionTime = ms
	return b
}

// WithMinFee sets the minimum fee required.
func (b *MethodBuilder) WithMinFee(fee int64) *MethodBuilder {
	b.method.MinFee = fee
	return b
}

// RequiresAuth marks this method as requiring authentication.
func (b *MethodBuilder) RequiresAuth() *MethodBuilder {
	b.method.RequiresAuth = true
	return b
}

// WithExample sets an example usage.
func (b *MethodBuilder) WithExample(example string) *MethodBuilder {
	b.method.Example = example
	return b
}

// Build returns the completed method declaration.
func (b *MethodBuilder) Build() *MethodDeclaration {
	_ = b.method.Validate()
	return b.method
}

// MethodRegistryBuilder provides a fluent API for building service method registries.
type MethodRegistryBuilder struct {
	registry *ServiceMethodRegistry
}

// NewMethodRegistryBuilder creates a new method registry builder.
func NewMethodRegistryBuilder(serviceName string) *MethodRegistryBuilder {
	return &MethodRegistryBuilder{
		registry: NewServiceMethodRegistry(serviceName),
	}
}

// WithInit registers an initialization method.
func (b *MethodRegistryBuilder) WithInit(method *MethodDeclaration) *MethodRegistryBuilder {
	_ = b.registry.RegisterInit(method)
	return b
}

// WithMethod registers a service method.
func (b *MethodRegistryBuilder) WithMethod(method *MethodDeclaration) *MethodRegistryBuilder {
	_ = b.registry.RegisterMethod(method)
	return b
}

// Build returns the completed method registry.
func (b *MethodRegistryBuilder) Build() *ServiceMethodRegistry {
	return b.registry
}
