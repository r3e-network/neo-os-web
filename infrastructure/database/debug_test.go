package database

import (
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	"os"
	"testing"
)

func TestDebug(t *testing.T) {
	t.Logf("StrictIdentityMode: %v", runtime.StrictIdentityMode())
	t.Logf("OE_SIMULATION: %q", os.Getenv("OE_SIMULATION"))
	t.Logf("MARBLE_ENV: %q", os.Getenv("MARBLE_ENV"))
	t.Logf("Env: %v", runtime.Env())
}
