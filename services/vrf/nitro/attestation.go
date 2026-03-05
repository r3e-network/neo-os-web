package neovrf

import (
	"crypto/sha256"
	"encoding/json"
	"os"
	"strings"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
)

func computeAttestationHash(m *nitro.Nitro) []byte {
	if m != nil {
		if report := m.Report(); report != nil {
			if b, err := json.Marshal(report); err == nil && len(b) > 0 {
				sum := sha256.Sum256(b)
				return sum[:]
			}
		}

		if certPEM := strings.TrimSpace(os.Getenv("NITRO_CERT")); certPEM != "" {
			sum := sha256.Sum256([]byte(certPEM))
			return sum[:]
		}

		if mt := strings.TrimSpace(m.NitroType()); mt != "" || strings.TrimSpace(m.UUID()) != "" {
			sum := sha256.Sum256([]byte(mt + "|" + m.UUID()))
			return sum[:]
		}
	}

	sum := sha256.Sum256([]byte("neovrf:attestation:unknown"))
	return sum[:]
}
