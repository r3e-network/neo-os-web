// Package neogasbank provides GasBank service for managing user gas balances.
// This service implements:
// - Deposit verification (monitors chain for confirmed deposits)
// - Balance management (credit/debit operations)
// - Service fee deduction (called by other TEE services)
// - Transaction history tracking
package neogasbank

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/crypto"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
	commonservice "github.com/R3E-Network/neo-miniapps-platform/infrastructure/service"
)

const (
	ServiceID   = "neogasbank"
	ServiceName = "NeoGasBank Service"
	Version     = "1.0.0"

	// Deposit verification settings
	// SECURITY FIX [M-03]: Dynamic confirmation requirements based on amount
	MinRequiredConfirmations = 1             // For small amounts (< 100 GAS)
	MedRequiredConfirmations = 3             // For medium amounts (100-1000 GAS)
	MaxRequiredConfirmations = 6             // For large amounts (> 1000 GAS)
	MediumAmountThreshold    = 100_00000000  // 100 GAS in smallest unit
	LargeAmountThreshold     = 1000_00000000 // 1000 GAS in smallest unit

	DepositCheckInterval     = 15 * time.Second
	DepositExpirationTime    = 24 * time.Hour
	MaxPendingDepositsPerRun = 100

	// GAS contract address on Neo N3
	GASContractAddress = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
)

// getRequiredConfirmations returns the number of confirmations required based on deposit amount.
// SECURITY FIX [M-03]: Larger deposits require more confirmations to protect against reorg attacks.
func getRequiredConfirmations(amount int64) int {
	if amount >= LargeAmountThreshold {
		return MaxRequiredConfirmations
	} else if amount >= MediumAmountThreshold {
		return MedRequiredConfirmations
	}
	return MinRequiredConfirmations
}

var errDepositMismatch = errors.New("deposit transaction does not match request")

type DepositMismatchError struct {
	FromAddress    string
	ToAddress      string
	ExpectedAmount int64
	ActualAmount   int64
}

func (e *DepositMismatchError) Error() string {
	return fmt.Sprintf("deposit transaction does not match request: from=%s, to=%s, expected=%d, actual=%d",
		e.FromAddress, e.ToAddress, e.ExpectedAmount, e.ActualAmount)
}

func (e *DepositMismatchError) Unwrap() error {
	return errDepositMismatch
}

// Service implements the NeoGasBank service.
type Service struct {
	*commonservice.BaseService
	// SECURITY FIX [M-01]: Replace global mutex with per-user locks for better concurrency.
	// Global lock is kept for operations that need cross-user consistency (e.g., deposit confirmation).
	mu sync.RWMutex
	// userLocks provides fine-grained locking per user to improve concurrent performance.
	// Different users' operations can now execute in parallel.
	userLocks sync.Map // map[string]*sync.Mutex

	chainClient *chain.Client
	db          database.RepositoryInterface

	depositAddress string
}

// getUserLock returns a per-user mutex for fine-grained locking.
// This allows concurrent operations on different users while maintaining
// consistency for operations on the same user.
func (s *Service) getUserLock(userID string) *sync.Mutex {
	lock, _ := s.userLocks.LoadOrStore(userID, &sync.Mutex{})
	mutex, ok := lock.(*sync.Mutex)
	if !ok {
		return nil
	}
	return mutex
}

// Config holds NeoGasBank service configuration.
type Config struct {
	Marble         *marble.Marble
	DB             database.RepositoryInterface
	ChainClient    *chain.Client
	DepositAddress string
}

// New creates a new NeoGasBank service.
func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neogasbank: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()
	requireDepositAddress := runtime.IsProduction() || strict

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

	depositAddress := strings.TrimSpace(cfg.DepositAddress)
	if depositAddress == "" {
		depositAddress = strings.TrimSpace(os.Getenv("GASBANK_DEPOSIT_ADDRESS"))
	}
	if requireDepositAddress && depositAddress == "" {
		return nil, fmt.Errorf("neogasbank: GASBANK_DEPOSIT_ADDRESS is required in production")
	}
	if depositAddress == "" {
		base.Logger().WithFields(nil).Warn("GASBANK_DEPOSIT_ADDRESS not configured; deposits will only validate sender and amount")
	}

	s := &Service{
		BaseService:    base,
		chainClient:    cfg.ChainClient,
		db:             cfg.DB,
		depositAddress: depositAddress,
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

		// Register auto top-up worker (runs every 5 minutes)
		base.AddTickerWorker(TopUpCheckInterval, func(ctx context.Context) error {
			s.processAutoTopUp(ctx)
			return nil
		}, commonservice.WithTickerWorkerName("auto-topup"))
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
		"deposit_check_interval": DepositCheckInterval.String(),
		// SECURITY FIX [M-03]: Show dynamic confirmation requirements
		"min_required_confirmations": MinRequiredConfirmations,
		"med_required_confirmations": MedRequiredConfirmations,
		"max_required_confirmations": MaxRequiredConfirmations,
		"deposit_expiration_time":    DepositExpirationTime.String(),
		"chain_connected":            s.chainClient != nil,
		"deposit_address_configured": s.depositAddress != "",
		"topup_enabled":              s.isAutoTopUpEnabled(),
		"topup_check_interval":       TopUpCheckInterval.String(),
		"topup_threshold":            TopUpThreshold,
		"topup_target_amount":        TopUpTargetAmount,
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

	// SECURITY FIX [M-01]: Use per-user lock instead of global lock for better concurrency
	userLock := s.getUserLock(req.UserID)
	userLock.Lock()
	defer userLock.Unlock()

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

	// SECURITY FIX [C-01]: Use atomic deduction to ensure balance update and transaction
	// record are committed together, preventing inconsistent state.
	txID := uuid.New().String()
	tx := &database.GasBankTransaction{
		ID:          txID,
		AccountID:   account.ID,
		TxType:      string(TxTypeServiceFee),
		Amount:      -req.Amount,
		ReferenceID: req.ReferenceID,
		Status:      "completed",
		CreatedAt:   time.Now(),
	}

	newBalance, err := s.db.DeductFeeAtomic(ctx, req.UserID, req.Amount, tx)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).Error("atomic fee deduction failed")
		return &DeductFeeResponse{Success: false, Error: fmt.Sprintf("deduct fee: %v", err)}, nil
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

	// SECURITY FIX [M-01]: Use per-user lock instead of global lock
	userLock := s.getUserLock(req.UserID)
	userLock.Lock()
	defer userLock.Unlock()

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

	// SECURITY FIX [M-01]: Use per-user lock instead of global lock
	userLock := s.getUserLock(req.UserID)
	userLock.Lock()
	defer userLock.Unlock()

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

	// Get all pending deposits
	deposits, err := s.getPendingDeposits(ctx)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to get pending deposits")
		return
	}

	now := time.Now()
	for _, deposit := range deposits {
		if !deposit.ExpiresAt.IsZero() && now.After(deposit.ExpiresAt) {
			if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusExpired), deposit.Confirmations); err != nil {
				s.Logger().WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update expired deposit status")
			}
			continue
		}

		if deposit.TxHash == "" {
			continue
		}

		// Check transaction on chain
		confirmed, confirmations, err := s.verifyTransaction(ctx, deposit.TxHash, deposit.FromAddress, deposit.Amount)
		if err != nil {
			if errors.Is(err, errDepositMismatch) {
				if updateErr := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusFailed), confirmations); updateErr != nil {
					s.Logger().WithError(updateErr).WithField("deposit_id", deposit.ID).Warn("failed to update failed deposit status")
				}
				continue
			}
			s.Logger().WithContext(ctx).WithError(err).WithField("tx_hash", deposit.TxHash).Debug("failed to verify transaction")
			continue
		}

		if confirmed {
			s.confirmDeposit(ctx, &deposit)
		} else if confirmations > 0 {
			// Update confirmation count
			if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirming), confirmations); err != nil {
				s.Logger().WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update confirming deposit status")
			}
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
// Returns: isConfirmed (bool), confirmations (int), error
func (s *Service) verifyTransaction(ctx context.Context, txHash, fromAddress string, expectedAmount int64) (isConfirmed bool, confirmations int, err error) {
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
		return false, 0, fmt.Errorf("%w: transaction failed: %s", errDepositMismatch, exec.Exception)
	}

	match, matchOK := s.matchGasTransfer(exec.Notifications, fromAddress, expectedAmount)
	if !matchOK {
		if match != nil {
			return false, 0, match
		}
		return false, 0, errDepositMismatch
	}

	confirmations, callErr := s.getTransactionConfirmations(ctx, txHash)
	if callErr != nil {
		return false, 0, callErr
	}

	// SECURITY FIX [M-03]: Use dynamic confirmation requirements based on amount
	requiredConfirmations := getRequiredConfirmations(expectedAmount)
	return confirmations >= requiredConfirmations, confirmations, nil
}

func (s *Service) matchGasTransfer(notifications []chain.Notification, fromAddress string, expectedAmount int64) (*DepositMismatchError, bool) {
	expected := big.NewInt(expectedAmount)
	fromAddress = strings.TrimSpace(fromAddress)
	depositAddress := strings.TrimSpace(s.depositAddress)

	for _, notif := range notifications {
		if !strings.EqualFold(notif.Contract, GASContractAddress) {
			continue
		}

		items, err := chain.ParseArray(notif.State)
		if err != nil || len(items) < 3 {
			continue
		}

		fromBytes, err := chain.ParseByteArray(items[0])
		if err != nil {
			continue
		}
		toBytes, err := chain.ParseByteArray(items[1])
		if err != nil {
			continue
		}

		amount, err := chain.ParseInteger(items[2])
		if err != nil || amount == nil {
			continue
		}

		fromCandidate := addressFromScriptHash(fromBytes)
		toCandidate := addressFromScriptHash(toBytes)

		if amount.Cmp(expected) != 0 {
			return &DepositMismatchError{
				FromAddress:    fromCandidate,
				ToAddress:      toCandidate,
				ExpectedAmount: expectedAmount,
				ActualAmount:   amount.Int64(),
			}, false
		}

		if fromAddress != "" && fromCandidate != fromAddress {
			return &DepositMismatchError{
				FromAddress:    fromCandidate,
				ToAddress:      toCandidate,
				ExpectedAmount: expectedAmount,
				ActualAmount:   amount.Int64(),
			}, false
		}

		if depositAddress != "" && toCandidate != depositAddress {
			return &DepositMismatchError{
				FromAddress:    fromCandidate,
				ToAddress:      toCandidate,
				ExpectedAmount: expectedAmount,
				ActualAmount:   amount.Int64(),
			}, false
		}

		if depositAddress == "" && toCandidate != "" {
			s.Logger().WithField("to_address", toCandidate).Warn("deposit to unexpected address; deposit_address not configured")
		}

		return nil, true
	}

	return &DepositMismatchError{
		FromAddress:    "",
		ToAddress:      "",
		ExpectedAmount: expectedAmount,
		ActualAmount:   0,
	}, false
}

func (s *Service) getTransactionConfirmations(ctx context.Context, txHash string) (int, error) {
	if s.chainClient == nil {
		return 0, fmt.Errorf("chain client not configured")
	}

	result, err := s.chainClient.Call(ctx, "getrawtransaction", []interface{}{txHash, true})
	if err != nil {
		return 0, err
	}

	var meta struct {
		Confirmations int    `json:"confirmations"`
		BlockHash     string `json:"blockhash"`
	}
	if unmarshalErr := json.Unmarshal(result, &meta); unmarshalErr != nil {
		return 0, unmarshalErr
	}
	if meta.Confirmations > 0 {
		return meta.Confirmations, nil
	}
	if meta.BlockHash == "" {
		return meta.Confirmations, nil
	}

	block, err := s.chainClient.GetBlock(ctx, meta.BlockHash)
	if err != nil {
		return meta.Confirmations, nil
	}
	currentHeight, err := s.chainClient.GetBlockCount(ctx)
	if err != nil {
		return meta.Confirmations, nil
	}
	if currentHeight <= block.Index {
		return 0, nil
	}
	diff := currentHeight - block.Index
	if diff > math.MaxInt {
		return math.MaxInt, nil
	}
	return int(diff), nil
}

func addressFromScriptHash(hash []byte) string {
	if len(hash) != 20 {
		return ""
	}
	return crypto.ScriptHashToAddress(hash)
}

// confirmDeposit marks a deposit as confirmed and credits the user's balance.
// Uses atomic database operation to ensure consistency between balance update and transaction record.
func (s *Service) confirmDeposit(ctx context.Context, deposit *database.DepositRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for idempotency - skip if already processed
	if s.depositTransactionExists(ctx, deposit.UserID, deposit.ID) {
		// SECURITY FIX [M-03]: Use dynamic confirmation requirements
		requiredConf := getRequiredConfirmations(deposit.Amount)
		if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirmed), requiredConf); err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status")
		}
		return
	}

	// Prepare transaction record
	tx := &database.GasBankTransaction{
		ID:          uuid.New().String(),
		TxType:      string(TxTypeDeposit),
		Amount:      deposit.Amount,
		ReferenceID: deposit.ID,
		TxHash:      deposit.TxHash,
		FromAddress: deposit.FromAddress,
		Status:      "completed",
		CreatedAt:   time.Now(),
	}

	// Use atomic operation to credit balance and record transaction
	newBalance, err := s.db.ConfirmDepositAtomic(ctx, deposit.UserID, deposit.Amount, tx)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("user_id", deposit.UserID).
			WithField("deposit_id", deposit.ID).Warn("failed to confirm deposit atomically")
		return
	}

	// Set account ID after atomic operation
	tx.AccountID = deposit.UserID

	// SECURITY FIX [M-03]: Use dynamic confirmation requirements
	requiredConf := getRequiredConfirmations(deposit.Amount)
	if statusErr := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirmed), requiredConf); statusErr != nil {
		s.Logger().WithContext(ctx).WithError(statusErr).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status")
	}

	s.Logger().WithContext(ctx).WithField("user_id", deposit.UserID).
		WithField("amount", deposit.Amount).
		WithField("new_balance", newBalance).Info("deposit confirmed and credited atomically")
}

func (s *Service) depositTransactionExists(ctx context.Context, accountID, depositID string) bool {
	if s.db == nil || strings.TrimSpace(accountID) == "" || strings.TrimSpace(depositID) == "" {
		return false
	}

	txs, err := s.db.GetGasBankTransactions(ctx, accountID, 1000)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
			"account_id": accountID,
			"deposit_id": depositID,
		}).Warn("failed to query deposit transactions for idempotency")
		return false
	}

	for _, tx := range txs {
		if tx.ReferenceID == depositID && tx.TxType == string(TxTypeDeposit) {
			return true
		}
	}

	return false
}

// cleanupExpiredDeposits marks expired pending deposits as expired.
func (s *Service) cleanupExpiredDeposits(ctx context.Context) {
	if s.db == nil {
		return
	}

	deposits, err := s.getPendingDeposits(ctx)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to get pending deposits for cleanup")
		return
	}

	now := time.Now()
	for _, deposit := range deposits {
		if deposit.ExpiresAt.IsZero() || now.Before(deposit.ExpiresAt) {
			continue
		}
		if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusExpired), deposit.Confirmations); err != nil {
			s.Logger().WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update expired deposit status in cleanup")
		}
	}
}
