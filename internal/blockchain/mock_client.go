package blockchain

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
)

// MockClient is a mock implementation of the blockchain client for testing
type MockClient struct {
	logger           *logger.Logger
	blockHeight      uint32
	mu               sync.RWMutex
	transactions     map[string][]byte          // map of hash to transaction data
	blocks           map[uint32][]byte          // map of height to block data
	contracts        map[string][]byte          // map of hash to contract data
	contractCalls    map[string]map[string]any  // map of contractHash -> method -> result
	transactionLogs  map[string][]string        // map of hash to logs
	events           map[string][]mockEvent     // map of contractHash to events
	subscribedEvents map[string][]eventCallback // map of eventName to callbacks
}

type eventCallback func(event interface{})

type mockEvent struct {
	ContractHash string
	EventName    string
	Data         interface{}
	Timestamp    time.Time
}

// NewMockClient creates a new mock blockchain client
func NewMockClient(log *logger.Logger) *MockClient {
	return &MockClient{
		logger:           log,
		transactions:     make(map[string][]byte),
		blocks:           make(map[uint32][]byte),
		contracts:        make(map[string][]byte),
		contractCalls:    make(map[string]map[string]any),
		transactionLogs:  make(map[string][]string),
		events:           make(map[string][]mockEvent),
		subscribedEvents: make(map[string][]eventCallback),
	}
}

// GetBlockHeight returns the current block height
func (c *MockClient) GetBlockHeight() (uint32, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.blockHeight, nil
}

// SetBlockHeight sets the mock block height
func (c *MockClient) SetBlockHeight(height uint32) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.blockHeight = height
}

// GetBlock returns a block by height
func (c *MockClient) GetBlock(height uint32) (interface{}, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	block, exists := c.blocks[height]
	if !exists {
		return nil, ErrNotFound
	}

	return block, nil
}

// GetTransaction returns a transaction by hash
func (c *MockClient) GetTransaction(hash string) (interface{}, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	tx, exists := c.transactions[hash]
	if !exists {
		return nil, ErrNotFound
	}

	return tx, nil
}

// SetTransaction adds a mock transaction
func (c *MockClient) SetTransaction(hash string, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.transactions[hash] = data
}

// SendTransaction sends a signed transaction to the blockchain
func (c *MockClient) SendTransaction(tx interface{}) (string, error) {
	// Generate a mock transaction hash
	hash := "0x" + time.Now().Format("20060102150405")

	// Store transaction data
	c.mu.Lock()
	c.transactions[hash] = []byte("mock_transaction")
	c.mu.Unlock()

	return hash, nil
}

// InvokeContract invokes a smart contract
func (c *MockClient) InvokeContract(contractHash string, method string, params []interface{}) (map[string]interface{}, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Check if we have a predefined result for this contract call
	if methodResults, exists := c.contractCalls[contractHash]; exists {
		if result, ok := methodResults[method]; ok {
			if resultMap, isMap := result.(map[string]interface{}); isMap {
				return resultMap, nil
			}
			// Convert to map if it's not already
			return map[string]interface{}{"value": result}, nil
		}
	}

	// Return default result
	return map[string]interface{}{"value": "mock_result"}, nil
}

// SetContractCallResult sets the result for a specific contract method call
func (c *MockClient) SetContractCallResult(contractHash, method string, result interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.contractCalls[contractHash]; !exists {
		c.contractCalls[contractHash] = make(map[string]any)
	}

	c.contractCalls[contractHash][method] = result
}

// SubscribeToEvents subscribes to blockchain events
func (c *MockClient) SubscribeToEvents(ctx context.Context, contractHash, eventName string, handler func(event interface{})) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	key := contractHash + ":" + eventName
	c.subscribedEvents[key] = append(c.subscribedEvents[key], handler)
	return nil
}

// EmitEvent emits a mock event
func (c *MockClient) EmitEvent(contractHash, eventName string, data interface{}) {
	event := mockEvent{
		ContractHash: contractHash,
		EventName:    eventName,
		Data:         data,
		Timestamp:    time.Now(),
	}

	c.mu.Lock()
	c.events[contractHash] = append(c.events[contractHash], event)
	c.mu.Unlock()

	// Notify subscribers
	key := contractHash + ":" + eventName
	c.mu.RLock()
	handlers := c.subscribedEvents[key]
	c.mu.RUnlock()

	for _, handler := range handlers {
		handler(event)
	}
}

// Close closes the blockchain client
func (c *MockClient) Close() error {
	return nil
}

// TransactionReceipt contains information about a blockchain transaction
type MockTransactionReceipt struct {
	Hash          string          `json:"hash"`
	Confirmations int64           `json:"confirmations"`
	BlockHeight   int64           `json:"blockHeight"`
	BlockTime     time.Time       `json:"blockTime"`
	GasConsumed   int64           `json:"gasConsumed"`
	Result        json.RawMessage `json:"result"`
}

// GetTransactionReceipt gets the receipt for a transaction
func (c *MockClient) GetTransactionReceipt(ctx context.Context, hash string) (interface{}, error) {
	receipt := &MockTransactionReceipt{
		Hash:          hash,
		Confirmations: 6,
		BlockHeight:   123456,
		BlockTime:     time.Now().Add(-10 * time.Minute),
		GasConsumed:   1000,
		Result:        json.RawMessage(`{"status":"success"}`),
	}
	return receipt, nil
}

// DeployContract deploys a smart contract
func (c *MockClient) DeployContract(ctx context.Context, nefFile []byte, manifest json.RawMessage) (string, error) {
	// Generate a mock contract hash
	hash := "0x" + time.Now().Format("20060102150405") + "contract"

	// Store contract data
	c.mu.Lock()
	c.contracts[hash] = append(nefFile, []byte(manifest)...)
	c.mu.Unlock()

	return hash, nil
}

// IsTransactionInMempool checks if a transaction is in the mempool
func (c *MockClient) IsTransactionInMempool(ctx context.Context, hash string) (bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	_, exists := c.transactions[hash]
	return exists, nil
}

// CheckHealth verifies that nodes are responding correctly
func (c *MockClient) CheckHealth(ctx context.Context) error {
	return nil
}

// ResetConnections forces the client to reset connections
func (c *MockClient) ResetConnections() {
	// Nothing to do for mock client
}

// ErrNotFound is returned when an entity is not found
var ErrNotFound = errors.New("not found")
