package database

import (
	"os"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
)

func TestDebug(t *testing.T) {
	t.Logf("StrictIdentityMode: %v", runtime.StrictIdentityMode())
	t.Logf("TEE_BACKEND: %q", os.Getenv("TEE_BACKEND"))
	t.Logf("NITRO_ATTESTATION_DOCUMENT_B64 set: %v", os.Getenv("NITRO_ATTESTATION_DOCUMENT_B64") != "")
	t.Logf("MARBLE_ENV: %q", os.Getenv("MARBLE_ENV"))
	t.Logf("Env: %v", runtime.Env())
}
