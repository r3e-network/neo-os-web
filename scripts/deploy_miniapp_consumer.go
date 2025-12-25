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
	contractName    = "MiniAppServiceConsumer"
)

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

	nefPath := filepath.Join(buildDir, contractName+".nef")
	manifestPath := filepath.Join(buildDir, contractName+".manifest.json")

	nefFile, err := loadNEF(nefPath)
	if err != nil {
		fmt.Printf("Failed to load NEF: %v\n", err)
		os.Exit(1)
	}
	mani, err := loadManifest(manifestPath)
	if err != nil {
		fmt.Printf("Failed to load manifest: %v\n", err)
		os.Exit(1)
	}

	privateKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("Invalid WIF: %v\n", err)
		os.Exit(1)
	}

	deployerHash := privateKey.GetScriptHash()
	deployerAddr := address.Uint160ToString(deployerHash)
	expectedHash := state.CreateContractHash(deployerHash, nefFile.Checksum, mani.Name)
	expectedHex := "0x" + expectedHash.StringLE()

	fmt.Println("=== MiniAppServiceConsumer Deployment ===")
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Deployer: %s\n", deployerAddr)
	fmt.Printf("Expected hash: %s\n", expectedHex)

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

	contractHash := expectedHex
	if _, err := client.GetContractStateByHash(expectedHash); err == nil {
		fmt.Printf("Already deployed at: %s\n", contractHash)
	} else {
		mgmt := management.New(act)
		fmt.Println("Submitting deploy transaction...")

		txHash, vub, err := mgmt.Deploy(nefFile, mani, nil)
		if err != nil {
			fmt.Printf("Failed to deploy: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Transaction sent: %s\n", txHash.StringLE())
		fmt.Printf("Valid until block: %d\n", vub)

		contractHash, err = waitForDeployment(ctx, client, txHash, expectedHash)
		if err != nil {
			fmt.Printf("Deployment failed: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("✅ Contract deployed at: %s\n", contractHash)
	}

	gatewayHash, err := resolveGatewayHash()
	if err != nil {
		fmt.Printf("Invalid ServiceLayerGateway hash: %v\n", err)
		os.Exit(1)
	}
	if gatewayHash != (util.Uint160{}) {
		fmt.Println("Configuring gateway on MiniAppServiceConsumer...")
		if err := setGateway(ctx, client, act, expectedHash, gatewayHash); err != nil {
			fmt.Printf("❌ setGateway failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✅ Gateway configured")
	}
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

func resolveGatewayHash() (util.Uint160, error) {
	raw := strings.TrimSpace(os.Getenv("CONTRACT_SERVICEGATEWAY_HASH"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("CONTRACT_SERVICE_GATEWAY_HASH"))
	}
	if raw == "" {
		return util.Uint160{}, nil
	}
	return parseHash160(raw)
}

func parseHash160(raw string) (util.Uint160, error) {
	raw = strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(raw)
}

func setGateway(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contract util.Uint160, gateway util.Uint160) error {
	testResult, err := act.Call(contract, "setGateway", gateway)
	if err != nil {
		return fmt.Errorf("test invoke failed: %w", err)
	}
	if testResult.State != "HALT" {
		return fmt.Errorf("test invoke failed: %s (fault: %s)", testResult.State, testResult.FaultException)
	}

	txHash, vub, err := act.SendCall(contract, "setGateway", gateway)
	if err != nil {
		return fmt.Errorf("send transaction: %w", err)
	}
	fmt.Printf("  tx %s (vub %d)\n", txHash.StringLE(), vub)
	return waitForTx(ctx, client, txHash)
}

func waitForTx(ctx context.Context, client *rpcclient.Client, txHash util.Uint256) error {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(2 * time.Minute)

	for {
		select {
		case <-timeout:
			return fmt.Errorf("timeout waiting for transaction")
		case <-ticker.C:
			appLog, err := client.GetApplicationLog(txHash, nil)
			if err != nil {
				continue
			}
			if len(appLog.Executions) == 0 {
				continue
			}
			exec := appLog.Executions[0]
			if exec.VMState.HasFlag(1) {
				return nil
			}
			return fmt.Errorf("transaction failed: %s", exec.FaultException)
		}
	}
}

func waitForDeployment(ctx context.Context, client *rpcclient.Client, txHash util.Uint256, expected util.Uint160) (string, error) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	timeout := time.After(5 * time.Minute)

	for {
		select {
		case <-timeout:
			return "", fmt.Errorf("timeout waiting for transaction")
		case <-ticker.C:
			appLog, err := client.GetApplicationLog(txHash, nil)
			if err != nil {
				continue
			}

			if len(appLog.Executions) == 0 {
				continue
			}

			exec := appLog.Executions[0]
			if !exec.VMState.HasFlag(1) {
				return "", fmt.Errorf("transaction failed: %s", exec.FaultException)
			}

			if len(exec.Stack) > 0 {
				item := exec.Stack[0]
				if arr, ok := item.Value().([]interface{}); ok && len(arr) > 0 {
					if hashItem, ok := arr[0].([]byte); ok {
						return fmt.Sprintf("0x%x", hashItem), nil
					}
				}
				if bs, ok := item.Value().([]byte); ok {
					return fmt.Sprintf("0x%x", bs), nil
				}
			}

			for _, notif := range exec.Events {
				if notif.Name == "Deploy" {
					if arr, ok := notif.Item.Value().([]interface{}); ok && len(arr) > 0 {
						if hash, ok := arr[0].([]byte); ok {
							return fmt.Sprintf("0x%x", hash), nil
						}
					}
				}
			}

			if _, err := client.GetContractStateByHash(expected); err == nil {
				return "0x" + expected.StringLE(), nil
			}
			return "", fmt.Errorf("deploy succeeded but contract hash not found in logs")
		}
	}
}
