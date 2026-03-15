// Package neogasbank provides GasBank service for managing user gas balances.
package neogasbank

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	neoaccountsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/client"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
)

// validTxHashRe matches a 0x-prefixed 64-character hex string.
var validTxHashRe = regexp.MustCompile(`^0x[0-9a-fA-F]{64}$`)

const (
	// TopUpThreshold is the minimum GAS balance (in 8 decimals) before top-up
	// 0.1 GAS = 10000000 (10^7)
	TopUpThreshold = 10000000

	// TopUpTargetAmount is the target GAS balance after top-up (in 8 decimals)
	// 1 GAS = 100000000 (10^8)
	TopUpTargetAmount = 100000000

	// TopUpCheckInterval is how often to check for low-balance accounts
	TopUpCheckInterval = 5 * time.Minute

	// TopUpBatchSize is the maximum number of accounts to process per run
	TopUpBatchSize = 100
)

// processAutoTopUp checks pool accounts and tops up those with low GAS balance.
// This worker runs periodically to ensure pool accounts always have sufficient GAS.
func (s *Service) processAutoTopUp(ctx context.Context) {
	if s.chainClient == nil {
		s.Logger().WithContext(ctx).Debug("chain client not configured, skipping auto top-up")
		return
	}

	// Check if auto top-up is enabled
	if !s.isAutoTopUpEnabled() {
		s.Logger().WithContext(ctx).Debug("auto top-up is disabled")
		return
	}

	// Get account pool client
	poolClient, err := s.getAccountPoolClient()
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to get account pool client")
		return
	}

	// Query accounts with low GAS balance using the new ListLowBalanceAccounts method
	accounts, err := poolClient.ListLowBalanceAccounts(ctx, "GAS", TopUpThreshold, TopUpBatchSize)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to query low-balance accounts")
		return
	}

	if len(accounts) == 0 {
		s.Logger().WithContext(ctx).Debug("no accounts need top-up")
		return
	}

	s.Logger().WithContext(ctx).WithField("count", len(accounts)).Info("found accounts needing top-up")

	// Process accounts in batches
	processed := 0
	succeeded := 0
	failed := 0

	for i := 0; i < len(accounts) && processed < TopUpBatchSize; i++ {
		acc := &accounts[i]
		processed++

		// Get current GAS balance
		currentBalance := int64(0)
		if gasBalance, ok := acc.Balances["GAS"]; ok {
			currentBalance = gasBalance.Amount
		}

		// Skip if balance is already above threshold (double-check)
		if currentBalance >= TopUpThreshold {
			continue
		}

		// Calculate top-up amount
		topUpAmount := TopUpTargetAmount - currentBalance
		if topUpAmount <= 0 {
			continue
		}

		// Perform top-up transfer from master wallet
		txHash, err := s.topUpAccount(ctx, poolClient, acc.Address, topUpAmount)
		if err != nil {
			s.Logger().WithContext(ctx).
				WithError(err).
				WithFields(map[string]interface{}{
					"account_id":      acc.ID,
					"account_address": acc.Address,
					"current_balance": currentBalance,
					"topup_amount":    topUpAmount,
				}).
				Warn("failed to top up account")
			failed++
			continue
		}

		s.Logger().WithContext(ctx).
			WithFields(map[string]interface{}{
				"account_id":      acc.ID,
				"account_address": acc.Address,
				"current_balance": currentBalance,
				"topup_amount":    topUpAmount,
				"new_balance":     TopUpTargetAmount,
				"tx_hash":         txHash,
			}).
			Info("successfully topped up account")
		succeeded++
	}

	s.Logger().WithContext(ctx).
		WithFields(map[string]interface{}{
			"processed": processed,
			"succeeded": succeeded,
			"failed":    failed,
		}).
		Info("auto top-up batch completed")
}

// topUpAccount funds a pool account via NeoAccounts `/fund` (master wallet transfer).
// In non-strict environments it can fall back to a simulated tx hash for local testing.
// Returns the transaction hash on success.
func (s *Service) topUpAccount(ctx context.Context, poolClient *neoaccountsclient.Client, toAddress string, amount int64) (string, error) {
	if strings.TrimSpace(toAddress) == "" || amount <= 0 {
		return s.simulatedTopUp(ctx, fmt.Errorf("invalid top-up request"), toAddress, amount)
	}

	if poolClient == nil {
		return s.simulatedTopUp(ctx, fmt.Errorf("account pool client not configured"), toAddress, amount)
	}

	resp, err := poolClient.FundAccount(ctx, toAddress, amount)
	if err != nil {
		return s.simulatedTopUp(ctx, err, toAddress, amount)
	}
	if resp == nil || strings.TrimSpace(resp.TxHash) == "" {
		return s.simulatedTopUp(ctx, fmt.Errorf("account pool fund returned empty tx hash"), toAddress, amount)
	}

	if !validTxHashRe.MatchString(resp.TxHash) {
		s.Logger().WithContext(ctx).WithField("tx_hash", resp.TxHash).Warn("fund returned tx hash with unexpected format")
	}

	return resp.TxHash, nil
}

func (s *Service) simulatedTopUp(ctx context.Context, cause error, toAddress string, amount int64) (string, error) {
	if runtime.IsProduction() || runtime.StrictIdentityMode() || s.Nitro().IsEnclave() {
		if cause == nil {
			cause = fmt.Errorf("top-up failed in strict mode")
		}
		return "", cause
	}

	if cause != nil {
		s.Logger().WithContext(ctx).WithError(cause).Warn("falling back to simulated top-up")
	}
	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"to_address": toAddress,
		"amount":     amount,
	}).Info("simulated top-up transfer")

	return "0x0000000000000000000000000000000000000000000000000000000000000000", nil
}

// getAccountPoolClient returns a lazily-initialized, reused client for the
// account pool service. Transient errors (e.g. env not yet populated by an
// init-container) are not cached so callers can retry on the next call.
func (s *Service) getAccountPoolClient() (*neoaccountsclient.Client, error) {
	s.poolClientMu.Lock()
	defer s.poolClientMu.Unlock()

	if s.poolClient != nil {
		return s.poolClient, nil
	}

	poolURL := strings.TrimSpace(os.Getenv("NEOACCOUNTS_SERVICE_URL"))
	if poolURL == "" {
		poolURL = "https://neoaccounts:8085" // Default service mesh URL
	}
	client, err := neoaccountsclient.New(neoaccountsclient.Config{
		BaseURL:    poolURL,
		ServiceID:  ServiceID,
		HTTPClient: s.Nitro().HTTPClient(),
	})
	if err != nil {
		return nil, err
	}

	// Cache on success only; errors are not cached so callers can retry.
	s.poolClient = client
	return client, nil
}

// isAutoTopUpEnabled checks if auto top-up is enabled via environment variable.
func (s *Service) isAutoTopUpEnabled() bool {
	return runtime.ParseEnvBoolKey("TOPUP_ENABLED")
}
