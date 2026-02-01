//go:build scripts

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

var contracts = []struct {
	Name     string
	EnvVar   string
	NEF      string
	Manifest string
}{
	{"ServiceLayerGateway", "CONTRACT_SERVICE_GATEWAY_ADDRESS", "ServiceLayerGateway.nef", "ServiceLayerGateway.manifest.json"},
	{"PaymentHub", "CONTRACT_PAYMENT_HUB_ADDRESS", "PaymentHubV2.nef", "PaymentHubV2.manifest.json"},
	{"PriceFeed", "CONTRACT_PRICE_FEED_ADDRESS", "PriceFeed.nef", "PriceFeed.manifest.json"},
	{"RandomnessLog", "CONTRACT_RANDOMNESS_LOG_ADDRESS", "RandomnessLog.nef", "RandomnessLog.manifest.json"},
	{"Governance", "CONTRACT_GOVERNANCE_ADDRESS", "Governance.nef", "Governance.manifest.json"},
	{"AppRegistry", "CONTRACT_APP_REGISTRY_ADDRESS", "AppRegistry.nef", "AppRegistry.manifest.json"},
	{"AutomationAnchor", "CONTRACT_AUTOMATION_ANCHOR_ADDRESS", "AutomationAnchor.nef", "AutomationAnchor.manifest.json"},
}

func main() {
	ctx := context.Background()
	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fmt.Println("❌ NEO_TESTNET_WIF required")
		os.Exit(1)
	}

	rpcURL := os.Getenv("NEO_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		fmt.Printf("❌ RPC connect failed: %v\n", err)
		os.Exit(1)
	}

	privKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("❌ Invalid WIF: %v\n", err)
		os.Exit(1)
	}

	acc := wallet.NewAccountFromPrivateKey(privKey)
	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("❌ Actor creation failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║   Updating Contracts with Latest Logic                         ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Printf("Deployer: %s\n\n", acc.Address)

	buildDir := "contracts/build/"
	successCount := 0
	failCount := 0

	for _, c := range contracts {
		addressStr := strings.TrimSpace(os.Getenv(c.EnvVar))
		if addressStr == "" {
			fmt.Printf("⏭️  %s: %s not set, skipping\n", c.Name, c.EnvVar)
			continue
		}

		address, err := util.Uint160DecodeStringLE(strings.TrimPrefix(addressStr, "0x"))
		if err != nil {
			fmt.Printf("❌ %s: invalid address: %v\n", c.Name, err)
			failCount++
			continue
		}

		nefBytes, err := os.ReadFile(buildDir + c.NEF)
		if err != nil {
			fmt.Printf("❌ %s: read NEF: %v\n", c.Name, err)
			failCount++
			continue
		}

		manifestBytes, err := os.ReadFile(buildDir + c.Manifest)
		if err != nil {
			fmt.Printf("❌ %s: read manifest: %v\n", c.Name, err)
			failCount++
			continue
		}

		// Validate NEF
		_, err = nef.FileFromBytes(nefBytes)
		if err != nil {
			fmt.Printf("❌ %s: invalid NEF: %v\n", c.Name, err)
			failCount++
			continue
		}

		// Validate manifest
		m := new(manifest.Manifest)
		if err := json.Unmarshal(manifestBytes, m); err != nil {
			fmt.Printf("❌ %s: invalid manifest: %v\n", c.Name, err)
			failCount++
			continue
		}

		fmt.Printf("📦 %s: updating at %s...\n", c.Name, addressStr)

		txHash, vub, err := act.SendCall(address, "update", nefBytes, string(manifestBytes))
		if err != nil {
			fmt.Printf("   ❌ update failed: %v\n", err)
			failCount++
			continue
		}

		fmt.Printf("   TX: %s (vub: %d)\n", txHash.StringLE(), vub)
		time.Sleep(3 * time.Second)

		// Wait for confirmation
		confirmed := false
		for i := 0; i < 10; i++ {
			appLog, err := client.GetApplicationLog(txHash, nil)
			if err != nil {
				time.Sleep(3 * time.Second)
				continue
			}
			if len(appLog.Executions) > 0 {
				exec := appLog.Executions[0]
				if exec.VMState.HasFlag(1) {
					fmt.Printf("   ✅ %s updated successfully\n", c.Name)
					successCount++
					confirmed = true
				} else {
					fmt.Printf("   ❌ %s update failed: %s\n", c.Name, exec.FaultException)
					failCount++
					confirmed = true
				}
				break
			}
			time.Sleep(3 * time.Second)
		}

		if !confirmed {
			fmt.Printf("   ⏳ %s: confirmation timeout, check manually\n", c.Name)
		}
	}

	fmt.Printf("\n✅ Contract updates complete! Success: %d, Failed: %d\n", successCount, failCount)
}
