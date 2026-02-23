package supabase

import (
	"time"
)

// secretRow mirrors records returned by the user_secrets Supabase table.
// Ciphertext is stored as base64 text and decrypted by infrastructure/secrets.Manager.
type secretRow struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	ServiceID  string    `json:"service_id"`
	SecretName string    `json:"secret_name"`
	Ciphertext string    `json:"ciphertext"`
	CreatedAt  time.Time `json:"created_at,omitempty"`
	UpdatedAt  time.Time `json:"updated_at,omitempty"`
}
