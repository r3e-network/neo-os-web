//go:build scripts

// Transfer GAS from the deployer wallet to a target signer (e.g., txproxy).
//
// Recipient resolution order:
//  1. GAS_TRANSFER_TO
//  2. TXPROXY_SIGNER_ADDRESS
//  3. Auto-detect from `docker logs service-txproxy`
//  4. Legacy default (only when GAS_TRANSFER_USE_LEGACY_DEFAULT=true)
//
// Safety:
//   - Skips transfer when recipient balance >= GAS_TRANSFER_MIN_BALANCE
//   - Override skip behavior with FORCE_GAS_TRANSFER=true
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
)

const (
	defaultRPC              = "https://testnet1.neo.coz.io:443"
	defaultGasHash          = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	defaultRecipient        = "NRhqS1Bvdi8rZb2T24uWdPtEdNHc4Pavv7"
	defaultGasTransfer      = "100"
	defaultMinBalance       = "30"
	defaultNetworkMagic     = uint32(894710606)
	defaultTxProxyContainer = "service-txproxy"
)

func main() {
	ctx := context.Background()

	rpcURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcURL == "" {
		rpcURL = defaultRPC
	}

	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fmt.Println("NEO_TESTNET_WIF environment variable not set")
		os.Exit(1)
	}

	toAddress := resolveRecipientAddress()
	if toAddress == "" {
		fmt.Println("Recipient address not found.")
		fmt.Println("Set GAS_TRANSFER_TO (or TXPROXY_SIGNER_ADDRESS), or ensure txproxy logs are available for auto-detection.")
		fmt.Println("If you really want the legacy default recipient, set GAS_TRANSFER_USE_LEGACY_DEFAULT=true.")
		os.Exit(1)
	}

	amountStr := strings.TrimSpace(os.Getenv("GAS_TRANSFER_AMOUNT"))
	if amountStr == "" {
		amountStr = defaultGasTransfer
	}

	amountGas, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amountGas <= 0 {
		fmt.Printf("Invalid GAS_TRANSFER_AMOUNT: %s\n", amountStr)
		os.Exit(1)
	}

	minBalanceStr := strings.TrimSpace(os.Getenv("GAS_TRANSFER_MIN_BALANCE"))
	if minBalanceStr == "" {
		minBalanceStr = defaultMinBalance
	}

	minBalanceGas, err := strconv.ParseFloat(minBalanceStr, 64)
	if err != nil || minBalanceGas < 0 {
		fmt.Printf("Invalid GAS_TRANSFER_MIN_BALANCE: %s\n", minBalanceStr)
		os.Exit(1)
	}

	amountFractions := int64(math.Round(amountGas * 1e8))
	if amountFractions <= 0 {
		fmt.Println("Transfer amount too small")
		os.Exit(1)
	}

	networkMagic := defaultNetworkMagic
	if raw := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); raw != "" {
		parsed, parseErr := strconv.ParseUint(raw, 10, 32)
		if parseErr != nil {
			fmt.Printf("Invalid NEO_NETWORK_MAGIC: %s\n", raw)
			os.Exit(1)
		}
		networkMagic = uint32(parsed)
	}

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: networkMagic,
	})
	if err != nil {
		fmt.Printf("Failed to create chain client: %v\n", err)
		os.Exit(1)
	}

	signer, err := chain.AccountFromWIF(wif)
	if err != nil {
		fmt.Printf("Failed to create signer: %v\n", err)
		os.Exit(1)
	}

	toHash, err := address.StringToUint160(toAddress)
	if err != nil {
		fmt.Printf("Invalid recipient address: %v\n", err)
		os.Exit(1)
	}

	currentBalanceFractions, err := getGASBalance(ctx, client, toAddress)
	if err != nil {
		fmt.Printf("Failed to query recipient balance: %v\n", err)
		os.Exit(1)
	}

	currentBalanceGas := float64(currentBalanceFractions) / 1e8
	if currentBalanceGas >= minBalanceGas && !envBool("FORCE_GAS_TRANSFER") {
		fmt.Printf(
			"Recipient %s already has %.8f GAS (min required %.8f GAS). Skipping transfer.\n",
			toAddress,
			currentBalanceGas,
			minBalanceGas,
		)
		return
	}

	fromHash := signer.ScriptHash()

	params := []chain.ContractParam{
		chain.NewHash160Param("0x" + fromHash.StringLE()),
		chain.NewHash160Param("0x" + toHash.StringLE()),
		chain.NewIntegerParam(big.NewInt(amountFractions)),
		chain.NewAnyParam(),
	}

	fmt.Printf("Sending %.8f GAS from %s to %s\n", amountGas, signer.Address, toAddress)

	result, err := client.InvokeFunctionWithSignerAndWait(
		ctx,
		defaultGasHash,
		"transfer",
		params,
		signer,
		transaction.CalledByEntry,
		true,
	)
	if err != nil {
		fmt.Printf("Transfer failed: %v\n", err)
		os.Exit(1)
	}

	if result.VMState != "HALT" {
		fmt.Printf("Transfer VMState: %s\n", result.VMState)
		if result.AppLog != nil && len(result.AppLog.Executions) > 0 {
			fmt.Printf("Exception: %s\n", result.AppLog.Executions[0].Exception)
		}
		os.Exit(1)
	}

	fmt.Printf("✅ Transfer confirmed: %s\n", result.TxHash)

	newBalanceFractions, err := getGASBalance(ctx, client, toAddress)
	if err == nil {
		fmt.Printf("Recipient balance: %.8f GAS -> %.8f GAS\n", currentBalanceGas, float64(newBalanceFractions)/1e8)
	}
}

func resolveRecipientAddress() string {
	if explicit := strings.TrimSpace(os.Getenv("GAS_TRANSFER_TO")); explicit != "" {
		return explicit
	}
	if explicit := strings.TrimSpace(os.Getenv("TXPROXY_SIGNER_ADDRESS")); explicit != "" {
		return explicit
	}

	if detected, ok := detectTxproxySignerAddress(); ok {
		fmt.Printf("Auto-detected txproxy signer address: %s\n", detected)
		return detected
	}

	if envBool("GAS_TRANSFER_USE_LEGACY_DEFAULT") {
		fmt.Printf("Using legacy default recipient: %s\n", defaultRecipient)
		return defaultRecipient
	}

	return ""
}

func detectTxproxySignerAddress() (string, bool) {
	container := strings.TrimSpace(os.Getenv("TXPROXY_CONTAINER_NAME"))
	if container == "" {
		container = defaultTxProxyContainer
	}

	re := regexp.MustCompile(`"signer_address":"([A-Za-z0-9]+)"`)

	tails := []string{"300", "2000", "10000"}
	for _, tail := range tails {
		cmd := exec.Command("docker", "logs", "--tail", tail, container)
		out, err := cmd.CombinedOutput()
		if err != nil {
			continue
		}

		matches := re.FindAllStringSubmatch(string(out), -1)
		if len(matches) == 0 {
			continue
		}
		last := matches[len(matches)-1]
		if len(last) < 2 {
			continue
		}

		address := strings.TrimSpace(last[1])
		if address == "" {
			continue
		}
		return address, true
	}
	return "", false
}

func envBool(key string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

type nep17Balance struct {
	AssetHash string `json:"assethash"`
	Amount    string `json:"amount"`
}

type nep17BalancesResult struct {
	Balance []nep17Balance `json:"balance"`
}

func getGASBalance(ctx context.Context, client *chain.Client, addr string) (int64, error) {
	result, err := client.Call(ctx, "getnep17balances", []interface{}{addr})
	if err != nil {
		return 0, err
	}

	var balances nep17BalancesResult
	if err := json.Unmarshal(result, &balances); err != nil {
		return 0, fmt.Errorf("unmarshal balances: %w", err)
	}

	gasHash := strings.TrimPrefix(defaultGasHash, "0x")
	for _, bal := range balances.Balance {
		hash := strings.TrimPrefix(bal.AssetHash, "0x")
		if !strings.EqualFold(hash, gasHash) {
			continue
		}
		amount, parseErr := strconv.ParseInt(bal.Amount, 10, 64)
		if parseErr != nil {
			return 0, fmt.Errorf("parse amount: %w", parseErr)
		}
		return amount, nil
	}
	return 0, nil
}
