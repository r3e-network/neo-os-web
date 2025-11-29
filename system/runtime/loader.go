package pkg

import (
	"context"
	"fmt"
	"sync"
	"time"

	engine "github.com/R3E-Network/service_layer/system/core"
)

// loader is the default implementation of PackageLoader.
type loader struct {
	mu            sync.RWMutex
	installed     map[string]*installedPackageRecord
	factories     map[string]PackageFactory // for dynamic loading
	storeProvider StoreProvider             // shared store provider for all packages
}

// PackageFactory creates a ServicePackage instance.
type PackageFactory func() (ServicePackage, error)

// installedPackageRecord tracks an installed package.
type installedPackageRecord struct {
	Package     ServicePackage
	Manifest    PackageManifest
	InstalledAt time.Time
	Enabled     bool
	Services    []string // service names registered by this package
	Runtime     PackageRuntime
}

// NewPackageLoader creates a new package loader.
func NewPackageLoader() PackageLoader {
	return &loader{
		installed:     make(map[string]*installedPackageRecord),
		factories:     make(map[string]PackageFactory),
		storeProvider: NilStoreProvider(),
	}
}

// NewPackageLoaderWithStores creates a new package loader with store provider.
func NewPackageLoaderWithStores(stores StoreProvider) PackageLoader {
	return &loader{
		installed:     make(map[string]*installedPackageRecord),
		factories:     make(map[string]PackageFactory),
		storeProvider: stores,
	}
}

// SetStoreProvider sets the store provider for the loader.
// This should be called before installing packages.
func (l *loader) SetStoreProvider(stores StoreProvider) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.storeProvider = stores
}

// RegisterFactory registers a package factory for dynamic loading.
// This allows packages to self-register during init().
func (l *loader) RegisterFactory(packageID string, factory PackageFactory) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if _, exists := l.factories[packageID]; exists {
		return fmt.Errorf("package factory already registered: %s", packageID)
	}

	l.factories[packageID] = factory
	return nil
}

func (l *loader) LoadPackage(ctx context.Context, source string) (ServicePackage, error) {
	_ = ctx

	// Try loading from registered factories first
	l.mu.RLock()
	factory, exists := l.factories[source]
	l.mu.RUnlock()

	if exists {
		return factory()
	}

	// TODO: Support loading from file system, network, etc.
	return nil, fmt.Errorf("package not found: %s", source)
}

func (l *loader) InstallPackage(ctx context.Context, pkg ServicePackage, eng *engine.Engine) error {
	manifest := pkg.Manifest()

	// Validate manifest
	if err := manifest.Validate(); err != nil {
		return fmt.Errorf("invalid manifest: %w", err)
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	// Check if already installed
	if existing, exists := l.installed[manifest.PackageID]; exists {
		// Handle upgrade
		if existing.Manifest.Version != manifest.Version {
			if err := pkg.OnUpgrade(ctx, existing.Runtime, existing.Manifest.Version); err != nil {
				return fmt.Errorf("upgrade failed: %w", err)
			}
		} else {
			return fmt.Errorf("package already installed: %s@%s", manifest.PackageID, manifest.Version)
		}
	}

	// Grant permissions
	permissions := l.evaluatePermissions(manifest)

	// Check for missing required permissions
	missing := manifest.CheckPermissions(permissions)
	if len(missing) > 0 {
		return fmt.Errorf("missing required permissions: %v", missing)
	}

	// Create package runtime
	config := NewPackageConfig(nil) // TODO: Load from config file
	runtime := NewPackageRuntime(manifest.PackageID, manifest, eng, config, permissions, l.storeProvider)

	// Call OnInstall hook
	if err := pkg.OnInstall(ctx, runtime); err != nil {
		return fmt.Errorf("install hook failed: %w", err)
	}

	// Create services
	services, err := pkg.CreateServices(ctx, runtime)
	if err != nil {
		return fmt.Errorf("create services failed: %w", err)
	}

	// Register services with engine
	var serviceNames []string
	for _, svc := range services {
		if err := eng.Register(svc); err != nil {
			// Rollback: unregister already registered services
			for _, name := range serviceNames {
				_ = eng.Unregister(name)
			}
			return fmt.Errorf("register service %s: %w", svc.Name(), err)
		}
		serviceNames = append(serviceNames, svc.Name())
	}

	// Record installation
	l.installed[manifest.PackageID] = &installedPackageRecord{
		Package:     pkg,
		Manifest:    manifest,
		InstalledAt: time.Now(),
		Enabled:     true,
		Services:    serviceNames,
		Runtime:     runtime,
	}

	return nil
}

func (l *loader) UninstallPackage(ctx context.Context, packageID string, eng *engine.Engine) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	record, exists := l.installed[packageID]
	if !exists {
		return fmt.Errorf("package not installed: %s", packageID)
	}

	// Call OnUninstall hook
	if err := record.Package.OnUninstall(ctx, record.Runtime); err != nil {
		return fmt.Errorf("uninstall hook failed: %w", err)
	}

	// Unregister services from engine
	for _, svcName := range record.Services {
		if err := eng.Unregister(svcName); err != nil {
			// Log but continue
			if log := eng.Logger(); log != nil {
				log.Printf("warning: failed to unregister service %s: %v", svcName, err)
			}
		}
	}

	// Remove from installed packages
	delete(l.installed, packageID)

	return nil
}

func (l *loader) ListInstalled() []InstalledPackage {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var result []InstalledPackage
	for _, record := range l.installed {
		result = append(result, InstalledPackage{
			Manifest:    record.Manifest,
			InstalledAt: record.InstalledAt.Format(time.RFC3339),
			Enabled:     record.Enabled,
			Services:    record.Services,
		})
	}

	return result
}

// evaluatePermissions determines which permissions to grant based on the manifest.
// In a production system, this would involve policy evaluation, user consent, etc.
func (l *loader) evaluatePermissions(manifest PackageManifest) map[string]bool {
	granted := make(map[string]bool)

	// For now, auto-grant all requested permissions
	// TODO: Implement proper permission evaluation:
	// - Check security policies
	// - Request user/admin consent for sensitive permissions
	// - Apply principle of least privilege
	for _, perm := range manifest.Permissions {
		granted[perm.Name] = true
	}

	// Always grant basic permissions
	granted["engine.api.logging"] = true

	return granted
}

// =============================================================================
// Global Package Registry (for self-registration)
// =============================================================================

var (
	globalLoader     PackageLoader
	globalLoaderOnce sync.Once
)

// GlobalLoader returns the global package loader instance.
func GlobalLoader() PackageLoader {
	globalLoaderOnce.Do(func() {
		globalLoader = NewPackageLoader()
	})
	return globalLoader
}

// RegisterPackage registers a package factory with the global loader.
// This is intended to be called from init() functions.
func RegisterPackage(packageID string, factory PackageFactory) error {
	if l, ok := GlobalLoader().(*loader); ok {
		return l.RegisterFactory(packageID, factory)
	}
	return fmt.Errorf("global loader does not support factory registration")
}

// MustRegisterPackage is like RegisterPackage but panics on error.
func MustRegisterPackage(packageID string, factory PackageFactory) {
	if err := RegisterPackage(packageID, factory); err != nil {
		panic(fmt.Sprintf("failed to register package %s: %v", packageID, err))
	}
}

// SetGlobalStoreProvider sets the store provider for the global loader.
// This should be called before installing any packages.
func SetGlobalStoreProvider(stores StoreProvider) {
	if l, ok := GlobalLoader().(*loader); ok {
		l.SetStoreProvider(stores)
	}
}
