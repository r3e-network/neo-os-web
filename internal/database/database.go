package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Database represents the database connection
type Database struct {
	db     *sql.DB
	config *config.DatabaseConfig
	logger *logger.Logger
}

// New creates a new database connection
func New(cfg *config.DatabaseConfig, log *logger.Logger) (*Database, error) {
	// Create database connection
	db, err := sql.Open("postgres", cfg.ConnectionString())
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

	// Check connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Create database instance
	database := &Database{
		db:     db,
		config: cfg,
		logger: log,
	}

	log.Info("Database connection established")
	return database, nil
}

// DB returns the underlying sql.DB instance
func (d *Database) DB() *sql.DB {
	return d.db
}

// Close closes the database connection
func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

// RunMigrations runs database migrations
func (d *Database) RunMigrations(migrationsPath string) error {
	driver, err := postgres.WithInstance(d.db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		fmt.Sprintf("file://%s", migrationsPath),
		"postgres", driver)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	d.logger.Info("Database migrations applied successfully")
	return nil
}

// Transaction executes a function within a database transaction
func (d *Database) Transaction(fn func(*sql.Tx) error) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}

	defer func() {
		if p := recover(); p != nil {
			// A panic occurred, rollback and repanic
			tx.Rollback()
			panic(p)
		} else if err != nil {
			// An error occurred, rollback
			tx.Rollback()
		} else {
			// All good, commit
			err = tx.Commit()
		}
	}()

	err = fn(tx)
	return err
}