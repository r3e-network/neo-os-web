// DEPRECATED: This script deploys the v1 ModuleRegistry/RecipeRegistry/InstanceRegistry
// contracts which have been replaced by direct OS service contracts in MiniApp-OS v2.
// Retained for reference; new deployments should use the v2 OS service contract deploy scripts.

//go:build scripts

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/management"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	defaultModularRPC = "https://testnet1.neo.coz.io:443"
	modularBuildDir   = "contracts/build"
	modularConfigFile = "deploy/config/testnet_contracts.json"
)

var modularContracts = []string{
	"ModuleRegistry",
	"RecipeRegistry",
	"MiniAppInstanceRegistry",
	"FundingVault",
	"StreamVesting",
}

func main() {
	wif := os.Getenv("NEO_TESTNET_WIF")
	if wif == "" {
		fmt.Println("NEO_TESTNET_WIF environment variable not set")
		os.Exit(1)
	}

	privateKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("Invalid WIF: %v\n", err)
		os.Exit(1)
	}

	rpcURL := os.Getenv("NEO_RPC_URL")
	if rpcURL == "" {
		rpcURL = defaultModularRPC
	}
	rpcTimeout := resolveRPCTimeout()

	fmt.Printf("Deployer address: %s\n", address.Uint160ToString(privateKey.GetScriptHash()))
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("RPC timeout: %s\n", rpcTimeout)

	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{
		DialTimeout:    rpcTimeout,
		RequestTimeout: rpcTimeout,
	})
	if err != nil {
		fmt.Printf("Failed to create RPC client: %v\n", err)
		os.Exit(1)
	}

	version, err := client.GetVersion()
	if err != nil {
		fmt.Printf("Failed to get version: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Connected to network: %d\n", version.Protocol.Network)

	acc := wallet.NewAccountFromPrivateKey(privateKey)
	acc.Label = "modular-deployer"

	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("Failed to create actor: %v\n", err)
		os.Exit(1)
	}

	mgmt := management.New(act)
	config := loadDeployConfig(modularConfigFile)
	failed := 0

	fmt.Println("\n=== Deploying Modular Contracts ===")

	for _, name := range modularContracts {
		fmt.Printf("\n--- %s ---\n", name)
		if existing, ok := config.Contracts[name]; ok && existing.Hash != "" && existing.Hash != "null" {
			fmt.Printf("Already deployed at: %s\n", existing.Hash)
			continue
		}

		nefFile, err := loadNEFFile(filepath.Join(modularBuildDir, name+".nef"))
		if err != nil {
			fmt.Printf("Failed to load NEF: %v\n", err)
			failed++
			continue
		}
		m, err := loadManifestFile(filepath.Join(modularBuildDir, name+".manifest.json"))
		if err != nil {
			fmt.Printf("Failed to load manifest: %v\n", err)
			failed++
			continue
		}

		txHash, vub, err := mgmt.Deploy(nefFile, m, nil)
		if err != nil {
			fmt.Printf("Failed to deploy: %v\n", err)
			failed++
			continue
		}

		fmt.Printf("Transaction sent: %s\n", txHash.StringLE())
		fmt.Printf("Valid until block: %d\n", vub)

		contractHash, err := waitForModularDeployment(ctx, client, txHash)
		if err != nil {
			fmt.Printf("Deployment failed: %v\n", err)
			failed++
			continue
		}

		fmt.Printf("✅ Contract deployed at: %s\n", contractHash)
		config.Contracts[name] = &DeployContractInfo{
			Name:       name,
			Hash:       contractHash,
			Version:    "0.1.0",
			DeployedAt: time.Now().UTC().Format(time.RFC3339),
			Network:    "testnet",
			Status:     "deployed",
		}
	}

	if err := saveDeployConfig(modularConfigFile, config); err != nil {
		fmt.Printf("Failed to save config: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("\n✅ Modular contract deployment complete")
	for _, name := range modularContracts {
		if info := config.Contracts[name]; info != nil && info.Hash != "" {
			fmt.Printf("%s=%s\n", name, info.Hash)
		}
	}

	if failed > 0 {
		fmt.Printf("\n❌ %d modular contract deployments failed\n", failed)
		os.Exit(1)
	}
}

type DeployContractInfo struct {
	Name       string `json:"name"`
	Hash       string `json:"hash"`
	Version    string `json:"version,omitempty"`
	DeployedAt string `json:"deployed_at,omitempty"`
	Network    string `json:"network,omitempty"`
	Status     string `json:"status,omitempty"`
	Notes      string `json:"notes,omitempty"`
}

type DeployConfig struct {
	Network         string                         `json:"network"`
	UpdatedAt       string                         `json:"updated_at"`
	RPCEndpoints    []string                       `json:"rpc_endpoints,omitempty"`
	NetworkMagic    int                            `json:"network_magic,omitempty"`
	Contracts       map[string]*DeployContractInfo `json:"contracts"`
	LegacyContracts map[string]interface{}         `json:"legacy_contracts,omitempty"`
	Deployer        map[string]string              `json:"deployer,omitempty"`
}

func loadDeployConfig(path string) *DeployConfig {
	data, err := os.ReadFile(path)
	if err != nil {
		return &DeployConfig{
			Network:   "testnet",
			Contracts: make(map[string]*DeployContractInfo),
		}
	}

	var config DeployConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return &DeployConfig{
			Network:   "testnet",
			Contracts: make(map[string]*DeployContractInfo),
		}
	}
	if config.Contracts == nil {
		config.Contracts = make(map[string]*DeployContractInfo)
	}
	return &config
}

func saveDeployConfig(path string, config *DeployConfig) error {
	config.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func loadNEFFile(path string) (*nef.File, error) {
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

func loadManifestFile(path string) (*manifest.Manifest, error) {
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

func waitForModularDeployment(ctx context.Context, client *rpcclient.Client, txHash util.Uint256) (string, error) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(5 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
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
				if arr, ok := item.Value().([]stackitem.Item); ok && len(arr) > 0 {
					if hashItem, ok := arr[0].Value().([]byte); ok {
						return fmt.Sprintf("0x%x", hashItem), nil
					}
				}
				if bs, ok := item.Value().([]byte); ok {
					return fmt.Sprintf("0x%x", bs), nil
				}
			}
			for _, notif := range exec.Events {
				if notif.Name != "Deploy" || notif.Item == nil {
					continue
				}
				items, ok := notif.Item.Value().([]stackitem.Item)
				if !ok || len(items) == 0 {
					continue
				}
				if bs, err := items[0].TryBytes(); err == nil && len(bs) == 20 {
					hash, convErr := util.Uint160DecodeBytesBE(bs)
					if convErr == nil {
						return fmt.Sprintf("0x%s", hash.StringLE()), nil
					}
				}
			}
			return "deployed-check-explorer", nil
		}
	}
}

func resolveRPCTimeout() time.Duration {
	if raw := os.Getenv("NEO_RPC_TIMEOUT_SECONDS"); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			return time.Duration(seconds) * time.Second
		}
	}
	return 30 * time.Second
}
