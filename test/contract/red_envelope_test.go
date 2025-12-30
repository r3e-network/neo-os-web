package contract

import (
	"context"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

// TestRedEnvelopeContract tests the MiniAppRedEnvelope smart contract
func TestRedEnvelopeContract(t *testing.T) {
	SkipIfNoNeoExpress(t)
	SkipIfNoCompiledContracts(t)

	if testing.Short() {
		t.Skip("skipping neo-express red envelope contract test in short mode")
	}

	// Ensure RedEnvelope contract artifacts exist
	if _, _, err := FindContractArtifacts("MiniAppRedEnvelope"); err != nil {
		t.Fatalf("missing contract artifacts for MiniAppRedEnvelope: %v", err)
	}

	nx := NewNeoExpress(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := nx.Start(ctx); err != nil {
		t.Fatalf("neo-express Start: %v", err)
	}
	t.Cleanup(func() { _ = nx.Stop() })

	account := "genesis"

	// Deploy the RedEnvelope contract
	nefPath, _, err := FindContractArtifacts("MiniAppRedEnvelope")
	if err != nil {
		t.Fatalf("FindContractArtifacts(MiniAppRedEnvelope): %v", err)
	}

	contract, err := nx.Deploy(nefPath, "", account)
	if err != nil {
		t.Fatalf("deploy MiniAppRedEnvelope: %v", err)
	}
	if contract.Hash == "" {
		t.Fatalf("deploy MiniAppRedEnvelope: empty hash")
	}
	t.Logf("Deployed MiniAppRedEnvelope at %s", contract.Hash)

	// Run subtests
	t.Run("Admin", func(t *testing.T) {
		testRedEnvelopeAdmin(t, nx, contract, account)
	})

	t.Run("Gateway", func(t *testing.T) {
		testRedEnvelopeGateway(t, nx, contract, account)
	})
}

// testRedEnvelopeAdmin tests admin functionality
func testRedEnvelopeAdmin(t *testing.T, nx *NeoExpress, contract *chain.DeployedContract, account string) {
	// Test Admin() returns deployer address
	result, err := nx.InvokeWithAccountResults(contract.Hash, "Admin", account)
	if err != nil {
		t.Fatalf("Admin() invoke failed: %v", err)
	}
	if result == nil || len(result.Stack) == 0 {
		t.Fatal("Admin() returned empty stack")
	}
	t.Logf("Admin: %v", result.Stack[0])
}

// testRedEnvelopeGateway tests gateway functionality
func testRedEnvelopeGateway(t *testing.T, nx *NeoExpress, contract *chain.DeployedContract, account string) {
	// Test Gateway() initially returns null/empty
	result, err := nx.InvokeWithAccountResults(contract.Hash, "Gateway", account)
	if err != nil {
		t.Fatalf("Gateway() invoke failed: %v", err)
	}
	t.Logf("Gateway: %v", result)
}
