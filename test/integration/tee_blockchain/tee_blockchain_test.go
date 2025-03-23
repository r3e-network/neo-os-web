// Package tee_blockchain_test provides integration tests for TEE and blockchain services.
package tee_blockchain_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/blockchain/mock"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/repository"
	"github.com/R3E-Network/service_layer/internal/secrets"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/models"
)

var (
	secretManager secrets.Manager
	teeRuntime    tee.Runtime
	blockClient   blockchain.Client
	functionRepo  repository.FunctionRepository
)

// TestMain sets up the test environment
func TestMain(m *testing.M) {
	// Setup test environment
	setupTestEnvironment()

	// Run the tests
	code := m.Run()

	// Cleanup
	cleanupTestEnvironment()

	os.Exit(code)
}

// setupTestEnvironment initializes the dependencies for the tests
func setupTestEnvironment() {
	// Initialize config
	cfg := config.NewDefaultConfig()
	cfg.TEE.MemoryLimit = 128 // MB
	cfg.TEE.TimeoutSec = 5    // seconds

	// Initialize repositories with in-memory implementation
	repos := repository.NewInMemoryRepositories()
	functionRepo = repos.FunctionRepository

	// Initialize mock blockchain client
	blockClient = mock.NewMockBlockchainClient()

	// Initialize secret manager with in-memory implementation
	secretManager = secrets.NewInMemorySecretManager()

	// Initialize TEE runtime
	teeRuntime = tee.NewV8Runtime(cfg.TEE, secretManager)
}

// cleanupTestEnvironment cleans up resources after tests
func cleanupTestEnvironment() {
	// Nothing to clean up with in-memory implementations
}

// TestFunctionExecutionWithBlockchainInteraction tests function execution with blockchain interaction
func TestFunctionExecutionWithBlockchainInteraction(t *testing.T) {
	// Create a function that interacts with the blockchain
	functionID := "test-function-blockchain"
	functionCode := `
		async function run(args) {
			// Get blockchain information
			const blockHeight = await neo.getBlockCount();
			
			// Call a smart contract
			const scriptHash = "0x1234567890abcdef1234567890abcdef12345678";
			const operation = "balanceOf";
			const params = [neo.utils.addressToScriptHash(args.address)];
			const result = await neo.invokeFunction(scriptHash, operation, params);
			
			return {
				blockHeight: blockHeight,
				balance: result.stack[0].value
			};
		}
	`

	// Create and save the function
	err := functionRepo.SaveFunction(context.Background(), &models.Function{
		ID:        functionID,
		Code:      functionCode,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Owner:     "test-user",
		Status:    models.FunctionStatusActive,
	})
	require.NoError(t, err)

	// Set up mock blockchain responses
	mockClient, ok := blockClient.(*mock.MockBlockchainClient)
	require.True(t, ok)

	// Mock the block height call
	mockClient.SetBlockCount(12345)

	// Mock the contract call response
	mockClient.SetInvokeFunctionResponse("0x1234567890abcdef1234567890abcdef12345678", "balanceOf", []interface{}{
		map[string]interface{}{
			"type":  "Integer",
			"value": "1000000000",
		},
	})

	// Execute the function
	ctx := context.Background()
	executionContext := &tee.ExecutionContext{
		FunctionID:       functionID,
		Args:             map[string]interface{}{"address": "NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj"},
		Secrets:          map[string]string{},
		BlockchainClient: blockClient,
	}

	// Get the function from repository
	function, err := functionRepo.GetFunction(ctx, functionID)
	require.NoError(t, err)

	// Execute the function
	result, err := teeRuntime.ExecuteFunction(ctx, function.Code, executionContext)
	require.NoError(t, err)

	// Parse the result
	var parsedResult map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsedResult)
	require.NoError(t, err)

	// Verify results
	assert.Equal(t, float64(12345), parsedResult["blockHeight"])
	assert.Equal(t, "1000000000", parsedResult["balance"])
}

// TestSecretAccessInFunction tests accessing secrets within a function that uses blockchain
func TestSecretAccessInFunction(t *testing.T) {
	// Create a function that accesses secrets and blockchain
	functionID := "test-function-with-secrets"
	functionCode := `
		async function run(args) {
			// Access secret
			const privateKey = secrets.privateKey;
			if (!privateKey) {
				throw new Error("Private key not found");
			}
			
			// Use the private key for a blockchain operation
			const tx = await neo.createTransaction({
				scriptHash: "0x1234567890abcdef1234567890abcdef12345678",
				operation: "transfer",
				params: [
					neo.utils.addressToScriptHash("NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj"),
					neo.utils.addressToScriptHash(args.targetAddress),
					args.amount
				],
				signers: [
					{
						account: neo.utils.getSigningAccount(privateKey),
						scopes: "CalledByEntry"
					}
				]
			});
			
			// Sign the transaction
			const signedTx = await neo.signTransaction(tx, privateKey);
			
			// Send the transaction
			const txid = await neo.sendTransaction(signedTx);
			
			return {
				success: true,
				txid: txid
			};
		}
	`

	// Create and save the function
	err := functionRepo.SaveFunction(context.Background(), &models.Function{
		ID:        functionID,
		Code:      functionCode,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Owner:     "test-user",
		Status:    models.FunctionStatusActive,
	})
	require.NoError(t, err)

	// Store the secret in the secret manager
	secretID := "test-user-privateKey"
	secretValue := "REDACTED_SECRET_PURGED_FROM_HISTORY"
	err = secretManager.SaveSecret(context.Background(), "test-user", "privateKey", secretValue)
	require.NoError(t, err)

	// Set up mock blockchain responses
	mockClient, ok := blockClient.(*mock.MockBlockchainClient)
	require.True(t, ok)

	// Mock the transaction creation
	mockTxID := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	mockClient.SetSendTransactionResponse(mockTxID)

	// Execute the function
	ctx := context.Background()
	executionContext := &tee.ExecutionContext{
		FunctionID:       functionID,
		Args:             map[string]interface{}{"targetAddress": "NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj", "amount": 100},
		Secrets:          map[string]string{"privateKey": secretValue},
		BlockchainClient: blockClient,
	}

	// Get the function from repository
	function, err := functionRepo.GetFunction(ctx, functionID)
	require.NoError(t, err)

	// Execute the function
	result, err := teeRuntime.ExecuteFunction(ctx, function.Code, executionContext)
	require.NoError(t, err)

	// Parse the result
	var parsedResult map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsedResult)
	require.NoError(t, err)

	// Verify results
	assert.Equal(t, true, parsedResult["success"])
	assert.Equal(t, mockTxID, parsedResult["txid"])
}

// TestFunctionTimeout tests that functions using blockchain operations time out properly
func TestFunctionTimeout(t *testing.T) {
	// Create a function with an infinite loop
	functionID := "test-function-timeout"
	functionCode := `
		async function run(args) {
			// Start blockchain operation that will never resolve
			const promise = neo.getBlockCount();
			
			// Create an infinite loop
			while(true) {
				// Just waste time
				for(let i = 0; i < 1000000; i++) {}
			}
			
			return { success: true };
		}
	`

	// Create and save the function
	err := functionRepo.SaveFunction(context.Background(), &models.Function{
		ID:        functionID,
		Code:      functionCode,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Owner:     "test-user",
		Status:    models.FunctionStatusActive,
	})
	require.NoError(t, err)

	// Set up mock blockchain responses with a delay
	mockClient, ok := blockClient.(*mock.MockBlockchainClient)
	require.True(t, ok)
	mockClient.SetBlockCountDelay(10 * time.Second) // Delay longer than the timeout

	// Execute the function
	ctx := context.Background()
	executionContext := &tee.ExecutionContext{
		FunctionID:       functionID,
		Args:             map[string]interface{}{},
		Secrets:          map[string]string{},
		BlockchainClient: blockClient,
	}

	// Get the function from repository
	function, err := functionRepo.GetFunction(ctx, functionID)
	require.NoError(t, err)

	// Execute the function with timeout
	_, err = teeRuntime.ExecuteFunction(ctx, function.Code, executionContext)

	// Verify the error is a timeout error
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timeout")
}

// TestMemoryLimit tests that functions using blockchain operations respect memory limits
func TestMemoryLimit(t *testing.T) {
	// Create a function that allocates a lot of memory
	functionID := "test-function-memory-limit"
	functionCode := `
		async function run(args) {
			// First make a blockchain call
			const blockHeight = await neo.getBlockCount();
			
			// Then allocate a lot of memory
			const arrays = [];
			for(let i = 0; i < 1000; i++) {
				arrays.push(new Array(1024 * 1024).fill(0)); // Allocate 1MB per array
			}
			
			return { success: true, blockHeight: blockHeight };
		}
	`

	// Create and save the function
	err := functionRepo.SaveFunction(context.Background(), &models.Function{
		ID:        functionID,
		Code:      functionCode,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Owner:     "test-user",
		Status:    models.FunctionStatusActive,
	})
	require.NoError(t, err)

	// Set up mock blockchain responses
	mockClient, ok := blockClient.(*mock.MockBlockchainClient)
	require.True(t, ok)
	mockClient.SetBlockCount(12345)

	// Execute the function
	ctx := context.Background()
	executionContext := &tee.ExecutionContext{
		FunctionID:       functionID,
		Args:             map[string]interface{}{},
		Secrets:          map[string]string{},
		BlockchainClient: blockClient,
	}

	// Get the function from repository
	function, err := functionRepo.GetFunction(ctx, functionID)
	require.NoError(t, err)

	// Execute the function with memory limit
	_, err = teeRuntime.ExecuteFunction(ctx, function.Code, executionContext)

	// Verify the error is a memory limit error
	require.Error(t, err)
	assert.Contains(t, err.Error(), "memory limit exceeded")
}
