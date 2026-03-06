package contract

import (
	"context"
	"testing"
	"time"
)

func TestNeoExpressFreshChainCanDeployPriceFeed(t *testing.T) {
	SkipIfNoNeoExpress(t)
	SkipIfNoCompiledContracts(t)

	if testing.Short() {
		t.Skip("skipping neo-express deploy test in short mode")
	}

	nx := NewNeoExpress(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := nx.Start(ctx); err != nil {
		t.Fatalf("Start: %v", err)
	}

	nefPath, _, err := FindContractArtifacts("PriceFeed")
	if err != nil {
		t.Fatalf("FindContractArtifacts: %v", err)
	}

	contract, err := nx.Deploy(nefPath, "", "genesis")
	if err != nil {
		t.Fatalf("Deploy should succeed on a fresh NeoExpress harness: %v", err)
	}
	if contract.Hash == "" {
		t.Fatal("Deploy returned empty contract hash")
	}
}
