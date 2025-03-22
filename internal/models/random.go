package models

import (
	"time"
)

// RandomRequestStatus represents the status of a random number request
type RandomRequestStatus string

const (
	// RandomRequestStatusPending indicates the request is pending
	RandomRequestStatusPending RandomRequestStatus = "pending"
	// RandomRequestStatusCommitted indicates the commitment has been made
	RandomRequestStatusCommitted RandomRequestStatus = "committed"
	// RandomRequestStatusRevealed indicates the random number has been revealed
	RandomRequestStatusRevealed RandomRequestStatus = "revealed"
	// RandomRequestStatusCallbackSent indicates the callback has been sent to the contract
	RandomRequestStatusCallbackSent RandomRequestStatus = "callback_sent"
	// RandomRequestStatusFailed indicates the request failed
	RandomRequestStatusFailed RandomRequestStatus = "failed"
)

// RandomRequest represents a request for a random number
type RandomRequest struct {
	ID                int               `json:"id" db:"id"`
	UserID            int               `json:"user_id" db:"user_id"`
	Status            RandomRequestStatus `json:"status" db:"status"`
	CallbackAddress   string            `json:"callback_address" db:"callback_address"`
	CallbackMethod    string            `json:"callback_method" db:"callback_method"`
	Seed              []byte            `json:"seed" db:"seed"`
	BlockHeight       int64             `json:"block_height" db:"block_height"`
	NumBytes          int               `json:"num_bytes" db:"num_bytes"`
	DelayBlocks       int               `json:"delay_blocks" db:"delay_blocks"`
	GasFee            float64           `json:"gas_fee" db:"gas_fee"`
	CommitmentHash    string            `json:"commitment_hash" db:"commitment_hash"`
	RandomNumber      []byte            `json:"random_number" db:"random_number"`
	Proof             []byte            `json:"proof" db:"proof"`
	CommitmentTxHash  string            `json:"commitment_tx_hash" db:"commitment_tx_hash"`
	RevealTxHash      string            `json:"reveal_tx_hash" db:"reveal_tx_hash"`
	CallbackTxHash    string            `json:"callback_tx_hash" db:"callback_tx_hash"`
	Error             string            `json:"error" db:"error"`
	CreatedAt         time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at" db:"updated_at"`
	RevealedAt        time.Time         `json:"revealed_at" db:"revealed_at"`
}

// EntropySource represents a source of entropy
type EntropySource struct {
	ID         int       `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	Type       string    `json:"type" db:"type"`
	Weight     float64   `json:"weight" db:"weight"`
	Active     bool      `json:"active" db:"active"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// RandomRepository defines the interface for random number data access
type RandomRepository interface {
	// Request management
	CreateRequest(req *RandomRequest) (*RandomRequest, error)
	UpdateRequest(req *RandomRequest) (*RandomRequest, error)
	GetRequestByID(id int) (*RandomRequest, error)
	ListRequests(userID int, offset, limit int) ([]*RandomRequest, error)
	ListPendingRequests() ([]*RandomRequest, error)
	ListCommittedRequests() ([]*RandomRequest, error)
	GetRandomStatistics() (map[string]interface{}, error)
	
	// Entropy source management
	CreateEntropySource(source *EntropySource) (*EntropySource, error)
	UpdateEntropySource(source *EntropySource) (*EntropySource, error)
	GetEntropySourceByID(id int) (*EntropySource, error)
	GetEntropySourceByName(name string) (*EntropySource, error)
	ListEntropySources() ([]*EntropySource, error)
} 