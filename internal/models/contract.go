package models

import (
	"time"

	"github.com/google/uuid"
)

// ContractStatus represents the status of a contract deployment
type ContractStatus string

// Contract statuses
const (
	ContractStatusPending   ContractStatus = "pending"
	ContractStatusDeploying ContractStatus = "deploying"
	ContractStatusDeployed  ContractStatus = "deployed"
	ContractStatusFailed    ContractStatus = "failed"
)

// Contract represents a smart contract in the system
type Contract struct {
	ID          uuid.UUID      `json:"id" db:"id"`
	Name        string         `json:"name" db:"name"`
	Description string         `json:"description" db:"description"`
	Source      string         `json:"source,omitempty" db:"source"`
	Bytecode    []byte         `json:"bytecode,omitempty" db:"bytecode"`
	Manifest    []byte         `json:"manifest,omitempty" db:"manifest"`
	Address     string         `json:"address" db:"address"`
	Network     string         `json:"network" db:"network"`
	CreatedAt   time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time      `json:"updatedAt" db:"updated_at"`
	UserID      int            `json:"userId" db:"user_id"`
	Status      ContractStatus `json:"status" db:"status"`
	TxHash      string         `json:"txHash" db:"tx_hash"`
}

// NewContract creates a new contract
func NewContract(name, description, source string, userID int, network string) *Contract {
	now := time.Now()
	return &Contract{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
		Source:      source,
		Network:     network,
		CreatedAt:   now,
		UpdatedAt:   now,
		UserID:      userID,
		Status:      ContractStatusPending,
	}
}

// ContractVerification represents a contract verification
type ContractVerification struct {
	ID         uuid.UUID    `json:"id" db:"id"`
	ContractID uuid.UUID    `json:"contractId" db:"contract_id"`
	Verified   bool         `json:"verified" db:"verified"`
	Message    string       `json:"message" db:"message"`
	Details    []byte       `json:"details" db:"details"`
	CreatedAt  time.Time    `json:"createdAt" db:"created_at"`
	UserID     int          `json:"userId" db:"user_id"`
}

// NewContractVerification creates a new contract verification
func NewContractVerification(contractID uuid.UUID, verified bool, message string, details []byte, userID int) *ContractVerification {
	return &ContractVerification{
		ID:         uuid.New(),
		ContractID: contractID,
		Verified:   verified,
		Message:    message,
		Details:    details,
		CreatedAt:  time.Now(),
		UserID:     userID,
	}
}

// ContractDeployRequest represents a request to deploy a contract
type ContractDeployRequest struct {
	Name        string                 `json:"name" validate:"required"`
	Description string                 `json:"description"`
	Source      string                 `json:"source" validate:"required"`
	Compiler    string                 `json:"compiler" validate:"required"`
	Parameters  map[string]interface{} `json:"parameters"`
	Wallet      string                 `json:"wallet" validate:"required"`
	Network     string                 `json:"network" validate:"required,oneof=mainnet testnet"`
}

// ContractVerifyRequest represents a request to verify a contract
type ContractVerifyRequest struct {
	ContractID string                 `json:"contractId" validate:"required,uuid"`
	Source     string                 `json:"source" validate:"required"`
	Compiler   string                 `json:"compiler" validate:"required"`
	Parameters map[string]interface{} `json:"parameters"`
}

// ContractResponse represents a contract response
type ContractResponse struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Address     string         `json:"address"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	Status      ContractStatus `json:"status"`
	TxHash      string         `json:"txHash"`
	Network     string         `json:"network"`
}

// ContractDeployResponse represents a contract deployment response
type ContractDeployResponse struct {
	ContractID string         `json:"contractId"`
	TxHash     string         `json:"txHash"`
	Status     ContractStatus `json:"status"`
	Address    string         `json:"address,omitempty"`
}

// ContractVerifyResponse represents a contract verification response
type ContractVerifyResponse struct {
	Verified bool                   `json:"verified"`
	Message  string                 `json:"message"`
	Details  map[string]interface{} `json:"details,omitempty"`
}

// ToResponse converts a contract to a contract response
func (c *Contract) ToResponse() *ContractResponse {
	return &ContractResponse{
		ID:          c.ID.String(),
		Name:        c.Name,
		Description: c.Description,
		Address:     c.Address,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
		Status:      c.Status,
		TxHash:      c.TxHash,
		Network:     c.Network,
	}
}

// ToDeployResponse converts a contract to a contract deploy response
func (c *Contract) ToDeployResponse() *ContractDeployResponse {
	return &ContractDeployResponse{
		ContractID: c.ID.String(),
		TxHash:     c.TxHash,
		Status:     c.Status,
		Address:    c.Address,
	}
} 