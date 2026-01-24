package secrets

import (
	"context"
	"os"
	"strings"

	"github.com/R3E-Network/service_layer/infrastructure/runtime"
)

// ServiceProvider is the standard Provider implementation used by enclave services.
//
// It enforces per-secret allowlists (secret_policies) using the service ID and
// decrypts secrets using the configured Manager.
type ServiceProvider struct {
	Manager   *Manager
	ServiceID string
}

func (p ServiceProvider) GetSecret(ctx context.Context, userID, name string) (string, error) {
	if p.Manager == nil {
		return "", ErrNotFound
	}

	strict := runtime.StrictIdentityMode()
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("SECRETS_STRICT_PERMISSIONS"))); v == "1" || v == "true" || v == "yes" {
		strict = true
	}

	return p.Manager.GetSecretForService(ctx, userID, name, p.ServiceID, strict)
}
