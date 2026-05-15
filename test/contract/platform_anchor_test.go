package contract

import "testing"

func TestPlatformAnchorContract(t *testing.T) {
	deployed := deployContractNeotest(t, "PlatformAnchor", nil)

	t.Run("Admin", func(t *testing.T) {
		deployed.requireAdminEqualsDeployer(t)
	})

	t.Run("StartsUnpaused", func(t *testing.T) {
		deployed.requireBoolEquals(t, "isPaused", false)
	})
}

