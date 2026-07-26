//go:build scripts

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/neorpc/result"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	saaConfirmPhrase   = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	saaNetworkMagic    = uint32(894710606)
	saaDefaultRPC      = "https://testnet1.neo.coz.io:443"
	saaDefaultAA       = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2"
	saaDefaultRegistry = "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b"
)

type saaActionSpec struct {
	Target string
	Method string
}

type saaReport struct {
	Action               string           `json:"action"`
	Target               string           `json:"target"`
	Method               string           `json:"method,omitempty"`
	Network              string           `json:"network"`
	NetworkMagic         uint32           `json:"network_magic"`
	RPCURL               string           `json:"rpc_url"`
	AAHash               string           `json:"aa_hash"`
	RegistryHash         string           `json:"registry_hash"`
	Signer               string           `json:"signer,omitempty"`
	SignerHash           string           `json:"signer_hash,omitempty"`
	SignerInput          string           `json:"signer_input,omitempty"`
	DryRun               bool             `json:"dry_run"`
	ChainWritesPerformed bool             `json:"chain_writes_performed"`
	Transactions         []saaTransaction `json:"transactions"`
	Validation           map[string]any   `json:"validation"`
	NextSteps            []string         `json:"next_steps"`
	GeneratedAt          string           `json:"generated_at_utc"`
}

type saaTransaction struct {
	Method string `json:"method"`
	TxID   string `json:"txid"`
}

func main() {
	if err := saaRun(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func saaRun() error {
	action := strings.ToLower(strings.TrimSpace(os.Getenv("PLATFORM_SHARED_AA_ACTION")))
	if action == "" {
		action = "status"
	}
	spec, err := saaAction(action)
	if err != nil {
		return err
	}
	dryRun := true
	if raw, ok := os.LookupEnv("PLATFORM_SHARED_AA_DRY_RUN"); ok {
		dryRun = saaTruthy(raw)
	}
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_SHARED_AA") != saaConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_SHARED_AA=%s to write chain", saaConfirmPhrase)
	}
	rpcURL := saaFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), saaDefaultRPC)
	aaHash, err := saaParseHash(saaFirstNonEmpty(os.Getenv("PLATFORM_SHARED_AA_HASH"), saaDefaultAA))
	if err != nil {
		return fmt.Errorf("AA hash: %w", err)
	}
	registryHash, err := saaParseHash(saaFirstNonEmpty(os.Getenv("PLATFORM_SHARED_AA_REGISTRY_HASH"), saaDefaultRegistry))
	if err != nil {
		return fmt.Errorf("Registry hash: %w", err)
	}
	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{DialTimeout: 20 * time.Second, RequestTimeout: 30 * time.Second})
	if err != nil {
		return fmt.Errorf("connect RPC: %w", err)
	}
	version, err := client.GetVersion()
	if err != nil {
		return fmt.Errorf("read RPC version: %w", err)
	}
	if uint32(version.Protocol.Network) != saaNetworkMagic {
		return fmt.Errorf("RPC network magic mismatch: got %d, expected %d", version.Protocol.Network, saaNetworkMagic)
	}

	report := saaReport{
		Action:               action,
		Target:               spec.Target,
		Method:               spec.Method,
		Network:              "neo-n3-testnet",
		NetworkMagic:         saaNetworkMagic,
		RPCURL:               rpcURL,
		AAHash:               saaHashString(aaHash),
		RegistryHash:         saaHashString(registryHash),
		DryRun:               dryRun,
		ChainWritesPerformed: false,
		Transactions:         []saaTransaction{},
		Validation:           map[string]any{},
		NextSteps:            []string{},
		GeneratedAt:          time.Now().UTC().Format(time.RFC3339),
	}
	if err := saaReadGovernanceState(client, aaHash, registryHash, &report); err != nil {
		return err
	}
	if action == "status" {
		report.NextSteps = saaStatusNextSteps(report)
		return saaWriteReport(&report)
	}
	if ready, ok := report.Validation["governance_abi_ready"].(bool); !ok || !ready {
		report.NextSteps = saaStatusNextSteps(report)
		if err := saaWriteReport(&report); err != nil {
			return err
		}
		return fmt.Errorf("required shared abstract-account governance ABI is not ready")
	}

	signerHash, signerAddress, signerInput, account, err := saaSigner(client, spec.Target, dryRun)
	if err != nil {
		return err
	}
	report.Signer = signerAddress
	report.SignerHash = saaHashString(signerHash)
	report.SignerInput = signerInput
	adminHash, err := saaTargetAdmin(&report, spec.Target)
	if err != nil {
		return err
	}
	report.Validation["admin_matches_signer"] = adminHash == signerHash
	if adminHash != signerHash {
		return fmt.Errorf("signer %s is not the %s admin", signerAddress, spec.Target)
	}

	params := saaActionParams(action, registryHash, aaHash)
	if dryRun {
		result, err := client.InvokeFunction(saaTargetHash(spec.Target, aaHash, registryHash), spec.Method, params, []transaction.Signer{{Account: signerHash, Scopes: transaction.Global}})
		if err != nil {
			return fmt.Errorf("test-invoke %s: %w", spec.Method, err)
		}
		report.Validation["test_invoke_state"] = result.State
		report.Validation["test_invoke_exception"] = result.FaultException
		report.NextSteps = append(report.NextSteps, fmt.Sprintf("re-run with PLATFORM_SHARED_AA_DRY_RUN=false CONFIRM_PLATFORM_SHARED_AA=%s to send %s", saaConfirmPhrase, spec.Method))
		return saaWriteReport(&report)
	}

	act, err := actor.New(client, []actor.SignerAccount{{Signer: transaction.Signer{Account: signerHash, Scopes: transaction.Global}, Account: account}})
	if err != nil {
		return fmt.Errorf("create actor: %w", err)
	}
	targetHash := saaTargetHash(spec.Target, aaHash, registryHash)
	txid, _, err := act.SendCall(targetHash, spec.Method, saaInterfaceParams(params)...)
	if err != nil {
		return fmt.Errorf("send %s: %w", spec.Method, err)
	}
	report.Transactions = append(report.Transactions, saaTransaction{Method: spec.Method, TxID: "0x" + txid.StringLE()})
	report.ChainWritesPerformed = true
	if err := saaWaitForTx(ctx, client, txid); err != nil {
		return err
	}
	if err := saaReadGovernanceState(client, aaHash, registryHash, &report); err != nil {
		return err
	}
	report.NextSteps = saaStatusNextSteps(report)
	return saaWriteReport(&report)
}

func saaAction(action string) (saaActionSpec, error) {
	specs := map[string]saaActionSpec{
		"propose-registrar": {Target: "aa", Method: "proposePlatformRegistrar"},
		"confirm-registrar": {Target: "aa", Method: "confirmPlatformRegistrar"},
		"cancel-registrar":  {Target: "aa", Method: "cancelPlatformRegistrar"},
		"propose-core":      {Target: "registry", Method: "proposeAbstractAccountCore"},
		"set-core":          {Target: "registry", Method: "setAbstractAccountCore"},
		"cancel-core":       {Target: "registry", Method: "cancelAbstractAccountCore"},
	}
	if action == "status" {
		return saaActionSpec{}, nil
	}
	spec, ok := specs[action]
	if !ok {
		return saaActionSpec{}, fmt.Errorf("unknown PLATFORM_SHARED_AA_ACTION %q", action)
	}
	return spec, nil
}

func saaReadGovernanceState(client *rpcclient.Client, aaHash, registryHash util.Uint160, report *saaReport) error {
	readErrors := make([]string, 0)
	for _, row := range []struct {
		name   string
		hash   util.Uint160
		method string
	}{
		{name: "aa_admin", hash: aaHash, method: "getContractAdmin"},
		{name: "aa_registrar", hash: aaHash, method: "getPlatformRegistrar"},
		{name: "aa_pending_registrar", hash: aaHash, method: "getPendingPlatformRegistrar"},
		{name: "aa_registrar_available_at", hash: aaHash, method: "getPlatformRegistrarAvailableAt"},
		{name: "registry_admin", hash: registryHash, method: "admin"},
		{name: "registry_core", hash: registryHash, method: "abstractAccountCore"},
		{name: "registry_pending_core", hash: registryHash, method: "pendingAbstractAccountCore"},
		{name: "registry_core_available_at", hash: registryHash, method: "abstractAccountCoreAvailableAt"},
	} {
		result, err := client.InvokeFunction(row.hash, row.method, []smartcontract.Parameter{}, nil)
		if err != nil {
			readErrors = append(readErrors, fmt.Sprintf("%s: %v", row.name, err))
			continue
		}
		if result.State != "HALT" {
			readErrors = append(readErrors, fmt.Sprintf("%s: state=%s exception=%s", row.name, result.State, result.FaultException))
			continue
		}
		if strings.HasSuffix(row.name, "admin") || strings.HasSuffix(row.name, "registrar") || strings.HasSuffix(row.name, "core") {
			value, err := saaDecodeHash160(result)
			if err != nil {
				readErrors = append(readErrors, fmt.Sprintf("decode %s: %v", row.name, err))
				continue
			}
			report.Validation[row.name] = saaHashString(value)
			continue
		}
		report.Validation[row.name] = result.Stack
	}
	report.Validation["governance_abi_ready"] = len(readErrors) == 0
	if len(readErrors) > 0 {
		report.Validation["governance_read_errors"] = readErrors
	}
	return nil
}

func saaTargetAdmin(report *saaReport, target string) (util.Uint160, error) {
	name := target + "_admin"
	value, ok := report.Validation[name].(string)
	if !ok {
		return util.Uint160{}, fmt.Errorf("missing %s", name)
	}
	return saaParseHash(value)
}

func saaSigner(client *rpcclient.Client, target string, dryRun bool) (util.Uint160, string, string, *wallet.Account, error) {
	if dryRun {
		hash, err := saaParseHash(os.Getenv("PLATFORM_SHARED_AA_SIGNER"))
		if err != nil {
			return util.Uint160{}, "", "", nil, fmt.Errorf("dry-run signer: %w", err)
		}
		return hash, address.Uint160ToString(hash), "public-identity", nil, nil
	}
	wif := saaFirstNonEmpty(os.Getenv("PLATFORM_SHARED_AA_WIF"), os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"))
	if wif == "" {
		return util.Uint160{}, "", "", nil, fmt.Errorf("set PLATFORM_SHARED_AA_WIF or NEO_TESTNET_WIF for write mode")
	}
	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return util.Uint160{}, "", "", nil, fmt.Errorf("invalid testnet WIF")
	}
	account := wallet.NewAccountFromPrivateKey(priv)
	return priv.GetScriptHash(), account.Address, "private-key", account, nil
}

func saaActionParams(action string, registryHash, aaHash util.Uint160) []smartcontract.Parameter {
	if action == "propose-registrar" {
		return []smartcontract.Parameter{{Type: smartcontract.Hash160Type, Value: registryHash}}
	}
	if action == "propose-core" {
		return []smartcontract.Parameter{{Type: smartcontract.Hash160Type, Value: aaHash}}
	}
	return []smartcontract.Parameter{}
}

func saaInterfaceParams(params []smartcontract.Parameter) []interface{} {
	values := make([]interface{}, 0, len(params))
	for _, param := range params {
		values = append(values, param.Value)
	}
	return values
}

func saaTargetHash(target string, aaHash, registryHash util.Uint160) util.Uint160 {
	if target == "aa" {
		return aaHash
	}
	return registryHash
}

func saaStatusNextSteps(report saaReport) []string {
	if ready, ok := report.Validation["governance_abi_ready"].(bool); ok && !ready {
		return []string{
			"upgrade AA and Registry contracts with the current artifacts before governance writes",
			"rerun PLATFORM_SHARED_AA_ACTION=status and require governance_abi_ready=true",
			"do not attempt registrar or core governance actions while any required method is unavailable",
		}
	}
	return []string{"rerun the corresponding public-identity dry-run before each governance write; do not activate Registry core before the AA registrar is confirmed"}
}

func saaDecodeHash160(result *result.Invoke) (util.Uint160, error) {
	if len(result.Stack) == 0 {
		return util.Uint160{}, fmt.Errorf("empty stack")
	}
	raw, err := result.Stack[0].TryBytes()
	if err != nil {
		return util.Uint160{}, err
	}
	return util.Uint160DecodeBytesBE(raw)
}

func saaParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return util.Uint160{}, fmt.Errorf("public identity is required")
	}
	if strings.HasPrefix(trimmed, "0x") || len(trimmed) == 40 {
		value, err := util.Uint160DecodeStringLE(strings.TrimPrefix(trimmed, "0x"))
		if err != nil {
			return util.Uint160{}, fmt.Errorf("invalid script hash")
		}
		return value, nil
	}
	value, err := address.StringToUint160(trimmed)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("invalid Neo address")
	}
	return value, nil
}

func saaHashString(value util.Uint160) string {
	if value == (util.Uint160{}) {
		return "0x0000000000000000000000000000000000000000"
	}
	return "0x" + value.StringLE()
}

func saaWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
	for i := 0; i < 30; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(5 * time.Second):
		}
		tx, err := client.GetRawTransactionVerbose(txid)
		if err == nil && tx != nil && tx.Blockhash != (util.Uint256{}) {
			return nil
		}
	}
	return fmt.Errorf("transaction %s not confirmed in time", txid.StringLE())
}

func saaWriteReport(report *saaReport) error {
	output, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	path := saaFirstNonEmpty(os.Getenv("PLATFORM_SHARED_AA_REPORT_PATH"), "deploy/config/shared-aa-governance-latest.json")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(path, append(output, '\n'), 0644); err != nil {
		return err
	}
	fmt.Println(string(output))
	fmt.Printf("Saved: %s\n", path)
	return nil
}

func saaTruthy(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func saaFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
