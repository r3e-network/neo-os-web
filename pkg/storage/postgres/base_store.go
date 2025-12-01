// Package postgres provides PostgreSQL storage implementations.
package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/pkg/storage"
)

// BaseStore provides common PostgreSQL operations that can be embedded
// by service-specific stores to reduce boilerplate.
type BaseStore struct {
	db        *sql.DB
	tableName string
}

// NewBaseStore creates a new BaseStore for the given table.
func NewBaseStore(db *sql.DB, tableName string) *BaseStore {
	return &BaseStore{
		db:        db,
		tableName: tableName,
	}
}

// DB returns the underlying database connection.
func (s *BaseStore) DB() *sql.DB {
	return s.db
}

// TableName returns the table name.
func (s *BaseStore) TableName() string {
	return s.tableName
}

// Querier returns the appropriate querier for the context.
// If a transaction is active, it returns the transaction; otherwise, the db.
func (s *BaseStore) Querier(ctx context.Context) storage.Querier {
	if tx := TxFromContext(ctx); tx != nil {
		return tx
	}
	return s.db
}

// --- Transaction Support ---

type txKey struct{}

// TxFromContext extracts a transaction from context.
func TxFromContext(ctx context.Context) *sql.Tx {
	if tx, ok := ctx.Value(txKey{}).(*sql.Tx); ok {
		return tx
	}
	return nil
}

// ContextWithTx returns a context with the transaction attached.
func ContextWithTx(ctx context.Context, tx *sql.Tx) context.Context {
	return context.WithValue(ctx, txKey{}, tx)
}

// BeginTx starts a new transaction.
func (s *BaseStore) BeginTx(ctx context.Context) (context.Context, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ctx, fmt.Errorf("begin transaction: %w", err)
	}
	return ContextWithTx(ctx, tx), nil
}

// CommitTx commits the current transaction.
func (s *BaseStore) CommitTx(ctx context.Context) error {
	tx := TxFromContext(ctx)
	if tx == nil {
		return fmt.Errorf("no transaction in context")
	}
	return tx.Commit()
}

// RollbackTx rolls back the current transaction.
func (s *BaseStore) RollbackTx(ctx context.Context) error {
	tx := TxFromContext(ctx)
	if tx == nil {
		return nil // No transaction to rollback
	}
	return tx.Rollback()
}

// WithTx executes a function within a transaction.
func (s *BaseStore) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	txCtx, err := s.BeginTx(ctx)
	if err != nil {
		return err
	}

	if err := fn(txCtx); err != nil {
		_ = s.RollbackTx(txCtx)
		return err
	}

	return s.CommitTx(txCtx)
}

// --- Query Helpers ---

// ExecContext executes a query that doesn't return rows.
func (s *BaseStore) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return s.Querier(ctx).ExecContext(ctx, query, args...)
}

// QueryContext executes a query that returns rows.
func (s *BaseStore) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return s.Querier(ctx).QueryContext(ctx, query, args...)
}

// QueryRowContext executes a query that returns at most one row.
func (s *BaseStore) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return s.Querier(ctx).QueryRowContext(ctx, query, args...)
}

// --- Common Operations ---

// Exists checks if a record exists by ID.
func (s *BaseStore) Exists(ctx context.Context, id string) (bool, error) {
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE id = $1)", s.tableName)
	var exists bool
	err := s.QueryRowContext(ctx, query, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check exists: %w", err)
	}
	return exists, nil
}

// ExistsByAccountID checks if a record exists for an account.
func (s *BaseStore) ExistsByAccountID(ctx context.Context, id, accountID string) (bool, error) {
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE id = $1 AND account_id = $2)", s.tableName)
	var exists bool
	err := s.QueryRowContext(ctx, query, id, accountID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check exists by account: %w", err)
	}
	return exists, nil
}

// DeleteByID deletes a record by ID.
func (s *BaseStore) DeleteByID(ctx context.Context, id string) error {
	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1", s.tableName)
	result, err := s.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteByAccountID deletes a record by ID and account ID.
func (s *BaseStore) DeleteByAccountID(ctx context.Context, id, accountID string) error {
	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1 AND account_id = $2", s.tableName)
	result, err := s.ExecContext(ctx, query, id, accountID)
	if err != nil {
		return fmt.Errorf("delete by account: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CountByAccountID counts records for an account.
func (s *BaseStore) CountByAccountID(ctx context.Context, accountID string) (int64, error) {
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE account_id = $1", s.tableName)
	var count int64
	err := s.QueryRowContext(ctx, query, accountID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count: %w", err)
	}
	return count, nil
}

// CountAll counts all records in the table.
func (s *BaseStore) CountAll(ctx context.Context) (int64, error) {
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", s.tableName)
	var count int64
	err := s.QueryRowContext(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count all: %w", err)
	}
	return count, nil
}

// --- Query Builder ---

// SelectBuilder helps build SELECT queries.
type SelectBuilder struct {
	table      string
	columns    []string
	conditions []string
	args       []any
	orderBy    []string
	limit      int
	offset     int
	argIndex   int
}

// NewSelectBuilder creates a new SelectBuilder.
func NewSelectBuilder(table string) *SelectBuilder {
	return &SelectBuilder{
		table:    table,
		argIndex: 1,
	}
}

// Columns sets the columns to select.
func (b *SelectBuilder) Columns(cols ...string) *SelectBuilder {
	b.columns = cols
	return b
}

// Where adds a WHERE condition.
func (b *SelectBuilder) Where(condition string, args ...any) *SelectBuilder {
	// Replace ? with $N for PostgreSQL
	for _, arg := range args {
		condition = strings.Replace(condition, "?", fmt.Sprintf("$%d", b.argIndex), 1)
		b.args = append(b.args, arg)
		b.argIndex++
	}
	b.conditions = append(b.conditions, condition)
	return b
}

// WhereEq adds an equality condition.
func (b *SelectBuilder) WhereEq(column string, value any) *SelectBuilder {
	return b.Where(fmt.Sprintf("%s = ?", column), value)
}

// WhereIn adds an IN condition.
func (b *SelectBuilder) WhereIn(column string, values []any) *SelectBuilder {
	if len(values) == 0 {
		return b.Where("1 = 0") // Always false
	}
	placeholders := make([]string, len(values))
	for i, v := range values {
		placeholders[i] = fmt.Sprintf("$%d", b.argIndex)
		b.args = append(b.args, v)
		b.argIndex++
	}
	b.conditions = append(b.conditions, fmt.Sprintf("%s IN (%s)", column, strings.Join(placeholders, ", ")))
	return b
}

// OrderBy adds an ORDER BY clause.
func (b *SelectBuilder) OrderBy(column string, desc bool) *SelectBuilder {
	order := "ASC"
	if desc {
		order = "DESC"
	}
	b.orderBy = append(b.orderBy, fmt.Sprintf("%s %s", column, order))
	return b
}

// Limit sets the LIMIT clause.
func (b *SelectBuilder) Limit(n int) *SelectBuilder {
	b.limit = n
	return b
}

// Offset sets the OFFSET clause.
func (b *SelectBuilder) Offset(n int) *SelectBuilder {
	b.offset = n
	return b
}

// Build returns the final SQL and arguments.
func (b *SelectBuilder) Build() (string, []any) {
	cols := "*"
	if len(b.columns) > 0 {
		cols = strings.Join(b.columns, ", ")
	}

	query := fmt.Sprintf("SELECT %s FROM %s", cols, b.table)

	if len(b.conditions) > 0 {
		query += " WHERE " + strings.Join(b.conditions, " AND ")
	}

	if len(b.orderBy) > 0 {
		query += " ORDER BY " + strings.Join(b.orderBy, ", ")
	}

	if b.limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", b.limit)
	}

	if b.offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", b.offset)
	}

	return query, b.args
}

// --- Time Helpers ---

// NullTimeToPtr converts sql.NullTime to *time.Time.
func NullTimeToPtr(nt sql.NullTime) *time.Time {
	if nt.Valid {
		return &nt.Time
	}
	return nil
}

// PtrToNullTime converts *time.Time to sql.NullTime.
func PtrToNullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

// NullStringToPtr converts sql.NullString to *string.
func NullStringToPtr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}

// PtrToNullString converts *string to sql.NullString.
func PtrToNullString(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

// NullInt64ToPtr converts sql.NullInt64 to *int64.
func NullInt64ToPtr(ni sql.NullInt64) *int64 {
	if ni.Valid {
		return &ni.Int64
	}
	return nil
}

// PtrToNullInt64 converts *int64 to sql.NullInt64.
func PtrToNullInt64(i *int64) sql.NullInt64 {
	if i == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *i, Valid: true}
}
