package fairy

import (
	"strings"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
)

func TestMiniAppFactoryV2ContractWithFairy(t *testing.T) {
	skipIfNoFairy(t)

	nefPath, manifestPath := getBuiltContractPaths(t, "MiniAppFactoryV2")
	client := NewClient(fairyRPCURL)

	sessionID, _, err := client.SetupSessionWithGas(1000_00000000)
	if err != nil {
		t.Skipf("SetupSessionWithGas: %v", err)
	}
	defer client.DeleteSession(sessionID)

	deployResult, err := client.VirtualDeploy(sessionID, nefPath, manifestPath)
	if err != nil {
		t.Fatalf("VirtualDeploy: %v", err)
	}
	if deployResult.State != "HALT" {
		t.Fatalf("deploy state = %s, want HALT", deployResult.State)
	}
	if strings.TrimSpace(deployResult.ContractHash) == "" {
		t.Fatal("VirtualDeploy returned empty contract hash")
	}

	adminResult, err := client.InvokeFunctionWithSession(sessionID, false, deployResult.ContractHash, "admin", nil)
	if err != nil {
		t.Fatalf("admin(): %v", err)
	}
	if adminResult.State != "HALT" {
		t.Fatalf("admin() state = %s, want HALT", adminResult.State)
	}
	if len(adminResult.Stack) == 0 {
		t.Fatal("admin() returned empty stack")
	}

	adminHash, err := chain.ParseHash160(adminResult.Stack[0])
	if err != nil {
		t.Fatalf("parse admin hash: %v", err)
	}
	if adminHash == "" || adminHash == "0x0000000000000000000000000000000000000000" {
		t.Fatalf("admin hash = %q, want non-zero hash", adminHash)
	}

	categoriesResult, err := client.InvokeFunctionWithSession(sessionID, false, deployResult.ContractHash, "getAllCategories", nil)
	if err != nil {
		t.Fatalf("getAllCategories(): %v", err)
	}
	if categoriesResult.State != "HALT" {
		t.Fatalf("getAllCategories() state = %s, want HALT", categoriesResult.State)
	}
	if len(categoriesResult.Stack) == 0 {
		t.Fatal("getAllCategories() returned empty stack")
	}

	items, err := chain.ParseArray(categoriesResult.Stack[0])
	if err != nil {
		t.Fatalf("parse category array: %v", err)
	}
	if len(items) < 7 {
		t.Fatalf("getAllCategories() returned %d categories, want at least 7", len(items))
	}

	want := map[string]bool{
		"gaming":     false,
		"defi":       false,
		"governance": false,
	}
	for _, item := range items {
		value, err := chain.ParseString(item)
		if err != nil {
			t.Fatalf("parse category value: %v", err)
		}
		if _, ok := want[value]; ok {
			want[value] = true
		}
	}
	for category, found := range want {
		if !found {
			t.Fatalf("getAllCategories() missing %q", category)
		}
	}

	t.Run("SetAppRegistryRoundTrip", func(t *testing.T) {
		setResult, err := client.InvokeFunctionWithSession(sessionID, true, deployResult.ContractHash, "setAppRegistry", []interface{}{adminHash})
		if err != nil {
			t.Fatalf("setAppRegistry(): %v", err)
		}
		if setResult.State != "HALT" {
			t.Fatalf("setAppRegistry() state = %s, want HALT (exception: %s)", setResult.State, setResult.Exception)
		}

		registryResult, err := client.InvokeFunctionWithSession(sessionID, false, deployResult.ContractHash, "appRegistry", nil)
		if err != nil {
			t.Fatalf("appRegistry(): %v", err)
		}
		if registryResult.State != "HALT" {
			t.Fatalf("appRegistry() state = %s, want HALT", registryResult.State)
		}
		if len(registryResult.Stack) == 0 {
			t.Fatal("appRegistry() returned empty stack")
		}

		registryHash, err := chain.ParseHash160(registryResult.Stack[0])
		if err != nil {
			t.Fatalf("parse appRegistry hash: %v", err)
		}
		if registryHash != adminHash {
			t.Fatalf("appRegistry hash = %q, want %q", registryHash, adminHash)
		}
	})
}
