// Package smoke provides smoke tests for quick verification of service health.
// Smoke tests are designed to quickly verify that services can start and respond
// to basic health checks without requiring external dependencies.
package smoke

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	neoaccounts "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/marble"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	neoflow "github.com/R3E-Network/neo-miniapps-platform/services/automation/marble"
	neocompute "github.com/R3E-Network/neo-miniapps-platform/services/confcompute/marble"
	neooracle "github.com/R3E-Network/neo-miniapps-platform/services/conforacle/marble"
	neofeeds "github.com/R3E-Network/neo-miniapps-platform/services/datafeed/marble"
	neogasbank "github.com/R3E-Network/neo-miniapps-platform/services/gasbank/marble"
	txproxy "github.com/R3E-Network/neo-miniapps-platform/services/txproxy/marble"
)

// TestNeoAccountsSmoke performs basic smoke tests on the NeoAccounts service.
func TestNeoAccountsSmoke(t *testing.T) {
	t.Run("service creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "neoaccounts"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}
		m.SetTestSecret("POOL_MASTER_KEY", []byte("smoke-test-pool-key-32-bytes!!!!"))

		svc, err := neoaccounts.New(neoaccounts.Config{Marble: m})
		if err != nil {
			t.Fatalf("neoaccounts.New: %v", err)
		}
		if svc == nil {
			t.Fatal("service should not be nil")
		}
	})

	t.Run("health endpoint responds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
		m.SetTestSecret("POOL_MASTER_KEY", []byte("smoke-test-pool-key-32-bytes!!!!"))
		svc, _ := neoaccounts.New(neoaccounts.Config{Marble: m})

		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("info endpoint responds", func(t *testing.T) {
		t.Skip("requires database connection")
	})

	t.Run("service metadata correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
		m.SetTestSecret("POOL_MASTER_KEY", []byte("smoke-test-pool-key-32-bytes!!!!"))
		svc, _ := neoaccounts.New(neoaccounts.Config{Marble: m})

		if svc.ID() != "neoaccounts" {
			t.Errorf("expected ID 'neoaccounts', got '%s'", svc.ID())
		}
		if svc.Name() != "Account Pool Service" {
			t.Errorf("expected name 'Account Pool Service', got '%s'", svc.Name())
		}
	})
}

// TestNeoComputeSmoke performs basic smoke tests on the NeoCompute service.
func TestNeoComputeSmoke(t *testing.T) {
	t.Run("service creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "neocompute"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}
		m.SetTestSecret("COMPUTE_MASTER_KEY", []byte("smoke-test-compute-master-key-32b!!"))

		svc, err := neocompute.New(neocompute.Config{Marble: m})
		if err != nil {
			t.Fatalf("neocompute.New: %v", err)
		}
		if svc == nil {
			t.Fatal("service should not be nil")
		}
	})

	t.Run("health endpoint responds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neocompute"})
		m.SetTestSecret("COMPUTE_MASTER_KEY", []byte("smoke-test-compute-master-key-32b!!"))
		svc, _ := neocompute.New(neocompute.Config{Marble: m})

		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("service metadata correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neocompute"})
		m.SetTestSecret("COMPUTE_MASTER_KEY", []byte("smoke-test-compute-master-key-32b!!"))
		svc, _ := neocompute.New(neocompute.Config{Marble: m})

		if svc.ID() != "neocompute" {
			t.Errorf("expected ID 'neocompute', got '%s'", svc.ID())
		}
		if svc.Name() != "NeoCompute Service" {
			t.Errorf("expected name 'NeoCompute Service', got '%s'", svc.Name())
		}
	})
}

// TestMarbleSmoke performs basic smoke tests on the Marble framework.
func TestMarbleSmoke(t *testing.T) {
	t.Run("marble creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "test"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}
		if m == nil {
			t.Fatal("marble should not be nil")
		}
	})

	t.Run("marble type correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "test-type"})
		if m.MarbleType() != "test-type" {
			t.Errorf("expected type 'test-type', got '%s'", m.MarbleType())
		}
	})

	t.Run("secrets can be set and retrieved", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "test"})
		m.SetTestSecret("TEST_KEY", []byte("test-value"))

		val, ok := m.Secret("TEST_KEY")
		if !ok {
			t.Error("secret should be retrievable")
		}
		if string(val) != "test-value" {
			t.Errorf("expected 'test-value', got '%s'", string(val))
		}
	})

	t.Run("missing secret returns false", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "test"})
		_, ok := m.Secret("NONEXISTENT")
		if ok {
			t.Error("missing secret should return false")
		}
	})
}

// TestServiceFrameworkSmoke tests the service framework.
func TestServiceFrameworkSmoke(t *testing.T) {
	t.Run("service lifecycle", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "test"})
		svc := marble.NewService(marble.ServiceConfig{
			ID:      "smoke-test",
			Name:    "Smoke Test Service",
			Version: "1.0.0",
			Marble:  m,
			DB:      nil,
		})

		if svc.ID() != "smoke-test" {
			t.Errorf("expected ID 'smoke-test', got '%s'", svc.ID())
		}

		ctx := context.Background()
		if err := svc.Start(ctx); err != nil {
			t.Fatalf("Start: %v", err)
		}

		if !svc.IsRunning() {
			t.Error("service should be running after Start")
		}

		if err := svc.Stop(); err != nil {
			t.Fatalf("Stop: %v", err)
		}

		if svc.IsRunning() {
			t.Error("service should not be running after Stop")
		}
	})

	t.Run("router available", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "test"})
		svc := marble.NewService(marble.ServiceConfig{
			ID:      "smoke-test",
			Name:    "Smoke Test Service",
			Version: "1.0.0",
			Marble:  m,
			DB:      nil,
		})

		router := svc.Router()
		if router == nil {
			t.Error("router should not be nil")
		}
	})
}

// TestConcurrencySmoke tests basic concurrent access.
func TestConcurrencySmoke(t *testing.T) {
	m, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
	m.SetTestSecret("POOL_MASTER_KEY", []byte("smoke-test-pool-key-32-bytes!!!!"))
	svc, _ := neoaccounts.New(neoaccounts.Config{Marble: m})

	done := make(chan bool, 20)

	for i := 0; i < 20; i++ {
		go func() {
			req := httptest.NewRequest("GET", "/health", nil)
			w := httptest.NewRecorder()
			svc.Router().ServeHTTP(w, req)
			done <- (w.Code == http.StatusOK)
		}()
	}

	timeout := time.After(5 * time.Second)
	success := 0
	for i := 0; i < 20; i++ {
		select {
		case ok := <-done:
			if ok {
				success++
			}
		case <-timeout:
			t.Fatal("concurrent requests timed out")
		}
	}

	if success != 20 {
		t.Errorf("expected 20 successful requests, got %d", success)
	}
}

// TestEndpointResponsivenessSmoke tests that endpoints respond within expected time.
func TestEndpointResponsivenessSmoke(t *testing.T) {
	m, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
	m.SetTestSecret("POOL_MASTER_KEY", []byte("smoke-test-pool-key-32-bytes!!!!"))
	svc, _ := neoaccounts.New(neoaccounts.Config{Marble: m})

	maxDuration := 100 * time.Millisecond

	t.Run("health endpoint responsive", func(t *testing.T) {
		start := time.Now()
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)
		duration := time.Since(start)

		if duration > maxDuration {
			t.Errorf("health endpoint too slow: %v > %v", duration, maxDuration)
		}
	})
}

// =============================================================================
// Additional TEE Service Smoke Tests
// =============================================================================

// TestNeoOracleSmoke performs basic smoke tests on the NeoOracle service.
func TestNeoOracleSmoke(t *testing.T) {
	t.Run("service creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "neooracle"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}

		svc, err := neooracle.New(neooracle.Config{Marble: m})
		if err != nil {
			t.Fatalf("neooracle.New: %v", err)
		}
		if svc == nil {
			t.Fatal("service should not be nil")
		}
	})

	t.Run("health endpoint responds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neooracle"})
		svc, _ := neooracle.New(neooracle.Config{Marble: m})

		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("service metadata correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neooracle"})
		svc, _ := neooracle.New(neooracle.Config{Marble: m})

		if svc.ID() != "neooracle" {
			t.Errorf("expected ID 'neooracle', got '%s'", svc.ID())
		}
		if svc.Name() != "NeoOracle Service" {
			t.Errorf("expected name 'NeoOracle Service', got '%s'", svc.Name())
		}
	})
}

// TestNeoFeedsSmoke performs basic smoke tests on the NeoFeeds/Datafeed service.
func TestNeoFeedsSmoke(t *testing.T) {
	t.Run("service creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "neofeeds"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}

		svc, err := neofeeds.New(neofeeds.Config{Marble: m})
		if err != nil {
			t.Fatalf("neofeeds.New: %v", err)
		}
		if svc == nil {
			t.Fatal("service should not be nil")
		}
	})

	t.Run("health endpoint responds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neofeeds"})
		svc, _ := neofeeds.New(neofeeds.Config{Marble: m})

		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("service metadata correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neofeeds"})
		svc, _ := neofeeds.New(neofeeds.Config{Marble: m})

		if svc.ID() != "neofeeds" {
			t.Errorf("expected ID 'neofeeds', got '%s'", svc.ID())
		}
		if svc.Name() != "NeoFeeds Service" {
			t.Errorf("expected name 'NeoFeeds Service', got '%s'", svc.Name())
		}
	})
}

// TestNeoGasBankSmoke performs basic smoke tests on the NeoGasBank service.
func TestNeoGasBankSmoke(t *testing.T) {
	t.Run("service creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "neogasbank"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}
		mockDB := database.NewMockRepository()

		svc, err := neogasbank.New(neogasbank.Config{Marble: m, DB: mockDB})
		if err != nil {
			t.Fatalf("neogasbank.New: %v", err)
		}
		if svc == nil {
			t.Fatal("service should not be nil")
		}
	})

	t.Run("health endpoint responds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neogasbank"})
		mockDB := database.NewMockRepository()
		svc, _ := neogasbank.New(neogasbank.Config{Marble: m, DB: mockDB})

		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("service metadata correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neogasbank"})
		mockDB := database.NewMockRepository()
		svc, _ := neogasbank.New(neogasbank.Config{Marble: m, DB: mockDB})

		if svc.ID() != "neogasbank" {
			t.Errorf("expected ID 'neogasbank', got '%s'", svc.ID())
		}
		if svc.Name() != "NeoGasBank Service" {
			t.Errorf("expected name 'NeoGasBank Service', got '%s'", svc.Name())
		}
	})
}

// TestTxProxySmoke performs basic smoke tests on the TxProxy service.
func TestTxProxySmoke(t *testing.T) {
	t.Run("service creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "txproxy"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}

		allowlist, _ := txproxy.ParseAllowlist(`{"contracts":{}}`)
		svc, err := txproxy.New(txproxy.Config{Marble: m, Allowlist: allowlist})
		if err != nil {
			t.Fatalf("txproxy.New: %v", err)
		}
		if svc == nil {
			t.Fatal("service should not be nil")
		}
	})

	t.Run("health endpoint responds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "txproxy"})
		allowlist, _ := txproxy.ParseAllowlist(`{"contracts":{}}`)
		svc, _ := txproxy.New(txproxy.Config{Marble: m, Allowlist: allowlist})

		ctx := context.Background()
		_ = svc.Start(ctx)
		defer svc.Stop()

		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("service metadata correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "txproxy"})
		allowlist, _ := txproxy.ParseAllowlist(`{"contracts":{}}`)
		svc, _ := txproxy.New(txproxy.Config{Marble: m, Allowlist: allowlist})

		if svc.ID() != "txproxy" {
			t.Errorf("expected ID 'txproxy', got '%s'", svc.ID())
		}
		if svc.Name() != "Tx Proxy" {
			t.Errorf("expected name 'Tx Proxy', got '%s'", svc.Name())
		}
	})
}

// TestNeoFlowSmoke performs basic smoke tests on the NeoFlow/Automation service.
func TestNeoFlowSmoke(t *testing.T) {
	t.Run("service creates successfully", func(t *testing.T) {
		m, err := marble.New(marble.Config{MarbleType: "neoflow"})
		if err != nil {
			t.Fatalf("marble.New: %v", err)
		}
		mockDB := database.NewMockRepository()

		svc, err := neoflow.New(neoflow.Config{Marble: m, DB: mockDB})
		if err != nil {
			t.Fatalf("neoflow.New: %v", err)
		}
		if svc == nil {
			t.Fatal("service should not be nil")
		}
	})

	t.Run("health endpoint responds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neoflow"})
		mockDB := database.NewMockRepository()
		svc, _ := neoflow.New(neoflow.Config{Marble: m, DB: mockDB})

		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("service metadata correct", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neoflow"})
		mockDB := database.NewMockRepository()
		svc, _ := neoflow.New(neoflow.Config{Marble: m, DB: mockDB})

		if svc.ID() != "neoflow" {
			t.Errorf("expected ID 'neoflow', got '%s'", svc.ID())
		}
		if svc.Name() != "NeoFlow Service" {
			t.Errorf("expected name 'NeoFlow Service', got '%s'", svc.Name())
		}
	})
}

// =============================================================================
// All Services Health Check
// =============================================================================

// TestAllServicesHealthSmoke verifies all 6 TEE services can start and respond to health checks.
func TestAllServicesHealthSmoke(t *testing.T) {
	t.Run("NeoAccounts", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
		m.SetTestSecret("POOL_MASTER_KEY", []byte("smoke-test-pool-key-32-bytes!!!!"))
		svc, err := neoaccounts.New(neoaccounts.Config{Marble: m})
		if err != nil {
			t.Fatalf("failed to create: %v", err)
		}
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("NeoCompute", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neocompute"})
		m.SetTestSecret("COMPUTE_MASTER_KEY", []byte("smoke-test-compute-master-key-32b!!"))
		svc, err := neocompute.New(neocompute.Config{Marble: m})
		if err != nil {
			t.Fatalf("failed to create: %v", err)
		}
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("NeoOracle", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neooracle"})
		svc, err := neooracle.New(neooracle.Config{Marble: m})
		if err != nil {
			t.Fatalf("failed to create: %v", err)
		}
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("NeoFeeds", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neofeeds"})
		svc, err := neofeeds.New(neofeeds.Config{Marble: m})
		if err != nil {
			t.Fatalf("failed to create: %v", err)
		}
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("NeoGasBank", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neogasbank"})
		mockDB := database.NewMockRepository()
		svc, err := neogasbank.New(neogasbank.Config{Marble: m, DB: mockDB})
		if err != nil {
			t.Fatalf("failed to create: %v", err)
		}
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})

	t.Run("NeoFlow", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neoflow"})
		mockDB := database.NewMockRepository()
		svc, err := neoflow.New(neoflow.Config{Marble: m, DB: mockDB})
		if err != nil {
			t.Fatalf("failed to create: %v", err)
		}
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("health check failed: status %d", w.Code)
		}
	})
}
