// Package database provides database access functionality for the Service Layer.
package database

import (
	"context"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/pkg/cache"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog"
)

// Function represents a JavaScript function stored in the database
type Function struct {
	ID            string    `db:"id" json:"id"`
	UserID        int       `db:"user_id" json:"user_id"`
	Name          string    `db:"name" json:"name"`
	Description   string    `db:"description" json:"description"`
	SourceCode    string    `db:"source_code" json:"source_code"`
	SecretsAccess []string  `db:"secrets_access" json:"secrets_access"`
	TriggerType   string    `db:"trigger_type" json:"trigger_type"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

// FunctionExecution represents a record of a function execution
type FunctionExecution struct {
	ID          string    `db:"id" json:"id"`
	FunctionID  string    `db:"function_id" json:"function_id"`
	UserID      int       `db:"user_id" json:"user_id"`
	Status      string    `db:"status" json:"status"`
	StartTime   time.Time `db:"start_time" json:"start_time"`
	EndTime     time.Time `db:"end_time" json:"end_time"`
	Duration    int64     `db:"duration" json:"duration"`
	InputParams string    `db:"input_params" json:"input_params"`
	Result      string    `db:"result" json:"result"`
	Error       string    `db:"error" json:"error"`
}

// FunctionRepository handles database operations for functions
type FunctionRepository struct {
	db           *sqlx.DB
	cacheManager *cache.Manager
	logger       zerolog.Logger
}

// NewFunctionRepository creates a new function repository
func NewFunctionRepository(db *sqlx.DB, cacheManager *cache.Manager, logger zerolog.Logger) *FunctionRepository {
	return &FunctionRepository{
		db:           db,
		cacheManager: cacheManager,
		logger:       logger.With().Str("component", "function_repository").Logger(),
	}
}

// GetByID retrieves a function by its ID
func (r *FunctionRepository) GetByID(ctx context.Context, id string) (*Function, error) {
	// Try to get from cache first
	cacheKey := cache.FormatFunctionDetailsKey(id)
	var function Function

	if r.cacheManager != nil && r.cacheManager.GetTyped(ctx, cacheKey, &function) {
		r.logger.Debug().Str("id", id).Msg("Retrieved function from cache")
		return &function, nil
	}

	// Not in cache, get from database
	query := `SELECT * FROM functions WHERE id = $1`
	if err := r.db.GetContext(ctx, &function, query, id); err != nil {
		r.logger.Error().Err(err).Str("id", id).Msg("Failed to get function from database")
		return nil, fmt.Errorf("failed to get function: %w", err)
	}

	// Store in cache
	if r.cacheManager != nil {
		ttl := r.cacheManager.GetTTL("function")
		if err := r.cacheManager.Set(ctx, cacheKey, function, ttl, true); err != nil {
			r.logger.Error().Err(err).Str("id", id).Msg("Failed to cache function")
		}
	}

	return &function, nil
}

// ListByUserID retrieves all functions for a user with pagination
func (r *FunctionRepository) ListByUserID(ctx context.Context, userID int, page, limit int) ([]Function, int, error) {
	offset := (page - 1) * limit

	// Try to get from cache first
	cacheKey := cache.FormatFunctionListKey(userID, page, limit)
	type cacheResult struct {
		Functions []Function `json:"functions"`
		Total     int        `json:"total"`
	}

	var result cacheResult
	if r.cacheManager != nil && r.cacheManager.GetTyped(ctx, cacheKey, &result) {
		r.logger.Debug().Int("userID", userID).Int("page", page).Int("limit", limit).Msg("Retrieved functions from cache")
		return result.Functions, result.Total, nil
	}

	// Get count first
	var total int
	countQuery := `SELECT COUNT(*) FROM functions WHERE user_id = $1`
	if err := r.db.GetContext(ctx, &total, countQuery, userID); err != nil {
		r.logger.Error().Err(err).Int("userID", userID).Msg("Failed to count functions")
		return nil, 0, fmt.Errorf("failed to count functions: %w", err)
	}

	// No results, return early
	if total == 0 {
		return []Function{}, 0, nil
	}

	// Get functions
	var functions []Function
	query := `SELECT * FROM functions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`
	if err := r.db.SelectContext(ctx, &functions, query, userID, limit, offset); err != nil {
		r.logger.Error().Err(err).Int("userID", userID).Msg("Failed to list functions")
		return nil, 0, fmt.Errorf("failed to list functions: %w", err)
	}

	// Store in cache
	if r.cacheManager != nil {
		cachedResult := cacheResult{
			Functions: functions,
			Total:     total,
		}
		ttl := r.cacheManager.GetTTL("function")
		if err := r.cacheManager.Set(ctx, cacheKey, cachedResult, ttl, false); err != nil {
			r.logger.Error().Err(err).Int("userID", userID).Msg("Failed to cache function list")
		}
	}

	return functions, total, nil
}

// Create creates a new function
func (r *FunctionRepository) Create(ctx context.Context, function *Function) error {
	query := `
		INSERT INTO functions (id, user_id, name, description, source_code, secrets_access, trigger_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	now := time.Now()
	function.CreatedAt = now
	function.UpdatedAt = now

	_, err := r.db.ExecContext(
		ctx,
		query,
		function.ID,
		function.UserID,
		function.Name,
		function.Description,
		function.SourceCode,
		function.SecretsAccess,
		function.TriggerType,
		function.CreatedAt,
		function.UpdatedAt,
	)

	if err != nil {
		r.logger.Error().Err(err).Str("name", function.Name).Msg("Failed to create function")
		return fmt.Errorf("failed to create function: %w", err)
	}

	// Invalidate cache
	if r.cacheManager != nil {
		patterns := cache.BuildInvalidationPatterns("function", function.ID, function.UserID)
		for _, pattern := range patterns {
			if err := r.cacheManager.DeletePattern(ctx, pattern); err != nil {
				r.logger.Error().Err(err).Str("pattern", pattern).Msg("Failed to invalidate cache")
			}
		}
	}

	return nil
}

// Update updates an existing function
func (r *FunctionRepository) Update(ctx context.Context, function *Function) error {
	query := `
		UPDATE functions
		SET name = $1, description = $2, source_code = $3, secrets_access = $4, trigger_type = $5, updated_at = $6
		WHERE id = $7 AND user_id = $8
	`

	function.UpdatedAt = time.Now()

	result, err := r.db.ExecContext(
		ctx,
		query,
		function.Name,
		function.Description,
		function.SourceCode,
		function.SecretsAccess,
		function.TriggerType,
		function.UpdatedAt,
		function.ID,
		function.UserID,
	)

	if err != nil {
		r.logger.Error().Err(err).Str("id", function.ID).Msg("Failed to update function")
		return fmt.Errorf("failed to update function: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		r.logger.Error().Err(err).Str("id", function.ID).Msg("Failed to get rows affected")
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		r.logger.Error().Str("id", function.ID).Int("userID", function.UserID).Msg("Function not found or not owned by user")
		return fmt.Errorf("function not found or not owned by user")
	}

	// Invalidate cache
	if r.cacheManager != nil {
		patterns := cache.BuildInvalidationPatterns("function", function.ID, function.UserID)
		for _, pattern := range patterns {
			if err := r.cacheManager.DeletePattern(ctx, pattern); err != nil {
				r.logger.Error().Err(err).Str("pattern", pattern).Msg("Failed to invalidate cache")
			}
		}
	}

	return nil
}

// Delete deletes a function
func (r *FunctionRepository) Delete(ctx context.Context, id string, userID int) error {
	query := `DELETE FROM functions WHERE id = $1 AND user_id = $2`

	result, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		r.logger.Error().Err(err).Str("id", id).Int("userID", userID).Msg("Failed to delete function")
		return fmt.Errorf("failed to delete function: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		r.logger.Error().Err(err).Str("id", id).Msg("Failed to get rows affected")
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		r.logger.Error().Str("id", id).Int("userID", userID).Msg("Function not found or not owned by user")
		return fmt.Errorf("function not found or not owned by user")
	}

	// Invalidate cache
	if r.cacheManager != nil {
		patterns := cache.BuildInvalidationPatterns("function", id, userID)
		for _, pattern := range patterns {
			if err := r.cacheManager.DeletePattern(ctx, pattern); err != nil {
				r.logger.Error().Err(err).Str("pattern", pattern).Msg("Failed to invalidate cache")
			}
		}
	}

	return nil
}

// ListExecutionsByFunctionID retrieves execution history for a function with pagination
func (r *FunctionRepository) ListExecutionsByFunctionID(ctx context.Context, functionID string, page, limit int) ([]FunctionExecution, int, error) {
	offset := (page - 1) * limit

	// Try to get from cache first
	cacheKey := cache.FormatFunctionExecutionListKey(functionID, page, limit)
	type cacheResult struct {
		Executions []FunctionExecution `json:"executions"`
		Total      int                 `json:"total"`
	}

	var result cacheResult
	if r.cacheManager != nil && r.cacheManager.GetTyped(ctx, cacheKey, &result) {
		r.logger.Debug().Str("functionID", functionID).Int("page", page).Int("limit", limit).Msg("Retrieved executions from cache")
		return result.Executions, result.Total, nil
	}

	// Get count first
	var total int
	countQuery := `SELECT COUNT(*) FROM function_executions WHERE function_id = $1`
	if err := r.db.GetContext(ctx, &total, countQuery, functionID); err != nil {
		r.logger.Error().Err(err).Str("functionID", functionID).Msg("Failed to count executions")
		return nil, 0, fmt.Errorf("failed to count executions: %w", err)
	}

	// No results, return early
	if total == 0 {
		return []FunctionExecution{}, 0, nil
	}

	// Get executions
	var executions []FunctionExecution
	query := `
		SELECT * FROM function_executions 
		WHERE function_id = $1 
		ORDER BY start_time DESC 
		LIMIT $2 OFFSET $3
	`
	if err := r.db.SelectContext(ctx, &executions, query, functionID, limit, offset); err != nil {
		r.logger.Error().Err(err).Str("functionID", functionID).Msg("Failed to list executions")
		return nil, 0, fmt.Errorf("failed to list executions: %w", err)
	}

	// Store in cache
	if r.cacheManager != nil {
		cachedResult := cacheResult{
			Executions: executions,
			Total:      total,
		}
		ttl := time.Minute * 5 // Short TTL for executions as they change frequently
		if err := r.cacheManager.Set(ctx, cacheKey, cachedResult, ttl, false); err != nil {
			r.logger.Error().Err(err).Str("functionID", functionID).Msg("Failed to cache execution list")
		}
	}

	return executions, total, nil
}
