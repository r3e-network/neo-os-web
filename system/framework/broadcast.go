// Package framework provides the SystemBroadcastManager for Android-style system broadcasts.
// SystemBroadcastManager handles system-level broadcasts like BOOT_COMPLETED, SHUTDOWN, etc.
package framework

import (
	"context"
	"sync"
	"time"
)

// SystemBroadcastManager manages system-level broadcasts.
// It is responsible for sending system events to all registered receivers.
type SystemBroadcastManager struct {
	router    *IntentRouter
	appCtx    ServiceContext
	mu        sync.RWMutex
	bootTime  time.Time
	isBooted  bool
	isShutdown bool
}

// NewSystemBroadcastManager creates a new SystemBroadcastManager.
func NewSystemBroadcastManager(router *IntentRouter, appCtx ServiceContext) *SystemBroadcastManager {
	return &SystemBroadcastManager{
		router: router,
		appCtx: appCtx,
	}
}

// OnBootCompleted should be called when the system has finished booting.
// It broadcasts ActionBootCompleted to all registered receivers.
func (m *SystemBroadcastManager) OnBootCompleted() []error {
	m.mu.Lock()
	if m.isBooted {
		m.mu.Unlock()
		return nil // Already booted
	}
	m.isBooted = true
	m.bootTime = time.Now()
	m.mu.Unlock()

	intent := NewIntent(ActionBootCompleted).
		PutExtra("boot_time", m.bootTime).
		AddCategory(CategoryDefault)

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// OnShutdown should be called when the system is shutting down.
// It broadcasts ActionShutdown to all registered receivers.
func (m *SystemBroadcastManager) OnShutdown() []error {
	m.mu.Lock()
	if m.isShutdown {
		m.mu.Unlock()
		return nil // Already shutting down
	}
	m.isShutdown = true
	m.mu.Unlock()

	intent := NewIntent(ActionShutdown).
		PutExtra("shutdown_time", time.Now()).
		AddCategory(CategoryDefault).
		AddFlags(FlagReceiverForeground)

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// OnPackageAdded broadcasts when a new service package is installed.
func (m *SystemBroadcastManager) OnPackageAdded(packageName string, version string) []error {
	intent := NewIntent(ActionPackageAdded).
		SetData("package://" + packageName).
		PutExtra("package_name", packageName).
		PutExtra("version", version).
		PutExtra("install_time", time.Now())

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// OnPackageRemoved broadcasts when a service package is removed.
func (m *SystemBroadcastManager) OnPackageRemoved(packageName string) []error {
	intent := NewIntent(ActionPackageRemoved).
		SetData("package://" + packageName).
		PutExtra("package_name", packageName).
		PutExtra("remove_time", time.Now())

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// OnPackageReplaced broadcasts when a service package is updated.
func (m *SystemBroadcastManager) OnPackageReplaced(packageName string, oldVersion, newVersion string) []error {
	intent := NewIntent(ActionPackageReplaced).
		SetData("package://" + packageName).
		PutExtra("package_name", packageName).
		PutExtra("old_version", oldVersion).
		PutExtra("new_version", newVersion).
		PutExtra("update_time", time.Now())

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// OnConfigurationChanged broadcasts when system configuration changes.
func (m *SystemBroadcastManager) OnConfigurationChanged(changes map[string]any) []error {
	intent := NewIntent(ActionConfigurationChanged).
		PutExtras(changes).
		PutExtra("change_time", time.Now())

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// OnHealthCheck broadcasts a health check request to all services.
func (m *SystemBroadcastManager) OnHealthCheck() []error {
	intent := NewIntent(ActionHealthCheck).
		PutExtra("check_time", time.Now()).
		AddFlags(FlagReceiverForeground)

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// SendCustomBroadcast sends a custom broadcast intent.
func (m *SystemBroadcastManager) SendCustomBroadcast(action string, extras map[string]any) []error {
	intent := NewIntent(action).
		PutExtras(extras).
		PutExtra("broadcast_time", time.Now())

	return m.router.BroadcastIntent(context.Background(), m.appCtx, intent)
}

// IsBooted returns whether the system has completed booting.
func (m *SystemBroadcastManager) IsBooted() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isBooted
}

// BootTime returns when the system finished booting.
func (m *SystemBroadcastManager) BootTime() time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.bootTime
}

// IsShutdown returns whether the system is shutting down.
func (m *SystemBroadcastManager) IsShutdown() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.isShutdown
}

// Uptime returns how long the system has been running since boot.
func (m *SystemBroadcastManager) Uptime() time.Duration {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.bootTime.IsZero() {
		return 0
	}
	return time.Since(m.bootTime)
}
