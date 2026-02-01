//go:build scripts

// Collect GAS balances from all account pool accounts to a central address.
// Usage: go run -tags=scripts scripts/collect_pool_balances.go
//
// Environment variables:
//
//	NEO_RPC_URL          - Neo N3 RPC endpoint (default: testnet1.neo.coz.io)
//	NEO_TESTNET_WIF      - Master wallet WIF for deriving pool account keys
//	NEOACCOUNTS_MASTER_KEY - Master key hex for HD derivation (alternative to WIF)
//	SUPABASE_URL         - Supabase project URL
//	SUPABASE_SERVICE_KEY - Supabase service role key
//	COLLECT_TO_ADDRESS   - Target address (default: NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX)
//	GAS_RESERVE          - GAS to leave in each account (default: 0.01)
//	DRY_RUN              - Set to "true" to preview without executing
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/crypto"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
)

const (
	defaultRPCURL        = "https://testnet1.neo.coz.io:443"
	defaultTargetAddress = "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX"
	defaultGasReserve    = 0.01 // GAS to leave in each account
	gasDecimals          = 8
	gasScriptHash        = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	testnetNetworkID     = uint32(894710606)
)

// PoolAccount represents a pool account from the database.
type PoolAccount struct {
	ID         string `json:"id"`
	Address    string `json:"address"`
	LockedBy   string `json:"locked_by"`
	IsRetiring bool   `json:"is_retiring"`
}

// NEP17Balance represents a token balance from getnep17balances RPC.
type NEP17Balance struct {
	AssetHash string `json:"assethash"`
	Amount    string `json:"amount"`
}

// NEP17BalancesResult represents the getnep17balances RPC response.
type NEP17BalancesResult struct {
	Balance []NEP17Balance `json:"balance"`
	Address string         `json:"address"`
}

func main() {
	ctx := context.Background()

	// Parse configuration
	cfg := parseConfig()
	printConfig(cfg)

	// Initialize chain client
	chainClient, err := chain.NewClient(chain.Config{
		RPCURL:    cfg.rpcURL,
		NetworkID: testnetNetworkID,
	})
	if err != nil {
		fatal("Failed to create chain client: %v", err)
	}

	// Initialize database client
	dbClient, err := database.NewClient(database.Config{
		URL:        cfg.supabaseURL,
		ServiceKey: cfg.supabaseKey,
	})
	if err != nil {
		fatal("Failed to create database client: %v", err)
	}
	dbRepo := database.NewRepository(dbClient)

	// Fetch all pool accounts
	fmt.Println("\n📋 Fetching pool accounts from database...")
	accounts, err := fetchPoolAccounts(ctx, dbRepo)
	if err != nil {
		fatal("Failed to fetch pool accounts: %v", err)
	}
	fmt.Printf("   Found %d pool accounts\n", len(accounts))

	// Process each account
	var (
		totalCollected int64
		successCount   int
		skipCount      int
		errorCount     int
	)

	fmt.Println("\n🔄 Processing accounts...")
	fmt.Println(strings.Repeat("-", 80))

	for i, acc := range accounts {
		result := processAccount(ctx, chainClient, cfg, acc, i+1, len(accounts))

		switch result.status {
		case "success":
			successCount++
			totalCollected += result.amount
		case "skipped":
			skipCount++
		case "error":
			errorCount++
		}
	}

	// Print summary
	printSummary(totalCollected, successCount, skipCount, errorCount, cfg.dryRun)
}

type config struct {
	rpcURL        string
	supabaseURL   string
	supabaseKey   string
	targetAddress string
	gasReserve    int64 // in fractions (1e8)
	masterKey     []byte
	dryRun        bool
}

func parseConfig() *config {
	cfg := &config{}

	// RPC URL
	cfg.rpcURL = strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if cfg.rpcURL == "" {
		cfg.rpcURL = defaultRPCURL
	}

	// Supabase
	cfg.supabaseURL = strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	if cfg.supabaseURL == "" {
		fatal("SUPABASE_URL environment variable required")
	}
	cfg.supabaseKey = strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY"))
	if cfg.supabaseKey == "" {
		fatal("SUPABASE_SERVICE_KEY environment variable required")
	}

	// Target address
	cfg.targetAddress = strings.TrimSpace(os.Getenv("COLLECT_TO_ADDRESS"))
	if cfg.targetAddress == "" {
		cfg.targetAddress = defaultTargetAddress
	}

	// Validate target address
	if _, err := address.StringToUint160(cfg.targetAddress); err != nil {
		fatal("Invalid COLLECT_TO_ADDRESS: %v", err)
	}

	// GAS reserve
	reserveStr := strings.TrimSpace(os.Getenv("GAS_RESERVE"))
	if reserveStr == "" {
		cfg.gasReserve = int64(defaultGasReserve * 1e8)
	} else {
		reserve, err := strconv.ParseFloat(reserveStr, 64)
		if err != nil || reserve < 0 {
			fatal("Invalid GAS_RESERVE: %s", reserveStr)
		}
		cfg.gasReserve = int64(reserve * 1e8)
	}

	// Master key for HD derivation
	cfg.masterKey = loadMasterKey()

	// Dry run mode
	cfg.dryRun = strings.ToLower(strings.TrimSpace(os.Getenv("DRY_RUN"))) == "true"

	return cfg
}

func loadMasterKey() []byte {
	// Try POOL_MASTER_KEY first, then NEOACCOUNTS_MASTER_KEY (hex encoded)
	masterKeyHex := strings.TrimSpace(os.Getenv("POOL_MASTER_KEY"))
	if masterKeyHex == "" {
		masterKeyHex = strings.TrimSpace(os.Getenv("NEOACCOUNTS_MASTER_KEY"))
	}
	if masterKeyHex != "" {
		key, err := hex.DecodeString(masterKeyHex)
		if err != nil {
			fatal("Invalid NEOACCOUNTS_MASTER_KEY hex: %v", err)
		}
		if len(key) != 32 {
			fatal("NEOACCOUNTS_MASTER_KEY must be 32 bytes (64 hex chars)")
		}
		return key
	}

	// Fall back to deriving from WIF (for development/testing)
	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fatal("Either NEOACCOUNTS_MASTER_KEY or NEO_TESTNET_WIF required")
	}

	// Derive a deterministic master key from WIF
	// This matches how the service derives keys in development mode
	privKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fatal("Invalid NEO_TESTNET_WIF: %v", err)
	}

	// Use SHA256 of private key bytes as master key
	hash := sha256.Sum256(privKey.Bytes())
	return hash[:]
}

func printConfig(cfg *config) {
	fmt.Println("╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║         Account Pool GAS Collection Script                     ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Printf("\n📍 Configuration:\n")
	fmt.Printf("   RPC URL:        %s\n", cfg.rpcURL)
	fmt.Printf("   Target Address: %s\n", cfg.targetAddress)
	fmt.Printf("   GAS Reserve:    %.8f GAS\n", float64(cfg.gasReserve)/1e8)
	fmt.Printf("   Master Key:     %s...%s\n",
		hex.EncodeToString(cfg.masterKey[:4]),
		hex.EncodeToString(cfg.masterKey[28:]))
	if cfg.dryRun {
		fmt.Println("   Mode:           🔍 DRY RUN (no transactions)")
	} else {
		fmt.Println("   Mode:           ⚡ LIVE EXECUTION")
	}
}

func fetchPoolAccounts(ctx context.Context, repo *database.Repository) ([]PoolAccount, error) {
	// Query all pool accounts using the Repository's Request method
	resp, err := repo.Request(ctx, "GET", "pool_accounts", nil, "select=id,address,locked_by,is_retiring")
	if err != nil {
		return nil, fmt.Errorf("query pool_accounts: %w", err)
	}

	var accounts []PoolAccount
	if err := json.Unmarshal(resp, &accounts); err != nil {
		return nil, fmt.Errorf("unmarshal accounts: %w", err)
	}

	return accounts, nil
}

type processResult struct {
	status string // "success", "skipped", "error"
	amount int64
	txHash string
	err    error
}

func processAccount(ctx context.Context, client *chain.Client, cfg *config, acc PoolAccount, idx, total int) processResult {
	prefix := fmt.Sprintf("[%d/%d]", idx, total)

	// Query on-chain GAS balance
	balance, err := getGASBalance(ctx, client, acc.Address)
	if err != nil {
		fmt.Printf("%s ❌ %s - Failed to get balance: %v\n", prefix, acc.Address, err)
		return processResult{status: "error", err: err}
	}

	// Calculate transfer amount (balance - reserve)
	transferAmount := balance - cfg.gasReserve
	if transferAmount <= 0 {
		fmt.Printf("%s ⏭️  %s - Balance %.8f GAS (below reserve)\n",
			prefix, acc.Address, float64(balance)/1e8)
		return processResult{status: "skipped"}
	}

	fmt.Printf("%s 💰 %s - Balance: %.8f GAS, Transfer: %.8f GAS\n",
		prefix, acc.Address, float64(balance)/1e8, float64(transferAmount)/1e8)

	if cfg.dryRun {
		fmt.Printf("%s    └─ [DRY RUN] Would transfer to %s\n", prefix, cfg.targetAddress)
		return processResult{status: "success", amount: transferAmount}
	}

	// Derive private key for this account
	privKey, err := deriveAccountKey(cfg.masterKey, acc.ID)
	if err != nil {
		fmt.Printf("%s    └─ ❌ Key derivation failed: %v\n", prefix, err)
		return processResult{status: "error", err: err}
	}

	// Create wallet account
	walletAccount, err := chain.AccountFromPrivateKey(hex.EncodeToString(privKey))
	if err != nil {
		fmt.Printf("%s    └─ ❌ Create wallet account failed: %v\n", prefix, err)
		return processResult{status: "error", err: err}
	}

	// Verify derived address matches
	if walletAccount.Address != acc.Address {
		fmt.Printf("%s    └─ ❌ Address mismatch: derived %s != db %s\n",
			prefix, walletAccount.Address, acc.Address)
		return processResult{status: "error", err: fmt.Errorf("address mismatch")}
	}

	// Execute transfer
	toU160, _ := address.StringToUint160(cfg.targetAddress)
	txHash, err := client.TransferGAS(ctx, walletAccount, toU160, big.NewInt(transferAmount))
	if err != nil {
		fmt.Printf("%s    └─ ❌ Transfer failed: %v\n", prefix, err)
		return processResult{status: "error", err: err}
	}

	txHashStr := "0x" + txHash.StringLE()
	fmt.Printf("%s    └─ ✅ TX: %s\n", prefix, txHashStr)

	// Brief delay to avoid overwhelming the RPC
	time.Sleep(500 * time.Millisecond)

	return processResult{status: "success", amount: transferAmount, txHash: txHashStr}
}

func getGASBalance(ctx context.Context, client *chain.Client, addr string) (int64, error) {
	// Use getnep17balances RPC
	result, err := client.Call(ctx, "getnep17balances", []interface{}{addr})
	if err != nil {
		return 0, err
	}

	var balances NEP17BalancesResult
	if err := json.Unmarshal(result, &balances); err != nil {
		return 0, fmt.Errorf("unmarshal balances: %w", err)
	}

	// Find GAS balance
	gasHash := strings.TrimPrefix(gasScriptHash, "0x")
	for _, bal := range balances.Balance {
		balHash := strings.TrimPrefix(bal.AssetHash, "0x")
		if strings.EqualFold(balHash, gasHash) {
			amount, err := strconv.ParseInt(bal.Amount, 10, 64)
			if err != nil {
				return 0, fmt.Errorf("parse amount: %w", err)
			}
			return amount, nil
		}
	}

	return 0, nil // No GAS balance
}

func deriveAccountKey(masterKey []byte, accountID string) ([]byte, error) {
	// Must match the derivation in infrastructure/accountpool/marble/service.go
	return crypto.DeriveKey(masterKey, []byte(accountID), "pool-account", 32)
}

func printSummary(totalCollected int64, success, skipped, errors int, dryRun bool) {
	fmt.Println(strings.Repeat("-", 80))
	fmt.Println("\n📊 Summary:")
	fmt.Printf("   Total Collected:  %.8f GAS\n", float64(totalCollected)/1e8)
	fmt.Printf("   Successful:       %d accounts\n", success)
	fmt.Printf("   Skipped:          %d accounts (below reserve)\n", skipped)
	fmt.Printf("   Errors:           %d accounts\n", errors)

	if dryRun {
		fmt.Println("\n⚠️  DRY RUN - No actual transfers were made")
		fmt.Println("   Set DRY_RUN=false to execute transfers")
	} else {
		fmt.Println("\n✅ Collection complete!")
	}
}

func fatal(format string, args ...interface{}) {
	fmt.Printf("❌ "+format+"\n", args...)
	os.Exit(1)
}
