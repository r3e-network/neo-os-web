//go:build ignore

// Diagnostic script to identify why MiniApp transactions and callback transactions are not working
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	fmt.Println("=== Neo Simulation Service Diagnostic ===")
	fmt.Println()

	// Check 1: Environment Variables
	fmt.Println("--- Check 1: Required Environment Variables ---")
	envVars := map[string]string{
		"CONTRACT_PRICEFEED_HASH":     os.Getenv("CONTRACT_PRICEFEED_HASH"),
		"CONTRACT_RANDOMNESSLOG_HASH": os.Getenv("CONTRACT_RANDOMNESSLOG_HASH"),
		"CONTRACT_PAYMENTHUB_HASH":    os.Getenv("CONTRACT_PAYMENTHUB_HASH"),
		"SIMULATION_ENABLED":          os.Getenv("SIMULATION_ENABLED"),
		"NEOACCOUNTS_SERVICE_URL":     os.Getenv("NEOACCOUNTS_SERVICE_URL"),
	}

	paymentHubSet := true
	for name, value := range envVars {
		if value == "" {
			fmt.Printf("❌ %s: NOT SET\n", name)
			if name == "CONTRACT_PAYMENTHUB_HASH" {
				paymentHubSet = false
			}
		} else {
			// Mask sensitive values
			displayValue := value
			if strings.Contains(name, "HASH") && len(value) > 16 {
				displayValue = value[:8] + "..." + value[len(value)-8:]
			}
			fmt.Printf("✅ %s: %s\n", name, displayValue)
		}
	}
	fmt.Println()

	if !paymentHubSet {
		fmt.Println("⚠️  WARNING: PaymentHub hash not configured!")
		fmt.Println("   The contract invoker and MiniApp simulator will be DISABLED.")
		fmt.Println("   Set the following environment variables:")
		fmt.Println("   - CONTRACT_PAYMENTHUB_HASH")
		fmt.Println()
	}

	// Check 2: Account Pool Service
	fmt.Println("--- Check 2: Account Pool Service ---")
	accountPoolURL := os.Getenv("NEOACCOUNTS_SERVICE_URL")
	if accountPoolURL == "" {
		accountPoolURL = "http://localhost:8081" // Default for local development
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	poolHealthy := checkServiceHealth(ctx, accountPoolURL, "Account Pool")
	if poolHealthy {
		// Check pool info
		checkPoolInfo(ctx, accountPoolURL)
	}
	fmt.Println()

	// Check 3: Simulation Service
	fmt.Println("--- Check 3: Simulation Service ---")
	simulationURL := os.Getenv("NEOSIMULATION_SERVICE_URL")
	if simulationURL == "" {
		simulationURL = "http://localhost:8082" // Default for local development
	}

	simHealthy := checkServiceHealth(ctx, simulationURL, "Simulation")
	if simHealthy {
		// Check simulation status
		checkSimulationStatus(ctx, simulationURL)
	}
	fmt.Println()

	// Summary
	fmt.Println("=== Summary ===")
	if !paymentHubSet {
		fmt.Println("❌ PaymentHub hash not configured - MiniApp simulator DISABLED")
	} else {
		fmt.Println("✅ PaymentHub hash configured (pricefeed/randomness optional)")
	}

	if !poolHealthy {
		fmt.Println("❌ Account Pool service not reachable")
	} else {
		fmt.Println("✅ Account Pool service healthy")
	}

	if !simHealthy {
		fmt.Println("❌ Simulation service not reachable")
	} else {
		fmt.Println("✅ Simulation service healthy")
	}

	fmt.Println()
	fmt.Println("=== Recommendations ===")
	if !paymentHubSet {
		fmt.Println("1. Set the required contract hash environment variables")
		fmt.Println("   Example:")
		fmt.Println("   export CONTRACT_PAYMENTHUB_HASH=0x...")
		fmt.Println("   (Optional) export CONTRACT_PRICEFEED_HASH=0x...")
		fmt.Println("   (Optional) export CONTRACT_RANDOMNESSLOG_HASH=0x...")
	}
	if !poolHealthy {
		fmt.Println("2. Start the Account Pool service")
	}
	if !simHealthy {
		fmt.Println("3. Start the Simulation service")
	}
	if paymentHubSet && poolHealthy && simHealthy {
		fmt.Println("All checks passed! If MiniApp transactions are still not working:")
		fmt.Println("1. Check the simulation service logs for errors")
		fmt.Println("2. Verify pool accounts have sufficient GAS balance")
		fmt.Println("3. Ensure SIMULATION_ENABLED=true or call POST /start")
	}
}

func checkServiceHealth(ctx context.Context, baseURL, serviceName string) bool {
	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/health", nil)
	if err != nil {
		fmt.Printf("❌ %s Service: Failed to create request: %v\n", serviceName, err)
		return false
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ %s Service: Not reachable at %s: %v\n", serviceName, baseURL, err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		fmt.Printf("✅ %s Service: Healthy at %s\n", serviceName, baseURL)
		return true
	}

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("❌ %s Service: Unhealthy (status %d): %s\n", serviceName, resp.StatusCode, string(body))
	return false
}

func checkPoolInfo(ctx context.Context, baseURL string) {
	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/pool-info", nil)
	if err != nil {
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	var info map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return
	}

	fmt.Printf("   Pool Info:\n")
	if total, ok := info["total_accounts"]; ok {
		fmt.Printf("   - Total Accounts: %v\n", total)
	}
	if available, ok := info["available_accounts"]; ok {
		fmt.Printf("   - Available Accounts: %v\n", available)
	}
	if locked, ok := info["locked_accounts"]; ok {
		fmt.Printf("   - Locked Accounts: %v\n", locked)
	}
}

func checkSimulationStatus(ctx context.Context, baseURL string) {
	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/status", nil)
	if err != nil {
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	var status map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return
	}

	fmt.Printf("   Simulation Status:\n")
	if running, ok := status["running"]; ok {
		if running.(bool) {
			fmt.Printf("   - Running: ✅ YES\n")
		} else {
			fmt.Printf("   - Running: ❌ NO (call POST /start to begin)\n")
		}
	}
	if contractInvoker, ok := status["contract_invoker"]; ok {
		if contractInvoker.(bool) {
			fmt.Printf("   - Contract Invoker: ✅ Enabled\n")
		} else {
			fmt.Printf("   - Contract Invoker: ❌ Disabled (check env vars)\n")
		}
	}
	if miniappSim, ok := status["miniapp_simulator"]; ok {
		if miniappSim.(bool) {
			fmt.Printf("   - MiniApp Simulator: ✅ Enabled\n")
		} else {
			fmt.Printf("   - MiniApp Simulator: ❌ Disabled (check env vars)\n")
		}
	}
	if txCounts, ok := status["tx_counts"].(map[string]interface{}); ok {
		fmt.Printf("   - Transaction Counts:\n")
		for app, count := range txCounts {
			fmt.Printf("     - %s: %v\n", app, count)
		}
	}
}
