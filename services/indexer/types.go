package indexer

import (
	"encoding/json"
	"time"
)

// =============================================================================
// Core Transaction Types
// =============================================================================

// TxType represents the complexity type of a transaction.
type TxType string

const (
	TxTypeSimple  TxType = "simple"  // Simple NEP-17 transfers
	TxTypeComplex TxType = "complex" // Contract invocations
)

// Transaction represents an indexed Neo N3 transaction.
type Transaction struct {
	Hash            string          `json:"hash" db:"hash"`
	Network         Network         `json:"network" db:"network"`
	BlockIndex      uint64          `json:"block_index" db:"block_index"`
	BlockTime       time.Time       `json:"block_time" db:"block_time"`
	Size            int             `json:"size" db:"size"`
	Version         int             `json:"version" db:"version"`
	Nonce           uint32          `json:"nonce" db:"nonce"`
	Sender          string          `json:"sender" db:"sender"`
	SystemFee       string          `json:"system_fee" db:"system_fee"`
	NetworkFee      string          `json:"network_fee" db:"network_fee"`
	ValidUntilBlock uint64          `json:"valid_until_block" db:"valid_until_block"`
	Script          string          `json:"script" db:"script"`
	VMState         string          `json:"vm_state" db:"vm_state"`
	GasConsumed     string          `json:"gas_consumed" db:"gas_consumed"`
	Exception       string          `json:"exception,omitempty" db:"exception"`
	TxType          TxType          `json:"tx_type" db:"tx_type"`
	SignersJSON     json.RawMessage `json:"signers" db:"signers_json"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
}

// Signer represents a transaction signer.
type Signer struct {
	Account          string   `json:"account"`
	Scopes           string   `json:"scopes"`
	AllowedContracts []string `json:"allowed_contracts,omitempty"`
	AllowedGroups    []string `json:"allowed_groups,omitempty"`
}

// =============================================================================
// VM Execution Trace Types
// =============================================================================

// OpcodeTrace represents a single VM opcode execution step.
type OpcodeTrace struct {
	ID              int64  `json:"id" db:"id"`
	TxHash          string `json:"tx_hash" db:"tx_hash"`
	StepIndex       int    `json:"step_index" db:"step_index"`
	Opcode          string `json:"opcode" db:"opcode"`
	OpcodeHex       string `json:"opcode_hex" db:"opcode_hex"`
	GasConsumed     string `json:"gas_consumed" db:"gas_consumed"`
	StackSize       int    `json:"stack_size" db:"stack_size"`
	ContractAddress string `json:"contract_address,omitempty" db:"contract_address"`
	InstructionPtr  int    `json:"instruction_ptr" db:"instruction_ptr"`
}

// ContractCall represents a contract invocation within a transaction.
type ContractCall struct {
	ID              int64           `json:"id" db:"id"`
	TxHash          string          `json:"tx_hash" db:"tx_hash"`
	CallIndex       int             `json:"call_index" db:"call_index"`
	ContractAddress string          `json:"contract_address" db:"contract_address"`
	Method          string          `json:"method" db:"method"`
	ArgsJSON        json.RawMessage `json:"args" db:"args_json"`
	GasConsumed     string          `json:"gas_consumed" db:"gas_consumed"`
	Success         bool            `json:"success" db:"success"`
	ParentCallID    *int64          `json:"parent_call_id,omitempty" db:"parent_call_id"`
}

// Syscall represents a system call made during transaction execution.
type Syscall struct {
	ID              int64           `json:"id" db:"id"`
	TxHash          string          `json:"tx_hash" db:"tx_hash"`
	CallIndex       int             `json:"call_index" db:"call_index"`
	SyscallName     string          `json:"syscall_name" db:"syscall_name"`
	ArgsJSON        json.RawMessage `json:"args" db:"args_json"`
	ResultJSON      json.RawMessage `json:"result" db:"result_json"`
	GasConsumed     string          `json:"gas_consumed" db:"gas_consumed"`
	ContractAddress string          `json:"contract_address,omitempty" db:"contract_address"`
}

// =============================================================================
// Address Relationship Types
// =============================================================================

// AddressTx links addresses to transactions for efficient querying.
type AddressTx struct {
	ID        int64     `json:"id" db:"id"`
	Address   string    `json:"address" db:"address"`
	TxHash    string    `json:"tx_hash" db:"tx_hash"`
	Role      string    `json:"role" db:"role"` // sender, signer, participant
	Network   Network   `json:"network" db:"network"`
	BlockTime time.Time `json:"block_time" db:"block_time"`
}

// AddressRole constants for address-transaction relationships.
const (
	RoleSender      = "sender"
	RoleSigner      = "signer"
	RoleParticipant = "participant"
)

// =============================================================================
// Notification Types
// =============================================================================

// Notification represents a contract event notification.
type Notification struct {
	ID              int64           `json:"id" db:"id"`
	TxHash          string          `json:"tx_hash" db:"tx_hash"`
	NotifyIndex     int             `json:"notify_index" db:"notify_index"`
	ContractAddress string          `json:"contract_address" db:"contract_address"`
	EventName       string          `json:"event_name" db:"event_name"`
	StateJSON       json.RawMessage `json:"state" db:"state_json"`
}

// =============================================================================
// Sync State Types
// =============================================================================

// SyncState tracks the indexer's synchronization progress.
type SyncState struct {
	ID              int64     `json:"id" db:"id"`
	Network         Network   `json:"network" db:"network"`
	LastBlockIndex  uint64    `json:"last_block_index" db:"last_block_index"`
	LastBlockTime   time.Time `json:"last_block_time" db:"last_block_time"`
	TotalTxIndexed  int64     `json:"total_tx_indexed" db:"total_tx_indexed"`
	LastSyncAt      time.Time `json:"last_sync_at" db:"last_sync_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}
