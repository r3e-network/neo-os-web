package services

import (
	"context"
	"testing"

	app "github.com/R3E-Network/service_layer/internal/app"
)

func TestAllServicesImplementLifecycle(t *testing.T) {
	a, err := app.New(app.NewMemoryStoresForTest(), nil)
	if err != nil {
		t.Fatalf("new app: %v", err)
	}

	// Primary domain services.
	for _, svc := range []any{
		a.Accounts,
		a.Functions,
		a.Triggers,
		a.GasBank,
		a.Automation,
		a.PriceFeeds,
		a.DataFeeds,
		a.DataStreams,
		a.DataLink,
		a.DTA,
		a.Confidential,
		a.Oracle,
		a.Secrets,
		a.Random,
		a.CRE,
		a.CCIP,
		a.VRF,
	} {
		assertLifecycle(t, svc)
	}

	// Runners/background components.
	for _, svc := range []any{
		a.AutomationRunner,
		a.PriceFeedRunner,
		a.OracleRunner,
		a.GasBankSettlement,
	} {
		if svc == nil {
			continue
		}
		assertLifecycle(t, svc)
	}
}

func assertLifecycle(t *testing.T, svc any) {
	t.Helper()
	if svc == nil {
		t.Fatalf("service is nil")
	}
	if _, ok := svc.(interface {
		Name() string
		Start(context.Context) error
		Stop(context.Context) error
		Ready(context.Context) error
	}); !ok {
		t.Fatalf("%T does not implement lifecycle interface", svc)
	}
}
