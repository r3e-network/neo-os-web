package blockchain

import (
	"os"
	"testing"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/stretchr/testify/require"
)

// TestNeoConfig holds test configuration for Neo blockchain testing
type TestNeoConfig struct {
	// Original environment variables before modification
	OriginalEnvVars map[string]string

	// Managed environment variables to clean up
	ManagedEnvVars []string

	// Neo configuration
	NeoConfig *config.NeoConfig

	// Logger instance
	Logger *logger.Logger
}

// SetupNeoTestEnvironment sets up the Neo test environment
func SetupNeoTestEnvironment(t *testing.T) *TestNeoConfig {
	t.Helper()

	// Create test config
	testConfig := &TestNeoConfig{
		OriginalEnvVars: make(map[string]string),
		ManagedEnvVars:  []string{},
	}

	// Set up environment variables for testing
	envVars := map[string]string{
		"NEO_RPC_URL":   "http://seed1.neo.org:10332", // Public testnet node
		"NEO_NETWORK":   "testnet",
		"NEO_GAS_LIMIT": "20000000",
		"NEO_GAS_PRICE": "1000",
		"NEO_NODES":     "http://seed1.neo.org:10332,http://seed2.neo.org:10332",
	}

	// Store original values and set new ones
	for key, value := range envVars {
		testConfig.OriginalEnvVars[key] = os.Getenv(key)
		os.Setenv(key, value)
		testConfig.ManagedEnvVars = append(testConfig.ManagedEnvVars, key)
	}

	// Create Neo config
	neoConfig := &config.NeoConfig{
		RPCURL:   envVars["NEO_RPC_URL"],
		Network:  envVars["NEO_NETWORK"],
		GasLimit: 20000000,
		GasPrice: 1000,
		Nodes:    []string{"http://seed1.neo.org:10332", "http://seed2.neo.org:10332"},
	}

	// Create logger
	logConfig := config.LoggingConfig{
		Level:  "debug",
		Format: "json",
		Output: "stdout",
	}
	logger := logger.New(logConfig)

	testConfig.NeoConfig = neoConfig
	testConfig.Logger = logger

	return testConfig
}

// TeardownNeoTestEnvironment cleans up the Neo test environment
func (c *TestNeoConfig) TeardownNeoTestEnvironment(t *testing.T) {
	t.Helper()

	// Restore original environment variables
	for _, key := range c.ManagedEnvVars {
		originalValue, exists := c.OriginalEnvVars[key]
		if exists {
			os.Setenv(key, originalValue)
		} else {
			os.Unsetenv(key)
		}
	}
}

// CreateClient creates a new blockchain client for testing
func (c *TestNeoConfig) CreateClient(t *testing.T) *blockchain.Client {
	t.Helper()

	// Configure nodes
	var nodes []blockchain.NodeConfig
	for _, nodeURL := range c.NeoConfig.Nodes {
		nodes = append(nodes, blockchain.NodeConfig{
			URL:    nodeURL,
			Weight: 1.0, // Default equal weight for all nodes
		})
	}

	// Create a real blockchain client
	client, err := blockchain.NewClient(c.NeoConfig, c.Logger, nodes)
	require.NoError(t, err)
	require.NotNil(t, client)

	return client
}

// GetWellKnownContractHash returns a known contract hash on the network for testing
func (c *TestNeoConfig) GetWellKnownContractHash() string {
	// For testnet, this is the NEO token hash
	if c.NeoConfig.Network == "testnet" {
		return "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"
	}

	// For mainnet, this is the NEO token hash
	if c.NeoConfig.Network == "mainnet" {
		return "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"
	}

	// For other networks, return a default (this may need to be updated for private networks)
	return "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"
}
