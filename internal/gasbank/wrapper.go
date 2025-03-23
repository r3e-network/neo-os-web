package gasbank

import (
	"context"

	"github.com/R3E-Network/service_layer/internal/core/gasbank"
	"github.com/R3E-Network/service_layer/internal/models"
)

// Wrapper implements the models.GasBankService interface by delegating to the core implementation
type Wrapper struct {
	coreService *gasbank.Service
}

// NewWrapper creates a new wrapper around the core gasbank service
func NewWrapper(coreService *gasbank.Service) *Wrapper {
	return &Wrapper{
		coreService: coreService,
	}
}

// CreateAccount creates a new gas bank account
func (w *Wrapper) CreateAccount(ctx context.Context, userID string, walletAddress string) (*models.GasBankAccount, error) {
	return w.coreService.CreateAccount(userID, walletAddress)
}

// GetAccount gets a gas bank account by ID
func (w *Wrapper) GetAccount(ctx context.Context, id string) (*models.GasBankAccount, error) {
	return w.coreService.GetAccount(id)
}

// GetAccountByUserID gets a gas bank account by user ID
func (w *Wrapper) GetAccountByUserID(ctx context.Context, userID string) (*models.GasBankAccount, error) {
	return w.coreService.GetAccountByUserID(userID)
}

// GetAccountByWalletAddress gets a gas bank account by wallet address
func (w *Wrapper) GetAccountByWalletAddress(ctx context.Context, walletAddress string) (*models.GasBankAccount, error) {
	return w.coreService.GetAccountByWalletAddress(walletAddress)
}

// ListAccounts lists all gas bank accounts
func (w *Wrapper) ListAccounts(ctx context.Context) ([]*models.GasBankAccount, error) {
	return w.coreService.ListAccounts()
}

// GetBalance gets the balance of a gas bank account
func (w *Wrapper) GetBalance(ctx context.Context, accountID string) (string, error) {
	return w.coreService.GetBalance(accountID)
}

// GetAvailableBalance gets the available balance of a gas bank account
func (w *Wrapper) GetAvailableBalance(ctx context.Context, accountID string) (string, error) {
	return w.coreService.GetAvailableBalance(accountID)
}

// ProcessDeposit processes a deposit to a gas bank account
func (w *Wrapper) ProcessDeposit(ctx context.Context, fromAddress string, toAddress string, amount string, blockchainTxID string, blockHeight uint32) (*models.GasBankTransaction, error) {
	return w.coreService.ProcessDeposit(fromAddress, toAddress, amount, blockchainTxID, blockHeight)
}

// RequestWithdrawal requests a withdrawal from a gas bank account
func (w *Wrapper) RequestWithdrawal(ctx context.Context, userID string, amount string, toAddress string) (*models.WithdrawalRequest, error) {
	return w.coreService.RequestWithdrawal(userID, amount, toAddress)
}

// ProcessWithdrawalRequest processes a withdrawal request
func (w *Wrapper) ProcessWithdrawalRequest(ctx context.Context, requestID string) (*models.GasBankTransaction, error) {
	return w.coreService.ProcessWithdrawalRequest(requestID)
}

// CancelWithdrawalRequest cancels a withdrawal request
func (w *Wrapper) CancelWithdrawalRequest(ctx context.Context, requestID string) error {
	return w.coreService.CancelWithdrawalRequest(requestID)
}

// DeductFee deducts a fee from a gas bank account
func (w *Wrapper) DeductFee(ctx context.Context, userID string, amount string, notes string) (*models.GasBankTransaction, error) {
	return w.coreService.DeductFee(userID, amount, notes)
}

// GetTransaction gets a gas bank transaction by ID
func (w *Wrapper) GetTransaction(ctx context.Context, id string) (*models.GasBankTransaction, error) {
	return w.coreService.GetTransaction(id)
}

// ListTransactionsByUserID lists transactions for a user
func (w *Wrapper) ListTransactionsByUserID(ctx context.Context, userID string, limit int, offset int) ([]*models.GasBankTransaction, error) {
	return w.coreService.ListTransactionsByUserID(userID, limit, offset)
}

// ListTransactionsByAccountID lists transactions for an account
func (w *Wrapper) ListTransactionsByAccountID(ctx context.Context, accountID string, limit int, offset int) ([]*models.GasBankTransaction, error) {
	return w.coreService.ListTransactionsByAccountID(accountID, limit, offset)
}

// GetWithdrawalRequest gets a withdrawal request by ID
func (w *Wrapper) GetWithdrawalRequest(ctx context.Context, id string) (*models.WithdrawalRequest, error) {
	return w.coreService.GetWithdrawalRequest(id)
}

// ListWithdrawalRequestsByUserID lists withdrawal requests for a user
func (w *Wrapper) ListWithdrawalRequestsByUserID(ctx context.Context, userID string, limit int, offset int) ([]*models.WithdrawalRequest, error) {
	return w.coreService.ListWithdrawalRequestsByUserID(userID, limit, offset)
}

// Start starts the gas bank service
func (w *Wrapper) Start(ctx context.Context) error {
	return w.coreService.Start()
}

// Stop stops the gas bank service
func (w *Wrapper) Stop(ctx context.Context) error {
	w.coreService.Stop()
	return nil
}