// Command deploy-miniapps-live deploys MiniApp contracts to Neo N3 testnet.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/management"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

var miniApps = []string{
	// Phase 7 - New contracts
	"MiniAppHallOfFame",
	"MiniAppGasSponsor",
}

const (
	rpcURL   = "https://testnet1.neo.coz.io:443"
	buildDir = "contracts/build"
)

func main() {
	wif := os.Getenv("NEO_TESTNET_WIF")
	if wif == "" {
		log.Fatal("NEO_TESTNET_WIF not set")
	}

	account, err := wallet.NewAccountFromWIF(wif)
	if err != nil {
		log.Fatalf("Invalid WIF: %v", err)
	}

	fmt.Println("=== Deploy MiniApps to Testnet ===")
	fmt.Printf("Deployer: %s\n\n", account.Address)

	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		log.Fatalf("RPC: %v", err)
	}

	act, err := actor.NewSimple(client, account)
	if err != nil {
		client.Close()
		log.Fatalf("Actor: %v", err)
	}

	mgmt := management.New(act)
	deployed := make(map[string]string)

	for _, name := range miniApps {
		fmt.Printf("--- %s ---\n", name)
		hash, err := deployContract(ctx, client, mgmt, act, account, name)
		if err != nil {
			fmt.Printf("  ❌ %v\n\n", err)
			continue
		}
		deployed[name] = hash
		fmt.Printf("  ✅ %s\n\n", hash)
		time.Sleep(3 * time.Second)
	}

	fmt.Println("\n=== Results ===")
	for name, hash := range deployed {
		fmt.Printf("%s: %s\n", name, hash)
	}
	client.Close()
}

func deployContract(
	ctx context.Context,
	client *rpcclient.Client,
	mgmt *management.Contract,
	act *actor.Actor,
	account *wallet.Account,
	name string,
) (string, error) {
	nefPath := filepath.Join(buildDir, name+".nef")
	manifestPath := filepath.Join(buildDir, name+".manifest.json")

	nefBytes, err := os.ReadFile(nefPath)
	if err != nil {
		return "", fmt.Errorf("NEF: %w", err)
	}

	nefFile, err := nef.FileFromBytes(nefBytes)
	if err != nil {
		return "", fmt.Errorf("parse NEF: %w", err)
	}

	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		return "", fmt.Errorf("manifest: %w", err)
	}

	var m manifest.Manifest
	err = json.Unmarshal(manifestBytes, &m)
	if err != nil {
		return "", fmt.Errorf("parse manifest: %w", err)
	}

	// Calculate expected contract address
	expectedAddress := state.CreateContractHash(account.ScriptHash(), nefFile.Checksum, m.Name)

	// Check if already deployed
	_, err = client.GetContractStateByHash(expectedAddress)
	if err == nil {
		return "0x" + expectedAddress.StringLE() + " (exists)", nil
	}

	// Deploy
	txHash, vub, err := mgmt.Deploy(&nefFile, &m, nil)
	if err != nil {
		return "", fmt.Errorf("deploy: %w", err)
	}

	fmt.Printf("  TX: 0x%s\n", txHash.StringLE())

	// Wait
	_, err = act.Wait(ctx, txHash, vub, nil)
	if err != nil {
		return "", fmt.Errorf("wait: %w", err)
	}

	return "0x" + expectedAddress.StringLE(), nil
}
