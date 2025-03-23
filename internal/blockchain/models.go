package blockchain

import (
	"time"
)

// InvokeResult represents the result of a smart contract invocation
type InvokeResult struct {
	Success       bool              `json:"success"`
	TransactionID string            `json:"transaction_id"`
	GasConsumed   string            `json:"gas_consumed"`
	Result        map[string]string `json:"result"`
}

// TransactionInfo represents detailed information about a blockchain transaction
type TransactionInfo struct {
	TransactionID string    `json:"transaction_id"`
	BlockHash     string    `json:"block_hash"`
	BlockHeight   uint32    `json:"block_height"`
	Timestamp     time.Time `json:"timestamp"`
	Sender        string    `json:"sender"`
	Status        string    `json:"status"`
	GasConsumed   string    `json:"gas_consumed"`
}

// ContractDeployment represents the data needed to deploy a smart contract
type ContractDeployment struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	NEF         []byte            `json:"nef"`
	Manifest    string            `json:"manifest"`
	Parameters  map[string]string `json:"parameters"`
}

// DeployResult represents the result of a contract deployment
type DeployResult struct {
	Success       bool   `json:"success"`
	ScriptHash    string `json:"script_hash"`
	TransactionID string `json:"transaction_id"`
	GasConsumed   string `json:"gas_consumed"`
}

// Balance represents an account's token balance
type Balance struct {
	Asset   string `json:"asset"`
	Address string `json:"address"`
	Amount  string `json:"amount"`
}

// TransferResult represents the result of a token transfer
type TransferResult struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transaction_id"`
	FromAddress   string `json:"from_address"`
	ToAddress     string `json:"to_address"`
	Asset         string `json:"asset"`
	Amount        string `json:"amount"`
}

// Client defines the interface for blockchain operations
type Client interface {
	// Contract operations
	InvokeContractFunction(scriptHash string, method string, args []interface{}) (*InvokeResult, error)
	GetContractStorage(scriptHash string, key string) (string, error)
	DeployContract(ctx interface{}, contract *ContractDeployment) (*DeployResult, error)

	// Transaction operations
	GetTransactionInfo(txID string) (*TransactionInfo, error)

	// Blockchain query operations
	GetBlockHeight() (uint32, error)

	// Asset operations
	GetBalance(address string, assetID string) (*Balance, error)
	Transfer(fromAddress string, toAddress string, amount string, assetID string) (*TransferResult, error)
}
