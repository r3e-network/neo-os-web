// Package confidential provides the Confidential Service as a ServicePackage.
package confidential

import (
	"context"

	"github.com/R3E-Network/service_layer/pkg/storage"
	"github.com/R3E-Network/service_layer/pkg/logger"
	engine "github.com/R3E-Network/service_layer/system/core"
	pkg "github.com/R3E-Network/service_layer/system/runtime"
)

// Package implements the ServicePackage interface.
type Package struct{}

func init() {
	pkg.MustRegisterPackage("com.r3e.services.confidential", func() (pkg.ServicePackage, error) {
		return &Package{}, nil
	})
}

func (p *Package) Manifest() pkg.PackageManifest {
	return pkg.PackageManifest{
		PackageID:   "com.r3e.services.confidential",
		Version:     "1.0.0",
		DisplayName: "Confidential Service",
		Description: "Confidential computing and privacy",
		Author:      "R3E Network",
		License:     "MIT",

		Services: []pkg.ServiceDeclaration{
			{
				Name:         "confidential",
				Domain:       "confidential",
				Description:  "Confidential computing and privacy",
				Capabilities: []string{"confidential.encrypt", "confidential.decrypt"},
				Layer:        "service",
			},
		},

		Permissions: []pkg.Permission{
			{
				Name:        "engine.api.storage",
				Description: "Required for data persistence",
				Required:    true,
			},
			{
				Name:        "engine.api.bus",
				Description: "Required for event publishing",
				Required:    false,
			},
		},

		Resources: pkg.ResourceQuotas{
			MaxStorageBytes:       50 * 1024 * 1024,
			MaxConcurrentRequests: 1000,
			MaxRequestsPerSecond:  3000,
			MaxEventsPerSecond:    500,
		},

		Dependencies: []pkg.Dependency{
			{
				EngineModule: "store",
				Required:     true,
			},
		},
	}
}

func (p *Package) CreateServices(ctx context.Context, runtime pkg.PackageRuntime) ([]engine.ServiceModule, error) {
	_ = ctx

	// Get typed stores from StoreProvider (Android ContentResolver pattern)
	// Type assertion required since runtime interfaces are empty to avoid import cycles
	sp := runtime.StoreProvider()
	store, _ := sp.ConfidentialStore().(storage.ConfidentialStore)
	accounts, _ := sp.AccountStore().(storage.AccountStore)

	log := logger.NewDefault("confidential")
	if loggerFromRuntime := runtime.Logger(); loggerFromRuntime != nil {
		if l, ok := loggerFromRuntime.(*logger.Logger); ok {
			log = l
		}
	}

	svc := New(accounts, store, log)
	return []engine.ServiceModule{svc}, nil
}

func (p *Package) OnInstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("confidential package installed")
		}
	}
	return nil
}

func (p *Package) OnUninstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("confidential package uninstalled")
		}
	}
	return nil
}

func (p *Package) OnUpgrade(ctx context.Context, runtime pkg.PackageRuntime, oldVersion string) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.WithField("old_version", oldVersion).
				WithField("new_version", p.Manifest().Version).
				Info("confidential package upgraded")
		}
	}
	return nil
}
