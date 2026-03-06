// Package fairy provides integration tests using Neo Fairy.
package fairy

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

const (
	fairyRPCURL = "http://127.0.0.1:16868"
)

func skipIfNoFairy(t *testing.T) {
	t.Helper()
	client := NewClient(fairyRPCURL)
	if !client.IsAvailable() {
		t.Skip("Neo Fairy not available at", fairyRPCURL)
	}
}

func builtContractPaths(contractName string) (nefPath, manifestPath string, err error) {
	testDir, wdErr := os.Getwd()
	if wdErr != nil {
		return "", "", fmt.Errorf("getwd: %w", wdErr)
	}
	root := filepath.Join(testDir, "..", "..")
	return filepath.Join(root, "contracts", "build", contractName+".nef"), filepath.Join(root, "contracts", "build", contractName+".manifest.json"), nil
}

func getBuiltContractPaths(t *testing.T, contractName string) (nefPath, manifestPath string) {
	t.Helper()

	nefPath, manifestPath, err := builtContractPaths(contractName)
	if err != nil {
		t.Fatalf("builtContractPaths(%s): %v", contractName, err)
	}

	if _, err := os.Stat(nefPath); os.IsNotExist(err) {
		t.Skipf("Contract not found: %s", nefPath)
	}
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		t.Skipf("Manifest not found: %s", manifestPath)
	}

	return nefPath, manifestPath
}

func getContractPaths(t *testing.T) (nefPath, manifestPath string) {
	t.Helper()
	return getBuiltContractPaths(t, "PriceFeed")
}

// TestFairyConnectivity tests basic connectivity to Fairy.
func TestFairyConnectivity(t *testing.T) {
	skipIfNoFairy(t)

	client := NewClient(fairyRPCURL)
	result, err := client.HelloFairy()
	if err != nil {
		t.Fatalf("HelloFairy: %v", err)
	}

	t.Logf("Fairy says: %+v", result)
}

// TestFairySessionManagement tests session creation and deletion.
func TestFairySessionManagement(t *testing.T) {
	skipIfNoFairy(t)

	client := NewClient(fairyRPCURL)

	sessionID, err := client.NewSession()
	if err != nil {
		t.Fatalf("NewSession: %v", err)
	}
	t.Logf("Created session: %s", sessionID)

	if err := client.DeleteSession(sessionID); err != nil {
		t.Errorf("DeleteSession: %v", err)
	}
}

// TestFairyVirtualDeploy tests virtual contract deployment.
func TestFairyVirtualDeploy(t *testing.T) {
	skipIfNoFairy(t)

	nefPath, manifestPath := getContractPaths(t)
	client := NewClient(fairyRPCURL)

	sessionID, accountHash, err := client.SetupSessionWithGas(1000_00000000)
	if err != nil {
		t.Skipf("SetupSessionWithGas: %v", err)
	}
	defer client.DeleteSession(sessionID)
	t.Logf("Session: %s, Account: %s", sessionID, accountHash)

	result, err := client.VirtualDeploy(sessionID, nefPath, manifestPath)
	if err != nil {
		t.Fatalf("VirtualDeploy: %v", err)
	}

	t.Logf("Contract deployed:")
	t.Logf("  Hash: %s", result.ContractHash)
	t.Logf("  Gas: %s", result.GasConsumed)
	t.Logf("  State: %s", result.State)

	if result.State != "HALT" {
		t.Errorf("expected HALT state, got %s", result.State)
	}
}

// TestPriceFeedContractWithFairy deploys the platform PriceFeed contract via Fairy.
func TestPriceFeedContractWithFairy(t *testing.T) {
	skipIfNoFairy(t)

	nefPath, manifestPath := getContractPaths(t)
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
	contractHash := deployResult.ContractHash
	t.Logf("PriceFeed deployed: %s", contractHash)

	adminResult, err := client.InvokeFunctionWithSession(sessionID, false, contractHash, "admin", nil)
	if err != nil {
		t.Fatalf("admin(): %v", err)
	}
	t.Logf("admin(): %s", adminResult.State)

	updaterResult, err := client.InvokeFunctionWithSession(sessionID, false, contractHash, "updater", nil)
	if err != nil {
		t.Fatalf("updater(): %v", err)
	}
	t.Logf("updater(): %s", updaterResult.State)
}

// TestPriceFeedReadOnlyFlow exercises basic read-only calls for PriceFeed via Fairy.
func TestPriceFeedReadOnlyFlow(t *testing.T) {
	skipIfNoFairy(t)

	nefPath, manifestPath := getContractPaths(t)
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
	contractHash := deployResult.ContractHash
	t.Logf("Contract deployed: %s", contractHash)

	now := uint64(time.Now().UnixMilli())
	if setTimeErr := client.SetTime(sessionID, now); setTimeErr != nil {
		t.Logf("SetTime: %v (might not be supported)", setTimeErr)
	}

	adminResult, err := client.InvokeFunctionWithSession(
		sessionID,
		false,
		contractHash,
		"admin",
		nil,
	)
	if err != nil {
		t.Fatalf("admin(): %v", err)
	}
	t.Logf("Admin result: %+v", adminResult)

	updaterResult, err := client.InvokeFunctionWithSession(sessionID, false, contractHash, "updater", nil)
	if err != nil {
		t.Fatalf("updater(): %v", err)
	}
	t.Logf("Updater result: %+v", updaterResult)
}

// BenchmarkFairyDeploy benchmarks contract deployment via Fairy.
func BenchmarkFairyDeploy(b *testing.B) {
	client := NewClient(fairyRPCURL)
	if !client.IsAvailable() {
		b.Skip("Neo Fairy not available")
	}

	nefPath, manifestPath, err := builtContractPaths("PriceFeed")
	if err != nil {
		b.Fatalf("builtContractPaths(PriceFeed): %v", err)
	}
	if _, err := os.Stat(nefPath); os.IsNotExist(err) {
		b.Skip("Contract not found")
	}
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		b.Skip("Manifest not found")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sessionID, _ := client.NewSession()
		client.VirtualDeploy(sessionID, nefPath, manifestPath)
		client.DeleteSession(sessionID)
	}
}
