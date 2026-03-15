//go:build ignore

package main

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/neorpc/result"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const defaultRPC = "https://testnet1.neo.coz.io:443"

const (
	requestStatusPending   = 0
	requestStatusFulfilled = 1
	requestStatusFailed    = 2
)

type gatewayRequest struct {
	RequestID   string
	AppID       string
	ServiceType string
	Status      int64
	Success     bool
	Result      []byte
	Error       string
	FulfilledAt *big.Int
}

func main() {
	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fmt.Println("NEO_TESTNET_WIF environment variable not set")
		os.Exit(1)
	}

	gatewayHashRaw := strings.TrimSpace(os.Getenv("CONTRACT_SERVICEGATEWAY_HASH"))
	if gatewayHashRaw == "" {
		fmt.Println("CONTRACT_SERVICEGATEWAY_HASH environment variable not set")
		os.Exit(1)
	}

	callbackContractRaw := resolveCallbackContractHash()
	if callbackContractRaw == "" {
		fmt.Println("MiniApp callback contract hash not set (MINIAPP_CALLBACK_CONTRACT_HASH or MINIAPP_CONSUMER_HASH)")
		os.Exit(1)
	}

	callbackMethod := strings.TrimSpace(os.Getenv("MINIAPP_CALLBACK_METHOD"))
	if callbackMethod == "" {
		callbackMethod = "onServiceCallback"
	}

	appID := strings.TrimSpace(os.Getenv("MINIAPP_APP_ID"))
	if appID == "" {
		appID = "miniapp-lottery"
	}

	serviceType := strings.ToLower(strings.TrimSpace(os.Getenv("MINIAPP_SERVICE_TYPE")))
	if serviceType == "" {
		serviceType = "oracle"
	}

	payload := strings.TrimSpace(os.Getenv("MINIAPP_SERVICE_PAYLOAD"))
	if payload == "" {
		payload = defaultPayload(serviceType)
	}

	rpcURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcURL == "" {
		rpcURL = defaultRPC
	}

	privateKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("Invalid WIF: %v\n", err)
		os.Exit(1)
	}

	gatewayHash, err := parseHash160(gatewayHashRaw)
	if err != nil {
		fmt.Printf("Invalid ServiceGateway hash: %v\n", err)
		os.Exit(1)
	}

	callbackContract, err := parseHash160(callbackContractRaw)
	if err != nil {
		fmt.Printf("Invalid MiniApp callback contract hash: %v\n", err)
		os.Exit(1)
	}

	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		fmt.Printf("Failed to create RPC client: %v\n", err)
		os.Exit(1)
	}

	acc := wallet.NewAccountFromPrivateKey(privateKey)
	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("Failed to create actor: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== MiniApp Service Request (via ServiceLayerGateway) ===")
	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Caller: %s\n", address.Uint160ToString(privateKey.GetScriptHash()))
	fmt.Printf("ServiceGateway: 0x%s\n", gatewayHash.StringLE())
	fmt.Printf("Callback Contract: 0x%s\n", callbackContract.StringLE())
	fmt.Printf("Callback Method: %s\n", callbackMethod)
	fmt.Printf("App ID: %s\n", appID)
	fmt.Printf("Service Type: %s\n", serviceType)
	fmt.Printf("Payload: %s\n", payload)

	payloadBytes := []byte(payload)
	if payload == "null" {
		payloadBytes = []byte{}
	}

	testResult, err := act.Call(gatewayHash, "requestService", appID, serviceType, payloadBytes, callbackContract, callbackMethod)
	if err != nil {
		fmt.Printf("Test invoke failed: %v\n", err)
		os.Exit(1)
	}
	if testResult.State != "HALT" {
		fmt.Printf("Test invoke failed: %s (fault: %s)\n", testResult.State, testResult.FaultException)
		os.Exit(1)
	}

	txHash, vub, err := act.SendCall(gatewayHash, "requestService", appID, serviceType, payloadBytes, callbackContract, callbackMethod)
	if err != nil {
		fmt.Printf("Send failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Transaction sent: %s (vub %d)\n", txHash.StringLE(), vub)

	appLog, err := waitForAppLog(ctx, client, txHash)
	if err != nil {
		fmt.Printf("Failed to confirm tx: %v\n", err)
		os.Exit(1)
	}

	requestID := extractRequestID(appLog)
	if requestID != "" {
		fmt.Printf("✅ ServiceRequested request_id: %s\n", requestID)
	} else {
		fmt.Println("⚠️  ServiceRequested event not found in application log")
	}

	if requestID != "" && parseEnvBool("MINIAPP_WAIT_CALLBACK") {
		timeout := parseEnvDuration("MINIAPP_CALLBACK_TIMEOUT_SECONDS", 180*time.Second)
		fmt.Printf("Waiting for gateway fulfillment (timeout: %s)...\n", timeout)
		req, err := waitForGatewayFulfillment(ctx, act, gatewayHash, requestID, timeout)
		if err != nil {
			fmt.Printf("❌ Fulfillment wait failed: %v\n", err)
			os.Exit(1)
		}
		printGatewayRequest(req)
		if req.Status == requestStatusFailed || !req.Success {
			fmt.Println("❌ Request fulfilled with failure")
			os.Exit(1)
		}
	}
}

func resolveCallbackContractHash() string {
	for _, key := range []string{
		"MINIAPP_CALLBACK_CONTRACT_HASH",
		"MINIAPP_CONSUMER_HASH",
		"MINIAPP_CONTRACT_HASH",
		"CONTRACT_MINIAPP_CONSUMER_HASH",
	} {
		if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
			return raw
		}
	}
	return ""
}

func parseHash160(raw string) (util.Uint160, error) {
	raw = strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringBE(raw)
}

func waitForAppLog(ctx context.Context, client *rpcclient.Client, txHash util.Uint256) (*result.ApplicationLog, error) {
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

func extractRequestID(appLog *result.ApplicationLog) string {
	if appLog == nil {
		return ""
	}

	for _, exec := range appLog.Executions {
		if !exec.VMState.HasFlag(1) {
			continue
		}
		for _, evt := range exec.Events {
			if evt.Name != "ServiceRequested" || evt.Item == nil {
				continue
			}
			items, ok := evt.Item.Value().([]stackitem.Item)
			if !ok || len(items) == 0 {
				continue
			}
			reqID, err := items[0].TryInteger()
			if err == nil {
				return reqID.String()
			}
		}
	}
	return ""
}

func waitForGatewayFulfillment(ctx context.Context, act *actor.Actor, gateway util.Uint160, requestID string, timeout time.Duration) (*gatewayRequest, error) {
	reqNum, ok := new(big.Int).SetString(requestID, 10)
	if !ok {
		return nil, fmt.Errorf("invalid request id: %s", requestID)
	}

	ticker := time.NewTicker(4 * time.Second)
	defer ticker.Stop()
	deadline := time.After(timeout)

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-deadline:
			return nil, fmt.Errorf("timeout waiting for fulfillment")
		case <-ticker.C:
			req, err := fetchGatewayRequest(act, gateway, reqNum)
			if err != nil {
				continue
			}
			if req == nil {
				continue
			}
			if req.Status != requestStatusPending {
				return req, nil
			}
		}
	}
}

func fetchGatewayRequest(act *actor.Actor, gateway util.Uint160, requestID *big.Int) (*gatewayRequest, error) {
	res, err := act.Call(gateway, "getRequest", requestID)
	if err != nil {
		return nil, err
	}
	if res.State != "HALT" || len(res.Stack) == 0 {
		return nil, fmt.Errorf("getRequest failed: %s", res.State)
	}

	items, ok := res.Stack[0].Value().([]stackitem.Item)
	if !ok || len(items) < 13 {
		return nil, fmt.Errorf("unexpected getRequest payload")
	}

	id, err := items[0].TryInteger()
	if err != nil {
		return nil, fmt.Errorf("invalid request id payload")
	}
	appID, _ := itemToString(items[1])
	serviceType, _ := itemToString(items[2])
	status, err := items[7].TryInteger()
	if err != nil {
		return nil, fmt.Errorf("invalid request status payload")
	}
	fulfilledAt, _ := items[9].TryInteger()
	success, _ := items[10].TryBool()
	resultBytes, _ := items[11].TryBytes()
	errMsg, _ := itemToString(items[12])

	return &gatewayRequest{
		RequestID:   id.String(),
		AppID:       appID,
		ServiceType: serviceType,
		Status:      status.Int64(),
		Success:     success,
		Result:      resultBytes,
		Error:       errMsg,
		FulfilledAt: fulfilledAt,
	}, nil
}

func itemToString(item stackitem.Item) (string, error) {
	bytes, err := item.TryBytes()
	if err != nil {
		return "", fmt.Errorf("string decode failed")
	}
	return string(bytes), nil
}

func printGatewayRequest(req *gatewayRequest) {
	if req == nil {
		return
	}

	resultHex := ""
	if len(req.Result) > 0 {
		resultHex = hex.EncodeToString(req.Result)
	}

	status := "PENDING"
	switch req.Status {
	case requestStatusFulfilled:
		status = "FULFILLED"
	case requestStatusFailed:
		status = "FAILED"
	}

	fmt.Println("=== Gateway Request Status ===")
	fmt.Printf("Request ID: %s\n", req.RequestID)
	fmt.Printf("App ID: %s\n", req.AppID)
	fmt.Printf("Service: %s\n", req.ServiceType)
	fmt.Printf("Status: %s\n", status)
	fmt.Printf("Success: %t\n", req.Success)
	if req.Error != "" {
		fmt.Printf("Error: %s\n", req.Error)
	}
	if resultHex != "" {
		fmt.Printf("Result (hex): %s\n", resultHex)
	}
	if req.FulfilledAt != nil {
		fmt.Printf("Fulfilled At: %s\n", req.FulfilledAt.String())
	}
}

func defaultPayload(serviceType string) string {
	switch serviceType {
	case "oracle":
		return `{"url":"https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT","json_path":"price"}`
	case "compute":
		return `{"script":"function main(){return {ok:true,sum:input.a+input.b};}","entry_point":"main","input":{"a":2,"b":3}}`
	case "rng":
		return ""
	default:
		return ""
	}
}

func parseEnvBool(key string) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return false
	}
	switch strings.ToLower(raw) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func parseEnvDuration(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err == nil {
		return parsed
	}
	if seconds, err := time.ParseDuration(raw + "s"); err == nil {
		return seconds
	}
	return fallback
}
