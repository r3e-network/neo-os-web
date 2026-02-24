package neosimulation

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
)

// runAutoTopUp periodically checks for pool accounts with low GAS balance and funds them.
// This ensures pool accounts have enough GAS to pay for transaction fees.
func (s *Service) runAutoTopUp() {
	ctx := context.Background()
	defer func() {
		if r := recover(); r != nil {
			s.Logger().WithField("panic", r).Error("worker panicked")
		}
	}()
	logger := s.Logger().WithFields(map[string]interface{}{"worker": "auto-topup"})

	// Wait for initial setup
	time.Sleep(5 * time.Second)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	logger.WithContext(ctx).Info("starting auto top-up worker for pool accounts")

	// Minimum GAS balance threshold (0.1 GAS = 10000000 in 8 decimals)
	const minGASBalance int64 = 10000000
	// Amount to fund when balance is low (1 GAS = 100000000 in 8 decimals)
	const fundAmount int64 = 100000000

	for {
		select {
		case <-s.stopCh:
			logger.WithContext(ctx).Info("stopping auto top-up worker")
			return
		case <-ticker.C:
			// Get accounts with low GAS balance
			accounts, err := s.poolClient.ListLowBalanceAccounts(ctx, "GAS", minGASBalance, 10)
			if err != nil {
				logger.WithError(err).Warn("failed to list low balance accounts")
				continue
			}

			if len(accounts) == 0 {
				logger.WithContext(ctx).Debug("no accounts need top-up")
				continue
			}

			logger.WithContext(ctx).WithField("count", len(accounts)).Info("found accounts with low GAS balance")

			// Fund each account
			for i := range accounts {
				acc := &accounts[i]
				_, err := s.poolClient.FundAccount(ctx, acc.Address, fundAmount)
				if err != nil {
					logger.WithError(err).WithFields(map[string]interface{}{
						"account_id": acc.ID,
						"address":    acc.Address,
					}).Warn("failed to fund account")
					continue
				}

				logger.WithFields(map[string]interface{}{
					"account_id": acc.ID,
					"address":    acc.Address,
					"amount":     fundAmount,
				}).Info("funded pool account")

				// Small delay between funding operations
				time.Sleep(2 * time.Second)
			}
		}
	}
}

// runAutomationTaskTopUp periodically checks AutomationAnchor periodic tasks with low GAS balance and funds them.
// This ensures periodic automation tasks have enough GAS to pay for execution fees.
// Task IDs are configured via SIMULATION_AUTOMATION_TASK_IDS environment variable (comma-separated list of task IDs).
func (s *Service) runAutomationTaskTopUp() {
	ctx := context.Background()
	defer func() {
		if r := recover(); r != nil {
			s.Logger().WithField("panic", r).Error("worker panicked")
		}
	}()
	logger := s.Logger().WithFields(map[string]interface{}{"worker": "automation-topup"})

	// Get AutomationAnchor contract hash from environment
	automationAnchorHash := strings.TrimSpace(os.Getenv("CONTRACT_AUTOMATIONANCHOR_HASH"))
	if automationAnchorHash == "" {
		logger.WithContext(ctx).Warn("automation task top-up disabled: CONTRACT_AUTOMATIONANCHOR_HASH not set")
		return
	}

	// Get task IDs to monitor from environment
	taskIDsEnv := strings.TrimSpace(os.Getenv("SIMULATION_AUTOMATION_TASK_IDS"))
	if taskIDsEnv == "" {
		logger.WithContext(ctx).Debug("automation task top-up disabled: no task IDs configured in SIMULATION_AUTOMATION_TASK_IDS")
		return
	}

	// Parse task IDs (comma-separated list of integers)
	var taskIDs []int64
	for _, idStr := range strings.Split(taskIDsEnv, ",") {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		var taskID int64
		if _, err := fmt.Sscanf(idStr, "%d", &taskID); err != nil {
			logger.WithContext(ctx).WithError(err).WithField("task_id_str", idStr).Warn("invalid task ID in SIMULATION_AUTOMATION_TASK_IDS")
			continue
		}
		taskIDs = append(taskIDs, taskID)
	}

	if len(taskIDs) == 0 {
		logger.WithContext(ctx).Debug("automation task top-up disabled: no valid task IDs found")
		return
	}

	// Initialize AutomationAnchor contract client
	automationAnchor := chain.NewAutomationAnchorContract(s.chainClient, automationAnchorHash)
	if automationAnchor == nil {
		logger.WithContext(ctx).Warn("automation task top-up disabled: failed to initialize AutomationAnchor contract")
		return
	}

	logger.WithContext(ctx).WithFields(map[string]interface{}{
		"task_ids":       taskIDs,
		"task_count":     len(taskIDs),
		"check_interval": "60s",
	}).Info("starting automation task auto top-up worker")

	// Minimum GAS balance threshold (1 GAS = 100000000 in 8 decimals)
	const minTaskBalance int64 = 100000000
	// Amount to fund when balance is low (10 GAS = 1000000000 in 8 decimals)
	const topUpAmount int64 = 1000000000

	// Wait for initial setup
	time.Sleep(10 * time.Second)

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			logger.WithContext(ctx).Info("stopping automation task top-up worker")
			return
		case <-ticker.C:
			// Check each task's balance
			for _, taskID := range taskIDs {
				taskIDBigInt := big.NewInt(taskID)

				// Query task balance from AutomationAnchor contract
				// Note: AutomationAnchor.BalanceOf(taskId) returns BigInteger
				balance, err := automationAnchor.BalanceOf(ctx, taskIDBigInt)
				if err != nil {
					logger.WithError(err).WithField("task_id", taskID).Warn("failed to get task balance")
					continue
				}

				logger.WithFields(map[string]interface{}{
					"task_id": taskID,
					"balance": balance.Int64(),
				}).Debug("checked automation task balance")

				// Check if balance is below threshold
				if balance.Int64() < minTaskBalance {
					logger.WithFields(map[string]interface{}{
						"task_id":   taskID,
						"balance":   balance,
						"threshold": minTaskBalance,
						"top_up":    topUpAmount,
					}).Info("automation task balance low, funding task")

					// Fund the task by transferring GAS to AutomationAnchor contract with taskId as data
					// This calls AutomationAnchor.OnNEP17Payment which credits the task balance
					err := s.fundAutomationTask(ctx, automationAnchorHash, taskID, topUpAmount)
					if err != nil {
						logger.WithError(err).WithFields(map[string]interface{}{
							"task_id": taskID,
							"amount":  topUpAmount,
						}).Warn("failed to fund automation task")
						continue
					}

					logger.WithFields(map[string]interface{}{
						"task_id": taskID,
						"amount":  topUpAmount,
					}).Info("funded automation task")

					// Small delay between funding operations
					time.Sleep(5 * time.Second)
				}
			}
		}
	}
}

// fundAutomationTask funds an automation task by transferring GAS to AutomationAnchor with taskId as data.
func (s *Service) fundAutomationTask(ctx context.Context, contractHash string, taskID, amount int64) error {
	// Use poolClient.TransferWithData to send GAS to AutomationAnchor contract
	// The taskId is passed as data, which triggers OnNEP17Payment callback

	// Get or request a pool account for funding tasks
	resp, err := s.poolClient.RequestAccounts(ctx, 1, "automation-funding")
	if err != nil {
		return fmt.Errorf("request account: %w", err)
	}

	if len(resp.Accounts) == 0 {
		return fmt.Errorf("no accounts available in pool")
	}

	account := resp.Accounts[0]
	defer func() {
		// Release account back to pool
		if _, releaseErr := s.poolClient.ReleaseAccounts(ctx, []string{account.ID}); releaseErr != nil {
			s.Logger().WithContext(ctx).WithError(releaseErr).WithField("account_id", account.ID).Warn("failed to release automation funding account")
		}
	}()

	// Check if account has sufficient balance
	gasBalance := int64(0)
	if gb, ok := account.Balances["GAS"]; ok {
		gasBalance = gb.Amount
	}

	// Fund account if needed (need amount + tx fee)
	const minBalanceNeeded = int64(1100000000) // 11 GAS (10 for transfer + 1 for fee)
	if gasBalance < minBalanceNeeded {
		_, fundErr := s.poolClient.FundAccount(ctx, account.Address, minBalanceNeeded)
		if fundErr != nil {
			return fmt.Errorf("fund account: %w", fundErr)
		}
		// Wait for funding to confirm
		time.Sleep(5 * time.Second)
	}

	// Transfer GAS to AutomationAnchor with taskId as data
	// This will trigger AutomationAnchor.OnNEP17Payment(from, amount, taskId)
	// The data parameter should be the taskID as a string (will be converted to BigInteger by the contract)
	taskIDStr := fmt.Sprintf("%d", taskID)
	transferResp, err := s.poolClient.TransferWithData(ctx, account.ID, "0x"+contractHash, amount, taskIDStr)
	if err != nil {
		return fmt.Errorf("transfer to automation anchor: %w", err)
	}

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"task_id": taskID,
		"amount":  amount,
		"tx_hash": transferResp.TxHash,
	}).Debug("automation task funding transaction submitted")

	return nil
}
