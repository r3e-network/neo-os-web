package database

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/R3E-Network/service_layer/internal/models"
)

// OptimizedTransactionRepository implements TransactionRepository using SQL with optimized queries
type OptimizedTransactionRepository struct {
	db *sqlx.DB
}

// NewOptimizedTransactionRepository creates a new OptimizedTransactionRepository
func NewOptimizedTransactionRepository(db *sqlx.DB) TransactionRepository {
	return &OptimizedTransactionRepository{db: db}
}

// CreateTransaction creates a new transaction record
func (r *OptimizedTransactionRepository) CreateTransaction(ctx context.Context, tx *models.Transaction) error {
	query := `
		INSERT INTO transactions (
			id, hash, service, entity_id, entity_type, status, type, data, 
			gas_price, system_fee, network_fee, sender, created_at, updated_at,
			status_updated_at, event_count
		) VALUES (
			:id, :hash, :service, :entity_id, :entity_type, :status, :type, :data, 
			:gas_price, :system_fee, :network_fee, :sender, :created_at, :updated_at,
			:created_at, 0
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, tx)
	if err != nil {
		return fmt.Errorf("failed to create transaction: %w", err)
	}

	return nil
}

// GetTransactionByID retrieves a transaction by ID
func (r *OptimizedTransactionRepository) GetTransactionByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	// This query uses the primary key and will be efficient
	query := `
		SELECT * FROM transactions
		WHERE id = $1 AND deleted_at IS NULL
	`

	var tx models.Transaction
	err := r.db.GetContext(ctx, &tx, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction by ID: %w", err)
	}

	return &tx, nil
}

// GetTransactionByHash retrieves a transaction by hash
func (r *OptimizedTransactionRepository) GetTransactionByHash(ctx context.Context, hash string) (*models.Transaction, error) {
	// Consider adding an index on hash if this is called frequently
	query := `
		SELECT * FROM transactions
		WHERE hash = $1 AND deleted_at IS NULL
	`

	var tx models.Transaction
	err := r.db.GetContext(ctx, &tx, query, hash)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction by hash: %w", err)
	}

	return &tx, nil
}

// UpdateTransactionStatus updates a transaction's status and related fields
func (r *OptimizedTransactionRepository) UpdateTransactionStatus(
	ctx context.Context,
	id uuid.UUID,
	status models.TransactionStatus,
	result json.RawMessage,
	gasConsumed *int64,
	blockHeight *int64,
	blockTime *time.Time,
	err string,
) error {
	// The status_updated_at field will be automatically updated by the database trigger
	// when the status changes
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
	if dbErr != nil {
		return fmt.Errorf("failed to update transaction status: %w", dbErr)
	}

	return nil
}

// ListTransactions retrieves a paginated list of transactions with filters
// This query is optimized to use the appropriate indexes and select only necessary fields
func (r *OptimizedTransactionRepository) ListTransactions(
	ctx context.Context,
	service string,
	status models.TransactionStatus,
	entityID *uuid.UUID,
	page, limit int,
) (*models.TransactionListResponse, error) {
	baseQuery := `
		FROM transactions
		WHERE deleted_at IS NULL
	`

	args := []interface{}{}
	argIndex := 1
	whereClause := ""

	if service != "" {
		whereClause += ` AND service = $` + strconv.Itoa(argIndex)
		args = append(args, service)
		argIndex++
	}

	if status != "" {
		whereClause += ` AND status = $` + strconv.Itoa(argIndex)
		args = append(args, status)
		argIndex++
	}

	if entityID != nil {
		whereClause += ` AND entity_id = $` + strconv.Itoa(argIndex)
		args = append(args, entityID)
		argIndex++
	}

	// First get the count using a more efficient query
	countQuery := `SELECT COUNT(*) ` + baseQuery + whereClause
	var count int
	err := r.db.GetContext(ctx, &count, countQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to count transactions: %w", err)
	}

	// Then get the actual transactions
	query := `SELECT * ` + baseQuery + whereClause +
		` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(argIndex) +
		` OFFSET $` + strconv.Itoa(argIndex+1)

	args = append(args, limit, (page-1)*limit)

	var transactions []models.Transaction
	err = r.db.SelectContext(ctx, &transactions, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list transactions: %w", err)
	}

	return &models.TransactionListResponse{
		Total:        count,
		Page:         page,
		Limit:        limit,
		Transactions: transactions,
	}, nil
}

// AddTransactionEvent adds an event for a transaction
// The event_count in the transactions table will be automatically updated by the database trigger
func (r *OptimizedTransactionRepository) AddTransactionEvent(ctx context.Context, event *models.TransactionEvent) error {
	query := `
		INSERT INTO transaction_events (
			id, transaction_id, status, details, timestamp
		) VALUES (
			:id, :transaction_id, :status, :details, :timestamp
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, event)
	if err != nil {
		return fmt.Errorf("failed to add transaction event: %w", err)
	}

	return nil
}

// GetTransactionEvents retrieves events for a transaction
// This uses the index on transaction_id
func (r *OptimizedTransactionRepository) GetTransactionEvents(ctx context.Context, transactionID uuid.UUID) ([]models.TransactionEvent, error) {
	query := `
		SELECT * FROM transaction_events
		WHERE transaction_id = $1
		ORDER BY timestamp ASC
	`

	var events []models.TransactionEvent
	err := r.db.SelectContext(ctx, &events, query, transactionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction events: %w", err)
	}

	return events, nil
}

// DeleteTransaction soft deletes a transaction
func (r *OptimizedTransactionRepository) DeleteTransaction(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE transactions SET
			deleted_at = $2
		WHERE id = $1
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, id, now)
	if err != nil {
		return fmt.Errorf("failed to delete transaction: %w", err)
	}

	return nil
}

// CreateWalletAccount creates a new wallet account
func (r *OptimizedTransactionRepository) CreateWalletAccount(ctx context.Context, wallet *models.WalletAccount) error {
	query := `
		INSERT INTO wallet_accounts (
			id, service, address, encrypted_private_key, public_key, created_at, updated_at
		) VALUES (
			:id, :service, :address, :encrypted_private_key, :public_key, :created_at, :updated_at
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, wallet)
	if err != nil {
		return fmt.Errorf("failed to create wallet account: %w", err)
	}

	return nil
}

// GetWalletByService retrieves a wallet account by service (one per service)
func (r *OptimizedTransactionRepository) GetWalletByService(ctx context.Context, service string) (*models.WalletAccount, error) {
	query := `
		SELECT * FROM wallet_accounts
		WHERE service = $1 AND deleted_at IS NULL
		LIMIT 1
	`

	var wallet models.WalletAccount
	err := r.db.GetContext(ctx, &wallet, query, service)
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet by service: %w", err)
	}

	return &wallet, nil
}

// GetWalletByAddress retrieves a wallet account by address
func (r *OptimizedTransactionRepository) GetWalletByAddress(ctx context.Context, address string) (*models.WalletAccount, error) {
	query := `
		SELECT * FROM wallet_accounts
		WHERE address = $1 AND deleted_at IS NULL
	`

	var wallet models.WalletAccount
	err := r.db.GetContext(ctx, &wallet, query, address)
	if err != nil {
		return nil, fmt.Errorf("failed to get wallet by address: %w", err)
	}

	return &wallet, nil
}

// ListWalletsByService retrieves all wallet accounts for a service
func (r *OptimizedTransactionRepository) ListWalletsByService(ctx context.Context, service string) ([]models.WalletAccount, error) {
	query := `
		SELECT * FROM wallet_accounts
		WHERE service = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC
	`

	var wallets []models.WalletAccount
	err := r.db.SelectContext(ctx, &wallets, query, service)
	if err != nil {
		return nil, fmt.Errorf("failed to list wallets by service: %w", err)
	}

	return wallets, nil
}

// DeleteWalletAccount soft deletes a wallet account
func (r *OptimizedTransactionRepository) DeleteWalletAccount(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE wallet_accounts SET
			deleted_at = $2
		WHERE id = $1
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, id, now)
	if err != nil {
		return fmt.Errorf("failed to delete wallet account: %w", err)
	}

	return nil
}
