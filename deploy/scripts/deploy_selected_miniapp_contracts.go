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

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/management"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

type deployTarget struct {
	Name        string
	BuildNEF    string
	BuildMan    string
	AppManifest string
}

type deployRecord struct {
	Name         string `json:"name"`
	Hash         string `json:"hash"`
	AppManifest  string `json:"app_manifest,omitempty"`
	OracleSet    bool   `json:"oracle_set,omitempty"`
	AASet        bool   `json:"aa_set,omitempty"`
	AnchorSet    bool   `json:"anchor_set,omitempty"`
}

type appManifest struct {
	ID        string            `json:"id"`
	Contracts map[string]string `json:"contracts"`
}

var deployTargets = []deployTarget{
	{"MiniAppDiceGame", "contracts/build/MiniAppDiceGame.nef", "contracts/build/MiniAppDiceGame.manifest.json", ""},
	{"MiniAppDevTipping", "contracts/build/MiniAppDevTipping.nef", "contracts/build/MiniAppDevTipping.manifest.json", "apps/dev-tipping/neo-manifest.json"},
	{"MiniAppGasCircle", "contracts/build/MiniAppGasCircle.nef", "contracts/build/MiniAppGasCircle.manifest.json", ""},
	{"MiniAppExFiles", "contracts/build/MiniAppExFiles.nef", "contracts/build/MiniAppExFiles.manifest.json", ""},
	{"MiniAppGovMerc", "contracts/build/MiniAppGovMerc.nef", "contracts/build/MiniAppGovMerc.manifest.json", "apps/gov-merc/neo-manifest.json"},
	{"MiniAppMasqueradeDAO", "contracts/build/MiniAppMasqueradeDAO.nef", "contracts/build/MiniAppMasqueradeDAO.manifest.json", ""},
	{"MiniAppMillionPieceMap", "contracts/build/MiniAppMillionPieceMap.nef", "contracts/build/MiniAppMillionPieceMap.manifest.json", ""},
	{"MiniAppGraveyard", "contracts/build/MiniAppGraveyard.nef", "contracts/build/MiniAppGraveyard.manifest.json", "apps/graveyard/neo-manifest.json"},
	{"MiniAppHeritageTrust", "contracts/build/MiniAppHeritageTrust.nef", "contracts/build/MiniAppHeritageTrust.manifest.json", ""},
	{"MiniAppHallOfFame", "contracts/build/MiniAppHallOfFame.nef", "contracts/build/MiniAppHallOfFame.manifest.json", ""},
	{"MiniAppTimeCapsule", "contracts/build/MiniAppTimeCapsule.nef", "contracts/build/MiniAppTimeCapsule.manifest.json", "apps/time-capsule/neo-manifest.json"},
	{"MiniAppTurtleMatch", "contracts/build/MiniAppTurtleMatch.nef", "contracts/build/MiniAppTurtleMatch.manifest.json", ""},
}

func main() {
	ctx := context.Background()
	rpcURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	wif := strings.TrimSpace(os.Getenv("MINIAPP_DEPLOY_WIF"))
	if wif == "" {
		wif = strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	}
	if wif == "" {
		fmt.Println("MINIAPP_DEPLOY_WIF or NEO_TESTNET_WIF is required")
		os.Exit(1)
	}

	apply := strings.EqualFold(strings.TrimSpace(os.Getenv("APPLY_DEPLOYMENTS")), "true")
	filter := parseFilter(strings.TrimSpace(os.Getenv("MINIAPP_DEPLOY_TARGETS")))

	oracleHash, _ := parseOptionalHash(firstNonEmpty(
		os.Getenv("CONTRACT_MORPHEUS_ORACLE_HASH"),
		os.Getenv("MORPHEUS_ORACLE_HASH"),
	))
	aaHash, _ := parseOptionalHash(firstNonEmpty(
		os.Getenv("AA_CORE_TESTNET_HASH"),
		os.Getenv("CONTRACT_AA_CORE_HASH"),
	))
	anchorHash, _ := parseOptionalHash(firstNonEmpty(
		os.Getenv("CONTRACT_AUTOMATIONANCHOR_HASH"),
		os.Getenv("AUTOMATION_ANCHOR_HASH"),
	))

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("invalid WIF: %v\n", err)
		os.Exit(1)
	}

	acc := wallet.NewAccountFromPrivateKey(priv)
	deployerHash := priv.GetScriptHash()
	deployerAddress := acc.Address

	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{
		DialTimeout:    20 * time.Second,
		RequestTimeout: 20 * time.Second,
	})
	if err != nil {
		fmt.Printf("RPC connect failed: %v\n", err)
		os.Exit(1)
	}

	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("actor creation failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Signer: %s\n", deployerAddress)
	fmt.Printf("Mode: %s\n\n", map[bool]string{true: "apply", false: "dry-run"}[apply])

	results := make([]deployRecord, 0, len(deployTargets))
	var failed bool

	for _, target := range deployTargets {
		if !matchesFilter(target.Name, filter) {
			continue
		}

		nefFile, nefBytes, err := loadNEF(target.BuildNEF)
		if err != nil {
			fmt.Printf("%s: %v\n", target.Name, err)
			failed = true
			continue
		}
		mani, maniBytes, err := loadManifest(target.BuildMan)
		if err != nil {
			fmt.Printf("%s: %v\n", target.Name, err)
			failed = true
			continue
		}

		expectedHash := state.CreateContractHash(deployerHash, nefFile.Checksum, mani.Name)
		expectedHashLE := "0x" + expectedHash.StringLE()
		record := deployRecord{
			Name:        target.Name,
			Hash:        expectedHashLE,
			AppManifest: target.AppManifest,
		}

		fmt.Printf("=== %s ===\n", target.Name)
		fmt.Printf("expected hash: %s\n", expectedHashLE)

		if !apply {
			results = append(results, record)
			continue
		}

		if _, err := client.GetContractStateByHash(expectedHash); err == nil {
			fmt.Printf("already deployed at %s\n", expectedHashLE)
		} else {
			mgmt := management.New(act)
			txHash, vub, err := mgmt.Deploy(nefFile, mani, nil)
			if err != nil {
				fmt.Printf("deploy failed: %v\n", err)
				failed = true
				continue
			}
			fmt.Printf("deploy tx: %s (vub: %d)\n", txHash.StringLE(), vub)
			if err := waitForDeployment(ctx, client, txHash, expectedHash); err != nil {
				fmt.Printf("confirmation failed: %v\n", err)
				failed = true
				continue
			}
		}

		if oracleHash != (util.Uint160{}) {
			if ok, err := maybeConfigureHash(ctx, client, act, expectedHash, "setOracle", oracleHash); err != nil {
				fmt.Printf("setOracle failed: %v\n", err)
				failed = true
				continue
			} else {
				record.OracleSet = ok
			}
		}
		if aaHash != (util.Uint160{}) {
			if ok, err := maybeConfigureHash(ctx, client, act, expectedHash, "setAbstractAccount", aaHash); err != nil {
				fmt.Printf("setAbstractAccount failed: %v\n", err)
				failed = true
				continue
			} else {
				record.AASet = ok
			}
		}
		if anchorHash != (util.Uint160{}) {
			if ok, err := maybeConfigureHash(ctx, client, act, expectedHash, "setAutomationAnchor", anchorHash); err != nil {
				fmt.Printf("setAutomationAnchor failed: %v\n", err)
				failed = true
				continue
			} else {
				record.AnchorSet = ok
			}
		}

		if target.AppManifest != "" {
			if err := updateAppManifest(target.AppManifest, expectedHashLE); err != nil {
				fmt.Printf("manifest update failed: %v\n", err)
				failed = true
				continue
			}
		}

		results = append(results, record)
		fmt.Println()
		_ = nefBytes
		_ = maniBytes
	}

	out, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "warning: json.MarshalIndent failed: %v\n", err)
	} else {
		fmt.Println(string(out))
	}
	if apply && len(results) > 0 {
		outputPath := filepath.Join("contracts", "build", "selected_miniapps_redeployed.json")
		if err := os.WriteFile(outputPath, out, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "warning: failed to write output file: %v\n", err)
		} else {
			fmt.Printf("\nSaved: %s\n", outputPath)
		}
	}

	if failed {
		os.Exit(1)
	}
}

func parseFilter(raw string) map[string]struct{} {
	result := map[string]struct{}{}
	if raw == "" {
		return result
	}
	for _, part := range strings.Split(raw, ",") {
		token := strings.ToLower(strings.TrimSpace(part))
		if token != "" {
			result[token] = struct{}{}
		}
	}
	return result
}

func matchesFilter(name string, filter map[string]struct{}) bool {
	if len(filter) == 0 {
		return true
	}
	candidates := []string{
		strings.ToLower(name),
		strings.ToLower(strings.TrimPrefix(name, "MiniApp")),
	}
	for _, candidate := range candidates {
		if _, ok := filter[candidate]; ok {
			return true
		}
	}
	return false
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func parseOptionalHash(raw string) (util.Uint160, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return util.Uint160{}, nil
	}
	raw = strings.TrimPrefix(raw, "0x")
	return util.Uint160DecodeStringLE(raw)
}

func loadNEF(path string) (*nef.File, []byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, fmt.Errorf("read nef %s: %w", path, err)
	}
	file, err := nef.FileFromBytes(data)
	if err != nil {
		return nil, nil, fmt.Errorf("decode nef %s: %w", path, err)
	}
	return &file, data, nil
}

func loadManifest(path string) (*manifest.Manifest, []byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, fmt.Errorf("read manifest %s: %w", path, err)
	}
	var m manifest.Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, nil, fmt.Errorf("decode manifest %s: %w", path, err)
	}
	return &m, data, nil
}

func maybeConfigureHash(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contractHash util.Uint160, method string, value util.Uint160) (bool, error) {
	state, err := client.GetContractStateByHash(contractHash)
	if err != nil {
		return false, err
	}

	found := false
	for _, candidate := range state.Manifest.ABI.Methods {
		if strings.EqualFold(candidate.Name, method) && len(candidate.Parameters) == 1 {
			found = true
			break
		}
	}
	if !found {
		return false, nil
	}

	testResult, err := act.Call(contractHash, method, value)
	if err != nil {
		return false, fmt.Errorf("test invoke: %w", err)
	}
	if testResult.State != "HALT" {
		return false, fmt.Errorf("test invoke fault: %s", testResult.FaultException)
	}

	txHash, vub, err := act.SendCall(contractHash, method, value)
	if err != nil {
		return false, fmt.Errorf("send call: %w", err)
	}
	fmt.Printf("%s tx: %s (vub: %d)\n", method, txHash.StringLE(), vub)
	return true, waitForTx(ctx, client, txHash)
}

func waitForDeployment(ctx context.Context, client *rpcclient.Client, txHash util.Uint256, expectedHash util.Uint160) error {
	if err := waitForTx(ctx, client, txHash); err != nil {
		return err
	}
	_, err := client.GetContractStateByHash(expectedHash)
	return err
}

func waitForTx(ctx context.Context, client *rpcclient.Client, txHash util.Uint256) error {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(2 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for transaction")
		case <-ticker.C:
			appLog, err := client.GetApplicationLog(txHash, nil)
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
			return fmt.Errorf("transaction failed: %s", exec.FaultException)
		}
	}
}

func updateAppManifest(path string, contractHash string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	contractsRaw, ok := raw["contracts"]
	if !ok || contractsRaw == nil {
		contractsRaw = map[string]any{}
		raw["contracts"] = contractsRaw
	}

	contracts, ok := contractsRaw.(map[string]any)
	if !ok {
		return fmt.Errorf("contracts field has unexpected shape")
	}
	contracts["neo-n3-testnet"] = contractHash

	next, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return err
	}
	next = append(next, '\n')
	return os.WriteFile(path, next, 0644)
}
