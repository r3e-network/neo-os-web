package repositories

import (
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/willtech-services/service_layer/internal/models"
)

// PostgresUserRepository is an implementation of UserRepository using PostgreSQL
type PostgresUserRepository struct {
	db *sql.DB
}

// NewUserRepository creates a new PostgreSQL implementation of UserRepository
func NewUserRepository(db *sql.DB) models.UserRepository {
	return &PostgresUserRepository{
		db: db,
	}
}

// Create creates a new user
func (r *PostgresUserRepository) Create(user *models.User) error {
	// Generate API key
	apiKey := uuid.New().String()

	// Insert user into database
	query := `
		INSERT INTO users (username, email, password_hash, api_key, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	err := r.db.QueryRow(
		query,
		user.Username,
		user.Email,
		user.PasswordHash,
		apiKey,
		user.IsActive,
		user.CreatedAt,
		user.UpdatedAt,
	).Scan(&user.ID)

	if err != nil {
		return err
	}

	// Set API key in the user model
	user.APIKey = apiKey

	return nil
}

// GetByID gets a user by ID
func (r *PostgresUserRepository) GetByID(id int) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, api_key, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	user := &models.User{}
	err := r.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.APIKey,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, err
	}

	return user, nil
}

// GetByUsername gets a user by username
func (r *PostgresUserRepository) GetByUsername(username string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, api_key, is_active, created_at, updated_at
		FROM users
		WHERE username = $1
	`
	user := &models.User{}
	err := r.db.QueryRow(query, username).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.APIKey,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, err
	}

	return user, nil
}

// GetByEmail gets a user by email
func (r *PostgresUserRepository) GetByEmail(email string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, api_key, is_active, created_at, updated_at
		FROM users
		WHERE email = $1
	`
	user := &models.User{}
	err := r.db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.APIKey,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, err
	}

	return user, nil
}

// GetByAPIKey gets a user by API key
func (r *PostgresUserRepository) GetByAPIKey(apiKey string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, api_key, is_active, created_at, updated_at
		FROM users
		WHERE api_key = $1
	`
	user := &models.User{}
	err := r.db.QueryRow(query, apiKey).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.APIKey,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, err
	}

	return user, nil
}

// Update updates a user
func (r *PostgresUserRepository) Update(user *models.User) error {
	query := `
		UPDATE users
		SET username = $1, email = $2, password_hash = $3, is_active = $4, updated_at = $5
		WHERE id = $6
	`
	now := time.Now()
	user.UpdatedAt = now

	_, err := r.db.Exec(
		query,
		user.Username,
		user.Email,
		user.PasswordHash,
		user.IsActive,
		now,
		user.ID,
	)

	return err
}

// Delete deletes a user
func (r *PostgresUserRepository) Delete(id int) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}