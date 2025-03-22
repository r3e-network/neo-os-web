package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/willtech-services/service_layer/internal/models"
)

// OracleRepository implements the models.OracleRepository interface
type OracleRepository struct {
	db *sqlx.DB
}

// NewOracleRepository creates a new oracle repository
func NewOracleRepository(db *sqlx.DB) *OracleRepository {
	return &OracleRepository{
		db: db,
	}
}

// CreateOracle creates a new oracle data source configuration
func (r *OracleRepository) CreateOracle(oracle *models.Oracle) (*models.Oracle, error) {
	query := `
		INSERT INTO oracles 
		(name, description, type, url, method, headers, body, auth_type, auth_params, path, transform, schedule, active, user_id, created_at, updated_at) 
		VALUES 
		($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15) 
		RETURNING id
	`

	now := time.Now().UTC()
	oracle.CreatedAt = now
	oracle.UpdatedAt = now

	var id int
	err := r.db.QueryRowx(query,
		oracle.Name,
		oracle.Description,
		oracle.Type,
		oracle.URL,
		oracle.Method,
		oracle.Headers,
		oracle.Body,
		oracle.AuthType,
		oracle.AuthParams,
		oracle.Path,
		oracle.Transform,
		oracle.Schedule,
		oracle.Active,
		oracle.UserID,
		now,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create oracle: %w", err)
	}

	oracle.ID = id
	return oracle, nil
}

// UpdateOracle updates an oracle data source configuration
func (r *OracleRepository) UpdateOracle(oracle *models.Oracle) (*models.Oracle, error) {
	query := `
		UPDATE oracles 
		SET name = $1, 
		    description = $2, 
		    type = $3, 
		    url = $4, 
		    method = $5, 
		    headers = $6, 
		    body = $7, 
		    auth_type = $8, 
		    auth_params = $9, 
		    path = $10, 
		    transform = $11, 
		    schedule = $12, 
		    active = $13, 
		    updated_at = $14 
		WHERE id = $15
	`

	now := time.Now().UTC()
	oracle.UpdatedAt = now

	_, err := r.db.Exec(query,
		oracle.Name,
		oracle.Description,
		oracle.Type,
		oracle.URL,
		oracle.Method,
		oracle.Headers,
		oracle.Body,
		oracle.AuthType,
		oracle.AuthParams,
		oracle.Path,
		oracle.Transform,
		oracle.Schedule,
		oracle.Active,
		now,
		oracle.ID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update oracle: %w", err)
	}

	return oracle, nil
}

// GetOracleByID gets an oracle data source configuration by ID
func (r *OracleRepository) GetOracleByID(id int) (*models.Oracle, error) {
	query := `SELECT * FROM oracles WHERE id = $1`

	var oracle models.Oracle
	err := r.db.Get(&oracle, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get oracle: %w", err)
	}

	return &oracle, nil
}

// GetOracleByName gets an oracle data source configuration by name
func (r *OracleRepository) GetOracleByName(name string) (*models.Oracle, error) {
	query := `SELECT * FROM oracles WHERE name = $1`

	var oracle models.Oracle
	err := r.db.Get(&oracle, query, name)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get oracle by name: %w", err)
	}

	return &oracle, nil
}

// ListOracles lists oracle data source configurations
func (r *OracleRepository) ListOracles(userID int, offset, limit int) ([]*models.Oracle, error) {
	query := `
		SELECT * FROM oracles 
		WHERE user_id = $1 
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3
	`

	var oracles []*models.Oracle
	err := r.db.Select(&oracles, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list oracles: %w", err)
	}

	return oracles, nil
}

// DeleteOracle deletes an oracle data source configuration
func (r *OracleRepository) DeleteOracle(id int) error {
	query := `DELETE FROM oracles WHERE id = $1`

	_, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete oracle: %w", err)
	}

	return nil
}

// CreateOracleRequest creates a new oracle data request
func (r *OracleRepository) CreateOracleRequest(request *models.OracleRequest) (*models.OracleRequest, error) {
	query := `
		INSERT INTO oracle_requests 
		(oracle_id, user_id, status, url, method, headers, body, auth_type, auth_params, path, transform, callback_address, callback_method, gas_fee, created_at, updated_at) 
		VALUES 
		($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15) 
		RETURNING id
	`

	now := time.Now().UTC()
	request.CreatedAt = now
	request.UpdatedAt = now
	
	if request.Status == "" {
		request.Status = models.OracleRequestStatusPending
	}

	var id int
	err := r.db.QueryRowx(query,
		request.OracleID,
		request.UserID,
		request.Status,
		request.URL,
		request.Method,
		request.Headers,
		request.Body,
		request.AuthType,
		request.AuthParams,
		request.Path,
		request.Transform,
		request.CallbackAddress,
		request.CallbackMethod,
		request.GasFee,
		now,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create oracle request: %w", err)
	}

	request.ID = id
	return request, nil
}

// UpdateOracleRequest updates an oracle data request
func (r *OracleRepository) UpdateOracleRequest(request *models.OracleRequest) (*models.OracleRequest, error) {
	query := `
		UPDATE oracle_requests 
		SET status = $1, 
		    result = $2, 
		    raw_result = $3, 
		    error = $4, 
		    tx_hash = $5, 
		    block_height = $6, 
		    updated_at = $7, 
		    completed_at = $8 
		WHERE id = $9
	`

	now := time.Now().UTC()
	request.UpdatedAt = now

	var completedAt sql.NullTime
	if request.Status == models.OracleRequestStatusCompleted || 
	   request.Status == models.OracleRequestStatusCallbackSent || 
	   request.Status == models.OracleRequestStatusFailed {
		if request.CompletedAt.IsZero() {
			request.CompletedAt = now
		}
		completedAt = sql.NullTime{Time: request.CompletedAt, Valid: true}
	}

	_, err := r.db.Exec(query,
		request.Status,
		request.Result,
		request.RawResult,
		request.Error,
		request.TxHash,
		request.BlockHeight,
		now,
		completedAt,
		request.ID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update oracle request: %w", err)
	}

	return request, nil
}

// GetOracleRequestByID gets an oracle data request by ID
func (r *OracleRepository) GetOracleRequestByID(id int) (*models.OracleRequest, error) {
	query := `SELECT * FROM oracle_requests WHERE id = $1`

	var request models.OracleRequest
	err := r.db.Get(&request, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get oracle request: %w", err)
	}

	return &request, nil
}

// ListOracleRequests lists oracle data requests for an oracle
func (r *OracleRepository) ListOracleRequests(oracleID int, offset, limit int) ([]*models.OracleRequest, error) {
	query := `
		SELECT * FROM oracle_requests 
		WHERE oracle_id = $1 
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3
	`

	var requests []*models.OracleRequest
	err := r.db.Select(&requests, query, oracleID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list oracle requests: %w", err)
	}

	return requests, nil
}

// ListPendingOracleRequests lists all pending oracle data requests
func (r *OracleRepository) ListPendingOracleRequests() ([]*models.OracleRequest, error) {
	query := `
		SELECT * FROM oracle_requests 
		WHERE status = $1 
		ORDER BY created_at ASC
	`

	var requests []*models.OracleRequest
	err := r.db.Select(&requests, query, models.OracleRequestStatusPending)
	if err != nil {
		return nil, fmt.Errorf("failed to list pending oracle requests: %w", err)
	}

	return requests, nil
}

// GetOracleStatistics gets statistics for oracle data
func (r *OracleRepository) GetOracleStatistics() (map[string]interface{}, error) {
	query := `
		SELECT 
			COUNT(*) as total_requests,
			SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
			SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_requests,
			SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
			SUM(CASE WHEN status = 'callback_sent' THEN 1 ELSE 0 END) as callback_sent_requests,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_requests,
			AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_completion_time_seconds
		FROM oracle_requests
		WHERE status IN ('completed', 'callback_sent')
	`

	var result struct {
		TotalRequests        int     `db:"total_requests"`
		PendingRequests      int     `db:"pending_requests"`
		ProcessingRequests   int     `db:"processing_requests"`
		CompletedRequests    int     `db:"completed_requests"`
		CallbackSentRequests int     `db:"callback_sent_requests"`
		FailedRequests       int     `db:"failed_requests"`
		AvgCompletionTime    float64 `db:"avg_completion_time_seconds"`
	}

	err := r.db.Get(&result, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get oracle statistics: %w", err)
	}

	// Convert struct to map
	resultMap := map[string]interface{}{
		"total_requests":         result.TotalRequests,
		"pending_requests":       result.PendingRequests,
		"processing_requests":    result.ProcessingRequests,
		"completed_requests":     result.CompletedRequests,
		"callback_sent_requests": result.CallbackSentRequests,
		"failed_requests":        result.FailedRequests,
		"avg_completion_time":    result.AvgCompletionTime,
	}

	return resultMap, nil
} 