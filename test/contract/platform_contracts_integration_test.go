package contract

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"strconv"
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

	genesisScriptHash, err := nx.GetWalletScriptHash(account)
	if err != nil {
		t.Fatalf("GetWalletScriptHash(%s): %v", account, err)
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
		t.Logf("Deployed %s at %s", name, contract.Hash)
		return contract
	}

	paymentHub := deploy("PaymentHub")
	governance := deploy("Governance")
	priceFeed := deploy("PriceFeed")
	randomnessLog := deploy("RandomnessLog")
	appRegistry := deploy("AppRegistry")
	automationAnchor := deploy("AutomationAnchor")

	// Helpers for reading integer stack results.
	stackInt64 := func(label string, result *chain.InvokeResult) int64 {
		t.Helper()
		if result == nil || len(result.Stack) == 0 {
			t.Fatalf("%s: empty stack", label)
		}
		if result.Stack[0].Type != "Integer" {
			t.Fatalf("%s: expected Integer stack item, got %s", label, result.Stack[0].Type)
		}
		var raw string
		if err := json.Unmarshal(result.Stack[0].Value, &raw); err != nil {
			t.Fatalf("%s: parse integer value: %v", label, err)
		}
		val, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			t.Fatalf("%s: parse int64: %v", label, err)
		}
		return val
	}

	// Basic admin reads (smoke). Note: neo-devpack exports ABI method names in lowerCamelCase.
	if _, err := nx.InvokeWithAccountResults(paymentHub.Hash, "admin", account); err != nil {
		t.Fatalf("PaymentHub.admin: %v", err)
	}
	if _, err := nx.InvokeWithAccountResults(governance.Hash, "admin", account); err != nil {
		t.Fatalf("Governance.admin: %v", err)
	}

	// PriceFeed updater flow.
	if _, err := nx.InvokeWithAccount(priceFeed.Hash, "setUpdater", account, map[string]any{
		"type":  "Hash160",
		"value": genesisScriptHash,
	}); err != nil {
		t.Fatalf("PriceFeed.setUpdater: %v", err)
	}

	attestationHash := "0x" + strings.Repeat("11", 32)
	ts := time.Now().Unix()
	if _, err := nx.InvokeWithAccount(priceFeed.Hash, "update", account,
		"BTC-USD", int64(1), int64(100000000), ts, attestationHash, int64(1),
	); err != nil {
		t.Fatalf("PriceFeed.update: %v", err)
	}
	if _, err := nx.InvokeWithAccountResults(priceFeed.Hash, "getLatest", account, "BTC-USD"); err != nil {
		t.Fatalf("PriceFeed.getLatest: %v", err)
	}

	// RandomnessLog updater flow.
	if _, err := nx.InvokeWithAccount(randomnessLog.Hash, "setUpdater", account, map[string]any{
		"type":  "Hash160",
		"value": genesisScriptHash,
	}); err != nil {
		t.Fatalf("RandomnessLog.setUpdater: %v", err)
	}

	recordID := "0x" + strings.Repeat("aa", 32)
	randomness := "0x" + strings.Repeat("bb", 32)
	if _, err := nx.InvokeWithAccount(randomnessLog.Hash, "record", account,
		recordID, randomness, attestationHash, ts,
	); err != nil {
		t.Fatalf("RandomnessLog.record: %v", err)
	}
	if _, err := nx.InvokeWithAccountResults(randomnessLog.Hash, "get", account, recordID); err != nil {
		t.Fatalf("RandomnessLog.get: %v", err)
	}

	// AppRegistry register/get.
	appID := hexBytes("app-1")
	manifestHash := "0x" + strings.Repeat("cc", 32)
	entryURL := hexBytes("https://example.com/app")
	developerPubKey := "0x" + strings.Repeat("dd", 33)

	if _, err := nx.InvokeWithAccount(appRegistry.Hash, "register", account,
		appID, manifestHash, entryURL, developerPubKey,
	); err != nil {
		t.Fatalf("AppRegistry.register: %v", err)
	}
	if _, err := nx.InvokeWithAccountResults(appRegistry.Hash, "getApp", account, appID); err != nil {
		t.Fatalf("AppRegistry.getApp: %v", err)
	}

	// AutomationAnchor task registry + anti-replay.
	if _, err := nx.InvokeWithAccount(automationAnchor.Hash, "setUpdater", account, map[string]any{
		"type":  "Hash160",
		"value": genesisScriptHash,
	}); err != nil {
		t.Fatalf("AutomationAnchor.setUpdater: %v", err)
	}

	taskID := hexBytes("task-1")
	emptyBytes := "0x"

	if _, err := nx.InvokeWithAccount(automationAnchor.Hash, "registerTask", account,
		taskID, priceFeed.Hash, "update", emptyBytes, int64(0), true,
	); err != nil {
		t.Fatalf("AutomationAnchor.registerTask: %v", err)
	}

	txHashBytes := "0x" + strings.Repeat("ee", 32)
	if _, err := nx.InvokeWithAccount(automationAnchor.Hash, "markExecuted", account,
		taskID, int64(1), txHashBytes,
	); err != nil {
		t.Fatalf("AutomationAnchor.markExecuted: %v", err)
	}

	// =========================================================================
	// PaymentHub basic workflow (GAS-only)
	// =========================================================================

	recipient := genesisScriptHash
	recipients := []string{recipient}
	shares := []int64{10000}

	if _, err := nx.InvokeWithAccount(paymentHub.Hash, "configureApp", account,
		appID,
		map[string]any{"type": "Hash160", "value": genesisScriptHash},
		recipients,
		shares,
		true,
	); err != nil {
		t.Fatalf("PaymentHub.configureApp: %v", err)
	}

	amount := int64(100000000) // 1 GAS (GAS has 8 decimals)
	if _, err := nx.InvokeWithAccount(paymentHub.Hash, "pay", account, appID, amount, "test payment"); err != nil {
		t.Fatalf("PaymentHub.pay: %v", err)
	}

	balBefore, err := nx.InvokeWithAccountResults(paymentHub.Hash, "getAppBalance", account, appID)
	if err != nil {
		t.Fatalf("PaymentHub.getAppBalance: %v", err)
	}
	if got := stackInt64("PaymentHub.getAppBalance", balBefore); got < amount {
		t.Fatalf("PaymentHub.getAppBalance: expected >= %d, got %d", amount, got)
	}

	if _, err := nx.InvokeWithAccount(paymentHub.Hash, "withdraw", account, appID); err != nil {
		t.Fatalf("PaymentHub.withdraw: %v", err)
	}

	balAfter, err := nx.InvokeWithAccountResults(paymentHub.Hash, "getAppBalance", account, appID)
	if err != nil {
		t.Fatalf("PaymentHub.getAppBalance(after): %v", err)
	}
	if got := stackInt64("PaymentHub.getAppBalance(after)", balAfter); got != 0 {
		t.Fatalf("PaymentHub.getAppBalance(after): expected 0, got %d", got)
	}

	// =========================================================================
	// Governance basic workflow (NEO-only)
	// =========================================================================

	if _, err := nx.InvokeWithAccount(governance.Hash, "stake", account, int64(10)); err != nil {
		t.Fatalf("Governance.stake: %v", err)
	}

	stakeRes, err := nx.InvokeWithAccountResults(governance.Hash, "getStake", account, map[string]any{
		"type":  "Hash160",
		"value": genesisScriptHash,
	})
	if err != nil {
		t.Fatalf("Governance.getStake: %v", err)
	}
	if got := stackInt64("Governance.getStake", stakeRes); got < 10 {
		t.Fatalf("Governance.getStake: expected >= 10, got %d", got)
	}

	proposalID := hexBytes("proposal-1")
	if _, err := nx.InvokeWithAccount(governance.Hash, "createProposal", account,
		proposalID, "test proposal", int64(0), int64(10_000_000_000_000),
	); err != nil {
		t.Fatalf("Governance.createProposal: %v", err)
	}

	if _, err := nx.InvokeWithAccount(governance.Hash, "vote", account, proposalID, true, int64(5)); err != nil {
		t.Fatalf("Governance.vote: %v", err)
	}

	if _, err := nx.InvokeWithAccount(governance.Hash, "unstake", account, int64(1)); err != nil {
		t.Fatalf("Governance.unstake: %v", err)
	}
}

func hexBytes(value string) string {
	return "0x" + hex.EncodeToString([]byte(value))
}
