package repositories

import (
	"github.com/jmoiron/sqlx"
	"github.com/willtech-services/service_layer/internal/database"
	"github.com/willtech-services/service_layer/internal/models"
)

// NewOracleRepository creates a new oracle repository
func NewOracleRepository(db *sqlx.DB) models.OracleRepository {
	return database.NewOracleRepository(db)
} 