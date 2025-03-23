package mocks

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/internal/models"
)

// MockOracleRepository implements a mock repository for Oracle tests
type MockOracleRepository struct {
	dataSources map[string]*models.OracleDataSource
	mutex       sync.RWMutex
}

// NewMockOracleRepository creates a new mock Oracle repository
func NewMockOracleRepository() *MockOracleRepository {
	return &MockOracleRepository{
		dataSources: make(map[string]*models.OracleDataSource),
	}
}

// CreateDataSource creates a new Oracle data source
func (r *MockOracleRepository) CreateDataSource(ctx context.Context, dataSource *models.OracleDataSource) (*models.OracleDataSource, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Generate a unique ID if not provided
	if dataSource.ID == "" {
		dataSource.ID = uuid.New().String()
	}

	// Set created and updated timestamps
	now := time.Now()
	dataSource.CreatedAt = now
	dataSource.UpdatedAt = now

	// Store the data source
	r.dataSources[dataSource.ID] = dataSource

	// Return a copy to avoid modifying the stored value
	return r.copyDataSource(dataSource), nil
}

// GetDataSource retrieves an Oracle data source by ID
func (r *MockOracleRepository) GetDataSource(ctx context.Context, id string) (*models.OracleDataSource, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	dataSource, exists := r.dataSources[id]
	if !exists {
		return nil, models.ErrDataSourceNotFound
	}

	return r.copyDataSource(dataSource), nil
}

// UpdateDataSource updates an existing Oracle data source
func (r *MockOracleRepository) UpdateDataSource(ctx context.Context, dataSource *models.OracleDataSource) (*models.OracleDataSource, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.dataSources[dataSource.ID]
	if !exists {
		return nil, models.ErrDataSourceNotFound
	}

	// Update timestamp
	dataSource.UpdatedAt = time.Now()

	// Store the updated data source
	r.dataSources[dataSource.ID] = dataSource

	return r.copyDataSource(dataSource), nil
}

// DeleteDataSource deletes an Oracle data source
func (r *MockOracleRepository) DeleteDataSource(ctx context.Context, id string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.dataSources[id]
	if !exists {
		return models.ErrDataSourceNotFound
	}

	delete(r.dataSources, id)
	return nil
}

// ListDataSources retrieves all Oracle data sources
func (r *MockOracleRepository) ListDataSources(ctx context.Context) ([]*models.OracleDataSource, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	result := make([]*models.OracleDataSource, 0, len(r.dataSources))
	for _, dataSource := range r.dataSources {
		result = append(result, r.copyDataSource(dataSource))
	}

	return result, nil
}

// UpdateLastUpdated updates the last updated timestamp for a data source
func (r *MockOracleRepository) UpdateLastUpdated(ctx context.Context, id string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	dataSource, exists := r.dataSources[id]
	if !exists {
		return models.ErrDataSourceNotFound
	}

	dataSource.LastUpdated = time.Now()
	dataSource.UpdatedAt = time.Now()

	return nil
}

// RecordUpdate records a data update for a data source
func (r *MockOracleRepository) RecordUpdate(ctx context.Context, id string, data string, txID string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	dataSource, exists := r.dataSources[id]
	if !exists {
		return models.ErrDataSourceNotFound
	}

	// In a real implementation, this would store a record of the update
	// For the mock, we'll just update the last updated timestamp
	dataSource.LastUpdated = time.Now()

	return nil
}

// Helper method to create a copy of a data source to avoid modifying the stored data
func (r *MockOracleRepository) copyDataSource(dataSource *models.OracleDataSource) *models.OracleDataSource {
	copy := *dataSource
	return &copy
}
