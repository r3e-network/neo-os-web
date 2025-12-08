package database

import (
	"context"
	"encoding/json"
)

// GetSecrets retrieves all secrets for a user.
func (r *Repository) GetSecrets(ctx context.Context, userID string) ([]Secret, error) {
	data, err := r.client.request(ctx, "GET", "secrets", nil, "user_id=eq."+userID)
	if err != nil {
		return nil, err
	}

	var secrets []Secret
	if err := json.Unmarshal(data, &secrets); err != nil {
		return nil, err
	}
	return secrets, nil
}

// CreateSecret creates a new secret.
func (r *Repository) CreateSecret(ctx context.Context, secret *Secret) error {
	_, err := r.client.request(ctx, "POST", "secrets", secret, "")
	return err
}
