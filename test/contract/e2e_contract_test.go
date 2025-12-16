// Package contract provides end-to-end tests with deployed contracts.
package contract

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	neoaccounts "github.com/R3E-Network/service_layer/infrastructure/accountpool/marble"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	vrf "github.com/R3E-Network/service_layer/services/vrf/marble"
)

// TestE2EVRFFlow tests the VRF service flow for contract integration.
func TestE2EVRFFlow(t *testing.T) {
	m, _ := marble.New(marble.Config{MarbleType: "neorand"})
	m.SetTestSecret("VRF_PRIVATE_KEY", []byte("e2e-vrf-private-key-32-bytes!!!!"))

	svc, err := vrf.New(vrf.Config{Marble: m})
	if err != nil {
		t.Fatalf("vrf.New: %v", err)
	}

	server := httptest.NewServer(svc.Router())
	defer server.Close()

	t.Run("vrf request-response flow", func(t *testing.T) {
		request := vrf.DirectRandomRequest{
			Seed:     "user-provided-seed-for-randomness",
			NumWords: 3,
		}

		if request.Seed == "" {
			t.Error("seed should not be empty")
		}

		body, err := json.Marshal(request)
		if err != nil {
			t.Fatalf("marshal request: %v", err)
		}

		resp, err := http.Post(server.URL+"/random", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("post /random: %v", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
		}

		var vrfResp vrf.DirectRandomResponse
		if err := json.NewDecoder(resp.Body).Decode(&vrfResp); err != nil {
			t.Fatalf("decode response: %v", err)
		}

		if vrfResp.Seed != request.Seed {
			t.Fatalf("expected seed %q, got %q", request.Seed, vrfResp.Seed)
		}
		if len(vrfResp.RandomWords) != request.NumWords {
			t.Fatalf("expected %d random words, got %d", request.NumWords, len(vrfResp.RandomWords))
		}
		if vrfResp.Proof == "" {
			t.Fatal("expected proof to be non-empty")
		}
		if vrfResp.PublicKey == "" {
			t.Fatal("expected public_key to be non-empty")
		}

		t.Logf("VRF response: seed=%s words=%d", vrfResp.Seed, len(vrfResp.RandomWords))
	})
}

// TestE2EContractDeploymentFlow tests the contract deployment and registration flow.
func TestE2EContractDeploymentFlow(t *testing.T) {
	SkipIfNoNeoExpress(t)

	if testing.Short() {
		t.Skip("skipping contract deployment test in short mode")
	}

	t.Run("deployment simulation", func(t *testing.T) {
		type DeploymentStep struct {
			Order       int
			Contract    string
			Description string
			Complete    bool
		}

		steps := []DeploymentStep{
			{1, "ServiceLayerGateway", "Deploy main gateway contract", false},
			{2, "VRFService", "Deploy VRF service contract", false},
			{3, "NeoFeedsService", "Deploy data feeds contract", false},
			{4, "NeoFlowService", "Deploy neoflow contract", false},
		}

		for _, step := range steps {
			t.Logf("Step %d: %s - %s", step.Order, step.Contract, step.Description)
		}
	})

	t.Run("service registration simulation", func(t *testing.T) {
		type ServiceRegistration struct {
			ServiceType    string
			ContractHash   string
			Fee            int64
			TEEAccountHash string
		}

		registrations := []ServiceRegistration{
			{"neorand", "0x1111111111111111111111111111111111111111", 10000000, "0xTEE1"},
			{"oracle", "0x3333333333333333333333333333333333333333", 10000000, "0xTEE1"},
		}

		for _, reg := range registrations {
			t.Logf("Register service: type=%s, contract=%s, fee=%d GAS fractions",
				reg.ServiceType, reg.ContractHash, reg.Fee)
		}
	})
}

// TestE2EConcurrentServiceOperations tests concurrent operations across services.
func TestE2EConcurrentServiceOperations(t *testing.T) {
	apMarble, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
	apMarble.SetTestSecret("POOL_MASTER_KEY", []byte("concurrent-e2e-pool-key-32bytes!"))
	apSvc, _ := neoaccounts.New(neoaccounts.Config{Marble: apMarble})

	vrfMarble, _ := marble.New(marble.Config{MarbleType: "neorand"})
	vrfMarble.SetTestSecret("VRF_PRIVATE_KEY", []byte("concurrent-e2e-vrf-key-32bytes!!"))
	vrfSvc, _ := vrf.New(vrf.Config{Marble: vrfMarble})

	var wg sync.WaitGroup
	results := make(chan bool, 100)

	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest("GET", "/health", nil)
			w := httptest.NewRecorder()
			apSvc.Router().ServeHTTP(w, req)
			results <- (w.Code == http.StatusOK)
		}()
	}

	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest("GET", "/health", nil)
			w := httptest.NewRecorder()
			vrfSvc.Router().ServeHTTP(w, req)
			results <- (w.Code == http.StatusOK)
		}()
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(results)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("concurrent operations timed out")
	}

	success := 0
	for ok := range results {
		if ok {
			success++
		}
	}

	if success != 60 {
		t.Errorf("expected 60 successful operations, got %d", success)
	}
}

// TestE2EErrorRecovery tests error recovery scenarios.
func TestE2EErrorRecovery(t *testing.T) {
	t.Run("invalid request handling", func(t *testing.T) {
		m, _ := marble.New(marble.Config{MarbleType: "neoaccounts"})
		m.SetTestSecret("POOL_MASTER_KEY", []byte("error-recovery-pool-key-32bytes!"))
		svc, _ := neoaccounts.New(neoaccounts.Config{Marble: m})

		invalidJSON := []byte(`{invalid json}`)
		req := httptest.NewRequest("POST", "/request", bytes.NewReader(invalidJSON))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		svc.Router().ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
		}
	})
}

// TestE2EServiceMetadata verifies service metadata for contract compatibility.
func TestE2EServiceMetadata(t *testing.T) {
	services := []struct {
		name       string
		marbleType string
		secretKey  string
		secretVal  []byte
		createFunc func(*marble.Marble) (interface{ ID() string }, error)
		expectedID string
	}{
		{
			name:       "NeoAccounts",
			marbleType: "neoaccounts",
			secretKey:  "POOL_MASTER_KEY",
			secretVal:  []byte("metadata-test-pool-key-32bytes!!"),
			createFunc: func(m *marble.Marble) (interface{ ID() string }, error) {
				return neoaccounts.New(neoaccounts.Config{Marble: m})
			},
			expectedID: "neoaccounts",
		},
		{
			name:       "VRF",
			marbleType: "neorand",
			secretKey:  "VRF_PRIVATE_KEY",
			secretVal:  []byte("metadata-test-vrf-key-32-bytes!!"),
			createFunc: func(m *marble.Marble) (interface{ ID() string }, error) {
				return vrf.New(vrf.Config{Marble: m})
			},
			expectedID: "neorand",
		},
	}

	for _, svc := range services {
		t.Run(svc.name, func(t *testing.T) {
			m, err := marble.New(marble.Config{MarbleType: svc.marbleType})
			if err != nil {
				t.Fatalf("marble.New: %v", err)
			}
			m.SetTestSecret(svc.secretKey, svc.secretVal)

			service, err := svc.createFunc(m)
			if err != nil {
				t.Fatalf("create service: %v", err)
			}

			if service.ID() != svc.expectedID {
				t.Errorf("expected ID '%s', got '%s'", svc.expectedID, service.ID())
			}
		})
	}
}
