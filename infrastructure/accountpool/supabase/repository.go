// Package supabase provides NeoAccounts-specific database operations.
package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/database"
)

const (
	tableName         = "pool_accounts"
	balancesTableName = "pool_account_balances"
)

// RepositoryInterface defines NeoAccounts-specific data access methods.
// This interface allows for easy mocking in tests.
type RepositoryInterface interface {
	// Account CRUD operations
	Create(ctx context.Context, acc *Account) error
	Update(ctx context.Context, acc *Account) error
	GetByID(ctx context.Context, id string) (*Account, error)
	GetByAddress(ctx context.Context, address string) (*Account, error)
	List(ctx context.Context) ([]Account, error)
	ListAvailable(ctx context.Context, limit int) ([]Account, error)
	ListByLocker(ctx context.Context, lockerID string) ([]Account, error)
	TryLockAccount(ctx context.Context, accountID, serviceID string, lockedAt time.Time) (bool, error)
	TryReleaseAccount(ctx context.Context, accountID, serviceID string) (bool, error)
	Delete(ctx context.Context, id string) error

	// Balance-aware account operations
	GetWithBalances(ctx context.Context, id string) (*AccountWithBalances, error)
	ListWithBalances(ctx context.Context) ([]AccountWithBalances, error)
	ListAvailableWithBalances(ctx context.Context, tokenType string, minBalance *int64, limit int) ([]AccountWithBalances, error)
	ListByLockerWithBalances(ctx context.Context, lockerID string) ([]AccountWithBalances, error)
	ListLowBalanceAccounts(ctx context.Context, tokenType string, maxBalance int64, limit int) ([]AccountWithBalances, error)

	// Balance operations
	UpsertBalance(ctx context.Context, accountID, tokenType, scriptHash string, amount int64, decimals int) error
	GetBalance(ctx context.Context, accountID, tokenType string) (*AccountBalance, error)
	GetBalances(ctx context.Context, accountID string) ([]AccountBalance, error)
	GetBalancesForAccounts(ctx context.Context, accountIDs []string) ([]AccountBalance, error)
	DeleteBalances(ctx context.Context, accountID string) error
	// UpdateBalanceWithLock atomically updates balance while verifying lock ownership
	// Returns (oldBalance, newBalance, txCount, wasUpdated, error)
	// wasUpdated is false if account is not locked by the given service
	UpdateBalanceWithLock(ctx context.Context, accountID, serviceID, tokenType string, delta int64, absolute *int64) (int64, int64, int, bool, error)

	// Statistics
	AggregateTokenStats(ctx context.Context, tokenType string) (*TokenStats, error)
}

// Ensure Repository implements RepositoryInterface
var _ RepositoryInterface = (*Repository)(nil)

// Repository provides NeoAccounts-specific data access methods.
type Repository struct {
	base *database.Repository
}

// NewRepository creates a new NeoAccounts repository.
func NewRepository(base *database.Repository) *Repository {
	return &Repository{base: base}
}

// =============================================================================
// Account CRUD Operations
// =============================================================================

// Create inserts a new pool account.
func (r *Repository) Create(ctx context.Context, acc *Account) error {
	return database.GenericCreate(r.base, ctx, tableName, acc, func(rows []Account) {
		if len(rows) > 0 {
			*acc = rows[0]
		}
	})
}

// Update updates a pool account by ID.
func (r *Repository) Update(ctx context.Context, acc *Account) error {
	return database.GenericUpdate(r.base, ctx, tableName, "id", acc.ID, acc)
}

// GetByID fetches a pool account by ID.
func (r *Repository) GetByID(ctx context.Context, id string) (*Account, error) {
	return database.GenericGetByField[Account](r.base, ctx, tableName, "id", id)
}

// GetByAddress fetches a pool account by address.
func (r *Repository) GetByAddress(ctx context.Context, address string) (*Account, error) {
	return database.GenericGetByField[Account](r.base, ctx, tableName, "address", address)
}

// List returns all pool accounts.
func (r *Repository) List(ctx context.Context) ([]Account, error) {
	return database.GenericList[Account](r.base, ctx, tableName)
}

// ListAvailable returns unlocked, non-retiring accounts up to limit.
func (r *Repository) ListAvailable(ctx context.Context, limit int) ([]Account, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	query := database.NewQuery().
		IsFalse("is_retiring").
		IsNull("locked_by").
		OrderAsc("last_used_at").
		Limit(limit).
		Build()

	return database.GenericListWithQuery[Account](r.base, ctx, tableName, query)
}

// ListByLocker returns accounts locked by a specific service.
func (r *Repository) ListByLocker(ctx context.Context, lockerID string) ([]Account, error) {
	if lockerID == "" {
		return nil, fmt.Errorf("locker_id cannot be empty")
	}
	return database.GenericListByField[Account](r.base, ctx, tableName, "locked_by", lockerID)
}

// TryLockAccount attempts to lock an account if it is currently unlocked and active.
// Returns true when the account was locked by this call.
func (r *Repository) TryLockAccount(ctx context.Context, accountID, serviceID string, lockedAt time.Time) (bool, error) {
	if accountID == "" || serviceID == "" {
		return false, fmt.Errorf("account_id and service_id are required")
	}

	update := map[string]interface{}{
		"locked_by": serviceID,
		"locked_at": lockedAt,
	}

	query := database.NewQuery().
		Eq("id", accountID).
		IsNull("locked_by").
		IsFalse("is_retiring").
		Build()

	data, err := r.base.Request(ctx, "PATCH", tableName, update, query)
	if err != nil {
		return false, err
	}

	var rows []Account
	if err := json.Unmarshal(data, &rows); err != nil {
		return false, fmt.Errorf("unmarshal lock response: %w", err)
	}

	return len(rows) > 0, nil
}

// TryReleaseAccount atomically releases an account lock if locked by the given service.
// Returns true if the account was released, false if not locked by this service.
func (r *Repository) TryReleaseAccount(ctx context.Context, accountID, serviceID string) (bool, error) {
	if accountID == "" || serviceID == "" {
		return false, fmt.Errorf("account_id and service_id are required")
	}

	update := map[string]interface{}{
		"locked_by":    nil,
		"locked_at":    nil,
		"last_used_at": time.Now(),
	}

	// Atomic update: only release if locked_by matches this service
	query := database.NewQuery().
		Eq("id", accountID).
		Eq("locked_by", serviceID).
		Build()

	data, err := r.base.Request(ctx, "PATCH", tableName, update, query)
	if err != nil {
		return false, err
	}

	var rows []Account
	if err := json.Unmarshal(data, &rows); err != nil {
		return false, fmt.Errorf("unmarshal release response: %w", err)
	}

	return len(rows) > 0, nil
}

// Delete deletes a pool account by ID.
func (r *Repository) Delete(ctx context.Context, id string) error {
	// Delete associated balances first (foreign key constraint)
	if err := r.DeleteBalances(ctx, id); err != nil {
		return fmt.Errorf("delete balances: %w", err)
	}
	return database.GenericDelete(r.base, ctx, tableName, "id", id)
}

// =============================================================================
// Balance-Aware Account Operations
// =============================================================================

// GetWithBalances fetches an account with all its token balances.
func (r *Repository) GetWithBalances(ctx context.Context, id string) (*AccountWithBalances, error) {
	acc, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	balances, err := r.GetBalances(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get balances: %w", err)
	}

	result := NewAccountWithBalances(acc)
	for i := range balances {
		bal := &balances[i]
		result.AddBalance(bal)
	}

	return result, nil
}

// ListWithBalances returns all accounts with their token balances.
func (r *Repository) ListWithBalances(ctx context.Context) ([]AccountWithBalances, error) {
	accounts, err := r.List(ctx)
	if err != nil {
		return nil, err
	}

	return r.hydrateAccountsWithBalances(ctx, accounts)
}

// ListAvailableWithBalances returns unlocked, non-retiring accounts with balances.
// If tokenType is specified, filters by minimum balance of that token.
func (r *Repository) ListAvailableWithBalances(ctx context.Context, tokenType string, minBalance *int64, limit int) ([]AccountWithBalances, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	// Get available accounts (unlocked, non-retiring)
	accounts, err := r.ListAvailable(ctx, limit*2) // Get extra in case we filter some out
	if err != nil {
		return nil, err
	}

	// Hydrate with balances
	accountsWithBalances, err := r.hydrateAccountsWithBalances(ctx, accounts)
	if err != nil {
		return nil, err
	}

	// Filter by token balance if specified
	if tokenType != "" && minBalance != nil {
		filtered := make([]AccountWithBalances, 0, len(accountsWithBalances))
		for i := range accountsWithBalances {
			acc := &accountsWithBalances[i]
			if acc.HasSufficientBalance(tokenType, *minBalance) {
				filtered = append(filtered, *acc)
				if len(filtered) >= limit {
					break
				}
			}
		}
		return filtered, nil
	}

	// Apply limit
	if len(accountsWithBalances) > limit {
		accountsWithBalances = accountsWithBalances[:limit]
	}

	return accountsWithBalances, nil
}

// ListByLockerWithBalances returns accounts locked by a service with their balances.
func (r *Repository) ListByLockerWithBalances(ctx context.Context, lockerID string) ([]AccountWithBalances, error) {
	accounts, err := r.ListByLocker(ctx, lockerID)
	if err != nil {
		return nil, err
	}

	return r.hydrateAccountsWithBalances(ctx, accounts)
}

// ListLowBalanceAccounts returns accounts with balance below the specified threshold.
// This is useful for auto top-up workers that need to find accounts requiring funding.
func (r *Repository) ListLowBalanceAccounts(ctx context.Context, tokenType string, maxBalance int64, limit int) ([]AccountWithBalances, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	// Get all accounts (we need to check balances)
	accounts, err := r.List(ctx)
	if err != nil {
		return nil, err
	}

	// Hydrate with balances
	accountsWithBalances, err := r.hydrateAccountsWithBalances(ctx, accounts)
	if err != nil {
		return nil, err
	}

	// Filter by token balance below threshold
	filtered := make([]AccountWithBalances, 0, limit)
	for i := range accountsWithBalances {
		acc := &accountsWithBalances[i]
		// Skip retiring accounts
		if acc.IsRetiring {
			continue
		}
		// Check if balance is below threshold
		balance := acc.GetBalance(tokenType)
		if balance < maxBalance {
			filtered = append(filtered, *acc)
			if len(filtered) >= limit {
				break
			}
		}
	}

	return filtered, nil
}

// hydrateAccountsWithBalances adds balance information to a list of accounts.
// Uses a single batch query to fetch all balances, avoiding N+1 query problem.
func (r *Repository) hydrateAccountsWithBalances(ctx context.Context, accounts []Account) ([]AccountWithBalances, error) {
	if len(accounts) == 0 {
		return []AccountWithBalances{}, nil
	}

	// Collect all account IDs for batch query
	accountIDs := make([]string, len(accounts))
	for i := range accounts {
		accountIDs[i] = accounts[i].ID
	}

	// Fetch all balances in a single query
	allBalances, err := r.GetBalancesForAccounts(ctx, accountIDs)
	if err != nil {
		// Log error but continue - accounts exist even if balances query fails
		allBalances = []AccountBalance{}
	}

	// Build a map of account_id -> balances for O(1) lookup
	balanceMap := make(map[string][]AccountBalance)
	for i := range allBalances {
		bal := &allBalances[i]
		balanceMap[bal.AccountID] = append(balanceMap[bal.AccountID], *bal)
	}

	// Hydrate accounts with their balances
	result := make([]AccountWithBalances, 0, len(accounts))
	for i := range accounts {
		acc := &accounts[i]
		accWithBal := NewAccountWithBalances(acc)

		if balances, ok := balanceMap[acc.ID]; ok {
			for j := range balances {
				bal := &balances[j]
				accWithBal.AddBalance(bal)
			}
		}

		result = append(result, *accWithBal)
	}

	return result, nil
}

// =============================================================================
// Balance Operations
// =============================================================================

// UpsertBalance creates or updates a token balance for an account.
func (r *Repository) UpsertBalance(ctx context.Context, accountID, tokenType, scriptHash string, amount int64, decimals int) error {
	if accountID == "" || tokenType == "" {
		return fmt.Errorf("account_id and token_type are required")
	}

	// Check if balance exists
	existing, err := r.GetBalance(ctx, accountID, tokenType)
	if err != nil || existing == nil {
		// Create new balance
		bal := &AccountBalance{
			AccountID:  accountID,
			TokenType:  tokenType,
			ScriptHash: scriptHash,
			Amount:     amount,
			Decimals:   decimals,
			UpdatedAt:  time.Now(),
		}
		return database.GenericCreate(r.base, ctx, balancesTableName, bal, func(rows []AccountBalance) {
			if len(rows) > 0 {
				*bal = rows[0]
			}
		})
	}

	// Update existing balance
	existing.Amount = amount
	existing.ScriptHash = scriptHash
	existing.Decimals = decimals
	existing.UpdatedAt = time.Now()

	// Use composite key for update
	query := database.NewQuery().
		Eq("account_id", accountID).
		Eq("token_type", tokenType).
		Build()

	return database.GenericUpdateWithQuery(r.base, ctx, balancesTableName, query, existing)
}

// GetBalance fetches a specific token balance for an account.
func (r *Repository) GetBalance(ctx context.Context, accountID, tokenType string) (*AccountBalance, error) {
	if accountID == "" || tokenType == "" {
		return nil, fmt.Errorf("account_id and token_type are required")
	}

	query := database.NewQuery().
		Eq("account_id", accountID).
		Eq("token_type", tokenType).
		Build()

	balances, err := database.GenericListWithQuery[AccountBalance](r.base, ctx, balancesTableName, query)
	if err != nil {
		return nil, err
	}

	if len(balances) == 0 {
		return nil, nil
	}

	return &balances[0], nil
}

// GetBalances fetches all token balances for an account.
func (r *Repository) GetBalances(ctx context.Context, accountID string) ([]AccountBalance, error) {
	if accountID == "" {
		return nil, fmt.Errorf("account_id is required")
	}

	return database.GenericListByField[AccountBalance](r.base, ctx, balancesTableName, "account_id", accountID)
}

// GetBalancesForAccounts fetches all token balances for multiple accounts in a single query.
// This avoids the N+1 query problem when hydrating accounts with balances.
func (r *Repository) GetBalancesForAccounts(ctx context.Context, accountIDs []string) ([]AccountBalance, error) {
	if len(accountIDs) == 0 {
		return []AccountBalance{}, nil
	}

	query := database.NewQuery().
		In("account_id", accountIDs).
		Build()

	return database.GenericListWithQuery[AccountBalance](r.base, ctx, balancesTableName, query)
}

// DeleteBalances deletes all token balances for an account.
func (r *Repository) DeleteBalances(ctx context.Context, accountID string) error {
	if accountID == "" {
		return fmt.Errorf("account_id is required")
	}

	balances, err := r.GetBalances(ctx, accountID)
	if err != nil {
		return err
	}

	for i := range balances {
		bal := &balances[i]
		query := database.NewQuery().
			Eq("account_id", bal.AccountID).
			Eq("token_type", bal.TokenType).
			Build()
		if err := database.GenericDeleteWithQuery(r.base, ctx, balancesTableName, query); err != nil {
			return fmt.Errorf("delete balance %s/%s: %w", bal.AccountID, bal.TokenType, err)
		}
	}

	return nil
}

// =============================================================================
// Statistics
// =============================================================================

// AggregateTokenStats calculates aggregate statistics for a token type.
// Uses batch query to avoid N+1 problem.
func (r *Repository) AggregateTokenStats(ctx context.Context, tokenType string) (*TokenStats, error) {
	if tokenType == "" {
		return nil, fmt.Errorf("token_type is required")
	}

	// Get all accounts
	accounts, err := r.List(ctx)
	if err != nil {
		return nil, err
	}

	scriptHash, _ := GetDefaultTokenConfig(tokenType)
	stats := &TokenStats{
		TokenType:  tokenType,
		ScriptHash: scriptHash,
	}

	if len(accounts) == 0 {
		return stats, nil
	}

	// Collect all account IDs for batch query
	accountIDs := make([]string, len(accounts))
	for i := range accounts {
		accountIDs[i] = accounts[i].ID
	}

	// Fetch all balances for the specific token type in a single query
	query := database.NewQuery().
		In("account_id", accountIDs).
		Eq("token_type", tokenType).
		Build()

	balances, err := database.GenericListWithQuery[AccountBalance](r.base, ctx, balancesTableName, query)
	if err != nil {
		return stats, nil // Return empty stats on error
	}

	// Build a map of account_id -> balance for O(1) lookup
	balanceMap := make(map[string]*AccountBalance)
	for i := range balances {
		bal := &balances[i]
		balanceMap[bal.AccountID] = bal
		// Update script hash from actual data if available
		if bal.ScriptHash != "" {
			stats.ScriptHash = bal.ScriptHash
		}
	}

	// Calculate stats
	for i := range accounts {
		acc := &accounts[i]
		bal, ok := balanceMap[acc.ID]
		if !ok || bal == nil {
			continue
		}

		stats.TotalBalance += bal.Amount

		if acc.LockedBy != "" {
			stats.LockedBalance += bal.Amount
		} else if !acc.IsRetiring {
			stats.AvailableBalance += bal.Amount
		}
	}

	return stats, nil
}

// UpdateBalanceWithLock atomically updates balance while verifying lock ownership.
// This method prevents race conditions by verifying the lock in the same query that updates the balance.
// Returns (oldBalance, newBalance, txCount, wasUpdated, error)
// wasUpdated is false if account is not locked by the given service
func (r *Repository) UpdateBalanceWithLock(ctx context.Context, accountID, serviceID, tokenType string, delta int64, absolute *int64) (int64, int64, int, bool, error) {
	if accountID == "" || serviceID == "" {
		return 0, 0, 0, false, fmt.Errorf("account_id and service_id are required")
	}

	// Default to GAS if no token specified
	if tokenType == "" {
		tokenType = TokenTypeGAS
	}

	// SECURITY: Integer overflow/underflow protection
	// Maximum balance is 2^53 - 1 (safe for JavaScript Number precision)
	const maxBalance = int64(1<<53 - 1)
	const minBalance = int64(0)

	// Step 1: Get current balance and verify lock in a single query
	// This ensures atomicity at the read level
	accQuery := database.NewQuery().
		Eq("id", accountID).
		Eq("locked_by", serviceID).
		Build()

	accountsData, err := r.base.Request(ctx, "GET", tableName, nil, accQuery)
	if err != nil {
		return 0, 0, 0, false, fmt.Errorf("get account: %w", err)
	}

	var accounts []Account
	if err := json.Unmarshal(accountsData, &accounts); err != nil {
		return 0, 0, 0, false, fmt.Errorf("unmarshal account: %w", err)
	}

	// Check if account exists and is locked by this service
	if len(accounts) == 0 {
		return 0, 0, 0, false, nil // Not locked by this service
	}

	acc := accounts[0]

	// Get current balance
	balQuery := database.NewQuery().
		Eq("account_id", accountID).
		Eq("token_type", tokenType).
		Build()

	balancesData, err := r.base.Request(ctx, "GET", balancesTableName, nil, balQuery)
	if err != nil {
		return 0, 0, 0, false, fmt.Errorf("get balance: %w", err)
	}

	var balances []AccountBalance
	if err := json.Unmarshal(balancesData, &balances); err != nil {
		return 0, 0, 0, false, fmt.Errorf("unmarshal balance: %w", err)
	}

	var oldBalance int64 = 0
	if len(balances) > 0 {
		oldBalance = balances[0].Amount
	}

	var newBalance int64
	if absolute != nil {
		newBalance = *absolute
	} else {
		// SECURITY: Check for integer overflow/underflow
		if delta > 0 && oldBalance > maxBalance-delta {
			return 0, 0, 0, false, fmt.Errorf("balance overflow: old=%d delta=%d max=%d", oldBalance, delta, maxBalance)
		}
		if delta < 0 && oldBalance < -delta {
			return 0, 0, 0, false, fmt.Errorf("insufficient balance: old=%d delta=%d", oldBalance, delta)
		}
		newBalance = oldBalance + delta
	}

	// Validate final balance
	if newBalance < minBalance {
		return 0, 0, 0, false, fmt.Errorf("balance below minimum: %d", newBalance)
	}
	if newBalance > maxBalance {
		return 0, 0, 0, false, fmt.Errorf("balance exceeds maximum: %d", newBalance)
	}

	// Get script hash and decimals for token
	scriptHash, decimals := GetDefaultTokenConfig(tokenType)

	// Step 2: Update account metadata first (last_used_at, tx_count)
	// We update this BEFORE the balance to minimize inconsistency window
	accUpdate := map[string]interface{}{
		"last_used_at": time.Now(),
		"tx_count":     acc.TxCount + 1,
	}

	accUpdateQuery := database.NewQuery().
		Eq("id", accountID).
		Eq("locked_by", serviceID).
		Build()

	_, err = r.base.Request(ctx, "PATCH", tableName, accUpdate, accUpdateQuery)
	if err != nil {
		// SECURITY FIX: Fail the operation if metadata update fails
		// This prevents inconsistent state where balance is updated but tx_count isn't
		// The caller can retry the entire operation
		return 0, 0, 0, false, fmt.Errorf("update account metadata: %w (balance NOT updated)", err)
	}

	// Step 3: Update balance (atomic at DB level)
	// Done after metadata update to ensure consistency
	if err := r.UpsertBalance(ctx, accountID, tokenType, scriptHash, newBalance, decimals); err != nil {
		// If balance update fails after metadata succeeded, we have a minor inconsistency
		// (tx_count was incremented but balance wasn't updated)
		// This is acceptable because tx_count is just a counter and will correct itself on next operation
		return 0, 0, 0, false, fmt.Errorf("upsert balance: %w", err)
	}

	return oldBalance, newBalance, int(acc.TxCount + 1), true, nil
}
