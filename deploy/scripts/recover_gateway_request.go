//go:build ignore

package main

import (
	"context"
	"encoding/hex"
	"flag"
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
	requestStatusPending   int64 = 0
	requestStatusFulfilled int64 = 1
	requestStatusFailed    int64 = 2
)

type options struct {
	WIF          string
	RPCURL       string
	GatewayHash  string
	RequestIDRaw string
	ErrorMessage string
	DryRun       bool
	WaitTimeout  time.Duration
}

type txReceipt struct {
	TxHash util.Uint256
	VUB    uint32
}

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
	if err := run(); err != nil {
		fmt.Printf("ERROR: %v\n", err)
		os.Exit(1)
	}
}

func run() (runErr error) {
	opts, err := parseOptions()
	if err != nil {
		return err
	}

	privateKey, err := keys.NewPrivateKeyFromWIF(opts.WIF)
	if err != nil {
		return fmt.Errorf("invalid WIF: %w", err)
	}

	gatewayHash, err := parseHash160(opts.GatewayHash)
	if err != nil {
		return fmt.Errorf("invalid gateway hash: %w", err)
	}

	requestID, ok := new(big.Int).SetString(opts.RequestIDRaw, 10)
	if !ok || requestID.Sign() <= 0 {
		return fmt.Errorf("invalid request ID: %s", opts.RequestIDRaw)
	}

	ctx := context.Background()
	client, err := rpcclient.New(ctx, opts.RPCURL, rpcclient.Options{})
	if err != nil {
		return fmt.Errorf("create RPC client: %w", err)
	}
	defer client.Close()

	acc := wallet.NewAccountFromPrivateKey(privateKey)
	act, err := actor.NewSimple(client, acc)
	if err != nil {
		return fmt.Errorf("create actor: %w", err)
	}

	caller := privateKey.GetScriptHash()

	admin, err := callHash160(act, gatewayHash, "admin")
	if err != nil {
		return fmt.Errorf("read gateway admin: %w", err)
	}
	updater, err := callHash160(act, gatewayHash, "updater")
	if err != nil {
		return fmt.Errorf("read gateway updater: %w", err)
	}

	requestBefore, err := fetchGatewayRequest(act, gatewayHash, requestID)
	if err != nil {
		return fmt.Errorf("read gateway request: %w", err)
	}

	fmt.Println("=== ServiceGateway Request Recovery ===")
	fmt.Printf("RPC: %s\n", opts.RPCURL)
	fmt.Printf("Gateway: 0x%s\n", gatewayHash.StringLE())
	fmt.Printf("Caller: %s\n", address.Uint160ToString(caller))
	fmt.Printf("Admin: %s\n", address.Uint160ToString(admin))
	fmt.Printf("Updater: %s\n", address.Uint160ToString(updater))
	fmt.Printf("Dry run: %t\n", opts.DryRun)
	printGatewayRequest("Before", requestBefore)

	if requestBefore == nil || requestBefore.RequestID == "0" {
		return fmt.Errorf("request %s not found", requestID.String())
	}

	if caller != admin {
		return fmt.Errorf("caller %s is not gateway admin %s", address.Uint160ToString(caller), address.Uint160ToString(admin))
	}

	if requestBefore.Status != requestStatusPending {
		fmt.Printf("Request %s already terminal (%s), no action required.\n", requestBefore.RequestID, statusLabel(requestBefore.Status))
		return nil
	}

	willSwitchUpdater := updater != admin
	if opts.DryRun {
		if willSwitchUpdater {
			fmt.Printf("Plan: setUpdater(%s), fulfillRequest(%s,false,\"\",%q), setUpdater(%s)\n",
				address.Uint160ToString(admin), requestID.String(), opts.ErrorMessage, address.Uint160ToString(updater))
		} else {
			fmt.Printf("Plan: fulfillRequest(%s,false,\"\",%q)\n", requestID.String(), opts.ErrorMessage)
		}
		return nil
	}

	restoreNeeded := false
	originalUpdater := updater
	defer func() {
		if !restoreNeeded {
			return
		}

		fmt.Printf("Restoring updater to %s...\n", address.Uint160ToString(originalUpdater))
		tx, restoreErr := sendCallAndWait(ctx, client, act, gatewayHash, opts.WaitTimeout, "setUpdater", originalUpdater)
		if restoreErr != nil {
			if runErr == nil {
				runErr = fmt.Errorf("restore updater: %w", restoreErr)
			} else {
				runErr = fmt.Errorf("%v; restore updater failed: %w", runErr, restoreErr)
			}
			return
		}
		fmt.Printf("Restored updater tx: %s (vub %d)\n", tx.TxHash.StringLE(), tx.VUB)

		afterRestore, checkErr := callHash160(act, gatewayHash, "updater")
		if checkErr != nil {
			if runErr == nil {
				runErr = fmt.Errorf("verify restored updater: %w", checkErr)
			} else {
				runErr = fmt.Errorf("%v; verify restored updater failed: %w", runErr, checkErr)
			}
			return
		}
		if afterRestore != originalUpdater {
			if runErr == nil {
				runErr = fmt.Errorf("restored updater mismatch: expected %s got %s", address.Uint160ToString(originalUpdater), address.Uint160ToString(afterRestore))
			} else {
				runErr = fmt.Errorf("%v; restored updater mismatch: expected %s got %s", runErr, address.Uint160ToString(originalUpdater), address.Uint160ToString(afterRestore))
			}
			return
		}
	}()

	if willSwitchUpdater {
		fmt.Printf("Temporarily setting updater to admin %s...\n", address.Uint160ToString(admin))
		tx, setErr := sendCallAndWait(ctx, client, act, gatewayHash, opts.WaitTimeout, "setUpdater", admin)
		if setErr != nil {
			return fmt.Errorf("set updater to admin: %w", setErr)
		}
		fmt.Printf("setUpdater tx: %s (vub %d)\n", tx.TxHash.StringLE(), tx.VUB)
		restoreNeeded = true

		updaterNow, checkErr := callHash160(act, gatewayHash, "updater")
		if checkErr != nil {
			return fmt.Errorf("verify updater switch: %w", checkErr)
		}
		if updaterNow != admin {
			return fmt.Errorf("updater switch mismatch: expected %s got %s", address.Uint160ToString(admin), address.Uint160ToString(updaterNow))
		}
	} else {
		fmt.Println("Updater already set to admin; no temporary switch required.")
	}

	fmt.Printf("Failing request %s with error %q...\n", requestID.String(), opts.ErrorMessage)
	fulfillTx, err := sendCallAndWait(ctx, client, act, gatewayHash, opts.WaitTimeout, "fulfillRequest", requestID, false, []byte{}, opts.ErrorMessage)
	if err != nil {
		return fmt.Errorf("fulfill request: %w", err)
	}
	fmt.Printf("fulfillRequest tx: %s (vub %d)\n", fulfillTx.TxHash.StringLE(), fulfillTx.VUB)

	requestAfter, err := fetchGatewayRequest(act, gatewayHash, requestID)
	if err != nil {
		return fmt.Errorf("read request after fulfill: %w", err)
	}
	printGatewayRequest("After", requestAfter)

	if requestAfter.Status != requestStatusFailed {
		return fmt.Errorf("unexpected request status: got %s, expected FAILED", statusLabel(requestAfter.Status))
	}
	if requestAfter.Success {
		return fmt.Errorf("unexpected request success=true after manual failure")
	}
	if requestAfter.Error != opts.ErrorMessage {
		return fmt.Errorf("unexpected request error: got %q expected %q", requestAfter.Error, opts.ErrorMessage)
	}

	fmt.Println("Recovery completed successfully.")
	return nil
}

func parseOptions() (*options, error) {
	rpcDefault := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcDefault == "" {
		rpcDefault = defaultRPC
	}

	errorDefault := strings.TrimSpace(os.Getenv("GATEWAY_RECOVERY_ERROR"))
	if errorDefault == "" {
		errorDefault = "manual recovery"
	}

	waitTimeoutDefault := parseEnvDuration("GATEWAY_RECOVERY_TIMEOUT", 2*time.Minute)

	requestID := flag.String("request-id", strings.TrimSpace(os.Getenv("GATEWAY_RECOVERY_REQUEST_ID")), "ServiceLayerGateway request ID to recover (required)")
	errorMessage := flag.String("error", errorDefault, "Failure message to store for fulfillRequest")
	rpcURL := flag.String("rpc", rpcDefault, "Neo N3 RPC URL")
	gateway := flag.String("gateway", strings.TrimSpace(os.Getenv("CONTRACT_SERVICEGATEWAY_HASH")), "ServiceLayerGateway contract hash (0x...)")
	waitTimeout := flag.Duration("timeout", waitTimeoutDefault, "Wait timeout for each transaction confirmation")
	dryRun := flag.Bool("dry-run", parseEnvBool("GATEWAY_RECOVERY_DRY_RUN"), "Print planned actions only")

	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Usage: go run scripts/recover_gateway_request.go [options]\n\n")
		fmt.Fprintf(flag.CommandLine.Output(), "Required env (or flags):\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  NEO_TESTNET_WIF\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  CONTRACT_SERVICEGATEWAY_HASH (or --gateway)\n\n")
		fmt.Fprintf(flag.CommandLine.Output(), "Example:\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  go run scripts/recover_gateway_request.go --request-id 105 --error \"manual recovery\"\n\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		return nil, fmt.Errorf("NEO_TESTNET_WIF environment variable not set")
	}
	if strings.TrimSpace(*requestID) == "" {
		return nil, fmt.Errorf("request ID is required (set --request-id or GATEWAY_RECOVERY_REQUEST_ID)")
	}
	if strings.TrimSpace(*gateway) == "" {
		return nil, fmt.Errorf("gateway hash is required (set --gateway or CONTRACT_SERVICEGATEWAY_HASH)")
	}
	if *waitTimeout <= 0 {
		return nil, fmt.Errorf("timeout must be > 0")
	}

	return &options{
		WIF:          wif,
		RPCURL:       strings.TrimSpace(*rpcURL),
		GatewayHash:  strings.TrimSpace(*gateway),
		RequestIDRaw: strings.TrimSpace(*requestID),
		ErrorMessage: strings.TrimSpace(*errorMessage),
		DryRun:       *dryRun,
		WaitTimeout:  *waitTimeout,
	}, nil
}

func sendCallAndWait(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contract util.Uint160, waitTimeout time.Duration, method string, params ...any) (*txReceipt, error) {
	preview, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s test invoke: %w", method, err)
	}
	if preview.State != "HALT" {
		return nil, fmt.Errorf("%s test invoke failed: %s (fault: %s)", method, preview.State, preview.FaultException)
	}

	txHash, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s send: %w", method, err)
	}

	_, err = waitForAppLog(ctx, client, txHash, waitTimeout)
	if err != nil {
		return nil, fmt.Errorf("%s confirm: %w", method, err)
	}

	return &txReceipt{TxHash: txHash, VUB: vub}, nil
}

func waitForAppLog(ctx context.Context, client *rpcclient.Client, txHash util.Uint256, timeout time.Duration) (*result.ApplicationLog, error) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	deadline := time.NewTimer(timeout)
	defer deadline.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-deadline.C:
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

func callHash160(act *actor.Actor, contract util.Uint160, method string) (util.Uint160, error) {
	res, err := act.Call(contract, method)
	if err != nil {
		return util.Uint160{}, err
	}
	if res.State != "HALT" {
		return util.Uint160{}, fmt.Errorf("%s failed: %s", method, res.FaultException)
	}
	if len(res.Stack) == 0 {
		return util.Uint160{}, fmt.Errorf("%s returned empty stack", method)
	}

	bytes, err := res.Stack[0].TryBytes()
	if err != nil {
		return util.Uint160{}, fmt.Errorf("%s parse hash160: %w", method, err)
	}
	if len(bytes) != util.Uint160Size {
		return util.Uint160{}, fmt.Errorf("%s unexpected hash160 length: %d", method, len(bytes))
	}

	var hash util.Uint160
	copy(hash[:], bytes)
	return hash, nil
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
	success, _ := itemToBool(items[10])
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

func itemToBool(item stackitem.Item) (bool, error) {
	if v, err := item.TryBool(); err == nil {
		return v, nil
	}
	n, err := item.TryInteger()
	if err != nil {
		return false, err
	}
	return n.Sign() != 0, nil
}

func parseHash160(raw string) (util.Uint160, error) {
	raw = strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(raw)
}

func parseEnvBool(key string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
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
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func printGatewayRequest(prefix string, req *gatewayRequest) {
	if req == nil {
		return
	}
	fmt.Printf("%s request: id=%s app=%s service=%s status=%s success=%t\n", prefix, req.RequestID, req.AppID, req.ServiceType, statusLabel(req.Status), req.Success)
	if req.Error != "" {
		fmt.Printf("%s error: %s\n", prefix, req.Error)
	}
	if len(req.Result) > 0 {
		fmt.Printf("%s result (hex): %s\n", prefix, hex.EncodeToString(req.Result))
	}
	if req.FulfilledAt != nil {
		fmt.Printf("%s fulfilled_at: %s\n", prefix, req.FulfilledAt.String())
	}
}

func statusLabel(status int64) string {
	switch status {
	case requestStatusPending:
		return "PENDING"
	case requestStatusFulfilled:
		return "FULFILLED"
	case requestStatusFailed:
		return "FAILED"
	default:
		return fmt.Sprintf("UNKNOWN(%d)", status)
	}
}
