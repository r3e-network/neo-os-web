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

// Remaining 34 MiniApp contracts to deploy (not yet deployed)
var remainingContracts = []string{
	// Gaming
	"MiniAppAlgoBattle",
	"MiniAppBountyHunter",
	"MiniAppCryptoRiddle",
	"MiniAppFogPuzzle",
	"MiniAppOnChainTarot",
	"MiniAppPuzzleMining",
	"MiniAppScreamToEarn",
	"MiniAppWorldPiano",
	// DeFi
	"MiniAppBurnLeague",
	"MiniAppCompoundCapsule",
	"MiniAppDarkPool",
	"MiniAppMeltingAsset",
	"MiniAppQuantumSwap",
	"MiniAppSelfLoan",
	// Social
	"MiniAppBreakupContract",
	"MiniAppDevTipping",
	"MiniAppExFiles",
	"MiniAppGeoSpotlight",
	"MiniAppMasqueradeDAO",
	"MiniAppMillionPieceMap",
	"MiniAppWhisperChain",
	// NFT
	"MiniAppCanvas",
	"MiniAppGardenOfNeo",
	"MiniAppGraveyard",
	"MiniAppNFTChimera",
	"MiniAppSchrodingerNFT",
	// AI
	"MiniAppAISoulmate",
	"MiniAppDarkRadio",
	// Governance
	"MiniAppGovMerc",
	// Security
	"MiniAppDeadSwitch",
	"MiniAppDoomsdayClock",
	"MiniAppHeritageTrust",
	"MiniAppTimeCapsule",
	"MiniAppUnbreakableVault",
	"MiniAppZKBadge",
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

	fmt.Println("=== Remaining MiniApp Contracts Deployment ===")
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Deployer: %s\n", deployerAddr)
	fmt.Printf("Contracts to deploy: %d\n\n", len(remainingContracts))

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

	gatewayHash, _ := resolveGatewayHash()
	var results []DeployResult
	var failures []string

	for i, contractName := range remainingContracts {
		fmt.Printf("\n[%d/%d] Deploying %s...\n", i+1, len(remainingContracts), contractName)

		hash, err := deployContract(ctx, client, act, buildDir, contractName, deployerHash, gatewayHash)
		if err != nil {
			fmt.Printf("  ❌ Failed: %v\n", err)
			failures = append(failures, contractName)
			continue
		}

		fmt.Printf("  ✅ Deployed at: %s\n", hash)
		results = append(results, DeployResult{Name: contractName, Hash: hash})
		time.Sleep(2 * time.Second)
	}

	printSummary(results, failures, buildDir)
}

func resolveGatewayHash() (util.Uint160, error) {
	hashStr := os.Getenv("CONTRACT_GATEWAY_HASH")
	if hashStr == "" {
		return util.Uint160{}, nil
	}
	return util.Uint160DecodeStringLE(strings.TrimPrefix(hashStr, "0x"))
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

func deployContract(ctx context.Context, client *rpcclient.Client, act *actor.Actor, buildDir, name string, deployer, gateway util.Uint160) (string, error) {
	nefPath := filepath.Join(buildDir, name+".nef")
	manifestPath := filepath.Join(buildDir, name+".manifest.json")

	nefFile, err := loadNEF(nefPath)
	if err != nil {
		return "", fmt.Errorf("load NEF: %w", err)
	}

	mani, err := loadManifest(manifestPath)
	if err != nil {
		return "", fmt.Errorf("load manifest: %w", err)
	}

	// Check if already deployed
	expectedHash := state.CreateContractHash(deployer, nefFile.Checksum, mani.Name)
	expectedHex := "0x" + expectedHash.StringLE()

	if _, err := client.GetContractStateByHash(expectedHash); err == nil {
		fmt.Printf("  Already deployed at: %s\n", expectedHex)
		return expectedHex, nil
	}

	// Deploy using management contract
	mgmt := management.New(act)
	txHash, vub, err := mgmt.Deploy(nefFile, mani, nil)
	if err != nil {
		return "", fmt.Errorf("deploy: %w", err)
	}

	fmt.Printf("  Transaction: %s (vub: %d)\n", txHash.StringLE(), vub)

	// Wait for deployment
	time.Sleep(20 * time.Second)
	return expectedHex, nil
}

func printSummary(results []DeployResult, failures []string, buildDir string) {
	fmt.Println("\n=== Deployment Summary ===")
	fmt.Printf("Successful: %d\n", len(results))
	fmt.Printf("Failed: %d\n", len(failures))

	if len(failures) > 0 {
		fmt.Println("\nFailed contracts:")
		for _, name := range failures {
			fmt.Printf("  - %s\n", name)
		}
	}

	if len(results) > 0 {
		fmt.Println("\n=== Contract Addresses ===")
		for _, r := range results {
			fmt.Printf("%s: %s\n", r.Name, r.Hash)
		}

		outputPath := filepath.Join(buildDir, "remaining_miniapps.json")
		data, _ := json.MarshalIndent(results, "", "  ")
		if err := os.WriteFile(outputPath, data, 0644); err == nil {
			fmt.Printf("\nResults saved to: %s\n", outputPath)
		}
	}
}
