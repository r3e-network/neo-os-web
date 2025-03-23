package blockchain

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRealNodeBasicOperations tests basic operations against a real Neo N3 testnet node
func TestRealNodeBasicOperations(t *testing.T) {
	// Skip if CI environment or SKIP_REAL_NODE_TESTS is set
	if os.Getenv("CI") != "" || os.Getenv("SKIP_REAL_NODE_TESTS") != "" {
		t.Skip("Skipping real node tests in CI environment or when SKIP_REAL_NODE_TESTS is set")
	}

	// Setup test environment
	testConfig := SetupNeoTestEnvironment(t)
	defer testConfig.TeardownNeoTestEnvironment(t)

	// Create a client
	client := testConfig.CreateClient(t)
	defer client.Close()

	// Test GetBlockHeight
	height, err := client.GetBlockHeight()
	require.NoError(t, err)
	assert.Greater(t, int(height), 0, "Block height should be greater than 0")
	t.Logf("Current block height: %d", height)

	// Test GetBlock
	block, err := client.GetBlock(height - 10) // Get a block from 10 blocks ago to ensure it's stable
	require.NoError(t, err)
	assert.NotNil(t, block)
	assert.Equal(t, height-10, block.Index)
	t.Logf("Block %d has %d transactions", block.Index, len(block.Transactions))

	// Test CheckHealth
	err = client.CheckHealth(context.Background())
	require.NoError(t, err)
}

// TestRealNodeContractInvocation tests invoking a contract on a real Neo N3 testnet node
func TestRealNodeContractInvocation(t *testing.T) {
	// Skip if CI environment or SKIP_REAL_NODE_TESTS is set
	if os.Getenv("CI") != "" || os.Getenv("SKIP_REAL_NODE_TESTS") != "" {
		t.Skip("Skipping real node tests in CI environment or when SKIP_REAL_NODE_TESTS is set")
	}

	// Setup test environment
	testConfig := SetupNeoTestEnvironment(t)
	defer testConfig.TeardownNeoTestEnvironment(t)

	// Create a client
	client := testConfig.CreateClient(t)
	defer client.Close()

	// Get a known contract hash (NEO token)
	contractHash := testConfig.GetWellKnownContractHash()

	// Test InvokeContract with a simple method (symbol)
	result, err := client.InvokeContract(contractHash, "symbol", []interface{}{})
	require.NoError(t, err)
	assert.NotNil(t, result)

	// The NEO token's symbol should be "NEO"
	value, exists := result["value"]
	assert.True(t, exists, "Result should contain a 'value' key")
	t.Logf("Contract %s symbol: %v", contractHash, value)

	// Test InvokeContract with another method (decimals)
	result, err = client.InvokeContract(contractHash, "decimals", []interface{}{})
	require.NoError(t, err)
	assert.NotNil(t, result)
	t.Logf("Contract %s decimals: %v", contractHash, result["value"])
}

// TestRealNodeErrorHandling tests error handling when interacting with a real Neo N3 testnet node
func TestRealNodeErrorHandling(t *testing.T) {
	// Skip if CI environment or SKIP_REAL_NODE_TESTS is set
	if os.Getenv("CI") != "" || os.Getenv("SKIP_REAL_NODE_TESTS") != "" {
		t.Skip("Skipping real node tests in CI environment or when SKIP_REAL_NODE_TESTS is set")
	}

	// Setup test environment
	testConfig := SetupNeoTestEnvironment(t)
	defer testConfig.TeardownNeoTestEnvironment(t)

	// Create a client
	client := testConfig.CreateClient(t)
	defer client.Close()

	// Test error when getting a non-existent block
	_, err := client.GetBlock(999999999) // This block should not exist yet
	assert.Error(t, err)
	t.Logf("Expected error when getting non-existent block: %v", err)

	// Test error when invoking a non-existent contract
	_, err = client.InvokeContract("0x0000000000000000000000000000000000000000", "symbol", []interface{}{})
	assert.Error(t, err)
	t.Logf("Expected error when invoking non-existent contract: %v", err)

	// Test error when invoking a non-existent method on a valid contract
	contractHash := testConfig.GetWellKnownContractHash()
	_, err = client.InvokeContract(contractHash, "nonExistentMethod", []interface{}{})
	assert.Error(t, err)
	t.Logf("Expected error when invoking non-existent method: %v", err)
}

// TestRealNodeTransaction tests transaction-related operations
func TestRealNodeTransaction(t *testing.T) {
	// Skip if CI environment or SKIP_REAL_NODE_TESTS is set
	if os.Getenv("CI") != "" || os.Getenv("SKIP_REAL_NODE_TESTS") != "" {
		t.Skip("Skipping real node tests in CI environment or when SKIP_REAL_NODE_TESTS is set")
	}

	// Setup test environment
	testConfig := SetupNeoTestEnvironment(t)
	defer testConfig.TeardownNeoTestEnvironment(t)

	// Create a client
	client := testConfig.CreateClient(t)
	defer client.Close()

	// Get a recent block
	height, err := client.GetBlockHeight()
	require.NoError(t, err)

	block, err := client.GetBlock(height - 5) // Get a block from 5 blocks ago
	require.NoError(t, err)
	require.NotNil(t, block)

	// We need at least one transaction in the block for this test
	if len(block.Transactions) == 0 {
		t.Skip("Skipping test because the chosen block has no transactions")
	}

	// Get the first transaction from the block
	txHash := block.Transactions[0].Hash().StringLE()

	// Test GetTransaction
	tx, err := client.GetTransaction(txHash)
	require.NoError(t, err)
	assert.NotNil(t, tx)
	t.Logf("Transaction %s retrieved successfully", txHash)

	// Test transaction hash conversion
	assert.Equal(t, txHash, tx.Hash().StringLE())
}
