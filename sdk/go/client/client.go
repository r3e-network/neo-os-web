// Package client provides a typed HTTP client for the Service Layer API.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Config holds client configuration.
type Config struct {
	BaseURL      string
	Token        string
	RefreshToken string
	TenantID     string
	Timeout      time.Duration
}

// Client is the Service Layer HTTP client.
type Client struct {
	config     Config
	httpClient *http.Client

	Accounts         *AccountsService
	WorkspaceWallets *WorkspaceWalletsService
	Functions        *FunctionsService
	Triggers         *TriggersService
	Secrets          *SecretsService
	GasBank          *GasBankService
	Automation       *AutomationService
	PriceFeeds       *PriceFeedsService
	DataFeeds        *DataFeedsService
	DataStreams      *DataStreamsService
	Oracle           *OracleService
	VRF              *VRFService
	Random           *RandomService
	CCIP             *CCIPService
	DataLink         *DataLinkService
	DTA              *DTAService
	Confidential     *ConfidentialService
	CRE              *CREService
	Bus              *BusService
	System           *SystemService
}

// Error represents an API error.
type Error struct {
	StatusCode int
	Message    string
	Response   interface{}
}

func (e *Error) Error() string {
	return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Message)
}

// New creates a new Service Layer client.
func New(config Config) *Client {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	c := &Client{
		config:     config,
		httpClient: &http.Client{Timeout: config.Timeout},
	}

	c.Accounts = &AccountsService{client: c}
	c.WorkspaceWallets = &WorkspaceWalletsService{client: c}
	c.Functions = &FunctionsService{client: c}
	c.Triggers = &TriggersService{client: c}
	c.Secrets = &SecretsService{client: c}
	c.GasBank = &GasBankService{client: c}
	c.Automation = &AutomationService{client: c}
	c.PriceFeeds = &PriceFeedsService{client: c}
	c.DataFeeds = &DataFeedsService{client: c}
	c.DataStreams = &DataStreamsService{client: c}
	c.Oracle = &OracleService{client: c}
	c.VRF = &VRFService{client: c}
	c.Random = &RandomService{client: c}
	c.CCIP = &CCIPService{client: c}
	c.DataLink = &DataLinkService{client: c}
	c.DTA = &DTAService{client: c}
	c.Confidential = &ConfidentialService{client: c}
	c.CRE = &CREService{client: c}
	c.Bus = &BusService{client: c}
	c.System = &SystemService{client: c}

	return c
}

func (c *Client) request(ctx context.Context, method, path string, query url.Values, body, result interface{}) error {
	if strings.TrimSpace(c.config.Token) == "" && strings.TrimSpace(c.config.RefreshToken) != "" {
		if err := c.refresh(ctx); err != nil {
			return fmt.Errorf("refresh token: %w", err)
		}
	}
	fullURL := strings.TrimRight(c.config.BaseURL, "/") + path
	if len(query) > 0 {
		fullURL += "?" + query.Encode()
	}

	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal body: %w", err)
		}
		reader = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, reader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token := strings.TrimSpace(c.config.Token); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if tenant := strings.TrimSpace(c.config.TenantID); tenant != "" {
		req.Header.Set("X-Tenant-ID", tenant)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized && strings.TrimSpace(c.config.RefreshToken) != "" {
		if err := c.refresh(ctx); err == nil && strings.TrimSpace(c.config.Token) != "" {
			return c.request(ctx, method, path, query, body, result)
		}
	}

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		var parsed interface{}
		_ = json.Unmarshal(respBody, &parsed)
		return &Error{StatusCode: resp.StatusCode, Message: resp.Status, Response: parsed}
	}

	if resp.StatusCode == http.StatusNoContent || result == nil {
		return nil
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

func (c *Client) refresh(ctx context.Context) error {
	rt := strings.TrimSpace(c.config.RefreshToken)
	if rt == "" {
		return fmt.Errorf("refresh token missing")
	}
	u := strings.TrimRight(c.config.BaseURL, "/") + "/auth/refresh"
	payload := map[string]string{"refresh_token": rt}
	data, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("build refresh: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("refresh request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("refresh failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var parsed map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&parsed)
	if token, ok := parsed["access_token"].(string); ok && strings.TrimSpace(token) != "" {
		c.config.Token = strings.TrimSpace(token)
		return nil
	}
	if token, ok := parsed["token"].(string); ok && strings.TrimSpace(token) != "" {
		c.config.Token = strings.TrimSpace(token)
		return nil
	}
	return fmt.Errorf("refresh response missing access_token")
}

// PaginationParams holds pagination parameters.
type PaginationParams struct {
	Limit int
}

func (p PaginationParams) asQuery() url.Values {
	values := url.Values{}
	if p.Limit > 0 {
		values.Set("limit", strconv.Itoa(p.Limit))
	}
	return values
}

// ============================================================================ //
// Domain Types
// ============================================================================ //

type Account struct {
	ID        string            `json:"ID"`
	Owner     string            `json:"Owner"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
	UpdatedAt time.Time         `json:"UpdatedAt"`
}

type WorkspaceWallet struct {
	ID            string    `json:"ID"`
	WorkspaceID   string    `json:"WorkspaceID"`
	WalletAddress string    `json:"WalletAddress"`
	Label         string    `json:"Label"`
	Status        string    `json:"Status"`
	CreatedAt     time.Time `json:"CreatedAt"`
	UpdatedAt     time.Time `json:"UpdatedAt"`
}

type Function struct {
	ID          string    `json:"ID"`
	AccountID   string    `json:"AccountID"`
	Name        string    `json:"Name"`
	Description string    `json:"Description,omitempty"`
	Source      string    `json:"Source,omitempty"`
	Secrets     []string  `json:"Secrets,omitempty"`
	CreatedAt   time.Time `json:"CreatedAt"`
	UpdatedAt   time.Time `json:"UpdatedAt"`
}

type FunctionExecution struct {
	ID          string      `json:"ID"`
	AccountID   string      `json:"AccountID"`
	FunctionID  string      `json:"FunctionID"`
	Status      string      `json:"Status"`
	Input       interface{} `json:"Input,omitempty"`
	Output      interface{} `json:"Output,omitempty"`
	Error       string      `json:"Error,omitempty"`
	StartedAt   *time.Time  `json:"StartedAt,omitempty"`
	CompletedAt *time.Time  `json:"CompletedAt,omitempty"`
	CreatedAt   time.Time   `json:"CreatedAt"`
}

type Trigger struct {
	ID         string            `json:"ID"`
	AccountID  string            `json:"AccountID"`
	FunctionID string            `json:"FunctionID"`
	Type       string            `json:"Type"`
	Rule       string            `json:"Rule,omitempty"`
	Config     map[string]string `json:"Config,omitempty"`
	Enabled    bool              `json:"Enabled"`
	CreatedAt  time.Time         `json:"CreatedAt"`
	UpdatedAt  time.Time         `json:"UpdatedAt"`
}

type Secret struct {
	ID        string    `json:"ID"`
	AccountID string    `json:"AccountID"`
	Name      string    `json:"Name"`
	Version   int       `json:"Version,omitempty"`
	ACL       uint8     `json:"ACL,omitempty"`
	Value     string    `json:"Value,omitempty"`
	CreatedAt time.Time `json:"CreatedAt"`
	UpdatedAt time.Time `json:"UpdatedAt"`
}

type GasAccount struct {
	ID                    string    `json:"ID"`
	AccountID             string    `json:"AccountID"`
	WalletAddress         string    `json:"WalletAddress"`
	Balance               float64   `json:"Balance"`
	Available             float64   `json:"Available"`
	Pending               float64   `json:"Pending"`
	Locked                float64   `json:"Locked"`
	MinBalance            float64   `json:"MinBalance"`
	DailyLimit            float64   `json:"DailyLimit"`
	NotificationThreshold float64   `json:"NotificationThreshold"`
	RequiredApprovals     int       `json:"RequiredApprovals"`
	CreatedAt             time.Time `json:"CreatedAt"`
	UpdatedAt             time.Time `json:"UpdatedAt"`
}

type GasTransaction struct {
	ID               string    `json:"ID"`
	GasAccountID     string    `json:"GasAccountID"`
	Type             string    `json:"Type"`
	Status           string    `json:"Status"`
	Amount           float64   `json:"Amount"`
	FromAddress      string    `json:"FromAddress,omitempty"`
	ToAddress        string    `json:"ToAddress,omitempty"`
	ScheduleAt       time.Time `json:"ScheduleAt,omitempty"`
	CreatedAt        time.Time `json:"CreatedAt"`
	UpdatedAt        time.Time `json:"UpdatedAt"`
	DispatchedAt     time.Time `json:"DispatchedAt,omitempty"`
	CompletedAt      time.Time `json:"CompletedAt,omitempty"`
	DeadLetterReason string    `json:"DeadLetterReason,omitempty"`
	Notes            string    `json:"Notes,omitempty"`
}

type GasSummary struct {
	Accounts           []GasAccount `json:"accounts"`
	TotalBalance       float64      `json:"total_balance"`
	TotalAvailable     float64      `json:"total_available"`
	PendingAmount      float64      `json:"pending_amount"`
	PendingWithdrawals int          `json:"pending_withdrawals"`
}

type SettlementAttempt struct {
	TransactionID string    `json:"TransactionID"`
	Attempt       int       `json:"Attempt"`
	Status        string    `json:"Status"`
	Error         string    `json:"Error,omitempty"`
	StartedAt     time.Time `json:"StartedAt"`
	CompletedAt   time.Time `json:"CompletedAt"`
}

type DeadLetter struct {
	TransactionID string    `json:"TransactionID"`
	AccountID     string    `json:"AccountID"`
	Reason        string    `json:"Reason"`
	LastError     string    `json:"LastError"`
	Retries       int       `json:"Retries"`
	LastAttemptAt time.Time `json:"LastAttemptAt"`
	CreatedAt     time.Time `json:"CreatedAt"`
	UpdatedAt     time.Time `json:"UpdatedAt"`
}

type AutomationJob struct {
	ID          string    `json:"ID"`
	AccountID   string    `json:"AccountID"`
	FunctionID  string    `json:"FunctionID"`
	Name        string    `json:"Name"`
	Schedule    string    `json:"Schedule"`
	Description string    `json:"Description"`
	Enabled     bool      `json:"Enabled"`
	NextRun     time.Time `json:"NextRun"`
	CreatedAt   time.Time `json:"CreatedAt"`
	UpdatedAt   time.Time `json:"UpdatedAt"`
}

type PriceFeed struct {
	ID                string    `json:"ID"`
	AccountID         string    `json:"AccountID"`
	BaseAsset         string    `json:"BaseAsset"`
	QuoteAsset        string    `json:"QuoteAsset"`
	UpdateInterval    string    `json:"UpdateInterval"`
	HeartbeatInterval string    `json:"HeartbeatInterval"`
	DeviationPercent  float64   `json:"DeviationPercent"`
	Active            bool      `json:"Active"`
	CreatedAt         time.Time `json:"CreatedAt"`
	UpdatedAt         time.Time `json:"UpdatedAt"`
}

type PriceSnapshot struct {
	ID          string    `json:"ID"`
	FeedID      string    `json:"FeedID"`
	Price       float64   `json:"Price"`
	Source      string    `json:"Source"`
	CollectedAt time.Time `json:"CollectedAt"`
	CreatedAt   time.Time `json:"CreatedAt"`
}

type DataFeed struct {
	ID           string            `json:"ID"`
	AccountID    string            `json:"AccountID"`
	Pair         string            `json:"Pair"`
	Description  string            `json:"Description"`
	Decimals     int               `json:"Decimals"`
	HeartbeatSec int64             `json:"Heartbeat"`
	ThresholdPPM int               `json:"ThresholdPPM"`
	SignerSet    []string          `json:"SignerSet"`
	Aggregation  string            `json:"Aggregation"`
	Metadata     map[string]string `json:"Metadata,omitempty"`
	Tags         []string          `json:"Tags,omitempty"`
	CreatedAt    time.Time         `json:"CreatedAt"`
	UpdatedAt    time.Time         `json:"UpdatedAt"`
}

type DataFeedUpdate struct {
	ID        string            `json:"ID"`
	FeedID    string            `json:"FeedID"`
	RoundID   int64             `json:"RoundID"`
	Price     string            `json:"Price"`
	Signer    string            `json:"Signer"`
	Timestamp time.Time         `json:"Timestamp"`
	Signature string            `json:"Signature"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
}

type DataStream struct {
	ID          string            `json:"ID"`
	AccountID   string            `json:"AccountID"`
	Name        string            `json:"Name"`
	Symbol      string            `json:"Symbol"`
	Description string            `json:"Description"`
	Frequency   string            `json:"Frequency"`
	SLAms       int               `json:"SLAms"`
	Status      string            `json:"Status"`
	Metadata    map[string]string `json:"Metadata,omitempty"`
	CreatedAt   time.Time         `json:"CreatedAt"`
	UpdatedAt   time.Time         `json:"UpdatedAt"`
}

type DataStreamFrame struct {
	ID        string            `json:"ID"`
	StreamID  string            `json:"StreamID"`
	Sequence  int64             `json:"Sequence"`
	Payload   map[string]any    `json:"Payload"`
	LatencyMS int               `json:"LatencyMS"`
	Status    string            `json:"Status"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
}

type OracleSource struct {
	ID        string            `json:"ID"`
	AccountID string            `json:"AccountID"`
	Name      string            `json:"Name"`
	URL       string            `json:"URL"`
	Method    string            `json:"Method"`
	Headers   map[string]string `json:"Headers,omitempty"`
	Body      string            `json:"Body,omitempty"`
	Enabled   bool              `json:"Enabled"`
	CreatedAt time.Time         `json:"CreatedAt"`
	UpdatedAt time.Time         `json:"UpdatedAt"`
}

type OracleRequest struct {
	ID           string    `json:"ID"`
	AccountID    string    `json:"AccountID"`
	DataSourceID string    `json:"DataSourceID"`
	Payload      string    `json:"Payload"`
	Status       string    `json:"Status"`
	Result       string    `json:"Result,omitempty"`
	Error        string    `json:"Error,omitempty"`
	CreatedAt    time.Time `json:"CreatedAt"`
	UpdatedAt    time.Time `json:"UpdatedAt"`
	CompletedAt  time.Time `json:"CompletedAt,omitempty"`
}

type VRFKey struct {
	ID            string            `json:"ID"`
	AccountID     string            `json:"AccountID"`
	PublicKey     string            `json:"PublicKey"`
	Label         string            `json:"Label"`
	Status        string            `json:"Status"`
	WalletAddress string            `json:"WalletAddress"`
	Metadata      map[string]string `json:"Metadata,omitempty"`
	CreatedAt     time.Time         `json:"CreatedAt"`
	UpdatedAt     time.Time         `json:"UpdatedAt"`
}

type VRFRequest struct {
	ID          string            `json:"ID"`
	AccountID   string            `json:"AccountID"`
	KeyID       string            `json:"KeyID"`
	Consumer    string            `json:"Consumer"`
	Seed        string            `json:"Seed"`
	Status      string            `json:"Status"`
	Output      string            `json:"Output,omitempty"`
	Proof       string            `json:"Proof,omitempty"`
	Metadata    map[string]string `json:"Metadata,omitempty"`
	CreatedAt   time.Time         `json:"CreatedAt"`
	CompletedAt time.Time         `json:"CompletedAt,omitempty"`
}

type RandomRequest struct {
	ID          string    `json:"ID"`
	AccountID   string    `json:"AccountID"`
	Length      int       `json:"Length"`
	RequestID   string    `json:"RequestID"`
	Status      string    `json:"Status"`
	Value       string    `json:"Value,omitempty"`
	CreatedAt   time.Time `json:"CreatedAt"`
	CompletedAt time.Time `json:"CompletedAt,omitempty"`
}

type CCIPLane struct {
	ID             string            `json:"ID"`
	AccountID      string            `json:"AccountID"`
	Name           string            `json:"Name"`
	SourceChain    string            `json:"SourceChain"`
	DestChain      string            `json:"DestChain"`
	SignerSet      []string          `json:"SignerSet"`
	AllowedTokens  []string          `json:"AllowedTokens"`
	DeliveryPolicy map[string]any    `json:"DeliveryPolicy"`
	Metadata       map[string]string `json:"Metadata,omitempty"`
	Tags           []string          `json:"Tags,omitempty"`
	CreatedAt      time.Time         `json:"CreatedAt"`
	UpdatedAt      time.Time         `json:"UpdatedAt"`
}

type CCIPMessage struct {
	ID             string            `json:"ID"`
	AccountID      string            `json:"AccountID"`
	LaneID         string            `json:"LaneID"`
	Payload        map[string]any    `json:"Payload"`
	TokenTransfers []map[string]any  `json:"TokenTransfers,omitempty"`
	Status         string            `json:"Status"`
	Metadata       map[string]string `json:"Metadata,omitempty"`
	CreatedAt      time.Time         `json:"CreatedAt"`
}

type DataLinkChannel struct {
	ID        string            `json:"ID"`
	AccountID string            `json:"AccountID"`
	Name      string            `json:"Name"`
	Endpoint  string            `json:"Endpoint"`
	SignerSet []string          `json:"SignerSet"`
	Status    string            `json:"Status"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
	UpdatedAt time.Time         `json:"UpdatedAt"`
}

type DataLinkDelivery struct {
	ID        string            `json:"ID"`
	AccountID string            `json:"AccountID"`
	ChannelID string            `json:"ChannelID"`
	Payload   map[string]any    `json:"Payload"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	Status    string            `json:"Status"`
	CreatedAt time.Time         `json:"CreatedAt"`
}

type DTAProduct struct {
	ID              string            `json:"ID"`
	AccountID       string            `json:"AccountID"`
	Name            string            `json:"Name"`
	Symbol          string            `json:"Symbol"`
	Type            string            `json:"Type"`
	Status          string            `json:"Status"`
	SettlementTerms string            `json:"SettlementTerms"`
	Metadata        map[string]string `json:"Metadata,omitempty"`
	CreatedAt       time.Time         `json:"CreatedAt"`
	UpdatedAt       time.Time         `json:"UpdatedAt"`
}

type DTAOrder struct {
	ID            string            `json:"ID"`
	AccountID     string            `json:"AccountID"`
	ProductID     string            `json:"ProductID"`
	Type          string            `json:"Type"`
	Amount        string            `json:"Amount"`
	WalletAddress string            `json:"WalletAddress"`
	Status        string            `json:"Status"`
	Metadata      map[string]string `json:"Metadata,omitempty"`
	CreatedAt     time.Time         `json:"CreatedAt"`
}

type ConfEnclave struct {
	ID        string            `json:"ID"`
	AccountID string            `json:"AccountID"`
	Name      string            `json:"Name"`
	Endpoint  string            `json:"Endpoint"`
	Status    string            `json:"Status"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
	UpdatedAt time.Time         `json:"UpdatedAt"`
}

type ConfSealedKey struct {
	ID        string            `json:"ID"`
	AccountID string            `json:"AccountID"`
	EnclaveID string            `json:"EnclaveID"`
	Name      string            `json:"Name"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
}

type ConfAttestation struct {
	ID        string            `json:"ID"`
	AccountID string            `json:"AccountID"`
	EnclaveID string            `json:"EnclaveID"`
	Report    string            `json:"Report"`
	Status    string            `json:"Status"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
}

type CREPlaybook struct {
	ID          string            `json:"ID"`
	AccountID   string            `json:"AccountID"`
	Name        string            `json:"Name"`
	Description string            `json:"Description"`
	Tags        []string          `json:"Tags,omitempty"`
	Metadata    map[string]string `json:"Metadata,omitempty"`
	Steps       []map[string]any  `json:"Steps,omitempty"`
	CreatedAt   time.Time         `json:"CreatedAt"`
	UpdatedAt   time.Time         `json:"UpdatedAt"`
}

type CREExecutor struct {
	ID        string            `json:"ID"`
	AccountID string            `json:"AccountID"`
	Name      string            `json:"Name"`
	Type      string            `json:"Type"`
	Endpoint  string            `json:"Endpoint"`
	Metadata  map[string]string `json:"Metadata,omitempty"`
	Tags      []string          `json:"Tags,omitempty"`
	CreatedAt time.Time         `json:"CreatedAt"`
	UpdatedAt time.Time         `json:"UpdatedAt"`
}

type CRERun struct {
	ID          string         `json:"ID"`
	AccountID   string         `json:"AccountID"`
	PlaybookID  string         `json:"PlaybookID"`
	ExecutorID  string         `json:"ExecutorID"`
	Status      string         `json:"Status"`
	Params      map[string]any `json:"Params,omitempty"`
	Result      map[string]any `json:"Result,omitempty"`
	Error       string         `json:"Error,omitempty"`
	Tags        []string       `json:"Tags,omitempty"`
	CreatedAt   time.Time      `json:"CreatedAt"`
	CompletedAt time.Time      `json:"CompletedAt,omitempty"`
}

type ComputeResult struct {
	Module string      `json:"module"`
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

// ============================================================================ //
// Accounts & Wallets
// ============================================================================ //

type AccountsService struct{ client *Client }

func (s *AccountsService) Create(ctx context.Context, owner string, metadata map[string]string) (*Account, error) {
	var result Account
	err := s.client.request(ctx, http.MethodPost, "/accounts", nil, map[string]any{
		"owner":    owner,
		"metadata": metadata,
	}, &result)
	return &result, err
}

func (s *AccountsService) List(ctx context.Context) ([]Account, error) {
	var result []Account
	err := s.client.request(ctx, http.MethodGet, "/accounts", nil, nil, &result)
	return result, err
}

func (s *AccountsService) Get(ctx context.Context, id string) (*Account, error) {
	var result Account
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+id, nil, nil, &result)
	return &result, err
}

func (s *AccountsService) Delete(ctx context.Context, id string) error {
	return s.client.request(ctx, http.MethodDelete, "/accounts/"+id, nil, nil, nil)
}

type WorkspaceWalletsService struct{ client *Client }

type CreateWorkspaceWalletRequest struct {
	WalletAddress string `json:"wallet_address"`
	Label         string `json:"label,omitempty"`
	Status        string `json:"status,omitempty"`
}

func (s *WorkspaceWalletsService) Create(ctx context.Context, accountID string, req CreateWorkspaceWalletRequest) (*WorkspaceWallet, error) {
	var result WorkspaceWallet
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/workspace-wallets", nil, req, &result)
	return &result, err
}

func (s *WorkspaceWalletsService) List(ctx context.Context, accountID string) ([]WorkspaceWallet, error) {
	var result []WorkspaceWallet
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/workspace-wallets", nil, nil, &result)
	return result, err
}

func (s *WorkspaceWalletsService) Get(ctx context.Context, accountID, walletID string) (*WorkspaceWallet, error) {
	var result WorkspaceWallet
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/workspace-wallets/"+walletID, nil, nil, &result)
	return &result, err
}

// ============================================================================ //
// Functions & Triggers
// ============================================================================ //

type FunctionsService struct{ client *Client }

type CreateFunctionParams struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Source      string   `json:"source"`
	Secrets     []string `json:"secrets,omitempty"`
}

func (s *FunctionsService) Create(ctx context.Context, accountID string, params CreateFunctionParams) (*Function, error) {
	var result Function
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/functions", nil, params, &result)
	return &result, err
}

func (s *FunctionsService) List(ctx context.Context, accountID string) ([]Function, error) {
	var result []Function
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/functions", nil, nil, &result)
	return result, err
}

func (s *FunctionsService) Execute(ctx context.Context, accountID, functionID string, input map[string]any) (*FunctionExecution, error) {
	var result FunctionExecution
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/functions/"+functionID+"/execute", nil, input, &result)
	return &result, err
}

func (s *FunctionsService) ListExecutions(ctx context.Context, accountID, functionID string, p PaginationParams) ([]FunctionExecution, error) {
	var result []FunctionExecution
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/functions/"+functionID+"/executions", p.asQuery(), nil, &result)
	return result, err
}

func (s *FunctionsService) GetExecution(ctx context.Context, accountID, executionID string) (*FunctionExecution, error) {
	var result FunctionExecution
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/functions/executions/"+executionID, nil, nil, &result)
	return &result, err
}

type TriggersService struct{ client *Client }

type CreateTriggerParams struct {
	FunctionID string            `json:"function_id"`
	Type       string            `json:"type"`
	Rule       string            `json:"rule,omitempty"`
	Config     map[string]string `json:"config,omitempty"`
	Enabled    *bool             `json:"enabled,omitempty"`
}

func (s *TriggersService) Create(ctx context.Context, accountID string, params CreateTriggerParams) (*Trigger, error) {
	var result Trigger
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/triggers", nil, params, &result)
	return &result, err
}

func (s *TriggersService) List(ctx context.Context, accountID string) ([]Trigger, error) {
	var result []Trigger
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/triggers", nil, nil, &result)
	return result, err
}

// ============================================================================ //
// Secrets
// ============================================================================ //

type SecretsService struct{ client *Client }

type CreateSecretParams struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	ACL      uint8  `json:"acl,omitempty"`
	TenantID string `json:"tenant_id,omitempty"`
}

func (s *SecretsService) Create(ctx context.Context, accountID string, params CreateSecretParams) (*Secret, error) {
	var result Secret
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/secrets", nil, params, &result)
	return &result, err
}

func (s *SecretsService) List(ctx context.Context, accountID string) ([]Secret, error) {
	var result []Secret
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/secrets", nil, nil, &result)
	return result, err
}

func (s *SecretsService) Get(ctx context.Context, accountID, name string) (*Secret, error) {
	var result Secret
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/secrets/"+url.PathEscape(name), nil, nil, &result)
	return &result, err
}

type UpdateSecretParams struct {
	Value string `json:"value,omitempty"`
	ACL   uint8  `json:"acl,omitempty"`
}

func (s *SecretsService) Update(ctx context.Context, accountID, name string, params UpdateSecretParams) (*Secret, error) {
	var result Secret
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/secrets/"+url.PathEscape(name), nil, params, &result)
	return &result, err
}

func (s *SecretsService) Delete(ctx context.Context, accountID, name string) error {
	return s.client.request(ctx, http.MethodDelete, "/accounts/"+accountID+"/secrets/"+url.PathEscape(name), nil, nil, nil)
}

// ============================================================================ //
// Gas Bank
// ============================================================================ //

type GasBankService struct{ client *Client }

type EnsureGasAccountOptions struct {
	WalletAddress         string   `json:"wallet_address"`
	MinBalance            *float64 `json:"min_balance,omitempty"`
	DailyLimit            *float64 `json:"daily_limit,omitempty"`
	NotificationThreshold *float64 `json:"notification_threshold,omitempty"`
	RequiredApprovals     *int     `json:"required_approvals,omitempty"`
}

type GasDepositRequest struct {
	GasAccountID string  `json:"gas_account_id"`
	Amount       float64 `json:"amount"`
	TxID         string  `json:"tx_id"`
	FromAddress  string  `json:"from_address,omitempty"`
	ToAddress    string  `json:"to_address,omitempty"`
}

type GasWithdrawRequest struct {
	GasAccountID string  `json:"gas_account_id"`
	Amount       float64 `json:"amount"`
	ToAddress    string  `json:"to_address"`
	ScheduleAt   string  `json:"schedule_at,omitempty"`
}

type GasTransactionFilter struct {
	GasAccountID string
	Type         string
	Status       string
	Limit        int
}

type gasOperationResponse struct {
	Account     GasAccount     `json:"account"`
	Transaction GasTransaction `json:"transaction"`
}

func (s *GasBankService) EnsureAccount(ctx context.Context, accountID string, opts EnsureGasAccountOptions) (*GasAccount, error) {
	var result GasAccount
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/gasbank", nil, opts, &result)
	return &result, err
}

func (s *GasBankService) ListAccounts(ctx context.Context, accountID string) ([]GasAccount, error) {
	var result []GasAccount
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank", nil, nil, &result)
	return result, err
}

func (s *GasBankService) Summary(ctx context.Context, accountID string) (*GasSummary, error) {
	var result GasSummary
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank/summary", nil, nil, &result)
	return &result, err
}

func (s *GasBankService) Deposit(ctx context.Context, accountID string, req GasDepositRequest) (*GasAccount, *GasTransaction, error) {
	var result gasOperationResponse
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/gasbank/deposit", nil, req, &result)
	return &result.Account, &result.Transaction, err
}

func (s *GasBankService) Withdraw(ctx context.Context, accountID string, req GasWithdrawRequest) (*GasAccount, *GasTransaction, error) {
	var result gasOperationResponse
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/gasbank/withdraw", nil, req, &result)
	return &result.Account, &result.Transaction, err
}

func (s *GasBankService) ListTransactions(ctx context.Context, accountID string, filter GasTransactionFilter) ([]GasTransaction, error) {
	query := url.Values{}
	if filter.GasAccountID != "" {
		query.Set("gas_account_id", filter.GasAccountID)
	}
	if filter.Type != "" {
		query.Set("type", filter.Type)
	}
	if filter.Status != "" {
		query.Set("status", filter.Status)
	}
	if filter.Limit > 0 {
		query.Set("limit", strconv.Itoa(filter.Limit))
	}
	var result []GasTransaction
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank/transactions", query, nil, &result)
	return result, err
}

func (s *GasBankService) ListWithdrawals(ctx context.Context, accountID string, gasAccountID string, filter GasTransactionFilter) ([]GasTransaction, error) {
	filter.GasAccountID = gasAccountID
	query := url.Values{}
	query.Set("gas_account_id", gasAccountID)
	if filter.Status != "" {
		query.Set("status", filter.Status)
	}
	if filter.Limit > 0 {
		query.Set("limit", strconv.Itoa(filter.Limit))
	}
	var result []GasTransaction
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank/withdrawals", query, nil, &result)
	return result, err
}

func (s *GasBankService) GetWithdrawal(ctx context.Context, accountID, withdrawalID string) (*GasTransaction, error) {
	var result GasTransaction
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank/withdrawals/"+withdrawalID, nil, nil, &result)
	return &result, err
}

func (s *GasBankService) ListAttempts(ctx context.Context, accountID, withdrawalID string, limit int) ([]SettlementAttempt, error) {
	query := url.Values{}
	if limit > 0 {
		query.Set("limit", strconv.Itoa(limit))
	}
	var result []SettlementAttempt
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank/withdrawals/"+withdrawalID+"/attempts", query, nil, &result)
	return result, err
}

func (s *GasBankService) ListDeadLetters(ctx context.Context, accountID string, limit int) ([]DeadLetter, error) {
	query := url.Values{}
	if limit > 0 {
		query.Set("limit", strconv.Itoa(limit))
	}
	var result []DeadLetter
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/gasbank/deadletters", query, nil, &result)
	return result, err
}

func (s *GasBankService) RetryDeadLetter(ctx context.Context, accountID, transactionID string) (*GasTransaction, error) {
	var result GasTransaction
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/gasbank/deadletters/"+transactionID+"/retry", nil, nil, &result)
	return &result, err
}

func (s *GasBankService) DeleteDeadLetter(ctx context.Context, accountID, transactionID string) error {
	return s.client.request(ctx, http.MethodDelete, "/accounts/"+accountID+"/gasbank/deadletters/"+transactionID, nil, nil, nil)
}

// ============================================================================ //
// Automation
// ============================================================================ //

type AutomationService struct{ client *Client }

type CreateJobParams struct {
	FunctionID  string `json:"function_id"`
	Name        string `json:"name"`
	Schedule    string `json:"schedule"`
	Description string `json:"description,omitempty"`
}

type UpdateJobParams struct {
	Name        *string `json:"name,omitempty"`
	Schedule    *string `json:"schedule,omitempty"`
	Description *string `json:"description,omitempty"`
	Enabled     *bool   `json:"enabled,omitempty"`
	NextRun     *string `json:"next_run,omitempty"`
}

func (s *AutomationService) CreateJob(ctx context.Context, accountID string, params CreateJobParams) (*AutomationJob, error) {
	var result AutomationJob
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/automation/jobs", nil, params, &result)
	return &result, err
}

func (s *AutomationService) ListJobs(ctx context.Context, accountID string) ([]AutomationJob, error) {
	var result []AutomationJob
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/automation/jobs", nil, nil, &result)
	return result, err
}

func (s *AutomationService) GetJob(ctx context.Context, accountID, jobID string) (*AutomationJob, error) {
	var result AutomationJob
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/automation/jobs/"+jobID, nil, nil, &result)
	return &result, err
}

func (s *AutomationService) UpdateJob(ctx context.Context, accountID, jobID string, params UpdateJobParams) (*AutomationJob, error) {
	var result AutomationJob
	err := s.client.request(ctx, http.MethodPatch, "/accounts/"+accountID+"/automation/jobs/"+jobID, nil, params, &result)
	return &result, err
}

// ============================================================================ //
// Price Feeds
// ============================================================================ //

type PriceFeedsService struct{ client *Client }

type CreatePriceFeedParams struct {
	BaseAsset         string  `json:"base_asset"`
	QuoteAsset        string  `json:"quote_asset"`
	UpdateInterval    string  `json:"update_interval"`
	HeartbeatInterval string  `json:"heartbeat_interval"`
	DeviationPercent  float64 `json:"deviation_percent"`
}

type UpdatePriceFeedParams struct {
	UpdateInterval    *string  `json:"update_interval,omitempty"`
	HeartbeatInterval *string  `json:"heartbeat_interval,omitempty"`
	DeviationPercent  *float64 `json:"deviation_percent,omitempty"`
	Active            *bool    `json:"active,omitempty"`
}

type RecordSnapshotParams struct {
	Price       float64 `json:"price"`
	Source      string  `json:"source,omitempty"`
	CollectedAt string  `json:"collected_at,omitempty"`
}

func (s *PriceFeedsService) Create(ctx context.Context, accountID string, params CreatePriceFeedParams) (*PriceFeed, error) {
	var result PriceFeed
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/pricefeeds", nil, params, &result)
	return &result, err
}

func (s *PriceFeedsService) List(ctx context.Context, accountID string) ([]PriceFeed, error) {
	var result []PriceFeed
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/pricefeeds", nil, nil, &result)
	return result, err
}

func (s *PriceFeedsService) Get(ctx context.Context, accountID, feedID string) (*PriceFeed, error) {
	var result PriceFeed
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/pricefeeds/"+feedID, nil, nil, &result)
	return &result, err
}

func (s *PriceFeedsService) Update(ctx context.Context, accountID, feedID string, params UpdatePriceFeedParams) (*PriceFeed, error) {
	var result PriceFeed
	err := s.client.request(ctx, http.MethodPatch, "/accounts/"+accountID+"/pricefeeds/"+feedID, nil, params, &result)
	return &result, err
}

func (s *PriceFeedsService) RecordSnapshot(ctx context.Context, accountID, feedID string, params RecordSnapshotParams) (*PriceSnapshot, error) {
	var result PriceSnapshot
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/pricefeeds/"+feedID+"/snapshots", nil, params, &result)
	return &result, err
}

func (s *PriceFeedsService) ListSnapshots(ctx context.Context, accountID, feedID string) ([]PriceSnapshot, error) {
	var result []PriceSnapshot
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/pricefeeds/"+feedID+"/snapshots", nil, nil, &result)
	return result, err
}

// ============================================================================ //
// Data Feeds
// ============================================================================ //

type DataFeedsService struct{ client *Client }

type CreateDataFeedParams struct {
	Pair         string            `json:"pair"`
	Description  string            `json:"description,omitempty"`
	Decimals     int               `json:"decimals,omitempty"`
	HeartbeatSec int64             `json:"heartbeat_seconds,omitempty"`
	ThresholdPPM int               `json:"threshold_ppm,omitempty"`
	SignerSet    []string          `json:"signer_set,omitempty"`
	Aggregation  string            `json:"aggregation,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	Tags         []string          `json:"tags,omitempty"`
}

type UpdateDataFeedParams = CreateDataFeedParams

type SubmitUpdateParams struct {
	RoundID   int64             `json:"round_id"`
	Price     string            `json:"price"`
	Signer    string            `json:"signer"`
	Timestamp time.Time         `json:"timestamp"`
	Signature string            `json:"signature"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

func (s *DataFeedsService) Create(ctx context.Context, accountID string, params CreateDataFeedParams) (*DataFeed, error) {
	var result DataFeed
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/datafeeds", nil, params, &result)
	return &result, err
}

func (s *DataFeedsService) List(ctx context.Context, accountID string) ([]DataFeed, error) {
	var result []DataFeed
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datafeeds", nil, nil, &result)
	return result, err
}

func (s *DataFeedsService) Get(ctx context.Context, accountID, feedID string) (*DataFeed, error) {
	var result DataFeed
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datafeeds/"+feedID, nil, nil, &result)
	return &result, err
}

func (s *DataFeedsService) Update(ctx context.Context, accountID, feedID string, params UpdateDataFeedParams) (*DataFeed, error) {
	var result DataFeed
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/datafeeds/"+feedID, nil, params, &result)
	return &result, err
}

func (s *DataFeedsService) SubmitUpdate(ctx context.Context, accountID, feedID string, params SubmitUpdateParams) (*DataFeedUpdate, error) {
	var result DataFeedUpdate
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/datafeeds/"+feedID+"/updates", nil, params, &result)
	return &result, err
}

func (s *DataFeedsService) ListUpdates(ctx context.Context, accountID, feedID string, p PaginationParams) ([]DataFeedUpdate, error) {
	var result []DataFeedUpdate
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datafeeds/"+feedID+"/updates", p.asQuery(), nil, &result)
	return result, err
}

func (s *DataFeedsService) Latest(ctx context.Context, accountID, feedID string) (*DataFeedUpdate, error) {
	var result DataFeedUpdate
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datafeeds/"+feedID+"/latest", nil, nil, &result)
	return &result, err
}

// ============================================================================ //
// Data Streams
// ============================================================================ //

type DataStreamsService struct{ client *Client }

type CreateStreamParams struct {
	Name        string            `json:"name"`
	Symbol      string            `json:"symbol,omitempty"`
	Description string            `json:"description,omitempty"`
	Frequency   string            `json:"frequency,omitempty"`
	SLAms       int               `json:"sla_ms,omitempty"`
	Status      string            `json:"status,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type UpdateStreamParams = CreateStreamParams

type CreateFrameParams struct {
	Sequence  int64             `json:"sequence"`
	Payload   map[string]any    `json:"payload"`
	LatencyMS int               `json:"latency_ms,omitempty"`
	Status    string            `json:"status,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

func (s *DataStreamsService) Create(ctx context.Context, accountID string, params CreateStreamParams) (*DataStream, error) {
	var result DataStream
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/datastreams", nil, params, &result)
	return &result, err
}

func (s *DataStreamsService) List(ctx context.Context, accountID string) ([]DataStream, error) {
	var result []DataStream
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datastreams", nil, nil, &result)
	return result, err
}

func (s *DataStreamsService) Get(ctx context.Context, accountID, streamID string) (*DataStream, error) {
	var result DataStream
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datastreams/"+streamID, nil, nil, &result)
	return &result, err
}

func (s *DataStreamsService) Update(ctx context.Context, accountID, streamID string, params UpdateStreamParams) (*DataStream, error) {
	var result DataStream
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/datastreams/"+streamID, nil, params, &result)
	return &result, err
}

func (s *DataStreamsService) CreateFrame(ctx context.Context, accountID, streamID string, params CreateFrameParams) (*DataStreamFrame, error) {
	var result DataStreamFrame
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/datastreams/"+streamID+"/frames", nil, params, &result)
	return &result, err
}

func (s *DataStreamsService) ListFrames(ctx context.Context, accountID, streamID string, p PaginationParams) ([]DataStreamFrame, error) {
	var result []DataStreamFrame
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datastreams/"+streamID+"/frames", p.asQuery(), nil, &result)
	return result, err
}

// ============================================================================ //
// Oracle
// ============================================================================ //

type OracleService struct{ client *Client }

type CreateSourceParams struct {
	Name     string            `json:"name"`
	URL      string            `json:"url"`
	Method   string            `json:"method"`
	Headers  map[string]string `json:"headers,omitempty"`
	Body     string            `json:"body,omitempty"`
	Enabled  *bool             `json:"enabled,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

type CreateOracleRequestParams struct {
	DataSourceID string `json:"data_source_id"`
	Payload      string `json:"payload"`
}

type UpdateOracleRequestParams struct {
	Status string `json:"status"`
	Result string `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

func (s *OracleService) CreateSource(ctx context.Context, accountID string, params CreateSourceParams) (*OracleSource, error) {
	var result OracleSource
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/oracle/sources", nil, params, &result)
	return &result, err
}

func (s *OracleService) ListSources(ctx context.Context, accountID string) ([]OracleSource, error) {
	var result []OracleSource
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/oracle/sources", nil, nil, &result)
	return result, err
}

func (s *OracleService) CreateRequest(ctx context.Context, accountID string, params CreateOracleRequestParams) (*OracleRequest, error) {
	var result OracleRequest
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/oracle/requests", nil, params, &result)
	return &result, err
}

func (s *OracleService) ListRequests(ctx context.Context, accountID string, status string, p PaginationParams) ([]OracleRequest, error) {
	query := p.asQuery()
	if status != "" {
		query.Set("status", status)
	}
	var result []OracleRequest
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/oracle/requests", query, nil, &result)
	return result, err
}

func (s *OracleService) UpdateRequest(ctx context.Context, accountID, requestID string, params UpdateOracleRequestParams) (*OracleRequest, error) {
	var result OracleRequest
	err := s.client.request(ctx, http.MethodPatch, "/accounts/"+accountID+"/oracle/requests/"+requestID, nil, params, &result)
	return &result, err
}

// ============================================================================ //
// VRF & Random
// ============================================================================ //

type VRFService struct{ client *Client }

type CreateVRFKeyParams struct {
	PublicKey     string            `json:"public_key,omitempty"`
	Label         string            `json:"label,omitempty"`
	Status        string            `json:"status,omitempty"`
	WalletAddress string            `json:"wallet_address,omitempty"`
	Attestation   string            `json:"attestation,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type UpdateVRFKeyParams = CreateVRFKeyParams

type CreateVRFRequestParams struct {
	Consumer string            `json:"consumer"`
	Seed     string            `json:"seed"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

func (s *VRFService) CreateKey(ctx context.Context, accountID string, params CreateVRFKeyParams) (*VRFKey, error) {
	var result VRFKey
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/vrf/keys", nil, params, &result)
	return &result, err
}

func (s *VRFService) ListKeys(ctx context.Context, accountID string) ([]VRFKey, error) {
	var result []VRFKey
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/vrf/keys", nil, nil, &result)
	return result, err
}

func (s *VRFService) GetKey(ctx context.Context, accountID, keyID string) (*VRFKey, error) {
	var result VRFKey
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/vrf/keys/"+keyID, nil, nil, &result)
	return &result, err
}

func (s *VRFService) UpdateKey(ctx context.Context, accountID, keyID string, params UpdateVRFKeyParams) (*VRFKey, error) {
	var result VRFKey
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/vrf/keys/"+keyID, nil, params, &result)
	return &result, err
}

func (s *VRFService) CreateRequest(ctx context.Context, accountID, keyID string, params CreateVRFRequestParams) (*VRFRequest, error) {
	var result VRFRequest
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/vrf/keys/"+keyID+"/requests", nil, params, &result)
	return &result, err
}

func (s *VRFService) ListRequests(ctx context.Context, accountID string, p PaginationParams) ([]VRFRequest, error) {
	var result []VRFRequest
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/vrf/requests", p.asQuery(), nil, &result)
	return result, err
}

func (s *VRFService) GetRequest(ctx context.Context, accountID, requestID string) (*VRFRequest, error) {
	var result VRFRequest
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/vrf/requests/"+requestID, nil, nil, &result)
	return &result, err
}

type RandomService struct{ client *Client }

type GenerateRandomParams struct {
	Length    int    `json:"length"`
	RequestID string `json:"request_id,omitempty"`
}

func (s *RandomService) Generate(ctx context.Context, accountID string, params GenerateRandomParams) (*RandomRequest, error) {
	var result RandomRequest
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/random", nil, params, &result)
	return &result, err
}

func (s *RandomService) List(ctx context.Context, accountID string, p PaginationParams) ([]RandomRequest, error) {
	var result []RandomRequest
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/random/requests", p.asQuery(), nil, &result)
	return result, err
}

// ============================================================================ //
// CCIP / DataLink
// ============================================================================ //

type CCIPService struct{ client *Client }

type CreateLaneParams struct {
	Name           string            `json:"name"`
	SourceChain    string            `json:"source_chain"`
	DestChain      string            `json:"dest_chain"`
	SignerSet      []string          `json:"signer_set,omitempty"`
	AllowedTokens  []string          `json:"allowed_tokens,omitempty"`
	DeliveryPolicy map[string]any    `json:"delivery_policy,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	Tags           []string          `json:"tags,omitempty"`
}

type UpdateLaneParams = CreateLaneParams

type SendCCIPMessageParams struct {
	Payload        map[string]any    `json:"payload"`
	TokenTransfers []map[string]any  `json:"token_transfers,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	Tags           []string          `json:"tags,omitempty"`
}

func (s *CCIPService) CreateLane(ctx context.Context, accountID string, params CreateLaneParams) (*CCIPLane, error) {
	var result CCIPLane
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/ccip/lanes", nil, params, &result)
	return &result, err
}

func (s *CCIPService) ListLanes(ctx context.Context, accountID string) ([]CCIPLane, error) {
	var result []CCIPLane
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/ccip/lanes", nil, nil, &result)
	return result, err
}

func (s *CCIPService) GetLane(ctx context.Context, accountID, laneID string) (*CCIPLane, error) {
	var result CCIPLane
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/ccip/lanes/"+laneID, nil, nil, &result)
	return &result, err
}

func (s *CCIPService) UpdateLane(ctx context.Context, accountID, laneID string, params UpdateLaneParams) (*CCIPLane, error) {
	var result CCIPLane
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/ccip/lanes/"+laneID, nil, params, &result)
	return &result, err
}

func (s *CCIPService) SendMessage(ctx context.Context, accountID, laneID string, params SendCCIPMessageParams) (*CCIPMessage, error) {
	var result CCIPMessage
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/ccip/lanes/"+laneID+"/messages", nil, params, &result)
	return &result, err
}

func (s *CCIPService) ListMessages(ctx context.Context, accountID string, p PaginationParams) ([]CCIPMessage, error) {
	var result []CCIPMessage
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/ccip/messages", p.asQuery(), nil, &result)
	return result, err
}

func (s *CCIPService) GetMessage(ctx context.Context, accountID, messageID string) (*CCIPMessage, error) {
	var result CCIPMessage
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/ccip/messages/"+messageID, nil, nil, &result)
	return &result, err
}

type DataLinkService struct{ client *Client }

type CreateChannelParams struct {
	Name      string            `json:"name"`
	Endpoint  string            `json:"endpoint"`
	AuthToken string            `json:"auth_token,omitempty"`
	SignerSet []string          `json:"signer_set"`
	Status    string            `json:"status,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type UpdateChannelParams = CreateChannelParams

type CreateDeliveryParams struct {
	Payload  map[string]any    `json:"payload"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

func (s *DataLinkService) CreateChannel(ctx context.Context, accountID string, params CreateChannelParams) (*DataLinkChannel, error) {
	var result DataLinkChannel
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/datalink/channels", nil, params, &result)
	return &result, err
}

func (s *DataLinkService) ListChannels(ctx context.Context, accountID string) ([]DataLinkChannel, error) {
	var result []DataLinkChannel
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datalink/channels", nil, nil, &result)
	return result, err
}

func (s *DataLinkService) GetChannel(ctx context.Context, accountID, channelID string) (*DataLinkChannel, error) {
	var result DataLinkChannel
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datalink/channels/"+channelID, nil, nil, &result)
	return &result, err
}

func (s *DataLinkService) UpdateChannel(ctx context.Context, accountID, channelID string, params UpdateChannelParams) (*DataLinkChannel, error) {
	var result DataLinkChannel
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/datalink/channels/"+channelID, nil, params, &result)
	return &result, err
}

func (s *DataLinkService) CreateDelivery(ctx context.Context, accountID, channelID string, params CreateDeliveryParams) (*DataLinkDelivery, error) {
	var result DataLinkDelivery
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/datalink/channels/"+channelID+"/deliveries", nil, params, &result)
	return &result, err
}

func (s *DataLinkService) ListDeliveries(ctx context.Context, accountID string, p PaginationParams) ([]DataLinkDelivery, error) {
	var result []DataLinkDelivery
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datalink/deliveries", p.asQuery(), nil, &result)
	return result, err
}

func (s *DataLinkService) GetDelivery(ctx context.Context, accountID, deliveryID string) (*DataLinkDelivery, error) {
	var result DataLinkDelivery
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/datalink/deliveries/"+deliveryID, nil, nil, &result)
	return &result, err
}

// ============================================================================ //
// DTA
// ============================================================================ //

type DTAService struct{ client *Client }

type CreateProductParams struct {
	Name            string            `json:"name"`
	Symbol          string            `json:"symbol"`
	Type            string            `json:"type"`
	Status          string            `json:"status,omitempty"`
	SettlementTerms string            `json:"settlement_terms,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

type UpdateProductParams = CreateProductParams

type CreateOrderParams struct {
	Type          string            `json:"type"`
	Amount        string            `json:"amount"`
	WalletAddress string            `json:"wallet_address"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

func (s *DTAService) CreateProduct(ctx context.Context, accountID string, params CreateProductParams) (*DTAProduct, error) {
	var result DTAProduct
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/dta/products", nil, params, &result)
	return &result, err
}

func (s *DTAService) ListProducts(ctx context.Context, accountID string) ([]DTAProduct, error) {
	var result []DTAProduct
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/dta/products", nil, nil, &result)
	return result, err
}

func (s *DTAService) GetProduct(ctx context.Context, accountID, productID string) (*DTAProduct, error) {
	var result DTAProduct
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/dta/products/"+productID, nil, nil, &result)
	return &result, err
}

func (s *DTAService) UpdateProduct(ctx context.Context, accountID, productID string, params UpdateProductParams) (*DTAProduct, error) {
	var result DTAProduct
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/dta/products/"+productID, nil, params, &result)
	return &result, err
}

func (s *DTAService) CreateOrder(ctx context.Context, accountID, productID string, params CreateOrderParams) (*DTAOrder, error) {
	var result DTAOrder
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/dta/products/"+productID+"/orders", nil, params, &result)
	return &result, err
}

func (s *DTAService) ListOrders(ctx context.Context, accountID string, p PaginationParams) ([]DTAOrder, error) {
	var result []DTAOrder
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/dta/orders", p.asQuery(), nil, &result)
	return result, err
}

func (s *DTAService) GetOrder(ctx context.Context, accountID, orderID string) (*DTAOrder, error) {
	var result DTAOrder
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/dta/orders/"+orderID, nil, nil, &result)
	return &result, err
}

// ============================================================================ //
// Confidential Compute
// ============================================================================ //

type ConfidentialService struct{ client *Client }

type CreateEnclaveParams struct {
	Name        string            `json:"name"`
	Endpoint    string            `json:"endpoint"`
	Provider    string            `json:"provider,omitempty"`
	Attestation string            `json:"attestation,omitempty"`
	Measurement string            `json:"measurement,omitempty"`
	Status      string            `json:"status,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type UpdateEnclaveParams = CreateEnclaveParams

type CreateSealedKeyParams struct {
	EnclaveID string            `json:"enclave_id"`
	Name      string            `json:"name"`
	Blob      []byte            `json:"blob"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type CreateAttestationParams struct {
	EnclaveID string            `json:"enclave_id"`
	Report    string            `json:"report"`
	Status    string            `json:"status"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

func (s *ConfidentialService) CreateEnclave(ctx context.Context, accountID string, params CreateEnclaveParams) (*ConfEnclave, error) {
	var result ConfEnclave
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/confcompute/enclaves", nil, params, &result)
	return &result, err
}

func (s *ConfidentialService) ListEnclaves(ctx context.Context, accountID string) ([]ConfEnclave, error) {
	var result []ConfEnclave
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/confcompute/enclaves", nil, nil, &result)
	return result, err
}

func (s *ConfidentialService) GetEnclave(ctx context.Context, accountID, enclaveID string) (*ConfEnclave, error) {
	var result ConfEnclave
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/confcompute/enclaves/"+enclaveID, nil, nil, &result)
	return &result, err
}

func (s *ConfidentialService) UpdateEnclave(ctx context.Context, accountID, enclaveID string, params UpdateEnclaveParams) (*ConfEnclave, error) {
	var result ConfEnclave
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/confcompute/enclaves/"+enclaveID, nil, params, &result)
	return &result, err
}

func (s *ConfidentialService) CreateSealedKey(ctx context.Context, accountID string, params CreateSealedKeyParams) (*ConfSealedKey, error) {
	var result ConfSealedKey
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/confcompute/sealed_keys", nil, params, &result)
	return &result, err
}

func (s *ConfidentialService) ListSealedKeys(ctx context.Context, accountID, enclaveID string, p PaginationParams) ([]ConfSealedKey, error) {
	query := p.asQuery()
	if enclaveID != "" {
		query.Set("enclave_id", enclaveID)
	}
	var result []ConfSealedKey
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/confcompute/sealed_keys", query, nil, &result)
	return result, err
}

func (s *ConfidentialService) CreateAttestation(ctx context.Context, accountID string, params CreateAttestationParams) (*ConfAttestation, error) {
	var result ConfAttestation
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/confcompute/attestations", nil, params, &result)
	return &result, err
}

func (s *ConfidentialService) ListAttestations(ctx context.Context, accountID string, enclaveID string, p PaginationParams) ([]ConfAttestation, error) {
	query := p.asQuery()
	if enclaveID != "" {
		query.Set("enclave_id", enclaveID)
	}
	var result []ConfAttestation
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/confcompute/attestations", query, nil, &result)
	return result, err
}

// ============================================================================ //
// CRE
// ============================================================================ //

type CREService struct{ client *Client }

type CreatePlaybookParams struct {
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	Steps       []map[string]any  `json:"steps,omitempty"`
}

type UpdatePlaybookParams = CreatePlaybookParams

type CreateExecutorParams struct {
	Name     string            `json:"name"`
	Type     string            `json:"type"`
	Endpoint string            `json:"endpoint"`
	Metadata map[string]string `json:"metadata,omitempty"`
	Tags     []string          `json:"tags,omitempty"`
}

type UpdateExecutorParams = CreateExecutorParams

type CreateRunParams struct {
	PlaybookID string         `json:"playbook_id"`
	ExecutorID string         `json:"executor_id,omitempty"`
	Params     map[string]any `json:"params,omitempty"`
	Tags       []string       `json:"tags,omitempty"`
}

func (s *CREService) CreatePlaybook(ctx context.Context, accountID string, params CreatePlaybookParams) (*CREPlaybook, error) {
	var result CREPlaybook
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/cre/playbooks", nil, params, &result)
	return &result, err
}

func (s *CREService) ListPlaybooks(ctx context.Context, accountID string) ([]CREPlaybook, error) {
	var result []CREPlaybook
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/cre/playbooks", nil, nil, &result)
	return result, err
}

func (s *CREService) GetPlaybook(ctx context.Context, accountID, playbookID string) (*CREPlaybook, error) {
	var result CREPlaybook
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/cre/playbooks/"+playbookID, nil, nil, &result)
	return &result, err
}

func (s *CREService) UpdatePlaybook(ctx context.Context, accountID, playbookID string, params UpdatePlaybookParams) (*CREPlaybook, error) {
	var result CREPlaybook
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/cre/playbooks/"+playbookID, nil, params, &result)
	return &result, err
}

func (s *CREService) CreateRun(ctx context.Context, accountID string, params CreateRunParams) (*CRERun, error) {
	var result CRERun
	path := "/accounts/" + accountID + "/cre/runs"
	if strings.TrimSpace(params.PlaybookID) != "" {
		path = "/accounts/" + accountID + "/cre/playbooks/" + params.PlaybookID + "/runs"
	}
	err := s.client.request(ctx, http.MethodPost, path, nil, params, &result)
	return &result, err
}

func (s *CREService) ListRuns(ctx context.Context, accountID string, p PaginationParams) ([]CRERun, error) {
	var result []CRERun
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/cre/runs", p.asQuery(), nil, &result)
	return result, err
}

func (s *CREService) GetRun(ctx context.Context, accountID, runID string) (*CRERun, error) {
	var result CRERun
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/cre/runs/"+runID, nil, nil, &result)
	return &result, err
}

func (s *CREService) CreateExecutor(ctx context.Context, accountID string, params CreateExecutorParams) (*CREExecutor, error) {
	var result CREExecutor
	err := s.client.request(ctx, http.MethodPost, "/accounts/"+accountID+"/cre/executors", nil, params, &result)
	return &result, err
}

func (s *CREService) ListExecutors(ctx context.Context, accountID string) ([]CREExecutor, error) {
	var result []CREExecutor
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/cre/executors", nil, nil, &result)
	return result, err
}

func (s *CREService) GetExecutor(ctx context.Context, accountID, executorID string) (*CREExecutor, error) {
	var result CREExecutor
	err := s.client.request(ctx, http.MethodGet, "/accounts/"+accountID+"/cre/executors/"+executorID, nil, nil, &result)
	return &result, err
}

func (s *CREService) UpdateExecutor(ctx context.Context, accountID, executorID string, params UpdateExecutorParams) (*CREExecutor, error) {
	var result CREExecutor
	err := s.client.request(ctx, http.MethodPut, "/accounts/"+accountID+"/cre/executors/"+executorID, nil, params, &result)
	return &result, err
}

// ============================================================================ //
// Bus
// ============================================================================ //

type BusService struct{ client *Client }

func (s *BusService) PublishEvent(ctx context.Context, event string, payload any) error {
	body := map[string]any{"event": event, "payload": payload}
	return s.client.request(ctx, http.MethodPost, "/system/events", nil, body, nil)
}

func (s *BusService) PushData(ctx context.Context, topic string, payload any) error {
	body := map[string]any{"topic": topic, "payload": payload}
	return s.client.request(ctx, http.MethodPost, "/system/data", nil, body, nil)
}

func (s *BusService) Compute(ctx context.Context, payload any) ([]ComputeResult, error) {
	var resp struct {
		Results []ComputeResult `json:"results"`
		Error   string          `json:"error"`
	}
	err := s.client.request(ctx, http.MethodPost, "/system/compute", nil, map[string]any{"payload": payload}, &resp)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(resp.Error) != "" {
		return resp.Results, fmt.Errorf("%s", resp.Error)
	}
	return resp.Results, nil
}

// ============================================================================ //
// System
// ============================================================================ //

type SystemService struct{ client *Client }

func (s *SystemService) Health(ctx context.Context) (map[string]string, error) {
	var result map[string]string
	err := s.client.request(ctx, http.MethodGet, "/healthz", nil, nil, &result)
	return result, err
}

func (s *SystemService) Status(ctx context.Context) (map[string]any, error) {
	var result map[string]any
	err := s.client.request(ctx, http.MethodGet, "/system/status", nil, nil, &result)
	return result, err
}

func (s *SystemService) Descriptors(ctx context.Context) ([]map[string]any, error) {
	var result []map[string]any
	err := s.client.request(ctx, http.MethodGet, "/system/descriptors", nil, nil, &result)
	return result, err
}
