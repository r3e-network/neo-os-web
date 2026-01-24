package secrets

import (
	"context"
	"errors"
)

// MasterKeyEnv is the shared env var name used by Supabase Edge and enclave
// services for secret encryption/decryption.
const MasterKeyEnv = "SECRETS_MASTER_KEY"

var (
	// ErrNotFound indicates the secret does not exist for the given user/name.
	ErrNotFound = errors.New("secret not found")
	// ErrForbidden indicates the caller's service ID is not allowed to access the secret.
	ErrForbidden = errors.New("secret access forbidden")
	// ErrInvalidCiphertext indicates the stored secret cannot be decrypted.
	ErrInvalidCiphertext = errors.New("invalid secret ciphertext")
)

// Provider resolves decrypted secret values for a given user.
//
// Implementations must enforce per-user ownership and any per-secret policy
// constraints (allowed services), because the enclave services treat the
// returned value as sensitive and must not fetch secrets they are not entitled
// to.
type Provider interface {
	GetSecret(ctx context.Context, userID, name string) (string, error)
}
