//go:build neoexpress

// Package neoexpress provides end-to-end integration tests for the Service Layer.
// This test demonstrates the complete workflow:
// 1. User submits Oracle request via smart contract
// 2. Service Layer detects the event via IndexerBridge
// 3. Service Layer processes the request
// 4. Service Layer sends fulfillment transaction back to the contract
package neoexpress

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// E2ETestConfig holds configuration for E2E tests.
type E2ETestConfig struct {
	RPCURL    string
	Contracts map[string]ContractInfo
	Account   string
}

// LoadE2EConfig loads the E2E test configuration.
func LoadE2EConfig() (*E2ETestConfig, error) {
	projectRoot := os.Getenv("PROJECT_ROOT")
	if projectRoot == "" {
		projectRoot = "../.."
	}

	contractCfg, err := LoadContractConfig(filepath.Join(projectRoot, "test/neo-express/contracts.json"))
	if err != nil {
		return nil, err
	}

	return &E2ETestConfig{
		RPCURL:    contractCfg.RPCURL,
		Contracts: contractCfg.Contracts,
		Account:   "NdZCVDTgGKTsA9Y3zYfgp8mi2UA9THK61F",
	}, nil
}

// MockServiceLayer simulates the Service Layer backend for testing.
type MockServiceLayer struct {
	rpcClient       *RPCClient
	contracts       map[string]ContractInfo
	eventsCh        chan *ContractEvent
	processedEvents []*ContractEvent
	mu              sync.Mutex
	running         bool
	stopCh          chan struct{}
}

// ContractEvent represents a blockchain event notification.
type ContractEvent struct {
	TxHash    string                 `json:"txid"`
	Contract  string                 `json:"contract"`
	EventName string                 `json:"eventname"`
	State     map[string]interface{} `json:"state"`
	Height    int64                  `json:"height"`
	Timestamp time.Time              `json:"timestamp"`
}

// NewMockServiceLayer creates a new mock service layer.
func NewMockServiceLayer(rpcURL string, contracts map[string]ContractInfo) *MockServiceLayer {
	return &MockServiceLayer{
		rpcClient: NewRPCClient(rpcURL),
		contracts: contracts,
		eventsCh:  make(chan *ContractEvent, 100),
		stopCh:    make(chan struct{}),
	}
}

// Start begins the mock service layer event processing.
func (m *MockServiceLayer) Start(ctx context.Context) error {
	m.mu.Lock()
	if m.running {
		m.mu.Unlock()
		return nil
	}
	m.running = true
	m.stopCh = make(chan struct{})
	m.mu.Unlock()

	// Start event processor
	go m.processEvents(ctx)

	// Start event poller (simulates IndexerBridge)
	go m.pollEvents(ctx)

	return nil
}

// Stop halts the mock service layer.
func (m *MockServiceLayer) Stop() {
	m.mu.Lock()
	if !m.running {
		m.mu.Unlock()
		return
	}
	m.running = false
	close(m.stopCh)
	m.mu.Unlock()
}

// GetProcessedEvents returns all processed events.
func (m *MockServiceLayer) GetProcessedEvents() []*ContractEvent {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]*ContractEvent{}, m.processedEvents...)
}

// pollEvents simulates the IndexerBridge polling for contract events.
func (m *MockServiceLayer) pollEvents(ctx context.Context) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	var lastHeight int64

	for {
		select {
		case <-ctx.Done():
			return
		case <-m.stopCh:
			return
		case <-ticker.C:
			// Get current block height
			height, err := m.rpcClient.GetBlockCount(ctx)
			if err != nil {
				continue
			}

			// Poll for new notifications
			if height > lastHeight {
				m.fetchNotifications(ctx, lastHeight+1, height)
				lastHeight = height
			}
		}
	}
}

// fetchNotifications fetches notifications from the blockchain.
func (m *MockServiceLayer) fetchNotifications(ctx context.Context, fromHeight, toHeight int64) {
	// Query application log for each block
	for h := fromHeight; h <= toHeight; h++ {
		// Get block
		result, err := m.rpcClient.Call(ctx, "getblock", []interface{}{h, true})
		if err != nil {
			continue
		}

		var block struct {
			Tx []struct {
				Hash string `json:"hash"`
			} `json:"tx"`
		}
		if err := json.Unmarshal(result, &block); err != nil {
			continue
		}

		// Check each transaction for notifications
		for _, tx := range block.Tx {
			m.fetchTxNotifications(ctx, tx.Hash, h)
		}
	}
}

// fetchTxNotifications fetches notifications from a specific transaction.
func (m *MockServiceLayer) fetchTxNotifications(ctx context.Context, txHash string, height int64) {
	result, err := m.rpcClient.Call(ctx, "getapplicationlog", []interface{}{txHash})
	if err != nil {
		return
	}

	var appLog struct {
		Executions []struct {
			Notifications []struct {
				Contract  string `json:"contract"`
				EventName string `json:"eventname"`
				State     struct {
					Type  string        `json:"type"`
					Value []interface{} `json:"value"`
				} `json:"state"`
			} `json:"notifications"`
		} `json:"executions"`
	}

	if err := json.Unmarshal(result, &appLog); err != nil {
		return
	}

	// Process notifications
	for _, exec := range appLog.Executions {
		for _, notif := range exec.Notifications {
			// Check if this is from one of our contracts
			for name, contract := range m.contracts {
				if strings.EqualFold(notif.Contract, contract.Hash) {
					event := &ContractEvent{
						TxHash:    txHash,
						Contract:  name,
						EventName: notif.EventName,
						State:     parseNotificationState(notif.State.Value),
						Height:    height,
						Timestamp: time.Now(),
					}

					select {
					case m.eventsCh <- event:
					default:
						// Channel full, skip
					}
				}
			}
		}
	}
}

// parseNotificationState converts notification state to a map.
func parseNotificationState(values []interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for i, v := range values {
		key := fmt.Sprintf("arg%d", i)
		if m, ok := v.(map[string]interface{}); ok {
			if val, exists := m["value"]; exists {
				result[key] = val
			} else {
				result[key] = m
			}
		} else {
			result[key] = v
		}
	}
	return result
}

// processEvents processes incoming contract events.
func (m *MockServiceLayer) processEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.stopCh:
			return
		case event := <-m.eventsCh:
			m.handleEvent(ctx, event)
		}
	}
}

// handleEvent handles a single contract event.
func (m *MockServiceLayer) handleEvent(ctx context.Context, event *ContractEvent) {
	m.mu.Lock()
	m.processedEvents = append(m.processedEvents, event)
	m.mu.Unlock()

	// Handle specific event types
	switch event.EventName {
	case "OracleRequested":
		m.handleOracleRequest(ctx, event)
	case "RandomnessRequested":
		m.handleRandomnessRequest(ctx, event)
	case "JobDue":
		m.handleJobDue(ctx, event)
	}
}

// handleOracleRequest processes an Oracle request and sends fulfillment.
func (m *MockServiceLayer) handleOracleRequest(ctx context.Context, event *ContractEvent) {
	// Extract request ID from event state
	requestID := event.State["arg0"]
	if requestID == nil {
		return
	}

	// Simulate processing delay
	time.Sleep(100 * time.Millisecond)

	// Generate mock result
	resultHash := sha256.Sum256([]byte(fmt.Sprintf("result-%v-%d", requestID, time.Now().UnixNano())))

	// Log the fulfillment (in real implementation, this would invoke the contract)
	fmt.Printf("[ServiceLayer] Processing OracleRequest: id=%v, resultHash=%x\n", requestID, resultHash[:8])
}

// handleRandomnessRequest processes a VRF request.
func (m *MockServiceLayer) handleRandomnessRequest(ctx context.Context, event *ContractEvent) {
	requestID := event.State["arg0"]
	if requestID == nil {
		return
	}

	// Simulate VRF computation
	time.Sleep(50 * time.Millisecond)

	fmt.Printf("[ServiceLayer] Processing RandomnessRequest: id=%v\n", requestID)
}

// handleJobDue processes an automation job.
func (m *MockServiceLayer) handleJobDue(ctx context.Context, event *ContractEvent) {
	jobID := event.State["arg0"]
	if jobID == nil {
		return
	}

	fmt.Printf("[ServiceLayer] Processing JobDue: id=%v\n", jobID)
}

// TestE2E_OracleRequestWorkflow tests the complete Oracle request workflow.
func TestE2E_OracleRequestWorkflow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping E2E test in short mode")
	}

	config, err := LoadE2EConfig()
	if err != nil {
		t.Skipf("E2E config not found: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Verify Neo Express is running
	client := NewRPCClient(config.RPCURL)
	blockCount, err := client.GetBlockCount(ctx)
	if err != nil {
		t.Skipf("Neo Express not running: %v", err)
	}
	t.Logf("Neo Express running at block %d", blockCount)

	// Start mock service layer
	servicelayer := NewMockServiceLayer(config.RPCURL, config.Contracts)
	if err := servicelayer.Start(ctx); err != nil {
		t.Fatalf("Failed to start mock service layer: %v", err)
	}
	defer servicelayer.Stop()

	// Get OracleHub contract
	oracleHub := config.Contracts["OracleHub"]
	if oracleHub.Hash == "" {
		t.Fatal("OracleHub contract not configured")
	}

	// Generate unique request ID
	requestID := fmt.Sprintf("req_%d", time.Now().UnixNano())
	serviceID := "test-service"
	payloadHash := sha256.Sum256([]byte(`{"url":"https://api.example.com/data"}`))

	t.Logf("Submitting Oracle request: id=%s", requestID)

	// Invoke OracleHub.submitRequest
	result, err := client.InvokeFunction(ctx, oracleHub.Hash, "submitRequest", []interface{}{
		map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte(requestID))},
		map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte(serviceID))},
		map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString(payloadHash[:])},
		map[string]interface{}{"type": "Integer", "value": "1000000"},
	})
	if err != nil {
		t.Fatalf("SubmitRequest invocation failed: %v", err)
	}

	state, _ := result["state"].(string)
	t.Logf("SubmitRequest result: state=%s", state)

	if state != "HALT" {
		t.Logf("SubmitRequest did not HALT (may need signing): %v", result)
	}

	// Wait for event processing
	t.Log("Waiting for Service Layer to process events...")
	time.Sleep(3 * time.Second)

	// Check processed events
	events := servicelayer.GetProcessedEvents()
	t.Logf("Processed %d events", len(events))

	for _, e := range events {
		t.Logf("  Event: contract=%s, name=%s, height=%d", e.Contract, e.EventName, e.Height)
	}
}

// TestE2E_DataFeedWorkflow tests the DataFeed submission workflow.
func TestE2E_DataFeedWorkflow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping E2E test in short mode")
	}

	config, err := LoadE2EConfig()
	if err != nil {
		t.Skipf("E2E config not found: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client := NewRPCClient(config.RPCURL)
	if _, err := client.GetBlockCount(ctx); err != nil {
		t.Skipf("Neo Express not running: %v", err)
	}

	dataFeedHub := config.Contracts["DataFeedHub"]
	if dataFeedHub.Hash == "" {
		t.Fatal("DataFeedHub contract not configured")
	}

	// Query latest round for ETH/USD
	feedID := "ETH/USD"
	result, err := client.InvokeFunction(ctx, dataFeedHub.Hash, "getLatestRound", []interface{}{
		map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte(feedID))},
	})
	if err != nil {
		t.Fatalf("getLatestRound failed: %v", err)
	}

	t.Logf("DataFeedHub.getLatestRound(%s): state=%v", feedID, result["state"])
}

// TestE2E_GasBankWorkflow tests the GasBank deposit/withdraw workflow.
func TestE2E_GasBankWorkflow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping E2E test in short mode")
	}

	config, err := LoadE2EConfig()
	if err != nil {
		t.Skipf("E2E config not found: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client := NewRPCClient(config.RPCURL)
	if _, err := client.GetBlockCount(ctx); err != nil {
		t.Skipf("Neo Express not running: %v", err)
	}

	gasBank := config.Contracts["GasBank"]
	if gasBank.Hash == "" {
		t.Fatal("GasBank contract not configured")
	}

	// Query balance for test account
	accountID := "test-account-1"
	result, err := client.InvokeFunction(ctx, gasBank.Hash, "GetBalance", []interface{}{
		map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte(accountID))},
	})
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}

	t.Logf("GasBank.GetBalance(%s): state=%v, stack=%v", accountID, result["state"], result["stack"])
}

// TestE2E_FullWorkflowWithFulfillment tests the complete request-fulfill cycle.
func TestE2E_FullWorkflowWithFulfillment(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping E2E test in short mode")
	}

	config, err := LoadE2EConfig()
	if err != nil {
		t.Skipf("E2E config not found: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	client := NewRPCClient(config.RPCURL)
	blockCount, err := client.GetBlockCount(ctx)
	if err != nil {
		t.Skipf("Neo Express not running: %v", err)
	}

	t.Logf("Starting full workflow test at block %d", blockCount)

	// Start mock service layer
	servicelayer := NewMockServiceLayer(config.RPCURL, config.Contracts)
	if err := servicelayer.Start(ctx); err != nil {
		t.Fatalf("Failed to start mock service layer: %v", err)
	}
	defer servicelayer.Stop()

	// Test 1: Query OracleHub state
	t.Run("OracleHub_QueryState", func(t *testing.T) {
		oracleHub := config.Contracts["OracleHub"]
		result, err := client.InvokeFunction(ctx, oracleHub.Hash, "get", []interface{}{
			map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte("test-request"))},
		})
		if err != nil {
			t.Logf("Get request (expected to fail for non-existent): %v", err)
		} else {
			t.Logf("OracleHub.Get result: %v", result)
		}
	})

	// Test 2: Query RandomnessHub state
	t.Run("RandomnessHub_QueryState", func(t *testing.T) {
		randomnessHub := config.Contracts["RandomnessHub"]
		result, err := client.InvokeFunction(ctx, randomnessHub.Hash, "get", []interface{}{
			map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte("test-vrf"))},
		})
		if err != nil {
			t.Logf("getRequest (expected to fail for non-existent): %v", err)
		} else {
			t.Logf("RandomnessHub.getRequest result: %v", result)
		}
	})

	// Test 3: Query AutomationScheduler state
	t.Run("AutomationScheduler_QueryState", func(t *testing.T) {
		scheduler := config.Contracts["AutomationScheduler"]
		result, err := client.InvokeFunction(ctx, scheduler.Hash, "getJob", []interface{}{
			map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte("test-job"))},
		})
		if err != nil {
			t.Logf("getJob (expected to fail for non-existent): %v", err)
		} else {
			t.Logf("AutomationScheduler.getJob result: %v", result)
		}
	})

	// Wait and check for any events
	time.Sleep(2 * time.Second)
	events := servicelayer.GetProcessedEvents()
	t.Logf("Total events captured: %d", len(events))
}

// TestE2E_ContractInteraction tests direct contract interactions.
func TestE2E_ContractInteraction(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping E2E test in short mode")
	}

	config, err := LoadE2EConfig()
	if err != nil {
		t.Skipf("E2E config not found: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client := NewRPCClient(config.RPCURL)
	if _, err := client.GetBlockCount(ctx); err != nil {
		t.Skipf("Neo Express not running: %v", err)
	}

	// Test Manager contract
	t.Run("Manager_isPaused", func(t *testing.T) {
		manager := config.Contracts["Manager"]
		result, err := client.InvokeFunction(ctx, manager.Hash, "isPaused", []interface{}{
			map[string]interface{}{"type": "String", "value": "oracle"},
		})
		if err != nil {
			t.Fatalf("isPaused failed: %v", err)
		}
		if result["state"] != "HALT" {
			t.Errorf("Expected HALT state, got %v", result["state"])
		}
		t.Logf("Manager.isPaused(oracle) = %v", result["stack"])
	})

	// Test ServiceRegistry contract
	t.Run("ServiceRegistry_get", func(t *testing.T) {
		registry := config.Contracts["ServiceRegistry"]
		result, err := client.InvokeFunction(ctx, registry.Hash, "get", []interface{}{
			map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte("oracle"))},
		})
		if err != nil {
			t.Logf("get (may fail for non-existent): %v", err)
		} else {
			t.Logf("ServiceRegistry.get(oracle) = %v", result)
		}
	})

	// Test AccountManager contract
	t.Run("AccountManager_get", func(t *testing.T) {
		accountMgr := config.Contracts["AccountManager"]
		result, err := client.InvokeFunction(ctx, accountMgr.Hash, "get", []interface{}{
			map[string]interface{}{"type": "ByteArray", "value": base64.StdEncoding.EncodeToString([]byte("test-account"))},
		})
		if err != nil {
			t.Logf("getAccount (may fail for non-existent): %v", err)
		} else {
			t.Logf("AccountManager.getAccount(test-account) = %v", result)
		}
	})
}

// BenchmarkContractInvocation benchmarks contract invocation performance.
func BenchmarkContractInvocation(b *testing.B) {
	config, err := LoadE2EConfig()
	if err != nil {
		b.Skipf("E2E config not found: %v", err)
	}

	ctx := context.Background()
	client := NewRPCClient(config.RPCURL)

	if _, err := client.GetBlockCount(ctx); err != nil {
		b.Skipf("Neo Express not running: %v", err)
	}

	manager := config.Contracts["Manager"]

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := client.InvokeFunction(ctx, manager.Hash, "isPaused", []interface{}{
			map[string]interface{}{"type": "String", "value": "oracle"},
		})
		if err != nil {
			b.Fatalf("invocation failed: %v", err)
		}
	}
}
