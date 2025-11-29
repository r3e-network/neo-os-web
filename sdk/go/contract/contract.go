// Package contract provides a developer SDK for building service contracts
// that integrate with the Service Layer ecosystem on Neo N3 blockchain.
//
// The SDK provides:
//   - Base contract interfaces and types for service integration
//   - Helpers for account/gas management integration
//   - Event emission and subscription patterns
//   - Cross-chain messaging primitives
//
// # Target Blockchain
//
// The Service Layer is designed primarily for Neo N3. Contracts are written
// in C# using the Neo devpack and deployed as NEF files. This Go SDK provides
// the specification layer that aligns with the on-chain C# contracts in
// contracts/neo-n3/.
//
// # Architecture
//
// Service contracts in the Service Layer follow a layered architecture:
//
//	┌─────────────────────────────────────────────────────────┐
//	│                    User Contracts                        │
//	│  (Custom business logic built with this SDK)            │
//	├─────────────────────────────────────────────────────────┤
//	│                  Service Contracts                       │
//	│  (Oracle, VRF, DataFeeds, Automation, etc.)             │
//	├─────────────────────────────────────────────────────────┤
//	│                  Engine Contracts                        │
//	│  (AccountManager, GasBank, ServiceRegistry, Manager)    │
//	└─────────────────────────────────────────────────────────┘
//
// # Quick Start
//
// To create a service contract that integrates with Service Layer:
//
//	// 1. Import the SDK
//	import "github.com/R3E-Network/service_layer/sdk/go/contract"
//
//	// 2. Define your contract using the builder
//	spec := contract.NewSpec("MyService").
//	    WithCapabilities(contract.CapOracleRequest, contract.CapGasBankRead).
//	    WithMethod("processData", []contract.Param{{Name: "data", Type: "bytes"}}, nil).
//	    Build()
//
//	// 3. Register with Service Layer
//	client.Contracts.Register(ctx, spec)
//
// # Integration with Account System
//
// All contracts automatically integrate with the Service Layer account system.
// When deploying, specify the owning account ID and the contract will be
// registered under that account's workspace.
//
// # Gas Management
//
// Contracts can declare gas requirements in their manifest. The Service Layer
// will automatically manage gas funding from the account's GasBank.
package contract

import "context"

// Capability represents a capability that a contract can declare.
// These map to on-chain role checks in the Manager contract.
type Capability string

const (
	// Account capabilities
	CapAccountRead  Capability = "account:read"
	CapAccountWrite Capability = "account:write"

	// GasBank capabilities
	CapGasBankRead  Capability = "gasbank:read"
	CapGasBankWrite Capability = "gasbank:write"

	// Oracle capabilities
	CapOracleRequest Capability = "oracle:request"
	CapOracleProvide Capability = "oracle:provide"

	// VRF capabilities
	CapVRFRequest Capability = "vrf:request"
	CapVRFProvide Capability = "vrf:provide"

	// Data feed capabilities
	CapFeedRead  Capability = "feed:read"
	CapFeedWrite Capability = "feed:write"

	// Automation capability
	CapAutomation Capability = "automation"

	// Secrets capability
	CapSecrets Capability = "secrets"

	// Cross-chain capability
	CapCrossChain Capability = "crosschain"
)

// Network represents a blockchain network.
// Neo N3 is the primary deployment target.
type Network string

const (
	// NetworkNeoN3 is the primary deployment target for Service Layer contracts.
	NetworkNeoN3 Network = "neo-n3"

	// NetworkNeoX is the Neo X sidechain (EVM-compatible).
	NetworkNeoX Network = "neo-x"

	// Additional networks for cross-chain support
	NetworkEthereum  Network = "ethereum"
	NetworkPolygon   Network = "polygon"
	NetworkArbitrum  Network = "arbitrum"
	NetworkOptimism  Network = "optimism"
	NetworkBase      Network = "base"
	NetworkAvalanche Network = "avalanche"
	NetworkBSC       Network = "bsc"
	NetworkTestnet   Network = "testnet"    // Neo N3 testnet
	NetworkLocalPriv Network = "local-priv" // Local Neo privnet
)

// DefaultNetwork returns the default deployment network (Neo N3).
func DefaultNetwork() Network { return NetworkNeoN3 }

// Param describes a method parameter.
type Param struct {
	Name    string `json:"name"`
	Type    string `json:"type"` // Solidity/Neo type
	Indexed bool   `json:"indexed,omitempty"`
}

// Method describes a contract method.
type Method struct {
	Name            string  `json:"name"`
	Inputs          []Param `json:"inputs,omitempty"`
	Outputs         []Param `json:"outputs,omitempty"`
	StateMutability string  `json:"state_mutability"` // view|pure|nonpayable|payable
	Description     string  `json:"description,omitempty"`
}

// Event describes a contract event.
type Event struct {
	Name        string  `json:"name"`
	Params      []Param `json:"params,omitempty"`
	Description string  `json:"description,omitempty"`
}

// Spec defines a contract specification for registration.
type Spec struct {
	Name         string       `json:"name"`
	Symbol       string       `json:"symbol,omitempty"`
	Description  string       `json:"description,omitempty"`
	Version      string       `json:"version"`
	Networks     []Network    `json:"networks"`
	Capabilities []Capability `json:"capabilities,omitempty"`
	Methods      []Method     `json:"methods,omitempty"`
	Events       []Event      `json:"events,omitempty"`
	DependsOn    []string     `json:"depends_on,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// Handler is the interface for handling contract method calls.
type Handler interface {
	// HandleInvoke processes a contract method invocation.
	HandleInvoke(ctx context.Context, method string, args map[string]any) (any, error)
}

// HandlerFunc is a function adapter for Handler.
type HandlerFunc func(ctx context.Context, method string, args map[string]any) (any, error)

// HandleInvoke implements Handler.
func (f HandlerFunc) HandleInvoke(ctx context.Context, method string, args map[string]any) (any, error) {
	return f(ctx, method, args)
}

// EventEmitter allows contracts to emit events.
type EventEmitter interface {
	// Emit emits an event with the given name and data.
	Emit(ctx context.Context, eventName string, data map[string]any) error
}

// AccountResolver resolves account information.
type AccountResolver interface {
	// GetAccountOwner returns the owner address for an account.
	GetAccountOwner(ctx context.Context, accountID string) (string, error)
	// VerifyAccountOwnership checks if an address owns an account.
	VerifyAccountOwnership(ctx context.Context, accountID, address string) (bool, error)
}

// GasBankClient provides gas management operations.
type GasBankClient interface {
	// GetBalance returns the gas balance for an account.
	GetBalance(ctx context.Context, accountID string) (float64, error)
	// Reserve reserves gas for an operation.
	Reserve(ctx context.Context, accountID string, amount float64, reason string) (string, error)
	// Release releases a gas reservation.
	Release(ctx context.Context, reservationID string) error
}

// ContractContext provides context for contract execution.
type ContractContext struct {
	AccountID  string
	ContractID string
	Network    Network
	Caller     string // Address of the caller
	GasLimit   int64
	Value      string // Native token value
	Metadata   map[string]string
}

// FromContext extracts ContractContext from context.Context.
func FromContext(ctx context.Context) (*ContractContext, bool) {
	cc, ok := ctx.Value(contractContextKey).(*ContractContext)
	return cc, ok
}

// WithContext adds ContractContext to context.Context.
func WithContext(ctx context.Context, cc *ContractContext) context.Context {
	return context.WithValue(ctx, contractContextKey, cc)
}

type contextKey string

const contractContextKey contextKey = "contract_context"
