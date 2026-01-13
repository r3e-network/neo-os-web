//go:build ignore

// Broadcast Edge intents (pay-gas + vote-bneo) to Neo N3 testnet.
// Uses Edge to fetch invocation payloads and then signs/broadcasts them.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

type edgeInvocation struct {
	ContractAddress string             `json:"contract_address"`
	Method       string                `json:"method"`
	Params       []chain.ContractParam `json:"params"`
}

type edgeResponse struct {
	RequestID  string         `json:"request_id"`
	Intent     string         `json:"intent"`
	Invocation edgeInvocation `json:"invocation"`
}

func main() {
	edgeURL := strings.TrimRight(getEnv("EDGE_URL", "http://localhost:8787/functions/v1"), "/")
	edgeKey := strings.TrimSpace(os.Getenv("EDGE_API_KEY"))
	edgeToken := strings.TrimSpace(os.Getenv("EDGE_BEARER_TOKEN"))
	if edgeKey == "" && edgeToken == "" {
		fmt.Println("EDGE_API_KEY or EDGE_BEARER_TOKEN is required")
		os.Exit(1)
	}

	appID := getEnv("APP_ID", "local-test-app")
	payAmount := getEnv("PAY_AMOUNT_GAS", "0.001")
	voteAmount := getEnv("VOTE_AMOUNT_BNEO", "1")
	proposalID := strings.TrimSpace(os.Getenv("VOTE_PROPOSAL_ID"))
	chainID := getEnv("CHAIN_ID", "neo-n3-testnet")

	rpcURL := getEnv("NEO_RPC_URL", "https://testnet1.neo.coz.io:443")
	networkMagic := uint32(894710606)
	if raw := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); raw != "" {
		if parsed, err := strconv.ParseUint(raw, 10, 32); err == nil {
			networkMagic = uint32(parsed)
		}
	}

	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fmt.Println("NEO_TESTNET_WIF is required")
		os.Exit(1)
	}

	account, err := chain.AccountFromWIF(wif)
	if err != nil {
		fmt.Printf("Invalid WIF: %v\n", err)
		os.Exit(1)
	}
	senderHash := "0x" + account.ScriptHash().StringLE()

	client, err := chain.NewClient(chain.Config{
		RPCURL:    rpcURL,
		NetworkID: networkMagic,
	})
	if err != nil {
		fmt.Printf("Failed to create chain client: %v\n", err)
		os.Exit(1)
	}

	ctx := context.Background()

	fmt.Println("=== Edge pay-gas ===")
	if err := ensurePaymentHubApp(ctx, client, account, appID); err != nil {
		fmt.Printf("configure app failed: %v\n", err)
		os.Exit(1)
	}
	payIntent, err := fetchIntent(edgeURL+"/pay-gas", edgeKey, edgeToken, map[string]any{
		"app_id":     appID,
		"amount_gas": payAmount,
		"memo":       "edge-pay-gas",
		"chain_id":   chainID,
	})
	if err != nil {
		fmt.Printf("pay-gas failed: %v\n", err)
		os.Exit(1)
	}
	replaceSender(payIntent.Invocation.Params, senderHash)
	payTx, err := invokeAndBroadcast(ctx, client, account, payIntent.Invocation, transaction.Global, chain.ScopeGlobal)
	if err != nil {
		fmt.Printf("pay-gas broadcast failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("pay-gas tx: %s (%s)\n", payTx.TxHash, payTx.VMState)

	fmt.Println("\n=== Edge vote-bneo ===")
	if proposalID == "" {
		proposalID = fmt.Sprintf("edge-proposal-%d", time.Now().Unix())
		if err := ensureProposal(ctx, client, account, proposalID); err != nil {
			fmt.Printf("create proposal failed: %v\n", err)
			os.Exit(1)
		}
	}
	if err := ensureStake(ctx, client, account, voteAmount); err != nil {
		fmt.Printf("stake failed: %v\n", err)
		os.Exit(1)
	}

	voteIntent, err := fetchIntent(edgeURL+"/vote-bneo", edgeKey, edgeToken, map[string]any{
		"app_id":      appID,
		"proposal_id": proposalID,
		"bneo_amount": voteAmount,
		"support":     true,
		"chain_id":    chainID,
	})
	if err != nil {
		fmt.Printf("vote-bneo failed: %v\n", err)
		os.Exit(1)
	}
	voteTx, err := invokeAndBroadcast(ctx, client, account, voteIntent.Invocation, transaction.CalledByEntry, chain.ScopeCalledByEntry)
	if err != nil {
		fmt.Printf("vote-bneo broadcast failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("vote-bneo tx: %s (%s)\n", voteTx.TxHash, voteTx.VMState)
}

func getEnv(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}

func fetchIntent(url, apiKey string, bearer string, payload map[string]any) (*edgeResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	} else {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := ioReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("edge error (%d): %s", resp.StatusCode, string(raw))
	}

	var out edgeResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func replaceSender(params []chain.ContractParam, sender string) {
	for i := range params {
		if strings.EqualFold(params[i].Type, "Hash160") {
			if v, ok := params[i].Value.(string); ok && strings.EqualFold(v, "SENDER") {
				params[i].Value = sender
			}
		}
	}
}

func invokeAndBroadcast(
	ctx context.Context,
	client *chain.Client,
	account chain.TxSigner,
	inv edgeInvocation,
	scope transaction.WitnessScope,
	simScope string,
) (*chain.TxResult, error) {
	invokeResult, err := client.InvokeFunctionWithScope(ctx, inv.ContractAddress, inv.Method, inv.Params, account.ScriptHash(), simScope)
	if err != nil {
		return nil, fmt.Errorf("simulate %s: %w", inv.Method, err)
	}
	if invokeResult.State != "HALT" {
		return nil, fmt.Errorf("%s simulation failed: %s", inv.Method, invokeResult.Exception)
	}

	txBuilder := chain.NewTxBuilder(client, client.NetworkID())
	tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, account, scope)
	if err != nil {
		return nil, fmt.Errorf("build %s: %w", inv.Method, err)
	}

	txHash, err := txBuilder.BroadcastTx(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("broadcast %s: %w", inv.Method, err)
	}
	result := &chain.TxResult{TxHash: "0x" + txHash.StringLE(), VMState: invokeResult.State}

	waitCtx, cancel := context.WithTimeout(ctx, chain.DefaultTxWaitTimeout)
	defer cancel()
	if appLog, err := client.WaitForApplicationLog(waitCtx, result.TxHash, chain.DefaultPollInterval); err == nil {
		result.AppLog = appLog
		if len(appLog.Executions) > 0 {
			result.VMState = appLog.Executions[0].VMState
		}
	}
	return result, nil
}

func ensureProposal(ctx context.Context, client *chain.Client, account chain.TxSigner, proposalID string) error {
	start := time.Now().Add(-60 * time.Second).UnixMilli()
	end := time.Now().Add(2 * time.Hour).UnixMilli()
	params := []chain.ContractParam{
		chain.NewStringParam(proposalID),
		chain.NewStringParam("edge-generated proposal"),
		chain.NewIntegerParam(bigInt(start)),
		chain.NewIntegerParam(bigInt(end)),
	}
	_, err := invokeAndBroadcast(ctx, client, account, edgeInvocation{
		ContractAddress: mustEnv("CONTRACT_GOVERNANCE_ADDRESS"),
		Method:       "createProposal",
		Params:       params,
	}, transaction.CalledByEntry, chain.ScopeCalledByEntry)
	return err
}

func ensureStake(ctx context.Context, client *chain.Client, account chain.TxSigner, amount string) error {
	stake, err := chain.InvokeInt(ctx, client, mustEnv("CONTRACT_GOVERNANCE_ADDRESS"), "getStake", chain.NewHash160Param("0x"+account.ScriptHash().StringLE()))
	if err != nil {
		return fmt.Errorf("getStake: %w", err)
	}
	amt, err := strconv.ParseInt(amount, 10, 64)
	if err != nil || amt <= 0 {
		return fmt.Errorf("invalid VOTE_AMOUNT_BNEO: %s", amount)
	}
	if stake != nil && stake.Int64() >= amt {
		return nil
	}
	_, err = invokeAndBroadcast(ctx, client, account, edgeInvocation{
		ContractAddress: mustEnv("CONTRACT_GOVERNANCE_ADDRESS"),
		Method:       "stake",
		Params:       []chain.ContractParam{chain.NewIntegerParam(bigInt(amt))},
	}, transaction.CalledByEntry, chain.ScopeCalledByEntry)
	return err
}

func ensurePaymentHubApp(ctx context.Context, client *chain.Client, account chain.TxSigner, appID string) error {
	ownerHash := "0x" + account.ScriptHash().StringLE()
	params := []chain.ContractParam{
		chain.NewStringParam(appID),
		chain.NewHash160Param(ownerHash),
		{
			Type:  "Array",
			Value: []chain.ContractParam{chain.NewHash160Param(ownerHash)},
		},
		{
			Type:  "Array",
			Value: []chain.ContractParam{chain.NewIntegerParam(big.NewInt(10000))},
		},
		chain.NewBoolParam(true),
	}
	_, err := invokeAndBroadcast(ctx, client, account, edgeInvocation{
		ContractAddress: mustEnv("CONTRACT_PAYMENT_HUB_ADDRESS"),
		Method:       "configureApp",
		Params:       params,
	}, transaction.CalledByEntry, chain.ScopeCalledByEntry)
	return err
}

func mustEnv(key string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		fmt.Printf("missing required env: %s\n", key)
		os.Exit(1)
	}
	return val
}

func bigInt(v int64) *big.Int {
	return big.NewInt(v)
}

func ioReadAll(r io.Reader) ([]byte, error) {
	buf := new(bytes.Buffer)
	_, err := buf.ReadFrom(r)
	return buf.Bytes(), err
}
