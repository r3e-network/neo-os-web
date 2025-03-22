package mocks

import (
	"sync"
)

// MockBlockchainClient is a mock implementation of the blockchain.Client interface for testing
type MockBlockchainClient struct {
	mu                   sync.Mutex
	txResponses          map[string]error
	contractMethodCalls  map[string]map[string]bool
	contractEventQueries map[string]bool
}

// NewMockBlockchainClient creates a new mock blockchain client
func NewMockBlockchainClient() *MockBlockchainClient {
	return &MockBlockchainClient{
		txResponses:          make(map[string]error),
		contractMethodCalls:  make(map[string]map[string]bool),
		contractEventQueries: make(map[string]bool),
	}
}

// SetTxResponse sets the response for a transaction hash
func (m *MockBlockchainClient) SetTxResponse(txHash string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.txResponses[txHash] = err
}

// SubmitTransaction mocks submitting a transaction to the blockchain
func (m *MockBlockchainClient) SubmitTransaction(method string, params []interface{}) (string, error) {
	return "0x123456789abcdef", nil
}

// GetTransactionStatus mocks getting a transaction status
func (m *MockBlockchainClient) GetTransactionStatus(txHash string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if err, ok := m.txResponses[txHash]; ok {
		if err != nil {
			return "failed", err
		}
		return "confirmed", nil
	}

	return "pending", nil
}

// CallContractMethod mocks calling a contract method
func (m *MockBlockchainClient) CallContractMethod(contractAddress string, method string, args ...interface{}) (interface{}, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Record that this contract method was called
	if _, ok := m.contractMethodCalls[contractAddress]; !ok {
		m.contractMethodCalls[contractAddress] = make(map[string]bool)
	}
	m.contractMethodCalls[contractAddress][method] = true

	// For testing, just return a mock response
	return "mock-response", nil
}

// WasContractMethodCalled checks if a contract method was called
func (m *MockBlockchainClient) WasContractMethodCalled(contractAddress string, method string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	if methods, ok := m.contractMethodCalls[contractAddress]; ok {
		return methods[method]
	}
	return false
}

// SubscribeToContractEvents mocks subscribing to contract events
func (m *MockBlockchainClient) SubscribeToContractEvents(contractAddress string, event string, callback func(map[string]interface{})) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Record that we subscribed to this event
	m.contractEventQueries[contractAddress+":"+event] = true

	return nil
}

// UnsubscribeFromContractEvents mocks unsubscribing from contract events
func (m *MockBlockchainClient) UnsubscribeFromContractEvents(contractAddress string, event string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.contractEventQueries, contractAddress+":"+event)

	return nil
}

// GetLatestBlockHeight mocks getting the latest block height
func (m *MockBlockchainClient) GetLatestBlockHeight() (int64, error) {
	return 12345, nil
}

// GetBalance mocks getting a wallet balance
func (m *MockBlockchainClient) GetBalance(address string) (float64, error) {
	return 100.0, nil
}

// Transfer mocks transferring tokens
func (m *MockBlockchainClient) Transfer(to string, amount float64) (string, error) {
	return "0x123456789abcdef", nil
}
