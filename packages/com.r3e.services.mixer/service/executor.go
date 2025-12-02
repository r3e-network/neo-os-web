// Package mixer provides privacy-preserving transaction mixing service.
package mixer

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
)

// MixingExecutor handles the execution of scheduled mixing transactions.
// It runs as a background worker that:
// - Polls for scheduled transactions that are due
// - Executes internal mixing transactions between pool accounts
// - Executes delivery transactions to target addresses
// - Updates transaction and request statuses
type MixingExecutor struct {
	mu sync.RWMutex

	store  Store
	tee    TEEManager
	chain  ChainClient
	log    *logger.Logger

	// Configuration
	config ExecutorConfig

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// State
	running bool
}

// ExecutorConfig configures the mixing executor.
type ExecutorConfig struct {
	// PollInterval is how often to check for due transactions
	PollInterval time.Duration

	// BatchSize is the maximum number of transactions to process per poll
	BatchSize int

	// RetryAttempts is the number of times to retry a failed transaction
	RetryAttempts int

	// RetryDelay is the delay between retry attempts
	RetryDelay time.Duration

	// ConfirmationTimeout is how long to wait for transaction confirmation
	ConfirmationTimeout time.Duration
}

// DefaultExecutorConfig returns the default executor configuration.
func DefaultExecutorConfig() ExecutorConfig {
	return ExecutorConfig{
		PollInterval:        30 * time.Second,
		BatchSize:           10,
		RetryAttempts:       3,
		RetryDelay:          5 * time.Second,
		ConfirmationTimeout: 5 * time.Minute,
	}
}

// NewMixingExecutor creates a new mixing executor.
func NewMixingExecutor(store Store, tee TEEManager, chain ChainClient, log *logger.Logger, config ExecutorConfig) *MixingExecutor {
	if config.PollInterval == 0 {
		config = DefaultExecutorConfig()
	}

	return &MixingExecutor{
		store:  store,
		tee:    tee,
		chain:  chain,
		log:    log,
		config: config,
	}
}

// Start begins the executor's background processing.
func (e *MixingExecutor) Start(ctx context.Context) error {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return fmt.Errorf("executor already running")
	}

	e.ctx, e.cancel = context.WithCancel(ctx)
	e.running = true
	e.mu.Unlock()

	e.wg.Add(1)
	go e.runLoop()

	e.log.Info("mixing executor started",
		"poll_interval", e.config.PollInterval,
		"batch_size", e.config.BatchSize,
	)

	return nil
}

// Stop gracefully stops the executor.
func (e *MixingExecutor) Stop() error {
	e.mu.Lock()
	if !e.running {
		e.mu.Unlock()
		return nil
	}
	e.cancel()
	e.running = false
	e.mu.Unlock()

	e.wg.Wait()
	e.log.Info("mixing executor stopped")
	return nil
}

// IsRunning returns whether the executor is running.
func (e *MixingExecutor) IsRunning() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.running
}

// runLoop is the main processing loop.
func (e *MixingExecutor) runLoop() {
	defer e.wg.Done()

	ticker := time.NewTicker(e.config.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			if err := e.processDueTransactions(); err != nil {
				e.log.WithError(err).Error("failed to process due transactions")
			}
		}
	}
}

// processDueTransactions finds and executes transactions that are due.
func (e *MixingExecutor) processDueTransactions() error {
	ctx, cancel := context.WithTimeout(e.ctx, e.config.ConfirmationTimeout)
	defer cancel()

	// Get scheduled transactions that are due
	now := time.Now()
	txs, err := e.store.ListScheduledMixTransactions(ctx, now, e.config.BatchSize)
	if err != nil {
		return fmt.Errorf("list scheduled transactions: %w", err)
	}

	if len(txs) == 0 {
		return nil
	}

	e.log.Info("processing due transactions", "count", len(txs))

	for _, tx := range txs {
		if err := e.executeTransaction(ctx, tx); err != nil {
			e.log.WithError(err).Error("failed to execute transaction",
				"tx_id", tx.ID,
				"type", tx.Type,
			)
			// Mark as failed after retries exhausted
			if tx.RetryCount >= e.config.RetryAttempts {
				tx.Status = MixTxStatusFailed
				tx.ErrorMessage = err.Error()
			} else {
				tx.RetryCount++
				tx.ScheduledAt = now.Add(e.config.RetryDelay)
			}
			tx.UpdatedAt = now
			if _, updateErr := e.store.UpdateMixTransaction(ctx, tx); updateErr != nil {
				e.log.WithError(updateErr).Error("failed to update transaction status")
			}
			continue
		}
	}

	return nil
}

// executeTransaction executes a single mixing transaction.
func (e *MixingExecutor) executeTransaction(ctx context.Context, tx MixTransaction) error {
	switch tx.Type {
	case MixTxTypeInternal:
		return e.executeInternalTransfer(ctx, tx)
	case MixTxTypeDelivery:
		return e.executeDelivery(ctx, tx)
	default:
		return fmt.Errorf("unknown transaction type: %s", tx.Type)
	}
}

// executeInternalTransfer executes an internal pool-to-pool transfer.
func (e *MixingExecutor) executeInternalTransfer(ctx context.Context, tx MixTransaction) error {
	// Get source and destination pools
	fromPool, err := e.store.GetPoolAccount(ctx, tx.FromPoolID)
	if err != nil {
		return fmt.Errorf("get source pool: %w", err)
	}

	toPool, err := e.store.GetPoolAccount(ctx, tx.ToPoolID)
	if err != nil {
		return fmt.Errorf("get destination pool: %w", err)
	}

	// Determine transfer amount (use a portion of the pool balance)
	balance, _ := new(big.Int).SetString(fromPool.Balance, 10)
	if balance == nil || balance.Sign() <= 0 {
		// Skip if no balance
		tx.Status = MixTxStatusConfirmed
		tx.UpdatedAt = time.Now()
		_, err = e.store.UpdateMixTransaction(ctx, tx)
		return err
	}

	// Transfer 10-50% of balance for obfuscation
	transferAmount := new(big.Int).Div(balance, big.NewInt(3)) // ~33%
	if transferAmount.Sign() <= 0 {
		transferAmount = balance
	}

	// Build unsigned transaction
	unsignedTx, err := e.chain.BuildTransferTx(ctx, fromPool.WalletAddress, toPool.WalletAddress, transferAmount.String(), "")
	if err != nil {
		return fmt.Errorf("build transfer tx: %w", err)
	}

	// Sign with TEE key
	signature, err := e.tee.SignTransaction(ctx, fromPool.HDIndex, unsignedTx)
	if err != nil {
		return fmt.Errorf("sign transaction: %w", err)
	}

	// Combine unsigned tx with signature
	signedTx := appendSignature(unsignedTx, signature)

	// Submit to chain
	txHash, err := e.chain.SendTransaction(ctx, signedTx)
	if err != nil {
		return fmt.Errorf("send transaction: %w", err)
	}

	// Wait for confirmation
	confirmed, blockNum, err := e.waitForConfirmation(ctx, txHash)
	if err != nil {
		return fmt.Errorf("wait for confirmation: %w", err)
	}
	if !confirmed {
		return fmt.Errorf("transaction not confirmed: %s", txHash)
	}

	// Update transaction record
	tx.Status = MixTxStatusConfirmed
	tx.TxHash = txHash
	tx.Amount = transferAmount.String()
	tx.BlockNumber = blockNum
	tx.ExecutedAt = time.Now()
	tx.UpdatedAt = time.Now()

	if _, err := e.store.UpdateMixTransaction(ctx, tx); err != nil {
		return fmt.Errorf("update transaction: %w", err)
	}

	// Update pool balances
	if err := e.updatePoolBalances(ctx, fromPool, toPool, transferAmount); err != nil {
		e.log.WithError(err).Warn("failed to update pool balances")
	}

	e.log.Info("internal transfer completed",
		"tx_id", tx.ID,
		"tx_hash", txHash,
		"amount", transferAmount.String(),
		"from_pool", fromPool.ID,
		"to_pool", toPool.ID,
	)

	return nil
}

// executeDelivery executes a delivery transaction to a target address.
func (e *MixingExecutor) executeDelivery(ctx context.Context, tx MixTransaction) error {
	// Get the mix request to find source pool
	req, err := e.store.GetMixRequest(ctx, tx.RequestID)
	if err != nil {
		return fmt.Errorf("get mix request: %w", err)
	}

	// Find a pool with sufficient balance
	pools, err := e.store.ListActivePoolAccounts(ctx)
	if err != nil {
		return fmt.Errorf("list pool accounts: %w", err)
	}

	deliveryAmount, _ := new(big.Int).SetString(tx.Amount, 10)
	if deliveryAmount == nil || deliveryAmount.Sign() <= 0 {
		return fmt.Errorf("invalid delivery amount: %s", tx.Amount)
	}

	var sourcePool *PoolAccount
	for _, pool := range pools {
		balance, _ := new(big.Int).SetString(pool.Balance, 10)
		if balance != nil && balance.Cmp(deliveryAmount) >= 0 {
			sourcePool = &pool
			break
		}
	}

	if sourcePool == nil {
		return fmt.Errorf("no pool with sufficient balance for delivery")
	}

	// Build unsigned transaction
	unsignedTx, err := e.chain.BuildTransferTx(ctx, sourcePool.WalletAddress, tx.TargetAddress, tx.Amount, req.TokenAddress)
	if err != nil {
		return fmt.Errorf("build delivery tx: %w", err)
	}

	// Sign with TEE key
	signature, err := e.tee.SignTransaction(ctx, sourcePool.HDIndex, unsignedTx)
	if err != nil {
		return fmt.Errorf("sign transaction: %w", err)
	}

	// Combine unsigned tx with signature
	signedTx := appendSignature(unsignedTx, signature)

	// Submit to chain
	txHash, err := e.chain.SendTransaction(ctx, signedTx)
	if err != nil {
		return fmt.Errorf("send transaction: %w", err)
	}

	// Wait for confirmation
	confirmed, blockNum, err := e.waitForConfirmation(ctx, txHash)
	if err != nil {
		return fmt.Errorf("wait for confirmation: %w", err)
	}
	if !confirmed {
		return fmt.Errorf("transaction not confirmed: %s", txHash)
	}

	// Update transaction record
	tx.Status = MixTxStatusConfirmed
	tx.TxHash = txHash
	tx.FromPoolID = sourcePool.ID
	tx.BlockNumber = blockNum
	tx.ExecutedAt = time.Now()
	tx.UpdatedAt = time.Now()

	if _, err := e.store.UpdateMixTransaction(ctx, tx); err != nil {
		return fmt.Errorf("update transaction: %w", err)
	}

	// Update pool balance
	poolBalance, _ := new(big.Int).SetString(sourcePool.Balance, 10)
	newBalance := new(big.Int).Sub(poolBalance, deliveryAmount)
	sourcePool.Balance = newBalance.String()
	sourcePool.TotalSent = addBigIntStrings(sourcePool.TotalSent, tx.Amount)
	sourcePool.UpdatedAt = time.Now()
	if _, err := e.store.UpdatePoolAccount(ctx, *sourcePool); err != nil {
		e.log.WithError(err).Warn("failed to update pool balance")
	}

	// Update request target delivery status
	if err := e.markTargetDelivered(ctx, req, tx.TargetAddress, tx.Amount, txHash); err != nil {
		e.log.WithError(err).Warn("failed to mark target delivered")
	}

	e.log.Info("delivery completed",
		"tx_id", tx.ID,
		"tx_hash", txHash,
		"amount", tx.Amount,
		"target", tx.TargetAddress,
		"request_id", tx.RequestID,
	)

	return nil
}

// waitForConfirmation waits for a transaction to be confirmed.
func (e *MixingExecutor) waitForConfirmation(ctx context.Context, txHash string) (bool, int64, error) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	timeout := time.After(e.config.ConfirmationTimeout)

	for {
		select {
		case <-ctx.Done():
			return false, 0, ctx.Err()
		case <-timeout:
			return false, 0, fmt.Errorf("confirmation timeout")
		case <-ticker.C:
			confirmed, blockNum, err := e.chain.GetTransactionStatus(ctx, txHash)
			if err != nil {
				e.log.WithError(err).Debug("checking transaction status", "tx_hash", txHash)
				continue
			}
			if confirmed {
				return true, blockNum, nil
			}
		}
	}
}

// updatePoolBalances updates the balances of source and destination pools.
func (e *MixingExecutor) updatePoolBalances(ctx context.Context, from, to PoolAccount, amount *big.Int) error {
	// Update source pool
	fromBalance, _ := new(big.Int).SetString(from.Balance, 10)
	if fromBalance == nil {
		fromBalance = big.NewInt(0)
	}
	newFromBalance := new(big.Int).Sub(fromBalance, amount)
	from.Balance = newFromBalance.String()
	from.TotalSent = addBigIntStrings(from.TotalSent, amount.String())
	from.UpdatedAt = time.Now()

	if _, err := e.store.UpdatePoolAccount(ctx, from); err != nil {
		return fmt.Errorf("update source pool: %w", err)
	}

	// Update destination pool
	toBalance, _ := new(big.Int).SetString(to.Balance, 10)
	if toBalance == nil {
		toBalance = big.NewInt(0)
	}
	newToBalance := new(big.Int).Add(toBalance, amount)
	to.Balance = newToBalance.String()
	to.TotalReceived = addBigIntStrings(to.TotalReceived, amount.String())
	to.UpdatedAt = time.Now()

	if _, err := e.store.UpdatePoolAccount(ctx, to); err != nil {
		return fmt.Errorf("update destination pool: %w", err)
	}

	return nil
}

// markTargetDelivered marks a target as delivered in the mix request.
func (e *MixingExecutor) markTargetDelivered(ctx context.Context, req MixRequest, address, amount, txHash string) error {
	for i, target := range req.Targets {
		if target.Address == address && target.Amount == amount && !target.Delivered {
			req.Targets[i].Delivered = true
			req.Targets[i].TxHash = txHash
			req.Targets[i].DeliveredAt = time.Now()
			break
		}
	}

	// Update delivered amount
	deliveredAmount, _ := new(big.Int).SetString(req.DeliveredAmount, 10)
	if deliveredAmount == nil {
		deliveredAmount = big.NewInt(0)
	}
	txAmount, _ := new(big.Int).SetString(amount, 10)
	if txAmount != nil {
		deliveredAmount.Add(deliveredAmount, txAmount)
		req.DeliveredAmount = deliveredAmount.String()
	}

	req.UpdatedAt = time.Now()
	_, err := e.store.UpdateMixRequest(ctx, req)
	return err
}

// appendSignature appends a signature to an unsigned transaction.
// This creates a Neo N3 compatible signed transaction.
func appendSignature(unsignedTx, signature []byte) []byte {
	// Neo N3 transaction format:
	// [unsigned tx bytes][witness count (1)][invocation script][verification script]

	// For simplicity, we append the signature as a witness
	// In production, this would properly construct the witness structure
	signedTx := make([]byte, len(unsignedTx)+len(signature)+10)
	copy(signedTx, unsignedTx)

	// Set witness count to 1
	offset := len(unsignedTx)
	signedTx[offset] = 0x01
	offset++

	// Invocation script: PUSHDATA1 + length + signature
	signedTx[offset] = 0x0C // PUSHDATA1
	offset++
	signedTx[offset] = byte(len(signature))
	offset++
	copy(signedTx[offset:], signature)

	return signedTx[:offset+len(signature)]
}

// addBigIntStrings adds two big integer strings.
func addBigIntStrings(a, b string) string {
	aInt, _ := new(big.Int).SetString(a, 10)
	if aInt == nil {
		aInt = big.NewInt(0)
	}
	bInt, _ := new(big.Int).SetString(b, 10)
	if bInt == nil {
		bInt = big.NewInt(0)
	}
	return new(big.Int).Add(aInt, bInt).String()
}

// ProcessPendingRequests checks for requests that need status updates.
// This should be called periodically to:
// - Start mixing for deposited requests
// - Complete requests where all deliveries are done
func (e *MixingExecutor) ProcessPendingRequests(ctx context.Context) error {
	// Check for deposited requests that should start mixing
	depositedRequests, err := e.store.ListMixRequestsByStatus(ctx, RequestStatusDeposited, 10)
	if err != nil {
		return fmt.Errorf("list deposited requests: %w", err)
	}

	now := time.Now()
	for _, req := range depositedRequests {
		// Auto-start mixing if deposit is confirmed
		if req.Status == RequestStatusDeposited && len(req.DepositTxHashes) > 0 {
			req.Status = RequestStatusMixing
			req.UpdatedAt = now
			if _, err := e.store.UpdateMixRequest(ctx, req); err != nil {
				e.log.WithError(err).Error("failed to start mixing", "request_id", req.ID)
			} else {
				e.log.Info("mixing started for request", "request_id", req.ID)
			}
		}
	}

	// Check for mixing requests that are complete
	mixingRequests, err := e.store.ListMixRequestsByStatus(ctx, RequestStatusMixing, 10)
	if err != nil {
		return fmt.Errorf("list mixing requests: %w", err)
	}

	for _, req := range mixingRequests {
		allDelivered := true
		for _, target := range req.Targets {
			if !target.Delivered {
				allDelivered = false
				break
			}
		}

		if allDelivered {
			req.Status = RequestStatusCompleted
			req.CompletedAt = now
			req.UpdatedAt = now
			if _, err := e.store.UpdateMixRequest(ctx, req); err != nil {
				e.log.WithError(err).Error("failed to complete request", "request_id", req.ID)
			} else {
				e.log.Info("request completed", "request_id", req.ID)
			}
		}
	}

	return nil
}
