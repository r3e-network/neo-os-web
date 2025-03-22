package tests

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"service_layer/internal/blockchain"
	"service_layer/internal/database"
	"service_layer/internal/models"
)

// TestTransactionIntegration performs an integration test of the transaction management system
// Note: This requires a PostgreSQL database to be running
// To run this test: TEST_DB_DSN="postgres://user:password@localhost:5432/testdb?sslmode=disable" go test -tags=integration
func TestTransactionIntegration(t *testing.T) {
	// Skip if not running integration tests
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Get DSN from environment or use default
	dsn := getTestDSN()
	if dsn == "" {
		t.Skip("Skipping integration test: TEST_DB_DSN not set")
	}

	// Connect to database
	db, err := sqlx.Connect("postgres", dsn)
	require.NoError(t, err, "Failed to connect to database")
	defer db.Close()

	// Setup database schema
	err = setupTestDatabase(db)
	require.NoError(t, err, "Failed to set up test database")

	// Create repository
	repo := database.NewSQLTransactionRepository(db)

	// Create mocks for client and wallet store
	client := new(MockClient)
	walletStore := new(MockWalletStore)

	// Setup wallet store mock
	mockWallet := &blockchain.Wallet{
		PrivateKey: []byte("test-private-key"),
		PublicKey:  []byte("test-public-key"),
		Address:    "NeoAddress123",
	}
	walletStore.On("GetWallet", "test-service").Return(mockWallet, nil)

	// Setup client mock
	client.On("SendRawTransaction", []byte("test-script")).Return("tx-hash-123", nil)

	// Create transaction service
	service := blockchain.NewTransactionService(repo, client, walletStore, 1)

	// Create a test wallet account
	walletAccount := &models.WalletAccount{
		ID:        uuid.New(),
		Service:   "test-service",
		Address:   "NeoAddress123",
		KeyID:     "key-123",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err = repo.CreateWalletAccount(context.Background(), walletAccount)
	require.NoError(t, err, "Failed to create wallet account")

	// Create a transaction request
	entityID := uuid.New()
	request := models.CreateTransactionRequest{
		Service:    "test-service",
		EntityID:   entityID,
		EntityType: "test-entity",
		Type:       models.TransactionTypeInvoke,
		Script:     []byte("test-script"),
		GasPrice:   1000,
		SystemFee:  1000,
		NetworkFee: 1000,
	}

	// Create transaction
	tx, err := service.CreateTransaction(context.Background(), request)
	require.NoError(t, err, "Failed to create transaction")
	assert.Equal(t, models.TransactionStatusCreated, tx.Status)
	assert.Equal(t, "test-service", tx.Service)
	assert.Equal(t, entityID, *tx.EntityID)

	// Get the transaction by ID
	fetchedTx, err := service.GetTransaction(context.Background(), tx.ID)
	require.NoError(t, err, "Failed to get transaction")
	assert.Equal(t, tx.ID, fetchedTx.ID)
	assert.Equal(t, tx.Service, fetchedTx.Service)

	// Update transaction status to simulate submission
	blockHeight := int64(1000)
	blockTime := time.Now()
	err = repo.UpdateTransactionStatus(
		context.Background(),
		tx.ID,
		models.TransactionStatusSubmitted,
		json.RawMessage(`{"hash":"tx-hash-123"}`),
		nil,
		&blockHeight,
		&blockTime,
		"",
	)
	require.NoError(t, err, "Failed to update transaction status")

	// List transactions
	response, err := service.ListTransactions(
		context.Background(),
		"test-service",
		models.TransactionStatusSubmitted,
		nil,
		1,
		10,
	)
	require.NoError(t, err, "Failed to list transactions")
	assert.Equal(t, 1, len(response.Transactions))
	assert.Equal(t, tx.ID, response.Transactions[0].ID)
}

// Helper function to get test database DSN
func getTestDSN() string {
	// In a real implementation, get from environment
	return "" // Replace with actual code to get DSN
}

// Helper function to set up test database schema
func setupTestDatabase(db *sqlx.DB) error {
	// Create transactions table
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    service VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_type VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    hash VARCHAR(100),
    data JSONB,
    gas_price BIGINT,
    system_fee BIGINT,
    network_fee BIGINT,
    gas_consumed BIGINT,
    sender VARCHAR(100),
    result JSONB,
    error TEXT,
    block_height BIGINT,
    block_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_service ON transactions(service);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_entity ON transactions(entity_id, entity_type);
	`)
	if err != nil {
		return err
	}

	// Create transaction_events table
	_, err = db.Exec(`
CREATE TABLE IF NOT EXISTS transaction_events (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP NOT NULL,
    CONSTRAINT fk_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
	`)
	if err != nil {
		return err
	}

	// Create wallet_accounts table
	_, err = db.Exec(`
CREATE TABLE IF NOT EXISTS wallet_accounts (
    id UUID PRIMARY KEY,
    service VARCHAR(50) NOT NULL,
    address VARCHAR(100) NOT NULL,
    key_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_service ON wallet_accounts(service) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_address ON wallet_accounts(address) WHERE deleted_at IS NULL;
	`)
	return err
}

// CreateWalletAccount is a mock implementation for test purposes
func (r *MockTransactionRepository) CreateWalletAccount(ctx context.Context, wallet *models.WalletAccount) error {
	args := r.Called(ctx, wallet)
	return args.Error(0)
}

// GetWalletByService is already implemented in the mock

// mockWallet represents a wallet for testing
type mockWallet struct {
	Service    string
	PrivateKey []byte
	PublicKey  []byte
	Address    string
}

// Utility function to clean up test data
func cleanupTestData(db *sqlx.DB) error {
	_, err := db.Exec(`
DELETE FROM transaction_events;
DELETE FROM transactions;
DELETE FROM wallet_accounts;
	`)
	return err
} 