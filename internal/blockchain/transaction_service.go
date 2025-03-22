package blockchain

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"service_layer/internal/database"
	"service_layer/internal/models"
)

// TransactionService provides functionality for managing blockchain transactions
type TransactionService struct {
	repo          database.TransactionRepository
	client        *Client
	walletStore   *WalletStore
	confirmations int64
	// Tracking for pending transactions
	pending     map[string]models.Transaction
	pendingLock sync.RWMutex
}

// NewTransactionService creates a new TransactionService
func NewTransactionService(
	repo database.TransactionRepository,
	client *Client,
	walletStore *WalletStore,
	confirmations int64,
) *TransactionService {
	return &TransactionService{
		repo:          repo,
		client:        client,
		walletStore:   walletStore,
		confirmations: confirmations,
		pending:       make(map[string]models.Transaction),
	}
}

// CreateTransaction creates a new transaction and submits it to the blockchain
func (s *TransactionService) CreateTransaction(ctx context.Context, req models.CreateTransactionRequest) (*models.Transaction, error) {
	// Initialize the transaction model
	txID := uuid.New()
	data, err := models.InitializeTransactionData(req)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize transaction data: %w", err)
	}

	// Get the wallet for the service
	wallet, err := s.repo.GetWalletByService(ctx, req.Service)
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet for service %s: %w", req.Service, err)
	}

	// Create transaction model
	tx := &models.Transaction{
		ID:         txID,
		Service:    req.Service,
		EntityID:   &req.EntityID,
		EntityType: req.EntityType,
		Status:     models.TransactionStatusCreated,
		Type:       req.Type,
		Data:       data,
		GasPrice:   req.GasPrice,
		SystemFee:  req.SystemFee,
		NetworkFee: req.NetworkFee,
		Sender:     wallet.Address,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Save transaction in database
	if err := s.repo.CreateTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("failed to create transaction record: %w", err)
	}

	// Create transaction event for creation
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: txID,
		Status:        models.TransactionStatusCreated,
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", txID.String()).Msg("failed to add transaction created event")
	}

	// Submit transaction to blockchain in a separate goroutine
	go func() {
		if err := s.submitTransaction(context.Background(), tx); err != nil {
			log.Error().Err(err).Str("txID", txID.String()).Msg("failed to submit transaction")
		}
	}()

	return tx, nil
}

// submitTransaction submits a transaction to the blockchain
func (s *TransactionService) submitTransaction(ctx context.Context, tx *models.Transaction) error {
	// Decrypt private key from wallet
	wallet, err := s.repo.GetWalletByService(ctx, tx.Service)
	if err != nil {
		return fmt.Errorf("failed to get wallet for service %s: %w", tx.Service, err)
	}

	// Decrypt private key using the wallet store
	privateKey, err := s.walletStore.GetPrivateKey(ctx, wallet.ID)
	if err != nil {
		return fmt.Errorf("failed to decrypt private key: %w", err)
	}

	// Build and sign transaction based on type
	var hash string
	switch tx.Type {
	case models.TransactionTypeInvoke:
		var data models.InvokeScriptData
		if err := json.Unmarshal(tx.Data, &data); err != nil {
			return fmt.Errorf("failed to unmarshal invoke data: %w", err)
		}
		
		hash, err = s.client.InvokeContract(ctx, data.Script, data.Params, data.Signers, privateKey)
		if err != nil {
			// Update transaction as failed
			errMsg := err.Error()
			s.updateTransactionAsFailed(ctx, tx.ID, nil, nil, nil, errMsg)
			return fmt.Errorf("failed to invoke contract: %w", err)
		}
	case models.TransactionTypeDeployment:
		var data models.DeploymentData
		if err := json.Unmarshal(tx.Data, &data); err != nil {
			return fmt.Errorf("failed to unmarshal deployment data: %w", err)
		}
		
		hash, err = s.client.DeployContract(ctx, data.NEF, data.Manifest, data.Signers, privateKey)
		if err != nil {
			// Update transaction as failed
			errMsg := err.Error()
			s.updateTransactionAsFailed(ctx, tx.ID, nil, nil, nil, errMsg)
			return fmt.Errorf("failed to deploy contract: %w", err)
		}
	case models.TransactionTypeTransfer:
		var data models.TransferData
		if err := json.Unmarshal(tx.Data, &data); err != nil {
			return fmt.Errorf("failed to unmarshal transfer data: %w", err)
		}
		
		hash, err = s.client.TransferAsset(ctx, data.Asset, data.Amount, data.Recipient, data.Signers, privateKey)
		if err != nil {
			// Update transaction as failed
			errMsg := err.Error()
			s.updateTransactionAsFailed(ctx, tx.ID, nil, nil, nil, errMsg)
			return fmt.Errorf("failed to transfer asset: %w", err)
		}
	default:
		return fmt.Errorf("unsupported transaction type: %s", tx.Type)
	}

	// Update transaction with hash and status
	result := json.RawMessage(`{}`)
	err = s.repo.UpdateTransactionStatus(ctx, tx.ID, models.TransactionStatusPending, result, nil, nil, nil, "")
	if err != nil {
		return fmt.Errorf("failed to update transaction status: %w", err)
	}

	// Add transaction to pending map
	s.pendingLock.Lock()
	tx.Hash = hash
	tx.Status = models.TransactionStatusPending
	s.pending[hash] = *tx
	s.pendingLock.Unlock()

	// Create transaction event for pending
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: tx.ID,
		Status:        models.TransactionStatusPending,
		Details:       json.RawMessage(fmt.Sprintf(`{"hash":"%s"}`, hash)),
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", tx.ID.String()).Msg("failed to add transaction pending event")
	}

	return nil
}

// GetTransaction retrieves a transaction by ID
func (s *TransactionService) GetTransaction(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	return s.repo.GetTransactionByID(ctx, id)
}

// GetTransactionByHash retrieves a transaction by hash
func (s *TransactionService) GetTransactionByHash(ctx context.Context, hash string) (*models.Transaction, error) {
	return s.repo.GetTransactionByHash(ctx, hash)
}

// ListTransactions lists transactions with filtering
func (s *TransactionService) ListTransactions(
	ctx context.Context,
	service string,
	status models.TransactionStatus,
	entityID *uuid.UUID,
	page, limit int,
) (*models.TransactionListResponse, error) {
	return s.repo.ListTransactions(ctx, service, status, entityID, page, limit)
}

// RetryTransaction retries a failed or expired transaction
func (s *TransactionService) RetryTransaction(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	tx, err := s.repo.GetTransactionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	if tx.Status != models.TransactionStatusFailed && tx.Status != models.TransactionStatusExpired {
		return nil, errors.New("transaction is not in a retryable state")
	}

	// Update status to created
	result := json.RawMessage(`{}`)
	err = s.repo.UpdateTransactionStatus(ctx, tx.ID, models.TransactionStatusCreated, result, nil, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to update transaction status: %w", err)
	}

	tx.Status = models.TransactionStatusCreated
	tx.UpdatedAt = time.Now()

	// Create transaction event for retry
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: tx.ID,
		Status:        models.TransactionStatusCreated,
		Details:       json.RawMessage(`{"retry":true}`),
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", tx.ID.String()).Msg("failed to add transaction retry event")
	}

	// Submit transaction in a goroutine
	go func() {
		if err := s.submitTransaction(context.Background(), tx); err != nil {
			log.Error().Err(err).Str("txID", tx.ID.String()).Msg("failed to retry transaction")
		}
	}()

	return tx, nil
}

// CancelTransaction cancels a pending transaction
func (s *TransactionService) CancelTransaction(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	tx, err := s.repo.GetTransactionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction: %w", err)
	}

	if tx.Status != models.TransactionStatusCreated && tx.Status != models.TransactionStatusPending {
		return nil, errors.New("transaction is not in a cancellable state")
	}

	// Remove from pending if present
	if tx.Hash != "" {
		s.pendingLock.Lock()
		delete(s.pending, tx.Hash)
		s.pendingLock.Unlock()
	}

	// Update status to cancelled
	result := json.RawMessage(`{}`)
	err = s.repo.UpdateTransactionStatus(ctx, tx.ID, models.TransactionStatusCancelled, result, nil, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to update transaction status: %w", err)
	}

	tx.Status = models.TransactionStatusCancelled
	tx.UpdatedAt = time.Now()

	// Create transaction event for cancellation
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: tx.ID,
		Status:        models.TransactionStatusCancelled,
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", tx.ID.String()).Msg("failed to add transaction cancel event")
	}

	return tx, nil
}

// GetTransactionEvents retrieves events for a transaction
func (s *TransactionService) GetTransactionEvents(ctx context.Context, transactionID uuid.UUID) ([]models.TransactionEvent, error) {
	return s.repo.GetTransactionEvents(ctx, transactionID)
}

// StartMonitoring starts monitoring pending transactions
func (s *TransactionService) StartMonitoring(ctx context.Context) {
	go s.monitorPendingTransactions(ctx)
}

// monitorPendingTransactions continuously monitors pending transactions
func (s *TransactionService) monitorPendingTransactions(ctx context.Context) {
	// Load pending transactions from database on startup
	if err := s.loadPendingTransactions(ctx); err != nil {
		log.Error().Err(err).Msg("failed to load pending transactions")
	}

	checkTicker := time.NewTicker(30 * time.Second)
	loadTicker := time.NewTicker(5 * time.Minute)
	healthCheckTicker := time.NewTicker(2 * time.Minute)
	defer checkTicker.Stop()
	defer loadTicker.Stop()
	defer healthCheckTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-checkTicker.C:
			s.checkPendingTransactions(ctx)
		case <-loadTicker.C:
			// Periodically reload from database to ensure no transactions are missed
			if err := s.loadPendingTransactions(ctx); err != nil {
				log.Error().Err(err).Msg("failed to reload pending transactions")
			}
		case <-healthCheckTicker.C:
			// Check node health periodically
			if err := s.client.CheckHealth(ctx); err != nil {
				log.Warn().Err(err).Msg("node health check failed, will retry with different nodes")
				// Force client to attempt reconnection on next operation
				s.client.ResetConnections()
			}
		}
	}
}

// loadPendingTransactions loads pending transactions from the database into memory
func (s *TransactionService) loadPendingTransactions(ctx context.Context) error {
	// Get pending transactions from database
	transactions, err := s.repo.GetTransactionsByStatus(ctx, []models.TransactionStatus{
		models.TransactionStatusPending,
		models.TransactionStatusConfirming,
		models.TransactionStatusSubmitted,
	})
	if err != nil {
		return fmt.Errorf("failed to get pending transactions: %w", err)
	}
	
	// Update the in-memory pending transactions map
	s.pendingLock.Lock()
	defer s.pendingLock.Unlock()
	
	// Clear existing pending map and reload
	s.pending = make(map[string]models.Transaction)
	
	// Add transactions to pending map
	for _, tx := range transactions {
		if tx.Hash != nil && *tx.Hash != "" {
			s.pending[*tx.Hash] = tx
		}
	}
	
	log.Info().Int("count", len(s.pending)).Msg("loaded pending transactions")
	return nil
}

// checkPendingTransactions checks the status of all pending transactions
func (s *TransactionService) checkPendingTransactions(ctx context.Context) {
	s.pendingLock.RLock()
	pendingTransactions := make(map[string]models.Transaction)
	for hash, tx := range s.pending {
		pendingTransactions[hash] = tx
	}
	s.pendingLock.RUnlock()

	var retryHashes []string
	networkErrors := 0
	
	for hash, tx := range pendingTransactions {
		if tx.Status != models.TransactionStatusPending && 
		   tx.Status != models.TransactionStatusConfirming && 
		   tx.Status != models.TransactionStatusSubmitted {
			continue
		}

		// Check if transaction is in mempool first for submitted transactions
		if tx.Status == models.TransactionStatusSubmitted {
			inMempool, err := s.client.IsTransactionInMempool(ctx, hash)
			if err != nil {
				log.Error().Err(err).Str("hash", hash).Msg("failed to check mempool status")
				networkErrors++
				continue
			}
			
			if inMempool {
				// Update status to pending if found in mempool
				err := s.repo.UpdateTransactionStatus(
					ctx, 
					tx.ID, 
					models.TransactionStatusPending, 
					nil, 
					nil, 
					nil, 
					nil, 
					"",
				)
				if err != nil {
					log.Error().Err(err).Str("txID", tx.ID.String()).Msg("failed to update transaction as pending")
				} else {
					// Update in-memory status
					s.pendingLock.Lock()
					tx.Status = models.TransactionStatusPending
					s.pending[hash] = tx
					s.pendingLock.Unlock()
					
					// Create transaction event
					event := &models.TransactionEvent{
						ID:            uuid.New(),
						TransactionID: tx.ID,
						Status:        models.TransactionStatusPending,
						Timestamp:     time.Now(),
					}
					if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
						log.Error().Err(err).Str("txID", tx.ID.String()).Msg("failed to add transaction pending event")
					}
				}
				continue
			} else {
				// Not in mempool, check if we need to retry submission
				timeSinceSubmit := time.Since(tx.UpdatedAt)
				if timeSinceSubmit > 5*time.Minute {
					log.Warn().
						Str("hash", hash).
						Str("txID", tx.ID.String()).
						Dur("timeSinceSubmit", timeSinceSubmit).
						Msg("transaction not in mempool after timeout, will retry")
					retryHashes = append(retryHashes, hash)
				}
				continue
			}
		}

		receipt, err := s.client.GetTransactionReceipt(ctx, hash)
		if err != nil {
			log.Error().Err(err).Str("hash", hash).Msg("failed to get transaction receipt")
			networkErrors++
			
			// Check if transaction has been pending for too long (1 hour)
			if tx.Status == models.TransactionStatusPending && time.Since(tx.UpdatedAt) > time.Hour {
				s.expireTransaction(ctx, tx.ID, "Transaction timed out after 1 hour")
				
				s.pendingLock.Lock()
				delete(s.pending, hash)
				s.pendingLock.Unlock()
			}
			
			continue
		}

		if receipt.Confirmations >= s.confirmations {
			// Transaction is confirmed
			s.updateTransactionAsConfirmed(ctx, tx.ID, receipt.GasConsumed, receipt.BlockHeight, receipt.BlockTime, receipt.Result)
			
			s.pendingLock.Lock()
			delete(s.pending, hash)
			s.pendingLock.Unlock()
		} else if receipt.Confirmations > 0 && tx.Status == models.TransactionStatusPending {
			// Transaction is in a block but not fully confirmed
			s.updateTransactionAsConfirming(ctx, tx.ID, receipt.BlockHeight, receipt.BlockTime)
			
			// Update the status in pending map
			s.pendingLock.Lock()
			tx.Status = models.TransactionStatusConfirming
			s.pending[hash] = tx
			s.pendingLock.Unlock()
		}
	}
	
	// Handle network partition detection
	if networkErrors > 10 && len(pendingTransactions) > 0 {
		log.Warn().Int("errors", networkErrors).Msg("possible network partition detected, forcing node reconnection")
		s.client.ResetConnections()
	}
	
	// Retry transactions that might have failed to be included in mempool
	for _, hash := range retryHashes {
		tx, exists := pendingTransactions[hash]
		if !exists {
			continue
		}
		
		log.Info().Str("txID", tx.ID.String()).Msg("retrying transaction submission")
		go func(t models.Transaction) {
			if err := s.resubmitTransaction(context.Background(), &t); err != nil {
				log.Error().Err(err).Str("txID", t.ID.String()).Msg("failed to resubmit transaction")
			}
		}(tx)
	}
}

// resubmitTransaction attempts to resubmit a previously submitted transaction
func (s *TransactionService) resubmitTransaction(ctx context.Context, tx *models.Transaction) error {
	// Mark transaction as being retried
	err := s.repo.UpdateTransactionStatus(
		ctx, 
		tx.ID, 
		models.TransactionStatusSubmitted, 
		nil, 
		nil, 
		nil, 
		nil, 
		"Retrying transaction submission",
	)
	if err != nil {
		return fmt.Errorf("failed to update transaction status: %w", err)
	}
	
	// Create a transaction event for retry
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: tx.ID,
		Status:        models.TransactionStatusSubmitted,
		Details:       json.RawMessage(`{"retry":true}`),
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", tx.ID.String()).Msg("failed to add transaction retry event")
	}
	
	// Resubmit transaction
	return s.submitTransaction(ctx, tx)
}

// CheckHealth checks if the blockchain client is healthy
func (s *TransactionService) CheckHealth(ctx context.Context) error {
	return s.client.CheckHealth(ctx)
}

// updateTransactionAsConfirmed updates a transaction as confirmed
func (s *TransactionService) updateTransactionAsConfirmed(ctx context.Context, id uuid.UUID, gasConsumed int64, blockHeight int64, blockTime time.Time, result json.RawMessage) {
	err := s.repo.UpdateTransactionStatus(
		ctx, 
		id, 
		models.TransactionStatusConfirmed, 
		result, 
		&gasConsumed, 
		&blockHeight, 
		&blockTime, 
		"",
	)
	if err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to update transaction as confirmed")
		return
	}

	// Create transaction event for confirmation
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: id,
		Status:        models.TransactionStatusConfirmed,
		Details:       json.RawMessage(fmt.Sprintf(`{"blockHeight":%d,"gasConsumed":%d}`, blockHeight, gasConsumed)),
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to add transaction confirmed event")
	}
}

// updateTransactionAsConfirming updates a transaction as confirming
func (s *TransactionService) updateTransactionAsConfirming(ctx context.Context, id uuid.UUID, blockHeight int64, blockTime time.Time) {
	result := json.RawMessage(`{}`)
	err := s.repo.UpdateTransactionStatus(
		ctx, 
		id, 
		models.TransactionStatusConfirming, 
		result, 
		nil, 
		&blockHeight, 
		&blockTime, 
		"",
	)
	if err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to update transaction as confirming")
		return
	}

	// Create transaction event for confirming
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: id,
		Status:        models.TransactionStatusConfirming,
		Details:       json.RawMessage(fmt.Sprintf(`{"blockHeight":%d}`, blockHeight)),
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to add transaction confirming event")
	}
}

// updateTransactionAsFailed updates a transaction as failed
func (s *TransactionService) updateTransactionAsFailed(ctx context.Context, id uuid.UUID, gasConsumed *int64, blockHeight *int64, blockTime *time.Time, errMsg string) {
	result := json.RawMessage(`{}`)
	err := s.repo.UpdateTransactionStatus(
		ctx, 
		id, 
		models.TransactionStatusFailed, 
		result, 
		gasConsumed, 
		blockHeight, 
		blockTime, 
		errMsg,
	)
	if err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to update transaction as failed")
		return
	}

	// Create transaction event for failure
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: id,
		Status:        models.TransactionStatusFailed,
		Details:       json.RawMessage(fmt.Sprintf(`{"error":"%s"}`, errMsg)),
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to add transaction failed event")
	}
}

// expireTransaction marks a transaction as expired
func (s *TransactionService) expireTransaction(ctx context.Context, id uuid.UUID, reason string) {
	result := json.RawMessage(`{}`)
	err := s.repo.UpdateTransactionStatus(
		ctx, 
		id, 
		models.TransactionStatusExpired, 
		result, 
		nil, 
		nil, 
		nil, 
		reason,
	)
	if err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to update transaction as expired")
		return
	}

	// Create transaction event for expiry
	event := &models.TransactionEvent{
		ID:            uuid.New(),
		TransactionID: id,
		Status:        models.TransactionStatusExpired,
		Details:       json.RawMessage(fmt.Sprintf(`{"reason":"%s"}`, reason)),
		Timestamp:     time.Now(),
	}
	if err := s.repo.AddTransactionEvent(ctx, event); err != nil {
		log.Error().Err(err).Str("txID", id.String()).Msg("failed to add transaction expired event")
	}
}

// CreateServiceWallet creates a new wallet for a service
func (s *TransactionService) CreateServiceWallet(ctx context.Context, service string) (*models.WalletAccount, error) {
	// Check if wallet already exists for service
	existing, err := s.repo.GetWalletByService(ctx, service)
	if err == nil && existing != nil {
		return existing, nil
	}

	// Create a new wallet
	wallet, err := s.walletStore.CreateWallet(ctx, service)
	if err != nil {
		return nil, fmt.Errorf("failed to create wallet: %w", err)
	}

	return wallet, nil
}

// GetServiceWallet gets the wallet for a service
func (s *TransactionService) GetServiceWallet(ctx context.Context, service string) (*models.WalletAccount, error) {
	return s.repo.GetWalletByService(ctx, service)
}

// ListServiceWallets lists all wallets for a service
func (s *TransactionService) ListServiceWallets(ctx context.Context, service string) ([]models.WalletAccount, error) {
	return s.repo.ListWalletsByService(ctx, service)
} 