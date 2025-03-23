package oracle

import (
	"context"

	"github.com/R3E-Network/service_layer/internal/core/oracle"
	"github.com/R3E-Network/service_layer/internal/models"
)

// Wrapper implements the models.OracleService interface by delegating to the core implementation
type Wrapper struct {
	coreService *oracle.Service
}

// NewWrapper creates a new wrapper around the core oracle service
func NewWrapper(coreService *oracle.Service) *Wrapper {
	return &Wrapper{
		coreService: coreService,
	}
}

// CreateDataSource creates a new oracle data source
func (w *Wrapper) CreateDataSource(ctx context.Context, name string, url string, method string, headers string,
	contractScript string, dataPath string, transformScript string, updateInterval int) (*models.OracleDataSource, error) {
	
	return w.coreService.CreateDataSource(name, url, method, headers, contractScript, dataPath, transformScript, updateInterval)
}

// GetDataSource gets an oracle data source by ID
func (w *Wrapper) GetDataSource(ctx context.Context, id string) (*models.OracleDataSource, error) {
	return w.coreService.GetDataSource(id)
}

// UpdateDataSource updates an oracle data source
func (w *Wrapper) UpdateDataSource(ctx context.Context, id string, url string, method string, headers string,
	contractScript string, dataPath string, transformScript string, updateInterval int, active bool) (*models.OracleDataSource, error) {
	
	return w.coreService.UpdateDataSource(id, url, method, headers, contractScript, dataPath, transformScript, updateInterval, active)
}

// DeleteDataSource deletes an oracle data source
func (w *Wrapper) DeleteDataSource(ctx context.Context, id string) error {
	return w.coreService.DeleteDataSource(id)
}

// ListDataSources lists all oracle data sources
func (w *Wrapper) ListDataSources(ctx context.Context) ([]*models.OracleDataSource, error) {
	return w.coreService.ListDataSources()
}

// TriggerUpdate triggers an update for an oracle data source
func (w *Wrapper) TriggerUpdate(ctx context.Context, dataSourceID string) error {
	return w.coreService.TriggerUpdate(dataSourceID)
}

// GetLatestData gets the latest data for an oracle data source
func (w *Wrapper) GetLatestData(ctx context.Context, dataSourceID string) (string, error) {
	return w.coreService.GetLatestData(dataSourceID)
}

// GetDataHistory gets the data history for an oracle data source
func (w *Wrapper) GetDataHistory(ctx context.Context, dataSourceID string, limit int) ([]*models.OracleUpdate, error) {
	return w.coreService.GetDataHistory(dataSourceID, limit)
}

// CreateRequest creates a new oracle request
func (w *Wrapper) CreateRequest(ctx context.Context, userID int, oracleID int, callbackAddress string, callbackMethod string) (*models.OracleRequest, error) {
	return w.coreService.CreateRequest(userID, oracleID, callbackAddress, callbackMethod)
}

// GetRequest gets an oracle request by ID
func (w *Wrapper) GetRequest(ctx context.Context, id int) (*models.OracleRequest, error) {
	return w.coreService.GetRequest(id)
}

// CancelRequest cancels an oracle request
func (w *Wrapper) CancelRequest(ctx context.Context, id int) error {
	return w.coreService.CancelRequest(id)
}

// ListRequests lists oracle requests
func (w *Wrapper) ListRequests(ctx context.Context, userID int, offset int, limit int) ([]*models.OracleRequest, error) {
	return w.coreService.ListRequests(userID, offset, limit)
}

// CreateOracle creates a new oracle
func (w *Wrapper) CreateOracle(ctx context.Context, name string, description string, oracleType models.OracleDataSourceType,
	url string, method string, headers models.JsonMap, body string, authType models.OracleAuthType,
	authParams models.JsonMap, path string, transform string, schedule string, userID int) (*models.Oracle, error) {
	
	return w.coreService.CreateOracle(name, description, oracleType, url, method, headers, body, authType,
		authParams, path, transform, schedule, userID)
}

// UpdateOracle updates an oracle
func (w *Wrapper) UpdateOracle(ctx context.Context, id int, name string, description string, active bool) (*models.Oracle, error) {
	return w.coreService.UpdateOracle(id, name, description, active)
}

// GetOracle gets an oracle by ID
func (w *Wrapper) GetOracle(ctx context.Context, id int) (*models.Oracle, error) {
	return w.coreService.GetOracle(id)
}

// ListOracles lists all oracles
func (w *Wrapper) ListOracles(ctx context.Context, userID int, offset int, limit int) ([]*models.Oracle, error) {
	return w.coreService.ListOracles(userID, offset, limit)
}

// DeleteOracle deletes an oracle
func (w *Wrapper) DeleteOracle(ctx context.Context, id int) error {
	return w.coreService.DeleteOracle(id)
}

// Start starts the oracle service
func (w *Wrapper) Start(ctx context.Context) error {
	return w.coreService.Start()
}

// Stop stops the oracle service
func (w *Wrapper) Stop(ctx context.Context) error {
	w.coreService.Stop()
	return nil
}