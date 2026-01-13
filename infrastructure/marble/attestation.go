// Package marble provides attestation utilities for TEE services.
package marble

import (
	"crypto/sha256"
	"encoding/json"
	"os"
	"strings"
)

// ComputeAttestationHash computes a SHA-256 hash for attestation purposes.
// It tries multiple sources in order: report, MARBLE_CERT, marble type/UUID.
// The serviceID is used as a fallback identifier when no other source is available.
func ComputeAttestationHash(m *Marble, serviceID string) []byte {
	if m != nil {
		// Try report first
		if report := m.Report(); report != nil {
			if b, err := json.Marshal(report); err == nil && len(b) > 0 {
				sum := sha256.Sum256(b)
				return sum[:]
			}
		}

		// Try MARBLE_CERT
		if certPEM := strings.TrimSpace(os.Getenv("MARBLE_CERT")); certPEM != "" {
			sum := sha256.Sum256([]byte(certPEM))
			return sum[:]
		}

		// Try marble type + UUID
		mt := strings.TrimSpace(m.MarbleType())
		uuid := strings.TrimSpace(m.UUID())
		if mt != "" || uuid != "" {
			sum := sha256.Sum256([]byte(mt + "|" + uuid))
			return sum[:]
		}
	}

	// Fallback with service ID
	fallback := serviceID + ":attestation:unknown"
	sum := sha256.Sum256([]byte(fallback))
	return sum[:]
}
