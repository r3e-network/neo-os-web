package random

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock RandomRepository
type MockRandomRepository struct {
	mock.Mock
}

func (m *MockRandomRepository) CreateRequest(req *models.RandomRequest) (*models.RandomRequest, error) {
	args := m.Called(req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.RandomRequest), args.Error(1)
}

func (m *MockRandomRepository) UpdateRequest(req *models.RandomRequest) (*models.RandomRequest, error) {
	args := m.Called(req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.RandomRequest), args.Error(1)
}

func (m *MockRandomRepository) GetRequestByID(id int) (*models.RandomRequest, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.RandomRequest), args.Error(1)
}

func (m *MockRandomRepository) ListRequests(userID int, offset, limit int) ([]*models.RandomRequest, error) {
	args := m.Called(userID, offset, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.RandomRequest), args.Error(1)
}

func (m *MockRandomRepository) ListPendingRequests() ([]*models.RandomRequest, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.RandomRequest), args.Error(1)
}

func (m *MockRandomRepository) ListCommittedRequests() ([]*models.RandomRequest, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.RandomRequest), args.Error(1)
}

func (m *MockRandomRepository) GetRandomStatistics() (map[string]interface{}, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

func (m *MockRandomRepository) CreateEntropySource(source *models.EntropySource) (*models.EntropySource, error) {
	args := m.Called(source)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.EntropySource), args.Error(1)
}

func (m *MockRandomRepository) UpdateEntropySource(source *models.EntropySource) (*models.EntropySource, error) {
	args := m.Called(source)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.EntropySource), args.Error(1)
}

func (m *MockRandomRepository) GetEntropySourceByID(id int) (*models.EntropySource, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.EntropySource), args.Error(1)
}

func (m *MockRandomRepository) GetEntropySourceByName(name string) (*models.EntropySource, error) {
	args := m.Called(name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.EntropySource), args.Error(1)
}

func (m *MockRandomRepository) ListEntropySources() ([]*models.EntropySource, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.EntropySource), args.Error(1)
}

// Mock BlockchainClient
type MockBlockchainClient struct {
	mock.Mock
}

func (m *MockBlockchainClient) GetBlockHeight() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

// Helper function to setup test service
func setupTestService() (*Service, *MockRandomRepository, *MockBlockchainClient, *tee.Manager) {
	cfg := &config.Config{}
	log := logger.NewNopLogger()
	mockRepo := new(MockRandomRepository)
	mockBlockchainClient := new(MockBlockchainClient)
	teeManager := &tee.Manager{}

	service := NewService(cfg, log, mockRepo, mockBlockchainClient, teeManager)

	return service, mockRepo, mockBlockchainClient, teeManager
}

// TestCreateRequest tests creating a random number request
func TestCreateRequest(t *testing.T) {
	service, mockRepo, mockBlockchainClient, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mocks
		mockBlockchainClient.On("GetBlockHeight").Return(int64(100), nil).Once()

		expectedRequest := &models.RandomRequest{
			ID:              1,
			UserID:          2,
			Status:          models.RandomRequestStatusPending,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     100,
			NumBytes:        32,
			DelayBlocks:     5,
			GasFee:          0.1,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}

		mockRepo.On("CreateRequest", mock.AnythingOfType("*models.RandomRequest")).Return(expectedRequest, nil).Once()

		// Call service
		request, err := service.CreateRequest(ctx, 2, "0x1234", "callback", []byte("seed"), 32, 5, 0.1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequest, request)
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("DefaultNumBytes", func(t *testing.T) {
		// Setup mocks
		mockBlockchainClient.On("GetBlockHeight").Return(int64(100), nil).Once()

		expectedRequest := &models.RandomRequest{
			ID:              2,
			UserID:          2,
			Status:          models.RandomRequestStatusPending,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     100,
			NumBytes:        32, // Default value
			DelayBlocks:     5,
			GasFee:          0.1,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}

		mockRepo.On("CreateRequest", mock.AnythingOfType("*models.RandomRequest")).Return(expectedRequest, nil).Once()

		// Call service with 0 numBytes to trigger default
		request, err := service.CreateRequest(ctx, 2, "0x1234", "callback", []byte("seed"), 0, 5, 0.1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequest, request)
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("TooManyBytes", func(t *testing.T) {
		// Call service with excessive number of bytes
		request, err := service.CreateRequest(ctx, 2, "0x1234", "callback", []byte("seed"), 2000, 5, 0.1)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		assert.Contains(t, err.Error(), "cannot exceed 1024")

		// No blockchain or repository calls should be made
		mockBlockchainClient.AssertNotCalled(t, "GetBlockHeight")
		mockRepo.AssertNotCalled(t, "CreateRequest")
	})

	t.Run("NegativeDelayBlocks", func(t *testing.T) {
		// Setup mocks
		mockBlockchainClient.On("GetBlockHeight").Return(int64(100), nil).Once()

		expectedRequest := &models.RandomRequest{
			ID:              3,
			UserID:          2,
			Status:          models.RandomRequestStatusPending,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     100,
			NumBytes:        32,
			DelayBlocks:     0, // Corrected to 0
			GasFee:          0.1,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}

		mockRepo.On("CreateRequest", mock.AnythingOfType("*models.RandomRequest")).Return(expectedRequest, nil).Once()

		// Call service with negative delay blocks
		request, err := service.CreateRequest(ctx, 2, "0x1234", "callback", []byte("seed"), 32, -5, 0.1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequest, request)
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("BlockchainError", func(t *testing.T) {
		// Setup mocks
		mockBlockchainClient.On("GetBlockHeight").Return(int64(0), errors.New("blockchain error")).Once()

		expectedRequest := &models.RandomRequest{
			ID:              4,
			UserID:          2,
			Status:          models.RandomRequestStatusPending,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     0, // Default when error occurs
			NumBytes:        32,
			DelayBlocks:     5,
			GasFee:          0.1,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}

		mockRepo.On("CreateRequest", mock.AnythingOfType("*models.RandomRequest")).Return(expectedRequest, nil).Once()

		// Call service
		request, err := service.CreateRequest(ctx, 2, "0x1234", "callback", []byte("seed"), 32, 5, 0.1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequest, request)
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mocks
		mockBlockchainClient.On("GetBlockHeight").Return(int64(100), nil).Once()
		mockRepo.On("CreateRequest", mock.AnythingOfType("*models.RandomRequest")).Return(nil, errors.New("database error")).Once()

		// Call service
		request, err := service.CreateRequest(ctx, 2, "0x1234", "callback", []byte("seed"), 32, 5, 0.1)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		assert.Contains(t, err.Error(), "database error")
		mockBlockchainClient.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetRequest tests retrieving a random number request
func TestGetRequest(t *testing.T) {
	service, mockRepo, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedRequest := &models.RandomRequest{
			ID:              1,
			UserID:          2,
			Status:          models.RandomRequestStatusPending,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     100,
			NumBytes:        32,
			DelayBlocks:     5,
			GasFee:          0.1,
		}

		mockRepo.On("GetRequestByID", 1).Return(expectedRequest, nil).Once()

		// Call service
		request, err := service.GetRequest(ctx, 1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequest, request)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetRequestByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		request, err := service.GetRequest(ctx, 999)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		mockRepo.AssertExpectations(t)
	})
}

// TestListRequests tests listing random number requests
func TestListRequests(t *testing.T) {
	service, mockRepo, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedRequests := []*models.RandomRequest{
			{
				ID:              1,
				UserID:          2,
				Status:          models.RandomRequestStatusPending,
				CallbackAddress: "0x1234",
				CallbackMethod:  "callback",
				Seed:            []byte("seed1"),
				BlockHeight:     100,
				NumBytes:        32,
				DelayBlocks:     5,
				GasFee:          0.1,
			},
			{
				ID:              2,
				UserID:          2,
				Status:          models.RandomRequestStatusCommitted,
				CallbackAddress: "0x1234",
				CallbackMethod:  "callback",
				Seed:            []byte("seed2"),
				BlockHeight:     200,
				NumBytes:        64,
				DelayBlocks:     10,
				GasFee:          0.2,
			},
		}

		mockRepo.On("ListRequests", 2, 0, 10).Return(expectedRequests, nil).Once()

		// Call service
		requests, err := service.ListRequests(ctx, 2, 0, 10)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequests, requests)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListRequests", 2, 0, 10).Return(nil, errors.New("database error")).Once()

		// Call service
		requests, err := service.ListRequests(ctx, 2, 0, 10)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, requests)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetRandomStatistics tests retrieving random number statistics
func TestGetRandomStatistics(t *testing.T) {
	service, mockRepo, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedStats := map[string]interface{}{
			"total_requests":          100,
			"pending_requests":        10,
			"fulfilled_requests":      90,
			"average_time_to_fulfill": 5.2,
		}

		mockRepo.On("GetRandomStatistics").Return(expectedStats, nil).Once()

		// Call service
		stats, err := service.GetRandomStatistics(ctx)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedStats, stats)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetRandomStatistics").Return(nil, errors.New("database error")).Once()

		// Call service
		stats, err := service.GetRandomStatistics(ctx)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, stats)
		mockRepo.AssertExpectations(t)
	})
}

// TestVerifyRandomNumber tests random number verification
func TestVerifyRandomNumber(t *testing.T) {
	service, mockRepo, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Create a random request with known random number and proof
		randomNumber := []byte("random_number_data")
		proof := []byte("proof_data")

		request := &models.RandomRequest{
			ID:              1,
			UserID:          2,
			Status:          models.RandomRequestStatusRevealed,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     100,
			NumBytes:        32,
			DelayBlocks:     5,
			GasFee:          0.1,
			CommitmentHash:  service.calculateCommitmentHash(randomNumber, proof),
			RandomNumber:    randomNumber,
			Proof:           proof,
		}

		mockRepo.On("GetRequestByID", 1).Return(request, nil).Once()

		// Call service
		valid, err := service.VerifyRandomNumber(ctx, 1, randomNumber, proof)

		// Assertions
		require.NoError(t, err)
		assert.True(t, valid)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RequestNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetRequestByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		valid, err := service.VerifyRandomNumber(ctx, 999, []byte("random"), []byte("proof"))

		// Assertions
		assert.Error(t, err)
		assert.False(t, valid)
		mockRepo.AssertExpectations(t)
	})

	t.Run("InvalidRandomNumber", func(t *testing.T) {
		// Create a random request with known random number and proof
		randomNumber := []byte("random_number_data")
		proof := []byte("proof_data")
		wrongRandomNumber := []byte("wrong_random_number")

		request := &models.RandomRequest{
			ID:              2,
			UserID:          2,
			Status:          models.RandomRequestStatusRevealed,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     100,
			NumBytes:        32,
			DelayBlocks:     5,
			GasFee:          0.1,
			CommitmentHash:  service.calculateCommitmentHash(randomNumber, proof),
			RandomNumber:    randomNumber,
			Proof:           proof,
		}

		mockRepo.On("GetRequestByID", 2).Return(request, nil).Once()

		// Call service with wrong random number
		valid, err := service.VerifyRandomNumber(ctx, 2, wrongRandomNumber, proof)

		// Assertions
		require.NoError(t, err)
		assert.False(t, valid)
		mockRepo.AssertExpectations(t)
	})

	t.Run("InvalidProof", func(t *testing.T) {
		// Create a random request with known random number and proof
		randomNumber := []byte("random_number_data")
		proof := []byte("proof_data")
		wrongProof := []byte("wrong_proof")

		request := &models.RandomRequest{
			ID:              3,
			UserID:          2,
			Status:          models.RandomRequestStatusRevealed,
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			Seed:            []byte("seed"),
			BlockHeight:     100,
			NumBytes:        32,
			DelayBlocks:     5,
			GasFee:          0.1,
			CommitmentHash:  service.calculateCommitmentHash(randomNumber, proof),
			RandomNumber:    randomNumber,
			Proof:           proof,
		}

		mockRepo.On("GetRequestByID", 3).Return(request, nil).Once()

		// Call service with wrong proof
		valid, err := service.VerifyRandomNumber(ctx, 3, randomNumber, wrongProof)

		// Assertions
		require.NoError(t, err)
		assert.False(t, valid)
		mockRepo.AssertExpectations(t)
	})
}
