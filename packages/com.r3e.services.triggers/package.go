// Package triggers provides the Triggers Service as a ServicePackage.
package triggers

import (
	"context"

	"github.com/R3E-Network/service_layer/applications/storage"
	"github.com/R3E-Network/service_layer/pkg/logger"
	engine "github.com/R3E-Network/service_layer/system/core"
	pkg "github.com/R3E-Network/service_layer/system/runtime"
)

// Package implements the ServicePackage interface.
type Package struct{}

func init() {
	pkg.MustRegisterPackage("com.r3e.services.triggers", func() (pkg.ServicePackage, error) {
		return &Package{}, nil
	})
}

func (p *Package) Manifest() pkg.PackageManifest {
	return pkg.PackageManifest{
		PackageID:   "com.r3e.services.triggers",
		Version:     "1.0.0",
		DisplayName: "Triggers Service",
		Description: "Event-driven trigger management",
		Author:      "R3E Network",
		License:     "MIT",

		Services: []pkg.ServiceDeclaration{
			{
				Name:         "triggers",
				Domain:       "triggers",
				Description:  "Event-driven trigger management",
				Capabilities: []string{"triggers.create", "triggers.fire"},
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
			MaxStorageBytes:       150 * 1024 * 1024,
			MaxConcurrentRequests: 1000,
			MaxRequestsPerSecond:  8000,
			MaxEventsPerSecond:    3000,
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
	store, _ := sp.TriggerStore().(storage.TriggerStore)
	accounts, _ := sp.AccountStore().(storage.AccountStore)
	functions, _ := sp.FunctionStore().(storage.FunctionStore)

	log := logger.NewDefault("triggers")
	if loggerFromRuntime := runtime.Logger(); loggerFromRuntime != nil {
		if l, ok := loggerFromRuntime.(*logger.Logger); ok {
			log = l
		}
	}

	svc := New(accounts, functions, store, log)
	return []engine.ServiceModule{svc}, nil
}

func (p *Package) OnInstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("triggers package installed")
		}
	}
	return nil
}

func (p *Package) OnUninstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("triggers package uninstalled")
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
				Info("triggers package upgraded")
		}
	}
	return nil
}
