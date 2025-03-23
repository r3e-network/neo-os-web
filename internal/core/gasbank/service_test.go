package gasbank

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock GasBankRepository
type MockGasBankRepository struct {
	mock.Mock
}

func (m *MockGasBankRepository) CreateAccount(account *models.GasAccount) error {
	args := m.Called(account)
	return args.Error(0)
}

func (m *MockGasBankRepository) GetAccountByID(id int) (*models.GasAccount, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GasAccount), args.Error(1)
}

func (m *MockGasBankRepository) GetAccountByUserIDAndAddress(userID int, address string) (*models.GasAccount, error) {
	args := m.Called(userID, address)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GasAccount), args.Error(1)
}

func (m *MockGasBankRepository) GetAccountsByUserID(userID int) ([]*models.GasAccount, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.GasAccount), args.Error(1)
}

func (m *MockGasBankRepository) UpdateAccountBalance(id int, balance float64) error {
	args := m.Called(id, balance)
	return args.Error(0)
}

func (m *MockGasBankRepository) CreateTransaction(tx *models.GasBankTransaction) error {
	args := m.Called(tx)
	return args.Error(0)
}

func (m *MockGasBankRepository) GetTransactionByID(id int) (*models.GasBankTransaction, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GasBankTransaction), args.Error(1)
}

func (m *MockGasBankRepository) GetTransactionByTxHash(txHash string) (*models.GasBankTransaction, error) {
	args := m.Called(txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GasBankTransaction), args.Error(1)
}

func (m *MockGasBankRepository) ListTransactionsByUserID(userID int, offset, limit int) ([]*models.GasBankTransaction, error) {
	args := m.Called(userID, offset, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.GasBankTransaction), args.Error(1)
}

func (m *MockGasBankRepository) ListTransactionsByAccountID(accountID int, offset, limit int) ([]*models.GasBankTransaction, error) {
	args := m.Called(accountID, offset, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.GasBankTransaction), args.Error(1)
}

func (m *MockGasBankRepository) UpdateTransactionStatus(id int, status models.GasBankTransactionStatus) error {
	args := m.Called(id, status)
	return args.Error(0)
}

func (m *MockGasBankRepository) DepositGas(userID int, address string, amount float64, txHash string) (*models.GasBankTransaction, error) {
	args := m.Called(userID, address, amount, txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GasBankTransaction), args.Error(1)
}

func (m *MockGasBankRepository) WithdrawGas(userID int, address string, amount float64, txHash string) (*models.GasBankTransaction, error) {
	args := m.Called(userID, address, amount, txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GasBankTransaction), args.Error(1)
}

func (m *MockGasBankRepository) UseGas(userID int, address string, amount float64, txType models.GasBankTransactionType, relatedID int) (*models.GasBankTransaction, error) {
	args := m.Called(userID, address, amount, txType, relatedID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GasBankTransaction), args.Error(1)
}

// Mock BlockchainClient
type MockBlockchainClient struct {
	mock.Mock
}

func (m *MockBlockchainClient) GetBlockHeight() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockBlockchainClient) VerifyTransaction(txHash string) (bool, error) {
	args := m.Called(txHash)
	return args.Get(0).(bool), args.Error(1)
}

func (m *MockBlockchainClient) GetTransaction(txHash string) (map[string]interface{}, error) {
	args := m.Called(txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

func (m *MockBlockchainClient) SendTransaction(fromAddress, toAddress string, amount float64) (string, error) {
	args := m.Called(fromAddress, toAddress, amount)
	return args.Get(0).(string), args.Error(1)
}

// Helper function to setup test service
func setupTestService() (*Service, *MockGasBankRepository, *MockBlockchainClient) {
	cfg := &config.Config{}
	log := logger.NewNopLogger()
	mockRepo := new(MockGasBankRepository)
	mockBlockchainClient := new(MockBlockchainClient)

	service := NewService(cfg, log, mockRepo, mockBlockchainClient)

	return service, mockRepo, mockBlockchainClient
}

// TestDepositGas tests gas deposit functionality
func TestDepositGas(t *testing.T) {
	service, mockRepo, mockBlockchainClient := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mocks
		txData := map[string]interface{}{
			"from":   "senderAddress",
			"to":     "neo1address123",
			"amount": 10.0,
			"status": "confirmed",
		}
		mockBlockchainClient.On("GetTransaction", "0xabc123").Return(txData, nil).Once()
		mockBlockchainClient.On("VerifyTransaction", "0xabc123").Return(true, nil).Once()

		expectedTx := &models.GasBankTransaction{
			ID:        1,
			UserID:    2,
			AccountID: 3,
			Type:      models.GasBankTransactionTypeDeposit,
			Amount:    10.0,
			TxHash:    "0xabc123",
			Status:    models.GasBankTransactionStatusConfirmed,
			CreatedAt: time.Now(),
		}
		mockRepo.On("DepositGas", 2, "neo1address123", 10.0, "0xabc123").Return(expectedTx, nil).Once()

		// Call service
		tx, err := service.DepositGas(ctx, 2, "neo1address123", 10.0, "0xabc123")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedTx, tx)
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NegativeAmount", func(t *testing.T) {
		// Call service with negative amount
		tx, err := service.DepositGas(ctx, 2, "neo1address123", -10.0, "0xabc123")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "amount must be positive")

		// No transactions should be created
		mockRepo.AssertNotCalled(t, "DepositGas")
	})

	t.Run("InvalidAddress", func(t *testing.T) {
		// Call service with empty address
		tx, err := service.DepositGas(ctx, 2, "", 10.0, "0xabc123")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "valid address")

		// No transactions should be created
		mockRepo.AssertNotCalled(t, "DepositGas")
	})

	t.Run("VerificationFailed", func(t *testing.T) {
		// Setup mock
		mockBlockchainClient.On("VerifyTransaction", "0xabc123").Return(false, nil).Once()

		// Call service
		tx, err := service.DepositGas(ctx, 2, "neo1address123", 10.0, "0xabc123")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "verification failed")

		// No transactions should be created
		mockRepo.AssertNotCalled(t, "DepositGas")
	})

	t.Run("BlockchainError", func(t *testing.T) {
		// Setup mock
		mockBlockchainClient.On("VerifyTransaction", "0xabc123").Return(false, errors.New("blockchain error")).Once()

		// Call service
		tx, err := service.DepositGas(ctx, 2, "neo1address123", 10.0, "0xabc123")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "blockchain error")

		// No transactions should be created
		mockRepo.AssertNotCalled(t, "DepositGas")
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mocks
		txData := map[string]interface{}{
			"from":   "senderAddress",
			"to":     "neo1address123",
			"amount": 10.0,
			"status": "confirmed",
		}
		mockBlockchainClient.On("GetTransaction", "0xabc123").Return(txData, nil).Once()
		mockBlockchainClient.On("VerifyTransaction", "0xabc123").Return(true, nil).Once()
		mockRepo.On("DepositGas", 2, "neo1address123", 10.0, "0xabc123").Return(nil, errors.New("database error")).Once()

		// Call service
		tx, err := service.DepositGas(ctx, 2, "neo1address123", 10.0, "0xabc123")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "database error")
	})
}

// TestGetBalance tests getting account balance
func TestGetBalance(t *testing.T) {
	service, mockRepo, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		account := &models.GasAccount{
			ID:        1,
			UserID:    2,
			Address:   "neo1address123",
			Balance:   50.0,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address123").Return(account, nil).Once()

		// Call service
		balance, err := service.GetBalance(2, "neo1address123")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, 50.0, balance)
		mockRepo.AssertExpectations(t)
	})

	t.Run("AccountNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address456").Return(nil, nil).Once()

		// Call service
		balance, err := service.GetBalance(2, "neo1address456")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, 0.0, balance)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address123").Return(nil, errors.New("database error")).Once()

		// Call service
		balance, err := service.GetBalance(2, "neo1address123")

		// Assertions
		assert.Error(t, err)
		assert.Equal(t, 0.0, balance)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestWithdrawGas tests gas withdrawal functionality
func TestWithdrawGas(t *testing.T) {
	service, mockRepo, mockBlockchainClient := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mocks
		pendingTx := &models.GasBankTransaction{
			ID:        2,
			UserID:    2,
			AccountID: 3,
			Type:      models.GasBankTransactionTypeWithdraw,
			Amount:    10.0,
			Status:    models.GasBankTransactionStatusPending,
			CreatedAt: time.Now(),
		}
		mockRepo.On("WithdrawGas", 2, "neo1address123", 10.0, "").Return(pendingTx, nil).Once()
		mockBlockchainClient.On("SendTransaction", "neo1address123", "neo1destination456", 10.0).Return("0xdef456", nil).Once()
		mockRepo.On("UpdateTransactionStatus", 2, models.GasBankTransactionStatusPending).Return(nil).Once()

		// Call service
		tx, err := service.WithdrawGas(ctx, 2, "neo1address123", 10.0, "neo1destination456")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, pendingTx, tx)
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NegativeAmount", func(t *testing.T) {
		// Call service with negative amount
		tx, err := service.WithdrawGas(ctx, 2, "neo1address123", -10.0, "neo1destination456")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "amount must be positive")

		// No transactions should be created
		mockRepo.AssertNotCalled(t, "WithdrawGas")
	})

	t.Run("InvalidAddress", func(t *testing.T) {
		// Call service with empty address
		tx, err := service.WithdrawGas(ctx, 2, "", 10.0, "neo1destination456")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "valid address")

		// No transactions should be created
		mockRepo.AssertNotCalled(t, "WithdrawGas")
	})

	t.Run("InvalidDestinationAddress", func(t *testing.T) {
		// Call service with empty destination address
		tx, err := service.WithdrawGas(ctx, 2, "neo1address123", 10.0, "")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "valid destination address")

		// No transactions should be created
		mockRepo.AssertNotCalled(t, "WithdrawGas")
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("WithdrawGas", 2, "neo1address123", 10.0, "").Return(nil, errors.New("database error")).Once()

		// Call service
		tx, err := service.WithdrawGas(ctx, 2, "neo1address123", 10.0, "neo1destination456")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})

	t.Run("BlockchainError", func(t *testing.T) {
		// Setup mocks
		pendingTx := &models.GasBankTransaction{
			ID:        2,
			UserID:    2,
			AccountID: 3,
			Type:      models.GasBankTransactionTypeWithdraw,
			Amount:    10.0,
			Status:    models.GasBankTransactionStatusPending,
			CreatedAt: time.Now(),
		}
		mockRepo.On("WithdrawGas", 2, "neo1address123", 10.0, "").Return(pendingTx, nil).Once()
		mockBlockchainClient.On("SendTransaction", "neo1address123", "neo1destination456", 10.0).Return("", errors.New("blockchain error")).Once()
		mockRepo.On("UpdateTransactionStatus", 2, models.GasBankTransactionStatusFailed).Return(nil).Once()

		// Call service
		tx, err := service.WithdrawGas(ctx, 2, "neo1address123", 10.0, "neo1destination456")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, tx)
		assert.Contains(t, err.Error(), "blockchain error")
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetTransactions tests retrieving transactions for a user
func TestGetTransactions(t *testing.T) {
	service, mockRepo, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedTransactions := []*models.GasBankTransaction{
			{
				ID:        1,
				UserID:    2,
				AccountID: 3,
				Type:      models.GasBankTransactionTypeDeposit,
				Amount:    10.0,
				TxHash:    "0xabc123",
				Status:    models.GasBankTransactionStatusConfirmed,
				CreatedAt: time.Now().Add(-1 * time.Hour),
			},
			{
				ID:        2,
				UserID:    2,
				AccountID: 3,
				Type:      models.GasBankTransactionTypeWithdraw,
				Amount:    5.0,
				TxHash:    "0xdef456",
				Status:    models.GasBankTransactionStatusPending,
				CreatedAt: time.Now(),
			},
		}
		mockRepo.On("ListTransactionsByUserID", 2, 0, 10).Return(expectedTransactions, nil).Once()

		// Call service
		transactions, err := service.GetTransactions(2, 1, 10)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedTransactions, transactions)
		mockRepo.AssertExpectations(t)
	})

	t.Run("EmptyList", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListTransactionsByUserID", 3, 0, 10).Return([]*models.GasBankTransaction{}, nil).Once()

		// Call service
		transactions, err := service.GetTransactions(3, 1, 10)

		// Assertions
		require.NoError(t, err)
		assert.Empty(t, transactions)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListTransactionsByUserID", 2, 0, 10).Return(nil, errors.New("database error")).Once()

		// Call service
		transactions, err := service.GetTransactions(2, 1, 10)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, transactions)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestGetAccount tests retrieving a gas account
func TestGetAccount(t *testing.T) {
	service, mockRepo, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedAccount := &models.GasAccount{
			ID:        1,
			UserID:    2,
			Address:   "neo1address123",
			Balance:   50.0,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address123").Return(expectedAccount, nil).Once()

		// Call service
		account, err := service.GetAccount(2, "neo1address123")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedAccount, account)
		mockRepo.AssertExpectations(t)
	})

	t.Run("AccountNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address456").Return(nil, nil).Once()

		// Call service
		account, err := service.GetAccount(2, "neo1address456")

		// Assertions
		require.NoError(t, err)
		assert.Nil(t, account)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address123").Return(nil, errors.New("database error")).Once()

		// Call service
		account, err := service.GetAccount(2, "neo1address123")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, account)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestGetAccounts tests retrieving all gas accounts for a user
func TestGetAccounts(t *testing.T) {
	service, mockRepo, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedAccounts := []*models.GasAccount{
			{
				ID:        1,
				UserID:    2,
				Address:   "neo1address123",
				Balance:   50.0,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			{
				ID:        2,
				UserID:    2,
				Address:   "neo1address456",
				Balance:   25.0,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		}
		mockRepo.On("GetAccountsByUserID", 2).Return(expectedAccounts, nil).Once()

		// Call service
		accounts, err := service.GetAccounts(2)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedAccounts, accounts)
		mockRepo.AssertExpectations(t)
	})

	t.Run("EmptyList", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountsByUserID", 3).Return([]*models.GasAccount{}, nil).Once()

		// Call service
		accounts, err := service.GetAccounts(3)

		// Assertions
		require.NoError(t, err)
		assert.Empty(t, accounts)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountsByUserID", 2).Return(nil, errors.New("database error")).Once()

		// Call service
		accounts, err := service.GetAccounts(2)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, accounts)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestGetAccountTransactions tests retrieving transactions for an account
func TestGetAccountTransactions(t *testing.T) {
	service, mockRepo, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		account := &models.GasAccount{
			ID:        1,
			UserID:    2,
			Address:   "neo1address123",
			Balance:   50.0,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address123").Return(account, nil).Once()

		expectedTransactions := []*models.GasBankTransaction{
			{
				ID:        1,
				UserID:    2,
				AccountID: 1,
				Type:      models.GasBankTransactionTypeDeposit,
				Amount:    10.0,
				TxHash:    "0xabc123",
				Status:    models.GasBankTransactionStatusConfirmed,
				CreatedAt: time.Now().Add(-1 * time.Hour),
			},
			{
				ID:        2,
				UserID:    2,
				AccountID: 1,
				Type:      models.GasBankTransactionTypeWithdraw,
				Amount:    5.0,
				TxHash:    "0xdef456",
				Status:    models.GasBankTransactionStatusPending,
				CreatedAt: time.Now(),
			},
		}
		mockRepo.On("ListTransactionsByAccountID", 1, 0, 10).Return(expectedTransactions, nil).Once()

		// Call service
		transactions, err := service.GetAccountTransactions(2, "neo1address123", 1, 10)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedTransactions, transactions)
		mockRepo.AssertExpectations(t)
	})

	t.Run("AccountNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address456").Return(nil, nil).Once()

		// Call service
		transactions, err := service.GetAccountTransactions(2, "neo1address456", 1, 10)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, transactions)
		assert.Contains(t, err.Error(), "account not found")
		mockRepo.AssertExpectations(t)
	})

	t.Run("AccountFetchError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address123").Return(nil, errors.New("database error")).Once()

		// Call service
		transactions, err := service.GetAccountTransactions(2, "neo1address123", 1, 10)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, transactions)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})

	t.Run("TransactionsFetchError", func(t *testing.T) {
		// Setup mock
		account := &models.GasAccount{
			ID:        1,
			UserID:    2,
			Address:   "neo1address123",
			Balance:   50.0,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		mockRepo.On("GetAccountByUserIDAndAddress", 2, "neo1address123").Return(account, nil).Once()
		mockRepo.On("ListTransactionsByAccountID", 1, 0, 10).Return(nil, errors.New("database error")).Once()

		// Call service
		transactions, err := service.GetAccountTransactions(2, "neo1address123", 1, 10)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, transactions)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestGasBankService tests the gas bank service with the mock blockchain client
func TestGasBankService(t *testing.T) {
	// Skip the test if in short mode
	if testing.Short() {
		t.Skip("Skipping gas bank service test in short mode")
	}

	// Set up the mock blockchain client
	client, cleanup := blockchain.SetupTestBlockchain(t)
	defer cleanup()

	// Set up the mock gas bank repository
	repo := NewMockGasBankRepository()

	// Create a minimal config
	cfg := &config.Config{
		Services: config.ServicesConfig{
			GasBank: config.GasBankConfig{
				MinDeposit:    1.0,
				MaxWithdrawal: 100.0,
				GasReserve:    10.0,
			},
		},
	}

	// Create the gas bank service
	service := NewService(cfg, nil, repo, client)

	// Test user data
	testUserID := 1
	testAddress := "NXGTSpLFfp85KiycNxNLqkqq2dampAcb1L"

	// Test creating an account
	ctx := context.Background()
	account, err := service.CreateAccount(ctx, testUserID, testAddress)
	require.NoError(t, err)
	assert.Equal(t, testUserID, account.UserID)
	assert.Equal(t, testAddress, account.Address)
	assert.Equal(t, 0.0, account.Balance)

	// Test getting account by ID
	fetchedAccount, err := service.GetAccount(ctx, account.ID)
	require.NoError(t, err)
	assert.Equal(t, account.ID, fetchedAccount.ID)
	assert.Equal(t, testAddress, fetchedAccount.Address)

	// Test depositing gas
	depositAmount := 50.0
	tx, err := service.DepositGas(ctx, testUserID, testAddress, depositAmount)
	require.NoError(t, err)
	assert.Equal(t, models.GasBankTransactionTypeDeposit, tx.Type)
	assert.Equal(t, depositAmount, tx.Amount)

	// Verify account balance was updated
	updatedAccount, err := service.GetAccount(ctx, account.ID)
	require.NoError(t, err)
	assert.Equal(t, depositAmount, updatedAccount.Balance)

	// Test withdrawing gas
	withdrawAmount := 20.0
	tx, err = service.WithdrawGas(ctx, testUserID, testAddress, withdrawAmount)
	require.NoError(t, err)
	assert.Equal(t, models.GasBankTransactionTypeWithdraw, tx.Type)
	assert.Equal(t, withdrawAmount, tx.Amount)

	// Verify account balance was updated
	updatedAccount, err = service.GetAccount(ctx, account.ID)
	require.NoError(t, err)
	assert.Equal(t, depositAmount-withdrawAmount, updatedAccount.Balance)

	// Test using gas for a function
	useAmount := 5.0
	tx, err = service.UseGas(ctx, testUserID, testAddress, useAmount, models.GasBankTransactionTypeFunction)
	require.NoError(t, err)
	assert.Equal(t, models.GasBankTransactionTypeFunction, tx.Type)
	assert.Equal(t, useAmount, tx.Amount)

	// Verify account balance was updated
	updatedAccount, err = service.GetAccount(ctx, account.ID)
	require.NoError(t, err)
	assert.Equal(t, depositAmount-withdrawAmount-useAmount, updatedAccount.Balance)

	// Test getting transactions for account
	transactions, err := service.GetTransactions(ctx, testUserID, 0, 10)
	require.NoError(t, err)
	assert.Len(t, transactions, 3) // deposit, withdraw, use
}
