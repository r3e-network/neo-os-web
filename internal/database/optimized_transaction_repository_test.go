package database

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/models"
)

func TestOptimizedTransactionRepository_CreateTransaction(t *testing.T) {
	// Setup
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	repo := NewOptimizedTransactionRepository(sqlxDB)

	// Test transaction
	txID := uuid.New()
	now := time.Now()
	tx := &models.Transaction{
		ID:         txID,
		Hash:       "0x123",
		Service:    "test-service",
		Status:     models.TransactionStatusPending,
		Type:       models.TransactionTypeInvoke,
		GasPrice:   1000,
		SystemFee:  500,
		NetworkFee: 200,
		Sender:     "NeoAddress",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Expectations - note that we're checking for the additional fields (status_updated_at, event_count)
	mock.ExpectExec("INSERT INTO transactions").
		WithArgs(
			txID, "0x123", "test-service", nil, "", models.TransactionStatusPending,
			models.TransactionTypeInvoke, nil, int64(1000), int64(500), int64(200),
			"NeoAddress", now, now, now, 0,
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Execute
	err = repo.CreateTransaction(context.Background(), tx)

	// Assert
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestOptimizedTransactionRepository_ListTransactions(t *testing.T) {
	// Setup
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	repo := NewOptimizedTransactionRepository(sqlxDB)

	// Test data
	service := "test-service"
	status := models.TransactionStatusPending
	page := 1
	limit := 10

	// Create mock result rows
	rows := sqlmock.NewRows([]string{
		"id", "hash", "service", "entity_id", "entity_type",
		"status", "type", "data", "gas_consumed", "gas_price",
		"system_fee", "network_fee", "block_height", "block_time",
		"sender", "error", "result", "created_at", "updated_at",
		"deleted_at", "status_updated_at", "event_count",
	})

	txID := uuid.New()
	now := time.Now()
	rows.AddRow(
		txID, "0x123", "test-service", nil, "",
		models.TransactionStatusPending, models.TransactionTypeInvoke, nil,
		nil, 1000, 500, 200, nil, nil, "NeoAddress", "", nil,
		now, now, nil, now, 0,
	)

	// Set expectations for count query
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM transactions").
		WithArgs(service, status).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// Set expectations for the main query
	mock.ExpectQuery("SELECT \\* FROM transactions").
		WithArgs(service, status, limit, 0).
		WillReturnRows(rows)

	// Execute
	result, err := repo.ListTransactions(context.Background(), service, status, nil, page, limit)

	// Assert
	assert.NoError(t, err)
	assert.Equal(t, 1, result.Total)
	assert.Equal(t, page, result.Page)
	assert.Equal(t, limit, result.Limit)
	assert.Len(t, result.Transactions, 1)
	assert.Equal(t, txID, result.Transactions[0].ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestOptimizedTransactionRepository_AddTransactionEvent(t *testing.T) {
	// Setup
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	repo := NewOptimizedTransactionRepository(sqlxDB)

	// Test data
	eventID := uuid.New()
	txID := uuid.New()
	now := time.Now()
	details, _ := json.Marshal(map[string]string{"key": "value"})

	event := &models.TransactionEvent{
		ID:            eventID,
		TransactionID: txID,
		Status:        models.TransactionStatusConfirmed,
		Details:       details,
		Timestamp:     now,
	}

	// Expectations
	mock.ExpectExec("INSERT INTO transaction_events").
		WithArgs(eventID, txID, models.TransactionStatusConfirmed, details, now).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Execute
	err = repo.AddTransactionEvent(context.Background(), event)

	// Assert
	assert.NoError(t, err)
	// The trigger that updates the transaction.event_count field will be handled by the database
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestOptimizedTransactionRepository_UpdateTransactionStatus(t *testing.T) {
	// Setup
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	repo := NewOptimizedTransactionRepository(sqlxDB)

	// Test data
	txID := uuid.New()
	status := models.TransactionStatusConfirmed
	result := json.RawMessage(`{"success":true}`)
	gasConsumed := int64(100)
	blockHeight := int64(12345)
	blockTime := time.Now()
	errMsg := ""

	// Expectations - note that we don't explicitly update status_updated_at since it's handled by the trigger
	mock.ExpectExec("UPDATE transactions SET").
		WithArgs(txID, status, result, &gasConsumed, &blockHeight, &blockTime, errMsg, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Execute
	err = repo.UpdateTransactionStatus(
		context.Background(),
		txID,
		status,
		result,
		&gasConsumed,
		&blockHeight,
		&blockTime,
		errMsg,
	)

	// Assert
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}
