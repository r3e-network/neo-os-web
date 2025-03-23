package blockchain

import (
	"encoding/json"
	"testing"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/stretchr/testify/require"
)

// SetupTestBlockchain creates a mock blockchain client for testing
func SetupTestBlockchain(t *testing.T) (BlockchainClient, func()) {
	t.Helper()

	// Create a mock client
	client := NewMockClient(nil)

	// Set basic data
	client.SetBlockHeight(12345)

	// Setup is complete, return client and cleanup function
	return client, func() {
		// Cleanup (close the client)
		err := client.Close()
		require.NoError(t, err)
	}
}

// SetupTestFactory creates a blockchain client factory for testing
func SetupTestFactory(t *testing.T) BlockchainClientFactory {
	t.Helper()

	// Create a minimal config for testing
	cfg := &config.Config{
		Neo: config.NeoConfig{
			RPCURL:   "http://localhost:10332",
			Network:  "testnet",
			GasLimit: 20000000,
			GasPrice: 1000,
			Nodes:    []string{"http://localhost:10332", "http://localhost:10333"},
		},
	}

	// Create a factory with nil logger for testing
	return NewClientFactory(cfg, nil)
}

// SetupTestContract sets up a mock smart contract in the blockchain client
func SetupTestContract(t *testing.T, client *MockClient, contractHash string, methods map[string]interface{}) {
	t.Helper()

	// Add contract methods and their results
	for method, result := range methods {
		client.SetContractCallResult(contractHash, method, result)
	}
}

// CreateDummyContractManifest creates a dummy contract manifest for testing
func CreateDummyContractManifest(name, description string) json.RawMessage {
	manifest := map[string]interface{}{
		"name":        name,
		"description": description,
		"abi": map[string]interface{}{
			"methods": []map[string]interface{}{
				{
					"name":       "transfer",
					"parameters": []string{"Hash160", "Hash160", "Integer"},
					"returnType": "Boolean",
				},
				{
					"name":       "balanceOf",
					"parameters": []string{"Hash160"},
					"returnType": "Integer",
				},
			},
		},
	}

	data, _ := json.Marshal(manifest)
	return data
}
