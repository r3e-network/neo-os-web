// Command update-paymenthub updates the PaymentHub contract on testnet.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

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

	contractHash := os.Getenv("CONTRACT_PAYMENTHUB_HASH")
	if contractHash == "" {
		contractHash = "0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193"
	}

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: 894710606,
	})
	if err != nil {
		log.Fatalf("Failed to create chain client: %v", err)
	}

	signer, err := chain.AccountFromWIF(wif)
	if err != nil {
		log.Fatalf("Failed to create signer: %v", err)
	}

	log.Printf("Updater address: %s", signer.Address)
	log.Printf("Contract to update: %s", contractHash)

	nefData, err := os.ReadFile("contracts/build/PaymentHubV2.nef")
	if err != nil {
		log.Fatalf("Failed to read NEF: %v", err)
	}

	manifestData, err := os.ReadFile("contracts/build/PaymentHubV2.manifest.json")
	if err != nil {
		log.Fatalf("Failed to read manifest: %v", err)
	}

	log.Printf("NEF size: %d bytes", len(nefData))
	log.Printf("Manifest size: %d bytes", len(manifestData))

	params := []chain.ContractParam{
		chain.NewByteArrayParam(nefData),
		chain.NewStringParam(string(manifestData)),
	}

	log.Println("Simulating update...")

	invokeResult, err := client.InvokeFunctionWithSigners(ctx, contractHash, "update", params, signer.ScriptHash())
	if err != nil {
		log.Fatalf("Update simulation failed: %v", err)
	}

	if invokeResult.State != "HALT" {
		log.Fatalf("Update simulation faulted: %s", invokeResult.Exception)
	}

	log.Printf("Simulation passed, estimated GAS: %s", invokeResult.GasConsumed)

	txBuilder := chain.NewTxBuilder(client, client.NetworkID())
	tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, signer, transaction.CalledByEntry)
	if err != nil {
		log.Fatalf("Failed to build transaction: %v", err)
	}

	log.Println("Broadcasting transaction...")

	txHash, err := txBuilder.BroadcastTx(ctx, tx)
	if err != nil {
		log.Fatalf("Failed to broadcast: %v", err)
	}

	txHashString := "0x" + txHash.StringLE()
	log.Printf("Transaction broadcast: %s", txHashString)

	log.Println("Waiting for confirmation...")
	waitCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	appLog, err := client.WaitForApplicationLog(waitCtx, txHashString, 2*time.Second)
	if err != nil {
		log.Fatalf("Failed to get application log: %v", err)
	}

	if appLog != nil && len(appLog.Executions) > 0 {
		exec := appLog.Executions[0]
		if exec.VMState != "HALT" {
			log.Fatalf("Update failed: %s, exception: %s", exec.VMState, exec.Exception)
		}
	}

	log.Println("=== Update Successful ===")
	log.Printf("Contract Hash: %s", contractHash)
	log.Printf("Transaction: %s", txHashString)
	log.Printf("GAS Consumed: %s", invokeResult.GasConsumed)

	fmt.Println("\nContract updated successfully!")
}
