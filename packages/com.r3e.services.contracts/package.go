// Package contracts provides the Contracts Service as a ServicePackage.
// This package is self-contained with its own:
// - Domain types (domain.go)
// - Store interface (store.go)
// - Service logic (service.go)
// - Contract templates (templates.go)
//
// The service manages smart contract deployments, invocations, and lifecycle
// management across multiple blockchain networks.
package contracts

import (
	"context"

	engine "github.com/R3E-Network/service_layer/system/core"
	pkg "github.com/R3E-Network/service_layer/system/runtime"
)

// Package implements the ServicePackage interface using PackageTemplate.
type Package struct {
	pkg.PackageTemplate
}

func init() {
	pkg.MustRegisterPackage("com.r3e.services.contracts", func() (pkg.ServicePackage, error) {
		return &Package{
			PackageTemplate: pkg.NewPackageTemplate(pkg.PackageTemplateConfig{
				PackageID:    "com.r3e.services.contracts",
				DisplayName:  "Contracts Service",
				Description:  "Smart contract deployment and invocation management",
				ServiceName:  "contracts",
				Capabilities: []string{"contracts.deploy", "contracts.invoke", "contracts.manage"},
			}),
		}, nil
	})
}

func (p *Package) CreateServices(ctx context.Context, runtime pkg.PackageRuntime) ([]engine.ServiceModule, error) {
	_ = ctx

	accounts := pkg.NewAccountChecker(runtime)
	log := pkg.GetLogger(runtime, "contracts")

	// Note: Contracts service requires external deployer/invoker injection
	// which is handled by the application layer during wiring.
	svc := New(accounts, nil, log)

	return []engine.ServiceModule{svc}, nil
}
