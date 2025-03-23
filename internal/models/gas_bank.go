package models

import (
	"context"
	"errors"
	"time"
)

// Gas Bank error constants
var (
	ErrGasBankAccountNotFound      = errors.New("gas bank account not found")
	ErrInsufficientFunds           = errors.New("insufficient funds for withdrawal")
	ErrMaximumWithdrawalExceeded   = errors.New("maximum withdrawal amount exceeded")
	ErrDailyWithdrawalLimitReached = errors.New("daily withdrawal limit reached")
	ErrInvalidWithdrawalAmount     = errors.New("invalid withdrawal amount")
	ErrInvalidDepositAmount        = errors.New("invalid deposit amount")
	ErrDuplicateTransaction        = errors.New("duplicate transaction detected")
	ErrTransactionNotFound         = errors.New("transaction not found")
)

// GasBankTransactionType defines the type of gas bank transaction
type GasBankTransactionType string

// Transaction type constants
const (
	DepositTransaction        GasBankTransactionType = "deposit"
	WithdrawalTransaction     GasBankTransactionType = "withdrawal"
	FeeDeductionTransaction   GasBankTransactionType = "fee_deduction"
	RefundTransaction         GasBankTransactionType = "refund"
	SystemTransferTransaction GasBankTransactionType = "system_transfer"
)

// GasBankTransactionStatus defines the status of a gas bank transaction
type GasBankTransactionStatus string

// Transaction status constants
const (
	TransactionPending   GasBankTransactionStatus = "pending"
	TransactionConfirmed GasBankTransactionStatus = "confirmed"
	TransactionFailed    GasBankTransactionStatus = "failed"
	TransactionCancelled GasBankTransactionStatus = "cancelled"
)

// GasBankAccount represents a user's account in the gas bank
type GasBankAccount struct {
	ID                string    `json:"id" db:"id"`
	UserID            string    `json:"user_id" db:"user_id"`
	WalletAddress     string    `json:"wallet_address" db:"wallet_address"`
	Balance           string    `json:"balance" db:"balance"`
	AvailableBalance  string    `json:"available_balance" db:"available_balance"`
	PendingBalance    string    `json:"pending_balance" db:"pending_balance"`
	DailyWithdrawal   string    `json:"daily_withdrawal" db:"daily_withdrawal"`
	LastWithdrawalDay time.Time `json:"last_withdrawal_day" db:"last_withdrawal_day"`
	Active            bool      `json:"active" db:"active"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

// GasBankTransaction represents a gas bank transaction
type GasBankTransaction struct {
	ID             string                   `json:"id" db:"id"`
	AccountID      string                   `json:"account_id" db:"account_id"`
	UserID         string                   `json:"user_id" db:"user_id"`
	Type           GasBankTransactionType   `json:"type" db:"type"`
	Amount         string                   `json:"amount" db:"amount"`
	Fee            string                   `json:"fee" db:"fee"`
	NetAmount      string                   `json:"net_amount" db:"net_amount"`
	Status         GasBankTransactionStatus `json:"status" db:"status"`
	BlockchainTxID string                   `json:"blockchain_tx_id" db:"blockchain_tx_id"`
	FromAddress    string                   `json:"from_address" db:"from_address"`
	ToAddress      string                   `json:"to_address" db:"to_address"`
	Notes          string                   `json:"notes" db:"notes"`
	ConfirmedAt    *time.Time               `json:"confirmed_at" db:"confirmed_at"`
	BlockHeight    uint32                   `json:"block_height" db:"block_height"`
	ErrorMessage   string                   `json:"error_message" db:"error_message"`
	CreatedAt      time.Time                `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time                `json:"updated_at" db:"updated_at"`
}

// WithdrawalRequest represents a request to withdraw funds from the gas bank
type WithdrawalRequest struct {
	ID            string                   `json:"id" db:"id"`
	AccountID     string                   `json:"account_id" db:"account_id"`
	UserID        string                   `json:"user_id" db:"user_id"`
	Amount        string                   `json:"amount" db:"amount"`
	Fee           string                   `json:"fee" db:"fee"`
	NetAmount     string                   `json:"net_amount" db:"net_amount"`
	Status        GasBankTransactionStatus `json:"status" db:"status"`
	ToAddress     string                   `json:"to_address" db:"to_address"`
	TransactionID string                   `json:"transaction_id" db:"transaction_id"`
	ErrorMessage  string                   `json:"error_message" db:"error_message"`
	CreatedAt     time.Time                `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at" db:"updated_at"`
}

// DepositTracker represents a record of deposits tracked from the blockchain
type DepositTracker struct {
	ID             string    `json:"id" db:"id"`
	BlockchainTxID string    `json:"blockchain_tx_id" db:"blockchain_tx_id"`
	FromAddress    string    `json:"from_address" db:"from_address"`
	ToAddress      string    `json:"to_address" db:"to_address"`
	Amount         string    `json:"amount" db:"amount"`
	Status         string    `json:"status" db:"status"`
	Processed      bool      `json:"processed" db:"processed"`
	TransactionID  string    `json:"transaction_id" db:"transaction_id"`
	BlockHeight    uint32    `json:"block_height" db:"block_height"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// GasBankRepository defines the interface for gas bank operations
type GasBankRepository interface {
	// Account operations
	CreateAccount(ctx interface{}, account *GasBankAccount) (*GasBankAccount, error)
	GetAccount(ctx interface{}, id string) (*GasBankAccount, error)
	GetAccountByUserID(ctx interface{}, userID string) (*GasBankAccount, error)
	GetAccountByWalletAddress(ctx interface{}, address string) (*GasBankAccount, error)
	UpdateAccount(ctx interface{}, account *GasBankAccount) (*GasBankAccount, error)
	ListAccounts(ctx interface{}) ([]*GasBankAccount, error)

	// Transaction operations
	CreateTransaction(ctx interface{}, tx *GasBankTransaction) (*GasBankTransaction, error)
	GetTransaction(ctx interface{}, id string) (*GasBankTransaction, error)
	GetTransactionByBlockchainTxID(ctx interface{}, txID string) (*GasBankTransaction, error)
	UpdateTransaction(ctx interface{}, tx *GasBankTransaction) (*GasBankTransaction, error)
	ListTransactionsByUserID(ctx interface{}, userID string, limit int, offset int) ([]*GasBankTransaction, error)
	ListTransactionsByAccountID(ctx interface{}, accountID string, limit int, offset int) ([]*GasBankTransaction, error)

	// Withdrawal operations
	CreateWithdrawalRequest(ctx interface{}, req *WithdrawalRequest) (*WithdrawalRequest, error)
	GetWithdrawalRequest(ctx interface{}, id string) (*WithdrawalRequest, error)
	UpdateWithdrawalRequest(ctx interface{}, req *WithdrawalRequest) (*WithdrawalRequest, error)
	ListWithdrawalRequestsByUserID(ctx interface{}, userID string, limit int, offset int) ([]*WithdrawalRequest, error)

	// Deposit tracking operations
	CreateDepositTracker(ctx interface{}, deposit *DepositTracker) (*DepositTracker, error)
	GetDepositTrackerByTxID(ctx interface{}, txID string) (*DepositTracker, error)
	UpdateDepositTracker(ctx interface{}, deposit *DepositTracker) (*DepositTracker, error)
	ListUnprocessedDeposits(ctx interface{}) ([]*DepositTracker, error)

	// Balance operations
	UpdateBalance(ctx interface{}, accountID string, newBalance string, newPendingBalance string, newAvailableBalance string) error
	IncrementDailyWithdrawal(ctx interface{}, accountID string, amount string) error
	ResetDailyWithdrawal(ctx interface{}, accountID string) error
}

// GasBankService defines the interface for the gas bank service
type GasBankService interface {
	// Account management
	CreateAccount(ctx context.Context, userID string, walletAddress string) (*GasBankAccount, error)
	GetAccount(ctx context.Context, id string) (*GasBankAccount, error)
	GetAccountByUserID(ctx context.Context, userID string) (*GasBankAccount, error)
	GetAccountByWalletAddress(ctx context.Context, walletAddress string) (*GasBankAccount, error)
	ListAccounts(ctx context.Context) ([]*GasBankAccount, error)

	// Balance operations
	GetBalance(ctx context.Context, accountID string) (string, error)
	GetAvailableBalance(ctx context.Context, accountID string) (string, error)

	// Transaction operations
	ProcessDeposit(ctx context.Context, fromAddress string, toAddress string, amount string, blockchainTxID string, blockHeight uint32) (*GasBankTransaction, error)
	RequestWithdrawal(ctx context.Context, userID string, amount string, toAddress string) (*WithdrawalRequest, error)
	ProcessWithdrawalRequest(ctx context.Context, requestID string) (*GasBankTransaction, error)
	CancelWithdrawalRequest(ctx context.Context, requestID string) error
	DeductFee(ctx context.Context, userID string, amount string, notes string) (*GasBankTransaction, error)

	// Transaction history
	GetTransaction(ctx context.Context, id string) (*GasBankTransaction, error)
	ListTransactionsByUserID(ctx context.Context, userID string, limit int, offset int) ([]*GasBankTransaction, error)
	ListTransactionsByAccountID(ctx context.Context, accountID string, limit int, offset int) ([]*GasBankTransaction, error)

	// Withdrawal history
	GetWithdrawalRequest(ctx context.Context, id string) (*WithdrawalRequest, error)
	ListWithdrawalRequestsByUserID(ctx context.Context, userID string, limit int, offset int) ([]*WithdrawalRequest, error)

	// Service lifecycle
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}
