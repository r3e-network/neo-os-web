package database

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/R3E-Network/service_layer/internal/models"
)

// TransactionRepository defines the interface for transaction operations
type TransactionRepository interface {
	CreateTransaction(ctx context.Context, tx *models.Transaction) error
	GetTransactionByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error)
	GetTransactionByHash(ctx context.Context, hash string) (*models.Transaction, error)
	UpdateTransactionStatus(ctx context.Context, id uuid.UUID, status models.TransactionStatus, result json.RawMessage, gasConsumed *int64, blockHeight *int64, blockTime *time.Time, err string) error
	ListTransactions(ctx context.Context, service string, status models.TransactionStatus, entityID *uuid.UUID, page, limit int) (*models.TransactionListResponse, error)
	AddTransactionEvent(ctx context.Context, event *models.TransactionEvent) error
	GetTransactionEvents(ctx context.Context, transactionID uuid.UUID) ([]models.TransactionEvent, error)
	DeleteTransaction(ctx context.Context, id uuid.UUID) error

	CreateWalletAccount(ctx context.Context, wallet *models.WalletAccount) error
	GetWalletByService(ctx context.Context, service string) (*models.WalletAccount, error)
	GetWalletByAddress(ctx context.Context, address string) (*models.WalletAccount, error)
	ListWalletsByService(ctx context.Context, service string) ([]models.WalletAccount, error)
	DeleteWalletAccount(ctx context.Context, id uuid.UUID) error
}

// SQLTransactionRepository implements TransactionRepository using SQL
type SQLTransactionRepository struct {
	db *sqlx.DB
}

// NewSQLTransactionRepository creates a new SQLTransactionRepository
func NewSQLTransactionRepository(db *sqlx.DB) TransactionRepository {
	return &SQLTransactionRepository{db: db}
}

// CreateTransaction creates a new transaction record
func (r *SQLTransactionRepository) CreateTransaction(ctx context.Context, tx *models.Transaction) error {
	query := `
		INSERT INTO transactions (
			id, hash, service, entity_id, entity_type, status, type, data, 
			gas_price, system_fee, network_fee, sender, created_at, updated_at
		) VALUES (
			:id, :hash, :service, :entity_id, :entity_type, :status, :type, :data, 
			:gas_price, :system_fee, :network_fee, :sender, :created_at, :updated_at
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, tx)
	return err
}

// GetTransactionByID retrieves a transaction by ID
func (r *SQLTransactionRepository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	query := `
		SELECT * FROM transactions
		WHERE id = $1 AND deleted_at IS NULL
	`

	var tx models.Transaction
	err := r.db.GetContext(ctx, &tx, query, id)
	if err != nil {
		return nil, err
	}

	return &tx, nil
}

// GetTransactionByHash retrieves a transaction by hash
func (r *SQLTransactionRepository) GetTransactionByHash(ctx context.Context, hash string) (*models.Transaction, error) {
	query := `
		SELECT * FROM transactions
		WHERE hash = $1 AND deleted_at IS NULL
	`

	var tx models.Transaction
	err := r.db.GetContext(ctx, &tx, query, hash)
	if err != nil {
		return nil, err
	}

	return &tx, nil
}

// UpdateTransactionStatus updates a transaction's status and related fields
func (r *SQLTransactionRepository) UpdateTransactionStatus(
	ctx context.Context,
	id uuid.UUID,
	status models.TransactionStatus,
	result json.RawMessage,
	gasConsumed *int64,
	blockHeight *int64,
	blockTime *time.Time,
	err string,
) error {
	query := `
		UPDATE transactions SET
			status = $2,
			result = $3,
			gas_consumed = $4,
			block_height = $5,
			block_time = $6,
			error = $7,
			updated_at = $8
		WHERE id = $1
	`

	now := time.Now()
	_, dbErr := r.db.ExecContext(
		ctx,
		query,
		id,
		status,
		result,
		gasConsumed,
		blockHeight,
		blockTime,
		err,
		now,
	)
	return dbErr
}

// ListTransactions retrieves a paginated list of transactions with filters
func (r *SQLTransactionRepository) ListTransactions(
	ctx context.Context,
	service string,
	status models.TransactionStatus,
	entityID *uuid.UUID,
	page, limit int,
) (*models.TransactionListResponse, error) {
	query := `
		SELECT * FROM transactions
		WHERE deleted_at IS NULL
	`
	countQuery := `
		SELECT COUNT(*) FROM transactions
		WHERE deleted_at IS NULL
	`

	args := []interface{}{}
	argIndex := 1

	if service != "" {
		query += ` AND service = $` + string(argIndex)
		countQuery += ` AND service = $` + string(argIndex)
		args = append(args, service)
		argIndex++
	}

	if status != "" {
		query += ` AND status = $` + string(argIndex)
		countQuery += ` AND status = $` + string(argIndex)
		args = append(args, status)
		argIndex++
	}

	if entityID != nil {
		query += ` AND entity_id = $` + string(argIndex)
		countQuery += ` AND entity_id = $` + string(argIndex)
		args = append(args, entityID)
		argIndex++
	}

	query += ` ORDER BY created_at DESC LIMIT $` + string(argIndex) + ` OFFSET $` + string(argIndex+1)
	args = append(args, limit, (page-1)*limit)

	var transactions []models.Transaction
	err := r.db.SelectContext(ctx, &transactions, query, args...)
	if err != nil {
		return nil, err
	}

	var count int
	err = r.db.GetContext(ctx, &count, countQuery, args[:argIndex-1]...)
	if err != nil {
		return nil, err
	}

	return &models.TransactionListResponse{
		Total:        count,
		Page:         page,
		Limit:        limit,
		Transactions: transactions,
	}, nil
}

// AddTransactionEvent adds an event for a transaction
func (r *SQLTransactionRepository) AddTransactionEvent(ctx context.Context, event *models.TransactionEvent) error {
	query := `
		INSERT INTO transaction_events (
			id, transaction_id, status, details, timestamp
		) VALUES (
			:id, :transaction_id, :status, :details, :timestamp
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, event)
	return err
}

// GetTransactionEvents retrieves events for a transaction
func (r *SQLTransactionRepository) GetTransactionEvents(ctx context.Context, transactionID uuid.UUID) ([]models.TransactionEvent, error) {
	query := `
		SELECT * FROM transaction_events
		WHERE transaction_id = $1
		ORDER BY timestamp ASC
	`

	var events []models.TransactionEvent
	err := r.db.SelectContext(ctx, &events, query, transactionID)
	if err != nil {
		return nil, err
	}

	return events, nil
}

// DeleteTransaction soft deletes a transaction
func (r *SQLTransactionRepository) DeleteTransaction(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE transactions SET
			deleted_at = $2
		WHERE id = $1
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, id, now)
	return err
}

// CreateWalletAccount creates a new wallet account
func (r *SQLTransactionRepository) CreateWalletAccount(ctx context.Context, wallet *models.WalletAccount) error {
	query := `
		INSERT INTO wallet_accounts (
			id, service, address, encrypted_private_key, public_key, created_at, updated_at
		) VALUES (
			:id, :service, :address, :encrypted_private_key, :public_key, :created_at, :updated_at
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, wallet)
	return err
}

// GetWalletByService retrieves a wallet account by service (one per service)
func (r *SQLTransactionRepository) GetWalletByService(ctx context.Context, service string) (*models.WalletAccount, error) {
	query := `
		SELECT * FROM wallet_accounts
		WHERE service = $1 AND deleted_at IS NULL
		LIMIT 1
	`

	var wallet models.WalletAccount
	err := r.db.GetContext(ctx, &wallet, query, service)
	if err != nil {
		return nil, err
	}

	return &wallet, nil
}

// GetWalletByAddress retrieves a wallet account by address
func (r *SQLTransactionRepository) GetWalletByAddress(ctx context.Context, address string) (*models.WalletAccount, error) {
	query := `
		SELECT * FROM wallet_accounts
		WHERE address = $1 AND deleted_at IS NULL
	`

	var wallet models.WalletAccount
	err := r.db.GetContext(ctx, &wallet, query, address)
	if err != nil {
		return nil, err
	}

	return &wallet, nil
}

// ListWalletsByService retrieves all wallet accounts for a service
func (r *SQLTransactionRepository) ListWalletsByService(ctx context.Context, service string) ([]models.WalletAccount, error) {
	query := `
		SELECT * FROM wallet_accounts
		WHERE service = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC
	`

	var wallets []models.WalletAccount
	err := r.db.SelectContext(ctx, &wallets, query, service)
	if err != nil {
		return nil, err
	}

	return wallets, nil
}

// DeleteWalletAccount soft deletes a wallet account
func (r *SQLTransactionRepository) DeleteWalletAccount(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE wallet_accounts SET
			deleted_at = $2
		WHERE id = $1
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, id, now)
	return err
}
