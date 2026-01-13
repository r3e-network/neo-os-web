// Command configure-miniapps configures all MiniApps in the PaymentHubV2 contract.
package main

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"os"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

var miniApps = []string{
	"miniapp-lottery",
	"miniapp-coin-flip",
	"miniapp-dice-game",
	"miniapp-scratch-card",
	"miniapp-flashloan",
	"miniapp-red-envelope",
	"miniapp-gas-circle",
	"miniapp-gov-booster",
	"miniapp-secret-poker",
	"builtin-canvas",
}

func main() {
	ctx := context.Background()

	rpcURL := os.Getenv("NEO_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	wif := os.Getenv("NEO_TESTNET_WIF")
	if wif == "" {
		log.Fatal("NEO_TESTNET_WIF environment variable not set")
	}

	contractAddress := os.Getenv("CONTRACT_PAYMENT_HUB_ADDRESS")
	if contractAddress == "" {
		contractAddress = "0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193"
	}

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: 894710606,
	})
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	signer, err := chain.AccountFromWIF(wif)
	if err != nil {
		log.Fatalf("Failed to create signer: %v", err)
	}

	ownerAddress := signer.Address
	ownerHash, err := address.StringToUint160(ownerAddress)
	if err != nil {
		log.Fatalf("Failed to parse owner address: %v", err)
	}

	log.Printf("Configuring MiniApps in contract: %s", contractAddress)
	log.Printf("Owner address: %s", ownerAddress)

	for _, appID := range miniApps {
		log.Printf("Configuring %s...", appID)

		// Build parameters for configureApp
		// configureApp(appId, owner, recipients[], sharesBps[], enabled)
		params := []chain.ContractParam{
			chain.NewStringParam(appID),
			chain.NewHash160Param("0x" + ownerHash.StringLE()),
			// Recipients array - just the owner
			{
				Type: "Array",
				Value: []chain.ContractParam{
					chain.NewHash160Param("0x" + ownerHash.StringLE()),
				},
			},
			// SharesBps array - 100% to owner (10000 bps)
			{
				Type: "Array",
				Value: []chain.ContractParam{
					chain.NewIntegerParam(big.NewInt(10000)),
				},
			},
			chain.NewBoolParam(true),
		}

		result, err := client.InvokeFunctionWithSigners(ctx, contractAddress, "configureApp", params, signer.ScriptHash())
		if err != nil {
			log.Printf("  Failed to simulate %s: %v", appID, err)
			continue
		}

		if result.State != "HALT" {
			log.Printf("  Simulation failed for %s: %s", appID, result.Exception)
			continue
		}

		txBuilder := chain.NewTxBuilder(client, client.NetworkID())
		tx, err := txBuilder.BuildAndSignTx(ctx, result, signer, transaction.CalledByEntry)
		if err != nil {
			log.Printf("  Failed to build tx for %s: %v", appID, err)
			continue
		}

		txHash, err := txBuilder.BroadcastTx(ctx, tx)
		if err != nil {
			log.Printf("  Failed to broadcast %s: %v", appID, err)
			continue
		}

		txHashStr := "0x" + txHash.StringLE()

		// Wait for confirmation
		waitCtx, cancel := context.WithTimeout(ctx, time.Minute)
		_, err = client.WaitForApplicationLog(waitCtx, txHashStr, 2*time.Second)
		cancel()

		if err != nil {
			log.Printf("  Warning: %s tx %s - wait failed: %v", appID, txHashStr, err)
		} else {
			log.Printf("  ✓ %s configured: %s", appID, txHashStr)
		}

		// Small delay between transactions
		time.Sleep(time.Second)
	}

	fmt.Println("\n=== MiniApp Configuration Complete ===")
}
