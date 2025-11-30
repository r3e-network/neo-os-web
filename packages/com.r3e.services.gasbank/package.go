// Package gasbank provides the Gas Bank Service as a ServicePackage.
// This package is self-contained with its own:
// - Domain types (domain.go)
// - Store interface and implementation (store.go, store_postgres.go)
// - Service logic (service.go)
// - HTTP handlers (http.go)
package gasbank

import (
	"context"
	"net/http"

	engine "github.com/R3E-Network/service_layer/system/core"
	pkg "github.com/R3E-Network/service_layer/system/runtime"
)

// Package implements the ServicePackage interface using PackageTemplate.
type Package struct {
	pkg.PackageTemplate
	httpHandler *HTTPHandler
}

func init() {
	pkg.MustRegisterPackage("com.r3e.services.gasbank", func() (pkg.ServicePackage, error) {
		return &Package{
			PackageTemplate: pkg.NewPackageTemplate(pkg.PackageTemplateConfig{
				PackageID:    "com.r3e.services.gasbank",
				DisplayName:  "Gas Bank Service",
				Description:  "Gas fee management and sponsorship",
				ServiceName:  "gasbank",
				Capabilities: []string{"gasbank.deposit", "gasbank.withdraw"},
			}),
		}, nil
	})
}

func (p *Package) CreateServices(ctx context.Context, runtime pkg.PackageRuntime) ([]engine.ServiceModule, error) {
	_ = ctx

	db, err := pkg.GetDatabase(runtime)
	if err != nil {
		return nil, err
	}

	accounts := pkg.NewAccountChecker(runtime)
	store := NewPostgresStore(db, accounts)
	log := pkg.GetLogger(runtime, "gasbank")

	svc := New(accounts, store, log)

	// Create HTTP handler for this service
	p.httpHandler = NewHTTPHandler(svc)

	return []engine.ServiceModule{svc}, nil
}

// RegisterRoutes implements the RouteRegistrar interface.
func (p *Package) RegisterRoutes(mux *http.ServeMux, basePath string) {
	// Routes are registered via Handle method called from application layer
	_ = mux
	_ = basePath
}

// HTTPHandler returns the HTTP handler for external registration.
func (p *Package) HTTPHandler() *HTTPHandler {
	return p.httpHandler
}
