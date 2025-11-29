// Package datafeeds provides the Data Feeds Service as a ServicePackage.
package datafeeds

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
	pkg.MustRegisterPackage("com.r3e.services.datafeeds", func() (pkg.ServicePackage, error) {
		return &Package{}, nil
	})
}

func (p *Package) Manifest() pkg.PackageManifest {
	return pkg.PackageManifest{
		PackageID:   "com.r3e.services.datafeeds",
		Version:     "1.0.0",
		DisplayName: "Data Feeds Service",
		Description: "Generic data feed subscriptions",
		Author:      "R3E Network",
		License:     "MIT",

		Services: []pkg.ServiceDeclaration{
			{
				Name:         "datafeeds",
				Domain:       "datafeeds",
				Description:  "Generic data feed subscriptions",
				Capabilities: []string{"feed.subscribe", "feed.publish"},
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
			MaxStorageBytes:       200 * 1024 * 1024,
			MaxConcurrentRequests: 1000,
			MaxRequestsPerSecond:  10000,
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
	store, _ := sp.DataFeedStore().(storage.DataFeedStore)
	accounts, _ := sp.AccountStore().(storage.AccountStore)

	log := logger.NewDefault("datafeeds")
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
			l.Info("datafeeds package installed")
		}
	}
	return nil
}

func (p *Package) OnUninstall(ctx context.Context, runtime pkg.PackageRuntime) error {
	_ = ctx
	if log := runtime.Logger(); log != nil {
		if l, ok := log.(*logger.Logger); ok {
			l.Info("datafeeds package uninstalled")
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
				Info("datafeeds package upgraded")
		}
	}
	return nil
}
