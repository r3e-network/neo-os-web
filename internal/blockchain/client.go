package blockchain

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/block"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/rpc/client"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/pkg/logger"
	"github.com/rs/zerolog/log"
)

// NodeConfig represents a Neo N3 node configuration
type NodeConfig struct {
	URL    string  `json:"url"`
	Weight float64 `json:"weight"`
}

// Client provides an interface to interact with the Neo N3 blockchain
type Client struct {
	rpcClient   *client.Client
	config      *config.NeoConfig
	logger      *logger.Logger
	blockHeight uint32
	mu          sync.RWMutex
	nodes       []NodeConfig
	failedNodes map[string]time.Time
	nodeLatency map[string]time.Duration
}

// NewClient creates a new blockchain client
func NewClient(cfg *config.NeoConfig, log *logger.Logger, nodes []NodeConfig) (*Client, error) {
	// Create RPC client
	rpcClient, err := client.New(context.Background(), cfg.RPCURL, client.Options{})
	if err != nil {
		return nil, fmt.Errorf("failed to create RPC client: %w", err)
	}

	// Create blockchain client
	c := &Client{
		rpcClient:   rpcClient,
		config:      cfg,
		logger:      log,
		nodes:       nodes,
		failedNodes: make(map[string]time.Time),
		nodeLatency: make(map[string]time.Duration),
	}

	// Update initial block height
	height, err := c.GetBlockHeight()
	if err != nil {
		log.Warnf("Failed to get initial block height: %v", err)
	} else {
		c.setBlockHeight(height)
	}

	return c, nil
}

// GetBlockHeight returns the current block height
func (c *Client) GetBlockHeight() (uint32, error) {
	height, err := c.rpcClient.GetBlockCount()
	if err != nil {
		return 0, fmt.Errorf("failed to get block count: %w", err)
	}
	
	// Block count is 1-based, height is 0-based
	return height - 1, nil
}

// GetBlock returns a block by height
func (c *Client) GetBlock(height uint32) (*block.Block, error) {
	block, err := c.rpcClient.GetBlockByIndex(height)
	if err != nil {
		return nil, fmt.Errorf("failed to get block at height %d: %w", height, err)
	}
	return block, nil
}

// GetTransaction returns a transaction by hash
func (c *Client) GetTransaction(hash string) (*transaction.Transaction, error) {
	tx, err := c.rpcClient.GetRawTransaction(hash)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction %s: %w", hash, err)
	}
	return tx, nil
}

// SendTransaction sends a signed transaction to the blockchain
func (c *Client) SendTransaction(tx *transaction.Transaction) (string, error) {
	hash, err := c.rpcClient.SendRawTransaction(tx)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}
	return hash.StringLE(), nil
}

// InvokeFunction invokes a smart contract function
func (c *Client) InvokeFunction(contractHash, operation string, params []client.StackItem) (interface{}, error) {
	result, err := c.rpcClient.InvokeFunction(contractHash, operation, params, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to invoke function %s on contract %s: %w", operation, contractHash, err)
	}

	// Check execution state
	if result.State != "HALT" {
		return nil, errors.New("contract execution failed: " + result.FaultException)
	}

	return result, nil
}

// SubscribeToEvents subscribes to blockchain events
func (c *Client) SubscribeToEvents(ctx context.Context, contractHash, eventName string, handler func(event interface{})) error {
	// TODO: Implement subscription to events
	// This requires setting up a WebSocket connection to the Neo node
	// and handling event notifications
	
	return errors.New("not implemented")
}

// CurrentBlockHeight returns the cached block height
func (c *Client) CurrentBlockHeight() uint32 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.blockHeight
}

// setBlockHeight sets the cached block height
func (c *Client) setBlockHeight(height uint32) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.blockHeight = height
}

// LoadWallet loads a NEP-6 wallet
func (c *Client) LoadWallet(path, password string) (*wallet.Wallet, error) {
	w, err := wallet.NewWalletFromFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to load wallet: %w", err)
	}

	// Decrypt accounts
	for _, account := range w.Accounts {
		if err := account.Decrypt(password, w.Scrypt); err != nil {
			return nil, fmt.Errorf("failed to decrypt account: %w", err)
		}
	}

	return w, nil
}

// Close closes the blockchain client
func (c *Client) Close() error {
	if c.rpcClient != nil {
		c.rpcClient.Close()
	}
	return nil
}

// TransactionReceipt contains information about a blockchain transaction
type TransactionReceipt struct {
	Hash          string          `json:"hash"`
	Confirmations int64           `json:"confirmations"`
	BlockHeight   int64           `json:"blockHeight"`
	BlockTime     time.Time       `json:"blockTime"`
	GasConsumed   int64           `json:"gasConsumed"`
	Result        json.RawMessage `json:"result"`
}

// InvokeContract invokes a smart contract on the Neo N3 blockchain
func (c *Client) InvokeContract(ctx context.Context, script []byte, params []interface{}, signers []interface{}, privateKey *wallet.PrivateKey) (string, error) {
	// Implementation for contract invocation
	// Mock implementation for now
	return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", nil
}

// DeployContract deploys a smart contract to the Neo N3 blockchain
func (c *Client) DeployContract(ctx context.Context, nefFile []byte, manifest json.RawMessage, signers []interface{}, privateKey *wallet.PrivateKey) (string, error) {
	// Implementation for contract deployment
	// Mock implementation for now
	return "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", nil
}

// TransferAsset transfers an asset on the Neo N3 blockchain
func (c *Client) TransferAsset(ctx context.Context, asset string, from string, to string, amount float64, privateKey *wallet.PrivateKey) (string, error) {
	// Implementation for asset transfer
	// Mock implementation for now
	return "0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef", nil
}

// GetTransactionReceipt gets the receipt for a transaction
func (c *Client) GetTransactionReceipt(ctx context.Context, hash string) (*TransactionReceipt, error) {
	// Implementation for getting transaction receipt
	// Mock implementation for now
	return &TransactionReceipt{
		Hash:          hash,
		Confirmations: 6,
		BlockHeight:   123456,
		BlockTime:     time.Now().Add(-10 * time.Minute),
		GasConsumed:   1000,
		Result:        json.RawMessage(`{"state":"HALT"}`),
	}, nil
}

// IsTransactionInMempool checks if a transaction is in the mempool
func (c *Client) IsTransactionInMempool(ctx context.Context, hash string) (bool, error) {
	// Try to call each node until successful
	for _, node := range c.getAvailableNodes() {
		start := time.Now()
		
		// Check if this node is temporarily marked as failed
		c.mu.RLock()
		failTime, isFailed := c.failedNodes[node.URL]
		c.mu.RUnlock()
		
		if isFailed && time.Since(failTime) < 5*time.Minute {
			// Skip this node for now
			continue
		}
		
		// Query the node to check if transaction is in mempool
		// TODO: Replace with actual call to Neo node RPC
		// This is a mock implementation
		found := hash != ""
		
		// Update node latency
		latency := time.Since(start)
		c.mu.Lock()
		c.nodeLatency[node.URL] = latency
		c.mu.Unlock()
		
		return found, nil
	}

	return false, errors.New("all nodes failed to check transaction in mempool")
}

// CheckHealth verifies that nodes are responding correctly
func (c *Client) CheckHealth(ctx context.Context) error {
	// Try each node to get blockchain info
	healthyNodeCount := 0
	
	for _, node := range c.nodes {
		start := time.Now()
		
		// TODO: Implement actual health check against Neo node
		// For example, query the block height
		var isHealthy bool
		
		// This is a mock implementation
		isHealthy = true // simulate a healthy response
		
		latency := time.Since(start)
		
		c.mu.Lock()
		if isHealthy {
			// Update latency and clear from failed nodes if present
			c.nodeLatency[node.URL] = latency
			delete(c.failedNodes, node.URL)
			healthyNodeCount++
		} else {
			// Mark as failed
			c.failedNodes[node.URL] = time.Now()
		}
		c.mu.Unlock()
	}
	
	// Consider healthy if at least one node is available
	if healthyNodeCount > 0 {
		return nil
	}
	
	return errors.New("no healthy nodes available")
}

// ResetConnections forces the client to reset any cached connections
func (c *Client) ResetConnections() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// Clear failed nodes list to allow trying all nodes again
	c.failedNodes = make(map[string]time.Time)
}

// getAvailableNodes returns a list of nodes prioritized by performance and availability
func (c *Client) getAvailableNodes() []NodeConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	// Create a copy of nodes for sorting
	nodes := make([]NodeConfig, len(c.nodes))
	copy(nodes, c.nodes)
	
	// Sort nodes by:
	// 1. Not in failed list
	// 2. Lower latency
	// 3. Higher weight
	
	// For simplicity, we'll just prioritize non-failed nodes for now
	var availableNodes []NodeConfig
	
	for _, node := range nodes {
		if _, isFailed := c.failedNodes[node.URL]; !isFailed {
			availableNodes = append(availableNodes, node)
		}
	}
	
	// If no available nodes, return all nodes
	if len(availableNodes) == 0 {
		availableNodes = nodes
	}
	
	return availableNodes
}