//go:build scripts

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	confirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	testnetMagic  = uint32(894710606)
	mainnetMagic  = uint32(860833102)
)

type contractTarget struct {
	Name         string `json:"name"`
	ExistingHash string `json:"existing_hash"`
	NEFPath      string `json:"nef_path"`
	ManifestPath string `json:"manifest_path"`
}

type updateReport struct {
	Network        string         `json:"network"`
	RPCURL         string         `json:"rpc_url"`
	NetworkMagic   uint32         `json:"network_magic"`
	Signer         string         `json:"signer"`
	SignerHash     string         `json:"signer_hash"`
	Targets        []targetReport `json:"targets"`
	Transactions   []txRecord     `json:"transactions"`
	Validation     map[string]any `json:"validation"`
	GeneratedAtUTC string         `json:"generated_at_utc"`
}

type targetReport struct {
	Name                 string `json:"name"`
	ExistingHash         string `json:"existing_hash"`
	OnChainUpdateCounter uint16 `json:"on_chain_update_counter"`
	OnChainHasUpdate     bool   `json:"on_chain_has_update"`
	AdminMatchesSigner   bool   `json:"admin_matches_signer"`
	Updated              bool   `json:"updated"`
	SkippedReason        string `json:"skipped_reason,omitempty"`
}

type txRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if os.Getenv("CONFIRM_PLATFORM_CONTRACT_UPDATE") != confirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_CONTRACT_UPDATE=%s to write chain", confirmPhrase)
	}
	network := strings.ToLower(firstNonEmpty(os.Getenv("PLATFORM_UPDATE_NETWORK"), "testnet"))
	expectedMagic, rpcURL, wif, reportPath, deploymentPath, err := networkConfig(network)
	if err != nil {
		return err
	}
	if wif == "" {
		return fmt.Errorf("%s signer WIF is not configured", network)
	}
	targets, err := loadTargets(network, deploymentPath)
	if err != nil {
		return err
	}
	targetFilter := parseCSV(os.Getenv("PLATFORM_UPDATE_TARGETS"))
	if len(targetFilter) > 0 {
		targets = filterTargets(targets, targetFilter)
	}
	if len(targets) == 0 {
		return fmt.Errorf("no update targets selected")
	}

	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{DialTimeout: 20 * time.Second, RequestTimeout: 20 * time.Second})
	if err != nil {
		return fmt.Errorf("connect RPC: %w", err)
	}
	version, err := client.GetVersion()
	if err != nil {
		return fmt.Errorf("read RPC version: %w", err)
	}
	actualMagic := uint32(version.Protocol.Network)
	if actualMagic != expectedMagic {
		return fmt.Errorf("RPC network magic mismatch: got %d, expected %d for %s", actualMagic, expectedMagic, network)
	}

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("invalid %s signer WIF", network)
	}
	acc := wallet.NewAccountFromPrivateKey(priv)
	signerHash := priv.GetScriptHash()
	act, err := actor.New(client, []actor.SignerAccount{{
		Signer: transaction.Signer{
			Account: acc.Contract.ScriptHash(),
			Scopes:  transaction.Global,
		},
		Account: acc,
	}})
	if err != nil {
		return fmt.Errorf("create actor: %w", err)
	}

	report := updateReport{
		Network:        network,
		RPCURL:         rpcURL,
		NetworkMagic:   actualMagic,
		Signer:         acc.Address,
		SignerHash:     "0x" + signerHash.StringLE(),
		Targets:        []targetReport{},
		Transactions:   []txRecord{},
		Validation:     map[string]any{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}
	fmt.Printf("network=%s magic=%d signer=%s\n", network, actualMagic, acc.Address)

	for _, target := range targets {
		targetHash, err := parseHash(target.ExistingHash)
		if err != nil {
			return fmt.Errorf("parse %s hash: %w", target.Name, err)
		}
		state, err := client.GetContractStateByHash(targetHash)
		if err != nil {
			return fmt.Errorf("%s contract not found at %s: %w", target.Name, target.ExistingHash, err)
		}
		tr := targetReport{
			Name:                 target.Name,
			ExistingHash:         "0x" + targetHash.StringLE(),
			OnChainUpdateCounter: state.UpdateCounter,
			OnChainHasUpdate:     state.Manifest.ABI.GetMethod("update", 2) != nil,
		}
		admin, err := callUint160(act, targetHash, "admin")
		if err != nil {
			admin, err = callUint160(act, targetHash, "Admin")
		}
		if err != nil {
			tr.SkippedReason = "admin method unavailable: " + err.Error()
			report.Targets = append(report.Targets, tr)
			continue
		}
		tr.AdminMatchesSigner = admin == signerHash
		if !tr.AdminMatchesSigner {
			tr.SkippedReason = "signer is not contract admin"
			report.Targets = append(report.Targets, tr)
			continue
		}
		if !tr.OnChainHasUpdate {
			tr.SkippedReason = "on-chain ABI does not expose update(nef,manifest)"
			report.Targets = append(report.Targets, tr)
			continue
		}
		nefBytes, err := os.ReadFile(target.NEFPath)
		if err != nil {
			return fmt.Errorf("read %s nef: %w", target.Name, err)
		}
		manifestBytes, err := os.ReadFile(target.ManifestPath)
		if err != nil {
			return fmt.Errorf("read %s manifest: %w", target.Name, err)
		}
		txid, vub, err := act.SendCall(targetHash, "update", nefBytes, string(manifestBytes))
		if err != nil {
			return fmt.Errorf("send %s update: %w", target.Name, err)
		}
		fmt.Printf("%s update tx: 0x%s\n", target.Name, txid.StringLE())
		report.Transactions = append(report.Transactions, txRecord{Label: "Update " + target.Name, TxID: "0x" + txid.StringLE(), VUB: vub})
		if err := waitForTx(ctx, client, txid); err != nil {
			return fmt.Errorf("wait %s update: %w", target.Name, err)
		}
		updatedState, err := client.GetContractStateByHash(targetHash)
		if err != nil {
			return fmt.Errorf("read %s after update: %w", target.Name, err)
		}
		tr.Updated = true
		report.Validation[target.Name+"_update_counter_before"] = state.UpdateCounter
		report.Validation[target.Name+"_update_counter_after"] = updatedState.UpdateCounter
		report.Targets = append(report.Targets, tr)
	}

	if err := os.MkdirAll(filepath.Dir(reportPath), 0755); err != nil {
		return err
	}
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(reportPath, append(out, '\n'), 0644); err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}

func networkConfig(network string) (uint32, string, string, string, string, error) {
	switch network {
	case "testnet":
		return testnetMagic,
			firstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), "https://testnet1.neo.coz.io:443"),
			firstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"), os.Getenv("FLAGSHIP_LIVE_WIF")),
			"contracts/build/testnet_platform_update_latest.json",
			"contracts/build/testnet_anchor_deployment.json",
			nil
	case "mainnet":
		return mainnetMagic,
			firstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), "https://mainnet2.neo.coz.io:443"),
			firstNonEmpty(os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF"), os.Getenv("MINIAPP_MAINNET_DEPLOY_WIF")),
			"contracts/build/mainnet_platform_update_latest.json",
			"contracts/build/mainnet_anchor_deployment.json",
			nil
	default:
		return 0, "", "", "", "", fmt.Errorf("unsupported PLATFORM_UPDATE_NETWORK=%q", network)
	}
}

func loadTargets(network string, deploymentPath string) ([]contractTarget, error) {
	type deployment struct {
		PlatformAnchor string `json:"platform_anchor"`
		PlatformDeFi   string `json:"platform_defi"`
	}
	var deployed deployment
	if data, err := os.ReadFile(deploymentPath); err == nil {
		_ = json.Unmarshal(data, &deployed)
	}
	if network == "testnet" && deployed.PlatformDeFi == "" {
		deployed.PlatformDeFi = "0xb43bd0ded09b5d79ed858484106affc1c858483c"
	}
	if deployed.PlatformAnchor == "" {
		deployed.PlatformAnchor = "0xa1ca7a610105686635f31de8e174ae3ce6b61a3e"
	}
	targets := []contractTarget{}
	if deployed.PlatformAnchor != "" {
		targets = append(targets, contractTarget{
			Name:         "PlatformAnchor",
			ExistingHash: deployed.PlatformAnchor,
			NEFPath:      "contracts/build/PlatformAnchor.nef",
			ManifestPath: "contracts/build/PlatformAnchor.manifest.json",
		})
	}
	if deployed.PlatformDeFi != "" {
		targets = append(targets, contractTarget{
			Name:         "PlatformDeFi",
			ExistingHash: deployed.PlatformDeFi,
			NEFPath:      "contracts/build/PlatformDeFi.nef",
			ManifestPath: "contracts/build/PlatformDeFi.manifest.json",
		})
	}
	return targets, nil
}

func filterTargets(targets []contractTarget, allowed map[string]bool) []contractTarget {
	filtered := make([]contractTarget, 0, len(targets))
	for _, target := range targets {
		if allowed[strings.ToLower(target.Name)] {
			filtered = append(filtered, target)
		}
	}
	return filtered
}

func parseCSV(raw string) map[string]bool {
	result := map[string]bool{}
	for _, item := range strings.Split(raw, ",") {
		if trimmed := strings.ToLower(strings.TrimSpace(item)); trimmed != "" {
			result[trimmed] = true
		}
	}
	return result
}

func callUint160(act *actor.Actor, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return util.Uint160{}, err
	}
	if inv.State != "HALT" {
		return util.Uint160{}, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	if len(inv.Stack) == 0 {
		return util.Uint160{}, nil
	}
	bytes, err := inv.Stack[0].TryBytes()
	if err != nil {
		return util.Uint160{}, err
	}
	return util.Uint160DecodeBytesBE(bytes)
}

func waitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(2 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for transaction 0x%s", txid.StringLE())
		case <-ticker.C:
			appLog, err := client.GetApplicationLog(txid, nil)
			if err != nil {
				continue
			}
			if len(appLog.Executions) == 0 {
				continue
			}
			exec := appLog.Executions[0]
			if exec.VMState.HasFlag(1) {
				return nil
			}
			return fmt.Errorf("transaction 0x%s failed: %s", txid.StringLE(), exec.FaultException)
		}
	}
}

func parseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
