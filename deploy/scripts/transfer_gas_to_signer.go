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
	"fmt"
	"math"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
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

	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		fmt.Printf("Failed to create RPC client: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	privateKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("Failed to create signer: %v\n", err)
		os.Exit(1)
	}
	signer := wallet.NewAccountFromPrivateKey(privateKey)

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

	act, err := actor.New(client, []actor.SignerAccount{{
		Signer: transaction.Signer{
			Account: signer.ScriptHash(),
			Scopes:  transaction.CalledByEntry,
		},
		Account: signer,
	}})
	if err != nil {
		fmt.Printf("Failed to create actor: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Sending %.8f GAS from %s to %s\n", amountGas, signer.Address, toAddress)

	gasHash, err := parseHash160(defaultGasHash)
	if err != nil {
		fmt.Printf("Invalid GAS contract hash: %v\n", err)
		os.Exit(1)
	}
	testResult, err := act.Call(gasHash, "transfer", fromHash, toHash, amountFractions, nil)
	if err != nil {
		fmt.Printf("Transfer simulation failed: %v\n", err)
		os.Exit(1)
	}
	if testResult.State != "HALT" {
		fmt.Printf("Transfer simulation faulted: %s\n", testResult.FaultException)
		os.Exit(1)
	}
	txHash, _, err := act.SendCall(gasHash, "transfer", fromHash, toHash, amountFractions, nil)
	if err != nil {
		fmt.Printf("Transfer failed: %v\n", err)
		os.Exit(1)
	}
	if _, err := waitForAppLog(ctx, client, txHash); err != nil {
		fmt.Printf("Failed waiting for confirmation: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✅ Transfer confirmed: 0x%s\n", txHash.StringLE())

	newBalanceFractions, err := getGASBalance(ctx, client, toAddress)
	if err == nil {
		fmt.Printf("Recipient balance: %.8f GAS -> %.8f GAS\n", currentBalanceGas, float64(newBalanceFractions)/1e8)
	}
}

func parseHash160(raw string) (util.Uint160, error) {
	raw = strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(raw)
}

func waitForAppLog(ctx context.Context, client *rpcclient.Client, txHash util.Uint256) (any, error) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	timeout := time.After(2 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timeout:
			return nil, fmt.Errorf("timeout waiting for application log")
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
				return nil, fmt.Errorf("transaction failed: %s", exec.FaultException)
			}
			return appLog, nil
		}
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

func getGASBalance(ctx context.Context, client *rpcclient.Client, addr string) (int64, error) {
	recipient, err := address.StringToUint160(addr)
	if err != nil {
		return 0, err
	}
	result, err := client.GetNEP17Balances(recipient)
	if err != nil {
		return 0, err
	}

	gasHash := strings.TrimPrefix(defaultGasHash, "0x")
	for _, bal := range result.Balances {
		hash := strings.TrimPrefix(bal.Asset.StringLE(), "0x")
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
