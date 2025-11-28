package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

type config struct {
	API       string
	Token     string
	Tenant    string
	AccountID string
	FeedID    string
	RPCURL    string
	WIF       string
	Hash      string
	Method    string
}

func loadConfig() (config, error) {
	_ = godotenv.Load()
	cfg := config{
		API:       valueOrDefault("SERVICE_LAYER_API", "http://localhost:8080"),
		Token:     os.Getenv("SERVICE_LAYER_TOKEN"),
		Tenant:    os.Getenv("SERVICE_LAYER_TENANT"),
		AccountID: os.Getenv("ACCOUNT_ID"),
		FeedID:    os.Getenv("PRICE_FEED_ID"),
		RPCURL:    valueOrDefault("RPC_URL", "http://localhost:20332"),
		WIF:       os.Getenv("WIF"),
		Hash:      os.Getenv("CONTRACT_HASH"),
		Method:    valueOrDefault("CONTRACT_METHOD", "updatePrice"),
	}
	for key, val := range map[string]string{
		"ACCOUNT_ID":     cfg.AccountID,
		"PRICE_FEED_ID":  cfg.FeedID,
		"WIF":            cfg.WIF,
		"CONTRACT_HASH":  cfg.Hash,
		"SERVICE_LAYER_API": cfg.API,
	} {
		if strings.TrimSpace(val) == "" || strings.Contains(val, "<") {
			return cfg, fmt.Errorf("missing %s in environment/.env", key)
		}
	}
	return cfg, nil
}

func valueOrDefault(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func main() {
	ctx := context.Background()

	cfg, err := loadConfig()
	if err != nil {
		fmt.Println("config error:", err)
		os.Exit(1)
	}

	price, err := fetchLatestPrice(cfg)
	if err != nil {
		fmt.Println("fetch price error:", err)
		os.Exit(1)
	}
	fmt.Println("Using latest price:", price)

	wifAccount, err := wallet.NewAccountFromWIF(cfg.WIF)
	if err != nil {
		fmt.Println("invalid WIF:", err)
		os.Exit(1)
	}

	rpc, err := rpcclient.New(ctx, cfg.RPCURL, rpcclient.Options{})
	if err != nil {
		fmt.Println("RPC client error:", err)
		os.Exit(1)
	}
	defer rpc.Close()
	if err := rpc.Init(); err != nil {
		fmt.Println("RPC init error:", err)
		os.Exit(1)
	}

	contract, err := util.Uint160DecodeStringLE(strings.TrimPrefix(cfg.Hash, "0x"))
	if err != nil {
		fmt.Println("invalid contract hash (expect little-endian):", err)
		os.Exit(1)
	}

	act, err := actor.NewSimple(rpc, wifAccount)
	if err != nil {
		fmt.Println("actor error:", err)
		os.Exit(1)
	}

	// Prepare string param; adjust here if your contract expects ints.
	params := []any{price}

	fmt.Printf("Invoking %s on %s with params %v\n", cfg.Method, contract.StringLE(), params)
	txHash, vub, err := act.SendCall(contract, cfg.Method, params...)
	if err != nil {
		fmt.Println("send call error:", err)
		os.Exit(1)
	}
	fmt.Printf("Sent tx %s (validUntilBlock=%d). Waiting for HALT...\n", txHash.StringLE(), vub)

	ctxWait, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if _, err := act.WaitSuccess(ctxWait, txHash, vub, nil); err != nil {
		fmt.Println("transaction failed:", err)
		os.Exit(1)
	}
	fmt.Println("Transaction executed successfully")
}

type snapshot struct {
	Price json.RawMessage `json:"Price"`
}

func fetchLatestPrice(cfg config) (string, error) {
	url := fmt.Sprintf("%s/accounts/%s/pricefeeds/%s/snapshots", strings.TrimRight(cfg.API, "/"), cfg.AccountID, cfg.FeedID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(cfg.Token) != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}
	if strings.TrimSpace(cfg.Tenant) != "" {
		req.Header.Set("X-Tenant-ID", cfg.Tenant)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("snapshots request failed: %s", resp.Status)
	}
	var snaps []snapshot
	if err := json.NewDecoder(resp.Body).Decode(&snaps); err != nil {
		return "", err
	}
	if len(snaps) == 0 {
		return "", fmt.Errorf("no snapshots returned")
	}
	val := strings.TrimSpace(string(snaps[len(snaps)-1].Price))
	if val == "" {
		return "", fmt.Errorf("snapshot missing price")
	}
	// If price is quoted, remove quotes.
	val = strings.Trim(val, "\"")
	return val, nil
}
