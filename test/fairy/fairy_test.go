// Package fairy provides integration tests using Neo Fairy.
package fairy

import (
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

func getContractPaths(t *testing.T) (nefPath, manifestPath string) {
	t.Helper()

	// Find contracts relative to test file
	testDir, _ := os.Getwd()
	root := filepath.Join(testDir, "..", "..")

	nefPath = filepath.Join(root, "contracts", "build", "PriceFeed.nef")
	manifestPath = filepath.Join(root, "contracts", "build", "PriceFeed.manifest.json")

	if _, err := os.Stat(nefPath); os.IsNotExist(err) {
		t.Skipf("Contract not found: %s", nefPath)
	}
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		t.Skipf("Manifest not found: %s", manifestPath)
	}

	return nefPath, manifestPath
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

	// Create session
	sessionID, err := client.NewSession()
	if err != nil {
		t.Fatalf("NewSession: %v", err)
	}
	t.Logf("Created session: %s", sessionID)

	// Delete session
	if err := client.DeleteSession(sessionID); err != nil {
		t.Errorf("DeleteSession: %v", err)
	}
}

// TestFairyVirtualDeploy tests virtual contract deployment.
func TestFairyVirtualDeploy(t *testing.T) {
	skipIfNoFairy(t)

	nefPath, manifestPath := getContractPaths(t)
	client := NewClient(fairyRPCURL)

	// Setup session with GAS for deployment (1000 GAS)
	sessionID, accountHash, err := client.SetupSessionWithGas(1000_00000000)
	if err != nil {
		t.Skipf("SetupSessionWithGas: %v", err)
	}
	defer client.DeleteSession(sessionID)
	t.Logf("Session: %s, Account: %s", sessionID, accountHash)

	// Deploy contract
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

	// Setup session with GAS for deployment
	sessionID, _, err := client.SetupSessionWithGas(1000_00000000)
	if err != nil {
		t.Skipf("SetupSessionWithGas: %v", err)
	}
	defer client.DeleteSession(sessionID)

	// Deploy PriceFeed contract
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

	// Setup session with GAS
	sessionID, _, err := client.SetupSessionWithGas(1000_00000000)
	if err != nil {
		t.Skipf("SetupSessionWithGas: %v", err)
	}
	defer client.DeleteSession(sessionID)

	// Deploy contract
	deployResult, err := client.VirtualDeploy(sessionID, nefPath, manifestPath)
	if err != nil {
		t.Fatalf("VirtualDeploy: %v", err)
	}
	contractHash := deployResult.ContractHash
	t.Logf("Contract deployed: %s", contractHash)

	// Set virtual time (to avoid timestamp issues)
	now := uint64(time.Now().UnixMilli())
	if setTimeErr := client.SetTime(sessionID, now); setTimeErr != nil {
		t.Logf("SetTime: %v (might not be supported)", setTimeErr)
	}

	// Get admin address (should be the deployer)
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

	// Updater is optional until configured.
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

	testDir, _ := os.Getwd()
	root := filepath.Join(testDir, "..", "..")
	nefPath := filepath.Join(root, "contracts", "build", "PriceFeed.nef")
	manifestPath := filepath.Join(root, "contracts", "build", "PriceFeed.manifest.json")

	if _, err := os.Stat(nefPath); os.IsNotExist(err) {
		b.Skip("Contract not found")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sessionID, _ := client.NewSession()
		client.VirtualDeploy(sessionID, nefPath, manifestPath)
		client.DeleteSession(sessionID)
	}
}
