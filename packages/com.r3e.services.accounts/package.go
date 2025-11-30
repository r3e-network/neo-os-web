// Package accounts provides the Accounts service as a ServicePackage.
// This demonstrates the Android-style package model where services are
// self-contained and can be dynamically loaded.
package accounts

import (
	"context"
	"fmt"

	"github.com/R3E-Network/service_layer/pkg/storage"
	"github.com/R3E-Network/service_layer/pkg/logger"
	engine "github.com/R3E-Network/service_layer/system/core"
	pkg "github.com/R3E-Network/service_layer/system/runtime"
)

// Package implements the ServicePackage interface for the accounts service.
type Package struct{}

func init() {
	// Self-register the package with the global loader
	pkg.MustRegisterPackage("com.r3e.services.accounts", func() (pkg.ServicePackage, error) {
		return &Package{}, nil
	})
}

// Manifest returns the package manifest.
func (p *Package) Manifest() pkg.PackageManifest {
	return pkg.PackageManifest{
		PackageID:   "com.r3e.services.accounts",
		Version:     "1.0.0",
		DisplayName: "Accounts Service",
		Description: "Account registry and metadata management",
		Author:      "R3E Network",
		License:     "MIT",

		Services: []pkg.ServiceDeclaration{
			{
				Name:         "accounts",
				Domain:       "accounts",
				Description:  "Core account management service",
				Capabilities: []string{"accounts.create", "accounts.list", "accounts.get"},
				Layer:        "service",
			},
		},

		Permissions: []pkg.Permission{
			{
				Name:        "engine.api.storage",
				Description: "Required for persisting account data",
				Required:    true,
			},
			{
				Name:        "engine.api.bus",
				Description: "Required for publishing account events",
				Required:    false,
			},
		},

		Resources: pkg.ResourceQuotas{
			MaxStorageBytes:       100 * 1024 * 1024, // 100 MB
			MaxConcurrentRequests: 1000,
			MaxRequestsPerSecond:  5000,
			MaxEventsPerSecond:    1000,
		},

		Dependencies: []pkg.Dependency{
			{
				EngineModule: "store",
				Required:     true,
			},
		},
	}
}

// CreateServices instantiates the services defined in this package.
func (p *Package) CreateServices(ctx context.Context, runtime pkg.PackageRuntime) ([]engine.ServiceModule, error) {
	_ = ctx

	// Get typed store from StoreProvider (Android ContentResolver pattern)
	// Type assertion required since runtime interfaces are empty to avoid import cycles
	storeAny := runtime.StoreProvider().AccountStore()
	store, ok := storeAny.(storage.AccountStore)
	if !ok || store == nil {
		return nil, fmt.Errorf("account store not available or wrong type")
	}

	// Get logger
	log := logger.NewDefault("accounts")
	if loggerFromRuntime := runtime.Logger(); loggerFromRuntime != nil {
		if l, ok := loggerFromRuntime.(*logger.Logger); ok {
			log = l
		}
	}

	// Create the accounts service
	svc := New(store, log)

	return []engine.ServiceModule{svc}, nil
}

// OnInstall is called when the package is first installed.
func (p *Package) OnInstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	_ = runtime

	// Perform any initialization needed at install time
	// For example: create database schemas, set up default data, etc.

	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("accounts package installed")
		}
	}

	return nil
}

// OnUninstall is called when the package is uninstalled.
func (p *Package) OnUninstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	_ = runtime

	// Cleanup resources, but preserve user data

	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("accounts package uninstalled")
		}
	}

	return nil
}

// OnUpgrade is called when upgrading from an older version.
func (p *Package) OnUpgrade(ctx context.Context, runtime pkg.PackageRuntime, oldVersion string) error {
	_ = ctx
	_ = runtime

	// Perform version-specific migration logic

	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.WithField("old_version", oldVersion).
				WithField("new_version", p.Manifest().Version).
				Info("accounts package upgraded")
		}
	}

	return nil
}
