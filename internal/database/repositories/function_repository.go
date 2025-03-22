package repositories

import (
	"database/sql"
	"errors"
	"time"

	"github.com/willtech-services/service_layer/internal/models"
)

// PostgresFunctionRepository is an implementation of FunctionRepository using PostgreSQL
type PostgresFunctionRepository struct {
	db *sql.DB
}

// NewFunctionRepository creates a new PostgreSQL implementation of FunctionRepository
func NewFunctionRepository(db *sql.DB) models.FunctionRepository {
	return &PostgresFunctionRepository{
		db: db,
	}
}

// Create creates a new function
func (r *PostgresFunctionRepository) Create(function *models.Function) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Insert function into database
	query := `
		INSERT INTO functions (user_id, name, description, source_code, version, status, timeout, memory, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`
	err = tx.QueryRow(
		query,
		function.UserID,
		function.Name,
		function.Description,
		function.SourceCode,
		1, // Initial version
		function.Status,
		function.Timeout,
		function.Memory,
		function.CreatedAt,
		function.UpdatedAt,
	).Scan(&function.ID)

	if err != nil {
		return err
	}

	// Set secrets if provided
	if len(function.Secrets) > 0 {
		err = r.setSecretsTx(tx, function.ID, function.Secrets)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetByID gets a function by ID
func (r *PostgresFunctionRepository) GetByID(id int) (*models.Function, error) {
	query := `
		SELECT id, user_id, name, description, source_code, version, status, timeout, memory, execution_count, last_execution, created_at, updated_at
		FROM functions
		WHERE id = $1
	`
	function := &models.Function{}
	var lastExecution sql.NullTime

	err := r.db.QueryRow(query, id).Scan(
		&function.ID,
		&function.UserID,
		&function.Name,
		&function.Description,
		&function.SourceCode,
		&function.Version,
		&function.Status,
		&function.Timeout,
		&function.Memory,
		&function.ExecutionCount,
		&lastExecution,
		&function.CreatedAt,
		&function.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Function not found
		}
		return nil, err
	}

	if lastExecution.Valid {
		function.LastExecution = lastExecution.Time
	}

	// Get secrets
	secrets, err := r.GetSecrets(function.ID)
	if err != nil {
		return nil, err
	}
	function.Secrets = secrets

	return function, nil
}

// GetByUserIDAndName gets a function by user ID and name
func (r *PostgresFunctionRepository) GetByUserIDAndName(userID int, name string) (*models.Function, error) {
	query := `
		SELECT id, user_id, name, description, source_code, version, status, timeout, memory, execution_count, last_execution, created_at, updated_at
		FROM functions
		WHERE user_id = $1 AND name = $2
	`
	function := &models.Function{}
	var lastExecution sql.NullTime

	err := r.db.QueryRow(query, userID, name).Scan(
		&function.ID,
		&function.UserID,
		&function.Name,
		&function.Description,
		&function.SourceCode,
		&function.Version,
		&function.Status,
		&function.Timeout,
		&function.Memory,
		&function.ExecutionCount,
		&lastExecution,
		&function.CreatedAt,
		&function.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Function not found
		}
		return nil, err
	}

	if lastExecution.Valid {
		function.LastExecution = lastExecution.Time
	}

	// Get secrets
	secrets, err := r.GetSecrets(function.ID)
	if err != nil {
		return nil, err
	}
	function.Secrets = secrets

	return function, nil
}

// List lists functions for a user
func (r *PostgresFunctionRepository) List(userID int, offset, limit int) ([]*models.Function, error) {
	query := `
		SELECT id, user_id, name, description, version, status, timeout, memory, execution_count, last_execution, created_at, updated_at
		FROM functions
		WHERE user_id = $1
		ORDER BY name
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	functions := []*models.Function{}
	for rows.Next() {
		function := &models.Function{}
		var lastExecution sql.NullTime

		err := rows.Scan(
			&function.ID,
			&function.UserID,
			&function.Name,
			&function.Description,
			&function.Version,
			&function.Status,
			&function.Timeout,
			&function.Memory,
			&function.ExecutionCount,
			&lastExecution,
			&function.CreatedAt,
			&function.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if lastExecution.Valid {
			function.LastExecution = lastExecution.Time
		}

		functions = append(functions, function)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Get secrets for each function
	for _, function := range functions {
		secrets, err := r.GetSecrets(function.ID)
		if err != nil {
			return nil, err
		}
		function.Secrets = secrets
	}

	return functions, nil
}

// Update updates a function
func (r *PostgresFunctionRepository) Update(function *models.Function) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		UPDATE functions
		SET name = $1, description = $2, source_code = $3, version = version + 1, status = $4, timeout = $5, memory = $6, updated_at = $7
		WHERE id = $8
		RETURNING version
	`
	now := time.Now()
	function.UpdatedAt = now

	err = tx.QueryRow(
		query,
		function.Name,
		function.Description,
		function.SourceCode,
		function.Status,
		function.Timeout,
		function.Memory,
		now,
		function.ID,
	).Scan(&function.Version)

	if err != nil {
		return err
	}

	// Update secrets
	err = r.deleteSecretsTx(tx, function.ID)
	if err != nil {
		return err
	}

	if len(function.Secrets) > 0 {
		err = r.setSecretsTx(tx, function.ID, function.Secrets)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// Delete deletes a function
func (r *PostgresFunctionRepository) Delete(id int) error {
	query := `DELETE FROM functions WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// IncrementExecutionCount increments the execution count for a function
func (r *PostgresFunctionRepository) IncrementExecutionCount(id int) error {
	query := `
		UPDATE functions
		SET execution_count = execution_count + 1
		WHERE id = $1
	`
	_, err := r.db.Exec(query, id)
	return err
}

// UpdateLastExecution updates the last execution time for a function
func (r *PostgresFunctionRepository) UpdateLastExecution(id int, lastExecution time.Time) error {
	query := `
		UPDATE functions
		SET last_execution = $1
		WHERE id = $2
	`
	_, err := r.db.Exec(query, lastExecution, id)
	return err
}

// GetSecrets gets the secrets used by a function
func (r *PostgresFunctionRepository) GetSecrets(functionID int) ([]string, error) {
	query := `
		SELECT secret_name
		FROM function_secrets
		WHERE function_id = $1
		ORDER BY secret_name
	`
	rows, err := r.db.Query(query, functionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	secrets := []string{}
	for rows.Next() {
		var secretName string
		err := rows.Scan(&secretName)
		if err != nil {
			return nil, err
		}
		secrets = append(secrets, secretName)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return secrets, nil
}

// SetSecrets sets the secrets used by a function
func (r *PostgresFunctionRepository) SetSecrets(functionID int, secrets []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete existing secrets
	err = r.deleteSecretsTx(tx, functionID)
	if err != nil {
		return err
	}

	// Add new secrets
	err = r.setSecretsTx(tx, functionID, secrets)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// deleteSecretsTx deletes all secrets for a function (within a transaction)
func (r *PostgresFunctionRepository) deleteSecretsTx(tx *sql.Tx, functionID int) error {
	query := `DELETE FROM function_secrets WHERE function_id = $1`
	_, err := tx.Exec(query, functionID)
	return err
}

// setSecretsTx sets the secrets used by a function (within a transaction)
func (r *PostgresFunctionRepository) setSecretsTx(tx *sql.Tx, functionID int, secrets []string) error {
	query := `INSERT INTO function_secrets (function_id, secret_name) VALUES ($1, $2)`
	stmt, err := tx.Prepare(query)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, secretName := range secrets {
		_, err = stmt.Exec(functionID, secretName)
		if err != nil {
			return err
		}
	}

	return nil
}