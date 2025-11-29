// Package contract defines domain models for on-chain contract management.
//
// The Service Layer is designed primarily for Neo N3 blockchain, with contracts
// written in C# using the Neo devpack and deployed via neo-go or neon-js tooling.
// The contract system manages two categories:
//   - Engine contracts: Core infrastructure (AccountManager, GasBank, ServiceRegistry)
//   - Service contracts: Per-service contracts deployed by services or users
//
// This design follows the Android OS pattern where the system provides core
// contracts and services can register their own contracts that integrate
// with the common account and gas management systems.
//
// While the model supports multiple networks for future extensibility,
// Neo N3 is the primary and default deployment target. See contracts/neo-n3/
// for the C# contract stubs aligned with this Go domain model.
package contract

import "time"

// Network identifies the blockchain network a contract is deployed on.
// Neo N3 is the primary target; other networks are included for future extensibility.
type Network string

const (
	// NetworkNeoN3 is the primary deployment target for Service Layer contracts.
	// Contracts are written in C# and compiled with the Neo devpack.
	NetworkNeoN3 Network = "neo-n3"

	// NetworkNeoX is the Neo X sidechain (EVM-compatible).
	NetworkNeoX Network = "neo-x"

	// Additional networks for future cross-chain support
	NetworkEthereum  Network = "ethereum"
	NetworkPolygon   Network = "polygon"
	NetworkArbitrum  Network = "arbitrum"
	NetworkOptimism  Network = "optimism"
	NetworkBase      Network = "base"
	NetworkAvalanche Network = "avalanche"
	NetworkBSC       Network = "bsc"
	NetworkTestnet   Network = "testnet"    // Generic testnet
	NetworkLocalPriv Network = "local-priv" // Local Neo privnet development
)

// DefaultNetwork returns the default deployment network (Neo N3).
func DefaultNetwork() Network { return NetworkNeoN3 }

// ContractType categorizes contracts by their role in the system.
type ContractType string

const (
	// Engine contracts - managed by Service Layer core
	ContractTypeEngine ContractType = "engine" // Core infrastructure

	// Service contracts - managed by individual services
	ContractTypeService ContractType = "service" // Service-specific

	// User contracts - deployed by users through SDK
	ContractTypeUser ContractType = "user" // User-deployed
)

// ContractStatus tracks the lifecycle of a deployed contract.
type ContractStatus string

const (
	ContractStatusDraft      ContractStatus = "draft"      // Not yet deployed
	ContractStatusDeploying  ContractStatus = "deploying"  // Deployment in progress
	ContractStatusActive     ContractStatus = "active"     // Deployed and operational
	ContractStatusPaused     ContractStatus = "paused"     // Temporarily disabled
	ContractStatusUpgrading  ContractStatus = "upgrading"  // Upgrade in progress
	ContractStatusDeprecated ContractStatus = "deprecated" // Marked for removal
	ContractStatusRevoked    ContractStatus = "revoked"    // Permanently disabled
)

// Contract represents a deployed smart contract in the Service Layer ecosystem.
// Aligned with ServiceRegistry.cs Service struct for on-chain registration.
type Contract struct {
	ID          string            `json:"id"`
	AccountID   string            `json:"account_id"`             // Owner account (workspace)
	ServiceID   string            `json:"service_id,omitempty"`   // Owning service (e.g., "oracle", "vrf")
	Name        string            `json:"name"`                   // Human-readable name
	Symbol      string            `json:"symbol,omitempty"`       // Short identifier
	Description string            `json:"description,omitempty"`
	Type        ContractType      `json:"type"`                   // engine|service|user
	Network     Network           `json:"network"`                // Target blockchain
	Address     string            `json:"address,omitempty"`      // Deployed address (hex)
	CodeHash    string            `json:"code_hash,omitempty"`    // SHA256 of bytecode
	ConfigHash  string            `json:"config_hash,omitempty"` // SHA256 of config
	Version     string            `json:"version"`                // Semantic version
	ABI         string            `json:"abi,omitempty"`          // Contract ABI (JSON)
	Bytecode    string            `json:"bytecode,omitempty"`     // Compiled bytecode (hex)
	SourceHash  string            `json:"source_hash,omitempty"` // SHA256 of source code
	Status      ContractStatus    `json:"status"`
	Capabilities []string         `json:"capabilities,omitempty"` // Bit flags as strings
	DependsOn   []string          `json:"depends_on,omitempty"`   // Other contract IDs
	Metadata    map[string]string `json:"metadata,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	DeployedAt  time.Time         `json:"deployed_at,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// ContractMethod describes a callable method on a contract.
type ContractMethod struct {
	ID          string            `json:"id"`
	ContractID  string            `json:"contract_id"`
	Name        string            `json:"name"`               // Method name
	Selector    string            `json:"selector,omitempty"` // 4-byte selector (EVM) or method hash
	Inputs      []MethodParam     `json:"inputs,omitempty"`
	Outputs     []MethodParam     `json:"outputs,omitempty"`
	StateMutability string        `json:"state_mutability"`   // view|pure|nonpayable|payable
	Description string            `json:"description,omitempty"`
	GasEstimate int64             `json:"gas_estimate,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// MethodParam describes a parameter in a contract method.
type MethodParam struct {
	Name    string `json:"name"`
	Type    string `json:"type"`              // Solidity/Neo type
	Indexed bool   `json:"indexed,omitempty"` // For event params
}

// ContractEvent describes an event emitted by a contract.
type ContractEvent struct {
	ID          string            `json:"id"`
	ContractID  string            `json:"contract_id"`
	Name        string            `json:"name"`
	Signature   string            `json:"signature,omitempty"` // Event signature hash
	Params      []MethodParam     `json:"params,omitempty"`
	Description string            `json:"description,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// Invocation records a contract method call.
type Invocation struct {
	ID           string            `json:"id"`
	AccountID    string            `json:"account_id"`
	ContractID   string            `json:"contract_id"`
	MethodName   string            `json:"method_name"`
	Args         map[string]any    `json:"args,omitempty"`
	GasLimit     int64             `json:"gas_limit,omitempty"`
	GasUsed      int64             `json:"gas_used,omitempty"`
	GasPrice     string            `json:"gas_price,omitempty"`
	Value        string            `json:"value,omitempty"` // Native token value
	TxHash       string            `json:"tx_hash,omitempty"`
	BlockNumber  int64             `json:"block_number,omitempty"`
	BlockHash    string            `json:"block_hash,omitempty"`
	Status       InvocationStatus  `json:"status"`
	Result       any               `json:"result,omitempty"`
	Error        string            `json:"error,omitempty"`
	Logs         []EventLog        `json:"logs,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	SubmittedAt  time.Time         `json:"submitted_at"`
	ConfirmedAt  time.Time         `json:"confirmed_at,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// InvocationStatus tracks the lifecycle of a contract invocation.
type InvocationStatus string

const (
	InvocationStatusPending   InvocationStatus = "pending"   // Awaiting submission
	InvocationStatusSubmitted InvocationStatus = "submitted" // Sent to network
	InvocationStatusConfirmed InvocationStatus = "confirmed" // Included in block
	InvocationStatusFailed    InvocationStatus = "failed"    // Execution failed
	InvocationStatusReverted  InvocationStatus = "reverted"  // Transaction reverted
)

// EventLog represents an event emitted during contract execution.
type EventLog struct {
	ContractID  string         `json:"contract_id"`
	EventName   string         `json:"event_name"`
	Topics      []string       `json:"topics,omitempty"`
	Data        map[string]any `json:"data,omitempty"`
	LogIndex    int            `json:"log_index"`
	BlockNumber int64          `json:"block_number"`
	TxHash      string         `json:"tx_hash"`
}

// Deployment tracks a contract deployment operation.
type Deployment struct {
	ID           string            `json:"id"`
	AccountID    string            `json:"account_id"`
	ContractID   string            `json:"contract_id"`
	Network      Network           `json:"network"`
	Bytecode     string            `json:"bytecode"`
	ConstructorArgs map[string]any `json:"constructor_args,omitempty"`
	GasLimit     int64             `json:"gas_limit,omitempty"`
	GasUsed      int64             `json:"gas_used,omitempty"`
	GasPrice     string            `json:"gas_price,omitempty"`
	TxHash       string            `json:"tx_hash,omitempty"`
	Address      string            `json:"address,omitempty"`
	BlockNumber  int64             `json:"block_number,omitempty"`
	Status       DeploymentStatus  `json:"status"`
	Error        string            `json:"error,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	SubmittedAt  time.Time         `json:"submitted_at,omitempty"`
	ConfirmedAt  time.Time         `json:"confirmed_at,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// DeploymentStatus tracks the lifecycle of a deployment.
type DeploymentStatus string

const (
	DeploymentStatusPending   DeploymentStatus = "pending"
	DeploymentStatusSubmitted DeploymentStatus = "submitted"
	DeploymentStatusConfirmed DeploymentStatus = "confirmed"
	DeploymentStatusFailed    DeploymentStatus = "failed"
)
