package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// MixerTargetAddress represents a delivery target.
type MixerTargetAddress struct {
	Address string `json:"address"`
	Amount  int64  `json:"amount,omitempty"`
}

// MixerRequestRecord represents a mixer request row.
type MixerRequestRecord struct {
	ID                    string               `json:"id"`
	UserID                string               `json:"user_id"`
	UserAddress           string               `json:"user_address,omitempty"`
	TokenType             string               `json:"token_type"` // GAS, NEO, etc.
	Status                string               `json:"status"`
	TotalAmount           int64                `json:"total_amount"`
	ServiceFee            int64                `json:"service_fee"`
	NetAmount             int64                `json:"net_amount"`
	TargetAddresses       []MixerTargetAddress `json:"target_addresses"`
	InitialSplits         int                  `json:"initial_splits"`
	MixingDurationSeconds int64                `json:"mixing_duration_seconds"`
	DepositAddress        string               `json:"deposit_address"`
	DepositTxHash         string               `json:"deposit_tx_hash,omitempty"`
	PoolAccounts          []string             `json:"pool_accounts"`
	// TEE Commitment fields for dispute mechanism
	RequestHash  string   `json:"request_hash,omitempty"`
	TEESignature string   `json:"tee_signature,omitempty"`
	Deadline     int64    `json:"deadline,omitempty"`
	OutputTxIDs  []string `json:"output_tx_ids,omitempty"`
	// CompletionProof is generated when mixing is done (stored as JSON, NOT submitted unless disputed)
	CompletionProofJSON string `json:"completion_proof_json,omitempty"`
	// Timestamps
	CreatedAt     time.Time `json:"created_at"`
	DepositedAt   time.Time `json:"deposited_at,omitempty"`
	MixingStartAt time.Time `json:"mixing_start_at,omitempty"`
	DeliveredAt   time.Time `json:"delivered_at,omitempty"`
	Error         string    `json:"error,omitempty"`
}

// CreateMixerRequest creates a new mixer request.
func (r *Repository) CreateMixerRequest(ctx context.Context, req *MixerRequestRecord) error {
	data, err := r.client.request(ctx, "POST", "mixer_requests", req, "")
	if err != nil {
		return err
	}
	var rows []MixerRequestRecord
	if err := json.Unmarshal(data, &rows); err == nil && len(rows) > 0 {
		*req = rows[0]
	}
	return nil
}

// UpdateMixerRequest updates a mixer request by ID.
func (r *Repository) UpdateMixerRequest(ctx context.Context, req *MixerRequestRecord) error {
	query := fmt.Sprintf("id=eq.%s", req.ID)
	_, err := r.client.request(ctx, "PATCH", "mixer_requests", req, query)
	return err
}

// GetMixerRequest fetches a mixer request by ID.
func (r *Repository) GetMixerRequest(ctx context.Context, id string) (*MixerRequestRecord, error) {
	data, err := r.client.request(ctx, "GET", "mixer_requests", nil, "id=eq."+id+"&limit=1")
	if err != nil {
		return nil, err
	}
	var rows []MixerRequestRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("mixer request not found")
	}
	return &rows[0], nil
}

// GetMixerRequestByDepositAddress fetches a mixer request by deposit address.
func (r *Repository) GetMixerRequestByDepositAddress(ctx context.Context, addr string) (*MixerRequestRecord, error) {
	data, err := r.client.request(ctx, "GET", "mixer_requests", nil, "deposit_address=eq."+addr+"&limit=1")
	if err != nil {
		return nil, err
	}
	var rows []MixerRequestRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("mixer request not found")
	}
	return &rows[0], nil
}

// ListMixerRequestsByUser lists requests for a user.
func (r *Repository) ListMixerRequestsByUser(ctx context.Context, userID string) ([]MixerRequestRecord, error) {
	data, err := r.client.request(ctx, "GET", "mixer_requests", nil, "user_id=eq."+userID)
	if err != nil {
		return nil, err
	}
	var rows []MixerRequestRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// ListMixerRequestsByStatus lists requests with a specific status.
func (r *Repository) ListMixerRequestsByStatus(ctx context.Context, status string) ([]MixerRequestRecord, error) {
	data, err := r.client.request(ctx, "GET", "mixer_requests", nil, "status=eq."+status)
	if err != nil {
		return nil, err
	}
	var rows []MixerRequestRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}
