// Package mock provides mock implementations for blockchain components.
package mock

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain"
)

// MockBlockchainClient is a mock implementation of blockchain.Client for testing.
type MockBlockchainClient struct {
	mu                  sync.RWMutex
	blockCount          int
	blockCountDelay     time.Duration
	invokeFuncResponses map[string]map[string][]interface{}
	sendTxResponses     map[string]string
}

// NewMockBlockchainClient creates a new instance of the mock blockchain client.
func NewMockBlockchainClient() *MockBlockchainClient {
	return &MockBlockchainClient{
		blockCount:          1,
		invokeFuncResponses: make(map[string]map[string][]interface{}),
		sendTxResponses:     make(map[string]string),
	}
}

// GetBlockCount returns the mock block count.
func (m *MockBlockchainClient) GetBlockCount(ctx context.Context) (int, error) {
	m.mu.RLock()
	blockCount := m.blockCount
	delay := m.blockCountDelay
	m.mu.RUnlock()

	// If a delay is set, wait for the specified time
	if delay > 0 {
		select {
		case <-time.After(delay):
			// Delay completed
		case <-ctx.Done():
			// Context canceled or timed out
			return 0, fmt.Errorf("context canceled: %w", ctx.Err())
		}
	}

	return blockCount, nil
}

// SetBlockCount sets the mock block count to return.
func (m *MockBlockchainClient) SetBlockCount(count int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.blockCount = count
}

// SetBlockCountDelay sets a delay for the GetBlockCount method.
func (m *MockBlockchainClient) SetBlockCountDelay(delay time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.blockCountDelay = delay
}

// InvokeFunction invokes a contract method on the blockchain (mock implementation).
func (m *MockBlockchainClient) InvokeFunction(ctx context.Context, scriptHash, operation string, params []interface{}) (blockchain.InvocationResult, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Check if we have a mock response for this specific call
	opResponseMap, exists := m.invokeFuncResponses[scriptHash]
	if !exists {
		return blockchain.InvocationResult{}, fmt.Errorf("no mock response for script hash: %s", scriptHash)
	}

	stack, exists := opResponseMap[operation]
	if !exists {
		return blockchain.InvocationResult{}, fmt.Errorf("no mock response for operation: %s", operation)
	}

	return blockchain.InvocationResult{
		State:       "HALT",
		GasConsumed: "1.0",
		Stack:       stack,
	}, nil
}

// SetInvokeFunctionResponse sets a mock response for a specific contract and operation.
func (m *MockBlockchainClient) SetInvokeFunctionResponse(scriptHash, operation string, stack []interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.invokeFuncResponses[scriptHash]; !exists {
		m.invokeFuncResponses[scriptHash] = make(map[string][]interface{})
	}

	m.invokeFuncResponses[scriptHash][operation] = stack
}

// CreateTransaction creates a mock transaction.
func (m *MockBlockchainClient) CreateTransaction(ctx context.Context, params blockchain.TransactionParams) (string, error) {
	// Just return a mock transaction string
	return "01020304050607080910111213141516171819202122232425262728293031", nil
}

// SignTransaction signs a mock transaction.
func (m *MockBlockchainClient) SignTransaction(ctx context.Context, tx string, privateKey string) (string, error) {
	// Just return the signed mock transaction
	return tx + "_signed", nil
}

// SendTransaction sends a mock transaction.
func (m *MockBlockchainClient) SendTransaction(ctx context.Context, signedTx string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return the predefined response or a default one
	if txid, exists := m.sendTxResponses[signedTx]; exists {
		return txid, nil
	}

	// Default mock transaction ID
	return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil
}

// SetSendTransactionResponse sets a mock response for sending a transaction.
func (m *MockBlockchainClient) SetSendTransactionResponse(txid string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Store the response for any transaction
	for k := range m.sendTxResponses {
		delete(m.sendTxResponses, k)
	}

	// Use a wildcard key to match any tx
	m.sendTxResponses["_any_"] = txid
}

// GetTransaction gets a mock transaction.
func (m *MockBlockchainClient) GetTransaction(ctx context.Context, txid string) (blockchain.Transaction, error) {
	// Return a mock transaction
	return blockchain.Transaction{
		ID:        txid,
		Size:      123,
		Hash:      "0x" + txid[2:],
		BlockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		BlockTime: time.Now().Unix(),
		Sender:    "NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj",
	}, nil
}

// GetStorage gets mock contract storage.
func (m *MockBlockchainClient) GetStorage(ctx context.Context, scriptHash string, key string) (string, error) {
	// Return mock storage data
	return "0102030405060708090a", nil
}

// GetBalance gets a mock token balance.
func (m *MockBlockchainClient) GetBalance(ctx context.Context, address string, assetID string) (string, error) {
	// Return mock balance
	return "1000000000", nil
}
