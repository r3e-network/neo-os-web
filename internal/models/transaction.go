package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// TransactionStatus represents the status of a blockchain transaction
type TransactionStatus string

const (
	// TransactionStatusCreated - Transaction has been created but not yet submitted
	TransactionStatusCreated TransactionStatus = "created"
	// TransactionStatusPending - Transaction has been submitted to the blockchain
	TransactionStatusPending TransactionStatus = "pending"
	// TransactionStatusConfirming - Transaction has been included in a block but waiting for confirmation blocks
	TransactionStatusConfirming TransactionStatus = "confirming"
	// TransactionStatusConfirmed - Transaction has been confirmed with the required number of blocks
	TransactionStatusConfirmed TransactionStatus = "confirmed"
	// TransactionStatusFailed - Transaction has failed due to execution error or rejection
	TransactionStatusFailed TransactionStatus = "failed"
	// TransactionStatusExpired - Transaction has not been included in a block within the timeout period
	TransactionStatusExpired TransactionStatus = "expired"
	// TransactionStatusCancelled - Transaction has been cancelled before confirmation
	TransactionStatusCancelled TransactionStatus = "cancelled"
)

// TransactionType represents the type of blockchain transaction
type TransactionType string

const (
	// TransactionTypeInvoke - Smart contract invocation
	TransactionTypeInvoke TransactionType = "invoke"
	// TransactionTypeDeployment - Smart contract deployment
	TransactionTypeDeployment TransactionType = "deployment"
	// TransactionTypeTransfer - Asset transfer
	TransactionTypeTransfer TransactionType = "transfer"
	// TransactionTypeClaimGas - GAS claim transaction
	TransactionTypeClaimGas TransactionType = "claim_gas"
)

// Transaction represents a blockchain transaction
type Transaction struct {
	ID          uuid.UUID         `json:"id" db:"id"`
	Hash        string            `json:"hash" db:"hash"`
	Service     string            `json:"service" db:"service"`
	EntityID    *uuid.UUID        `json:"entityId" db:"entity_id"`
	EntityType  string            `json:"entityType" db:"entity_type"`
	Status      TransactionStatus `json:"status" db:"status"`
	Type        TransactionType   `json:"type" db:"type"`
	Data        json.RawMessage   `json:"data" db:"data"`
	GasConsumed *int64            `json:"gasConsumed,omitempty" db:"gas_consumed"`
	GasPrice    int64             `json:"gasPrice" db:"gas_price"`
	SystemFee   int64             `json:"systemFee" db:"system_fee"`
	NetworkFee  int64             `json:"networkFee" db:"network_fee"`
	BlockHeight *int64            `json:"blockHeight,omitempty" db:"block_height"`
	BlockTime   *time.Time        `json:"blockTime,omitempty" db:"block_time"`
	Sender      string            `json:"sender" db:"sender"`
	Error       string            `json:"error,omitempty" db:"error"`
	Result      json.RawMessage   `json:"result,omitempty" db:"result"`
	CreatedAt   time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time         `json:"updatedAt" db:"updated_at"`
	DeletedAt   *time.Time        `json:"deletedAt,omitempty" db:"deleted_at"`
}

// TransactionEvent represents an event in the lifecycle of a transaction
type TransactionEvent struct {
	ID            uuid.UUID         `json:"id" db:"id"`
	TransactionID uuid.UUID         `json:"transactionId" db:"transaction_id"`
	Status        TransactionStatus `json:"status" db:"status"`
	Details       json.RawMessage   `json:"details,omitempty" db:"details"`
	Timestamp     time.Time         `json:"timestamp" db:"timestamp"`
}

// InvokeScriptData represents the data specific to an invoke transaction
type InvokeScriptData struct {
	Script  string          `json:"script"`
	Params  []interface{}   `json:"params,omitempty"`
	Signers []ScriptSigner  `json:"signers,omitempty"`
	Network string          `json:"network"`
	Witness []ScriptWitness `json:"witness,omitempty"`
}

// DeploymentData represents the data specific to a deployment transaction
type DeploymentData struct {
	Name        string        `json:"name"`
	Version     string        `json:"version"`
	Author      string        `json:"author"`
	Email       string        `json:"email"`
	Description string        `json:"description"`
	NEF         []byte        `json:"nef"`
	Manifest    interface{}   `json:"manifest"`
	Signers     []ScriptSigner  `json:"signers,omitempty"`
	Network     string        `json:"network"`
}

// TransferData represents the data specific to a transfer transaction
type TransferData struct {
	Asset     string        `json:"asset"`
	Amount    string        `json:"amount"`
	Recipient string        `json:"recipient"`
	Signers   []ScriptSigner  `json:"signers,omitempty"`
	Network   string        `json:"network"`
}

// ScriptSigner represents a signer for a Neo transaction
type ScriptSigner struct {
	Account          string              `json:"account"`
	Scopes           string              `json:"scopes"`
	AllowedContracts []string            `json:"allowedContracts,omitempty"`
	AllowedGroups    []string            `json:"allowedGroups,omitempty"`
	Rules            []map[string]string `json:"rules,omitempty"`
}

// ScriptWitness represents a witness for a Neo transaction
type ScriptWitness struct {
	InvocationScript   string `json:"invocationScript"`
	VerificationScript string `json:"verificationScript"`
}

// CreateTransactionRequest represents a request to create a new transaction
type CreateTransactionRequest struct {
	Service     string          `json:"service" validate:"required"`
	EntityID    uuid.UUID       `json:"entityId,omitempty"`
	EntityType  string          `json:"entityType,omitempty"`
	Type        TransactionType `json:"type" validate:"required"`
	Script      string          `json:"script,omitempty"`
	Params      []interface{}   `json:"params,omitempty"`
	Signers     []ScriptSigner  `json:"signers,omitempty"`
	GasPrice    int64           `json:"gasPrice" validate:"required"`
	SystemFee   int64           `json:"systemFee" validate:"required"`
	NetworkFee  int64           `json:"networkFee" validate:"required"`
	Priority    string          `json:"priority,omitempty"`
}

// TransactionListResponse represents the response for listing transactions
type TransactionListResponse struct {
	Total        int           `json:"total"`
	Page         int           `json:"page"`
	Limit        int           `json:"limit"`
	Transactions []Transaction `json:"transactions"`
}

// WalletAccount represents a wallet account for transaction signing
type WalletAccount struct {
	ID                 uuid.UUID `json:"id" db:"id"`
	Service            string    `json:"service" db:"service"`
	Address            string    `json:"address" db:"address"`
	EncryptedPrivateKey string    `json:"encryptedPrivateKey" db:"encrypted_private_key"`
	PublicKey          string    `json:"publicKey" db:"public_key"`
	CreatedAt          time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time `json:"updatedAt" db:"updated_at"`
	DeletedAt          *time.Time `json:"deletedAt,omitempty" db:"deleted_at"`
}

// CreateWalletRequest represents a request to create a new wallet account
type CreateWalletRequest struct {
	Service string `json:"service" validate:"required"`
}

// InitializeTransactionData converts the transaction request to the appropriate data structure
func InitializeTransactionData(req CreateTransactionRequest) ([]byte, error) {
	var data interface{}
	
	switch req.Type {
	case TransactionTypeInvoke:
		data = InvokeScriptData{
			Script:  req.Script,
			Params:  req.Params,
			Signers: req.Signers,
		}
	case TransactionTypeDeployment:
		data = DeploymentData{
			Signers: req.Signers,
		}
	case TransactionTypeTransfer:
		data = TransferData{
			Signers: req.Signers,
		}
	}
	
	return json.Marshal(data)
} 