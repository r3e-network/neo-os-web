package gasbank

import (
	"context"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	coreGasBank "github.com/R3E-Network/service_layer/internal/core/gasbank"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// Service provides Gas Bank functionality
type Service struct {
	config           *config.Config
	repository       models.GasBankRepository
	blockchainClient blockchain.Client
	teeManager       *tee.Manager
	wrapper          *Wrapper
}

// NewService creates a new Gas Bank service
func NewService(
	config *config.Config,
	repository models.GasBankRepository,
	blockchainClient blockchain.Client,
	teeManager *tee.Manager,
) (*Service, error) {
	// Create a logger for the core service
	log := logger.New("gasbank")

	// Create core service with the correct parameter order
	coreService := coreGasBank.NewService(
		config,            // Config
		log,               // Logger
		repository,        // Repository
		&blockchainClient, // Blockchain Client
	)

	// Create wrapper
	wrapper := NewWrapper(coreService)

	return &Service{
		config:           config,
		repository:       repository,
		blockchainClient: blockchainClient,
		teeManager:       teeManager,
		wrapper:          wrapper,
	}, nil
}

// CreateAccount creates a new gas bank account for a user
func (s *Service) CreateAccount(ctx context.Context, userID string, walletAddress string) (*models.GasBankAccount, error) {
	return s.wrapper.CreateAccount(ctx, userID, walletAddress)
}

// GetAccount gets an account by ID
func (s *Service) GetAccount(ctx context.Context, id string) (*models.GasBankAccount, error) {
	return s.wrapper.GetAccount(ctx, id)
}

// GetAccountByUserID gets an account by user ID
func (s *Service) GetAccountByUserID(ctx context.Context, userID string) (*models.GasBankAccount, error) {
	return s.wrapper.GetAccountByUserID(ctx, userID)
}

// GetAccountByWalletAddress gets an account by wallet address
func (s *Service) GetAccountByWalletAddress(ctx context.Context, walletAddress string) (*models.GasBankAccount, error) {
	return s.wrapper.GetAccountByWalletAddress(ctx, walletAddress)
}

// ListAccounts lists all accounts
func (s *Service) ListAccounts(ctx context.Context) ([]*models.GasBankAccount, error) {
	return s.wrapper.ListAccounts(ctx)
}

// GetBalance gets the balance of an account
func (s *Service) GetBalance(ctx context.Context, accountID string) (string, error) {
	return s.wrapper.GetBalance(ctx, accountID)
}

// GetAvailableBalance gets the available balance of an account
func (s *Service) GetAvailableBalance(ctx context.Context, accountID string) (string, error) {
	return s.wrapper.GetAvailableBalance(ctx, accountID)
}

// ProcessDeposit processes a deposit to an account
func (s *Service) ProcessDeposit(ctx context.Context, fromAddress string, toAddress string, amount string, blockchainTxID string, blockHeight uint32) (*models.GasBankTransaction, error) {
	return s.wrapper.ProcessDeposit(ctx, fromAddress, toAddress, amount, blockchainTxID, blockHeight)
}

// RequestWithdrawal requests a withdrawal from an account
func (s *Service) RequestWithdrawal(ctx context.Context, userID string, amount string, toAddress string) (*models.WithdrawalRequest, error) {
	return s.wrapper.RequestWithdrawal(ctx, userID, amount, toAddress)
}

// ProcessWithdrawalRequest processes a withdrawal request
func (s *Service) ProcessWithdrawalRequest(ctx context.Context, requestID string) (*models.GasBankTransaction, error) {
	return s.wrapper.ProcessWithdrawalRequest(ctx, requestID)
}

// CancelWithdrawalRequest cancels a withdrawal request
func (s *Service) CancelWithdrawalRequest(ctx context.Context, requestID string) error {
	return s.wrapper.CancelWithdrawalRequest(ctx, requestID)
}

// DeductFee deducts a fee from an account
func (s *Service) DeductFee(ctx context.Context, userID string, amount string, notes string) (*models.GasBankTransaction, error) {
	return s.wrapper.DeductFee(ctx, userID, amount, notes)
}

// GetTransaction gets a transaction by ID
func (s *Service) GetTransaction(ctx context.Context, id string) (*models.GasBankTransaction, error) {
	return s.wrapper.GetTransaction(ctx, id)
}

// ListTransactionsByUserID lists transactions for a user
func (s *Service) ListTransactionsByUserID(ctx context.Context, userID string, limit int, offset int) ([]*models.GasBankTransaction, error) {
	return s.wrapper.ListTransactionsByUserID(ctx, userID, limit, offset)
}

// ListTransactionsByAccountID lists transactions for an account
func (s *Service) ListTransactionsByAccountID(ctx context.Context, accountID string, limit int, offset int) ([]*models.GasBankTransaction, error) {
	return s.wrapper.ListTransactionsByAccountID(ctx, accountID, limit, offset)
}

// GetWithdrawalRequest gets a withdrawal request by ID
func (s *Service) GetWithdrawalRequest(ctx context.Context, id string) (*models.WithdrawalRequest, error) {
	return s.wrapper.GetWithdrawalRequest(ctx, id)
}

// ListWithdrawalRequestsByUserID lists withdrawal requests for a user
func (s *Service) ListWithdrawalRequestsByUserID(ctx context.Context, userID string, limit int, offset int) ([]*models.WithdrawalRequest, error) {
	return s.wrapper.ListWithdrawalRequestsByUserID(ctx, userID, limit, offset)
}

// Start starts the gas bank service
func (s *Service) Start(ctx context.Context) error {
	return s.wrapper.Start(ctx)
}

// Stop stops the gas bank service
func (s *Service) Stop(ctx context.Context) error {
	return s.wrapper.Stop(ctx)
}
