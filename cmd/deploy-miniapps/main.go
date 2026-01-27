// Command deploy-miniapps deploys new MiniApp contracts to Neo N3 testnet.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/R3E-Network/service_layer/deploy/testnet"
)

var newMiniApps = []string{
	// Missing MiniApps to deploy
	"MiniAppAITrader",
	"MiniAppBridgeGuardian",
	"MiniAppCoinFlip",
	"MiniAppDiceGame",
	"MiniAppFlashLoan",
	"MiniAppFogChess",
	"MiniAppGasCircle",
	"MiniAppGasSpin",
	"MiniAppGovBooster",
	"MiniAppGridBot",
	"MiniAppGuardianPolicy",
	"MiniAppILGuard",
	"MiniAppLottery",
	"MiniAppMegaMillions",
	"MiniAppMicroPredict",
	"MiniAppNFTEvolve",
	"MiniAppPredictionMarket",
	"MiniAppPricePredict",
	"MiniAppPriceTicker",
	"MiniAppRedEnvelope",
	"MiniAppScratchCard",
	"MiniAppSecretPoker",
	"MiniAppSecretVote",
	"MiniAppTurboOptions",
}

type DeployResult struct {
	Name        string `json:"name"`
	Address     string `json:"address"`
	GasConsumed string `json:"gas_consumed"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
}

func main() {
	buildDir := "contracts/build"

	deployer, err := testnet.NewDeployer("")
	if err != nil {
		log.Fatalf("Failed to create deployer: %v", err)
	}

	balance, err := deployer.GetGASBalanceFloat()
	if err != nil {
		log.Fatalf("Failed to get balance: %v", err)
	}

	fmt.Printf("=== MiniApp Contract Deployment ===\n")
	fmt.Printf("Deployer: %s\n", deployer.GetAddress())
	fmt.Printf("GAS Balance: %.4f\n\n", balance)

	results := make([]DeployResult, 0, len(newMiniApps))

	for _, name := range newMiniApps {
		nefPath := filepath.Join(buildDir, name+".nef")
		manifestPath := filepath.Join(buildDir, name+".manifest.json")

		fmt.Printf("--- %s ---\n", name)

		if _, statErr := os.Stat(nefPath); os.IsNotExist(statErr) {
			result := DeployResult{Name: name, Status: "skipped", Error: "NEF not found"}
			results = append(results, result)
			fmt.Printf("  ⚠️  NEF not found, skipping\n\n")
			continue
		}

		deployed, deployErr := deployer.DeployContract(nefPath, manifestPath)
		if deployErr != nil {
			result := DeployResult{Name: name, Status: "failed", Error: deployErr.Error()}
			results = append(results, result)
			fmt.Printf("  ❌ Failed: %v\n\n", deployErr)
			continue
		}

		result := DeployResult{
			Name:        name,
			Address:     deployed.Address,
			GasConsumed: deployed.GasConsumed,
			Status:      "simulated",
		}
		results = append(results, result)

		fmt.Printf("  Address: %s\n", deployed.Address)
		fmt.Printf("  GAS: %s\n", deployed.GasConsumed)
		fmt.Printf("  ✅ Simulation successful\n\n")

		time.Sleep(500 * time.Millisecond)
	}

	// Output JSON results
	fmt.Println("\n=== Deployment Results (JSON) ===")
	jsonData, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		log.Printf("Warning: Failed to marshal results: %v", err)
	} else {
		fmt.Println(string(jsonData))
	}

	// Output for config update
	fmt.Println("\n=== Contract Addresses for Config ===")
	for _, r := range results {
		if r.Status == "simulated" {
			fmt.Printf("%s: %s\n", r.Name, r.Address)
		}
	}
}
