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
// - NITRO_ENV=production
// - STRICT_IDENTITY_MODE=true or TEE_STRICT_MODE=true
// - Nitro TLS credentials are injected (NITRO_CERT/NITRO_KEY/NITRO_ROOT_CA)
// - STRICT_IDENTITY_ON_TEE=true (nitro-only runtime)
func StrictIdentityMode() bool {
	env := Env()
	if env == Production {
		return true
	}

	if ParseEnvBoolKey("STRICT_IDENTITY_MODE") || ParseEnvBoolKey("TEE_STRICT_MODE") {
		return true
	}

	hasNitroTLS := strings.TrimSpace(os.Getenv("NITRO_CERT")) != "" &&
		strings.TrimSpace(os.Getenv("NITRO_KEY")) != "" &&
		strings.TrimSpace(os.Getenv("NITRO_ROOT_CA")) != ""
	if hasNitroTLS {
		return true
	}

	return ParseEnvBoolKey("STRICT_IDENTITY_ON_TEE")
}
