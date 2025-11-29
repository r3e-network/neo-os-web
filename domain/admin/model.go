package admin

import "time"

// ChainRPC represents a blockchain RPC endpoint configuration.
type ChainRPC struct {
	ID          string            `json:"id"`
	ChainID     string            `json:"chain_id"`   // e.g., "eth", "btc", "neo", "neox"
	Name        string            `json:"name"`       // Human-readable name
	RPCURL      string            `json:"rpc_url"`    // Primary RPC endpoint
	WSURL       string            `json:"ws_url"`     // WebSocket endpoint (optional)
	ChainType   string            `json:"chain_type"` // evm, neo, btc, etc.
	NetworkID   int64             `json:"network_id"` // Network/Chain ID for EVM chains
	Priority    int               `json:"priority"`   // Lower = higher priority for load balancing
	Weight      int               `json:"weight"`     // Weight for weighted round-robin
	MaxRPS      int               `json:"max_rps"`    // Max requests per second (0 = unlimited)
	Timeout     int               `json:"timeout_ms"` // Request timeout in milliseconds
	Enabled     bool              `json:"enabled"`
	Healthy     bool              `json:"healthy"`  // Runtime health status
	Metadata    map[string]string `json:"metadata"` // Additional config (api keys, etc.)
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	LastCheckAt time.Time         `json:"last_check_at"`
}

// DataProvider represents an external data source provider configuration.
type DataProvider struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"` // e.g., "coingecko", "chainlink", "binance"
	Type        string            `json:"type"` // price_feed, oracle, api, webhook
	BaseURL     string            `json:"base_url"`
	APIKey      string            `json:"api_key"`    // Encrypted at rest
	RateLimit   int               `json:"rate_limit"` // Requests per minute
	Timeout     int               `json:"timeout_ms"`
	Retries     int               `json:"retries"`
	Enabled     bool              `json:"enabled"`
	Healthy     bool              `json:"healthy"`
	Features    []string          `json:"features"` // Supported features
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	LastCheckAt time.Time         `json:"last_check_at"`
}

// SystemSetting represents a key-value system configuration.
type SystemSetting struct {
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Type        string    `json:"type"`     // string, int, bool, json
	Category    string    `json:"category"` // general, security, limits, features
	Description string    `json:"description"`
	Editable    bool      `json:"editable"` // Can be changed at runtime
	UpdatedAt   time.Time `json:"updated_at"`
	UpdatedBy   string    `json:"updated_by"`
}

// FeatureFlag represents a feature toggle.
type FeatureFlag struct {
	Key         string    `json:"key"`
	Enabled     bool      `json:"enabled"`
	Description string    `json:"description"`
	Rollout     int       `json:"rollout"` // Percentage rollout (0-100)
	UpdatedAt   time.Time `json:"updated_at"`
	UpdatedBy   string    `json:"updated_by"`
}

// TenantQuota represents resource quotas for a tenant.
type TenantQuota struct {
	TenantID     string    `json:"tenant_id"`
	MaxAccounts  int       `json:"max_accounts"`
	MaxFunctions int       `json:"max_functions"`
	MaxRPCPerMin int       `json:"max_rpc_per_min"`
	MaxStorage   int64     `json:"max_storage_bytes"`
	MaxGasPerDay int64     `json:"max_gas_per_day"`
	Features     []string  `json:"features"` // Enabled features for tenant
	UpdatedAt    time.Time `json:"updated_at"`
	UpdatedBy    string    `json:"updated_by"`
}

// AllowedMethod defines which RPC methods are allowed per chain.
type AllowedMethod struct {
	ChainID string   `json:"chain_id"`
	Methods []string `json:"methods"`
}
