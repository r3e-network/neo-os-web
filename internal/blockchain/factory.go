package blockchain

import (
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// ClientFactory is an implementation of BlockchainClientFactory
type ClientFactory struct {
	config *config.Config
	logger *logger.Logger
}

// NewClientFactory creates a new blockchain client factory
func NewClientFactory(cfg *config.Config, log *logger.Logger) BlockchainClientFactory {
	return &ClientFactory{
		config: cfg,
		logger: log,
	}
}

// NewClient creates a new blockchain client
func (f *ClientFactory) NewClient() (BlockchainClient, error) {
	// Configure nodes from config
	var nodes []NodeConfig
	for _, nodeURL := range f.config.Neo.Nodes {
		nodes = append(nodes, NodeConfig{
			URL:    nodeURL,
			Weight: 1.0, // Default equal weight for all nodes
		})
	}

	// Create a real blockchain client
	client, err := NewClient(&f.config.Neo, f.logger, nodes)
	if err != nil {
		return nil, err
	}

	return client, nil
}

// NewMockClient creates a new mock blockchain client for testing
func (f *ClientFactory) NewMockClient() BlockchainClient {
	return NewMockClient(f.logger)
}

// Initialize the global factory
func init() {
	// The factory will be initialized when the application starts
	// using the application's config and logger
}
