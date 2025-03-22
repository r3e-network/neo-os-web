package models

import (
	"time"
)

// TransactionType defines the type of gas transaction
type TransactionType string

const (
	// TransactionTypeDeposit represents a gas deposit transaction
	TransactionTypeDeposit TransactionType = "deposit"
	// TransactionTypeWithdraw represents a gas withdrawal transaction
	TransactionTypeWithdraw TransactionType = "withdraw"
	// TransactionTypeFunction represents gas used by function execution
	TransactionTypeFunction TransactionType = "function"
	// TransactionTypePriceFeed represents gas used by price feed updates
	TransactionTypePriceFeed TransactionType = "pricefeed"
	// TransactionTypeOracle represents gas used by oracle data publishing
	TransactionTypeOracle TransactionType = "oracle"
)

// TransactionStatus defines the status of a transaction
type TransactionStatus string

const (
	// TransactionStatusPending represents a pending transaction
	TransactionStatusPending TransactionStatus = "pending"
	// TransactionStatusConfirmed represents a confirmed transaction
	TransactionStatusConfirmed TransactionStatus = "confirmed"
	// TransactionStatusFailed represents a failed transaction
	TransactionStatusFailed TransactionStatus = "failed"
)

// GasAccount represents a user's gas account
type GasAccount struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Address   string    `json:"address" db:"address"`
	Balance   float64   `json:"balance" db:"balance"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Transaction represents a gas transaction
type Transaction struct {
	ID        int              `json:"id" db:"id"`
	UserID    int              `json:"user_id" db:"user_id"`
	AccountID int              `json:"account_id" db:"account_id"`
	Type      TransactionType  `json:"type" db:"type"`
	Amount    float64          `json:"amount" db:"amount"`
	TxHash    string           `json:"tx_hash,omitempty" db:"tx_hash"`
	Status    TransactionStatus `json:"status" db:"status"`
	CreatedAt time.Time        `json:"created_at" db:"created_at"`
}

// GasBankRepository defines methods for working with gas accounts and transactions
type GasBankRepository interface {
	// Account methods
	CreateAccount(account *GasAccount) error
	GetAccountByID(id int) (*GasAccount, error)
	GetAccountByUserIDAndAddress(userID int, address string) (*GasAccount, error)
	GetAccountsByUserID(userID int) ([]*GasAccount, error)
	UpdateAccountBalance(id int, balance float64) error
	
	// Transaction methods
	CreateTransaction(tx *Transaction) error
	GetTransactionByID(id int) (*Transaction, error)
	GetTransactionByTxHash(txHash string) (*Transaction, error)
	ListTransactionsByUserID(userID int, offset, limit int) ([]*Transaction, error)
	ListTransactionsByAccountID(accountID int, offset, limit int) ([]*Transaction, error)
	UpdateTransactionStatus(id int, status TransactionStatus) error
	
	// Combined operations with transaction
	DepositGas(userID int, address string, amount float64, txHash string) (*Transaction, error)
	WithdrawGas(userID int, address string, amount float64, txHash string) (*Transaction, error)
	UseGas(userID int, address string, amount float64, txType TransactionType, relatedID int) (*Transaction, error)
}