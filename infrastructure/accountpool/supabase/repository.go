// Package supabase provides NeoAccounts-specific database operations.
package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
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
	GetByLockedBy(ctx context.Context, lockedBy string) (*Account, error)
	ListByLocker(ctx context.Context, lockerID string) ([]Account, error)
	ListLocked(ctx context.Context) ([]Account, error)
	TryLockAccount(ctx context.Context, accountID, serviceID string, lockedAt time.Time) (bool, error)
	Delete(ctx context.Context, id string) error

	// Balance-aware account operations
	GetWithBalances(ctx context.Context, id string) (*AccountWithBalances, error)
	ListWithBalances(ctx context.Context) ([]AccountWithBalances, error)
	ListAvailableWithBalances(ctx context.Context, tokenType string, minBalance *int64, limit int) ([]AccountWithBalances, error)
	ListByLockerWithBalances(ctx context.Context, lockerID string) ([]AccountWithBalances, error)
	ListLowBalanceAccounts(ctx context.Context, tokenType string, maxBalance int64, limit int) ([]AccountWithBalances, error)
	ListRotationCandidatesWithBalances(ctx context.Context, minAge time.Duration, limit int) ([]AccountWithBalances, error)

	// Balance operations
	UpsertBalance(ctx context.Context, accountID, tokenType, scriptHash string, amount int64, decimals int) error
	GetBalance(ctx context.Context, accountID, tokenType string) (*AccountBalance, error)
	GetBalances(ctx context.Context, accountID string) ([]AccountBalance, error)
	GetBalancesForAccounts(ctx context.Context, accountIDs []string) ([]AccountBalance, error)
	DeleteBalances(ctx context.Context, accountID string) error

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

// GetByLockedBy fetches the first pool account locked by the given value.
func (r *Repository) GetByLockedBy(ctx context.Context, lockedBy string) (*Account, error) {
	return database.GenericGetByField[Account](r.base, ctx, tableName, "locked_by", lockedBy)
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

// ListLocked returns all accounts that are currently locked (locked_by is not null/empty).
func (r *Repository) ListLocked(ctx context.Context) ([]Account, error) {
	query := database.NewQuery().
		IsNotNull("locked_by").
		Neq("locked_by", "").
		Build()

	return database.GenericListWithQuery[Account](r.base, ctx, tableName, query)
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

	data, err := r.base.Request(ctx, http.MethodPatch, tableName, update, query)
	if err != nil {
		return false, err
	}

	var rows []Account
	if err := json.Unmarshal(data, &rows); err != nil {
		return false, fmt.Errorf("unmarshal lock response: %w", err)
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
// Pushes filtering to the database to avoid loading all accounts into memory.
func (r *Repository) ListLowBalanceAccounts(ctx context.Context, tokenType string, maxBalance int64, limit int) ([]AccountWithBalances, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	// Query balances table directly for low-balance rows
	balQuery := database.NewQuery().
		Eq("token_type", tokenType).
		Lt("amount", fmt.Sprintf("%d", maxBalance)).
		Limit(limit).
		Build()

	balances, err := database.GenericListWithQuery[AccountBalance](r.base, ctx, balancesTableName, balQuery)
	if err != nil {
		return nil, fmt.Errorf("list low balances: %w", err)
	}

	if len(balances) == 0 {
		return []AccountWithBalances{}, nil
	}

	// Collect unique account IDs from balance rows
	accountIDs := make([]string, 0, len(balances))
	for i := range balances {
		accountIDs = append(accountIDs, balances[i].AccountID)
	}

	// Fetch only those accounts, excluding retiring ones
	accQuery := database.NewQuery().
		In("id", accountIDs).
		IsFalse("is_retiring").
		Build()

	accounts, err := database.GenericListWithQuery[Account](r.base, ctx, tableName, accQuery)
	if err != nil {
		return nil, fmt.Errorf("list accounts for low balances: %w", err)
	}

	return r.hydrateAccountsWithBalances(ctx, accounts)
}

// ListRotationCandidatesWithBalances returns unlocked, non-retiring accounts
// older than minAge, with their balances. These are candidates for rotation.
func (r *Repository) ListRotationCandidatesWithBalances(ctx context.Context, minAge time.Duration, limit int) ([]AccountWithBalances, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	cutoff := time.Now().Add(-minAge).Format(time.RFC3339)

	query := database.NewQuery().
		IsFalse("is_retiring").
		IsNull("locked_by").
		Lte("created_at", cutoff).
		OrderAsc("created_at").
		Limit(limit).
		Build()

	accounts, err := database.GenericListWithQuery[Account](r.base, ctx, tableName, query)
	if err != nil {
		return nil, err
	}

	return r.hydrateAccountsWithBalances(ctx, accounts)
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
// Uses atomic upsert (single round-trip) to eliminate race conditions.
func (r *Repository) UpsertBalance(ctx context.Context, accountID, tokenType, scriptHash string, amount int64, decimals int) error {
	if accountID == "" || tokenType == "" {
		return fmt.Errorf("account_id and token_type are required")
	}

	bal := &AccountBalance{
		AccountID:  accountID,
		TokenType:  tokenType,
		ScriptHash: scriptHash,
		Amount:     amount,
		Decimals:   decimals,
		UpdatedAt:  time.Now(),
	}
	return database.GenericUpsert(r.base, ctx, balancesTableName, "account_id,token_type", bal, func(rows []AccountBalance) {
		if len(rows) > 0 {
			*bal = rows[0]
		}
	})
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

// DeleteBalances deletes all token balances for an account in a single query.
func (r *Repository) DeleteBalances(ctx context.Context, accountID string) error {
	if accountID == "" {
		return fmt.Errorf("account_id is required")
	}

	query := database.NewQuery().
		Eq("account_id", accountID).
		Build()
	return database.GenericDeleteWithQuery(r.base, ctx, balancesTableName, query)
}

// =============================================================================
// Statistics
// =============================================================================

// AggregateTokenStats calculates aggregate statistics for a token type.
// Queries balances directly, then fetches only the relevant accounts for lock/retire status.
func (r *Repository) AggregateTokenStats(ctx context.Context, tokenType string) (*TokenStats, error) {
	if tokenType == "" {
		return nil, fmt.Errorf("token_type is required")
	}

	scriptHash, _ := GetDefaultTokenConfig(tokenType)
	stats := &TokenStats{
		TokenType:  tokenType,
		ScriptHash: scriptHash,
	}

	// Query balances table directly filtered by token_type
	balQuery := database.NewQuery().
		Eq("token_type", tokenType).
		Build()

	balances, err := database.GenericListWithQuery[AccountBalance](r.base, ctx, balancesTableName, balQuery)
	if err != nil {
		return stats, nil
	}

	if len(balances) == 0 {
		return stats, nil
	}

	// Build balance map and collect account IDs
	balanceMap := make(map[string]*AccountBalance, len(balances))
	accountIDs := make([]string, 0, len(balances))
	for i := range balances {
		bal := &balances[i]
		balanceMap[bal.AccountID] = bal
		accountIDs = append(accountIDs, bal.AccountID)
		if bal.ScriptHash != "" {
			stats.ScriptHash = bal.ScriptHash
		}
	}

	// Fetch only accounts that have balances
	accQuery := database.NewQuery().
		In("id", accountIDs).
		Build()

	accounts, err := database.GenericListWithQuery[Account](r.base, ctx, tableName, accQuery)
	if err != nil {
		return stats, nil
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
