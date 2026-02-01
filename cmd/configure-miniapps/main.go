// Command configure-miniapps configures all MiniApps in the PaymentHubV2 contract.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
)

var miniApps = []string{
	"miniapp-lottery",
	"miniapp-coinflip",
	"miniapp-dice-game",
	"miniapp-scratch-card",
	"miniapp-flashloan",
	"miniapp-red-envelope",
	"miniapp-gas-circle",
	"miniapp-gov-booster",
	"miniapp-secret-poker",
	"builtin-canvas",
}

type deployedConfig struct {
	Network       string                       `json:"network"`
	NetworkMagic  uint32                       `json:"network_magic"`
	RPCEndpoints  []string                     `json:"rpc_endpoints"`
	Contracts     map[string]deployedContract  `json:"contracts"`
	MiniappConfig map[string]miniappDeployment `json:"miniapp_contracts"`
}

type deployedContract struct {
	Address string `json:"address"`
}

type miniappDeployment struct {
	AppID string `json:"app_id"`
}

func detectNetwork() string {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv("NEO_NETWORK")))
	if raw == "mainnet" || raw == "testnet" {
		return raw
	}
	if magicStr := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); magicStr != "" {
		if magic, err := strconv.ParseUint(magicStr, 10, 32); err == nil {
			if magic == 860833102 {
				return "mainnet"
			}
		}
	}
	return "testnet"
}

func loadConfig(network string) *deployedConfig {
	configPath := filepath.Join("deploy", "config", network+"_contracts.json")
	raw, err := os.ReadFile(configPath)
	if err != nil {
		return &deployedConfig{}
	}
	cfg := &deployedConfig{}
	if err := json.Unmarshal(raw, cfg); err != nil {
		return &deployedConfig{}
	}
	return cfg
}

func resolveRPCURL(cfg *deployedConfig) string {
	if rpc := strings.TrimSpace(os.Getenv("NEO_RPC_URL")); rpc != "" {
		return rpc
	}
	if len(cfg.RPCEndpoints) > 0 {
		return cfg.RPCEndpoints[0]
	}
	return "https://testnet1.neo.coz.io:443"
}

func resolveNetworkMagic(cfg *deployedConfig) uint32 {
	if magicStr := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); magicStr != "" {
		if magic, err := strconv.ParseUint(magicStr, 10, 32); err == nil {
			return uint32(magic)
		}
	}
	if cfg.NetworkMagic != 0 {
		return cfg.NetworkMagic
	}
	return 894710606
}

func resolveWIF(network string) string {
	if raw := strings.TrimSpace(os.Getenv("NEO_WIF")); raw != "" {
		return raw
	}
	if network == "mainnet" {
		return strings.TrimSpace(os.Getenv("NEO_MAINNET_WIF"))
	}
	return strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
}

func resolvePaymentHub(network string, cfg *deployedConfig) string {
	if network == "mainnet" {
		if addr := strings.TrimSpace(os.Getenv("CONTRACT_PAYMENT_HUB_ADDRESS_MAINNET")); addr != "" {
			return addr
		}
	}
	if addr := strings.TrimSpace(os.Getenv("CONTRACT_PAYMENT_HUB_ADDRESS")); addr != "" {
		return addr
	}
	if cfg.Contracts != nil {
		if entry, ok := cfg.Contracts["PaymentHub"]; ok {
			return strings.TrimSpace(entry.Address)
		}
	}
	return ""
}

func resolveMiniApps(cfg *deployedConfig) []string {
	if cfg.MiniappConfig == nil {
		return miniApps
	}
	ids := make([]string, 0, len(cfg.MiniappConfig))
	for _, entry := range cfg.MiniappConfig {
		if strings.TrimSpace(entry.AppID) == "" {
			continue
		}
		ids = append(ids, entry.AppID)
	}
	if len(ids) == 0 {
		return miniApps
	}
	sort.Strings(ids)
	return ids
}

func main() {
	ctx := context.Background()
	network := detectNetwork()
	cfg := loadConfig(network)

	rpcURL := resolveRPCURL(cfg)
	wif := resolveWIF(network)
	if wif == "" {
		log.Fatal("Missing WIF (set NEO_WIF or network-specific WIF)")
	}

	contractAddress := resolvePaymentHub(network, cfg)
	if contractAddress == "" {
		log.Fatal("PaymentHub contract address not set")
	}
	miniApps = resolveMiniApps(cfg)

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: resolveNetworkMagic(cfg),
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

	log.Printf("Network: %s", network)
	log.Printf("RPC: %s", rpcURL)
	log.Printf("Configuring %d MiniApps in contract: %s", len(miniApps), contractAddress)
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
