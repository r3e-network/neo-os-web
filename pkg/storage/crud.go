// Package storage provides common storage interfaces and utilities.
package storage

import (
	"context"
	"database/sql"
	"time"
)

// Entity represents a storable entity with common fields.
// All domain types that need CRUD operations should embed or implement this.
type Entity interface {
	GetID() string
	GetAccountID() string
	SetCreatedAt(time.Time)
	SetUpdatedAt(time.Time)
}

// CRUDStore defines generic CRUD operations for any entity type.
// Services can embed this interface in their Store definitions to get
// standard CRUD operations without reimplementing them.
type CRUDStore[T Entity] interface {
	// Create inserts a new entity and returns it with generated fields populated.
	Create(ctx context.Context, entity T) (T, error)

	// Get retrieves an entity by ID.
	Get(ctx context.Context, id string) (T, error)

	// Update modifies an existing entity and returns the updated version.
	Update(ctx context.Context, entity T) (T, error)

	// Delete removes an entity by ID.
	Delete(ctx context.Context, id string) error

	// List returns entities for an account with pagination.
	List(ctx context.Context, accountID string, limit, offset int) ([]T, error)

	// Count returns the total number of entities for an account.
	Count(ctx context.Context, accountID string) (int64, error)
}

// ReadOnlyStore defines read-only operations for entities.
type ReadOnlyStore[T Entity] interface {
	Get(ctx context.Context, id string) (T, error)
	List(ctx context.Context, accountID string, limit, offset int) ([]T, error)
	Count(ctx context.Context, accountID string) (int64, error)
}

// WriteStore defines write operations for entities.
type WriteStore[T Entity] interface {
	Create(ctx context.Context, entity T) (T, error)
	Update(ctx context.Context, entity T) (T, error)
	Delete(ctx context.Context, id string) error
}

// TxStore provides transaction support for stores.
type TxStore interface {
	// BeginTx starts a new transaction.
	BeginTx(ctx context.Context) (context.Context, error)

	// CommitTx commits the current transaction.
	CommitTx(ctx context.Context) error

	// RollbackTx rolls back the current transaction.
	RollbackTx(ctx context.Context) error

	// WithTx executes a function within a transaction.
	// If the function returns an error, the transaction is rolled back.
	// Otherwise, it is committed.
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// QueryBuilder helps construct SQL queries with filters.
type QueryBuilder interface {
	// Where adds a WHERE condition.
	Where(condition string, args ...any) QueryBuilder

	// OrderBy adds an ORDER BY clause.
	OrderBy(column string, desc bool) QueryBuilder

	// Limit sets the LIMIT clause.
	Limit(n int) QueryBuilder

	// Offset sets the OFFSET clause.
	Offset(n int) QueryBuilder

	// Build returns the final SQL and arguments.
	Build() (string, []any)
}

// Scanner abstracts row scanning for database results.
type Scanner interface {
	Scan(dest ...any) error
}

// Querier abstracts database query execution.
type Querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// DBProvider provides access to the underlying database connection.
type DBProvider interface {
	DB() *sql.DB
	Querier(ctx context.Context) Querier
}

// Pagination holds pagination parameters.
type Pagination struct {
	Limit  int
	Offset int
}

// DefaultPagination returns default pagination settings.
func DefaultPagination() Pagination {
	return Pagination{
		Limit:  50,
		Offset: 0,
	}
}

// Normalize ensures pagination values are within acceptable bounds.
func (p Pagination) Normalize(maxLimit int) Pagination {
	if p.Limit <= 0 {
		p.Limit = 50
	}
	if p.Limit > maxLimit {
		p.Limit = maxLimit
	}
	if p.Offset < 0 {
		p.Offset = 0
	}
	return p
}

// ListResult wraps a list response with pagination metadata.
type ListResult[T any] struct {
	Items      []T   `json:"items"`
	Total      int64 `json:"total"`
	Limit      int   `json:"limit"`
	Offset     int   `json:"offset"`
	HasMore    bool  `json:"has_more"`
}

// NewListResult creates a ListResult from items and pagination info.
func NewListResult[T any](items []T, total int64, limit, offset int) ListResult[T] {
	return ListResult[T]{
		Items:   items,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		HasMore: int64(offset+len(items)) < total,
	}
}

// Filter represents a query filter condition.
type Filter struct {
	Field    string
	Operator string // =, !=, <, >, <=, >=, LIKE, IN, IS NULL, IS NOT NULL
	Value    any
}

// FilterSet is a collection of filters.
type FilterSet []Filter

// Add appends a filter to the set.
func (fs *FilterSet) Add(field, operator string, value any) {
	*fs = append(*fs, Filter{Field: field, Operator: operator, Value: value})
}

// Eq adds an equality filter.
func (fs *FilterSet) Eq(field string, value any) {
	fs.Add(field, "=", value)
}

// NotEq adds a not-equal filter.
func (fs *FilterSet) NotEq(field string, value any) {
	fs.Add(field, "!=", value)
}

// Like adds a LIKE filter.
func (fs *FilterSet) Like(field string, pattern string) {
	fs.Add(field, "LIKE", pattern)
}

// In adds an IN filter.
func (fs *FilterSet) In(field string, values any) {
	fs.Add(field, "IN", values)
}

// IsNull adds an IS NULL filter.
func (fs *FilterSet) IsNull(field string) {
	fs.Add(field, "IS NULL", nil)
}

// IsNotNull adds an IS NOT NULL filter.
func (fs *FilterSet) IsNotNull(field string) {
	fs.Add(field, "IS NOT NULL", nil)
}

// SortOrder represents a sort direction.
type SortOrder string

const (
	SortAsc  SortOrder = "ASC"
	SortDesc SortOrder = "DESC"
)

// Sort represents a sort specification.
type Sort struct {
	Field string
	Order SortOrder
}

// SortSet is a collection of sort specifications.
type SortSet []Sort

// Add appends a sort specification.
func (ss *SortSet) Add(field string, order SortOrder) {
	*ss = append(*ss, Sort{Field: field, Order: order})
}

// Asc adds an ascending sort.
func (ss *SortSet) Asc(field string) {
	ss.Add(field, SortAsc)
}

// Desc adds a descending sort.
func (ss *SortSet) Desc(field string) {
	ss.Add(field, SortDesc)
}

// QueryOptions combines filters, sorting, and pagination.
type QueryOptions struct {
	Filters    FilterSet
	Sorts      SortSet
	Pagination Pagination
}

// NewQueryOptions creates QueryOptions with defaults.
func NewQueryOptions() QueryOptions {
	return QueryOptions{
		Pagination: DefaultPagination(),
	}
}
