//go:build ignore

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
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/management"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	defaultRPC      = "https://testnet1.neo.coz.io:443"
	defaultBuildDir = "contracts/build"
)

// MiniApp contracts to deploy
var miniAppContracts = []string{
	// Phase 1 - Gaming
	"MiniAppLottery",
	"MiniAppCoinFlip",
	"MiniAppDiceGame",
	"MiniAppScratchCard",
	// Phase 2 - DeFi/Social
	"MiniAppPredictionMarket",
	"MiniAppFlashLoan",
	"MiniAppPriceTicker",
	"MiniAppGasSpin",
	"MiniAppPricePredict",
	"MiniAppSecretVote",
	"MiniAppSecretPoker",
	"MiniAppMicroPredict",
	"MiniAppRedEnvelope",
	"MiniAppGasCircle",
	// Phase 3 - Advanced
	"MiniAppFogChess",
	"MiniAppGovBooster",
	"MiniAppTurboOptions",
	"MiniAppILGuard",
	"MiniAppGuardianPolicy",
	// Phase 4 - Long-Running
	"MiniAppAITrader",
	"MiniAppGridBot",
	"MiniAppNFTEvolve",
	"MiniAppBridgeGuardian",
}

type DeployResult struct {
	Name string `json:"name"`
	Hash string `json:"hash"`
}

func main() {
	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fmt.Println("NEO_TESTNET_WIF environment variable not set")
		os.Exit(1)
	}

	rpcURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcURL == "" {
		rpcURL = defaultRPC
	}

	buildDir := strings.TrimSpace(os.Getenv("CONTRACT_BUILD_DIR"))
	if buildDir == "" {
		buildDir = defaultBuildDir
	}

	privateKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("Invalid WIF: %v\n", err)
		os.Exit(1)
	}

	deployerHash := privateKey.GetScriptHash()
	deployerAddr := address.Uint160ToString(deployerHash)

	fmt.Println("=== MiniApp Contracts Batch Deployment ===")
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Deployer: %s\n", deployerAddr)

	availableContracts := make([]string, 0, len(miniAppContracts))
	skippedMissing := make([]string, 0)
	for _, name := range miniAppContracts {
		if _, _, ok := resolveContractArtifactPaths(buildDir, name); ok {
			availableContracts = append(availableContracts, name)
			continue
		}
		skippedMissing = append(skippedMissing, name)
	}

	fmt.Printf("Contracts to deploy: %d\n", len(availableContracts))
	if len(skippedMissing) > 0 {
		fmt.Printf("Skipped (missing artifacts): %d\n", len(skippedMissing))
	}
	fmt.Println()

	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		fmt.Printf("Failed to create RPC client: %v\n", err)
		os.Exit(1)
	}

	acc := wallet.NewAccountFromPrivateKey(privateKey)
	acc.Label = "deployer"
	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("Failed to create actor: %v\n", err)
		os.Exit(1)
	}

	oracleHash, _ := resolveOracleHash()

	var results []DeployResult
	var failures []string

	for i, contractName := range availableContracts {
		fmt.Printf("\n[%d/%d] Deploying %s...\n", i+1, len(availableContracts), contractName)

		hash, err := deployContract(ctx, client, act, buildDir, contractName, deployerHash, oracleHash)
		if err != nil {
			fmt.Printf("  ❌ Failed: %v\n", err)
			failures = append(failures, contractName)
			continue
		}

		fmt.Printf("  ✅ Deployed at: %s\n", hash)
		results = append(results, DeployResult{Name: contractName, Hash: hash})

		// Small delay between deployments
		time.Sleep(2 * time.Second)
	}

	fmt.Println("\n=== Deployment Summary ===")
	fmt.Printf("Successful: %d\n", len(results))
	fmt.Printf("Failed: %d\n", len(failures))
	fmt.Printf("Skipped (missing artifacts): %d\n", len(skippedMissing))

	if len(failures) > 0 {
		fmt.Println("\nFailed contracts:")
		for _, name := range failures {
			fmt.Printf("  - %s\n", name)
		}
	}
	if len(skippedMissing) > 0 {
		fmt.Println("\nSkipped contracts (missing artifacts in contracts/build):")
		for _, name := range skippedMissing {
			fmt.Printf("  - %s\n", name)
		}
	}

	// Output results as JSON
	if len(results) > 0 {
		fmt.Println("\n=== Contract Addresses ===")
		for _, r := range results {
			fmt.Printf("%s: %s\n", r.Name, r.Hash)
		}

		// Save to file
		outputPath := filepath.Join(buildDir, "miniapp_contracts.json")
		data, _ := json.MarshalIndent(results, "", "  ")
		if err := os.WriteFile(outputPath, data, 0644); err == nil {
			fmt.Printf("\nResults saved to: %s\n", outputPath)
		}
	}

	if len(failures) > 0 {
		os.Exit(1)
	}
}

func deployContract(ctx context.Context, client *rpcclient.Client, act *actor.Actor, buildDir, contractName string, deployerHash, oracleHash util.Uint160) (string, error) {
	nefPath, manifestPath, ok := resolveContractArtifactPaths(buildDir, contractName)
	if !ok {
		return "", fmt.Errorf("artifacts not found for %s", contractName)
	}

	nefFile, err := loadNEF(nefPath)
	if err != nil {
		return "", fmt.Errorf("load NEF: %w", err)
	}

	mani, err := loadManifest(manifestPath)
	if err != nil {
		return "", fmt.Errorf("load manifest: %w", err)
	}

	expectedHash := state.CreateContractHash(deployerHash, nefFile.Checksum, mani.Name)
	expectedHex := "0x" + expectedHash.StringLE()

	// Check if already deployed
	if _, err := client.GetContractStateByHash(expectedHash); err == nil {
		fmt.Printf("  Already deployed at: %s\n", expectedHex)
		return expectedHex, nil
	}

	// Deploy
	mgmt := management.New(act)
	txHash, vub, err := mgmt.Deploy(nefFile, mani, nil)
	if err != nil {
		return "", fmt.Errorf("deploy: %w", err)
	}

	fmt.Printf("  Transaction: %s (vub: %d)\n", txHash.StringLE(), vub)

	contractHash, err := waitForDeployment(ctx, client, txHash, expectedHash)
	if err != nil {
		return "", fmt.Errorf("wait: %w", err)
	}

	// Configure oracle if available
	if oracleHash != (util.Uint160{}) {
		if err := setOracle(ctx, client, act, expectedHash, oracleHash); err != nil {
			fmt.Printf("  ⚠ Oracle config failed: %v\n", err)
		} else {
			fmt.Printf("  Oracle configured\n")
		}
	}

	return contractHash, nil
}

func resolveContractArtifactPaths(buildDir, contractName string) (nefPath, manifestPath string, ok bool) {
	nefPath = filepath.Join(buildDir, contractName+".nef")
	if _, err := os.Stat(nefPath); err != nil {
		return "", "", false
	}

	candidates := []string{
		filepath.Join(buildDir, contractName+".manifest.json"),
		filepath.Join(buildDir, contractName, contractName+".manifest.json"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return nefPath, p, true
		}
	}

	return "", "", false
}

func loadNEF(path string) (*nef.File, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	f, err := nef.FileFromBytes(data)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func loadManifest(path string) (*manifest.Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m manifest.Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

func resolveOracleHash() (util.Uint160, error) {
	raw := strings.TrimSpace(os.Getenv("CONTRACT_MORPHEUS_ORACLE_HASH"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("CONTRACT_ORACLE_HASH"))
	}
	if raw == "" {
		return util.Uint160{}, nil
	}
	return parseHash160(raw)
}

func parseHash160(raw string) (util.Uint160, error) {
	raw = strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(raw)
}

func setOracle(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contract, oracle util.Uint160) error {
	testResult, err := act.Call(contract, "setOracle", oracle)
	if err != nil {
		return fmt.Errorf("test invoke: %w", err)
	}
	if testResult.State != "HALT" {
		return fmt.Errorf("test failed: %s", testResult.FaultException)
	}

	txHash, vub, err := act.SendCall(contract, "setOracle", oracle)
	if err != nil {
		return fmt.Errorf("send: %w", err)
	}
	fmt.Printf("  Oracle tx: %s (vub: %d)\n", txHash.StringLE(), vub)
	return waitForTx(ctx, client, txHash)
}

func waitForTx(ctx context.Context, client *rpcclient.Client, txHash util.Uint256) error {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(2 * time.Minute)

	for {
		select {
		case <-timeout:
			return fmt.Errorf("timeout")
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
			return fmt.Errorf("failed: %s", exec.FaultException)
		}
	}
}

func waitForDeployment(ctx context.Context, client *rpcclient.Client, txHash util.Uint256, expected util.Uint160) (string, error) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(5 * time.Minute)

	for {
		select {
		case <-timeout:
			return "", fmt.Errorf("timeout")
		case <-ticker.C:
			appLog, err := client.GetApplicationLog(txHash, nil)
			if err != nil {
				continue
			}
			if len(appLog.Executions) == 0 {
				continue
			}
			exec := appLog.Executions[0]
			if !exec.VMState.HasFlag(1) {
				return "", fmt.Errorf("failed: %s", exec.FaultException)
			}
			if _, err := client.GetContractStateByHash(expected); err == nil {
				return "0x" + expected.StringLE(), nil
			}
		}
	}
}
