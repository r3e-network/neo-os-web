package tests

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/models"
)

// MockTransactionRepository is a mock implementation of the TransactionRepository interface
type MockTransactionRepository struct {
	mock.Mock
}

func (m *MockTransactionRepository) CreateTransaction(ctx context.Context, tx *models.Transaction) error {
	args := m.Called(ctx, tx)
	return args.Error(0)
}

func (m *MockTransactionRepository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Transaction), args.Error(1)
}

func (m *MockTransactionRepository) GetTransactionByHash(ctx context.Context, hash string) (*models.Transaction, error) {
	args := m.Called(ctx, hash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Transaction), args.Error(1)
}

func (m *MockTransactionRepository) UpdateTransactionStatus(
	ctx context.Context,
	id uuid.UUID,
	status models.TransactionStatus,
	result json.RawMessage,
	gasConsumed *int64,
	blockHeight *int64,
	blockTime *time.Time,
	errMsg string,
) error {
	args := m.Called(ctx, id, status, result, gasConsumed, blockHeight, blockTime, errMsg)
	return args.Error(0)
}

func (m *MockTransactionRepository) ListTransactions(
	ctx context.Context,
	service string,
	status models.TransactionStatus,
	entityID *uuid.UUID,
	page, limit int,
) (*models.TransactionListResponse, error) {
	args := m.Called(ctx, service, status, entityID, page, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TransactionListResponse), args.Error(1)
}

func (m *MockTransactionRepository) AddTransactionEvent(ctx context.Context, event *models.TransactionEvent) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockTransactionRepository) GetTransactionEvents(ctx context.Context, transactionID uuid.UUID) ([]models.TransactionEvent, error) {
	args := m.Called(ctx, transactionID)
	return args.Get(0).([]models.TransactionEvent), args.Error(1)
}

func (m *MockTransactionRepository) DeleteTransaction(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockTransactionRepository) GetWalletByService(ctx context.Context, service string) (*models.WalletAccount, error) {
	args := m.Called(ctx, service)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.WalletAccount), args.Error(1)
}

// MockClient is a mock implementation of the Neo N3 blockchain client
type MockClient struct {
	mock.Mock
}

func (m *MockClient) SendRawTransaction(txBytes []byte) (string, error) {
	args := m.Called(txBytes)
	return args.String(0), args.Error(1)
}

// MockWalletStore is a mock implementation of the WalletStore
type MockWalletStore struct {
	mock.Mock
}

func (m *MockWalletStore) GetWallet(service string) (*blockchain.Wallet, error) {
	args := m.Called(service)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*blockchain.Wallet), args.Error(1)
}

// TestCreateTransaction tests the CreateTransaction method
func TestCreateTransaction(t *testing.T) {
	// Test cases
	testCases := []struct {
		name           string
		request        models.CreateTransactionRequest
		setupMocks     func(*MockTransactionRepository, *MockClient, *MockWalletStore)
		expectedError  bool
		expectedStatus models.TransactionStatus
	}{
		{
			name: "Success",
			request: models.CreateTransactionRequest{
				Service:    "oracle",
				EntityID:   uuid.New(),
				EntityType: "oracle_request",
				Type:       models.TransactionTypeInvoke,
				Script:     []byte("test script"),
				GasPrice:   1000,
				SystemFee:  1000,
				NetworkFee: 1000,
			},
			setupMocks: func(repo *MockTransactionRepository, client *MockClient, walletStore *MockWalletStore) {
				// Setup GetWalletByService
				wallet := &models.WalletAccount{
					ID:        uuid.New(),
					Service:   "oracle",
					Address:   "NeoAddress123",
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				repo.On("GetWalletByService", mock.Anything, "oracle").Return(wallet, nil)

				// Setup CreateTransaction
				repo.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*models.Transaction")).Return(nil)

				// Setup AddTransactionEvent
				repo.On("AddTransactionEvent", mock.Anything, mock.AnythingOfType("*models.TransactionEvent")).Return(nil)
			},
			expectedError:  false,
			expectedStatus: models.TransactionStatusCreated,
		},
		{
			name: "InvalidScript",
			request: models.CreateTransactionRequest{
				Service:    "oracle",
				EntityID:   uuid.New(),
				EntityType: "oracle_request",
				Type:       models.TransactionTypeInvoke,
				Script:     nil, // Invalid: nil script
				GasPrice:   1000,
				SystemFee:  1000,
				NetworkFee: 1000,
			},
			setupMocks: func(repo *MockTransactionRepository, client *MockClient, walletStore *MockWalletStore) {
				// Nothing to set up as it should fail early
			},
			expectedError:  true,
			expectedStatus: "",
		},
		{
			name: "WalletNotFound",
			request: models.CreateTransactionRequest{
				Service:    "nonexistent",
				EntityID:   uuid.New(),
				EntityType: "oracle_request",
				Type:       models.TransactionTypeInvoke,
				Script:     []byte("test script"),
				GasPrice:   1000,
				SystemFee:  1000,
				NetworkFee: 1000,
			},
			setupMocks: func(repo *MockTransactionRepository, client *MockClient, walletStore *MockWalletStore) {
				// Setup GetWalletByService to return error
				repo.On("GetWalletByService", mock.Anything, "nonexistent").Return(nil, errors.New("wallet not found"))
			},
			expectedError:  true,
			expectedStatus: "",
		},
		{
			name: "DatabaseError",
			request: models.CreateTransactionRequest{
				Service:    "oracle",
				EntityID:   uuid.New(),
				EntityType: "oracle_request",
				Type:       models.TransactionTypeInvoke,
				Script:     []byte("test script"),
				GasPrice:   1000,
				SystemFee:  1000,
				NetworkFee: 1000,
			},
			setupMocks: func(repo *MockTransactionRepository, client *MockClient, walletStore *MockWalletStore) {
				// Setup GetWalletByService
				wallet := &models.WalletAccount{
					ID:        uuid.New(),
					Service:   "oracle",
					Address:   "NeoAddress123",
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				repo.On("GetWalletByService", mock.Anything, "oracle").Return(wallet, nil)

				// Setup CreateTransaction to return error
				repo.On("CreateTransaction", mock.Anything, mock.AnythingOfType("*models.Transaction")).Return(errors.New("database error"))
			},
			expectedError:  true,
			expectedStatus: "",
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTransactionRepository)
			mockClient := new(MockClient)
			mockWalletStore := new(MockWalletStore)

			// Setup mocks
			tc.setupMocks(mockRepo, mockClient, mockWalletStore)

			// Create transaction service with mocks
			service := blockchain.NewTransactionService(mockRepo, mockClient, mockWalletStore, 1)

			// Call method
			tx, err := service.CreateTransaction(context.Background(), tc.request)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, tx)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, tx)
				assert.Equal(t, tc.expectedStatus, tx.Status)
				assert.Equal(t, tc.request.Service, tx.Service)
				assert.Equal(t, tc.request.EntityID, *tx.EntityID)
				assert.Equal(t, tc.request.EntityType, tx.EntityType)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockClient.AssertExpectations(t)
			mockWalletStore.AssertExpectations(t)
		})
	}
}

// TestGetTransaction tests the GetTransaction method
func TestGetTransaction(t *testing.T) {
	// Generate a test transaction ID
	txID := uuid.New()

	// Test cases
	testCases := []struct {
		name          string
		setupMocks    func(*MockTransactionRepository)
		expectedError bool
		expectedTx    *models.Transaction
	}{
		{
			name: "Success",
			setupMocks: func(repo *MockTransactionRepository) {
				tx := &models.Transaction{
					ID:        txID,
					Service:   "oracle",
					Status:    models.TransactionStatusConfirmed,
					Hash:      "tx-hash-123",
					Data:      json.RawMessage(`{"script":"test"}`),
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				repo.On("GetTransactionByID", mock.Anything, txID).Return(tx, nil)
			},
			expectedError: false,
			expectedTx: &models.Transaction{
				ID:      txID,
				Service: "oracle",
				Status:  models.TransactionStatusConfirmed,
				Hash:    "tx-hash-123",
			},
		},
		{
			name: "TransactionNotFound",
			setupMocks: func(repo *MockTransactionRepository) {
				repo.On("GetTransactionByID", mock.Anything, txID).Return(nil, errors.New("not found"))
			},
			expectedError: true,
			expectedTx:    nil,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTransactionRepository)
			mockClient := new(MockClient)
			mockWalletStore := new(MockWalletStore)

			// Setup mocks
			tc.setupMocks(mockRepo)

			// Create transaction service with mocks
			service := blockchain.NewTransactionService(mockRepo, mockClient, mockWalletStore, 1)

			// Call method
			tx, err := service.GetTransaction(context.Background(), txID)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, tx)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, tx)
				assert.Equal(t, tc.expectedTx.ID, tx.ID)
				assert.Equal(t, tc.expectedTx.Service, tx.Service)
				assert.Equal(t, tc.expectedTx.Status, tx.Status)
				assert.Equal(t, tc.expectedTx.Hash, tx.Hash)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
		})
	}
}

// TestListTransactions tests the ListTransactions method
func TestListTransactions(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		service       string
		status        models.TransactionStatus
		entityID      *uuid.UUID
		page          int
		limit         int
		setupMocks    func(*MockTransactionRepository, string, models.TransactionStatus, *uuid.UUID, int, int)
		expectedError bool
		expectedCount int
	}{
		{
			name:     "Success",
			service:  "oracle",
			status:   models.TransactionStatusConfirmed,
			entityID: nil,
			page:     1,
			limit:    10,
			setupMocks: func(repo *MockTransactionRepository, service string, status models.TransactionStatus, entityID *uuid.UUID, page, limit int) {
				// Create a response with 2 transactions
				tx1 := models.Transaction{
					ID:      uuid.New(),
					Service: "oracle",
					Status:  models.TransactionStatusConfirmed,
				}
				tx2 := models.Transaction{
					ID:      uuid.New(),
					Service: "oracle",
					Status:  models.TransactionStatusConfirmed,
				}

				response := &models.TransactionListResponse{
					Total:        2,
					Page:         1,
					Limit:        10,
					Transactions: []models.Transaction{tx1, tx2},
				}

				repo.On("ListTransactions", mock.Anything, service, status, entityID, page, limit).Return(response, nil)
			},
			expectedError: false,
			expectedCount: 2,
		},
		{
			name:     "EmptyList",
			service:  "oracle",
			status:   models.TransactionStatusConfirmed,
			entityID: nil,
			page:     1,
			limit:    10,
			setupMocks: func(repo *MockTransactionRepository, service string, status models.TransactionStatus, entityID *uuid.UUID, page, limit int) {
				// Create an empty response
				response := &models.TransactionListResponse{
					Total:        0,
					Page:         1,
					Limit:        10,
					Transactions: []models.Transaction{},
				}

				repo.On("ListTransactions", mock.Anything, service, status, entityID, page, limit).Return(response, nil)
			},
			expectedError: false,
			expectedCount: 0,
		},
		{
			name:     "DatabaseError",
			service:  "oracle",
			status:   models.TransactionStatusConfirmed,
			entityID: nil,
			page:     1,
			limit:    10,
			setupMocks: func(repo *MockTransactionRepository, service string, status models.TransactionStatus, entityID *uuid.UUID, page, limit int) {
				repo.On("ListTransactions", mock.Anything, service, status, entityID, page, limit).Return(nil, errors.New("database error"))
			},
			expectedError: true,
			expectedCount: 0,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTransactionRepository)
			mockClient := new(MockClient)
			mockWalletStore := new(MockWalletStore)

			// Setup mocks
			tc.setupMocks(mockRepo, tc.service, tc.status, tc.entityID, tc.page, tc.limit)

			// Create transaction service with mocks
			service := blockchain.NewTransactionService(mockRepo, mockClient, mockWalletStore, 1)

			// Call method
			response, err := service.ListTransactions(context.Background(), tc.service, tc.status, tc.entityID, tc.page, tc.limit)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, response)
				assert.Equal(t, tc.expectedCount, len(response.Transactions))
				assert.Equal(t, tc.page, response.Page)
				assert.Equal(t, tc.limit, response.Limit)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
		})
	}
}
