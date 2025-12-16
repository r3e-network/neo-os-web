package contract

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

func TestPlatformContractsNeoExpressSmoke(t *testing.T) {
	SkipIfNoNeoExpress(t)

	if testing.Short() {
		t.Skip("skipping neo-express platform contract test in short mode")
	}

	// Ensure artifacts exist (skip if contracts weren't built).
	for _, name := range []string{
		"PaymentHub",
		"Governance",
		"PriceFeed",
		"RandomnessLog",
		"AppRegistry",
		"AutomationAnchor",
	} {
		if _, _, err := FindContractArtifacts(name); err != nil {
			t.Skip(err.Error())
		}
	}

	nx := NewNeoExpress(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := nx.Start(ctx); err != nil {
		t.Fatalf("neo-express Start: %v", err)
	}
	t.Cleanup(func() { _ = nx.Stop() })

	account := "genesis"

	genesisAddr, err := nx.GetWalletAddress(account)
	if err != nil {
		t.Fatalf("GetWalletAddress(%s): %v", account, err)
	}

	deploy := func(name string) *chain.DeployedContract {
		nefPath, _, err := FindContractArtifacts(name)
		if err != nil {
			t.Fatalf("FindContractArtifacts(%s): %v", name, err)
		}
		contract, err := nx.Deploy(nefPath, "", account)
		if err != nil {
			t.Fatalf("deploy %s: %v", name, err)
		}
		if contract.Hash == "" {
			t.Fatalf("deploy %s: empty hash", name)
		}
		// Give the node a moment to include the deployment tx.
		_ = nx.FastForward(1)
		t.Logf("Deployed %s at %s", name, contract.Hash)
		return contract
	}

	paymentHub := deploy("PaymentHub")
	governance := deploy("Governance")
	priceFeed := deploy("PriceFeed")
	randomnessLog := deploy("RandomnessLog")
	appRegistry := deploy("AppRegistry")
	automationAnchor := deploy("AutomationAnchor")

	// Basic admin reads (smoke).
	if _, err := nx.InvokeWithAccount(paymentHub.Hash, "Admin", account); err != nil {
		t.Fatalf("PaymentHub.Admin: %v", err)
	}
	if _, err := nx.InvokeWithAccount(governance.Hash, "Admin", account); err != nil {
		t.Fatalf("Governance.Admin: %v", err)
	}

	// PriceFeed updater flow.
	if _, err := nx.InvokeWithAccount(priceFeed.Hash, "SetUpdater", account, genesisAddr); err != nil {
		t.Fatalf("PriceFeed.SetUpdater: %v", err)
	}

	attestationHash := "0x" + strings.Repeat("11", 32)
	ts := fmt.Sprintf("%d", time.Now().Unix())
	if _, err := nx.InvokeWithAccount(priceFeed.Hash, "Update", account,
		"BTC-USD", "1", "100000000", ts, attestationHash, "1",
	); err != nil {
		t.Fatalf("PriceFeed.Update: %v", err)
	}
	if _, err := nx.InvokeWithAccount(priceFeed.Hash, "GetLatest", account, "BTC-USD"); err != nil {
		t.Fatalf("PriceFeed.GetLatest: %v", err)
	}

	// RandomnessLog updater flow.
	if _, err := nx.InvokeWithAccount(randomnessLog.Hash, "SetUpdater", account, genesisAddr); err != nil {
		t.Fatalf("RandomnessLog.SetUpdater: %v", err)
	}

	recordID := "0x" + strings.Repeat("aa", 32)
	randomness := "0x" + strings.Repeat("bb", 32)
	if _, err := nx.InvokeWithAccount(randomnessLog.Hash, "Record", account,
		recordID, randomness, attestationHash, ts,
	); err != nil {
		t.Fatalf("RandomnessLog.Record: %v", err)
	}
	if _, err := nx.InvokeWithAccount(randomnessLog.Hash, "Get", account, recordID); err != nil {
		t.Fatalf("RandomnessLog.Get: %v", err)
	}

	// AppRegistry register/get.
	appID := hexBytes("app-1")
	manifestHash := "0x" + strings.Repeat("cc", 32)
	entryURL := hexBytes("https://example.com/app")
	developerPubKey := "0x" + strings.Repeat("dd", 33)

	if _, err := nx.InvokeWithAccount(appRegistry.Hash, "Register", account,
		appID, manifestHash, entryURL, developerPubKey,
	); err != nil {
		t.Fatalf("AppRegistry.Register: %v", err)
	}
	if _, err := nx.InvokeWithAccount(appRegistry.Hash, "GetApp", account, appID); err != nil {
		t.Fatalf("AppRegistry.GetApp: %v", err)
	}

	// AutomationAnchor task registry + anti-replay.
	if _, err := nx.InvokeWithAccount(automationAnchor.Hash, "SetUpdater", account, genesisAddr); err != nil {
		t.Fatalf("AutomationAnchor.SetUpdater: %v", err)
	}

	taskID := hexBytes("task-1")
	emptyBytes := "0x"

	if _, err := nx.InvokeWithAccount(automationAnchor.Hash, "RegisterTask", account,
		taskID, priceFeed.Hash, "Update", emptyBytes, "0", "true",
	); err != nil {
		t.Fatalf("AutomationAnchor.RegisterTask: %v", err)
	}

	txHashBytes := "0x" + strings.Repeat("ee", 32)
	if _, err := nx.InvokeWithAccount(automationAnchor.Hash, "MarkExecuted", account,
		taskID, "1", txHashBytes,
	); err != nil {
		t.Fatalf("AutomationAnchor.MarkExecuted: %v", err)
	}
}

func hexBytes(value string) string {
	return "0x" + hex.EncodeToString([]byte(value))
}
