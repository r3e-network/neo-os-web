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
	"math/big"
	"os"
	"strings"
	"sync"
	"time"

	neoaccountsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/client"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
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

var errDepositMismatch = errors.New("deposit transaction does not match request")

// Service implements the NeoGasBank service.
type Service struct {
	*commonservice.BaseService

	chainClient *chain.Client
	db          database.RepositoryInterface

	depositAddress string

	// Lazy-initialized account pool client (reused across top-up calls)
	poolClientMu sync.Mutex
	poolClient   *neoaccountsclient.Client
}

// Config holds NeoGasBank service configuration.
type Config struct {
	Nitro          *nitro.Nitro
	DB             database.RepositoryInterface
	ChainClient    *chain.Client
	DepositAddress string
}

// New creates a new NeoGasBank service.
func New(cfg Config) (*Service, error) {
	if cfg.Nitro == nil {
		return nil, fmt.Errorf("neogasbank: nitro is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Nitro.IsEnclave()
	requireDepositAddress := runtime.IsProduction()

	if strict && cfg.ChainClient == nil {
		return nil, fmt.Errorf("neogasbank: chain client is required in strict/enclave mode")
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Nitro:   cfg.Nitro,
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
		"deposit_check_interval":     DepositCheckInterval.String(),
		"required_confirmations":     RequiredConfirmations,
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
		Available: max(0, account.Balance-account.Reserved),
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

	result, err := s.db.DeductFeeAtomic(ctx, req.UserID, req.Amount, req.ServiceID, req.ReferenceID)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("user_id", req.UserID).Error("atomic deduct failed")
		return &DeductFeeResponse{Success: false, Error: "fee deduction failed"}, nil
	}

	if !result.Success {
		return &DeductFeeResponse{
			Success:      false,
			BalanceAfter: result.NewBalance,
			Error:        result.Error,
		}, nil
	}

	return &DeductFeeResponse{
		Success:       true,
		TransactionID: result.TransactionID,
		BalanceAfter:  result.NewBalance,
	}, nil
}

// ReserveFunds reserves funds for a pending operation.
func (s *Service) ReserveFunds(ctx context.Context, req *ReserveFundsRequest) (*ReserveFundsResponse, error) {
	if req.UserID == "" {
		return &ReserveFundsResponse{Success: false, Error: "user_id is required"}, nil
	}
	if req.Amount <= 0 {
		return &ReserveFundsResponse{Success: false, Error: "amount must be positive"}, nil
	}

	result, err := s.db.ReserveFundsAtomic(ctx, req.UserID, req.Amount)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("user_id", req.UserID).Error("atomic reserve failed")
		return &ReserveFundsResponse{Success: false}, nil
	}

	if !result.Success {
		return &ReserveFundsResponse{Success: false, BalanceAfter: result.NewBalance}, nil
	}

	return &ReserveFundsResponse{
		Success:      true,
		Reserved:     result.NewReserved,
		BalanceAfter: result.NewBalance,
	}, nil
}

// ReleaseFunds releases or commits reserved funds.
func (s *Service) ReleaseFunds(ctx context.Context, req *ReleaseFundsRequest) (*ReleaseFundsResponse, error) {
	if req.UserID == "" {
		return &ReleaseFundsResponse{Success: false, Error: "user_id is required"}, nil
	}
	if req.Amount <= 0 {
		return &ReleaseFundsResponse{Success: false, Error: "amount must be positive"}, nil
	}

	result, err := s.db.ReleaseFundsAtomic(ctx, req.UserID, req.Amount, req.Commit)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("user_id", req.UserID).Error("atomic release failed")
		return &ReleaseFundsResponse{Success: false}, nil
	}

	if !result.Success {
		return &ReleaseFundsResponse{Success: false, BalanceAfter: result.NewBalance}, nil
	}

	return &ReleaseFundsResponse{
		Success:      true,
		BalanceAfter: result.NewBalance,
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
	for i := range deposits {
		deposit := &deposits[i]
		if !deposit.ExpiresAt.IsZero() && now.After(deposit.ExpiresAt) {
			if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusExpired), deposit.Confirmations); err != nil {
				s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status")
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
					s.Logger().WithContext(ctx).WithError(updateErr).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status")
				}
				continue
			}
			s.Logger().WithContext(ctx).WithError(err).WithField("tx_hash", deposit.TxHash).Warn("failed to verify transaction")
			continue
		}

		if confirmed {
			s.confirmDeposit(ctx, deposit)
		} else if confirmations > 0 {
			// Update confirmation count
			if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirming), confirmations); err != nil {
				s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status")
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
func (s *Service) verifyTransaction(ctx context.Context, txHash, fromAddress string, expectedAmount int64) (confirmed bool, confirmations int, err error) {
	if s.chainClient == nil {
		return false, 0, fmt.Errorf("chain client not configured")
	}
	if expectedAmount <= 0 {
		return false, 0, fmt.Errorf("invalid expected amount: %d", expectedAmount)
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

	match, err := s.matchGasTransfer(exec.Notifications, fromAddress, expectedAmount)
	if err != nil {
		return false, 0, err
	}
	if !match {
		return false, 0, errDepositMismatch
	}

	confirmations, err = s.getTransactionConfirmations(ctx, txHash)
	if err != nil {
		return false, 0, err
	}

	return confirmations >= RequiredConfirmations, confirmations, nil
}

func (s *Service) matchGasTransfer(notifications []chain.Notification, fromAddress string, expectedAmount int64) (bool, error) {
	expected := big.NewInt(expectedAmount)
	fromAddress = strings.TrimSpace(fromAddress)
	depositAddress := strings.TrimSpace(s.depositAddress)
	if depositAddress == "" {
		return false, fmt.Errorf("deposit address not configured")
	}

	for _, notif := range notifications {
		if !strings.EqualFold(notif.Contract, GASContractHash) {
			continue
		}
		if notif.EventName != "Transfer" {
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
		if amount.Cmp(expected) != 0 {
			continue
		}

		fromCandidate := addressFromScriptHash(fromBytes)
		toCandidate := addressFromScriptHash(toBytes)
		if fromAddress != "" && fromCandidate != fromAddress {
			continue
		}
		if depositAddress != "" && toCandidate != depositAddress {
			continue
		}

		return true, nil
	}

	return false, nil
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
		return 0, fmt.Errorf("failed to compute confirmations: %w", err)
	}
	currentHeight, err := s.chainClient.GetBlockCount(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to compute confirmations: %w", err)
	}
	if currentHeight <= block.Index {
		return 0, nil
	}
	confirmations := currentHeight - block.Index
	maxIntUint64 := uint64(^uint(0) >> 1)
	if confirmations > maxIntUint64 {
		// #nosec G115 -- bounded to platform int max above.
		return int(maxIntUint64), nil
	}
	// #nosec G115 -- bounded by maxIntUint64 check above.
	return int(confirmations), nil
}

func addressFromScriptHash(hash []byte) string {
	if len(hash) != 20 {
		return ""
	}
	return crypto.ScriptHashToAddress(hash)
}

// confirmDeposit marks a deposit as confirmed and credits the user's balance.
func (s *Service) confirmDeposit(ctx context.Context, deposit *database.DepositRequest) {
	result, err := s.db.CreditDepositAtomic(ctx, deposit.UserID, deposit.Amount, deposit.TxHash, deposit.FromAddress, deposit.ID)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("user_id", deposit.UserID).Warn("failed to credit deposit atomically")
		return
	}

	if !result.Success {
		if result.Error == "already credited" {
			// Idempotent success — mark as completed to stop retries
			if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirmed), RequiredConfirmations); err != nil {
				s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update already-credited deposit status")
			}
			s.Logger().WithContext(ctx).WithField("deposit_id", deposit.ID).Debug("deposit already credited, marked as confirmed")
			return
		}
		// Permanent failure — mark as failed to stop retries
		if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusFailed), deposit.Confirmations); err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status to failed")
		}
		s.Logger().WithContext(ctx).WithField("user_id", deposit.UserID).WithField("error", result.Error).Warn("atomic deposit credit failed permanently")
		return
	}

	if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusConfirmed), RequiredConfirmations); err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Error("failed to update deposit status to confirmed")
		return
	}

	s.Logger().WithContext(ctx).WithField("user_id", deposit.UserID).WithField("amount", deposit.Amount).Info("deposit confirmed and credited")
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
	for i := range deposits {
		deposit := &deposits[i]
		if deposit.ExpiresAt.IsZero() || now.Before(deposit.ExpiresAt) {
			continue
		}
		if err := s.db.UpdateDepositStatus(ctx, deposit.ID, string(DepositStatusExpired), deposit.Confirmations); err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithField("deposit_id", deposit.ID).Warn("failed to update deposit status")
		}
	}
}
