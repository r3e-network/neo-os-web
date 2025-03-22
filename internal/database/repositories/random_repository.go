package repositories

import (
	"github.com/R3E-Network/service_layer/internal/database"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/jmoiron/sqlx"
)

// NewRandomRepository creates a new random repository
func NewRandomRepository(db *sqlx.DB) models.RandomRepository {
	return database.NewRandomRepository(db)
}
