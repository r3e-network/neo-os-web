package database

import (
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog"
)

// RepositoryFactory provides methods to create repository instances
type RepositoryFactory struct {
	db     *sqlx.DB
	logger *zerolog.Logger
}

// NewRepositoryFactory creates a new repository factory
func NewRepositoryFactory(db *sqlx.DB, logger *zerolog.Logger) *RepositoryFactory {
	return &RepositoryFactory{
		db:     db,
		logger: logger,
	}
}

// CreateTransactionRepository creates a transaction repository instance
// useOptimized: if true, returns an optimized implementation that utilizes enhanced schema and query performance improvements
func (f *RepositoryFactory) CreateTransactionRepository(useOptimized bool) TransactionRepository {
	if useOptimized {
		return NewOptimizedTransactionRepository(f.db)
	}
	return NewSQLTransactionRepository(f.db)
}

// Additional repository factory methods can be added here as needed
