package repositories

import (
	"database/sql"
	"errors"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
)

// PostgresSecretRepository is an implementation of SecretRepository using PostgreSQL
type PostgresSecretRepository struct {
	db *sql.DB
}

// NewSecretRepository creates a new PostgreSQL implementation of SecretRepository
func NewSecretRepository(db *sql.DB) models.SecretRepository {
	return &PostgresSecretRepository{
		db: db,
	}
}

// Create creates a new secret
func (r *PostgresSecretRepository) Create(secret *models.Secret) error {
	query := `
		INSERT INTO secrets (user_id, name, value, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`
	err := r.db.QueryRow(
		query,
		secret.UserID,
		secret.Name,
		secret.Value,
		1, // Initial version
		secret.CreatedAt,
		secret.UpdatedAt,
	).Scan(&secret.ID)

	return err
}

// GetByID gets a secret by ID
func (r *PostgresSecretRepository) GetByID(id int) (*models.Secret, error) {
	query := `
		SELECT id, user_id, name, value, version, created_at, updated_at
		FROM secrets
		WHERE id = $1
	`
	secret := &models.Secret{}
	err := r.db.QueryRow(query, id).Scan(
		&secret.ID,
		&secret.UserID,
		&secret.Name,
		&secret.Value,
		&secret.Version,
		&secret.CreatedAt,
		&secret.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Secret not found
		}
		return nil, err
	}

	return secret, nil
}

// GetByUserIDAndName gets a secret by user ID and name
func (r *PostgresSecretRepository) GetByUserIDAndName(userID int, name string) (*models.Secret, error) {
	query := `
		SELECT id, user_id, name, value, version, created_at, updated_at
		FROM secrets
		WHERE user_id = $1 AND name = $2
	`
	secret := &models.Secret{}
	err := r.db.QueryRow(query, userID, name).Scan(
		&secret.ID,
		&secret.UserID,
		&secret.Name,
		&secret.Value,
		&secret.Version,
		&secret.CreatedAt,
		&secret.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Secret not found
		}
		return nil, err
	}

	return secret, nil
}

// List lists secrets for a user
func (r *PostgresSecretRepository) List(userID int) ([]*models.Secret, error) {
	query := `
		SELECT id, user_id, name, version, created_at, updated_at
		FROM secrets
		WHERE user_id = $1
		ORDER BY name
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	secrets := []*models.Secret{}
	for rows.Next() {
		secret := &models.Secret{}
		err := rows.Scan(
			&secret.ID,
			&secret.UserID,
			&secret.Name,
			&secret.Version,
			&secret.CreatedAt,
			&secret.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		secrets = append(secrets, secret)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return secrets, nil
}

// Update updates a secret
func (r *PostgresSecretRepository) Update(secret *models.Secret) error {
	query := `
		UPDATE secrets
		SET value = $1, version = version + 1, updated_at = $2
		WHERE id = $3
		RETURNING version
	`
	now := time.Now()
	secret.UpdatedAt = now

	err := r.db.QueryRow(
		query,
		secret.Value,
		now,
		secret.ID,
	).Scan(&secret.Version)

	return err
}

// Delete deletes a secret
func (r *PostgresSecretRepository) Delete(id int) error {
	query := `DELETE FROM secrets WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
