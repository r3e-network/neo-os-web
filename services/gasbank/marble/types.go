// Package neogasbank provides GasBank service for managing user gas balances.
package neogasbank

import "time"

// DepositStatus represents the status of a deposit request.
type DepositStatus string

const (
	DepositStatusPending    DepositStatus = "pending"
	DepositStatusConfirming DepositStatus = "confirming"
	DepositStatusConfirmed  DepositStatus = "confirmed"
	DepositStatusFailed     DepositStatus = "failed"
	DepositStatusExpired    DepositStatus = "expired"
)

// TransactionType represents the type of a gas bank transaction.
type TransactionType string

const (
	TxTypeDeposit    TransactionType = "deposit"
	TxTypeWithdraw   TransactionType = "withdraw"
	TxTypeServiceFee TransactionType = "service_fee"
	TxTypeRefund     TransactionType = "refund"
)

// GetAccountRequest is the request for getting account info.
type GetAccountRequest struct {
	UserID string `json:"user_id"`
}

// GetAccountResponse is the response for getting account info.
// Note: Balance fields use string serialization to avoid JS Number precision loss.
type GetAccountResponse struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Balance   int64     `json:"balance,string"`
	Reserved  int64     `json:"reserved,string"`
	Available int64     `json:"available,string"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DeductFeeRequest is the request for deducting service fees.
type DeductFeeRequest struct {
	UserID      string `json:"user_id"`
	Amount      int64  `json:"amount"`
	ServiceID   string `json:"service_id"`
	ReferenceID string `json:"reference_id"`
	Description string `json:"description,omitempty"`
}

// DeductFeeResponse is the response for deducting service fees.
type DeductFeeResponse struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transaction_id,omitempty"`
	BalanceAfter  int64  `json:"balance_after,string"`
	Error         string `json:"error,omitempty"`
}

// ReserveFundsRequest is the request for reserving funds.
type ReserveFundsRequest struct {
	UserID      string `json:"user_id"`
	Amount      int64  `json:"amount"`
	ReferenceID string `json:"reference_id"`
}

// ReserveFundsResponse is the response for reserving funds.
type ReserveFundsResponse struct {
	Success      bool  `json:"success"`
	Reserved     int64 `json:"reserved,string"`
	BalanceAfter int64 `json:"balance_after,string"`
}

// ReleaseFundsRequest is the request for releasing reserved funds.
type ReleaseFundsRequest struct {
	UserID      string `json:"user_id"`
	Amount      int64  `json:"amount"`
	ReferenceID string `json:"reference_id"`
	Commit      bool   `json:"commit"` // true = deduct, false = release back
}

// ReleaseFundsResponse is the response for releasing reserved funds.
type ReleaseFundsResponse struct {
	Success      bool  `json:"success"`
	BalanceAfter int64 `json:"balance_after,string"`
}

// DepositInfo represents deposit information for API responses.
type DepositInfo struct {
	ID            string        `json:"id"`
	Amount        int64         `json:"amount,string"`
	TxHash        string        `json:"tx_hash,omitempty"`
	FromAddress   string        `json:"from_address"`
	Status        DepositStatus `json:"status"`
	Confirmations int           `json:"confirmations"`
	CreatedAt     time.Time     `json:"created_at"`
	ConfirmedAt   *time.Time    `json:"confirmed_at,omitempty"`
}

// TransactionInfo represents transaction information for API responses.
type TransactionInfo struct {
	ID           string          `json:"id"`
	TxType       TransactionType `json:"tx_type"`
	Amount       int64           `json:"amount,string"`
	BalanceAfter int64           `json:"balance_after,string"`
	ReferenceID  string          `json:"reference_id,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}
