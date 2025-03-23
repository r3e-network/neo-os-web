package blockchain

import (
	"context"
	"encoding/json"
)

// BlockchainClient defines the interface for interacting with the blockchain
type BlockchainClient interface {
	// Core blockchain operations
	GetBlockHeight() (uint32, error)
	GetBlock(height uint32) (interface{}, error)
	GetTransaction(hash string) (interface{}, error)
	SendTransaction(tx interface{}) (string, error)

	// Smart contract operations
	InvokeContract(contractHash string, method string, params []interface{}) (map[string]interface{}, error)
	DeployContract(ctx context.Context, nefFile []byte, manifest json.RawMessage) (string, error)
	SubscribeToEvents(ctx context.Context, contractHash, eventName string, handler func(event interface{})) error

	// Transaction operations
	GetTransactionReceipt(ctx context.Context, hash string) (interface{}, error)
	IsTransactionInMempool(ctx context.Context, hash string) (bool, error)

	// Client management
	CheckHealth(ctx context.Context) error
	ResetConnections()
	Close() error
}

// BlockchainClientFactory creates blockchain clients
type BlockchainClientFactory interface {
	// Create a new production blockchain client
	NewClient() (BlockchainClient, error)

	// Create a mock blockchain client for testing
	NewMockClient() BlockchainClient
}

// Factory a global factory for blockchain clients
var Factory BlockchainClientFactory
