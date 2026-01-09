//go:build scripts

// Validate MiniApp contracts on testnet and update stats.
// Usage: go run -tags=scripts scripts/validate_miniapp_contracts.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/util"
)

// MiniAppContract defines a miniapp and its expected contract
type MiniAppContract struct {
	AppID        string
	ContractHash string
	EnvVar       string
	Category     string
}

// ValidationResult holds validation outcome
type ValidationResult struct {
	AppID    string `json:"app_id"`
	Hash     string `json:"contract_hash"`
	Valid    bool   `json:"valid"`
	Deployed bool   `json:"deployed"`
	Error    string `json:"error,omitempty"`
}

func main() {
	ctx := context.Background()

	fmt.Println("=== MiniApp Contract Validation ===")
	fmt.Println()

	// Get RPC URL
	rpcURL := os.Getenv("NEO_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	// Connect to RPC
	rpc, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		fmt.Printf("ERROR: Failed to connect to RPC: %v\n", err)
		os.Exit(1)
	}
	defer rpc.Close()

	fmt.Printf("Connected to: %s\n\n", rpcURL)

	// Define all miniapp contracts to validate
	contracts := getAllMiniAppContracts()

	results := make([]ValidationResult, 0, len(contracts))
	validCount := 0
	invalidCount := 0

	for _, c := range contracts {
		result := validateContract(ctx, rpc, c)
		results = append(results, result)

		status := "INVALID"
		if result.Valid {
			status = "VALID"
			validCount++
		} else {
			invalidCount++
		}

		fmt.Printf("[%s] %s: %s\n", status, c.AppID, c.ContractHash[:20]+"...")
		if result.Error != "" {
			fmt.Printf("    Error: %s\n", result.Error)
		}
	}

	fmt.Println()
	fmt.Printf("=== Summary ===\n")
	fmt.Printf("Valid: %d, Invalid: %d, Total: %d\n", validCount, invalidCount, len(contracts))

	// Output JSON for database update
	if os.Getenv("OUTPUT_JSON") == "true" {
		jsonData, _ := json.MarshalIndent(results, "", "  ")
		fmt.Println("\n=== JSON Output ===")
		fmt.Println(string(jsonData))
	}

	// Update Supabase if configured
	if os.Getenv("UPDATE_SUPABASE") == "true" {
		updateSupabaseStats(results)
	}
}

// getAllMiniAppContracts returns all miniapp contracts to validate
func getAllMiniAppContracts() []MiniAppContract {
	return []MiniAppContract{
		// Gaming
		{AppID: "miniapp-lottery", EnvVar: "CONTRACT_MINIAPP_LOTTERY_HASH", Category: "gaming"},
		{AppID: "miniapp-coin-flip", EnvVar: "CONTRACT_MINIAPP_COINFLIP_HASH", Category: "gaming"},
		{AppID: "miniapp-dice-game", EnvVar: "CONTRACT_MINIAPP_DICEGAME_HASH", Category: "gaming"},
		{AppID: "miniapp-scratch-card", EnvVar: "CONTRACT_MINIAPP_SCRATCHCARD_HASH", Category: "gaming"},
		{AppID: "miniapp-neo-crash", EnvVar: "CONTRACT_MINIAPP_NEOCRASH_HASH", Category: "gaming"},
		// DeFi
		{AppID: "miniapp-flashloan", EnvVar: "CONTRACT_MINIAPP_FLASHLOAN_HASH", Category: "defi"},
		// Social
		{AppID: "miniapp-red-envelope", EnvVar: "CONTRACT_MINIAPP_REDENVELOPE_HASH", Category: "social"},
		{AppID: "miniapp-time-capsule", EnvVar: "CONTRACT_MINIAPP_TIMECAPSULE_HASH", Category: "social"},
		{AppID: "miniapp-dev-tipping", EnvVar: "CONTRACT_MINIAPP_DEVTIPPING_HASH", Category: "social"},
		// Governance
		{AppID: "miniapp-govbooster", EnvVar: "CONTRACT_MINIAPP_GOVBOOSTER_HASH", Category: "governance"},
		{AppID: "miniapp-guardian-policy", EnvVar: "CONTRACT_MINIAPP_GUARDIANPOLICY_HASH", Category: "governance"},
		// Utility
		{AppID: "miniapp-dailycheckin", EnvVar: "CONTRACT_MINIAPP_DAILYCHECKIN_HASH", Category: "utility"},
		{AppID: "miniapp-garden-of-neo", EnvVar: "CONTRACT_MINIAPP_GARDENOFNEO_HASH", Category: "utility"},
		{AppID: "miniapp-gas-circle", EnvVar: "CONTRACT_MINIAPP_GASCIRCLE_HASH", Category: "utility"},
	}
}

// validateContract checks if a contract exists on testnet
func validateContract(ctx context.Context, rpc *rpcclient.Client, c MiniAppContract) ValidationResult {
	result := ValidationResult{
		AppID: c.AppID,
	}

	// Get contract hash from env
	hash := strings.TrimSpace(os.Getenv(c.EnvVar))
	if hash == "" {
		result.Error = "env var not set: " + c.EnvVar
		return result
	}

	result.Hash = hash

	// Parse hash
	hashClean := strings.TrimPrefix(hash, "0x")
	contractHash, err := util.Uint160DecodeStringLE(hashClean)
	if err != nil {
		result.Error = "invalid hash format"
		return result
	}

	// Check if contract exists
	state, err := rpc.GetContractStateByHash(contractHash)
	if err != nil {
		result.Error = "contract not found on chain"
		return result
	}

	result.Deployed = true
	result.Valid = state != nil && state.NEF.Script != nil
	return result
}

// updateSupabaseStats updates miniapp_stats_summary with validation results
func updateSupabaseStats(results []ValidationResult) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		fmt.Println("WARN: Supabase not configured, skipping update")
		return
	}

	fmt.Println("\n=== Updating Supabase Stats ===")

	client := &http.Client{Timeout: 30 * time.Second}

	for _, r := range results {
		if !r.Valid {
			// Skip invalid contracts
			continue
		}

		// Update contract_hash in miniapp_stats_summary
		url := fmt.Sprintf("%s/rest/v1/miniapp_stats_summary?app_id=eq.%s", supabaseURL, r.AppID)
		body := fmt.Sprintf(`{"contract_hash":"%s","contract_valid":true}`, r.Hash)

		req, _ := http.NewRequest("PATCH", url, strings.NewReader(body))
		req.Header.Set("apikey", supabaseKey)
		req.Header.Set("Authorization", "Bearer "+supabaseKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Prefer", "return=minimal")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("  [ERROR] %s: %v\n", r.AppID, err)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode < 300 {
			fmt.Printf("  [OK] %s updated\n", r.AppID)
		} else {
			fmt.Printf("  [WARN] %s: HTTP %d\n", r.AppID, resp.StatusCode)
		}
	}
}
