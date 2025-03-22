// Package repository provides a unified interface for data repositories.
package repository

import (
	"database/sql"

	"github.com/jmoiron/sqlx"

	"github.com/R3E-Network/service_layer/internal/database/repositories"
	"github.com/R3E-Network/service_layer/internal/models"
)

// NewUserRepository creates a new user repository
func NewUserRepository(db interface{}) models.UserRepository {
	switch d := db.(type) {
	case *sql.DB:
		return repositories.NewUserRepository(d)
	case *sqlx.DB:
		return repositories.NewUserRepository(d.DB)
	default:
		panic("unsupported database type")
	}
}

// NewFunctionRepository creates a new function repository
func NewFunctionRepository(db interface{}) models.FunctionRepository {
	switch d := db.(type) {
	case *sql.DB:
		return repositories.NewFunctionRepository(d)
	case *sqlx.DB:
		return repositories.NewFunctionRepository(d.DB)
	default:
		panic("unsupported database type")
	}
}

// NewExecutionRepository creates a new execution repository
func NewExecutionRepository(db interface{}) models.ExecutionRepository {
	switch d := db.(type) {
	case *sql.DB:
		return repositories.NewExecutionRepository(d)
	case *sqlx.DB:
		return repositories.NewExecutionRepository(d.DB)
	default:
		panic("unsupported database type")
	}
}

// NewTriggerRepository creates a new trigger repository
func NewTriggerRepository(db interface{}) models.TriggerRepository {
	switch d := db.(type) {
	case *sql.DB:
		return repositories.NewTriggerRepository(d)
	case *sqlx.DB:
		return repositories.NewTriggerRepository(d.DB)
	default:
		panic("unsupported database type")
	}
}

// NewOracleRepository creates a new oracle repository
func NewOracleRepository(db interface{}) models.OracleRepository {
	switch d := db.(type) {
	case *sqlx.DB:
		return repositories.NewOracleRepository(d)
	default:
		panic("unsupported database type, must be *sqlx.DB")
	}
}

// NewSecretRepository creates a new secret repository
func NewSecretRepository(db interface{}) models.SecretRepository {
	switch d := db.(type) {
	case *sql.DB:
		return repositories.NewSecretRepository(d)
	case *sqlx.DB:
		return repositories.NewSecretRepository(d.DB)
	default:
		panic("unsupported database type")
	}
}

// NewRandomRepository creates a new random repository
func NewRandomRepository(db interface{}) models.RandomRepository {
	switch d := db.(type) {
	case *sqlx.DB:
		return repositories.NewRandomRepository(d)
	default:
		panic("unsupported database type, must be *sqlx.DB")
	}
}

// NewGasBankRepository creates a new gas bank repository
func NewGasBankRepository(db interface{}) models.GasBankRepository {
	switch d := db.(type) {
	case *sql.DB:
		return repositories.NewGasBankRepository(d)
	case *sqlx.DB:
		return repositories.NewGasBankRepository(d.DB)
	default:
		panic("unsupported database type")
	}
}
