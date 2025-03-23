package mocks

import (
	"errors"
	"math/big"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/internal/models"
)

// MockGasBankRepository implements a mock repository for Gas Bank tests
type MockGasBankRepository struct {
	accounts           map[string]*models.GasBankAccount
	accountsByUser     map[string]*models.GasBankAccount
	accountsByWallet   map[string]*models.GasBankAccount
	transactions       map[string]*models.GasBankTransaction
	transactionsByUser map[string][]*models.GasBankTransaction
	withdrawalRequests map[string]*models.WithdrawalRequest
	depositTrackers    map[string]*models.DepositTracker
	mutex              sync.RWMutex
}

// NewMockGasBankRepository creates a new mock Gas Bank repository
func NewMockGasBankRepository() *MockGasBankRepository {
	return &MockGasBankRepository{
		accounts:           make(map[string]*models.GasBankAccount),
		accountsByUser:     make(map[string]*models.GasBankAccount),
		accountsByWallet:   make(map[string]*models.GasBankAccount),
		transactions:       make(map[string]*models.GasBankTransaction),
		transactionsByUser: make(map[string][]*models.GasBankTransaction),
		withdrawalRequests: make(map[string]*models.WithdrawalRequest),
		depositTrackers:    make(map[string]*models.DepositTracker),
	}
}

// CreateAccount creates a new gas bank account
func (r *MockGasBankRepository) CreateAccount(ctx interface{}, account *models.GasBankAccount) (*models.GasBankAccount, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Generate a unique ID if not provided
	if account.ID == "" {
		account.ID = uuid.New().String()
	}

	// Set created and updated timestamps
	now := time.Now().UTC()
	account.CreatedAt = now
	account.UpdatedAt = now

	// Store the account
	r.accounts[account.ID] = account
	r.accountsByUser[account.UserID] = account
	r.accountsByWallet[account.WalletAddress] = account

	// Return a copy to avoid modifying the stored value
	return r.copyAccount(account), nil
}

// GetAccount retrieves a gas bank account by ID
func (r *MockGasBankRepository) GetAccount(ctx interface{}, id string) (*models.GasBankAccount, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	account, exists := r.accounts[id]
	if !exists {
		return nil, models.ErrGasBankAccountNotFound
	}

	return r.copyAccount(account), nil
}

// GetAccountByUserID retrieves a gas bank account by user ID
func (r *MockGasBankRepository) GetAccountByUserID(ctx interface{}, userID string) (*models.GasBankAccount, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	account, exists := r.accountsByUser[userID]
	if !exists {
		return nil, models.ErrGasBankAccountNotFound
	}

	return r.copyAccount(account), nil
}

// GetAccountByWalletAddress retrieves a gas bank account by wallet address
func (r *MockGasBankRepository) GetAccountByWalletAddress(ctx interface{}, address string) (*models.GasBankAccount, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	account, exists := r.accountsByWallet[address]
	if !exists {
		return nil, models.ErrGasBankAccountNotFound
	}

	return r.copyAccount(account), nil
}

// UpdateAccount updates an existing gas bank account
func (r *MockGasBankRepository) UpdateAccount(ctx interface{}, account *models.GasBankAccount) (*models.GasBankAccount, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.accounts[account.ID]
	if !exists {
		return nil, models.ErrGasBankAccountNotFound
	}

	// Update timestamp
	account.UpdatedAt = time.Now().UTC()

	// Store the updated account
	r.accounts[account.ID] = account
	r.accountsByUser[account.UserID] = account
	r.accountsByWallet[account.WalletAddress] = account

	return r.copyAccount(account), nil
}

// ListAccounts retrieves all gas bank accounts
func (r *MockGasBankRepository) ListAccounts(ctx interface{}) ([]*models.GasBankAccount, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	result := make([]*models.GasBankAccount, 0, len(r.accounts))
	for _, account := range r.accounts {
		result = append(result, r.copyAccount(account))
	}

	return result, nil
}

// CreateTransaction creates a new gas bank transaction
func (r *MockGasBankRepository) CreateTransaction(ctx interface{}, tx *models.GasBankTransaction) (*models.GasBankTransaction, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Generate a unique ID if not provided
	if tx.ID == "" {
		tx.ID = uuid.New().String()
	}

	// Set created and updated timestamps
	now := time.Now().UTC()
	tx.CreatedAt = now
	tx.UpdatedAt = now

	// Store the transaction
	r.transactions[tx.ID] = tx
	r.transactionsByUser[tx.UserID] = append(r.transactionsByUser[tx.UserID], tx)

	return r.copyTransaction(tx), nil
}

// GetTransaction retrieves a gas bank transaction by ID
func (r *MockGasBankRepository) GetTransaction(ctx interface{}, id string) (*models.GasBankTransaction, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	tx, exists := r.transactions[id]
	if !exists {
		return nil, models.ErrTransactionNotFound
	}

	return r.copyTransaction(tx), nil
}

// GetTransactionByBlockchainTxID retrieves a gas bank transaction by blockchain transaction ID
func (r *MockGasBankRepository) GetTransactionByBlockchainTxID(ctx interface{}, txID string) (*models.GasBankTransaction, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	for _, tx := range r.transactions {
		if tx.BlockchainTxID == txID {
			return r.copyTransaction(tx), nil
		}
	}

	return nil, models.ErrTransactionNotFound
}

// UpdateTransaction updates an existing gas bank transaction
func (r *MockGasBankRepository) UpdateTransaction(ctx interface{}, tx *models.GasBankTransaction) (*models.GasBankTransaction, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.transactions[tx.ID]
	if !exists {
		return nil, models.ErrTransactionNotFound
	}

	// Update timestamp
	tx.UpdatedAt = time.Now().UTC()

	// Store the updated transaction
	r.transactions[tx.ID] = tx

	// Update in user transactions
	for i, userTx := range r.transactionsByUser[tx.UserID] {
		if userTx.ID == tx.ID {
			r.transactionsByUser[tx.UserID][i] = tx
			break
		}
	}

	return r.copyTransaction(tx), nil
}

// ListTransactionsByUserID retrieves gas bank transactions for a user
func (r *MockGasBankRepository) ListTransactionsByUserID(ctx interface{}, userID string, limit int, offset int) ([]*models.GasBankTransaction, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	userTxs, exists := r.transactionsByUser[userID]
	if !exists {
		return []*models.GasBankTransaction{}, nil
	}

	// Apply offset and limit
	start := offset
	if start >= len(userTxs) {
		return []*models.GasBankTransaction{}, nil
	}

	end := start + limit
	if end > len(userTxs) {
		end = len(userTxs)
	}

	result := make([]*models.GasBankTransaction, 0, end-start)
	for i := start; i < end; i++ {
		result = append(result, r.copyTransaction(userTxs[i]))
	}

	return result, nil
}

// ListTransactionsByAccountID retrieves gas bank transactions for an account
func (r *MockGasBankRepository) ListTransactionsByAccountID(ctx interface{}, accountID string, limit int, offset int) ([]*models.GasBankTransaction, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	// Filter transactions by account ID
	var accountTxs []*models.GasBankTransaction
	for _, tx := range r.transactions {
		if tx.AccountID == accountID {
			accountTxs = append(accountTxs, tx)
		}
	}

	// Apply offset and limit
	start := offset
	if start >= len(accountTxs) {
		return []*models.GasBankTransaction{}, nil
	}

	end := start + limit
	if end > len(accountTxs) {
		end = len(accountTxs)
	}

	result := make([]*models.GasBankTransaction, 0, end-start)
	for i := start; i < end; i++ {
		result = append(result, r.copyTransaction(accountTxs[i]))
	}

	return result, nil
}

// CreateWithdrawalRequest creates a new withdrawal request
func (r *MockGasBankRepository) CreateWithdrawalRequest(ctx interface{}, req *models.WithdrawalRequest) (*models.WithdrawalRequest, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Generate a unique ID if not provided
	if req.ID == "" {
		req.ID = uuid.New().String()
	}

	// Set created and updated timestamps
	now := time.Now().UTC()
	req.CreatedAt = now
	req.UpdatedAt = now

	// Store the request
	r.withdrawalRequests[req.ID] = req

	return r.copyWithdrawalRequest(req), nil
}

// GetWithdrawalRequest retrieves a withdrawal request by ID
func (r *MockGasBankRepository) GetWithdrawalRequest(ctx interface{}, id string) (*models.WithdrawalRequest, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	req, exists := r.withdrawalRequests[id]
	if !exists {
		return nil, errors.New("withdrawal request not found")
	}

	return r.copyWithdrawalRequest(req), nil
}

// UpdateWithdrawalRequest updates an existing withdrawal request
func (r *MockGasBankRepository) UpdateWithdrawalRequest(ctx interface{}, req *models.WithdrawalRequest) (*models.WithdrawalRequest, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.withdrawalRequests[req.ID]
	if !exists {
		return nil, errors.New("withdrawal request not found")
	}

	// Update timestamp
	req.UpdatedAt = time.Now().UTC()

	// Store the updated request
	r.withdrawalRequests[req.ID] = req

	return r.copyWithdrawalRequest(req), nil
}

// ListWithdrawalRequestsByUserID retrieves withdrawal requests for a user
func (r *MockGasBankRepository) ListWithdrawalRequestsByUserID(ctx interface{}, userID string, limit int, offset int) ([]*models.WithdrawalRequest, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	// Filter requests by user ID
	var userRequests []*models.WithdrawalRequest
	for _, req := range r.withdrawalRequests {
		if req.UserID == userID {
			userRequests = append(userRequests, req)
		}
	}

	// Apply offset and limit
	start := offset
	if start >= len(userRequests) {
		return []*models.WithdrawalRequest{}, nil
	}

	end := start + limit
	if end > len(userRequests) {
		end = len(userRequests)
	}

	result := make([]*models.WithdrawalRequest, 0, end-start)
	for i := start; i < end; i++ {
		result = append(result, r.copyWithdrawalRequest(userRequests[i]))
	}

	return result, nil
}

// CreateDepositTracker creates a new deposit tracker
func (r *MockGasBankRepository) CreateDepositTracker(ctx interface{}, deposit *models.DepositTracker) (*models.DepositTracker, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Generate a unique ID if not provided
	if deposit.ID == "" {
		deposit.ID = uuid.New().String()
	}

	// Set created and updated timestamps
	now := time.Now().UTC()
	deposit.CreatedAt = now
	deposit.UpdatedAt = now

	// Store the deposit tracker
	r.depositTrackers[deposit.BlockchainTxID] = deposit

	return r.copyDepositTracker(deposit), nil
}

// GetDepositTrackerByTxID retrieves a deposit tracker by blockchain transaction ID
func (r *MockGasBankRepository) GetDepositTrackerByTxID(ctx interface{}, txID string) (*models.DepositTracker, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	deposit, exists := r.depositTrackers[txID]
	if !exists {
		return nil, nil // Return nil without error to indicate no tracker exists
	}

	return r.copyDepositTracker(deposit), nil
}

// UpdateDepositTracker updates an existing deposit tracker
func (r *MockGasBankRepository) UpdateDepositTracker(ctx interface{}, deposit *models.DepositTracker) (*models.DepositTracker, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.depositTrackers[deposit.BlockchainTxID]
	if !exists {
		return nil, errors.New("deposit tracker not found")
	}

	// Update timestamp
	deposit.UpdatedAt = time.Now().UTC()

	// Store the updated deposit tracker
	r.depositTrackers[deposit.BlockchainTxID] = deposit

	return r.copyDepositTracker(deposit), nil
}

// ListUnprocessedDeposits retrieves all unprocessed deposits
func (r *MockGasBankRepository) ListUnprocessedDeposits(ctx interface{}) ([]*models.DepositTracker, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	var unprocessed []*models.DepositTracker
	for _, deposit := range r.depositTrackers {
		if !deposit.Processed {
			unprocessed = append(unprocessed, r.copyDepositTracker(deposit))
		}
	}

	return unprocessed, nil
}

// UpdateBalance updates an account's balance
func (r *MockGasBankRepository) UpdateBalance(ctx interface{}, accountID string, newBalance string, newPendingBalance string, newAvailableBalance string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	account, exists := r.accounts[accountID]
	if !exists {
		return models.ErrGasBankAccountNotFound
	}

	// Update the balances
	account.Balance = newBalance
	account.PendingBalance = newPendingBalance
	account.AvailableBalance = newAvailableBalance
	account.UpdatedAt = time.Now().UTC()

	return nil
}

// IncrementDailyWithdrawal increments an account's daily withdrawal amount
func (r *MockGasBankRepository) IncrementDailyWithdrawal(ctx interface{}, accountID string, amount string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	account, exists := r.accounts[accountID]
	if !exists {
		return models.ErrGasBankAccountNotFound
	}

	// Parse the amounts
	currentAmount, _ := new(big.Float).SetString(account.DailyWithdrawal)
	incrementAmount, _ := new(big.Float).SetString(amount)

	// Add the increment to the current amount
	newAmount := new(big.Float).Add(currentAmount, incrementAmount)

	// Update the daily withdrawal amount
	account.DailyWithdrawal = newAmount.Text('f', -1)
	account.LastWithdrawalDay = time.Now().UTC()
	account.UpdatedAt = time.Now().UTC()

	return nil
}

// ResetDailyWithdrawal resets an account's daily withdrawal amount
func (r *MockGasBankRepository) ResetDailyWithdrawal(ctx interface{}, accountID string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	account, exists := r.accounts[accountID]
	if !exists {
		return models.ErrGasBankAccountNotFound
	}

	// Reset the daily withdrawal amount
	account.DailyWithdrawal = "0"
	account.LastWithdrawalDay = time.Now().UTC()
	account.UpdatedAt = time.Now().UTC()

	return nil
}

// Helper methods to create copies of objects to avoid modifying the stored values

func (r *MockGasBankRepository) copyAccount(account *models.GasBankAccount) *models.GasBankAccount {
	copy := *account
	return &copy
}

func (r *MockGasBankRepository) copyTransaction(tx *models.GasBankTransaction) *models.GasBankTransaction {
	copy := *tx
	if tx.ConfirmedAt != nil {
		confirmedAt := *tx.ConfirmedAt
		copy.ConfirmedAt = &confirmedAt
	}
	return &copy
}

func (r *MockGasBankRepository) copyWithdrawalRequest(req *models.WithdrawalRequest) *models.WithdrawalRequest {
	copy := *req
	return &copy
}

func (r *MockGasBankRepository) copyDepositTracker(deposit *models.DepositTracker) *models.DepositTracker {
	copy := *deposit
	return &copy
}
