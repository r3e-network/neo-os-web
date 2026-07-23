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
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
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
	Route        string `json:"route"`
}

type updateReport struct {
	Network        string         `json:"network"`
	RPCURL         string         `json:"rpc_url"`
	NetworkMagic   uint32         `json:"network_magic"`
	Signer         string         `json:"signer"`
	SignerHash     string         `json:"signer_hash"`
	SignerInput    string         `json:"signer_input"`
	DryRun         bool           `json:"dry_run"`
	Targets        []targetReport `json:"targets"`
	Transactions   []txRecord     `json:"transactions"`
	Validation     map[string]any `json:"validation"`
	GeneratedAtUTC string         `json:"generated_at_utc"`
}

type targetReport struct {
	Name                 string `json:"name"`
	ExistingHash         string `json:"existing_hash"`
	Route                string `json:"route"`
	OnChainUpdateCounter uint16 `json:"on_chain_update_counter"`
	OnChainHasUpdate     bool   `json:"on_chain_has_update"`
	AdminMatchesSigner   bool   `json:"admin_matches_signer"`
	OnChainNEFChecksum   uint32 `json:"on_chain_nef_checksum"`
	LocalNEFChecksum     uint32 `json:"local_nef_checksum"`
	ArtifactMatches      bool   `json:"artifact_matches"`
	PreflightMethod      string `json:"preflight_method,omitempty"`
	PreflightState       string `json:"preflight_state,omitempty"`
	PreflightGas         int64  `json:"preflight_gas,omitempty"`
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
	dryRun := truthy(os.Getenv("PLATFORM_UPDATE_DRY_RUN"))
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_CONTRACT_UPDATE") != confirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_CONTRACT_UPDATE=%s to write chain", confirmPhrase)
	}
	network := strings.ToLower(firstNonEmpty(os.Getenv("PLATFORM_UPDATE_NETWORK"), "testnet"))
	expectedMagic, rpcURL, wif, reportPath, deploymentPath, err := networkConfig(network)
	if err != nil {
		return err
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

	var (
		act           *actor.Actor
		signerHash    util.Uint160
		signerAddress string
		signerInput   string
	)
	if wif != "" {
		priv, err := keys.NewPrivateKeyFromWIF(wif)
		if err != nil {
			return fmt.Errorf("invalid %s signer WIF", network)
		}
		acc := wallet.NewAccountFromPrivateKey(priv)
		signerHash = priv.GetScriptHash()
		signerAddress = acc.Address
		signerInput = "private-key"
		act, err = actor.New(client, []actor.SignerAccount{{
			Signer:  transaction.Signer{Account: acc.Contract.ScriptHash(), Scopes: transaction.Global},
			Account: acc,
		}})
		if err != nil {
			return fmt.Errorf("create actor: %w", err)
		}
	} else if dryRun {
		signerHash, err = parseSignerIdentity(os.Getenv("PLATFORM_UPDATE_DRY_RUN_SIGNER"))
		if err != nil {
			return fmt.Errorf("dry-run signer: %w", err)
		}
		signerAddress = address.Uint160ToString(signerHash)
		signerInput = "public-identity"
		watchOnly := &wallet.Account{
			Address:  signerAddress,
			Contract: &wallet.Contract{Deployed: true},
		}
		act, err = actor.New(client, []actor.SignerAccount{{
			Signer:  transaction.Signer{Account: signerHash, Scopes: transaction.Global},
			Account: watchOnly,
		}})
		if err != nil {
			return fmt.Errorf("create watch-only dry-run actor: %w", err)
		}
	} else {
		return fmt.Errorf("%s signer WIF is not configured", network)
	}

	report := updateReport{
		Network:        network,
		RPCURL:         rpcURL,
		NetworkMagic:   actualMagic,
		Signer:         signerAddress,
		SignerHash:     "0x" + signerHash.StringLE(),
		SignerInput:    signerInput,
		DryRun:         dryRun,
		Targets:        []targetReport{},
		Transactions:   []txRecord{},
		Validation:     map[string]any{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}
	mode := "write"
	if dryRun {
		mode = "dry-run"
	}
	fmt.Printf("network=%s magic=%d signer=%s mode=%s\n", network, actualMagic, signerAddress, mode)

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
			Route:                target.Route,
			OnChainUpdateCounter: state.UpdateCounter,
			OnChainHasUpdate:     state.Manifest.ABI.GetMethod("update", 2) != nil,
			OnChainNEFChecksum:   state.NEF.Checksum,
		}
		nefBytes, err := os.ReadFile(target.NEFPath)
		if err != nil {
			return fmt.Errorf("read %s nef: %w", target.Name, err)
		}
		nefFile, err := nef.FileFromBytes(nefBytes)
		if err != nil {
			return fmt.Errorf("parse %s nef: %w", target.Name, err)
		}
		manifestBytes, err := os.ReadFile(target.ManifestPath)
		if err != nil {
			return fmt.Errorf("read %s manifest: %w", target.Name, err)
		}
		tr.LocalNEFChecksum = nefFile.Checksum
		tr.ArtifactMatches = tr.OnChainNEFChecksum == tr.LocalNEFChecksum
		if tr.ArtifactMatches {
			tr.SkippedReason = "already current"
			report.Targets = append(report.Targets, tr)
			continue
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
		if dryRun {
			tr.PreflightMethod = "update"
			if target.Route == "timelocked" {
				tr.PreflightMethod = "scheduleUpdate"
				if state.Manifest.ABI.GetMethod("scheduleUpdate", 2) == nil {
					tr.SkippedReason = "on-chain ABI does not expose scheduleUpdate(nef,manifest)"
					report.Targets = append(report.Targets, tr)
					continue
				}
			}
			inv, err := act.Call(targetHash, tr.PreflightMethod, nefBytes, string(manifestBytes))
			if err != nil {
				tr.SkippedReason = "preflight RPC failed: " + err.Error()
				report.Targets = append(report.Targets, tr)
				continue
			}
			tr.PreflightState = inv.State
			tr.PreflightGas = inv.GasConsumed
			if inv.State != "HALT" {
				tr.SkippedReason = "preflight fault: " + inv.FaultException
			} else if target.Route == "timelocked" {
				tr.SkippedReason = "dry run: schedule eligible; execution requires the separate timelock action"
			} else {
				tr.SkippedReason = "dry run: direct update eligible"
			}
			report.Targets = append(report.Targets, tr)
			continue
		}
		if target.Route == "timelocked" {
			tr.SkippedReason = "timelocked Registry write is disabled here; use schedule_platform_registry_update.go"
			report.Targets = append(report.Targets, tr)
			continue
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
		tr.Updated = updatedState.NEF.Checksum == nefFile.Checksum
		if !tr.Updated {
			return fmt.Errorf("%s checksum mismatch after update: got %d, expected %d", target.Name, updatedState.NEF.Checksum, nefFile.Checksum)
		}
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
			firstNonEmpty(os.Getenv("PLATFORM_UPDATE_REPORT"), "contracts/build/testnet_platform_update_latest.json"),
			"contracts/build/testnet_anchor_deployment.json",
			nil
	case "mainnet":
		return mainnetMagic,
			firstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), "https://mainnet2.neo.coz.io:443"),
			firstNonEmpty(os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF"), os.Getenv("MINIAPP_MAINNET_DEPLOY_WIF")),
			firstNonEmpty(os.Getenv("PLATFORM_UPDATE_REPORT"), "contracts/build/mainnet_platform_update_latest.json"),
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
		PlatformGame   string `json:"platform_game"`
		PlatformSocial string `json:"platform_social"`
	}
	var deployed deployment
	if data, err := os.ReadFile(deploymentPath); err == nil {
		_ = json.Unmarshal(data, &deployed)
	}
	var gameDeployment deployment
	if data, err := os.ReadFile(fmt.Sprintf("contracts/build/%s_game_deployment.json", network)); err == nil {
		_ = json.Unmarshal(data, &gameDeployment)
	}
	type liveRow struct {
		Name string `json:"name"`
		Hash string `json:"hash"`
	}
	type liveReport struct {
		Contracts []liveRow `json:"contracts"`
	}
	liveHashes := map[string]string{}
	if network == "testnet" {
		if data, err := os.ReadFile("docs/reports/platform-contract-testnet-live-latest.json"); err == nil {
			var live liveReport
			if json.Unmarshal(data, &live) == nil {
				for _, row := range live.Contracts {
					liveHashes[row.Name] = row.Hash
				}
			}
		}
	}
	registryHash := firstNonEmpty(envByNetwork("PLATFORM_REGISTRY", network), liveHashes["PlatformRegistry"])
	factoryHash := firstNonEmpty(envByNetwork("MINIAPP_FACTORY", network), envByNetwork("CONTRACT_MINIAPP_FACTORY", network), liveHashes["MiniAppFactory"])
	deployed.PlatformAnchor = firstNonEmpty(envByNetwork("PLATFORM_ANCHOR", network), envByNetwork("CONTRACT_PLATFORM_ANCHOR", network), deployed.PlatformAnchor)
	deployed.PlatformDeFi = firstNonEmpty(envByNetwork("PLATFORM_DEFI", network), envByNetwork("CONTRACT_PLATFORM_DEFI", network), deployed.PlatformDeFi)
	deployed.PlatformGame = firstNonEmpty(envByNetwork("PLATFORM_GAME", network), envByNetwork("CONTRACT_PLATFORM_GAME", network), deployed.PlatformGame, gameDeployment.PlatformGame)
	deployed.PlatformSocial = firstNonEmpty(envByNetwork("PLATFORM_SOCIAL", network), envByNetwork("CONTRACT_PLATFORM_SOCIAL", network), deployed.PlatformSocial)
	if network == "testnet" && deployed.PlatformDeFi == "" {
		deployed.PlatformDeFi = "0x39d4584ddb0731e48e611647931993ee033bf373"
	}
	if network == "testnet" && deployed.PlatformAnchor == "" {
		deployed.PlatformAnchor = "0xab079b4f9a0a2471d136392e25eb8e99898dcad0"
	}
	targets := []contractTarget{}
	if registryHash != "" {
		targets = append(targets, contractTarget{
			Name: "PlatformRegistry", ExistingHash: registryHash,
			NEFPath: "contracts/build/PlatformRegistry.nef", ManifestPath: "contracts/build/PlatformRegistry.manifest.json",
			Route: "timelocked",
		})
	}
	if factoryHash != "" {
		targets = append(targets, contractTarget{
			Name: "MiniAppFactory", ExistingHash: factoryHash,
			NEFPath: "contracts/build/MiniAppFactory.nef", ManifestPath: "contracts/build/MiniAppFactory.manifest.json",
			Route: "direct",
		})
	}
	if deployed.PlatformAnchor != "" {
		targets = append(targets, contractTarget{
			Name:         "PlatformAnchor",
			ExistingHash: deployed.PlatformAnchor,
			NEFPath:      "contracts/build/PlatformAnchor.nef",
			ManifestPath: "contracts/build/PlatformAnchor.manifest.json",
			Route:        "direct",
		})
	}
	if deployed.PlatformDeFi != "" {
		targets = append(targets, contractTarget{
			Name:         "PlatformDeFi",
			ExistingHash: deployed.PlatformDeFi,
			NEFPath:      "contracts/build/PlatformDeFi.nef",
			ManifestPath: "contracts/build/PlatformDeFi.manifest.json",
			Route:        "direct",
		})
	}
	if deployed.PlatformGame != "" {
		targets = append(targets, contractTarget{
			Name:         "PlatformGame",
			ExistingHash: deployed.PlatformGame,
			NEFPath:      "contracts/build/PlatformGame.nef",
			ManifestPath: "contracts/build/PlatformGame.manifest.json",
			Route:        "direct",
		})
	}
	if deployed.PlatformSocial != "" {
		targets = append(targets, contractTarget{
			Name:         "PlatformSocial",
			ExistingHash: deployed.PlatformSocial,
			NEFPath:      "contracts/build/PlatformSocial.nef",
			ManifestPath: "contracts/build/PlatformSocial.manifest.json",
			Route:        "direct",
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

func parseSignerIdentity(raw string) (util.Uint160, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return util.Uint160{}, fmt.Errorf("public signer identity is required as a Neo address or script hash (set PLATFORM_UPDATE_DRY_RUN_SIGNER)")
	}
	if strings.HasPrefix(trimmed, "0x") || len(trimmed) == 40 {
		hash, err := parseHash(trimmed)
		if err != nil {
			return util.Uint160{}, fmt.Errorf("invalid PLATFORM_UPDATE_DRY_RUN_SIGNER script hash")
		}
		return hash, nil
	}
	hash, err := address.StringToUint160(trimmed)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("invalid PLATFORM_UPDATE_DRY_RUN_SIGNER Neo address")
	}
	return hash, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func envByNetwork(prefix string, network string) string {
	normalized := strings.ToUpper(strings.ReplaceAll(prefix, "-", "_"))
	networkName := strings.ToUpper(strings.ReplaceAll(network, "-", "_"))
	return firstNonEmpty(
		os.Getenv(normalized+"_"+networkName+"_HASH"),
		os.Getenv(normalized+"_HASH_"+networkName),
		os.Getenv(normalized+"_HASH"),
	)
}

func truthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
