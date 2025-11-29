package contract

import "time"

// Template defines a reusable contract template that services or users can deploy.
// Templates enable the Service Layer to provide pre-built, audited contracts.
// Templates are primarily designed for Neo N3 (C# source, NEF bytecode).
type Template struct {
	ID          string            `json:"id"`
	ServiceID   string            `json:"service_id,omitempty"` // Owning service (empty for engine templates)
	Name        string            `json:"name"`
	Symbol      string            `json:"symbol,omitempty"`
	Description string            `json:"description,omitempty"`
	Category    TemplateCategory  `json:"category"`
	Networks    []Network         `json:"networks"`            // Supported networks
	Version     string            `json:"version"`
	ABI         string            `json:"abi"`                 // Contract ABI (JSON)
	Bytecode    string            `json:"bytecode"`            // Compiled bytecode (hex)
	SourceCode  string            `json:"source_code,omitempty"` // Source for verification
	SourceLang  string            `json:"source_lang,omitempty"` // solidity|csharp|etc
	CodeHash    string            `json:"code_hash"`           // SHA256 of bytecode
	Audited     bool              `json:"audited"`
	AuditReport string            `json:"audit_report,omitempty"` // URL to audit report
	Params      []TemplateParam   `json:"params,omitempty"`    // Constructor parameters
	Capabilities []string         `json:"capabilities,omitempty"`
	DependsOn   []string          `json:"depends_on,omitempty"` // Other template IDs
	Metadata    map[string]string `json:"metadata,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Status      TemplateStatus    `json:"status"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// TemplateCategory groups templates by purpose.
type TemplateCategory string

const (
	// Engine templates - core Service Layer infrastructure
	TemplateCategoryEngine TemplateCategory = "engine"

	// Token templates
	TemplateCategoryToken TemplateCategory = "token" // ERC20, NEP-17, etc.

	// Oracle/data templates
	TemplateCategoryOracle TemplateCategory = "oracle"
	TemplateCategoryVRF    TemplateCategory = "vrf"
	TemplateCategoryFeed   TemplateCategory = "feed"

	// DeFi templates
	TemplateCategoryDeFi   TemplateCategory = "defi"
	TemplateCategoryVault  TemplateCategory = "vault"
	TemplateCategoryStake  TemplateCategory = "stake"

	// Utility templates
	TemplateCategoryProxy     TemplateCategory = "proxy"
	TemplateCategoryMultisig  TemplateCategory = "multisig"
	TemplateCategoryGovernance TemplateCategory = "governance"

	// Custom service templates
	TemplateCategoryCustom TemplateCategory = "custom"
)

// TemplateStatus tracks template availability.
type TemplateStatus string

const (
	TemplateStatusDraft      TemplateStatus = "draft"
	TemplateStatusActive     TemplateStatus = "active"
	TemplateStatusDeprecated TemplateStatus = "deprecated"
)

// TemplateParam describes a constructor parameter for template deployment.
type TemplateParam struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
	Required    bool   `json:"required"`
	Default     any    `json:"default,omitempty"`
}

// EngineContracts defines the standard engine contract set.
// These are the core contracts that the Service Layer deploys and manages.
var EngineContracts = []string{
	"Manager",          // Module registry, roles, pause flags
	"AccountManager",   // Account/wallet management
	"ServiceRegistry",  // Service registration and capabilities
	"GasBank",          // GAS deposit/withdrawal management
	"OracleHub",        // Oracle request/response
	"RandomnessHub",    // VRF randomness
	"DataFeedHub",      // Price feed aggregation
	"AutomationScheduler", // Job scheduling
	"SecretsVault",     // Encrypted secret storage
	"JAMInbox",         // Cross-chain message inbox
}

// ServiceContractBinding describes how a service binds to on-chain contracts.
// Services declare their contract requirements in their Manifest and this
// structure tracks the actual deployed bindings.
type ServiceContractBinding struct {
	ID          string            `json:"id"`
	ServiceID   string            `json:"service_id"`   // e.g., "oracle", "vrf"
	AccountID   string            `json:"account_id"`   // Workspace owner
	ContractID  string            `json:"contract_id"` // Deployed contract
	Network     Network           `json:"network"`
	Role        string            `json:"role"`         // consumer|provider|admin
	Enabled     bool              `json:"enabled"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// NetworkConfig holds network-specific configuration.
type NetworkConfig struct {
	Network        Network           `json:"network"`
	ChainID        int64             `json:"chain_id"`
	RPCEndpoint    string            `json:"rpc_endpoint"`
	WSEndpoint     string            `json:"ws_endpoint,omitempty"`
	ExplorerURL    string            `json:"explorer_url,omitempty"`
	NativeToken    string            `json:"native_token"`       // e.g., "GAS", "ETH"
	NativeDecimals int               `json:"native_decimals"`
	BlockTime      int               `json:"block_time_seconds"` // Average block time
	Confirmations  int               `json:"confirmations"`      // Required confirmations
	EngineContracts map[string]string `json:"engine_contracts,omitempty"` // name -> address
	Metadata       map[string]string `json:"metadata,omitempty"`
	Enabled        bool              `json:"enabled"`
}

// ContractCapability defines capabilities a contract can declare.
type ContractCapability string

const (
	CapabilityAccountRead   ContractCapability = "account:read"
	CapabilityAccountWrite  ContractCapability = "account:write"
	CapabilityGasBankRead   ContractCapability = "gasbank:read"
	CapabilityGasBankWrite  ContractCapability = "gasbank:write"
	CapabilityOracleRequest ContractCapability = "oracle:request"
	CapabilityOracleProvide ContractCapability = "oracle:provide"
	CapabilityVRFRequest    ContractCapability = "vrf:request"
	CapabilityVRFProvide    ContractCapability = "vrf:provide"
	CapabilityFeedRead      ContractCapability = "feed:read"
	CapabilityFeedWrite     ContractCapability = "feed:write"
	CapabilityAutomation    ContractCapability = "automation"
	CapabilitySecrets       ContractCapability = "secrets"
	CapabilityCrossChain    ContractCapability = "crosschain"
)

// DefaultNeoN3Config returns the default NetworkConfig for Neo N3 mainnet.
func DefaultNeoN3Config() NetworkConfig {
	return NetworkConfig{
		Network:        NetworkNeoN3,
		ChainID:        860833102, // Neo N3 mainnet magic number
		RPCEndpoint:    "https://mainnet1.neo.coz.io:443",
		WSEndpoint:     "wss://mainnet1.neo.coz.io:443/ws",
		ExplorerURL:    "https://dora.coz.io",
		NativeToken:    "GAS",
		NativeDecimals: 8,
		BlockTime:      15, // ~15 seconds
		Confirmations:  1,  // Neo N3 has finality after 1 block
		Enabled:        true,
	}
}

// DefaultNeoN3TestnetConfig returns the default NetworkConfig for Neo N3 testnet.
func DefaultNeoN3TestnetConfig() NetworkConfig {
	return NetworkConfig{
		Network:        NetworkTestnet,
		ChainID:        894710606, // Neo N3 testnet magic number
		RPCEndpoint:    "https://testnet1.neo.coz.io:443",
		WSEndpoint:     "wss://testnet1.neo.coz.io:443/ws",
		ExplorerURL:    "https://dora.coz.io/testnet",
		NativeToken:    "GAS",
		NativeDecimals: 8,
		BlockTime:      15,
		Confirmations:  1,
		Enabled:        true,
	}
}

// DefaultNeoPrivnetConfig returns the default NetworkConfig for local Neo privnet.
func DefaultNeoPrivnetConfig() NetworkConfig {
	return NetworkConfig{
		Network:        NetworkLocalPriv,
		ChainID:        1234567890, // Typical privnet magic
		RPCEndpoint:    "http://localhost:20332",
		NativeToken:    "GAS",
		NativeDecimals: 8,
		BlockTime:      1, // Privnet typically has 1s blocks
		Confirmations:  1,
		Enabled:        true,
	}
}
