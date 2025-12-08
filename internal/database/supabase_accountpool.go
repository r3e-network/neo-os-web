package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// PoolAccount represents an account pool account with locking support.
type PoolAccount struct {
	ID         string    `json:"id"`
	Address    string    `json:"address"`
	Balance    int64     `json:"balance"`
	CreatedAt  time.Time `json:"created_at"`
	LastUsedAt time.Time `json:"last_used_at"`
	TxCount    int64     `json:"tx_count"`
	IsRetiring bool      `json:"is_retiring"`
	LockedBy   string    `json:"locked_by,omitempty"`
	LockedAt   time.Time `json:"locked_at,omitempty"`
}

// CreatePoolAccount inserts a new pool account.
func (r *Repository) CreatePoolAccount(ctx context.Context, acc *PoolAccount) error {
	data, err := r.client.request(ctx, "POST", "pool_accounts", acc, "")
	if err != nil {
		return err
	}
	var rows []PoolAccount
	if err := json.Unmarshal(data, &rows); err == nil && len(rows) > 0 {
		*acc = rows[0]
	}
	return nil
}

// UpdatePoolAccount updates a pool account by ID.
func (r *Repository) UpdatePoolAccount(ctx context.Context, acc *PoolAccount) error {
	query := fmt.Sprintf("id=eq.%s", acc.ID)
	_, err := r.client.request(ctx, "PATCH", "pool_accounts", acc, query)
	return err
}

// GetPoolAccount fetches a pool account by ID.
func (r *Repository) GetPoolAccount(ctx context.Context, id string) (*PoolAccount, error) {
	data, err := r.client.request(ctx, "GET", "pool_accounts", nil, "id=eq."+id+"&limit=1")
	if err != nil {
		return nil, err
	}
	var rows []PoolAccount
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("pool account not found")
	}
	return &rows[0], nil
}

// ListPoolAccounts returns all pool accounts.
func (r *Repository) ListPoolAccounts(ctx context.Context) ([]PoolAccount, error) {
	data, err := r.client.request(ctx, "GET", "pool_accounts", nil, "")
	if err != nil {
		return nil, err
	}
	var rows []PoolAccount
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// ListAvailablePoolAccounts returns unlocked, non-retiring accounts up to limit.
func (r *Repository) ListAvailablePoolAccounts(ctx context.Context, limit int) ([]PoolAccount, error) {
	query := fmt.Sprintf("is_retiring=eq.false&locked_by=is.null&order=last_used_at.asc&limit=%d", limit)
	data, err := r.client.request(ctx, "GET", "pool_accounts", nil, query)
	if err != nil {
		return nil, err
	}
	var rows []PoolAccount
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// ListPoolAccountsByLocker returns accounts locked by a specific service.
func (r *Repository) ListPoolAccountsByLocker(ctx context.Context, lockerID string) ([]PoolAccount, error) {
	query := fmt.Sprintf("locked_by=eq.%s", lockerID)
	data, err := r.client.request(ctx, "GET", "pool_accounts", nil, query)
	if err != nil {
		return nil, err
	}
	var rows []PoolAccount
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// DeletePoolAccount deletes a pool account by ID.
func (r *Repository) DeletePoolAccount(ctx context.Context, id string) error {
	_, err := r.client.request(ctx, "DELETE", "pool_accounts", nil, "id=eq."+id)
	return err
}
