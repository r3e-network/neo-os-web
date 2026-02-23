package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/secrets"
)

const secretsTable = "user_secrets"

type repository struct {
	base *database.Repository
}

// NewRepository creates a new Supabase-backed secrets repository.
func NewRepository(base *database.Repository) secrets.Repository {
	return &repository{base: base}
}

type secretRow struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	ServiceID  string `json:"service_id"`
	SecretName string `json:"secret_name"`
	Ciphertext string `json:"ciphertext"`
}

func (r *repository) GetEncryptedSecret(ctx context.Context, userID, serviceID, secretName string) ([]byte, error) {
	query := fmt.Sprintf("user_id=eq.%s&service_id=eq.%s&secret_name=eq.%s&limit=1",
		url.QueryEscape(userID), url.QueryEscape(serviceID), url.QueryEscape(secretName))

	data, err := r.base.Request(ctx, "GET", secretsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("secrets: get encrypted secret: %w", err)
	}

	var rows []secretRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("secrets: unmarshal: %w", err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("secrets: %s/%s not found for user %s", serviceID, secretName, userID)
	}
	return []byte(rows[0].Ciphertext), nil
}
