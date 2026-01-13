//go:build scripts

// Update oracle contracts (PriceFeed + RandomnessLog) on Neo N3 testnet.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

const defaultRPC = "https://testnet1.neo.coz.io:443"

type updateTarget struct {
	Name       string
	EnvAddressKey string
	Method     string
}

func main() {
	ctx := context.Background()

	rpcURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcURL == "" {
		rpcURL = defaultRPC
	}

	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fmt.Println("NEO_TESTNET_WIF environment variable not set")
		os.Exit(1)
	}

	buildDir := strings.TrimSpace(os.Getenv("CONTRACT_BUILD_DIR"))
	if buildDir == "" {
		buildDir = "contracts/build"
	}

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: 894710606,
	})
	if err != nil {
		fmt.Printf("Failed to create chain client: %v\n", err)
		os.Exit(1)
	}

	signer, err := chain.AccountFromWIF(wif)
	if err != nil {
		fmt.Printf("Failed to create signer: %v\n", err)
		os.Exit(1)
	}

	targets := []updateTarget{
		{
			Name:       "PriceFeed",
			EnvAddressKey: "CONTRACT_PRICE_FEED_ADDRESS",
			Method:     "updateContract",
		},
		{
			Name:       "RandomnessLog",
			EnvAddressKey: "CONTRACT_RANDOMNESS_LOG_ADDRESS",
			Method:     "update",
		},
	}

	fmt.Printf("Updater address: %s\n", signer.Address)
	fmt.Printf("RPC: %s\n", rpcURL)

	for _, target := range targets {
		contractAddress := strings.TrimSpace(os.Getenv(target.EnvAddressKey))
		if contractAddress == "" {
			fmt.Printf("\n%s: %s not set, skipping\n", target.Name, target.EnvAddressKey)
			continue
		}

		nefPath := filepath.Join(buildDir, target.Name+".nef")
		manifestPath := filepath.Join(buildDir, target.Name+".manifest.json")

		nefData, err := os.ReadFile(nefPath)
		if err != nil {
			fmt.Printf("\n%s: failed to read NEF: %v\n", target.Name, err)
			continue
		}

		manifestData, err := os.ReadFile(manifestPath)
		if err != nil {
			fmt.Printf("\n%s: failed to read manifest: %v\n", target.Name, err)
			continue
		}

		params := []chain.ContractParam{
			chain.NewByteArrayParam(nefData),
			chain.NewStringParam(string(manifestData)),
		}

		fmt.Printf("\n=== Updating %s ===\n", target.Name)
		fmt.Printf("Contract: %s\n", contractAddress)

		invokeResult, err := client.InvokeFunctionWithSigners(ctx, contractAddress, target.Method, params, signer.ScriptHash())
		if err != nil {
			fmt.Printf("Simulation failed: %v\n", err)
			continue
		}
		if invokeResult.State != "HALT" {
			fmt.Printf("Simulation faulted: %s\n", invokeResult.Exception)
			continue
		}

		txBuilder := chain.NewTxBuilder(client, client.NetworkID())
		tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, signer, transaction.CalledByEntry)
		if err != nil {
			fmt.Printf("Build tx failed: %v\n", err)
			continue
		}

		txHash, err := txBuilder.BroadcastTx(ctx, tx)
		if err != nil {
			fmt.Printf("Broadcast failed: %v\n", err)
			continue
		}

		txHashString := "0x" + txHash.StringLE()
		fmt.Printf("Broadcasted: %s\n", txHashString)

		waitCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		defer cancel()

		appLog, err := client.WaitForApplicationLog(waitCtx, txHashString, 2*time.Second)
		if err != nil {
			fmt.Printf("Wait failed: %v\n", err)
			continue
		}

		if appLog != nil && len(appLog.Executions) > 0 {
			exec := appLog.Executions[0]
			if exec.VMState != "HALT" {
				fmt.Printf("Update failed: %s (%s)\n", exec.VMState, exec.Exception)
				continue
			}
		}

		fmt.Printf("✅ %s updated successfully\n", target.Name)
	}
}
