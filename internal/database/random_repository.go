package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/jmoiron/sqlx"
)

// RandomRepository implements the models.RandomRepository interface
type RandomRepository struct {
	db *sqlx.DB
}

// NewRandomRepository creates a new random repository
func NewRandomRepository(db *sqlx.DB) *RandomRepository {
	return &RandomRepository{
		db: db,
	}
}

// CreateRequest creates a new random number request
func (r *RandomRepository) CreateRequest(req *models.RandomRequest) (*models.RandomRequest, error) {
	query := `
		INSERT INTO random_requests 
		(user_id, status, callback_address, callback_method, seed, block_height, num_bytes, delay_blocks, gas_fee, created_at, updated_at) 
		VALUES 
		($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) 
		RETURNING id
	`

	now := time.Now().UTC()
	req.CreatedAt = now
	req.UpdatedAt = now

	if req.Status == "" {
		req.Status = models.RandomRequestStatusPending
	}

	var id int
	err := r.db.QueryRowx(query,
		req.UserID,
		req.Status,
		req.CallbackAddress,
		req.CallbackMethod,
		req.Seed,
		req.BlockHeight,
		req.NumBytes,
		req.DelayBlocks,
		req.GasFee,
		now,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create random request: %w", err)
	}

	req.ID = id
	return req, nil
}

// UpdateRequest updates a random number request
func (r *RandomRepository) UpdateRequest(req *models.RandomRequest) (*models.RandomRequest, error) {
	query := `
		UPDATE random_requests 
		SET status = $1, 
		    callback_address = $2, 
		    callback_method = $3, 
		    seed = $4, 
		    block_height = $5, 
		    num_bytes = $6, 
		    delay_blocks = $7, 
		    gas_fee = $8, 
		    commitment_hash = $9, 
		    random_number = $10, 
		    proof = $11, 
		    commitment_tx_hash = $12, 
		    reveal_tx_hash = $13, 
		    callback_tx_hash = $14, 
		    error = $15, 
		    updated_at = $16,
		    revealed_at = $17
		WHERE id = $18
	`

	req.UpdatedAt = time.Now().UTC()

	_, err := r.db.Exec(query,
		req.Status,
		req.CallbackAddress,
		req.CallbackMethod,
		req.Seed,
		req.BlockHeight,
		req.NumBytes,
		req.DelayBlocks,
		req.GasFee,
		req.CommitmentHash,
		req.RandomNumber,
		req.Proof,
		req.CommitmentTxHash,
		req.RevealTxHash,
		req.CallbackTxHash,
		req.Error,
		req.UpdatedAt,
		req.RevealedAt,
		req.ID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update random request: %w", err)
	}

	return req, nil
}

// GetRequestByID gets a random number request by ID
func (r *RandomRepository) GetRequestByID(id int) (*models.RandomRequest, error) {
	query := `SELECT * FROM random_requests WHERE id = $1`

	var req models.RandomRequest
	err := r.db.Get(&req, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get random request: %w", err)
	}

	return &req, nil
}

// ListRequests lists random number requests for a user
func (r *RandomRepository) ListRequests(userID int, offset, limit int) ([]*models.RandomRequest, error) {
	query := `
		SELECT * FROM random_requests 
		WHERE user_id = $1 
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3
	`

	var requests []*models.RandomRequest
	err := r.db.Select(&requests, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list random requests: %w", err)
	}

	return requests, nil
}

// ListPendingRequests lists all pending random number requests
func (r *RandomRepository) ListPendingRequests() ([]*models.RandomRequest, error) {
	query := `
		SELECT * FROM random_requests 
		WHERE status = $1 
		ORDER BY created_at ASC
	`

	var requests []*models.RandomRequest
	err := r.db.Select(&requests, query, models.RandomRequestStatusPending)
	if err != nil {
		return nil, fmt.Errorf("failed to list pending random requests: %w", err)
	}

	return requests, nil
}

// ListCommittedRequests lists all committed random number requests
func (r *RandomRepository) ListCommittedRequests() ([]*models.RandomRequest, error) {
	query := `
		SELECT * FROM random_requests 
		WHERE status = $1 
		ORDER BY created_at ASC
	`

	var requests []*models.RandomRequest
	err := r.db.Select(&requests, query, models.RandomRequestStatusCommitted)
	if err != nil {
		return nil, fmt.Errorf("failed to list committed random requests: %w", err)
	}

	return requests, nil
}

// GetRandomStatistics gets statistics for random number generation
func (r *RandomRepository) GetRandomStatistics() (map[string]interface{}, error) {
	query := `
		SELECT 
			COUNT(*) as total_requests,
			SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
			SUM(CASE WHEN status = 'committed' THEN 1 ELSE 0 END) as committed_requests,
			SUM(CASE WHEN status = 'revealed' THEN 1 ELSE 0 END) as revealed_requests,
			SUM(CASE WHEN status = 'callback_sent' THEN 1 ELSE 0 END) as callback_sent_requests,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_requests,
			AVG(EXTRACT(EPOCH FROM (revealed_at - created_at))) as avg_completion_time_seconds
		FROM random_requests
		WHERE status IN ('revealed', 'callback_sent')
	`

	var result struct {
		TotalRequests        int     `db:"total_requests"`
		PendingRequests      int     `db:"pending_requests"`
		CommittedRequests    int     `db:"committed_requests"`
		RevealedRequests     int     `db:"revealed_requests"`
		CallbackSentRequests int     `db:"callback_sent_requests"`
		FailedRequests       int     `db:"failed_requests"`
		AvgCompletionTime    float64 `db:"avg_completion_time_seconds"`
	}

	err := r.db.Get(&result, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get random statistics: %w", err)
	}

	// Convert struct to map
	resultMap := map[string]interface{}{
		"total_requests":         result.TotalRequests,
		"pending_requests":       result.PendingRequests,
		"committed_requests":     result.CommittedRequests,
		"revealed_requests":      result.RevealedRequests,
		"callback_sent_requests": result.CallbackSentRequests,
		"failed_requests":        result.FailedRequests,
		"avg_completion_time":    result.AvgCompletionTime,
	}

	return resultMap, nil
}

// CreateEntropySource creates a new entropy source
func (r *RandomRepository) CreateEntropySource(source *models.EntropySource) (*models.EntropySource, error) {
	query := `
		INSERT INTO entropy_sources 
		(name, type, weight, active, created_at, updated_at) 
		VALUES 
		($1, $2, $3, $4, $5, $5) 
		RETURNING id
	`

	now := time.Now().UTC()
	source.CreatedAt = now
	source.UpdatedAt = now

	var id int
	err := r.db.QueryRowx(query,
		source.Name,
		source.Type,
		source.Weight,
		source.Active,
		now,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create entropy source: %w", err)
	}

	source.ID = id
	return source, nil
}

// UpdateEntropySource updates an entropy source
func (r *RandomRepository) UpdateEntropySource(source *models.EntropySource) (*models.EntropySource, error) {
	query := `
		UPDATE entropy_sources 
		SET name = $1, type = $2, weight = $3, active = $4, updated_at = $5 
		WHERE id = $6
	`

	now := time.Now().UTC()
	source.UpdatedAt = now

	_, err := r.db.Exec(query,
		source.Name,
		source.Type,
		source.Weight,
		source.Active,
		now,
		source.ID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update entropy source: %w", err)
	}

	return source, nil
}

// GetEntropySourceByID gets an entropy source by ID
func (r *RandomRepository) GetEntropySourceByID(id int) (*models.EntropySource, error) {
	query := `SELECT * FROM entropy_sources WHERE id = $1`

	var source models.EntropySource
	err := r.db.Get(&source, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get entropy source: %w", err)
	}

	return &source, nil
}

// GetEntropySourceByName gets an entropy source by name
func (r *RandomRepository) GetEntropySourceByName(name string) (*models.EntropySource, error) {
	query := `SELECT * FROM entropy_sources WHERE name = $1`

	var source models.EntropySource
	err := r.db.Get(&source, query, name)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get entropy source: %w", err)
	}

	return &source, nil
}

// ListEntropySources lists all entropy sources
func (r *RandomRepository) ListEntropySources() ([]*models.EntropySource, error) {
	query := `SELECT * FROM entropy_sources ORDER BY id`

	var sources []*models.EntropySource
	err := r.db.Select(&sources, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list entropy sources: %w", err)
	}

	return sources, nil
}
