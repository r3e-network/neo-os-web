package repositories

import (
	"github.com/R3E-Network/service_layer/internal/database"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/jmoiron/sqlx"
)

// NewOracleRepository creates a new oracle repository
func NewOracleRepository(db *sqlx.DB) models.OracleRepository {
	return database.NewOracleRepository(db)
}
