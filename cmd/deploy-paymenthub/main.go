// Command deploy-paymenthub deploys a new PaymentHub contract to testnet using the master wallet.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
)

func main() {
	ctx := context.Background()

	// Load environment
	rpcURL := os.Getenv("NEO_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	wif := os.Getenv("NEO_TESTNET_WIF")
	if wif == "" {
		log.Fatal("NEO_TESTNET_WIF environment variable not set")
	}

	// Create chain client
	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: 894710606, // Testnet magic
	})
	if err != nil {
		log.Fatalf("Failed to create chain client: %v", err)
	}

	// Create signer account from WIF
	signer, err := chain.AccountFromWIF(wif)
	if err != nil {
		log.Fatalf("Failed to create signer: %v", err)
	}

	log.Printf("Deployer address: %s", signer.Address)

	// Load contract files - use PaymentHubV2
	nefPath := "contracts/build/PaymentHubV2.nef"
	manifestPath := "contracts/build/PaymentHubV2.manifest.json"

	nefData, err := os.ReadFile(nefPath)
	if err != nil {
		log.Fatalf("Failed to read NEF: %v", err)
	}

	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		log.Fatalf("Failed to read manifest: %v", err)
	}

	// Parse NEF and manifest for hash calculation
	nefFile, err := nef.FileFromBytes(nefData)
	if err != nil {
		log.Fatalf("Failed to parse NEF: %v", err)
	}

	var m manifest.Manifest
	err = json.Unmarshal(manifestData, &m)
	if err != nil {
		log.Fatalf("Failed to parse manifest: %v", err)
	}

	// Calculate expected contract address
	contractAddress := state.CreateContractHash(signer.ScriptHash(), nefFile.Checksum, m.Name)
	contractAddressStr := "0x" + contractAddress.StringLE()
	log.Printf("Expected contract address: %s", contractAddressStr)
	log.Printf("Contract name: %s", m.Name)

	// Build deployment parameters
	// ContractManagement.deploy expects: (ByteArray nefFile, ByteArray manifest, Any data)
	params := []chain.ContractParam{
		chain.NewByteArrayParam(nefData),
		chain.NewByteArrayParam(manifestData),
	}

	// ContractManagement native contract address
	contractMgmtHash := "0xfffdc93764dbaddd97c48f252a53ea4643faa3fd"

	log.Println("Simulating deployment...")

	// Simulate deployment
	invokeResult, err := client.InvokeFunctionWithSigners(ctx, contractMgmtHash, "deploy", params, signer.ScriptHash())
	if err != nil {
		log.Fatalf("Deployment simulation failed: %v", err)
	}

	if invokeResult.State != "HALT" {
		log.Fatalf("Deployment simulation faulted: %s", invokeResult.Exception)
	}

	log.Printf("Simulation passed, estimated GAS: %s", invokeResult.GasConsumed)

	// Build and sign the transaction
	txBuilder := chain.NewTxBuilder(client, client.NetworkID())
	tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, signer, transaction.CalledByEntry)
	if err != nil {
		log.Fatalf("Failed to build transaction: %v", err)
	}

	log.Println("Broadcasting transaction...")

	// Broadcast the transaction
	txHash, err := txBuilder.BroadcastTx(ctx, tx)
	if err != nil {
		log.Fatalf("Failed to broadcast: %v", err)
	}

	txHashString := "0x" + txHash.StringLE()
	log.Printf("Transaction broadcast: %s", txHashString)

	// Wait for confirmation
	log.Println("Waiting for confirmation...")
	waitCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)

	appLog, err := client.WaitForApplicationLog(waitCtx, txHashString, 2*time.Second)
	if err != nil {
		cancel()
		log.Fatalf("Failed to get application log: %v", err)
	}

	if appLog != nil && len(appLog.Executions) > 0 {
		exec := appLog.Executions[0]
		if exec.VMState != "HALT" {
			cancel()
			log.Fatalf("Deployment failed with state: %s, exception: %s", exec.VMState, exec.Exception)
		}
	}
	cancel()

	log.Println("=== Deployment Successful ===")
	log.Printf("Contract Address: %s", contractAddressStr)
	log.Printf("Transaction: %s", txHashString)
	log.Printf("GAS Consumed: %s", invokeResult.GasConsumed)

	// Output for easy copy-paste
	fmt.Println()
	fmt.Printf("CONTRACT_PAYMENT_HUB_ADDRESS=%s\n", contractAddressStr)
}
