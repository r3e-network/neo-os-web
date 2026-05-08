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
	miniappUpdateConfirm      = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	miniappUpdateTestnetMagic = uint32(894710606)
	miniappUpdateMainnetMagic = uint32(860833102)
)

type miniappUpdateTarget struct {
	Name         string
	AppManifest  string
	NEFPath      string
	ManifestPath string
}

type miniappManifestContract struct {
	ID        string            `json:"id"`
	Contracts map[string]string `json:"contracts"`
}

type miniappUpdateReport struct {
	Network        string                   `json:"network"`
	RPCURL         string                   `json:"rpc_url"`
	NetworkMagic   uint32                   `json:"network_magic"`
	Signer         string                   `json:"signer"`
	SignerHash     string                   `json:"signer_hash"`
	Targets        []miniappUpdateTargetRow `json:"targets"`
	Transactions   []miniappUpdateTx        `json:"transactions"`
	GeneratedAtUTC string                   `json:"generated_at_utc"`
}

type miniappUpdateTargetRow struct {
	Name                 string `json:"name"`
	AppID                string `json:"app_id"`
	ExistingHash         string `json:"existing_hash"`
	OnChainUpdateCounter uint16 `json:"on_chain_update_counter"`
	OnChainHasUpdate     bool   `json:"on_chain_has_update"`
	AdminMatchesSigner   bool   `json:"admin_matches_signer"`
	Updated              bool   `json:"updated"`
	SkippedReason        string `json:"skipped_reason,omitempty"`
}

type miniappUpdateTx struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

var miniappUpdateTargets = []miniappUpdateTarget{
	{"MiniAppEventTicketPass", "apps/event-ticket-pass/neo-manifest.json", "contracts/build/MiniAppEventTicketPass.nef", "contracts/build/MiniAppEventTicketPass.manifest.json"},
	{"MiniAppMilestoneEscrow", "apps/milestone-escrow/neo-manifest.json", "contracts/build/MiniAppMilestoneEscrow.nef", "contracts/build/MiniAppMilestoneEscrow.manifest.json"},
	{"MiniAppQuadraticFunding", "apps/quadratic-funding/neo-manifest.json", "contracts/build/MiniAppQuadraticFunding.nef", "contracts/build/MiniAppQuadraticFunding.manifest.json"},
	{"MiniAppSoulboundCertificate", "apps/soulbound-certificate/neo-manifest.json", "contracts/build/MiniAppSoulboundCertificate.nef", "contracts/build/MiniAppSoulboundCertificate.manifest.json"},
	{"MiniAppDevTipping", "apps/dev-tipping/neo-manifest.json", "contracts/build/MiniAppDevTipping.nef", "contracts/build/MiniAppDevTipping.manifest.json"},
	{"MiniAppGovMerc", "apps/gov-merc/neo-manifest.json", "contracts/build/MiniAppGovMerc.nef", "contracts/build/MiniAppGovMerc.manifest.json"},
	{"MiniAppGraveyard", "apps/graveyard/neo-manifest.json", "contracts/build/MiniAppGraveyard.nef", "contracts/build/MiniAppGraveyard.manifest.json"},
	{"MiniAppTimeCapsule", "apps/time-capsule/neo-manifest.json", "contracts/build/MiniAppTimeCapsule.nef", "contracts/build/MiniAppTimeCapsule.manifest.json"},
}

func main() {
	if err := runMiniappUpdate(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runMiniappUpdate() error {
	network := strings.ToLower(miniappUpdateFirst(os.Getenv("MINIAPP_CONTRACT_UPDATE_NETWORK"), "testnet"))
	expectedMagic, rpcURL, signerWIF, manifestNetwork, reportPath, err := miniappUpdateNetworkConfig(network)
	if err != nil {
		return err
	}
	if signerWIF == "" {
		return fmt.Errorf("%s signer WIF is not configured", network)
	}

	dryRun := miniappUpdateTruthy(os.Getenv("MINIAPP_CONTRACT_UPDATE_DRY_RUN"))
	if !dryRun && os.Getenv("CONFIRM_MINIAPP_CONTRACT_UPDATE") != miniappUpdateConfirm {
		return fmt.Errorf("set CONFIRM_MINIAPP_CONTRACT_UPDATE=%s to write chain", miniappUpdateConfirm)
	}

	filter := miniappUpdateCSV(os.Getenv("MINIAPP_CONTRACT_UPDATE_TARGETS"))
	targets := miniappUpdateFilterTargets(miniappUpdateTargets, filter)
	if len(targets) == 0 {
		return fmt.Errorf("no miniapp update targets selected")
	}

	priv, err := keys.NewPrivateKeyFromWIF(signerWIF)
	if err != nil {
		return fmt.Errorf("invalid %s signer WIF", network)
	}
	acc := wallet.NewAccountFromPrivateKey(priv)
	signerHash := priv.GetScriptHash()

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

	report := miniappUpdateReport{
		Network:        network,
		RPCURL:         rpcURL,
		NetworkMagic:   actualMagic,
		Signer:         acc.Address,
		SignerHash:     "0x" + signerHash.StringLE(),
		Targets:        []miniappUpdateTargetRow{},
		Transactions:   []miniappUpdateTx{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}
	mode := "write"
	if dryRun {
		mode = "dry-run"
	}
	fmt.Printf("network=%s magic=%d signer=%s mode=%s\n", network, actualMagic, acc.Address, mode)

	for _, target := range targets {
		row, err := miniappUpdateOne(ctx, client, act, signerHash, target, manifestNetwork, dryRun, &report)
		if err != nil {
			return err
		}
		report.Targets = append(report.Targets, row)
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

func miniappUpdateOne(ctx context.Context, client *rpcclient.Client, act *actor.Actor, signerHash util.Uint160, target miniappUpdateTarget, manifestNetwork string, dryRun bool, report *miniappUpdateReport) (miniappUpdateTargetRow, error) {
	manifestData, err := os.ReadFile(target.AppManifest)
	if err != nil {
		return miniappUpdateTargetRow{}, fmt.Errorf("read %s: %w", target.AppManifest, err)
	}
	var appManifest miniappManifestContract
	if err := json.Unmarshal(manifestData, &appManifest); err != nil {
		return miniappUpdateTargetRow{}, fmt.Errorf("parse %s: %w", target.AppManifest, err)
	}
	hashText := strings.TrimSpace(appManifest.Contracts[manifestNetwork])
	if hashText == "" {
		return miniappUpdateTargetRow{}, fmt.Errorf("%s missing %s contract hash", target.AppManifest, manifestNetwork)
	}
	contractHash, err := miniappUpdateParseHash(hashText)
	if err != nil {
		return miniappUpdateTargetRow{}, fmt.Errorf("parse %s hash: %w", target.Name, err)
	}

	state, err := client.GetContractStateByHash(contractHash)
	if err != nil {
		return miniappUpdateTargetRow{}, fmt.Errorf("%s contract not found at %s: %w", target.Name, hashText, err)
	}
	row := miniappUpdateTargetRow{
		Name:                 target.Name,
		AppID:                appManifest.ID,
		ExistingHash:         "0x" + contractHash.StringLE(),
		OnChainUpdateCounter: state.UpdateCounter,
		OnChainHasUpdate:     state.Manifest.ABI.GetMethod("update", 2) != nil,
	}

	admin, err := miniappUpdateCallUint160(act, contractHash, "admin")
	if err != nil {
		admin, err = miniappUpdateCallUint160(act, contractHash, "Admin")
	}
	if err != nil {
		row.SkippedReason = "admin method unavailable: " + err.Error()
		return row, nil
	}
	row.AdminMatchesSigner = admin == signerHash
	if !row.AdminMatchesSigner {
		row.SkippedReason = "signer is not contract admin"
		return row, nil
	}
	if !row.OnChainHasUpdate {
		row.SkippedReason = "on-chain ABI does not expose update(nef,manifest)"
		return row, nil
	}
	if dryRun {
		row.SkippedReason = "dry run: eligible for update"
		return row, nil
	}

	nefBytes, err := os.ReadFile(target.NEFPath)
	if err != nil {
		return row, fmt.Errorf("read %s nef: %w", target.Name, err)
	}
	manifestBytes, err := os.ReadFile(target.ManifestPath)
	if err != nil {
		return row, fmt.Errorf("read %s manifest: %w", target.Name, err)
	}
	txid, vub, err := act.SendCall(contractHash, "update", nefBytes, string(manifestBytes))
	if err != nil {
		return row, fmt.Errorf("send %s update: %w", target.Name, err)
	}
	report.Transactions = append(report.Transactions, miniappUpdateTx{Label: "Update " + target.Name, TxID: "0x" + txid.StringLE(), VUB: vub})
	fmt.Printf("%s update tx: 0x%s\n", target.Name, txid.StringLE())
	if err := miniappUpdateWaitForTx(ctx, client, txid); err != nil {
		return row, fmt.Errorf("wait %s update: %w", target.Name, err)
	}
	row.Updated = true
	return row, nil
}

func miniappUpdateNetworkConfig(network string) (uint32, string, string, string, string, error) {
	switch network {
	case "mainnet":
		return miniappUpdateMainnetMagic,
			miniappUpdateFirst(os.Getenv("NEO_MAINNET_RPC_URL"), os.Getenv("NEO_RPC_MAINNET"), "https://mainnet2.neo.coz.io:443"),
			miniappUpdateFirst(os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF"), os.Getenv("MINIAPP_MAINNET_DEPLOY_WIF")),
			"neo-n3-mainnet",
			"contracts/build/mainnet_miniapp_contract_update_latest.json",
			nil
	case "testnet":
		return miniappUpdateTestnetMagic,
			miniappUpdateFirst(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_TESTNET"), "https://testnet1.neo.coz.io:443"),
			miniappUpdateFirst(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"), os.Getenv("MINIAPP_TESTNET_DEPLOY_WIF")),
			"neo-n3-testnet",
			"contracts/build/testnet_miniapp_contract_update_latest.json",
			nil
	default:
		return 0, "", "", "", "", fmt.Errorf("unsupported MINIAPP_CONTRACT_UPDATE_NETWORK=%q", network)
	}
}

func miniappUpdateFilterTargets(targets []miniappUpdateTarget, filter map[string]bool) []miniappUpdateTarget {
	if len(filter) == 0 {
		return targets
	}
	filtered := make([]miniappUpdateTarget, 0, len(targets))
	for _, target := range targets {
		name := strings.ToLower(target.Name)
		if filter[name] || filter[strings.TrimPrefix(name, "miniapp")] {
			filtered = append(filtered, target)
		}
	}
	return filtered
}

func miniappUpdateCSV(raw string) map[string]bool {
	out := map[string]bool{}
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.ToLower(strings.TrimSpace(part)); trimmed != "" {
			out[trimmed] = true
		}
	}
	return out
}

func miniappUpdateCallUint160(act *actor.Actor, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
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

func miniappUpdateWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
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

func miniappUpdateParseHash(raw string) (util.Uint160, error) {
	return util.Uint160DecodeStringLE(strings.TrimPrefix(strings.TrimSpace(raw), "0x"))
}

func miniappUpdateFirst(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func miniappUpdateTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
