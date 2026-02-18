// Package neoaccounts provides pool management for the neoaccounts service.
package neoaccounts

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	neoaccountssupabase "github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/supabase"
)

// RequestAccounts locks and returns accounts for a service.
func (s *Service) RequestAccounts(ctx context.Context, serviceID string, count int, purpose string) (accounts []AccountInfo, lockID string, err error) {
	if s.repo == nil {
		return nil, "", fmt.Errorf("repository not configured")
	}
	if count <= 0 || count > 100 {
		return nil, "", fmt.Errorf("invalid count: must be 1-100")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Get available (unlocked, non-retiring) accounts with balances
	accountsWithBalances, err := s.repo.ListAvailableWithBalances(ctx, "", nil, count)
	if err != nil {
		return nil, "", fmt.Errorf("list accounts: %w", err)
	}

	if len(accountsWithBalances) < count {
		// Try to create more accounts if needed
		need := count - len(accountsWithBalances)
		for i := 0; i < need; i++ {
			acc, err := s.createAccount(ctx)
			if err != nil {
				break
			}
			// Convert to AccountWithBalances
			accWithBal := neoaccountssupabase.NewAccountWithBalances(acc)
			accountsWithBalances = append(accountsWithBalances, *accWithBal)
		}
	}

	if len(accountsWithBalances) == 0 {
		return nil, "", fmt.Errorf("no accounts available")
	}

	// Generate lock ID
	lockID = uuid.New().String()

	// Lock the accounts
	result := make([]AccountInfo, 0, len(accountsWithBalances))
	for i := range accountsWithBalances {
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

		if len(result) >= count {
			break
		}
	}

	return result, lockID, nil
}

// ReleaseAccounts releases previously locked accounts.
func (s *Service) ReleaseAccounts(ctx context.Context, serviceID string, accountIDs []string) (int, error) {
	if s.repo == nil {
		return 0, fmt.Errorf("repository not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	released := 0
	for _, accID := range accountIDs {
		acc, err := s.repo.GetByID(ctx, accID)
		if err != nil {
			continue
		}

		// Only release if locked by this service
		if acc.LockedBy != serviceID {
			continue
		}

		acc.LockedBy = ""
		acc.LockedAt = time.Time{}
		acc.LastUsedAt = time.Now()

		if err := s.repo.Update(ctx, acc); err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"account_id": accID,
				"service_id": serviceID,
			}).Warn("failed to release account")
			continue
		}
		released++
	}

	return released, nil
}

// ReleaseAllByService releases all accounts locked by a service.
func (s *Service) ReleaseAllByService(ctx context.Context, serviceID string) (int, error) {
	if s.repo == nil {
		return 0, fmt.Errorf("repository not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	accounts, err := s.repo.ListByLocker(ctx, serviceID)
	if err != nil {
		return 0, err
	}

	released := 0
	for i := range accounts {
		acc := &accounts[i]
		acc.LockedBy = ""
		acc.LockedAt = time.Time{}
		acc.LastUsedAt = time.Now()

		if err := s.repo.Update(ctx, acc); err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"account_id": acc.ID,
				"service_id": serviceID,
			}).Warn("failed to release account for service")
			continue
		}
		released++
	}

	return released, nil
}

// UpdateBalance updates an account's token balance.
func (s *Service) UpdateBalance(ctx context.Context, serviceID, accountID, tokenType string, delta int64, absolute *int64) (oldBalance, newBalance, txCount int64, err error) {
	if s.repo == nil {
		return 0, 0, 0, fmt.Errorf("repository not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	// Default to GAS if no token specified
	if tokenType == "" {
		tokenType = TokenTypeGAS
	}

	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("account not found: %w", err)
	}

	// Verify the account is locked by this service
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

	if absolute != nil {
		newBalance = *absolute
	} else {
		newBalance = oldBalance + delta
	}

	if newBalance < 0 {
		return 0, 0, 0, fmt.Errorf("insufficient balance")
	}

	// Get script hash and decimals for token
	scriptHash, decimals := neoaccountssupabase.GetDefaultTokenConfig(tokenType)

	// Upsert the balance
	if err := s.repo.UpsertBalance(ctx, accountID, tokenType, scriptHash, newBalance, decimals); err != nil {
		return 0, 0, 0, fmt.Errorf("upsert balance: %w", err)
	}

	// Update account metadata
	acc.LastUsedAt = time.Now()
	acc.TxCount++

	if err := s.repo.Update(ctx, acc); err != nil {
		return 0, 0, 0, err
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
func (s *Service) ListAccountsByService(ctx context.Context, serviceID, tokenType string, minBalance *int64) ([]AccountInfo, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

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
func (s *Service) ListLowBalanceAccounts(ctx context.Context, tokenType string, maxBalance int64, limit int) ([]AccountInfo, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

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
// Lock is held only for brief in-memory state checks and DB writes, not during
// read-heavy DB queries, to avoid blocking pool operations.
func (s *Service) rotateAccounts(ctx context.Context) {
	if s.repo == nil {
		return
	}

	// Phase 1: Read without lock - fetch data from DB
	available, err := s.repo.ListAvailable(ctx, MaxPoolAccounts)
	if err != nil {
		return
	}
	activeCount := len(available)

	retireCount := int(float64(activeCount) * RotationRate / 24)
	if retireCount < 1 {
		retireCount = 1
	}

	minAge := time.Duration(RotationMinAge) * time.Hour
	minGasBalance := int64(100000) // 0.001 GAS

	candidates, err := s.repo.ListRotationCandidatesWithBalances(ctx, minAge, retireCount*3)
	if err != nil {
		candidates = nil // proceed to pool-size check and cleanup
	}

	// Phase 2: Process candidates - lock only for state checks and updates
	retired := 0
	for i := range candidates {
		if retired >= retireCount {
			break
		}
		acc := &candidates[i]

		gasBalance := acc.GetBalance(TokenTypeGAS)
		neoBalance := acc.GetBalance(TokenTypeNEO)

		if gasBalance < minGasBalance && neoBalance == 0 {
			s.mu.Lock()
			dbAcc, err := s.repo.GetByID(ctx, acc.ID)
			if err != nil {
				s.mu.Unlock()
				continue
			}
			// Re-verify eligibility under lock
			if dbAcc.LockedBy != "" || dbAcc.IsRetiring {
				s.mu.Unlock()
				continue
			}
			dbAcc.IsRetiring = true
			retired++
			if err := s.repo.Update(ctx, dbAcc); err != nil {
				s.Logger().WithContext(ctx).WithError(err).WithField("account_id", acc.ID).Warn("failed to mark account as retiring")
			}
			s.mu.Unlock()
		}
	}

	// Phase 3: Pool size maintenance - brief lock
	// Use total account count (not just available) to avoid unnecessary creation
	// when many accounts are temporarily locked.
	s.mu.Lock()
	allAccts, listErr := s.repo.List(ctx)
	totalCount := len(allAccts)
	if listErr != nil {
		totalCount = activeCount // fallback to available count on error
	}
	deficit := totalCount - retired
	for deficit < MinPoolAccounts {
		if _, err := s.createAccount(ctx); err != nil {
			break
		}
		deficit++
	}
	s.mu.Unlock()

	// Phase 4: Delete retiring accounts (if enabled) - lock per-delete
	if deleteRetiringAccountsEnabled() {
		allAccounts, err := s.repo.ListWithBalances(ctx)
		if err != nil {
			return
		}
		for i := range allAccounts {
			acc := &allAccounts[i]
			if acc.IsRetiring && acc.IsEmpty() && acc.LockedBy == "" {
				s.mu.Lock()
				if err := s.repo.Delete(ctx, acc.ID); err != nil {
					s.Logger().WithContext(ctx).WithError(err).WithField("account_id", acc.ID).Warn("failed to delete retiring account")
				}
				s.mu.Unlock()
			}
		}
	}
}

// cleanupStaleLocks releases accounts that have been locked too long.
// DB read is done without lock; lock is held only for each individual update.
func (s *Service) cleanupStaleLocks(ctx context.Context) {
	if s.repo == nil {
		return
	}

	// Read phase: fetch locked accounts without holding the mutex
	accounts, err := s.repo.ListLocked(ctx)
	if err != nil {
		return
	}

	now := time.Now()
	for i := range accounts {
		acc := &accounts[i]
		if !acc.LockedAt.IsZero() && now.Sub(acc.LockedAt) > LockTimeout {
			s.mu.Lock()
			// Re-fetch under lock to avoid stale-read races
			fresh, err := s.repo.GetByID(ctx, acc.ID)
			if err != nil {
				s.mu.Unlock()
				continue
			}
			if fresh.LockedBy == "" || fresh.LockedAt.IsZero() || now.Sub(fresh.LockedAt) <= LockTimeout {
				s.mu.Unlock()
				continue
			}
			fresh.LockedBy = ""
			fresh.LockedAt = time.Time{}
			if err := s.repo.Update(ctx, fresh); err != nil {
				s.Logger().WithContext(ctx).WithError(err).WithField("account_id", acc.ID).Warn("failed to release stale lock")
			}
			s.mu.Unlock()
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
