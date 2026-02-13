package marble

import "fmt"

// RequireSecret loads a secret from the Marble and enforces minimum length.
// In strict mode (production/enclave), a missing or short secret is a fatal error.
// In development mode, it logs a warning and returns nil.
//
// This eliminates the repeated pattern across services:
//
//	if key, ok := cfg.Marble.Secret("KEY"); ok && len(key) >= minLen {
//	    s.key = key
//	} else if strict {
//	    return nil, fmt.Errorf("KEY is required and must be at least %d bytes", minLen)
//	} else {
//	    logger.Warn("KEY not configured; ...")
//	}
type SecretResult struct {
	Value []byte
	OK    bool
}

// RequireSecret loads a named secret from the Marble, enforcing a minimum byte
// length. Returns the secret value and true if the secret meets requirements.
//
// When strict is true and the secret is missing or too short, an error is returned.
// When strict is false and the secret is missing, (nil, false, nil) is returned
// so the caller can fall back to development-mode behavior.
func RequireSecret(m *Marble, name string, minLen int, strict bool) ([]byte, bool, error) {
	if m == nil {
		if strict {
			return nil, false, fmt.Errorf("%s: marble is nil", name)
		}
		return nil, false, nil
	}

	key, ok := m.Secret(name)
	if ok && len(key) >= minLen {
		return key, true, nil
	}

	if strict {
		return nil, false, fmt.Errorf("%s is required and must be at least %d bytes", name, minLen)
	}

	return nil, false, nil
}

// IsStrict returns true when the marble is running in strict identity mode
// (production or SGX enclave). This consolidates the repeated pattern:
//
//	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()
//
// Note: This intentionally does NOT import infrastructure/runtime to avoid
// a circular dependency. Callers that need the full StrictIdentityMode check
// (which includes env-var detection) should continue using runtime.StrictIdentityMode()
// in combination with this method.
func (m *Marble) IsStrict() bool {
	if m == nil {
		return false
	}
	return m.IsEnclave()
}
