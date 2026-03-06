package contract

import "testing"

func TestMiniAppFactoryV2Contract(t *testing.T) {
	deployed := deployContractNeotest(t, "MiniAppFactoryV2", nil)

	t.Run("Admin", func(t *testing.T) {
		deployed.requireAdminEqualsDeployer(t)
	})

	t.Run("GetAllCategories", func(t *testing.T) {
		deployed.requireStringArrayContains(t, "getAllCategories", 7, "gaming", "defi", "governance")
	})

	t.Run("SetAppRegistryRoundTrip", func(t *testing.T) {
		deployed.invokeVoid(t, "setAppRegistry", deployed.deployerHash())
		deployed.requireHash160Equals(t, "appRegistry", deployed.deployerHash())
	})
}
