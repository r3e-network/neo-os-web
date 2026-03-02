// Package runtime provides environment/runtime detection helpers shared across the service layer.
package runtime

import (
	"os"
	"strings"
)

// StrictIdentityMode returns true when the service should fail closed on identity/security
// boundaries (e.g. only trust identity headers protected by verified mTLS).
//
// Triggers:
// - MARBLE_ENV=production
// - STRICT_IDENTITY_MODE=true or TEE_STRICT_MODE=true
// - Marble TLS credentials are injected (MARBLE_CERT/MARBLE_KEY/MARBLE_ROOT_CA)
// - STRICT_IDENTITY_ON_TEE=true and backend is sgx/nitro
func StrictIdentityMode() bool {
	env := Env()
	if env == Production {
		return true
	}

	if ParseEnvBoolKey("STRICT_IDENTITY_MODE") || ParseEnvBoolKey("TEE_STRICT_MODE") {
		return true
	}

	hasMarbleTLS := strings.TrimSpace(os.Getenv("MARBLE_CERT")) != "" &&
		strings.TrimSpace(os.Getenv("MARBLE_KEY")) != "" &&
		strings.TrimSpace(os.Getenv("MARBLE_ROOT_CA")) != ""
	if hasMarbleTLS {
		return true
	}

	return ParseEnvBoolKey("STRICT_IDENTITY_ON_TEE") && Backend() != TEESim
}
