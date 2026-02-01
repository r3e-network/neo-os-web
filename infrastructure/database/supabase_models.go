package database

import (
	"encoding/json"
	"time"
)

// =============================================================================
// Domain Models
// =============================================================================

// User represents a user account.
type User struct {
	ID        string    `json:"id"`
	Address   string    `json:"address,omitempty"`
	Email     string    `json:"email,omitempty"`
	Nonce     string    `json:"nonce,omitempty"` // For signature verification
	CreatedAt time.Time `json:"created_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}

// APIKey represents an API key.
type APIKey struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	KeyHash     string    `json:"key_hash"`
	Prefix      string    `json:"prefix"`
	Scopes      []string  `json:"scopes"`
	Description string    `json:"description,omitempty"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	LastUsed    time.Time `json:"last_used,omitempty"`
}

// ServiceRequest represents a service request.
type ServiceRequest struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	ServiceType string          `json:"service_type"`
	Status      string          `json:"status"`
	Payload     json.RawMessage `json:"payload"`
	Result      json.RawMessage `json:"result,omitempty"`
	Error       string          `json:"error,omitempty"`
	GasUsed     int64           `json:"gas_used"`
	CreatedAt   time.Time       `json:"created_at"`
	CompletedAt time.Time       `json:"completed_at,omitempty"`
}

// PriceFeed represents a price feed entry.
type PriceFeed struct {
	ID        string    `json:"id"`
	FeedID    string    `json:"feed_id"`
	Pair      string    `json:"pair"`
	Price     int64     `json:"price"`
	Decimals  int       `json:"decimals"`
	Timestamp time.Time `json:"timestamp"`
	Sources   []string  `json:"sources"`
	Signature []byte    `json:"signature"`
}

// GasBankAccount represents a gas bank account.
type GasBankAccount struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Balance   int64     `json:"balance"`
	Reserved  int64     `json:"reserved"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserWallet represents a user's wallet binding.
type UserWallet struct {
	ID                    string    `json:"id"`
	UserID                string    `json:"user_id"`
	Address               string    `json:"address"`
	Label                 string    `json:"label,omitempty"`
	IsPrimary             bool      `json:"is_primary"`
	Verified              bool      `json:"verified"`
	VerificationMessage   string    `json:"verification_message,omitempty"`
	VerificationSignature string    `json:"verification_signature,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
}

// DepositRequest represents a deposit request.
type DepositRequest struct {
	ID                    string    `json:"id"`
	UserID                string    `json:"user_id"`
	AccountID             string    `json:"account_id"`
	Amount                int64     `json:"amount"`
	TxHash                string    `json:"tx_hash,omitempty"`
	FromAddress           string    `json:"from_address"`
	Status                string    `json:"status"`
	Confirmations         int       `json:"confirmations"`
	RequiredConfirmations int       `json:"required_confirmations"`
	Error                 string    `json:"error,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	ConfirmedAt           time.Time `json:"confirmed_at,omitempty"`
	ExpiresAt             time.Time `json:"expires_at"`
}

// GasBankTransaction represents a gas bank transaction.
type GasBankTransaction struct {
	ID           string    `json:"id"`
	AccountID    string    `json:"account_id"`
	TxType       string    `json:"tx_type"`
	Amount       int64     `json:"amount"`
	BalanceAfter int64     `json:"balance_after"`
	ReferenceID  string    `json:"reference_id,omitempty"`
	TxHash       string    `json:"tx_hash,omitempty"`
	FromAddress  string    `json:"from_address,omitempty"`
	ToAddress    string    `json:"to_address,omitempty"`
	Status       string    `json:"status,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}
