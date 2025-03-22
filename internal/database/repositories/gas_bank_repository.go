package repositories

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/willtech-services/service_layer/internal/models"
)

// PostgresGasBankRepository is an implementation of GasBankRepository using PostgreSQL
type PostgresGasBankRepository struct {
	db *sql.DB
}

// NewGasBankRepository creates a new PostgreSQL implementation of GasBankRepository
func NewGasBankRepository(db *sql.DB) models.GasBankRepository {
	return &PostgresGasBankRepository{
		db: db,
	}
}

// CreateAccount creates a new gas account
func (r *PostgresGasBankRepository) CreateAccount(account *models.GasAccount) error {
	query := `
		INSERT INTO gas_accounts (user_id, address, balance, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	err := r.db.QueryRow(
		query,
		account.UserID,
		account.Address,
		account.Balance,
		account.CreatedAt,
		account.UpdatedAt,
	).Scan(&account.ID)

	return err
}

// GetAccountByID gets a gas account by ID
func (r *PostgresGasBankRepository) GetAccountByID(id int) (*models.GasAccount, error) {
	query := `
		SELECT id, user_id, address, balance, created_at, updated_at
		FROM gas_accounts
		WHERE id = $1
	`
	account := &models.GasAccount{}
	err := r.db.QueryRow(query, id).Scan(
		&account.ID,
		&account.UserID,
		&account.Address,
		&account.Balance,
		&account.CreatedAt,
		&account.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Account not found
		}
		return nil, err
	}

	return account, nil
}

// GetAccountByUserIDAndAddress gets a gas account by user ID and address
func (r *PostgresGasBankRepository) GetAccountByUserIDAndAddress(userID int, address string) (*models.GasAccount, error) {
	query := `
		SELECT id, user_id, address, balance, created_at, updated_at
		FROM gas_accounts
		WHERE user_id = $1 AND address = $2
	`
	account := &models.GasAccount{}
	err := r.db.QueryRow(query, userID, address).Scan(
		&account.ID,
		&account.UserID,
		&account.Address,
		&account.Balance,
		&account.CreatedAt,
		&account.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Account not found
		}
		return nil, err
	}

	return account, nil
}

// GetAccountsByUserID gets all gas accounts for a user
func (r *PostgresGasBankRepository) GetAccountsByUserID(userID int) ([]*models.GasAccount, error) {
	query := `
		SELECT id, user_id, address, balance, created_at, updated_at
		FROM gas_accounts
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []*models.GasAccount{}
	for rows.Next() {
		account := &models.GasAccount{}
		err := rows.Scan(
			&account.ID,
			&account.UserID,
			&account.Address,
			&account.Balance,
			&account.CreatedAt,
			&account.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		accounts = append(accounts, account)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return accounts, nil
}

// UpdateAccountBalance updates a gas account's balance
func (r *PostgresGasBankRepository) UpdateAccountBalance(id int, balance float64) error {
	query := `
		UPDATE gas_accounts
		SET balance = $1, updated_at = $2
		WHERE id = $3
	`
	now := time.Now()
	_, err := r.db.Exec(query, balance, now, id)
	return err
}

// CreateTransaction creates a new transaction
func (r *PostgresGasBankRepository) CreateTransaction(tx *models.Transaction) error {
	query := `
		INSERT INTO transactions (user_id, account_id, type, amount, tx_hash, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	err := r.db.QueryRow(
		query,
		tx.UserID,
		tx.AccountID,
		tx.Type,
		tx.Amount,
		tx.TxHash,
		tx.Status,
		tx.CreatedAt,
	).Scan(&tx.ID)

	return err
}

// GetTransactionByID gets a transaction by ID
func (r *PostgresGasBankRepository) GetTransactionByID(id int) (*models.Transaction, error) {
	query := `
		SELECT id, user_id, account_id, type, amount, tx_hash, status, created_at
		FROM transactions
		WHERE id = $1
	`
	tx := &models.Transaction{}
	var txHash sql.NullString

	err := r.db.QueryRow(query, id).Scan(
		&tx.ID,
		&tx.UserID,
		&tx.AccountID,
		&tx.Type,
		&tx.Amount,
		&txHash,
		&tx.Status,
		&tx.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Transaction not found
		}
		return nil, err
	}

	if txHash.Valid {
		tx.TxHash = txHash.String
	}

	return tx, nil
}

// GetTransactionByTxHash gets a transaction by transaction hash
func (r *PostgresGasBankRepository) GetTransactionByTxHash(txHash string) (*models.Transaction, error) {
	query := `
		SELECT id, user_id, account_id, type, amount, tx_hash, status, created_at
		FROM transactions
		WHERE tx_hash = $1
	`
	tx := &models.Transaction{}
	var dbTxHash sql.NullString

	err := r.db.QueryRow(query, txHash).Scan(
		&tx.ID,
		&tx.UserID,
		&tx.AccountID,
		&tx.Type,
		&tx.Amount,
		&dbTxHash,
		&tx.Status,
		&tx.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Transaction not found
		}
		return nil, err
	}

	if dbTxHash.Valid {
		tx.TxHash = dbTxHash.String
	}

	return tx, nil
}

// ListTransactionsByUserID lists transactions for a user
func (r *PostgresGasBankRepository) ListTransactionsByUserID(userID int, offset, limit int) ([]*models.Transaction, error) {
	query := `
		SELECT id, user_id, account_id, type, amount, tx_hash, status, created_at
		FROM transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	transactions := []*models.Transaction{}
	for rows.Next() {
		tx := &models.Transaction{}
		var txHash sql.NullString

		err := rows.Scan(
			&tx.ID,
			&tx.UserID,
			&tx.AccountID,
			&tx.Type,
			&tx.Amount,
			&txHash,
			&tx.Status,
			&tx.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if txHash.Valid {
			tx.TxHash = txHash.String
		}

		transactions = append(transactions, tx)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return transactions, nil
}

// ListTransactionsByAccountID lists transactions for an account
func (r *PostgresGasBankRepository) ListTransactionsByAccountID(accountID int, offset, limit int) ([]*models.Transaction, error) {
	query := `
		SELECT id, user_id, account_id, type, amount, tx_hash, status, created_at
		FROM transactions
		WHERE account_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, accountID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	transactions := []*models.Transaction{}
	for rows.Next() {
		tx := &models.Transaction{}
		var txHash sql.NullString

		err := rows.Scan(
			&tx.ID,
			&tx.UserID,
			&tx.AccountID,
			&tx.Type,
			&tx.Amount,
			&txHash,
			&tx.Status,
			&tx.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if txHash.Valid {
			tx.TxHash = txHash.String
		}

		transactions = append(transactions, tx)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return transactions, nil
}

// UpdateTransactionStatus updates a transaction's status
func (r *PostgresGasBankRepository) UpdateTransactionStatus(id int, status models.TransactionStatus) error {
	query := `
		UPDATE transactions
		SET status = $1
		WHERE id = $2
	`
	_, err := r.db.Exec(query, status, id)
	return err
}

// DepositGas deposits gas to an account with a transaction
func (r *PostgresGasBankRepository) DepositGas(userID int, address string, amount float64, txHash string) (*models.Transaction, error) {
	// Start a transaction
	dbTx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer dbTx.Rollback()

	// Get the account or create it if it doesn't exist
	account, err := r.GetAccountByUserIDAndAddress(userID, address)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if account == nil {
		// Create a new account
		account = &models.GasAccount{
			UserID:    userID,
			Address:   address,
			Balance:   amount,
			CreatedAt: now,
			UpdatedAt: now,
		}

		// Insert account
		query := `
			INSERT INTO gas_accounts (user_id, address, balance, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`
		err = dbTx.QueryRow(
			query,
			account.UserID,
			account.Address,
			account.Balance,
			account.CreatedAt,
			account.UpdatedAt,
		).Scan(&account.ID)

		if err != nil {
			return nil, err
		}
	} else {
		// Update existing account balance
		account.Balance += amount
		account.UpdatedAt = now

		query := `
			UPDATE gas_accounts
			SET balance = $1, updated_at = $2
			WHERE id = $3
		`
		_, err = dbTx.Exec(query, account.Balance, account.UpdatedAt, account.ID)
		if err != nil {
			return nil, err
		}
	}

	// Create a transaction record
	transaction := &models.Transaction{
		UserID:    userID,
		AccountID: account.ID,
		Type:      models.TransactionTypeDeposit,
		Amount:    amount,
		TxHash:    txHash,
		Status:    models.TransactionStatusConfirmed,
		CreatedAt: now,
	}

	// Insert transaction
	query := `
		INSERT INTO transactions (user_id, account_id, type, amount, tx_hash, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	err = dbTx.QueryRow(
		query,
		transaction.UserID,
		transaction.AccountID,
		transaction.Type,
		transaction.Amount,
		transaction.TxHash,
		transaction.Status,
		transaction.CreatedAt,
	).Scan(&transaction.ID)

	if err != nil {
		return nil, err
	}

	// Commit the transaction
	if err = dbTx.Commit(); err != nil {
		return nil, err
	}

	return transaction, nil
}

// WithdrawGas withdraws gas from an account with a transaction
func (r *PostgresGasBankRepository) WithdrawGas(userID int, address string, amount float64, txHash string) (*models.Transaction, error) {
	// Start a transaction
	dbTx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer dbTx.Rollback()

	// Get the account
	account, err := r.GetAccountByUserIDAndAddress(userID, address)
	if err != nil {
		return nil, err
	}

	if account == nil {
		return nil, fmt.Errorf("account not found for address: %s", address)
	}

	// Check if there's sufficient balance
	if account.Balance < amount {
		return nil, fmt.Errorf("insufficient balance: have %.8f, need %.8f", account.Balance, amount)
	}

	// Update account balance
	now := time.Now()
	account.Balance -= amount
	account.UpdatedAt = now

	query := `
		UPDATE gas_accounts
		SET balance = $1, updated_at = $2
		WHERE id = $3
	`
	_, err = dbTx.Exec(query, account.Balance, account.UpdatedAt, account.ID)
	if err != nil {
		return nil, err
	}

	// Create a transaction record
	transaction := &models.Transaction{
		UserID:    userID,
		AccountID: account.ID,
		Type:      models.TransactionTypeWithdraw,
		Amount:    amount,
		TxHash:    txHash,
		Status:    models.TransactionStatusPending, // Initially pending until confirmed on-chain
		CreatedAt: now,
	}

	// Insert transaction
	query = `
		INSERT INTO transactions (user_id, account_id, type, amount, tx_hash, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	err = dbTx.QueryRow(
		query,
		transaction.UserID,
		transaction.AccountID,
		transaction.Type,
		transaction.Amount,
		transaction.TxHash,
		transaction.Status,
		transaction.CreatedAt,
	).Scan(&transaction.ID)

	if err != nil {
		return nil, err
	}

	// Commit the transaction
	if err = dbTx.Commit(); err != nil {
		return nil, err
	}

	return transaction, nil
}

// UseGas uses gas for an operation with a transaction
func (r *PostgresGasBankRepository) UseGas(userID int, address string, amount float64, txType models.TransactionType, relatedID int) (*models.Transaction, error) {
	// Start a transaction
	dbTx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer dbTx.Rollback()

	// Get the account
	account, err := r.GetAccountByUserIDAndAddress(userID, address)
	if err != nil {
		return nil, err
	}

	if account == nil {
		return nil, fmt.Errorf("account not found for address: %s", address)
	}

	// Check if there's sufficient balance
	if account.Balance < amount {
		return nil, fmt.Errorf("insufficient balance: have %.8f, need %.8f", account.Balance, amount)
	}

	// Update account balance
	now := time.Now()
	account.Balance -= amount
	account.UpdatedAt = now

	query := `
		UPDATE gas_accounts
		SET balance = $1, updated_at = $2
		WHERE id = $3
	`
	_, err = dbTx.Exec(query, account.Balance, account.UpdatedAt, account.ID)
	if err != nil {
		return nil, err
	}

	// Create a transaction record
	transaction := &models.Transaction{
		UserID:    userID,
		AccountID: account.ID,
		Type:      txType,
		Amount:    amount,
		Status:    models.TransactionStatusConfirmed,
		CreatedAt: now,
	}

	// Insert transaction
	query = `
		INSERT INTO transactions (user_id, account_id, type, amount, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`
	err = dbTx.QueryRow(
		query,
		transaction.UserID,
		transaction.AccountID,
		transaction.Type,
		transaction.Amount,
		transaction.Status,
		transaction.CreatedAt,
	).Scan(&transaction.ID)

	if err != nil {
		return nil, err
	}

	// Commit the transaction
	if err = dbTx.Commit(); err != nil {
		return nil, err
	}

	return transaction, nil
}