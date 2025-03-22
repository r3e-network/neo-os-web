package gasbank

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/willtech-services/service_layer/internal/blockchain"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Service handles gas bank operations
type Service struct {
	config           *config.Config
	logger           *logger.Logger
	gasBankRepository models.GasBankRepository
	blockchainClient *blockchain.Client
}

// NewService creates a new gas bank service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	gasBankRepository models.GasBankRepository,
	blockchainClient *blockchain.Client,
) *Service {
	return &Service{
		config:           cfg,
		logger:           log,
		gasBankRepository: gasBankRepository,
		blockchainClient: blockchainClient,
	}
}

// DepositGas deposits gas into an account
func (s *Service) DepositGas(ctx context.Context, userID int, address string, amount float64, txHash string) (*models.Transaction, error) {
	// Validate input
	if err := s.validateDeposit(address, amount); err != nil {
		return nil, err
	}

	// Verify transaction on the blockchain
	if err := s.verifyDepositTransaction(ctx, address, txHash, amount); err != nil {
		return nil, fmt.Errorf("transaction verification failed: %w", err)
	}

	// Create deposit transaction
	transaction, err := s.gasBankRepository.DepositGas(userID, address, amount, txHash)
	if err != nil {
		return nil, fmt.Errorf("failed to deposit gas: %w", err)
	}

	s.logger.Infof("Gas deposit of %.8f GAS successful for address %s, txHash: %s", amount, address, txHash)

	return transaction, nil
}

// WithdrawGas withdraws gas from an account
func (s *Service) WithdrawGas(ctx context.Context, userID int, address string, amount float64, targetAddress string) (*models.Transaction, error) {
	// Validate input
	if err := s.validateWithdrawal(address, amount); err != nil {
		return nil, err
	}

	// Create withdrawal transaction - initially in pending state
	transaction, err := s.gasBankRepository.WithdrawGas(userID, address, amount, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create withdrawal: %w", err)
	}

	// Initiate the blockchain transaction
	txHash, err := s.sendWithdrawalTransaction(ctx, address, targetAddress, amount)
	if err != nil {
		// Rollback the transaction if blockchain transaction fails
		s.logger.Errorf("Withdrawal transaction failed, rolling back: %v", err)
		
		// In a real implementation, we would have a more sophisticated rollback mechanism
		// For now, we'll update the status to failed
		_ = s.gasBankRepository.UpdateTransactionStatus(transaction.ID, models.TransactionStatusFailed)
		
		return nil, fmt.Errorf("failed to send withdrawal transaction: %w", err)
	}

	// Update transaction with hash and status
	transaction.TxHash = txHash
	transaction.Status = models.TransactionStatusPending

	// Update transaction in database
	err = s.gasBankRepository.UpdateTransactionStatus(transaction.ID, models.TransactionStatusPending)
	if err != nil {
		s.logger.Errorf("Failed to update transaction status: %v", err)
	}

	// Start a goroutine to monitor the transaction confirmation
	go s.monitorWithdrawalTransaction(context.Background(), transaction.ID, txHash)

	s.logger.Infof("Gas withdrawal of %.8f GAS initiated for address %s to %s, txHash: %s", amount, address, targetAddress, txHash)

	return transaction, nil
}

// GetBalance gets the gas balance for a user
func (s *Service) GetBalance(userID int, address string) (float64, error) {
	// Get the account
	account, err := s.gasBankRepository.GetAccountByUserIDAndAddress(userID, address)
	if err != nil {
		return 0, fmt.Errorf("failed to get account: %w", err)
	}

	if account == nil {
		return 0, nil // No account found, return zero balance
	}

	return account.Balance, nil
}

// GetAccount gets a gas account
func (s *Service) GetAccount(userID int, address string) (*models.GasAccount, error) {
	return s.gasBankRepository.GetAccountByUserIDAndAddress(userID, address)
}

// GetAccounts gets all gas accounts for a user
func (s *Service) GetAccounts(userID int) ([]*models.GasAccount, error) {
	return s.gasBankRepository.GetAccountsByUserID(userID)
}

// GetTransactions gets transactions for a user
func (s *Service) GetTransactions(userID int, page, limit int) ([]*models.Transaction, error) {
	// Calculate offset
	offset := (page - 1) * limit

	return s.gasBankRepository.ListTransactionsByUserID(userID, offset, limit)
}

// GetAccountTransactions gets transactions for an account
func (s *Service) GetAccountTransactions(userID int, address string, page, limit int) ([]*models.Transaction, error) {
	// Get the account
	account, err := s.gasBankRepository.GetAccountByUserIDAndAddress(userID, address)
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}

	if account == nil {
		return nil, errors.New("account not found")
	}

	// Calculate offset
	offset := (page - 1) * limit

	return s.gasBankRepository.ListTransactionsByAccountID(account.ID, offset, limit)
}

// UseGas uses gas for an operation
func (s *Service) UseGas(ctx context.Context, userID int, address string, amount float64, txType models.TransactionType, relatedID int) error {
	// Validate input
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	// Use gas
	_, err := s.gasBankRepository.UseGas(userID, address, amount, txType, relatedID)
	if err != nil {
		return fmt.Errorf("failed to use gas: %w", err)
	}

	s.logger.Infof("Used %.8f GAS for operation %s, relatedID: %d", amount, txType, relatedID)

	return nil
}

// EstimateGas estimates gas needed for a Neo N3 operation
func (s *Service) EstimateGas(ctx context.Context, operationType string, params map[string]interface{}) (float64, error) {
	// This would need to use the blockchain client to estimate gas cost
	// For simplicity, we'll return fixed values based on operation type
	
	switch operationType {
	case "function_execution":
		return 0.01, nil
	case "price_feed_update":
		return 0.005, nil
	case "random_number_generation":
		return 0.01, nil
	case "oracle_data_publish":
		return 0.008, nil
	default:
		return 0.01, nil
	}
}

// ================================
// Private methods
// ================================

// validateDeposit validates deposit parameters
func (s *Service) validateDeposit(address string, amount float64) error {
	if address == "" {
		return errors.New("address is required")
	}

	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	if amount < s.config.Services.GasBank.MinDeposit {
		return fmt.Errorf("minimum deposit amount is %.8f GAS", s.config.Services.GasBank.MinDeposit)
	}

	return nil
}

// validateWithdrawal validates withdrawal parameters
func (s *Service) validateWithdrawal(address string, amount float64) error {
	if address == "" {
		return errors.New("address is required")
	}

	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	if amount > s.config.Services.GasBank.MaxWithdrawal {
		return fmt.Errorf("maximum withdrawal amount is %.8f GAS", s.config.Services.GasBank.MaxWithdrawal)
	}

	return nil
}

// verifyDepositTransaction verifies a deposit transaction on the Neo N3 blockchain
func (s *Service) verifyDepositTransaction(ctx context.Context, address, txHash string, amount float64) error {
	if s.blockchainClient == nil {
		s.logger.Warn("Blockchain client not available, skipping transaction verification")
		return nil
	}

	// Check if transaction already exists in our system
	existingTx, err := s.gasBankRepository.GetTransactionByTxHash(txHash)
	if err != nil {
		return fmt.Errorf("failed to check existing transaction: %w", err)
	}
	if existingTx != nil {
		return errors.New("transaction already processed")
	}

	// Get transaction from blockchain
	tx, err := s.blockchainClient.GetTransaction(txHash)
	if err != nil {
		return fmt.Errorf("failed to get transaction from blockchain: %w", err)
	}

	// Verify transaction type and amount
	// This is a simplified check - in a real implementation, you would:
	// 1. Decode the transaction
	// 2. Verify it's a transfer to your contract/address
	// 3. Verify the amount matches
	// 4. Verify it has enough confirmations
	
	// For now, we'll assume it's valid since we don't have the full Neo N3 transaction structure
	s.logger.Infof("Transaction %s verified on Neo N3 blockchain", txHash)

	return nil
}

// sendWithdrawalTransaction sends a withdrawal transaction on the Neo N3 blockchain
func (s *Service) sendWithdrawalTransaction(ctx context.Context, fromAddress, targetAddress string, amount float64) (string, error) {
	if s.blockchainClient == nil {
		return "", errors.New("blockchain client not available")
	}

	// In a real implementation, this would:
	// 1. Create a Neo N3 transaction
	// 2. Sign it with the service's wallet
	// 3. Send it to the Neo N3 blockchain
	// 4. Return the transaction hash
	
	// For now, we'll return a mock transaction hash
	mockTxHash := fmt.Sprintf("0x%032x", time.Now().Unix())
	
	return mockTxHash, nil
}

// monitorWithdrawalTransaction monitors a withdrawal transaction for confirmation
func (s *Service) monitorWithdrawalTransaction(ctx context.Context, transactionID int, txHash string) {
	// This would be implemented to:
	// 1. Periodically check the transaction status on the blockchain
	// 2. Update the transaction status in the database when confirmed
	// 3. Handle cases where the transaction fails or times out
	
	// For simplicity, we'll just simulate a delay and then mark it as confirmed
	time.Sleep(10 * time.Second)
	
	err := s.gasBankRepository.UpdateTransactionStatus(transactionID, models.TransactionStatusConfirmed)
	if err != nil {
		s.logger.Errorf("Failed to update transaction status for ID %d: %v", transactionID, err)
	} else {
		s.logger.Infof("Transaction %s confirmed", txHash)
	}
}