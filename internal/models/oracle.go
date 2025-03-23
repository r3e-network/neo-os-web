package models

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// OracleDataSourceType represents the type of oracle data source
type OracleDataSourceType string

const (
	// OracleDataSourceTypeREST represents a REST API data source
	OracleDataSourceTypeREST OracleDataSourceType = "rest"
	// OracleDataSourceTypeWebSocket represents a WebSocket data source
	OracleDataSourceTypeWebSocket OracleDataSourceType = "websocket"
	// OracleDataSourceTypeFile represents a file data source
	OracleDataSourceTypeFile OracleDataSourceType = "file"
	// OracleDataSourceTypeIPFS represents an IPFS data source
	OracleDataSourceTypeIPFS OracleDataSourceType = "ipfs"
	// OracleDataSourceTypeDatabase represents a database data source
	OracleDataSourceTypeDatabase OracleDataSourceType = "database"
	// OracleDataSourceTypeCustom represents a custom data source
	OracleDataSourceTypeCustom OracleDataSourceType = "custom"
)

// OracleAuthType represents the type of authentication for an oracle data source
type OracleAuthType string

const (
	// OracleAuthTypeNone represents no authentication
	OracleAuthTypeNone OracleAuthType = "none"
	// OracleAuthTypeAPIKey represents API key authentication
	OracleAuthTypeAPIKey OracleAuthType = "api_key"
	// OracleAuthTypeOAuth represents OAuth authentication
	OracleAuthTypeOAuth OracleAuthType = "oauth"
	// OracleAuthTypeJWT represents JWT authentication
	OracleAuthTypeJWT OracleAuthType = "jwt"
	// OracleAuthTypeBasic represents basic authentication
	OracleAuthTypeBasic OracleAuthType = "basic"
	// OracleAuthTypeCustom represents custom authentication
	OracleAuthTypeCustom OracleAuthType = "custom"
)

// OracleRequestStatus represents the status of an oracle request
type OracleRequestStatus string

const (
	// OracleRequestStatusPending indicates the request is pending
	OracleRequestStatusPending OracleRequestStatus = "pending"
	// OracleRequestStatusProcessing indicates the request is being processed
	OracleRequestStatusProcessing OracleRequestStatus = "processing"
	// OracleRequestStatusCompleted indicates the request completed successfully
	OracleRequestStatusCompleted OracleRequestStatus = "completed"
	// OracleRequestStatusCallbackSent indicates the callback has been sent to the contract
	OracleRequestStatusCallbackSent OracleRequestStatus = "callback_sent"
	// OracleRequestStatusFailed indicates the request failed
	OracleRequestStatusFailed OracleRequestStatus = "failed"
)

// JsonMap is a custom type for JSON maps
type JsonMap map[string]interface{}

// Value implements the driver.Valuer interface for JsonMap
func (j JsonMap) Value() (driver.Value, error) {
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for JsonMap
func (j *JsonMap) Scan(value interface{}) error {
	if value == nil {
		*j = make(JsonMap)
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}

	return json.Unmarshal(bytes, j)
}

// Oracle represents an oracle data source configuration
type Oracle struct {
	ID          int                  `json:"id" db:"id"`
	Name        string               `json:"name" db:"name"`
	Description string               `json:"description" db:"description"`
	Type        OracleDataSourceType `json:"type" db:"type"`
	URL         string               `json:"url" db:"url"`
	Method      string               `json:"method" db:"method"`
	Headers     JsonMap              `json:"headers" db:"headers"`
	Body        string               `json:"body" db:"body"`
	AuthType    OracleAuthType       `json:"auth_type" db:"auth_type"`
	AuthParams  JsonMap              `json:"auth_params" db:"auth_params"`
	Path        string               `json:"path" db:"path"`
	Transform   string               `json:"transform" db:"transform"`
	Schedule    string               `json:"schedule" db:"schedule"`
	Active      bool                 `json:"active" db:"active"`
	UserID      int                  `json:"user_id" db:"user_id"`
	CreatedAt   time.Time            `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at" db:"updated_at"`
}

// OracleRequest represents a request for oracle data
type OracleRequest struct {
	ID              int                 `json:"id" db:"id"`
	OracleID        int                 `json:"oracle_id" db:"oracle_id"`
	UserID          int                 `json:"user_id" db:"user_id"`
	Status          OracleRequestStatus `json:"status" db:"status"`
	URL             string              `json:"url" db:"url"`
	Method          string              `json:"method" db:"method"`
	Headers         JsonMap             `json:"headers" db:"headers"`
	Body            string              `json:"body" db:"body"`
	AuthType        OracleAuthType      `json:"auth_type" db:"auth_type"`
	AuthParams      JsonMap             `json:"auth_params" db:"auth_params"`
	Path            string              `json:"path" db:"path"`
	Transform       string              `json:"transform" db:"transform"`
	CallbackAddress string              `json:"callback_address" db:"callback_address"`
	CallbackMethod  string              `json:"callback_method" db:"callback_method"`
	GasFee          float64             `json:"gas_fee" db:"gas_fee"`
	Result          JsonMap             `json:"result" db:"result"`
	RawResult       string              `json:"raw_result" db:"raw_result"`
	Error           string              `json:"error" db:"error"`
	TxHash          string              `json:"tx_hash" db:"tx_hash"`
	BlockHeight     int64               `json:"block_height" db:"block_height"`
	CreatedAt       time.Time           `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at" db:"updated_at"`
	CompletedAt     time.Time           `json:"completed_at" db:"completed_at"`
}

// Common errors for Oracle operations
var (
	ErrDataSourceNotFound    = errors.New("data source not found")
	ErrInvalidDataSourceName = errors.New("invalid data source name")
	ErrInvalidDataSourceURL  = errors.New("invalid data source URL")
	ErrInvalidContractScript = errors.New("invalid contract script hash")
	ErrInvalidUpdateInterval = errors.New("invalid update interval")
	ErrMaxDataSourcesReached = errors.New("maximum number of data sources reached")
)

// OracleDataSource represents an external data source for the Oracle service
type OracleDataSource struct {
	ID              string    `json:"id" db:"id"`
	Name            string    `json:"name" db:"name"`
	URL             string    `json:"url" db:"url"`
	Method          string    `json:"method" db:"method"`
	Headers         string    `json:"headers" db:"headers"`
	ContractScript  string    `json:"contract_script" db:"contract_script"`
	DataPath        string    `json:"data_path" db:"data_path"`
	TransformScript string    `json:"transform_script" db:"transform_script"`
	UpdateInterval  int       `json:"update_interval" db:"update_interval"`
	Active          bool      `json:"active" db:"active"`
	LastUpdated     time.Time `json:"last_updated" db:"last_updated"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

// OracleUpdate represents a record of an Oracle data update
type OracleUpdate struct {
	ID            string    `json:"id" db:"id"`
	DataSourceID  string    `json:"data_source_id" db:"data_source_id"`
	Data          string    `json:"data" db:"data"`
	TransactionID string    `json:"transaction_id" db:"transaction_id"`
	Success       bool      `json:"success" db:"success"`
	Error         string    `json:"error" db:"error"`
	BlockHeight   uint32    `json:"block_height" db:"block_height"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
}

// OracleRepository defines the interface for Oracle data storage operations
type OracleRepository interface {
	// Data source operations
	CreateDataSource(ctx interface{}, dataSource *OracleDataSource) (*OracleDataSource, error)
	GetDataSource(ctx interface{}, id string) (*OracleDataSource, error)
	UpdateDataSource(ctx interface{}, dataSource *OracleDataSource) (*OracleDataSource, error)
	DeleteDataSource(ctx interface{}, id string) error
	ListDataSources(ctx interface{}) ([]*OracleDataSource, error)

	// Update operations
	UpdateLastUpdated(ctx interface{}, id string) error
	RecordUpdate(ctx interface{}, id string, data string, txID string) error

	// Oracle management
	CreateOracle(oracle *Oracle) (*Oracle, error)
	UpdateOracle(oracle *Oracle) (*Oracle, error)
	GetOracleByID(id int) (*Oracle, error)
	GetOracleByName(name string) (*Oracle, error)
	ListOracles(userID int, offset, limit int) ([]*Oracle, error)
	DeleteOracle(id int) error

	// Oracle request management
	CreateOracleRequest(request *OracleRequest) (*OracleRequest, error)
	UpdateOracleRequest(request *OracleRequest) (*OracleRequest, error)
	GetOracleRequestByID(id int) (*OracleRequest, error)
	ListOracleRequests(oracleID int, offset, limit int) ([]*OracleRequest, error)
	ListPendingOracleRequests() ([]*OracleRequest, error)
	GetOracleStatistics() (map[string]interface{}, error)
}

// OracleService defines the interface for oracle service
type OracleService interface {
	// Data source management
	CreateDataSource(ctx context.Context, name string, url string, method string, headers string,
		contractScript string, dataPath string, transformScript string, updateInterval int) (*OracleDataSource, error)
	GetDataSource(ctx context.Context, id string) (*OracleDataSource, error)
	UpdateDataSource(ctx context.Context, id string, url string, method string, headers string,
		contractScript string, dataPath string, transformScript string, updateInterval int, active bool) (*OracleDataSource, error)
	DeleteDataSource(ctx context.Context, id string) error
	ListDataSources(ctx context.Context) ([]*OracleDataSource, error)

	// Oracle operations
	TriggerUpdate(ctx context.Context, dataSourceID string) error
	GetLatestData(ctx context.Context, dataSourceID string) (string, error)
	GetDataHistory(ctx context.Context, dataSourceID string, limit int) ([]*OracleUpdate, error)

	// Oracle request management
	CreateRequest(ctx context.Context, userID int, oracleID int, callbackAddress string, callbackMethod string) (*OracleRequest, error)
	GetRequest(ctx context.Context, id int) (*OracleRequest, error)
	CancelRequest(ctx context.Context, id int) error
	ListRequests(ctx context.Context, userID int, offset int, limit int) ([]*OracleRequest, error)

	// Oracle management
	CreateOracle(ctx context.Context, name string, description string, oracleType OracleDataSourceType,
		url string, method string, headers JsonMap, body string, authType OracleAuthType,
		authParams JsonMap, path string, transform string, schedule string, userID int) (*Oracle, error)
	UpdateOracle(ctx context.Context, id int, name string, description string, active bool) (*Oracle, error)
	GetOracle(ctx context.Context, id int) (*Oracle, error)
	ListOracles(ctx context.Context, userID int, offset int, limit int) ([]*Oracle, error)
	DeleteOracle(ctx context.Context, id int) error

	// Service lifecycle
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}
