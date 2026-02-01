// Command deploy-new-miniapps deploys new MiniApp contracts to Neo N3 testnet.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"

	"github.com/R3E-Network/neo-miniapps-platform/deploy/testnet"
)

var newMiniApps = []string{
	// Phase 8 - Creative & Social
	"MiniAppQuantumSwap",
	"MiniAppOnChainTarot",
	"MiniAppExFiles",
	"MiniAppScreamToEarn",
	"MiniAppBreakupContract",
	"MiniAppGeoSpotlight",
	"MiniAppPuzzleMining",
	"MiniAppNFTChimera",
	"MiniAppWorldPiano",
	"MiniAppBountyHunter",
	"MiniAppMasqueradeDAO",
	"MiniAppMeltingAsset",
	"MiniAppUnbreakableVault",
	"MiniAppWhisperChain",
	"MiniAppMillionPieceMap",
	"MiniAppFogPuzzle",
	"MiniAppCryptoRiddle",
}

const (
	rpcURL   = "https://testnet1.neo.coz.io:443"
	buildDir = "contracts/build"
)

func main() {
	deployer, err := testnet.NewDeployer("")
	if err != nil {
		log.Fatalf("Failed to create deployer: %v", err)
	}

	balance, err := deployer.GetGASBalanceFloat()
	if err != nil {
		log.Fatalf("Failed to get balance: %v", err)
	}

	fmt.Println("=== MiniApp Contract Deployment ===")
	fmt.Printf("Deployer: %s\n", deployer.GetAddress())
	fmt.Printf("GAS Balance: %.4f\n\n", balance)

	results := make(map[string]string)

	for _, name := range newMiniApps {
		fmt.Printf("--- %s ---\n", name)

		nefPath := filepath.Join(buildDir, name+".nef")
		manifestPath := filepath.Join(buildDir, name+".manifest.json")

		// Read files
		nefData, err := os.ReadFile(nefPath)
		if err != nil {
			fmt.Printf("  ❌ NEF not found\n\n")
			continue
		}

		manifestData, err := os.ReadFile(manifestPath)
		if err != nil {
			fmt.Printf("  ❌ Manifest not found\n\n")
			continue
		}

		// Calculate expected contract address
		nefFile, err := nef.FileFromBytes(nefData)
		if err != nil {
			fmt.Printf("  ❌ Parse NEF: %v\n\n", err)
			continue
		}

		var m manifest.Manifest
		err = json.Unmarshal(manifestData, &m)
		if err != nil {
			fmt.Printf("  ❌ Parse manifest: %v\n\n", err)
			continue
		}

		expectedAddress := state.CreateContractHash(
			deployer.GetAccountHash(),
			nefFile.Checksum,
			m.Name,
		)
		fmt.Printf("  Expected: 0x%s\n", expectedAddress.StringLE())

		// Check if deployed
		_, err = deployer.GetContractState("0x" + expectedAddress.StringLE())
		if err == nil {
			fmt.Printf("  ✅ Already deployed\n\n")
			results[name] = "0x" + expectedAddress.StringLE()
			continue
		}

		// Deploy via simulation
		deployed, err := deployer.DeployContract(nefPath, manifestPath)
		if err != nil {
			fmt.Printf("  ❌ Deploy: %v\n\n", err)
			continue
		}

		fmt.Printf("  Address: %s\n", deployed.Address)
		fmt.Printf("  GAS: %s\n", deployed.GasConsumed)
		fmt.Printf("  ✅ Ready to deploy\n\n")
		results[name] = deployed.Address

		time.Sleep(500 * time.Millisecond)
	}

	fmt.Println("\n=== Summary ===")
	for name, hash := range results {
		fmt.Printf("%s: %s\n", name, hash)
	}
}
