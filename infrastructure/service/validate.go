package service

import (
	"fmt"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
)

// ValidateMarble returns an error if marble is nil.
func ValidateMarble(m *marble.Marble, serviceID string) error {
	if m == nil {
		return fmt.Errorf("%s: marble is required", serviceID)
	}
	return nil
}

// IsStrict returns true if running in strict identity or enclave mode.
func IsStrict(m *marble.Marble) bool {
	return runtime.StrictIdentityMode() || m.IsEnclave()
}

// RequireInStrict returns an error if the value is nil/zero and we're in strict mode.
// Use for chain clients, signers, and other dependencies required only in production.
func RequireInStrict(m *marble.Marble, present bool, serviceID, what string) error {
	if IsStrict(m) && !present {
		return fmt.Errorf("%s: %s is required in strict/enclave mode", serviceID, what)
	}
	return nil
}
