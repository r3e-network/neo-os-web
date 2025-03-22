package performance

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/database"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// TestDatabasePerformance benchmarks database operations
func BenchmarkDatabaseOperations(b *testing.B) {
	// Skip this test if no database connection is available
	b.Skip("This test requires a real database connection and should be run manually")

	// Setup database connection
	log := logger.NewLogger("test", "debug")
	db, err := database.NewDatabase("postgresql://user:password@localhost:5432/testdb?sslmode=disable", log)
	if err != nil {
		b.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test function CRUD operations
	b.Run("FunctionCRUD", func(b *testing.B) {
		benchmarkFunctionCRUD(b, db, log)
	})

	// Test transaction CRUD operations
	b.Run("TransactionCRUD", func(b *testing.B) {
		benchmarkTransactionCRUD(b, db, log)
	})

	// Test complex queries
	b.Run("ComplexQueries", func(b *testing.B) {
		benchmarkComplexQueries(b, db, log)
	})

	// Test concurrent operations
	b.Run("ConcurrentOperations", func(b *testing.B) {
		benchmarkConcurrentOperations(b, db, log)
	})
}

// benchmarkFunctionCRUD tests CRUD operations for functions
func benchmarkFunctionCRUD(b *testing.B, db *sql.DB, log *logger.Logger) {
	// Create function repository
	repo := database.NewFunctionRepository(db, log)

	// Reset the timer before the benchmark loop
	b.ResetTimer()

	// Run the benchmark
	for i := 0; i < b.N; i++ {
		// Generate a unique ID for this iteration
		id := fmt.Sprintf("test-function-%d-%d", b.N, i)

		// Create a test function
		fn := &models.Function{
			ID:          id,
			Name:        fmt.Sprintf("Test Function %d", i),
			Description: "Function for benchmark testing",
			SourceCode:  "function main(params) { return { result: 'test' }; }",
			Version:     1,
			UserID:      1,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		// Create
		err := repo.Create(fn)
		if err != nil {
			b.Fatalf("Failed to create function: %v", err)
		}

		// Read
		readFn, err := repo.GetByID(id)
		if err != nil {
			b.Fatalf("Failed to get function: %v", err)
		}
		if readFn.ID != id {
			b.Fatalf("Invalid function ID: expected %s, got %s", id, readFn.ID)
		}

		// Update
		readFn.Description = "Updated description"
		err = repo.Update(readFn)
		if err != nil {
			b.Fatalf("Failed to update function: %v", err)
		}

		// Delete
		err = repo.Delete(id)
		if err != nil {
			b.Fatalf("Failed to delete function: %v", err)
		}
	}
}

// benchmarkTransactionCRUD tests CRUD operations for transactions
func benchmarkTransactionCRUD(b *testing.B, db *sql.DB, log *logger.Logger) {
	// Create transaction repository
	repo := database.NewTransactionRepository(db, log)

	// Reset the timer before the benchmark loop
	b.ResetTimer()

	// Run the benchmark
	for i := 0; i < b.N; i++ {
		// Generate a unique ID for this iteration
		id := fmt.Sprintf("test-tx-%d-%d", b.N, i)

		// Create a test transaction
		tx := &models.Transaction{
			ID:        id,
			UserID:    1,
			Type:      "test",
			Status:    "pending",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Create
		err := repo.Create(tx)
		if err != nil {
			b.Fatalf("Failed to create transaction: %v", err)
		}

		// Read
		readTx, err := repo.GetByID(id)
		if err != nil {
			b.Fatalf("Failed to get transaction: %v", err)
		}
		if readTx.ID != id {
			b.Fatalf("Invalid transaction ID: expected %s, got %s", id, readTx.ID)
		}

		// Update
		readTx.Status = "confirmed"
		err = repo.Update(readTx)
		if err != nil {
			b.Fatalf("Failed to update transaction: %v", err)
		}

		// Delete
		err = repo.Delete(id)
		if err != nil {
			b.Fatalf("Failed to delete transaction: %v", err)
		}
	}
}

// benchmarkComplexQueries tests complex database queries
func benchmarkComplexQueries(b *testing.B, db *sql.DB, log *logger.Logger) {
	// Create repositories
	txRepo := database.NewTransactionRepository(db, log)
	functionRepo := database.NewFunctionRepository(db, log)

	// Create test data for querying
	setupTestData(b, db, log)

	// Reset the timer before the benchmark loop
	b.ResetTimer()

	// Run the benchmark
	for i := 0; i < b.N; i++ {
		// Query transactions with filtering and pagination
		ctx := context.Background()
		filter := &models.TransactionFilter{
			UserID:   1,
			Status:   "pending",
			FromDate: time.Now().Add(-24 * time.Hour),
			ToDate:   time.Now(),
		}
		pagination := &models.Pagination{
			Offset: 0,
			Limit:  20,
		}

		// Execute complex query
		_, err := txRepo.Search(ctx, filter, pagination)
		if err != nil {
			b.Fatalf("Failed to search transactions: %v", err)
		}

		// Query functions with filtering and pagination
		fnFilter := &models.FunctionFilter{
			UserID:      1,
			NamePattern: "test%",
		}

		// Execute complex query
		_, err = functionRepo.Search(ctx, fnFilter, pagination)
		if err != nil {
			b.Fatalf("Failed to search functions: %v", err)
		}
	}
}

// benchmarkConcurrentOperations tests database operations under concurrent load
func benchmarkConcurrentOperations(b *testing.B, db *sql.DB, log *logger.Logger) {
	// Create repositories
	txRepo := database.NewTransactionRepository(db, log)

	// Reset the timer before the benchmark loop
	b.ResetTimer()

	// Run the benchmark with concurrency
	b.SetParallelism(10) // 10 concurrent workers
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Generate a unique ID for this iteration
			id := fmt.Sprintf("concurrent-tx-%d", time.Now().UnixNano())

			// Create a test transaction
			tx := &models.Transaction{
				ID:        id,
				UserID:    1,
				Type:      "test",
				Status:    "pending",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}

			// Create
			err := txRepo.Create(tx)
			if err != nil {
				b.Fatalf("Failed to create transaction: %v", err)
			}

			// Read
			_, err = txRepo.GetByID(id)
			if err != nil {
				b.Fatalf("Failed to get transaction: %v", err)
			}

			// Update
			tx.Status = "confirmed"
			err = txRepo.Update(tx)
			if err != nil {
				b.Fatalf("Failed to update transaction: %v", err)
			}

			// Delete
			err = txRepo.Delete(id)
			if err != nil {
				b.Fatalf("Failed to delete transaction: %v", err)
			}
		}
	})
}

// setupTestData creates test data for queries
func setupTestData(b *testing.B, db *sql.DB, log *logger.Logger) {
	// Create repositories
	txRepo := database.NewTransactionRepository(db, log)
	functionRepo := database.NewFunctionRepository(db, log)

	// Create test transactions
	for i := 0; i < 100; i++ {
		// Create status based on index
		status := "pending"
		if i%3 == 0 {
			status = "confirmed"
		} else if i%3 == 1 {
			status = "failed"
		}

		// Create a test transaction
		tx := &models.Transaction{
			ID:        fmt.Sprintf("query-test-tx-%d", i),
			UserID:    1,
			Type:      "test",
			Status:    status,
			CreatedAt: time.Now().Add(-time.Duration(i) * time.Hour),
			UpdatedAt: time.Now(),
		}

		// Create transaction
		err := txRepo.Create(tx)
		if err != nil {
			b.Fatalf("Failed to create test transaction: %v", err)
		}
	}

	// Create test functions
	for i := 0; i < 100; i++ {
		// Create a test function
		fn := &models.Function{
			ID:          fmt.Sprintf("query-test-function-%d", i),
			Name:        fmt.Sprintf("Test Function %d", i),
			Description: "Function for query testing",
			SourceCode:  "function main(params) { return { result: 'test' }; }",
			Version:     1,
			UserID:      1,
			CreatedAt:   time.Now().Add(-time.Duration(i) * time.Hour),
			UpdatedAt:   time.Now(),
		}

		// Create function
		err := functionRepo.Create(fn)
		if err != nil {
			b.Fatalf("Failed to create test function: %v", err)
		}
	}
}