//go:build e2e

// Package e2e provides end-to-end integration tests for the Neo N3 Mini-App Platform.
// These tests verify complete workflows across multiple services.
package e2e

import (
	"bytes"
	"context"
	"encoding/json"
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

// =============================================================================
// Test Fixtures
// =============================================================================

type testServices struct {
	accounts *neoaccounts.Service
	compute  *neocompute.Service
	oracle   *neooracle.Service
	feeds    *neofeeds.Service
	gasbank  *neogasbank.Service
	flow     *neoflow.Service
	txproxy  *txproxy.Service
	mockDB   *database.MockRepository
}

func setupTestServices(t *testing.T) *testServices {
	t.Helper()

	mockDB := database.NewMockRepository()

	// Create all services
	accountsMarble, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
	accountsMarble.SetTestSecret("POOL_MASTER_KEY", []byte("e2e-test-pool-master-key-32b!!!!"))
	accounts, err := neoaccounts.New(neoaccounts.Config{Marble: accountsMarble})
	if err != nil {
		t.Fatalf("failed to create accounts service: %v", err)
	}

	computeMarble, _ := marble.New(marble.Config{MarbleType: "neocompute"})
	computeMarble.SetTestSecret("COMPUTE_MASTER_KEY", []byte("e2e-test-compute-master-key-32b!!"))
	compute, err := neocompute.New(neocompute.Config{Marble: computeMarble})
	if err != nil {
		t.Fatalf("failed to create compute service: %v", err)
	}

	oracleMarble, _ := marble.New(marble.Config{MarbleType: "neooracle"})
	oracle, err := neooracle.New(neooracle.Config{Marble: oracleMarble})
	if err != nil {
		t.Fatalf("failed to create oracle service: %v", err)
	}

	feedsMarble, _ := marble.New(marble.Config{MarbleType: "neofeeds"})
	feeds, err := neofeeds.New(neofeeds.Config{Marble: feedsMarble})
	if err != nil {
		t.Fatalf("failed to create feeds service: %v", err)
	}

	gasbankMarble, _ := marble.New(marble.Config{MarbleType: "neogasbank"})
	gasbank, err := neogasbank.New(neogasbank.Config{Marble: gasbankMarble, DB: mockDB})
	if err != nil {
		t.Fatalf("failed to create gasbank service: %v", err)
	}

	flowMarble, _ := marble.New(marble.Config{MarbleType: "neoflow"})
	flow, err := neoflow.New(neoflow.Config{Marble: flowMarble, DB: mockDB})
	if err != nil {
		t.Fatalf("failed to create flow service: %v", err)
	}

	txproxyMarble, _ := marble.New(marble.Config{MarbleType: "txproxy"})
	allowlist, _ := txproxy.ParseAllowlist(`{"contracts":{}}`)
	txp, err := txproxy.New(txproxy.Config{Marble: txproxyMarble, Allowlist: allowlist})
	if err != nil {
		t.Fatalf("failed to create txproxy service: %v", err)
	}

	return &testServices{
		accounts: accounts,
		compute:  compute,
		oracle:   oracle,
		feeds:    feeds,
		gasbank:  gasbank,
		flow:     flow,
		txproxy:  txp,
		mockDB:   mockDB,
	}
}

// =============================================================================
// E2E Tests: Service Health
// =============================================================================

// TestE2EAllServicesHealth verifies all services can start and respond to health checks.
func TestE2EAllServicesHealth(t *testing.T) {
	svcs := setupTestServices(t)

	services := []struct {
		name   string
		router http.Handler
	}{
		{"accounts", svcs.accounts.Router()},
		{"compute", svcs.compute.Router()},
		{"oracle", svcs.oracle.Router()},
		{"feeds", svcs.feeds.Router()},
		{"gasbank", svcs.gasbank.Router()},
		{"flow", svcs.flow.Router()},
	}

	for _, svc := range services {
		t.Run(svc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/health", nil)
			w := httptest.NewRecorder()
			svc.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("%s health check failed: status %d", svc.name, w.Code)
			}
		})
	}
}

// =============================================================================
// E2E Tests: GasBank Workflow
// =============================================================================

// TestE2EGasBankWorkflow tests the complete GasBank workflow:
// 1. Create account
// 2. Check balance
// 3. Deduct fee (service-to-service)
// 4. Verify balance updated
func TestE2EGasBankWorkflow(t *testing.T) {
	svcs := setupTestServices(t)
	ctx := context.Background()

	userID := "e2e-test-user-001"

	// Step 1: Create account with initial balance
	svcs.mockDB.CreateGasBankAccount(ctx, &database.GasBankAccount{
		ID:       "acc-e2e-001",
		UserID:   userID,
		Balance:  1000000000, // 10 GAS
		Reserved: 0,
	})

	// Step 2: Get account via HTTP
	req := httptest.NewRequest("GET", "/account", nil)
	req.Header.Set("X-User-ID", userID)
	w := httptest.NewRecorder()
	svcs.gasbank.Router().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("get account failed: status %d, body: %s", w.Code, w.Body.String())
	}

	var accountResp neogasbank.GetAccountResponse
	if err := json.Unmarshal(w.Body.Bytes(), &accountResp); err != nil {
		t.Fatalf("unmarshal account response: %v", err)
	}

	if accountResp.Balance != 1000000000 {
		t.Errorf("expected balance 1000000000, got %d", accountResp.Balance)
	}

	// Step 3: Deduct fee (service-to-service call)
	deductReq := neogasbank.DeductFeeRequest{
		UserID:      userID,
		Amount:      10000000, // 0.1 GAS
		ReferenceID: "e2e-test-ref-001",
	}
	body, _ := json.Marshal(deductReq)
	req = httptest.NewRequest("POST", "/deduct", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-ID", "neofeeds") // Service auth
	w = httptest.NewRecorder()
	svcs.gasbank.Router().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("deduct fee failed: status %d, body: %s", w.Code, w.Body.String())
	}

	var deductResp neogasbank.DeductFeeResponse
	if err := json.Unmarshal(w.Body.Bytes(), &deductResp); err != nil {
		t.Fatalf("unmarshal deduct response: %v", err)
	}

	if !deductResp.Success {
		t.Errorf("deduct fee should succeed, got error: %s", deductResp.Error)
	}

	expectedBalance := int64(990000000) // 10 GAS - 0.1 GAS
	if deductResp.BalanceAfter != expectedBalance {
		t.Errorf("expected balance after %d, got %d", expectedBalance, deductResp.BalanceAfter)
	}

	// Step 4: Verify balance via account endpoint
	req = httptest.NewRequest("GET", "/account", nil)
	req.Header.Set("X-User-ID", userID)
	w = httptest.NewRecorder()
	svcs.gasbank.Router().ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &accountResp); err != nil {
		t.Fatalf("unmarshal account response: %v", err)
	}

	if accountResp.Balance != expectedBalance {
		t.Errorf("expected final balance %d, got %d", expectedBalance, accountResp.Balance)
	}
}

// TestE2EGasBankInsufficientBalance tests fee deduction with insufficient balance.
func TestE2EGasBankInsufficientBalance(t *testing.T) {
	svcs := setupTestServices(t)
	ctx := context.Background()

	userID := "e2e-test-user-002"

	// Create account with low balance
	svcs.mockDB.CreateGasBankAccount(ctx, &database.GasBankAccount{
		ID:       "acc-e2e-002",
		UserID:   userID,
		Balance:  1000, // Very low balance
		Reserved: 0,
	})

	// Try to deduct more than available
	deductReq := neogasbank.DeductFeeRequest{
		UserID:      userID,
		Amount:      10000000, // 0.1 GAS - more than available
		ReferenceID: "e2e-test-ref-002",
	}
	body, _ := json.Marshal(deductReq)
	req := httptest.NewRequest("POST", "/deduct", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-ID", "neofeeds")
	w := httptest.NewRecorder()
	svcs.gasbank.Router().ServeHTTP(w, req)

	// Should return 402 Payment Required
	if w.Code != http.StatusPaymentRequired {
		t.Errorf("expected status 402, got %d", w.Code)
	}

	var deductResp neogasbank.DeductFeeResponse
	if err := json.Unmarshal(w.Body.Bytes(), &deductResp); err != nil {
		t.Fatalf("unmarshal deduct response: %v", err)
	}

	if deductResp.Success {
		t.Error("deduct fee should fail for insufficient balance")
	}
}

// =============================================================================
// E2E Tests: Reserve/Release Workflow
// =============================================================================

// TestE2EReserveReleaseWorkflow tests the fund reservation workflow.
func TestE2EReserveReleaseWorkflow(t *testing.T) {
	svcs := setupTestServices(t)
	ctx := context.Background()

	userID := "e2e-test-user-003"

	// Create account
	svcs.mockDB.CreateGasBankAccount(ctx, &database.GasBankAccount{
		ID:       "acc-e2e-003",
		UserID:   userID,
		Balance:  1000000000, // 10 GAS
		Reserved: 0,
	})

	// Step 1: Reserve funds
	reserveReq := neogasbank.ReserveFundsRequest{
		UserID: userID,
		Amount: 100000000, // 1 GAS
	}
	body, _ := json.Marshal(reserveReq)
	req := httptest.NewRequest("POST", "/reserve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-ID", "neoflow")
	w := httptest.NewRecorder()
	svcs.gasbank.Router().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("reserve funds failed: status %d", w.Code)
	}

	var reserveResp neogasbank.ReserveFundsResponse
	json.Unmarshal(w.Body.Bytes(), &reserveResp)

	if !reserveResp.Success {
		t.Error("reserve should succeed")
	}
	if reserveResp.Reserved != 100000000 {
		t.Errorf("expected reserved 100000000, got %d", reserveResp.Reserved)
	}

	// Step 2: Release funds (without commit)
	releaseReq := neogasbank.ReleaseFundsRequest{
		UserID: userID,
		Amount: 100000000,
		Commit: false,
	}
	body, _ = json.Marshal(releaseReq)
	req = httptest.NewRequest("POST", "/release", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-ID", "neoflow")
	w = httptest.NewRecorder()
	svcs.gasbank.Router().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("release funds failed: status %d", w.Code)
	}

	var releaseResp neogasbank.ReleaseFundsResponse
	json.Unmarshal(w.Body.Bytes(), &releaseResp)

	if !releaseResp.Success {
		t.Error("release should succeed")
	}
	// Balance should remain unchanged (no commit)
	if releaseResp.BalanceAfter != 1000000000 {
		t.Errorf("expected balance 1000000000, got %d", releaseResp.BalanceAfter)
	}
}

// =============================================================================
// E2E Tests: Service Lifecycle
// =============================================================================

// TestE2EServiceLifecycle tests service start/stop lifecycle.
func TestE2EServiceLifecycle(t *testing.T) {
	svcs := setupTestServices(t)
	ctx := context.Background()

	// Start txproxy service
	if err := svcs.txproxy.Start(ctx); err != nil {
		t.Fatalf("failed to start txproxy: %v", err)
	}

	// Verify health
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	svcs.txproxy.Router().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("health check failed after start: status %d", w.Code)
	}

	// Stop service
	if err := svcs.txproxy.Stop(); err != nil {
		t.Fatalf("failed to stop txproxy: %v", err)
	}
}

// =============================================================================
// E2E Tests: Concurrent Access
// =============================================================================

// TestE2EConcurrentGasBankAccess tests concurrent access to GasBank.
func TestE2EConcurrentGasBankAccess(t *testing.T) {
	svcs := setupTestServices(t)
	ctx := context.Background()

	userID := "e2e-test-user-concurrent"

	// Create account with high balance
	svcs.mockDB.CreateGasBankAccount(ctx, &database.GasBankAccount{
		ID:       "acc-e2e-concurrent",
		UserID:   userID,
		Balance:  10000000000, // 100 GAS
		Reserved: 0,
	})

	// Run concurrent deductions
	numGoroutines := 10
	done := make(chan bool, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(idx int) {
			deductReq := neogasbank.DeductFeeRequest{
				UserID:      userID,
				Amount:      1000000, // 0.01 GAS
				ReferenceID: "concurrent-ref",
			}
			body, _ := json.Marshal(deductReq)
			req := httptest.NewRequest("POST", "/deduct", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Service-ID", "neofeeds")
			w := httptest.NewRecorder()
			svcs.gasbank.Router().ServeHTTP(w, req)

			done <- (w.Code == http.StatusOK)
		}(i)
	}

	// Wait for all goroutines
	timeout := time.After(5 * time.Second)
	success := 0
	for i := 0; i < numGoroutines; i++ {
		select {
		case ok := <-done:
			if ok {
				success++
			}
		case <-timeout:
			t.Fatal("concurrent requests timed out")
		}
	}

	if success != numGoroutines {
		t.Errorf("expected %d successful requests, got %d", numGoroutines, success)
	}
}

// =============================================================================
// E2E Tests: Error Handling
// =============================================================================

// TestE2EErrorHandling tests error responses across services.
func TestE2EErrorHandling(t *testing.T) {
	svcs := setupTestServices(t)

	t.Run("GasBank unauthorized", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/account", nil)
		// No X-User-ID header
		w := httptest.NewRecorder()
		svcs.gasbank.Router().ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("GasBank deduct without service auth", func(t *testing.T) {
		deductReq := neogasbank.DeductFeeRequest{
			UserID: "test-user",
			Amount: 1000,
		}
		body, _ := json.Marshal(deductReq)
		req := httptest.NewRequest("POST", "/deduct", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		// No X-Service-ID header - returns 401 (Unauthorized) not 403 (Forbidden)
		w := httptest.NewRecorder()
		svcs.gasbank.Router().ServeHTTP(w, req)

		// Service auth missing returns 401 or 403 depending on middleware order
		if w.Code != http.StatusForbidden && w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 or 403, got %d", w.Code)
		}
	})

	t.Run("Invalid JSON body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/deduct", bytes.NewReader([]byte("invalid json")))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Service-ID", "neofeeds")
		w := httptest.NewRecorder()
		svcs.gasbank.Router().ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})
}

// =============================================================================
// E2E Tests: Cross-Service Integration
// =============================================================================

// TestE2ECrossServiceIntegration tests integration between services.
func TestE2ECrossServiceIntegration(t *testing.T) {
	svcs := setupTestServices(t)

	// Verify all services can be created and respond
	t.Run("All services respond to health", func(t *testing.T) {
		routers := []http.Handler{
			svcs.accounts.Router(),
			svcs.compute.Router(),
			svcs.oracle.Router(),
			svcs.feeds.Router(),
			svcs.gasbank.Router(),
			svcs.flow.Router(),
		}

		for i, router := range routers {
			req := httptest.NewRequest("GET", "/health", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("service %d health check failed: %d", i, w.Code)
			}
		}
	})
}
