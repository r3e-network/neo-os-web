package repositories

import (
	"github.com/jmoiron/sqlx"
	"github.com/willtech-services/service_layer/internal/database"
	"github.com/willtech-services/service_layer/internal/models"
)

// NewRandomRepository creates a new random repository
func NewRandomRepository(db *sqlx.DB) models.RandomRepository {
	return database.NewRandomRepository(db)
} 