// Package framework provides the ServiceContext interface and implementation.
// ServiceContext is inspired by Android's Context class, providing unified access
// to system resources, services, and permissions for all service packages.
package framework

import (
	"context"
	"sync"
	"time"
)

// SystemService represents a type of system service that can be retrieved via GetSystemService.
type SystemService string

const (
	// SystemServiceBus provides access to the event/data/compute bus.
	SystemServiceBus SystemService = "bus"
	// SystemServiceRegistry provides access to the service registry.
	SystemServiceRegistry SystemService = "registry"
	// SystemServiceLifecycle provides access to lifecycle management.
	SystemServiceLifecycle SystemService = "lifecycle"
	// SystemServiceHealth provides access to health monitoring.
	SystemServiceHealth SystemService = "health"
	// SystemServicePermission provides access to permission management.
	SystemServicePermission SystemService = "permission"
	// SystemServiceConfig provides access to configuration.
	SystemServiceConfig SystemService = "config"
	// SystemServiceLogger provides access to logging.
	SystemServiceLogger SystemService = "logger"
	// SystemServiceMetrics provides access to metrics collection.
	SystemServiceMetrics SystemService = "metrics"
)

// ServiceContext provides a unified interface for services to access system resources.
// It is inspired by Android's Context class and provides:
// - System service access (like Android's getSystemService)
// - Resource access (configuration, secrets)
// - Permission checking
// - Inter-service communication via Bus
// - Lifecycle awareness
type ServiceContext interface {
	// Context returns the underlying Go context for cancellation and deadlines.
	Context() context.Context

	// PackageName returns the service package name (e.g., "com.r3e.services.oracle").
	PackageName() string

	// GetSystemService returns a system service by name.
	// Returns nil if the service is not available.
	GetSystemService(name SystemService) any

	// GetBus returns the BusClient for inter-service communication.
	// Shorthand for GetSystemService(SystemServiceBus).(BusClient).
	GetBus() BusClient

	// CheckPermission checks if the service has the specified permission.
	// Returns PermissionGranted, PermissionDenied, or PermissionUnknown.
	CheckPermission(permission string) PermissionResult

	// CheckSelfPermission checks if this service has the specified permission.
	CheckSelfPermission(permission string) PermissionResult

	// GetString returns a configuration string value by key.
	GetString(key string) string

	// GetInt returns a configuration integer value by key.
	GetInt(key string) int

	// GetBool returns a configuration boolean value by key.
	GetBool(key string) bool

	// GetConfig returns the full configuration map.
	GetConfig() map[string]any

	// StartService sends an intent to start another service.
	// Returns the result and any error.
	StartService(intent *Intent) (*IntentResult, error)

	// SendBroadcast sends a broadcast intent to all registered receivers.
	// Returns multiple errors if multiple receivers fail.
	SendBroadcast(intent *Intent) []error

	// BindService binds to another service and returns a connection.
	BindService(intent *Intent, conn ServiceConnection) error

	// UnbindService unbinds from a previously bound service.
	UnbindService(conn ServiceConnection) error

	// GetApplicationContext returns the application-level context.
	// This context survives individual service restarts.
	GetApplicationContext() ServiceContext

	// RegisterReceiver registers a broadcast receiver for the given intent filter.
	RegisterReceiver(receiver BroadcastReceiver, filter *IntentFilter) error

	// UnregisterReceiver unregisters a previously registered broadcast receiver.
	UnregisterReceiver(receiver BroadcastReceiver) error
}

// PermissionResult represents the result of a permission check.
type PermissionResult int

const (
	// PermissionGranted indicates the permission is granted.
	PermissionGranted PermissionResult = 0
	// PermissionDenied indicates the permission is denied.
	PermissionDenied PermissionResult = -1
	// PermissionUnknown indicates the permission status is unknown.
	PermissionUnknown PermissionResult = -2
)

// String returns a human-readable permission result.
func (p PermissionResult) String() string {
	switch p {
	case PermissionGranted:
		return "granted"
	case PermissionDenied:
		return "denied"
	default:
		return "unknown"
	}
}

// ServiceConnection represents a connection to a bound service.
type ServiceConnection interface {
	// OnServiceConnected is called when the service is connected.
	OnServiceConnected(name string, service any)
	// OnServiceDisconnected is called when the service is disconnected.
	OnServiceDisconnected(name string)
}

// BroadcastReceiver receives broadcast intents.
type BroadcastReceiver interface {
	// OnReceive is called when a broadcast intent is received.
	OnReceive(ctx ServiceContext, intent *Intent)
}

// BaseContext provides a default implementation of ServiceContext.
type BaseContext struct {
	ctx             context.Context
	packageName     string
	systemServices  map[SystemService]any
	config          map[string]any
	permissions     map[string]PermissionResult
	receivers       map[BroadcastReceiver]*IntentFilter
	bindings        map[ServiceConnection]string
	appContext      ServiceContext
	mu              sync.RWMutex
}

// BaseContextConfig contains configuration for creating a BaseContext.
type BaseContextConfig struct {
	Ctx         context.Context
	PackageName string
	Config      map[string]any
	AppContext  ServiceContext
}

// NewBaseContext creates a new BaseContext with the given configuration.
func NewBaseContext(cfg BaseContextConfig) *BaseContext {
	if cfg.Ctx == nil {
		cfg.Ctx = context.Background()
	}
	bc := &BaseContext{
		ctx:            cfg.Ctx,
		packageName:    cfg.PackageName,
		systemServices: make(map[SystemService]any),
		config:         cfg.Config,
		permissions:    make(map[string]PermissionResult),
		receivers:      make(map[BroadcastReceiver]*IntentFilter),
		bindings:       make(map[ServiceConnection]string),
		appContext:     cfg.AppContext,
	}
	if bc.config == nil {
		bc.config = make(map[string]any)
	}
	return bc
}

// Context returns the underlying Go context.
func (c *BaseContext) Context() context.Context {
	return c.ctx
}

// PackageName returns the service package name.
func (c *BaseContext) PackageName() string {
	return c.packageName
}

// GetSystemService returns a system service by name.
func (c *BaseContext) GetSystemService(name SystemService) any {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.systemServices[name]
}

// SetSystemService registers a system service.
func (c *BaseContext) SetSystemService(name SystemService, service any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.systemServices[name] = service
}

// GetBus returns the BusClient for inter-service communication.
func (c *BaseContext) GetBus() BusClient {
	svc := c.GetSystemService(SystemServiceBus)
	if bus, ok := svc.(BusClient); ok {
		return bus
	}
	return nil
}

// CheckPermission checks if the service has the specified permission.
func (c *BaseContext) CheckPermission(permission string) PermissionResult {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if result, ok := c.permissions[permission]; ok {
		return result
	}
	return PermissionUnknown
}

// CheckSelfPermission checks if this service has the specified permission.
func (c *BaseContext) CheckSelfPermission(permission string) PermissionResult {
	return c.CheckPermission(permission)
}

// GrantPermission grants a permission to this context.
func (c *BaseContext) GrantPermission(permission string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.permissions[permission] = PermissionGranted
}

// DenyPermission denies a permission to this context.
func (c *BaseContext) DenyPermission(permission string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.permissions[permission] = PermissionDenied
}

// GetString returns a configuration string value by key.
func (c *BaseContext) GetString(key string) string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if v, ok := c.config[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// GetInt returns a configuration integer value by key.
func (c *BaseContext) GetInt(key string) int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if v, ok := c.config[key]; ok {
		switch i := v.(type) {
		case int:
			return i
		case int64:
			return int(i)
		case float64:
			return int(i)
		}
	}
	return 0
}

// GetBool returns a configuration boolean value by key.
func (c *BaseContext) GetBool(key string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if v, ok := c.config[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

// GetConfig returns the full configuration map.
func (c *BaseContext) GetConfig() map[string]any {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make(map[string]any, len(c.config))
	for k, v := range c.config {
		result[k] = v
	}
	return result
}

// SetConfig sets a configuration value.
func (c *BaseContext) SetConfig(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.config[key] = value
}

// StartService sends an intent to start another service.
func (c *BaseContext) StartService(intent *Intent) (*IntentResult, error) {
	// Implementation depends on the service registry
	// This is a placeholder that can be overridden
	return &IntentResult{ResultCode: ResultOK}, nil
}

// SendBroadcast sends a broadcast intent to all registered receivers.
func (c *BaseContext) SendBroadcast(intent *Intent) []error {
	bus := c.GetBus()
	if bus == nil {
		return []error{ErrNoBusAvailable}
	}
	err := bus.PublishEvent(c.ctx, intent.Action, intent.Extras)
	if err != nil {
		return []error{err}
	}
	return nil
}

// BindService binds to another service and returns a connection.
func (c *BaseContext) BindService(intent *Intent, conn ServiceConnection) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.bindings[conn] = intent.Component
	return nil
}

// UnbindService unbinds from a previously bound service.
func (c *BaseContext) UnbindService(conn ServiceConnection) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.bindings, conn)
	return nil
}

// GetApplicationContext returns the application-level context.
func (c *BaseContext) GetApplicationContext() ServiceContext {
	if c.appContext != nil {
		return c.appContext
	}
	return c
}

// RegisterReceiver registers a broadcast receiver for the given intent filter.
func (c *BaseContext) RegisterReceiver(receiver BroadcastReceiver, filter *IntentFilter) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.receivers[receiver] = filter
	return nil
}

// UnregisterReceiver unregisters a previously registered broadcast receiver.
func (c *BaseContext) UnregisterReceiver(receiver BroadcastReceiver) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.receivers, receiver)
	return nil
}

// WithContext returns a new BaseContext with the given Go context.
func (c *BaseContext) WithContext(ctx context.Context) *BaseContext {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return &BaseContext{
		ctx:            ctx,
		packageName:    c.packageName,
		systemServices: c.systemServices,
		config:         c.config,
		permissions:    c.permissions,
		receivers:      c.receivers,
		bindings:       c.bindings,
		appContext:     c.appContext,
	}
}

// WithTimeout returns a new BaseContext with a timeout.
func (c *BaseContext) WithTimeout(timeout time.Duration) (*BaseContext, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(c.ctx, timeout)
	return c.WithContext(ctx), cancel
}

// WithCancel returns a new BaseContext with cancellation.
func (c *BaseContext) WithCancel() (*BaseContext, context.CancelFunc) {
	ctx, cancel := context.WithCancel(c.ctx)
	return c.WithContext(ctx), cancel
}

// Errors
var (
	ErrNoBusAvailable = &ContextError{Op: "SendBroadcast", Err: "no bus available"}
)

// ContextError represents an error in context operations.
type ContextError struct {
	Op  string
	Err string
}

func (e *ContextError) Error() string {
	return "context: " + e.Op + ": " + e.Err
}

// Compile-time interface checks
var (
	_ ServiceContext = (*BaseContext)(nil)
)
