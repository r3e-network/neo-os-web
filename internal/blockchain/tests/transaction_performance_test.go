package tests

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	github.com/R3E-Network/service_layerinternal/blockchain"
	github.com/R3E-Network/service_layerinternal/models"
)

// BenchmarkTransactionCreation benchmarks the creation of transactions
func BenchmarkTransactionCreation(b *testing.B) {
	// Create mocks
	mockRepo := new(MockTransactionRepository)
	mockClient := new(MockClient)
	mockWalletStore := new(MockWalletStore)
	
	// Setup GetWalletByService
	wallet := &models.WalletAccount{
		ID:        uuid.New(),
		Service:   "test-service",
		Address:   "NeoAddress123",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	mockRepo.On("GetWalletByService", mock.Anything, "test-service").Return(wallet, nil)
	
	// Setup CreateTransaction
	mockRepo.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*models.Transaction")).Return(nil)
	
	// Setup AddTransactionEvent
	mockRepo.On("AddTransactionEvent", mock.Anything, mock.AnythingOfType("*models.TransactionEvent")).Return(nil)
	
	// Create transaction service
	service := blockchain.NewTransactionService(mockRepo, mockClient, mockWalletStore, 1)
	
	// Create a common request template
	entityID := uuid.New()
	requestTemplate := models.CreateTransactionRequest{
		Service:    "test-service",
		EntityID:   entityID,
		EntityType: "test-entity",
		Type:       models.TransactionTypeInvoke,
		Script:     []byte("test-script"),
		GasPrice:   1000,
		SystemFee:  1000,
		NetworkFee: 1000,
	}
	
	// Reset the timer to exclude setup time
	b.ResetTimer()
	
	// Run the benchmark
	for i := 0; i < b.N; i++ {
		// Create a new request for each iteration (to avoid ID conflicts)
		request := requestTemplate
		request.EntityID = uuid.New()
		
		_, err := service.CreateTransaction(context.Background(), request)
		if err != nil {
			b.Fatalf("Error creating transaction: %v", err)
		}
	}
}

// TestConcurrentTransactionProcessing tests the system's behavior under concurrent load
func TestConcurrentTransactionProcessing(t *testing.T) {
	// Skip if not running performance tests
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}
	
	// Create mocks
	mockRepo := new(MockTransactionRepository)
	mockClient := new(MockClient)
	mockWalletStore := new(MockWalletStore)
	
	// Setup wallet
	wallet := &models.WalletAccount{
		ID:        uuid.New(),
		Service:   "test-service",
		Address:   "NeoAddress123",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Mock methods with appropriate concurrency handling
	var mu sync.Mutex
	mockRepo.On("GetWalletByService", mock.Anything, "test-service").Return(wallet, nil)
	mockRepo.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*models.Transaction")).Run(func(args mock.Arguments) {
		mu.Lock()
		defer mu.Unlock()
		// Simulate some processing work
		time.Sleep(5 * time.Millisecond)
	}).Return(nil)
	mockRepo.On("AddTransactionEvent", mock.Anything, mock.AnythingOfType("*models.TransactionEvent")).Return(nil)
	
	// Setup wallet store mock
	mockWallet := &blockchain.Wallet{
		PrivateKey: []byte("test-private-key"),
		PublicKey:  []byte("test-public-key"),
		Address:    "NeoAddress123",
	}
	mockWalletStore.On("GetWallet", "test-service").Return(mockWallet, nil)
	
	// Setup client mock
	mockClient.On("SendRawTransaction", mock.Anything).Return("tx-hash-123", nil)
	
	// Create transaction service
	service := blockchain.NewTransactionService(mockRepo, mockClient, mockWalletStore, 1)
	
	// Parameters for the test
	concurrency := 50      // Number of concurrent requests
	transactionsPerGoroutine := 10 // Number of transactions per goroutine
	
	// Create a wait group to synchronize goroutines
	var wg sync.WaitGroup
	wg.Add(concurrency)
	
	// Record start time
	startTime := time.Now()
	
	// Create transactions concurrently
	for i := 0; i < concurrency; i++ {
		go func(workerID int) {
			defer wg.Done()
			
			for j := 0; j < transactionsPerGoroutine; j++ {
				// Create a transaction request
				request := models.CreateTransactionRequest{
					Service:    "test-service",
					EntityID:   uuid.New(),
					EntityType: "test-entity",
					Type:       models.TransactionTypeInvoke,
					Script:     []byte("test-script"),
					GasPrice:   1000,
					SystemFee:  1000,
					NetworkFee: 1000,
				}
				
				// Create the transaction
				tx, err := service.CreateTransaction(context.Background(), request)
				require.NoError(t, err, "Worker %d, Tx %d: Failed to create transaction", workerID, j)
				assert.NotNil(t, tx, "Worker %d, Tx %d: Transaction should not be nil", workerID, j)
			}
		}(i)
	}
	
	// Wait for all goroutines to complete
	wg.Wait()
	
	// Calculate performance metrics
	elapsedTime := time.Since(startTime)
	totalTransactions := concurrency * transactionsPerGoroutine
	transactionsPerSecond := float64(totalTransactions) / elapsedTime.Seconds()
	
	// Log performance metrics
	t.Logf("Concurrent Transaction Processing Results:")
	t.Logf("  Total Transactions: %d", totalTransactions)
	t.Logf("  Concurrency Level: %d", concurrency)
	t.Logf("  Elapsed Time: %v", elapsedTime)
	t.Logf("  Transactions per Second: %.2f", transactionsPerSecond)
	
	// Verify expectations (this ensures all mock methods were called)
	mockRepo.AssertExpectations(t)
	mockClient.AssertExpectations(t)
	mockWalletStore.AssertExpectations(t)
}

// TestTransactionSubmissionLatency measures the latency of transaction submission
func TestTransactionSubmissionLatency(t *testing.T) {
	// Skip if not running performance tests
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}
	
	// Create mocks
	mockRepo := new(MockTransactionRepository)
	mockClient := new(MockClient)
	mockWalletStore := new(MockWalletStore)
	
	// Setup wallet
	wallet := &models.WalletAccount{
		ID:        uuid.New(),
		Service:   "test-service",
		Address:   "NeoAddress123",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	mockRepo.On("GetWalletByService", mock.Anything, "test-service").Return(wallet, nil)
	mockRepo.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*models.Transaction")).Return(nil)
	mockRepo.On("AddTransactionEvent", mock.Anything, mock.AnythingOfType("*models.TransactionEvent")).Return(nil)
	mockRepo.On("GetTransactionByID", mock.Anything, mock.AnythingOfType("uuid.UUID")).Return(
		&models.Transaction{
			ID:      uuid.New(),
			Service: "test-service",
			Status:  models.TransactionStatusSubmitted,
			Hash:    "tx-hash-123",
		}, nil)
	mockRepo.On("UpdateTransactionStatus", mock.Anything, mock.AnythingOfType("uuid.UUID"), 
		mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
	
	// Setup wallet store mock with controlled latency
	mockWallet := &blockchain.Wallet{
		PrivateKey: []byte("test-private-key"),
		PublicKey:  []byte("test-public-key"),
		Address:    "NeoAddress123",
	}
	mockWalletStore.On("GetWallet", "test-service").Run(func(args mock.Arguments) {
		// Simulate key retrieval latency
		time.Sleep(5 * time.Millisecond)
	}).Return(mockWallet, nil)
	
	// Setup client mock with controlled latency
	mockClient.On("SendRawTransaction", mock.Anything).Run(func(args mock.Arguments) {
		// Simulate network latency
		time.Sleep(10 * time.Millisecond)
	}).Return("tx-hash-123", nil)
	
	// Create transaction service
	service := blockchain.NewTransactionService(mockRepo, mockClient, mockWalletStore, 1)
	
	// Create transaction requests
	numTransactions := 100
	latencies := make([]time.Duration, numTransactions)
	
	// Measure latency for each transaction
	for i := 0; i < numTransactions; i++ {
		request := models.CreateTransactionRequest{
			Service:    "test-service",
			EntityID:   uuid.New(),
			EntityType: "test-entity",
			Type:       models.TransactionTypeInvoke,
			Script:     []byte("test-script"),
			GasPrice:   1000,
			SystemFee:  1000,
			NetworkFee: 1000,
		}
		
		startTime := time.Now()
		tx, err := service.CreateTransaction(context.Background(), request)
		require.NoError(t, err, "Failed to create transaction %d", i)
		assert.NotNil(t, tx, "Transaction %d should not be nil", i)
		latencies[i] = time.Since(startTime)
	}
	
	// Calculate statistics
	var totalLatency time.Duration
	var minLatency = latencies[0]
	var maxLatency = latencies[0]
	
	for _, latency := range latencies {
		totalLatency += latency
		if latency < minLatency {
			minLatency = latency
		}
		if latency > maxLatency {
			maxLatency = latency
		}
	}
	
	avgLatency := totalLatency / time.Duration(numTransactions)
	
	// Log performance metrics
	t.Logf("Transaction Submission Latency Results:")
	t.Logf("  Total Transactions: %d", numTransactions)
	t.Logf("  Average Latency: %v", avgLatency)
	t.Logf("  Minimum Latency: %v", minLatency)
	t.Logf("  Maximum Latency: %v", maxLatency)
	
	// Verify mock expectations
	mockRepo.AssertExpectations(t)
	mockClient.AssertExpectations(t)
	mockWalletStore.AssertExpectations(t)
} 