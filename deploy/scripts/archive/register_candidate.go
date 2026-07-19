//go:build ignore

// Script to register an address as a consensus candidate on Neo N3 Testnet

package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/neo"
	"github.com/nspcc-dev/neo-go/pkg/vm/vmstate"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const rpcURL = "https://testnet1.neo.coz.io:443"

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run register_candidate.go <WIF>")
		os.Exit(1)
	}

	wif := os.Args[1]

	// Decode WIF to get private key
	privateKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("Error decoding WIF: %v\n", err)
		os.Exit(1)
	}

	pubKey := privateKey.PublicKey()
	address := pubKey.Address()

	fmt.Printf("Address: %s\n", address)
	fmt.Printf("Public Key: %s\n", pubKey.StringCompressed())

	// Create RPC client
	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		fmt.Printf("Error creating RPC client: %v\n", err)
		os.Exit(1)
	}

	// Create wallet account from private key
	account := wallet.NewAccountFromPrivateKey(privateKey)

	// Create actor for signing transactions
	act, err := actor.NewSimple(client, account)
	if err != nil {
		fmt.Printf("Error creating actor: %v\n", err)
		os.Exit(1)
	}

	// Get NEO contract reader/writer
	neoContract := neo.New(act)

	// Check if already registered
	candidates, err := neoContract.GetCandidates()
	if err != nil {
		fmt.Printf("Warning: Could not get candidates: %v\n", err)
	} else {
		for _, c := range candidates {
			if c.PublicKey.Equal(pubKey) {
				fmt.Printf("Already registered as candidate with %d votes\n", c.Votes)
				os.Exit(0)
			}
		}
	}

	// Check NEO balance
	neoBalance, err := neoContract.BalanceOf(account.ScriptHash())
	if err != nil {
		fmt.Printf("Warning: Could not get NEO balance: %v\n", err)
	} else {
		fmt.Printf("NEO Balance: %d\n", neoBalance.Int64())
	}

	// Register as candidate
	fmt.Println("\nRegistering as candidate...")
	txHash, vub, err := neoContract.RegisterCandidate(pubKey)
	if err != nil {
		fmt.Printf("Error registering candidate: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Transaction hash: 0x%s\n", txHash.StringLE())
	fmt.Printf("Valid until block: %d\n", vub)

	// Wait for transaction to be confirmed
	fmt.Println("Waiting for confirmation...")
	time.Sleep(20 * time.Second)

	// Check transaction status
	appLog, err := client.GetApplicationLog(txHash, nil)
	if err != nil {
		fmt.Printf("Warning: Could not get application log: %v\n", err)
	} else {
		if len(appLog.Executions) > 0 {
			exec := appLog.Executions[0]
			fmt.Printf("VM State: %s\n", exec.VMState)
			if exec.VMState == vmstate.Halt {
				fmt.Println("✅ Successfully registered as candidate!")
			} else {
				fmt.Printf("❌ Transaction failed with state: %s\n", exec.VMState)
				if exec.FaultException != "" {
					fmt.Printf("Exception: %s\n", exec.FaultException)
				}
			}
		}
	}
}

// Ensure state package is used
var _ = state.NEP17Transfer{}
