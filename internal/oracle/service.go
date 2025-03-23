package oracle

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	coreGasBank "github.com/R3E-Network/service_layer/internal/core/gasbank"
	coreOracle "github.com/R3E-Network/service_layer/internal/core/oracle"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// Service provides Oracle functionality
type Service struct {
	config           *config.Config
	repository       models.OracleRepository
	blockchainClient blockchain.Client
	teeManager       *tee.Manager
	httpClient       *http.Client
	wrapper          *Wrapper
}

// NewService creates a new Oracle service
func NewService(
	config *config.Config,
	repository models.OracleRepository,
	blockchainClient blockchain.Client,
	teeManager *tee.Manager,
) (*Service, error) {
	httpClient := &http.Client{
		Timeout: time.Duration(30) * time.Second,
	}

	// Create a logger for the core service
	log := logger.New("oracle")

	// Use nil for the GasBank service since we don't have a real implementation
	var gasBankService *coreGasBank.Service = nil

	// Create core service with the correct parameter order
	coreService := coreOracle.NewService(
		config,            // Config
		log,               // Logger
		repository,        // Repository
		&blockchainClient, // Blockchain Client
		gasBankService,    // GasBank Service (nil)
		teeManager,        // TEE Manager
	)

	// Create wrapper
	wrapper := NewWrapper(coreService)

	return &Service{
		config:           config,
		repository:       repository,
		blockchainClient: blockchainClient,
		teeManager:       teeManager,
		httpClient:       httpClient,
		wrapper:          wrapper,
	}, nil
}

// NullGasBankService is a minimal implementation of the GasBank service interface
// that can be used when a real implementation is not needed
type NullGasBankService struct{}

// This would typically implement all the methods of the GasBank service interface
// For now, we'll leave it empty as it's just a placeholder

// CreateDataSource creates a new Oracle data source
func (s *Service) CreateDataSource(ctx context.Context, dataSource *models.OracleDataSource) (*models.OracleDataSource, error) {
	return s.wrapper.CreateDataSource(
		ctx,
		dataSource.Name,
		dataSource.URL,
		dataSource.Method,
		dataSource.Headers,
		dataSource.ContractScript,
		dataSource.DataPath,
		dataSource.TransformScript,
		dataSource.UpdateInterval,
	)
}

// GetDataSource retrieves an Oracle data source by ID
func (s *Service) GetDataSource(ctx context.Context, id string) (*models.OracleDataSource, error) {
	return s.wrapper.GetDataSource(ctx, id)
}

// UpdateDataSource updates an Oracle data source
func (s *Service) UpdateDataSource(ctx context.Context, dataSource *models.OracleDataSource) (*models.OracleDataSource, error) {
	return s.wrapper.UpdateDataSource(
		ctx,
		dataSource.ID,
		dataSource.URL,
		dataSource.Method,
		dataSource.Headers,
		dataSource.ContractScript,
		dataSource.DataPath,
		dataSource.TransformScript,
		dataSource.UpdateInterval,
		dataSource.Active,
	)
}

// DeleteDataSource deletes an Oracle data source
func (s *Service) DeleteDataSource(ctx context.Context, id string) error {
	return s.wrapper.DeleteDataSource(ctx, id)
}

// ListDataSources retrieves all Oracle data sources
func (s *Service) ListDataSources(ctx context.Context) ([]*models.OracleDataSource, error) {
	return s.wrapper.ListDataSources(ctx)
}

// TriggerUpdate triggers an update for a data source
func (s *Service) TriggerUpdate(ctx context.Context, dataSourceID string) error {
	return s.wrapper.TriggerUpdate(ctx, dataSourceID)
}

// GetLatestData gets the latest data for a data source
func (s *Service) GetLatestData(ctx context.Context, dataSourceID string) (string, error) {
	return s.wrapper.GetLatestData(ctx, dataSourceID)
}

// GetDataHistory gets the data history for a data source
func (s *Service) GetDataHistory(ctx context.Context, dataSourceID string, limit int) ([]*models.OracleUpdate, error) {
	return s.wrapper.GetDataHistory(ctx, dataSourceID, limit)
}

// CreateRequest creates a new oracle request
func (s *Service) CreateRequest(ctx context.Context, userID int, oracleID int, callbackAddress string, callbackMethod string) (*models.OracleRequest, error) {
	return s.wrapper.CreateRequest(ctx, userID, oracleID, callbackAddress, callbackMethod)
}

// GetRequest gets an oracle request by ID
func (s *Service) GetRequest(ctx context.Context, id int) (*models.OracleRequest, error) {
	return s.wrapper.GetRequest(ctx, id)
}

// CancelRequest cancels an oracle request
func (s *Service) CancelRequest(ctx context.Context, id int) error {
	return s.wrapper.CancelRequest(ctx, id)
}

// ListRequests lists oracle requests
func (s *Service) ListRequests(ctx context.Context, userID int, offset int, limit int) ([]*models.OracleRequest, error) {
	return s.wrapper.ListRequests(ctx, userID, offset, limit)
}

// CreateOracle creates a new oracle
func (s *Service) CreateOracle(ctx context.Context, name string, description string, oracleType models.OracleDataSourceType,
	url string, method string, headers models.JsonMap, body string, authType models.OracleAuthType,
	authParams models.JsonMap, path string, transform string, schedule string, userID int) (*models.Oracle, error) {

	return s.wrapper.CreateOracle(ctx, name, description, oracleType, url, method, headers, body, authType,
		authParams, path, transform, schedule, userID)
}

// UpdateOracle updates an oracle
func (s *Service) UpdateOracle(ctx context.Context, id int, name string, description string, active bool) (*models.Oracle, error) {
	return s.wrapper.UpdateOracle(ctx, id, name, description, active)
}

// GetOracle gets an oracle by ID
func (s *Service) GetOracle(ctx context.Context, id int) (*models.Oracle, error) {
	return s.wrapper.GetOracle(ctx, id)
}

// ListOracles lists all oracles
func (s *Service) ListOracles(ctx context.Context, userID int, offset int, limit int) ([]*models.Oracle, error) {
	return s.wrapper.ListOracles(ctx, userID, offset, limit)
}

// DeleteOracle deletes an oracle
func (s *Service) DeleteOracle(ctx context.Context, id int) error {
	return s.wrapper.DeleteOracle(ctx, id)
}

// Start starts the oracle service
func (s *Service) Start(ctx context.Context) error {
	return s.wrapper.Start(ctx)
}

// Stop stops the oracle service
func (s *Service) Stop(ctx context.Context) error {
	return s.wrapper.Stop(ctx)
}

// The remaining helper methods can be kept for backward compatibility if needed:

// FetchAndTransformData fetches and transforms data for a data source
func (s *Service) FetchAndTransformData(ctx context.Context, id string) (string, error) {
	// Use the core implementation via the wrapper
	return s.wrapper.GetLatestData(ctx, id)
}

// UpdateBlockchainContract updates the blockchain contract with data
func (s *Service) UpdateBlockchainContract(ctx context.Context, id string, data string) (string, error) {
	// This functionality should be delegated to the wrapper if available
	// For now, keep the existing implementation

	// Get the data source
	dataSource, err := s.repository.GetDataSource(ctx, id)
	if err != nil {
		return "", fmt.Errorf("failed to get data source: %w", err)
	}

	// Check if contract script is provided
	if dataSource.ContractScript == "" {
		return "", errors.New("contract script not provided")
	}

	// Evaluate the contract script in the TEE
	result, err := s.teeManager.ExecuteSecureFunction(ctx, dataSource.ContractScript, map[string]interface{}{
		"data": data,
	})
	if err != nil {
		return "", fmt.Errorf("failed to execute contract script: %w", err)
	}

	// Return the transaction ID
	return fmt.Sprintf("%v", result), nil
}

// ExecuteUpdate executes a complete update cycle for a data source
func (s *Service) ExecuteUpdate(ctx context.Context, id string) error {
	// Delegate to the wrapper
	return s.wrapper.TriggerUpdate(ctx, id)
}
