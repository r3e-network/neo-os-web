//go:build scripts

// Schedule or execute the 24h-timelocked PlatformRegistry self-update that
// lands the joint-audit contract fixes (H1 FundEnginePool memo grammar,
// spend-threshold-raise timelock, pause-push into minted shims) on the
// deployed testnet registry 0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b.
// The deployed build already enforces ScheduleUpdate -> 24h -> Update with
// the sha256(nef‖manifest) pin (PlatformRegistry.Governance.cs), so the
// update is two transactions a day apart; this script covers both steps.
//
// Env idioms match deploy_platform_registry.go:
//   PLATFORM_REGISTRY_UPDATE_ACTION   schedule | execute | status (default status)
//   PLATFORM_REGISTRY_UPDATE_DRY_RUN  default dry when unset; =false for writes
//   CONFIRM_PLATFORM_REGISTRY_UPDATE  =I_UNDERSTAND_THIS_WRITES_CHAIN for writes
//   NEO_TESTNET_WIF / FLAGSHIP_TESTNET_WIF, NEO_TESTNET_RPC_URL / NEO_RPC_URL
//   PLATFORM_REGISTRY_TESTNET_HASH    registry hash override
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	ruConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	ruTestnetMagic  = uint32(894710606)
	ruDefaultRPC    = "https://testnet1.neo.coz.io:443"
	ruRegistryHash  = "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b"
	ruNEFPath       = "contracts/build/PlatformRegistry.nef"
	ruManifestPath  = "contracts/build/PlatformRegistry.manifest.json"
)

type ruReport struct {
	Action       string         `json:"action"`
	Network      string         `json:"network"`
	RPCURL       string         `json:"rpc_url"`
	Signer       string         `json:"signer"`
	Registry     string         `json:"registry"`
	DryRun       bool           `json:"dry_run"`
	Transactions []ruTx         `json:"transactions"`
	Validation   map[string]any `json:"validation"`
	NextSteps    []string       `json:"next_steps"`
	GeneratedAt  string         `json:"generated_at_utc"`
}

type ruTx struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

func main() {
	if err := ruRun(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func ruRun() error {
	action := strings.ToLower(os.Getenv("PLATFORM_REGISTRY_UPDATE_ACTION"))
	if action == "" {
		action = "status"
	}
	dryRun := true
	if v, ok := os.LookupEnv("PLATFORM_REGISTRY_UPDATE_DRY_RUN"); ok {
		dryRun = ruTruthy(v)
	}
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_REGISTRY_UPDATE") != ruConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_REGISTRY_UPDATE=%s to write chain", ruConfirmPhrase)
	}
	wif := ruFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"))
	if wif == "" {
		return fmt.Errorf("testnet signer WIF is not configured (set NEO_TESTNET_WIF)")
	}
	rpcURL := ruFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), ruDefaultRPC)
	regHash, err := util.Uint160DecodeStringLE(strings.TrimPrefix(ruFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_TESTNET_HASH"), ruRegistryHash), "0x"))
	if err != nil {
		return fmt.Errorf("registry hash: %w", err)
	}
	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("invalid testnet WIF")
	}
	acc := wallet.NewAccountFromPrivateKey(priv)

	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{DialTimeout: 20 * time.Second, RequestTimeout: 30 * time.Second})
	if err != nil {
		return fmt.Errorf("connect RPC: %w", err)
	}
	version, err := client.GetVersion()
	if err != nil {
		return fmt.Errorf("read RPC version: %w", err)
	}
	if uint32(version.Protocol.Network) != ruTestnetMagic {
		return fmt.Errorf("RPC network magic mismatch: got %d, expected %d", version.Protocol.Network, ruTestnetMagic)
	}
	act, err := actor.New(client, []actor.SignerAccount{{
		Signer:  transaction.Signer{Account: acc.Contract.ScriptHash(), Scopes: transaction.Global},
		Account: acc,
	}})
	if err != nil {
		return fmt.Errorf("create actor: %w", err)
	}

	report := ruReport{
		Action:       action,
		Network:      "neo-n3-testnet",
		RPCURL:       rpcURL,
		Signer:       acc.Address,
		Registry:     "0x" + regHash.StringLE(),
		DryRun:       dryRun,
		Transactions: []ruTx{},
		Validation:   map[string]any{},
		NextSteps:    []string{},
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	admin, err := client.InvokeFunction(regHash, "admin", []smartcontract.Parameter{}, nil)
	if err != nil {
		return fmt.Errorf("read admin: %w", err)
	}
	adminHash, err := admin.Stack[0].TryBytes()
	if err != nil {
		return fmt.Errorf("decode admin: %w", err)
	}
	adminU, err := util.Uint160DecodeBytesBE(adminHash)
	if err != nil {
		return fmt.Errorf("decode admin hash: %w", err)
	}
	report.Validation["admin"] = "0x" + adminU.StringLE()
	report.Validation["admin_matches_signer"] = adminU == priv.GetScriptHash()
	if action != "status" && adminU != priv.GetScriptHash() {
		return fmt.Errorf("signer %s is not the registry admin", acc.Address)
	}

	switch action {
	case "status":
		return ruWriteReport(&report, []string{
			"schedule: PLATFORM_REGISTRY_UPDATE_ACTION=schedule PLATFORM_REGISTRY_UPDATE_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_UPDATE=I_UNDERSTAND_THIS_WRITES_CHAIN go run -tags scripts deploy/scripts/schedule_platform_registry_update.go",
		})
	case "schedule", "execute":
		return ruSubmitUpdate(ctx, act, client, acc, regHash, action, dryRun, &report)
	default:
		return fmt.Errorf("unknown PLATFORM_REGISTRY_UPDATE_ACTION %q (schedule|execute|status)", action)
	}
}

func ruSubmitUpdate(ctx context.Context, act *actor.Actor, client *rpcclient.Client, acc *wallet.Account, regHash util.Uint160, action string, dryRun bool, report *ruReport) error {
	nefBytes, err := os.ReadFile(ruNEFPath)
	if err != nil {
		return fmt.Errorf("read NEF: %w", err)
	}
	manifestBytes, err := os.ReadFile(ruManifestPath)
	if err != nil {
		return fmt.Errorf("read manifest: %w", err)
	}
	report.Validation["nef_bytes"] = len(nefBytes)
	report.Validation["manifest_bytes"] = len(manifestBytes)

	method := "scheduleUpdate"
	if action == "execute" {
		method = "update"
	}
	params := []smartcontract.Parameter{
		{Type: smartcontract.ByteArrayType, Value: nefBytes},
		{Type: smartcontract.StringType, Value: string(manifestBytes)},
	}
	if dryRun {
		signers := []transaction.Signer{{Account: acc.Contract.ScriptHash(), Scopes: transaction.Global}}
		res, err := client.InvokeFunction(regHash, method, params, signers)
		if err != nil {
			return fmt.Errorf("test-invoke %s: %w", method, err)
		}
		report.Validation["test_invoke_state"] = res.State
		report.Validation["test_invoke_exception"] = res.FaultException
		report.NextSteps = append(report.NextSteps,
			fmt.Sprintf("re-run with PLATFORM_REGISTRY_UPDATE_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_UPDATE=%s to send %s", ruConfirmPhrase, method))
		return ruWriteReport(report, nil)
	}
	txid, vub, err := act.SendCall(regHash, method, nefBytes, string(manifestBytes))
	if err != nil {
		return fmt.Errorf("send %s: %w", method, err)
	}
	report.Transactions = append(report.Transactions, ruTx{Label: "Registry " + method, TxID: "0x" + txid.StringLE(), VUB: vub})
	if err := ruWaitForTx(ctx, client, txid); err != nil {
		return fmt.Errorf("wait %s: %w", method, err)
	}
	if action == "schedule" {
		report.NextSteps = append(report.NextSteps,
			"update scheduled; execute after the 24h timelock with PLATFORM_REGISTRY_UPDATE_ACTION=execute PLATFORM_REGISTRY_UPDATE_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_UPDATE="+ruConfirmPhrase+" go run -tags scripts deploy/scripts/schedule_platform_registry_update.go")
	} else {
		state, err := client.GetContractStateByHash(regHash)
		if err == nil {
			report.Validation["update_counter_after"] = state.UpdateCounter
		}
		report.NextSteps = append(report.NextSteps, "registry updated on-chain; re-run deploy script verify action for full state")
	}
	return ruWriteReport(report, nil)
}

func ruWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
	for i := 0; i < 30; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(5 * time.Second):
		}
		tx, err := client.GetRawTransactionVerbose(txid)
		if err == nil && tx != nil && tx.Blockhash != (util.Uint256{}) {
			return nil
		}
	}
	return fmt.Errorf("tx %s not confirmed in time", txid.StringLE())
}

func ruWriteReport(report *ruReport, extra []string) error {
	report.NextSteps = append(report.NextSteps, extra...)
	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	return nil
}

func ruTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}

func ruFirstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
