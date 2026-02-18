package database

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"
)

// =============================================================================
// Gas Bank Account Operations
// =============================================================================

// GetGasBankAccount retrieves a gas bank account.
func (r *Repository) GetGasBankAccount(ctx context.Context, userID string) (*GasBankAccount, error) {
	if err := ValidateUserID(userID); err != nil {
		return nil, err
	}

	data, err := r.client.request(ctx, "GET", "gasbank_accounts", nil, "user_id=eq."+url.QueryEscape(userID)+"&limit=1")
	if err != nil {
		return nil, fmt.Errorf("%w: get gasbank account: %v", ErrDatabaseError, err)
	}

	var accounts []GasBankAccount
	if err := json.Unmarshal(data, &accounts); err != nil {
		return nil, fmt.Errorf("%w: unmarshal gasbank accounts: %v", ErrDatabaseError, err)
	}
	if len(accounts) == 0 {
		return nil, NewNotFoundError("gasbank_account", userID)
	}
	return &accounts[0], nil
}

// CreateGasBankAccount creates a new gas bank account.
func (r *Repository) CreateGasBankAccount(ctx context.Context, account *GasBankAccount) error {
	if account == nil {
		return fmt.Errorf("%w: account cannot be nil", ErrInvalidInput)
	}
	if err := ValidateUserID(account.UserID); err != nil {
		return err
	}

	data, err := r.client.request(ctx, "POST", "gasbank_accounts", account, "")
	if err != nil {
		return fmt.Errorf("%w: create gasbank account: %v", ErrDatabaseError, err)
	}
	var accounts []GasBankAccount
	if err := json.Unmarshal(data, &accounts); err != nil {
		return fmt.Errorf("%w: unmarshal gasbank accounts: %v", ErrDatabaseError, err)
	}
	if len(accounts) > 0 {
		account.ID = accounts[0].ID
	}
	return nil
}

// GetOrCreateGasBankAccount gets or creates a gas bank account for a user.
// Uses upsert pattern to handle race conditions safely.
func (r *Repository) GetOrCreateGasBankAccount(ctx context.Context, userID string) (*GasBankAccount, error) {
	if err := ValidateUserID(userID); err != nil {
		return nil, err
	}

	// First try to get existing account
	account, err := r.GetGasBankAccount(ctx, userID)
	if err == nil {
		return account, nil
	}

	// Only proceed if it's a not found error
	if !IsNotFound(err) {
		return nil, err
	}

	// Create new account with upsert semantics
	// Use Supabase's on_conflict to handle race conditions
	newAccount := &GasBankAccount{
		UserID:    userID,
		Balance:   0,
		Reserved:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Use upsert with on_conflict=user_id to handle race conditions
	data, err := r.client.request(ctx, "POST", "gasbank_accounts", newAccount, "on_conflict=user_id")
	if err != nil {
		// If creation failed due to conflict, try to get the existing account
		account, getErr := r.GetGasBankAccount(ctx, userID)
		if getErr == nil {
			return account, nil
		}
		return nil, fmt.Errorf("%w: create gasbank account: %v", ErrDatabaseError, err)
	}

	var accounts []GasBankAccount
	if err := json.Unmarshal(data, &accounts); err != nil {
		return nil, fmt.Errorf("%w: unmarshal gasbank accounts: %v", ErrDatabaseError, err)
	}
	if len(accounts) > 0 {
		return &accounts[0], nil
	}

	// Fallback: try to get the account again
	return r.GetGasBankAccount(ctx, userID)
}

// UpdateGasBankBalance updates a gas bank account balance.
func (r *Repository) UpdateGasBankBalance(ctx context.Context, userID string, balance, reserved int64) error {
	if err := ValidateUserID(userID); err != nil {
		return err
	}
	if balance < 0 {
		return fmt.Errorf("%w: balance cannot be negative", ErrInvalidInput)
	}
	if reserved < 0 {
		return fmt.Errorf("%w: reserved cannot be negative", ErrInvalidInput)
	}

	update := map[string]interface{}{
		"balance":    balance,
		"reserved":   reserved,
		"updated_at": time.Now(),
	}
	_, err := r.client.request(ctx, "PATCH", "gasbank_accounts", update, "user_id=eq."+url.QueryEscape(userID))
	if err != nil {
		return fmt.Errorf("%w: update gasbank balance: %v", ErrDatabaseError, err)
	}
	return nil
}

// =============================================================================
// Gas Bank Transaction Operations
// =============================================================================

// CreateGasBankTransaction creates a new gas bank transaction record.
func (r *Repository) CreateGasBankTransaction(ctx context.Context, tx *GasBankTransaction) error {
	if tx == nil {
		return fmt.Errorf("%w: transaction cannot be nil", ErrInvalidInput)
	}
	if tx.ID == "" {
		return fmt.Errorf("%w: transaction id cannot be empty", ErrInvalidInput)
	}

	_, err := r.client.request(ctx, "POST", "gasbank_transactions", tx, "")
	if err != nil {
		return fmt.Errorf("%w: create gasbank transaction: %v", ErrDatabaseError, err)
	}
	return nil
}

// GetGasBankTransactions retrieves transaction history for an account.
func (r *Repository) GetGasBankTransactions(ctx context.Context, accountID string, limit int) ([]GasBankTransaction, error) {
	if err := ValidateID(accountID); err != nil {
		return nil, err
	}
	limit = ValidateLimit(limit, 50, 1000)

	query := fmt.Sprintf("account_id=eq.%s&order=created_at.desc&limit=%d", url.QueryEscape(accountID), limit)
	data, err := r.client.request(ctx, "GET", "gasbank_transactions", nil, query)
	if err != nil {
		return nil, fmt.Errorf("%w: get gasbank transactions: %v", ErrDatabaseError, err)
	}

	var txs []GasBankTransaction
	if err := json.Unmarshal(data, &txs); err != nil {
		return nil, fmt.Errorf("%w: unmarshal gasbank transactions: %v", ErrDatabaseError, err)
	}
	return txs, nil
}

// =============================================================================
// Deposit Operations
// =============================================================================

// CreateDepositRequest creates a new deposit request.
func (r *Repository) CreateDepositRequest(ctx context.Context, deposit *DepositRequest) error {
	if deposit == nil {
		return fmt.Errorf("%w: deposit cannot be nil", ErrInvalidInput)
	}
	if err := ValidateUserID(deposit.UserID); err != nil {
		return err
	}

	data, err := r.client.request(ctx, "POST", "deposit_requests", deposit, "")
	if err != nil {
		return fmt.Errorf("%w: create deposit request: %v", ErrDatabaseError, err)
	}
	var deposits []DepositRequest
	if err := json.Unmarshal(data, &deposits); err != nil {
		return fmt.Errorf("%w: unmarshal deposit requests: %v", ErrDatabaseError, err)
	}
	if len(deposits) > 0 {
		deposit.ID = deposits[0].ID
	}
	return nil
}

// GetDepositRequests retrieves deposit requests for a user.
func (r *Repository) GetDepositRequests(ctx context.Context, userID string, limit int) ([]DepositRequest, error) {
	if err := ValidateUserID(userID); err != nil {
		return nil, err
	}
	limit = ValidateLimit(limit, 50, 1000)

	query := fmt.Sprintf("user_id=eq.%s&order=created_at.desc&limit=%d", url.QueryEscape(userID), limit)
	data, err := r.client.request(ctx, "GET", "deposit_requests", nil, query)
	if err != nil {
		return nil, fmt.Errorf("%w: get deposit requests: %v", ErrDatabaseError, err)
	}

	var deposits []DepositRequest
	if err := json.Unmarshal(data, &deposits); err != nil {
		return nil, fmt.Errorf("%w: unmarshal deposit requests: %v", ErrDatabaseError, err)
	}
	return deposits, nil
}

// GetDepositByTxHash retrieves a deposit by transaction hash.
func (r *Repository) GetDepositByTxHash(ctx context.Context, txHash string) (*DepositRequest, error) {
	if err := ValidateTxHash(txHash); err != nil {
		return nil, err
	}

	query := fmt.Sprintf("tx_hash=eq.%s&limit=1", url.QueryEscape(txHash))
	data, err := r.client.request(ctx, "GET", "deposit_requests", nil, query)
	if err != nil {
		return nil, fmt.Errorf("%w: get deposit by tx_hash: %v", ErrDatabaseError, err)
	}

	var deposits []DepositRequest
	if err := json.Unmarshal(data, &deposits); err != nil {
		return nil, fmt.Errorf("%w: unmarshal deposit requests: %v", ErrDatabaseError, err)
	}
	if len(deposits) == 0 {
		return nil, NewNotFoundError("deposit", txHash)
	}
	return &deposits[0], nil
}

// UpdateDepositStatus updates a deposit request status.
func (r *Repository) UpdateDepositStatus(ctx context.Context, depositID, status string, confirmations int) error {
	if err := ValidateID(depositID); err != nil {
		return err
	}
	validStatuses := []string{"pending", "confirming", "confirmed", "failed", "expired"}
	if err := ValidateStatus(status, validStatuses); err != nil {
		return err
	}

	update := map[string]interface{}{
		"status":        status,
		"confirmations": confirmations,
	}
	if status == "confirmed" {
		update["confirmed_at"] = time.Now()
	}
	_, err := r.client.request(ctx, "PATCH", "deposit_requests", update, "id=eq."+url.QueryEscape(depositID))
	if err != nil {
		return fmt.Errorf("%w: update deposit status: %v", ErrDatabaseError, err)
	}
	return nil
}

// GetPendingDeposits retrieves pending and confirming deposits that may need verification or cleanup.
func (r *Repository) GetPendingDeposits(ctx context.Context, limit int) ([]DepositRequest, error) {
	limit = ValidateLimit(limit, 100, 1000)

	// Query for pending and confirming deposits, ordered by creation time.
	query := fmt.Sprintf("status=in.(pending,confirming)&order=created_at.asc&limit=%d", limit)
	data, err := r.client.request(ctx, "GET", "deposit_requests", nil, query)
	if err != nil {
		return nil, fmt.Errorf("%w: get pending deposits: %v", ErrDatabaseError, err)
	}

	var deposits []DepositRequest
	if err := json.Unmarshal(data, &deposits); err != nil {
		return nil, fmt.Errorf("%w: unmarshal deposit requests: %v", ErrDatabaseError, err)
	}
	return deposits, nil
}

// =============================================================================
// Atomic Operations (via Supabase RPC / stored procedures)
// =============================================================================

// rpcDeductRow maps the JSON returned by gasbank_atomic_deduct.
type rpcDeductRow struct {
	Success       bool   `json:"success"`
	NewBalance    int64  `json:"new_balance"`
	TransactionID string `json:"transaction_id"`
	ErrorMessage  string `json:"error_message"`
}

// rpcCreditRow maps the JSON returned by gasbank_atomic_credit.
type rpcCreditRow struct {
	Success       bool   `json:"success"`
	NewBalance    int64  `json:"new_balance"`
	TransactionID string `json:"transaction_id"`
	ErrorMessage  string `json:"error_message"`
}

// rpcReserveRow maps the JSON returned by gasbank_atomic_reserve.
type rpcReserveRow struct {
	Success      bool   `json:"success"`
	NewBalance   int64  `json:"new_balance"`
	NewReserved  int64  `json:"new_reserved"`
	ErrorMessage string `json:"error_message"`
}

// rpcReleaseRow maps the JSON returned by gasbank_atomic_release.
type rpcReleaseRow struct {
	Success      bool   `json:"success"`
	NewBalance   int64  `json:"new_balance"`
	NewReserved  int64  `json:"new_reserved"`
	ErrorMessage string `json:"error_message"`
}

// DeductFeeAtomic calls the gasbank_atomic_deduct stored procedure.
func (r *Repository) DeductFeeAtomic(ctx context.Context, userID string, amount int64, serviceID, referenceID string) (*AtomicDeductResult, error) {
	if err := ValidateUserID(userID); err != nil {
		return nil, err
	}

	params := map[string]interface{}{
		"p_user_id":    userID,
		"p_amount":     amount,
		"p_service_id": serviceID,
	}
	if referenceID != "" {
		params["p_reference_id"] = referenceID
	}

	data, err := r.client.requestRPC(ctx, "POST", "rpc/gasbank_atomic_deduct", params, "")
	if err != nil {
		return nil, fmt.Errorf("%w: rpc gasbank_atomic_deduct: %v", ErrDatabaseError, err)
	}

	var rows []rpcDeductRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("%w: unmarshal atomic deduct result: %v", ErrDatabaseError, err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%w: atomic deduct returned no rows", ErrDatabaseError)
	}

	row := rows[0]
	return &AtomicDeductResult{
		Success:       row.Success,
		NewBalance:    row.NewBalance,
		TransactionID: row.TransactionID,
		Error:         row.ErrorMessage,
	}, nil
}

// CreditDepositAtomic calls the gasbank_atomic_credit stored procedure.
func (r *Repository) CreditDepositAtomic(ctx context.Context, userID string, amount int64, txHash, fromAddress, referenceID string) (*AtomicCreditResult, error) {
	if err := ValidateUserID(userID); err != nil {
		return nil, err
	}

	params := map[string]interface{}{
		"p_user_id":      userID,
		"p_amount":       amount,
		"p_tx_hash":      txHash,
		"p_from_address": fromAddress,
	}
	if referenceID != "" {
		params["p_reference_id"] = referenceID
	}

	data, err := r.client.requestRPC(ctx, "POST", "rpc/gasbank_atomic_credit", params, "")
	if err != nil {
		return nil, fmt.Errorf("%w: rpc gasbank_atomic_credit: %v", ErrDatabaseError, err)
	}

	var rows []rpcCreditRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("%w: unmarshal atomic credit result: %v", ErrDatabaseError, err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%w: atomic credit returned no rows", ErrDatabaseError)
	}

	row := rows[0]
	return &AtomicCreditResult{
		Success:       row.Success,
		NewBalance:    row.NewBalance,
		TransactionID: row.TransactionID,
		Error:         row.ErrorMessage,
	}, nil
}

// ReserveFundsAtomic calls the gasbank_atomic_reserve stored procedure.
func (r *Repository) ReserveFundsAtomic(ctx context.Context, userID string, amount int64) (*AtomicReserveResult, error) {
	if err := ValidateUserID(userID); err != nil {
		return nil, err
	}

	params := map[string]interface{}{
		"p_user_id": userID,
		"p_amount":  amount,
	}

	data, err := r.client.requestRPC(ctx, "POST", "rpc/gasbank_atomic_reserve", params, "")
	if err != nil {
		return nil, fmt.Errorf("%w: rpc gasbank_atomic_reserve: %v", ErrDatabaseError, err)
	}

	var rows []rpcReserveRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("%w: unmarshal atomic reserve result: %v", ErrDatabaseError, err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%w: atomic reserve returned no rows", ErrDatabaseError)
	}

	row := rows[0]
	return &AtomicReserveResult{
		Success:     row.Success,
		NewBalance:  row.NewBalance,
		NewReserved: row.NewReserved,
		Error:       row.ErrorMessage,
	}, nil
}

// ReleaseFundsAtomic calls the gasbank_atomic_release stored procedure.
func (r *Repository) ReleaseFundsAtomic(ctx context.Context, userID string, amount int64, commit bool) (*AtomicReleaseResult, error) {
	if err := ValidateUserID(userID); err != nil {
		return nil, err
	}

	params := map[string]interface{}{
		"p_user_id": userID,
		"p_amount":  amount,
		"p_commit":  commit,
	}

	data, err := r.client.requestRPC(ctx, "POST", "rpc/gasbank_atomic_release", params, "")
	if err != nil {
		return nil, fmt.Errorf("%w: rpc gasbank_atomic_release: %v", ErrDatabaseError, err)
	}

	var rows []rpcReleaseRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("%w: unmarshal atomic release result: %v", ErrDatabaseError, err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%w: atomic release returned no rows", ErrDatabaseError)
	}

	row := rows[0]
	return &AtomicReleaseResult{
		Success:     row.Success,
		NewBalance:  row.NewBalance,
		NewReserved: row.NewReserved,
		Error:       row.ErrorMessage,
	}, nil
}
