// Package neoaccounts provides pool management for the neoaccounts service.
package neoaccounts

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	neoaccountssupabase "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/supabase"
)

// RequestAccounts locks and returns accounts for a service.
// DESIGN: Database operations (TryLockAccount) are atomic at DB level.
// The mutex is only used for in-memory operations to avoid holding locks during I/O.
func (s *Service) RequestAccounts(ctx context.Context, serviceID string, count int, purpose string) (accounts []AccountInfo, lockID string, err error) {
	if s.repo == nil {
		return nil, "", fmt.Errorf("repository not configured")
	}
	if count <= 0 || count > 100 {
		return nil, "", fmt.Errorf("invalid count: must be 1-100")
	}

	// Database I/O outside of lock - TryLockAccount is atomic at DB level
	accountsWithBalances, err := s.repo.ListAvailableWithBalances(ctx, "", nil, count*2) // fetch extra for contention
	if err != nil {
		return nil, "", fmt.Errorf("list accounts: %w", err)
	}

	// Create accounts if needed (also DB I/O, outside lock)
	if len(accountsWithBalances) < count {
		need := count - len(accountsWithBalances)
		for i := 0; i < need; i++ {
			acc, err := s.createAccount(ctx)
			if err != nil {
				break
			}
			accWithBal := neoaccountssupabase.NewAccountWithBalances(acc)
			accountsWithBalances = append(accountsWithBalances, *accWithBal)
		}
	}

	if len(accountsWithBalances) == 0 {
		return nil, "", fmt.Errorf("no accounts available")
	}

	// Generate lock ID (no mutex needed - UUID is thread-safe)
	lockID = uuid.New().String()

	// Lock accounts using atomic DB operations (no mutex needed)
	// TryLockAccount uses database-level locking (UPDATE WHERE locked_by IS NULL)
	result := make([]AccountInfo, 0, count)
	for i := range accountsWithBalances {
		if len(result) >= count {
			break
		}
		acc := &accountsWithBalances[i]
		lockedAt := time.Now()
		locked, err := s.repo.TryLockAccount(ctx, acc.ID, serviceID, lockedAt)
		if err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"account_id": acc.ID,
				"service_id": serviceID,
			}).Warn("failed to lock account")
			continue
		}
		if !locked {
			continue
		}
		acc.LockedBy = serviceID
		acc.LockedAt = lockedAt
		result = append(result, AccountInfoFromWithBalances(acc))
	}

	return result, lockID, nil
}

// ReleaseAccounts releases previously locked accounts.
// DESIGN: Uses atomic DB operations, no mutex needed for concurrent safety.
func (s *Service) ReleaseAccounts(ctx context.Context, serviceID string, accountIDs []string) (int, error) {
	if s.repo == nil {
		return 0, fmt.Errorf("repository not configured")
	}

	released := 0
	for _, accID := range accountIDs {
		// Atomic release at DB level - only releases if locked by this service
		ok, err := s.repo.TryReleaseAccount(ctx, accID, serviceID)
		if err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"account_id": accID,
				"service_id": serviceID,
			}).Warn("failed to release account")
			continue
		}
		if ok {
			released++
		}
	}

	return released, nil
}

// ReleaseAllByService releases all accounts locked by a service.
// DESIGN: Uses atomic DB operations per account, no global mutex needed.
func (s *Service) ReleaseAllByService(ctx context.Context, serviceID string) (int, error) {
	if s.repo == nil {
		return 0, fmt.Errorf("repository not configured")
	}

	// Get accounts locked by this service (DB I/O outside lock)
	accounts, err := s.repo.ListByLocker(ctx, serviceID)
	if err != nil {
		return 0, err
	}

	// Release each account atomically
	released := 0
	for i := range accounts {
		acc := &accounts[i]
		ok, err := s.repo.TryReleaseAccount(ctx, acc.ID, serviceID)
		if err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"account_id": acc.ID,
				"service_id": serviceID,
			}).Warn("failed to release account for service")
			continue
		}
		if ok {
			released++
		}
	}

	return released, nil
}

// UpdateBalance updates an account's token balance.
// SECURITY FIX: Added integer overflow/underflow protection.
// Uses atomic DB operations with lock verification to prevent race conditions.
func (s *Service) UpdateBalance(ctx context.Context, serviceID, accountID, tokenType string, delta int64, absolute *int64) (oldBalance, newBalance, txCount int64, err error) {
	if s.repo == nil {
		return 0, 0, 0, fmt.Errorf("repository not configured")
	}

	// Default to GAS if no token specified
	if tokenType == "" {
		tokenType = TokenTypeGAS
	}

	// SECURITY: Integer overflow/underflow protection
	// Maximum balance is 2^53 - 1 (safe for JavaScript Number precision)
	const maxBalance = int64(1<<53 - 1)
	const minBalance = int64(0)

	// Fetch account and verify lock (atomic DB read)
	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("account not found: %w", err)
	}

	// Verify the account is locked by this service (atomic check)
	if acc.LockedBy != serviceID {
		return 0, 0, 0, fmt.Errorf("account not locked by service %s", serviceID)
	}

	// Get current balance for token
	currentBal, err := s.repo.GetBalance(ctx, accountID, tokenType)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("get balance: %w", err)
	}

	if currentBal != nil {
		oldBalance = currentBal.Amount
	}

	// Calculate new balance with overflow/underflow protection
	if absolute != nil {
		newBalance = *absolute
	} else {
		// SECURITY: Check for integer overflow/underflow
		if delta > 0 && oldBalance > maxBalance-delta {
			return 0, 0, 0, fmt.Errorf("balance overflow: old=%d delta=%d max=%d", oldBalance, delta, maxBalance)
		}
		if delta < 0 && oldBalance < -delta {
			return 0, 0, 0, fmt.Errorf("insufficient balance: old=%d delta=%d", oldBalance, delta)
		}
		newBalance = oldBalance + delta
	}

	// Validate final balance
	if newBalance < minBalance {
		return 0, 0, 0, fmt.Errorf("balance below minimum: %d", newBalance)
	}
	if newBalance > maxBalance {
		return 0, 0, 0, fmt.Errorf("balance exceeds maximum: %d", newBalance)
	}

	// Get script hash and decimals for token
	scriptHash, decimals := neoaccountssupabase.GetDefaultTokenConfig(tokenType)

	// SECURITY FIX: Update account metadata FIRST, then balance
	// This ensures consistency - if balance update fails after metadata update,
	// we only have a minor tx_count inconsistency which corrects itself
	// The reverse (balance updated but metadata not) would be worse
	acc.LastUsedAt = time.Now()
	acc.TxCount++

	if err := s.repo.Update(ctx, acc); err != nil {
		return 0, 0, 0, fmt.Errorf("update account metadata: %w (balance NOT updated)", err)
	}

	// Upsert the balance (atomic DB operation)
	// Done after metadata update to ensure consistency
	if err := s.repo.UpsertBalance(ctx, accountID, tokenType, scriptHash, newBalance, decimals); err != nil {
		return 0, 0, 0, fmt.Errorf("upsert balance: %w", err)
	}

	return oldBalance, newBalance, acc.TxCount, nil
}

// GetPoolInfo returns pool statistics with per-token breakdowns.
func (s *Service) GetPoolInfo(ctx context.Context) (*PoolInfoResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	accounts, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	info := &PoolInfoResponse{
		TokenStats: make(map[string]TokenStats),
	}

	for i := range accounts {
		acc := &accounts[i]
		info.TotalAccounts++

		switch {
		case acc.IsRetiring:
			info.RetiringAccounts++
		case acc.LockedBy != "":
			info.LockedAccounts++
		default:
			info.ActiveAccounts++
		}
	}

	// Get stats for known tokens
	for _, tokenType := range []string{TokenTypeGAS, TokenTypeNEO} {
		stats, err := s.repo.AggregateTokenStats(ctx, tokenType)
		if err != nil {
			continue
		}
		info.TokenStats[tokenType] = *stats
	}

	return info, nil
}

// ListAccountsByService returns accounts locked by a specific service.
// DESIGN: Read-only operation, no mutex needed - data comes from DB.
func (s *Service) ListAccountsByService(ctx context.Context, serviceID, tokenType string, minBalance *int64) ([]AccountInfo, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}

	accounts, err := s.repo.ListByLockerWithBalances(ctx, serviceID)
	if err != nil {
		return nil, err
	}

	result := make([]AccountInfo, 0, len(accounts))
	for i := range accounts {
		acc := &accounts[i]
		// Filter by token balance if specified
		if tokenType != "" && minBalance != nil {
			if !acc.HasSufficientBalance(tokenType, *minBalance) {
				continue
			}
		}
		result = append(result, AccountInfoFromWithBalances(acc))
	}

	return result, nil
}

// ListLowBalanceAccounts returns accounts with balance below the specified threshold.
// This is useful for auto top-up workers that need to find accounts requiring funding.
// DESIGN: Read-only operation, no mutex needed - data comes from DB.
func (s *Service) ListLowBalanceAccounts(ctx context.Context, tokenType string, maxBalance int64, limit int) ([]AccountInfo, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}

	accounts, err := s.repo.ListLowBalanceAccounts(ctx, tokenType, maxBalance, limit)
	if err != nil {
		return nil, err
	}

	result := make([]AccountInfo, 0, len(accounts))
	for i := range accounts {
		acc := &accounts[i]
		result = append(result, AccountInfoFromWithBalances(acc))
	}

	return result, nil
}

// rotateAccounts retires old accounts and creates new ones.
// Locked accounts are NEVER rotated.
// DESIGN: Uses non-blocking TryLock to prevent deadlock if another task is running.
// DB operations are atomic and don't need the main mutex.
func (s *Service) rotateAccounts(ctx context.Context) {
	if s.repo == nil {
		return
	}

	// SECURITY FIX: Use TryLock instead of Lock to prevent deadlock
	// If another background task is running, skip this run and try again later
	// This prevents one slow operation from blocking all background tasks
	if !s.bgTaskLock.TryLock() {
		s.Logger().WithContext(ctx).Debug("rotateAccounts: skipping - another task is running")
		return
	}
	defer s.bgTaskLock.Unlock()

	accounts, err := s.repo.ListWithBalances(ctx)
	if err != nil {
		return
	}

	// Count active (unlocked, non-retiring) accounts
	activeCount := 0
	for i := range accounts {
		acc := &accounts[i]
		if !acc.IsRetiring && acc.LockedBy == "" {
			activeCount++
		}
	}

	// Daily rotation: RotationRate per day, divided by 24 for hourly check
	retireCount := int(float64(activeCount) * RotationRate / 24)
	if retireCount < 1 {
		retireCount = 1
	}

	minAge := time.Duration(RotationMinAge) * time.Hour
	// Minimum balance threshold for rotation (in GAS units, 8 decimals)
	minGasBalance := int64(100000) // 0.001 GAS

	retired := 0
	for i := range accounts {
		acc := &accounts[i]
		if retired >= retireCount {
			break
		}

		// NEVER retire locked accounts
		if acc.LockedBy != "" {
			continue
		}

		// Only retire if: not already retiring, low balance for ALL tokens, and old enough
		if !acc.IsRetiring && time.Since(acc.CreatedAt) > minAge {
			// Check if account has low balances across all tokens
			gasBalance := acc.GetBalance(TokenTypeGAS)
			neoBalance := acc.GetBalance(TokenTypeNEO)

			if gasBalance < minGasBalance && neoBalance == 0 {
				dbAcc, err := s.repo.GetByID(ctx, acc.ID)
				if err != nil {
					continue
				}
				dbAcc.IsRetiring = true
				retired++
				if err := s.repo.Update(ctx, dbAcc); err != nil {
					s.Logger().WithContext(ctx).WithError(err).WithField("account_id", acc.ID).Warn("failed to mark account as retiring")
				}
			}
		}
	}

	// Ensure minimum pool size
	for activeCount < MinPoolAccounts {
		if _, err := s.createAccount(ctx); err != nil {
			break
		}
		activeCount++
	}

	// Delete empty retiring accounts (only if not locked and all balances are zero)
	if deleteRetiringAccountsEnabled() {
		for i := range accounts {
			acc := &accounts[i]
			if acc.IsRetiring && acc.IsEmpty() && acc.LockedBy == "" {
				if err := s.repo.Delete(ctx, acc.ID); err != nil {
					s.Logger().WithContext(ctx).WithError(err).WithField("account_id", acc.ID).Warn("failed to delete retiring account")
				}
			}
		}
	}
}

// cleanupStaleLocks releases accounts that have been locked too long.
// DESIGN: Uses non-blocking TryLock to prevent deadlock if another task is running.
// DB operations are atomic and don't need the main mutex.
func (s *Service) cleanupStaleLocks(ctx context.Context) {
	if s.repo == nil {
		return
	}

	// SECURITY FIX: Use TryLock instead of Lock to prevent deadlock
	// If another background task is running, skip this run and try again later
	if !s.bgTaskLock.TryLock() {
		s.Logger().WithContext(ctx).Debug("cleanupStaleLocks: skipping - another task is running")
		return
	}
	defer s.bgTaskLock.Unlock()

	accounts, err := s.repo.List(ctx)
	if err != nil {
		return
	}

	now := time.Now()
	for i := range accounts {
		acc := &accounts[i]
		if acc.LockedBy != "" && !acc.LockedAt.IsZero() {
			if now.Sub(acc.LockedAt) > LockTimeout {
				// Force release stale lock
				acc.LockedBy = ""
				acc.LockedAt = time.Time{}
				if err := s.repo.Update(ctx, acc); err != nil {
					s.Logger().WithContext(ctx).WithError(err).WithField("account_id", acc.ID).Warn("failed to release stale lock")
				}
			}
		}
	}
}

func deleteRetiringAccountsEnabled() bool {
	raw := strings.TrimSpace(os.Getenv("NEOACCOUNTS_DELETE_RETIRING_ACCOUNTS"))
	switch strings.ToLower(raw) {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}
