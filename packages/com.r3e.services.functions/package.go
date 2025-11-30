// Package functions provides the Functions service as a ServicePackage.
package functions

import (
	"context"

	"github.com/R3E-Network/service_layer/pkg/storage"
	"github.com/R3E-Network/service_layer/pkg/logger"
	engine "github.com/R3E-Network/service_layer/system/core"
	pkg "github.com/R3E-Network/service_layer/system/runtime"
)

// Package implements the ServicePackage interface for the functions service.
type Package struct{}

func init() {
	// Self-register the package with the global loader
	pkg.MustRegisterPackage("com.r3e.services.functions", func() (pkg.ServicePackage, error) {
		return &Package{}, nil
	})
}

// Manifest returns the package manifest.
func (p *Package) Manifest() pkg.PackageManifest {
	return pkg.PackageManifest{
		PackageID:   "com.r3e.services.functions",
		Version:     "1.0.0",
		DisplayName: "Functions Service",
		Description: "Serverless function execution service",
		Author:      "R3E Network",
		License:     "MIT",

		Services: []pkg.ServiceDeclaration{
			{
				Name:         "functions",
				Domain:       "functions",
				Description:  "Serverless function management and execution",
				Capabilities: []string{"functions.create", "functions.invoke", "functions.list"},
				Layer:        "service",
			},
		},

		Permissions: []pkg.Permission{
			{
				Name:        "engine.api.storage",
				Description: "Required for storing function definitions",
				Required:    true,
			},
			{
				Name:        "engine.api.bus",
				Description: "Required for function invocation events",
				Required:    false,
			},
			{
				Name:        "engine.api.ledger",
				Description: "Required for on-chain function registration",
				Required:    false,
			},
		},

		Resources: pkg.ResourceQuotas{
			MaxStorageBytes:       500 * 1024 * 1024, // 500 MB for function code
			MaxConcurrentRequests: 5000,
			MaxRequestsPerSecond:  10000,
			MaxEventsPerSecond:    2000,
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

	// Get typed stores from StoreProvider (Android ContentResolver pattern)
	// Type assertion required since runtime interfaces are empty to avoid import cycles
	sp := runtime.StoreProvider()
	store, _ := sp.FunctionStore().(storage.FunctionStore)
	accounts, _ := sp.AccountStore().(storage.AccountStore)

	log := logger.NewDefault("functions")
	if loggerFromRuntime := runtime.Logger(); loggerFromRuntime != nil {
		if l, ok := loggerFromRuntime.(*logger.Logger); ok {
			log = l
		}
	}

	svc := New(accounts, store, log)
	return []engine.ServiceModule{svc}, nil
}

// OnInstall is called when the package is first installed.
func (p *Package) OnInstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("functions package installed")
		}
	}
	return nil
}

// OnUninstall is called when the package is uninstalled.
func (p *Package) OnUninstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("functions package uninstalled")
		}
	}
	return nil
}

// OnUpgrade is called when upgrading from an older version.
func (p *Package) OnUpgrade(ctx context.Context, runtime pkg.PackageRuntime, oldVersion string) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.WithField("old_version", oldVersion).
				WithField("new_version", p.Manifest().Version).
				Info("functions package upgraded")
		}
	}
	return nil
}
