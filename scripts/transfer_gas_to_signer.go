//go:build scripts

// Transfer GAS from the deployer wallet to a target address (e.g., GlobalSigner).
package main

import (
	"context"
	"fmt"
	"math"
	"math/big"
	"os"
	"strconv"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

const (
	defaultRPC      = "https://testnet1.neo.coz.io:443"
	defaultGasHash  = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	defaultRecipient = "NRhqS1Bvdi8rZb2T24uWdPtEdNHc4Pavv7"
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

	toAddress := strings.TrimSpace(os.Getenv("GAS_TRANSFER_TO"))
	if toAddress == "" {
		toAddress = defaultRecipient
	}

	amountStr := strings.TrimSpace(os.Getenv("GAS_TRANSFER_AMOUNT"))
	if amountStr == "" {
		amountStr = "100"
	}

	amountGas, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amountGas <= 0 {
		fmt.Printf("Invalid GAS_TRANSFER_AMOUNT: %s\n", amountStr)
		os.Exit(1)
	}

	amountFractions := int64(math.Round(amountGas * 1e8))
	if amountFractions <= 0 {
		fmt.Println("Transfer amount too small")
		os.Exit(1)
	}

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: 894710606,
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
}
