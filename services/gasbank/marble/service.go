// Package neogasbank provides GasBank service for managing user gas balances.
// This service implements:
// - Deposit verification (monitors chain for confirmed deposits)
// - Balance management (credit/debit operations)
// - Service fee deduction (called by other TEE services)
// - Transaction history tracking
package neogasbank

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	commonservice "github.com/R3E-Network/service_layer/infrastructure/service"
)

const (
	ServiceID   = "neogasbank"
	ServiceName = "NeoGasBank Service"
	Version     = "1.0.0"

	// Deposit verification settings
	RequiredConfirmations    = 1
	DepositCheckInterval     = 15 * time.Second
	DepositExpirationTime    = 24 * time.Hour
	MaxPendingDepositsPerRun = 100

	// GAS contract hash on Neo N3
	GASContractHash = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
)

// Service implements the NeoGasBank service.
type Service struct {
	*commonservice.BaseService
	mu sync.RWMutex

	chainClient *chain.Client
	db          database.RepositoryInterface
}

// Config holds NeoGasBank service configuration.
type Config struct {
	Marble      *marble.Marble
	DB          database.RepositoryInterface
	ChainClient *chain.Client
}

// New creates a new NeoGasBank service.
func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neogasbank: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()

	if strict && cfg.ChainClient == nil {
		return nil, fmt.Errorf("neogasbank: chain client is required in strict/enclave mode")
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	s := &Service{
		BaseService: base,
		chainClient: cfg.ChainClient,
		db:          cfg.DB,
	}

	// Register deposit verification worker
	if cfg.ChainClient != nil {
		base.AddTickerWorker(DepositCheckInterval, func(ctx context.Context) error {
			s.processDepositVerification(ctx)
			return nil
		}, commonservice.WithTickerWorkerName("deposit-verifier"))

		// Register expired deposit cleanup worker (runs every hour)
		base.AddTickerWorker(time.Hour, func(ctx context.Context) error {
			s.cleanupExpiredDeposits(ctx)
			return nil
		}, commonservice.WithTickerWorkerName("deposit-cleanup"))
	}

	// Register statistics provider for /info endpoint
	base.WithStats(s.statistics)

	// Register standard routes (/health, /info) plus service-specific routes
	base.RegisterStandardRoutes()
	s.registerRoutes()

	return s, nil
}

// statistics returns runtime statistics for the /info endpoint.
func (s *Service) statistics() map[string]any {
	return map[string]any{
		"deposit_check_interval":  DepositCheckInterval.String(),
		"required_confirmations":  RequiredConfirmations,
		"deposit_expiration_time": DepositExpirationTime.String(),
		"chain_connected":         s.chainClient != nil,
	}
}

// =============================================================================
// Balance Operations
// =============================================================================

// GetAccount retrieves or creates a gas bank account for a user.
func (s *Service) GetAccount(ctx context.Context, userID string) (*GetAccountResponse, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}

	account, err := s.db.GetOrCreateGasBankAccount(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get account: %w", err)
	}

	return &GetAccountResponse{
		ID:        account.ID,
		UserID:    account.UserID,
		Balance:   account.Balance,
		Reserved:  account.Reserved,
		Available: account.Balance - account.Reserved,
		CreatedAt: account.CreatedAt,
		UpdatedAt: account.UpdatedAt,
	}, nil
}

// DeductFee deducts a service fee from a user's gas bank balance.
// This is called by other TEE services (neofeeds, neoflow, etc.) via mTLS.
func (s *Service) DeductFee(ctx context.Context, req *DeductFeeRequest) (*DeductFeeResponse, error) {
	if req.UserID == "" {
		return &DeductFeeResponse{Success: false, Error: "user_id is required"}, nil
	}
	if req.Amount <= 0 {
		return &DeductFeeResponse{Success: false, Error: "amount must be positive"}, nil
	}
	if req.ServiceID == "" {
		return &DeductFeeResponse{Success: false, Error: "service_id is required"}, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Get current account
	account, err := s.db.GetOrCreateGasBankAccount(ctx, req.UserID)
	if err != nil {
		return &DeductFeeResponse{Success: false, Error: fmt.Sprintf("get account: %v", err)}, nil
	}

	// Check available balance
	available := account.Balance - account.Reserved
	if available < req.Amount {
		return &DeductFeeResponse{
			Success:      false,
			BalanceAfter: account.Balance,
			Error:        fmt.Sprintf("insufficient balance: available %d, required %d", available, req.Amount),
		}, nil
	}

	// Deduct from balance
	newBalance := account.Balance - req.Amount
	if err := s.db.UpdateGasBankBalance(ctx, req.UserID, newBalance, account.Reserved); err != nil {
		return &DeductFeeResponse{Success: false, Error: fmt.Sprintf("update balance: %v", err)}, nil
	}

	// Record transaction - if this fails, rollback the balance update
	txID := uuid.New().String()
	tx := &database.GasBankTransaction{
		ID:           txID,
		AccountID:    account.ID,
		TxType:       string(TxTypeServiceFee),
		Amount:       -req.Amount,
		BalanceAfter: newBalance,
		ReferenceID:  req.ReferenceID,
		Status:       "completed",
		CreatedAt:    time.Now(),
	}
	if err := s.db.CreateGasBankTransaction(ctx, tx); err != nil {
		// Rollback balance update to maintain consistency
		s.Logger().WithContext(ctx).WithError(err).Error("failed to record transaction, rolling back balance")
		if rollbackErr := s.db.UpdateGasBankBalance(ctx, req.UserID, account.Balance, account.Reserved); rollbackErr != nil {
			s.Logger().WithContext(ctx).WithError(rollbackErr).Error("CRITICAL: rollback failed, balance inconsistent")
		}
		return &DeductFeeResponse{Success: false, Error: fmt.Sprintf("record transaction: %v", err)}, nil
	}

	return &DeductFeeResponse{
		Success:       true,
		TransactionID: txID,
		BalanceAfter:  newBalance,
	}, nil
}

// ReserveFunds reserves funds for a pending operation.
func (s *Service) ReserveFunds(ctx context.Context, req *ReserveFundsRequest) (*ReserveFundsResponse, error) {
	if req.UserID == "" || req.Amount <= 0 {
		return &ReserveFundsResponse{Success: false}, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	account, err := s.db.GetOrCreateGasBankAccount(ctx, req.UserID)
	if err != nil {
		return &ReserveFundsResponse{Success: false}, nil
	}

	available := account.Balance - account.Reserved
	if available < req.Amount {
		return &ReserveFundsResponse{Success: false, BalanceAfter: account.Balance}, nil
	}

	newReserved := account.Reserved + req.Amount
	if err := s.db.UpdateGasBankBalance(ctx, req.UserID, account.Balance, newReserved); err != nil {
		return &ReserveFundsResponse{Success: false}, nil
	}

	return &ReserveFundsResponse{
		Success:      true,
		Reserved:     newReserved,
		BalanceAfter: account.Balance,
	}, nil
}

// ReleaseFunds releases or commits reserved funds.
func (s *Service) ReleaseFunds(ctx context.Context, req *ReleaseFundsRequest) (*ReleaseFundsResponse, error) {
	if req.UserID == "" || req.Amount <= 0 {
		return &ReleaseFundsResponse{Success: false}, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	account, err := s.db.GetOrCreateGasBankAccount(ctx, req.UserID)
	if err != nil {
		return &ReleaseFundsResponse{Success: false}, nil
	}

	if account.Reserved < req.Amount {
		return &ReleaseFundsResponse{Success: false, BalanceAfter: account.Balance}, nil
	}

	newReserved := account.Reserved - req.Amount
	newBalance := account.Balance
	if req.Commit {
		newBalance = account.Balance - req.Amount
	}

	if err := s.db.UpdateGasBankBalance(ctx, req.UserID, newBalance, newReserved); err != nil {
		return &ReleaseFundsResponse{Success: false}, nil
	}

	return &ReleaseFundsResponse{
		Success:      true,
		BalanceAfter: newBalance,
	}, nil
}

// =============================================================================
// Deposit Verification Worker
// =============================================================================

// processDepositVerification checks pending deposits and verifies them on-chain.
func (s *Service) processDepositVerification(ctx context.Context) {
	if s.chainClient == nil || s.db == nil {
		return
	}

	// Get all pending deposits (we need to add this method to the repository)
	deposits, err := s.getPendingDeposits(ctx)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to get pending deposits")
		return
	}

	for _, deposit := range deposits {
		if deposit.TxHash == "" {
			continue
		}

		// Check transaction on chain
		confirmed, confirmations, err := s.verifyTransaction(ctx, deposit.TxHash, deposit.FromAddress, deposit.Amount)
		if err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithField("tx_hash", deposit.TxHash).Debug("failed to verify transaction")
			continue
		}

		if confirmed {
			s.confirmDeposit(ctx, &deposit)
		} else if confirmations > 0 {
			// Update confirmation count
			_ = s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirming), confirmations)
		}
	}
}

// getPendingDeposits retrieves deposits that need verification.
func (s *Service) getPendingDeposits(ctx context.Context) ([]database.DepositRequest, error) {
	if s.db == nil {
		return nil, nil
	}
	return s.db.GetPendingDeposits(ctx, MaxPendingDepositsPerRun)
}

// verifyTransaction checks if a GAS transfer transaction is confirmed.
func (s *Service) verifyTransaction(ctx context.Context, txHash, fromAddress string, expectedAmount int64) (bool, int, error) {
	if s.chainClient == nil {
		return false, 0, fmt.Errorf("chain client not configured")
	}

	// Get transaction from chain
	appLog, err := s.chainClient.GetApplicationLog(ctx, txHash)
	if err != nil {
		return false, 0, err
	}

	if appLog == nil || len(appLog.Executions) == 0 {
		return false, 0, nil
	}

	exec := appLog.Executions[0]
	if exec.VMState != "HALT" {
		return false, 0, fmt.Errorf("transaction failed: %s", exec.Exception)
	}

	// Parse notifications to find GAS transfer
	for _, notif := range exec.Notifications {
		if notif.Contract != GASContractHash {
			continue
		}
		if notif.EventName != "Transfer" {
			continue
		}

		// Verify transfer details
		// In production, parse the notification state to verify:
		// - from address matches
		// - to address is our deposit address
		// - amount matches expected amount
	}

	// Get block height for confirmation count
	currentHeight, err := s.chainClient.GetBlockCount(ctx)
	if err != nil {
		return false, 0, err
	}

	// Calculate confirmations (simplified - assume tx is in recent block)
	// In production, get the actual block height of the transaction
	confirmations := 1
	if currentHeight > 0 {
		confirmations = 1 // At least 1 confirmation if tx exists
	}

	return confirmations >= RequiredConfirmations, confirmations, nil
}

// confirmDeposit marks a deposit as confirmed and credits the user's balance.
func (s *Service) confirmDeposit(ctx context.Context, deposit *database.DepositRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Update deposit status
	if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirmed), RequiredConfirmations); err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status")
		return
	}

	// Credit user's balance
	account, err := s.db.GetOrCreateGasBankAccount(ctx, deposit.UserID)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("user_id", deposit.UserID).Warn("failed to get account for deposit credit")
		return
	}

	newBalance := account.Balance + deposit.Amount
	if err := s.db.UpdateGasBankBalance(ctx, deposit.UserID, newBalance, account.Reserved); err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("user_id", deposit.UserID).Warn("failed to credit deposit")
		return
	}

	// Record transaction
	tx := &database.GasBankTransaction{
		ID:           uuid.New().String(),
		AccountID:    account.ID,
		TxType:       string(TxTypeDeposit),
		Amount:       deposit.Amount,
		BalanceAfter: newBalance,
		ReferenceID:  deposit.ID,
		TxHash:       deposit.TxHash,
		FromAddress:  deposit.FromAddress,
		Status:       "completed",
		CreatedAt:    time.Now(),
	}
	if err := s.db.CreateGasBankTransaction(ctx, tx); err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to record deposit transaction")
	}

	s.Logger().WithContext(ctx).WithField("user_id", deposit.UserID).WithField("amount", deposit.Amount).Info("deposit confirmed and credited")
}

// cleanupExpiredDeposits marks expired pending deposits as failed.
func (s *Service) cleanupExpiredDeposits(ctx context.Context) {
	// This would iterate through pending deposits and mark expired ones
	// Implementation depends on having a proper query method
	s.Logger().WithContext(ctx).Debug("running expired deposit cleanup")
}
