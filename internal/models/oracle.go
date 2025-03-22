package models

import (
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
	ID              int                  `json:"id" db:"id"`
	Name            string               `json:"name" db:"name"`
	Description     string               `json:"description" db:"description"`
	Type            OracleDataSourceType `json:"type" db:"type"`
	URL             string               `json:"url" db:"url"`
	Method          string               `json:"method" db:"method"`
	Headers         JsonMap              `json:"headers" db:"headers"`
	Body            string               `json:"body" db:"body"`
	AuthType        OracleAuthType       `json:"auth_type" db:"auth_type"`
	AuthParams      JsonMap              `json:"auth_params" db:"auth_params"`
	Path            string               `json:"path" db:"path"`
	Transform       string               `json:"transform" db:"transform"`
	Schedule        string               `json:"schedule" db:"schedule"`
	Active          bool                 `json:"active" db:"active"`
	UserID          int                  `json:"user_id" db:"user_id"`
	CreatedAt       time.Time            `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time            `json:"updated_at" db:"updated_at"`
}

// OracleRequest represents a request for oracle data
type OracleRequest struct {
	ID               int                 `json:"id" db:"id"`
	OracleID         int                 `json:"oracle_id" db:"oracle_id"`
	UserID           int                 `json:"user_id" db:"user_id"`
	Status           OracleRequestStatus `json:"status" db:"status"`
	URL              string              `json:"url" db:"url"`
	Method           string              `json:"method" db:"method"`
	Headers          JsonMap             `json:"headers" db:"headers"`
	Body             string              `json:"body" db:"body"`
	AuthType         OracleAuthType      `json:"auth_type" db:"auth_type"`
	AuthParams       JsonMap             `json:"auth_params" db:"auth_params"`
	Path             string              `json:"path" db:"path"`
	Transform        string              `json:"transform" db:"transform"`
	CallbackAddress  string              `json:"callback_address" db:"callback_address"`
	CallbackMethod   string              `json:"callback_method" db:"callback_method"`
	GasFee           float64             `json:"gas_fee" db:"gas_fee"`
	Result           JsonMap             `json:"result" db:"result"`
	RawResult        string              `json:"raw_result" db:"raw_result"`
	Error            string              `json:"error" db:"error"`
	TxHash           string              `json:"tx_hash" db:"tx_hash"`
	BlockHeight      int64               `json:"block_height" db:"block_height"`
	CreatedAt        time.Time           `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time           `json:"updated_at" db:"updated_at"`
	CompletedAt      time.Time           `json:"completed_at" db:"completed_at"`
}

// OracleRepository defines the interface for oracle data access
type OracleRepository interface {
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