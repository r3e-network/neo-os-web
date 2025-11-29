// Package framework provides the ApplicationContext for Android-style application management.
// ApplicationContext is the global context that survives individual service restarts.
package framework

import (
	"context"
	"sync"
)

// ApplicationContext represents the application-level context.
// It provides access to application-wide resources and services.
// Unlike service-level contexts, ApplicationContext survives service restarts.
type ApplicationContext struct {
	*BaseContext

	// Application name
	appName string

	// Version information
	version     string
	versionCode int

	// System services registry
	router            *IntentRouter
	permissionManager *PermissionManager
	broadcastManager  *SystemBroadcastManager

	// Service contexts
	serviceContexts map[string]*ServiceContextWrapper

	mu sync.RWMutex
}

// ApplicationConfig contains configuration for creating an ApplicationContext.
type ApplicationConfig struct {
	AppName     string
	PackageName string
	Version     string
	VersionCode int
	Config      map[string]any
}

// NewApplicationContext creates a new ApplicationContext.
func NewApplicationContext(cfg ApplicationConfig) *ApplicationContext {
	baseCtx := NewBaseContext(BaseContextConfig{
		Ctx:         context.Background(),
		PackageName: cfg.PackageName,
		Config:      cfg.Config,
	})

	app := &ApplicationContext{
		BaseContext:     baseCtx,
		appName:         cfg.AppName,
		version:         cfg.Version,
		versionCode:     cfg.VersionCode,
		serviceContexts: make(map[string]*ServiceContextWrapper),
	}

	// Initialize system services
	app.permissionManager = NewPermissionManager()
	app.router = NewIntentRouterWithPermissions(app.permissionManager)
	app.broadcastManager = NewSystemBroadcastManager(app.router, app)

	// Register system services
	app.SetSystemService(SystemServicePermission, app.permissionManager)
	app.SetSystemService(SystemServiceRegistry, app.router)

	return app
}

// AppName returns the application name.
func (a *ApplicationContext) AppName() string {
	return a.appName
}

// Version returns the application version string.
func (a *ApplicationContext) Version() string {
	return a.version
}

// VersionCode returns the application version code.
func (a *ApplicationContext) VersionCode() int {
	return a.versionCode
}

// Router returns the intent router.
func (a *ApplicationContext) Router() *IntentRouter {
	return a.router
}

// PermissionManager returns the permission manager.
func (a *ApplicationContext) PermissionManager() *PermissionManager {
	return a.permissionManager
}

// BroadcastManager returns the system broadcast manager.
func (a *ApplicationContext) BroadcastManager() *SystemBroadcastManager {
	return a.broadcastManager
}

// CreateServiceContext creates a new service-level context.
func (a *ApplicationContext) CreateServiceContext(packageName string) *ServiceContextWrapper {
	a.mu.Lock()
	defer a.mu.Unlock()

	svcCtx := &ServiceContextWrapper{
		BaseContext: NewBaseContext(BaseContextConfig{
			Ctx:         context.Background(),
			PackageName: packageName,
			Config:      a.GetConfig(),
			AppContext:  a,
		}),
		app:         a,
		packageName: packageName,
	}

	// Copy system services from app context
	svcCtx.SetSystemService(SystemServiceBus, a.GetSystemService(SystemServiceBus))
	svcCtx.SetSystemService(SystemServicePermission, a.permissionManager)
	svcCtx.SetSystemService(SystemServiceRegistry, a.router)

	a.serviceContexts[packageName] = svcCtx
	return svcCtx
}

// GetServiceContext returns an existing service context.
func (a *ApplicationContext) GetServiceContext(packageName string) *ServiceContextWrapper {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.serviceContexts[packageName]
}

// RemoveServiceContext removes a service context.
func (a *ApplicationContext) RemoveServiceContext(packageName string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.serviceContexts, packageName)
}

// GetAllServiceContexts returns all registered service contexts.
func (a *ApplicationContext) GetAllServiceContexts() map[string]*ServiceContextWrapper {
	a.mu.RLock()
	defer a.mu.RUnlock()
	result := make(map[string]*ServiceContextWrapper, len(a.serviceContexts))
	for k, v := range a.serviceContexts {
		result[k] = v
	}
	return result
}

// RegisterService registers a service with the application.
func (a *ApplicationContext) RegisterService(packageName string, handler IntentHandler, filters ...*IntentFilter) *ServiceContextWrapper {
	// Create service context
	svcCtx := a.CreateServiceContext(packageName)

	// Register component for explicit intents
	a.router.RegisterComponent(packageName, handler)

	// Register receiver for implicit intents
	if len(filters) > 0 {
		a.router.RegisterReceiver(packageName, &serviceReceiverAdapter{handler: handler}, packageName, filters...)
	}

	return svcCtx
}

// UnregisterService unregisters a service from the application.
func (a *ApplicationContext) UnregisterService(packageName string) {
	a.router.UnregisterComponent(packageName)
	a.router.UnregisterReceiver(packageName)
	a.RemoveServiceContext(packageName)
}

// GrantServicePermission grants a permission to a service.
func (a *ApplicationContext) GrantServicePermission(packageName, permission string) error {
	return a.permissionManager.GrantPermission(context.Background(), packageName, permission, "system")
}

// GrantServiceAllPermissions grants all permissions to a service (for system services).
func (a *ApplicationContext) GrantServiceAllPermissions(packageName string) error {
	return a.permissionManager.GrantAllPermissions(context.Background(), packageName, "system")
}

// StartService starts a service with an explicit intent.
func (a *ApplicationContext) StartService(intent *Intent) (*IntentResult, error) {
	return a.router.StartService(context.Background(), intent)
}

// SendBroadcast sends a broadcast intent.
func (a *ApplicationContext) SendBroadcast(intent *Intent) []error {
	return a.router.BroadcastIntent(context.Background(), a, intent)
}

// OnBootCompleted triggers the boot completed broadcast.
func (a *ApplicationContext) OnBootCompleted() []error {
	return a.broadcastManager.OnBootCompleted()
}

// OnShutdown triggers the shutdown broadcast.
func (a *ApplicationContext) OnShutdown() []error {
	return a.broadcastManager.OnShutdown()
}

// ServiceContextWrapper wraps BaseContext with service-specific functionality.
type ServiceContextWrapper struct {
	*BaseContext
	app         *ApplicationContext
	packageName string
}

// GetApplicationContext returns the application context.
func (s *ServiceContextWrapper) GetApplicationContext() ServiceContext {
	return s.app
}

// StartService starts another service.
func (s *ServiceContextWrapper) StartService(intent *Intent) (*IntentResult, error) {
	intent.SourcePackage = s.packageName
	return s.app.router.StartService(s.Context(), intent)
}

// SendBroadcast sends a broadcast intent.
func (s *ServiceContextWrapper) SendBroadcast(intent *Intent) []error {
	intent.SourcePackage = s.packageName
	return s.app.router.BroadcastIntent(s.Context(), s, intent)
}

// RegisterReceiver registers a broadcast receiver.
func (s *ServiceContextWrapper) RegisterReceiver(receiver BroadcastReceiver, filter *IntentFilter) error {
	s.app.router.RegisterReceiver(s.packageName+"-receiver", receiver, s.packageName, filter)
	return nil
}

// UnregisterReceiver unregisters a broadcast receiver.
func (s *ServiceContextWrapper) UnregisterReceiver(receiver BroadcastReceiver) error {
	s.app.router.UnregisterReceiver(s.packageName + "-receiver")
	return nil
}

// CheckPermission checks if this service has a permission.
func (s *ServiceContextWrapper) CheckPermission(permission string) PermissionResult {
	return s.app.permissionManager.CheckPermission(s.Context(), s.packageName, permission)
}

// CheckSelfPermission is an alias for CheckPermission.
func (s *ServiceContextWrapper) CheckSelfPermission(permission string) PermissionResult {
	return s.CheckPermission(permission)
}

// serviceReceiverAdapter adapts an IntentHandler to a BroadcastReceiver.
type serviceReceiverAdapter struct {
	handler IntentHandler
}

func (a *serviceReceiverAdapter) OnReceive(ctx ServiceContext, intent *Intent) {
	a.handler.HandleIntent(ctx.Context(), intent)
}

// Compile-time interface checks
var (
	_ ServiceContext    = (*ApplicationContext)(nil)
	_ ServiceContext    = (*ServiceContextWrapper)(nil)
	_ BroadcastReceiver = (*serviceReceiverAdapter)(nil)
)
