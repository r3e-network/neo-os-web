//go:build scripts

// Schedule or execute the 24h-timelocked PlatformRegistry self-update that
// lands the joint-audit contract fixes (H1 FundEnginePool memo grammar,
// spend-threshold-raise timelock, pause-push into minted shims) on the
// deployed testnet registry 0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b.
// The deployed build already enforces ScheduleUpdate -> 24h -> Update with
// the sha256(nef‖manifest) pin (PlatformRegistry.Governance.cs), so the
// update is two transactions a day apart; this script covers both steps.
//
// Env idioms match deploy_platform_registry.go:
//
//	PLATFORM_REGISTRY_UPDATE_ACTION   schedule | execute | cancel | status (default status)
//	PLATFORM_REGISTRY_UPDATE_DRY_RUN  default dry when unset; =false for writes
//	CONFIRM_PLATFORM_REGISTRY_UPDATE  =I_UNDERSTAND_THIS_WRITES_CHAIN for writes
//	NEO_TESTNET_WIF / FLAGSHIP_TESTNET_WIF, NEO_TESTNET_RPC_URL / NEO_RPC_URL
//	PLATFORM_REGISTRY_TESTNET_HASH    registry hash override
//	PLATFORM_REGISTRY_UPDATE_SIGNER  public admin address/hash for dry-run
//	PLATFORM_REGISTRY_UPDATE_REPORT_PATH optional JSON evidence path
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	ruConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	ruTestnetMagic  = uint32(894710606)
	ruDefaultRPC    = "https://testnet1.neo.coz.io:443"
	ruRegistryHash  = "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b"
	ruNEFPath       = "contracts/build/PlatformRegistry.nef"
	ruManifestPath  = "contracts/build/PlatformRegistry.manifest.json"
)

type ruReport struct {
	Action               string         `json:"action"`
	Network              string         `json:"network"`
	NetworkMagic         uint32         `json:"network_magic"`
	RPCURL               string         `json:"rpc_url"`
	Signer               string         `json:"signer"`
	SignerHash           string         `json:"signer_hash,omitempty"`
	SignerInput          string         `json:"signer_input"`
	Registry             string         `json:"registry"`
	DryRun               bool           `json:"dry_run"`
	ChainWritesPerformed bool           `json:"chain_writes_performed"`
	Transactions         []ruTx         `json:"transactions"`
	Validation           map[string]any `json:"validation"`
	NextSteps            []string       `json:"next_steps"`
	GeneratedAt          string         `json:"generated_at_utc"`
}

type ruTx struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

type ruPendingUpdate struct {
	Hash            string
	ExecuteAfterMS  string
	ExecuteAfterUTC string
}

func main() {
	if err := ruRun(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func ruRun() error {
	action := strings.ToLower(os.Getenv("PLATFORM_REGISTRY_UPDATE_ACTION"))
	if action == "" {
		action = "status"
	}
	dryRun := true
	if v, ok := os.LookupEnv("PLATFORM_REGISTRY_UPDATE_DRY_RUN"); ok {
		dryRun = ruTruthy(v)
	}
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_REGISTRY_UPDATE") != ruConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_REGISTRY_UPDATE=%s to write chain", ruConfirmPhrase)
	}
	isWrite := !dryRun && action != "status"
	wif := ruFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"))
	rpcURL := ruFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), ruDefaultRPC)
	regHash, err := util.Uint160DecodeStringLE(strings.TrimPrefix(ruFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_TESTNET_HASH"), ruRegistryHash), "0x"))
	if err != nil {
		return fmt.Errorf("registry hash: %w", err)
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
	if uint32(version.Protocol.Network) != ruTestnetMagic {
		return fmt.Errorf("RPC network magic mismatch: got %d, expected %d", version.Protocol.Network, ruTestnetMagic)
	}
	var signerHash util.Uint160
	var signerAddress string
	var signerInput string
	var acc *wallet.Account
	if isWrite {
		if wif == "" {
			return fmt.Errorf("testnet signer WIF is not configured (set NEO_TESTNET_WIF)")
		}
		priv, err := keys.NewPrivateKeyFromWIF(wif)
		if err != nil {
			return fmt.Errorf("invalid testnet WIF")
		}
		acc = wallet.NewAccountFromPrivateKey(priv)
		signerHash = priv.GetScriptHash()
		signerAddress = acc.Address
		signerInput = "private-key"
	} else if action != "status" {
		signerHash, err = ruParseSignerIdentity(ruFirstNonEmpty(
			os.Getenv("PLATFORM_REGISTRY_UPDATE_SIGNER"),
			os.Getenv("PLATFORM_REGISTRY_VERIFY_SIGNER"),
		))
		if err != nil {
			return fmt.Errorf("dry-run signer: %w", err)
		}
		signerAddress = address.Uint160ToString(signerHash)
		signerInput = "public-identity"
	}

	var act *actor.Actor
	if action != "status" {
		account := acc
		if account == nil {
			account = &wallet.Account{
				Address:  signerAddress,
				Contract: &wallet.Contract{Deployed: true},
			}
		}
		act, err = actor.New(client, []actor.SignerAccount{{
			Signer:  transaction.Signer{Account: signerHash, Scopes: transaction.Global},
			Account: account,
		}})
		if err != nil {
			return fmt.Errorf("create actor: %w", err)
		}
	}

	report := ruReport{
		Action:               action,
		Network:              "neo-n3-testnet",
		NetworkMagic:         ruTestnetMagic,
		RPCURL:               rpcURL,
		Signer:               signerAddress,
		SignerHash:           ruHashString(signerHash),
		SignerInput:          signerInput,
		Registry:             "0x" + regHash.StringLE(),
		DryRun:               dryRun,
		ChainWritesPerformed: false,
		Transactions:         []ruTx{},
		Validation:           map[string]any{},
		NextSteps:            []string{},
		GeneratedAt:          time.Now().UTC().Format(time.RFC3339),
	}

	admin, err := client.InvokeFunction(regHash, "admin", []smartcontract.Parameter{}, nil)
	if err != nil {
		return fmt.Errorf("read admin: %w", err)
	}
	adminHash, err := admin.Stack[0].TryBytes()
	if err != nil {
		return fmt.Errorf("decode admin: %w", err)
	}
	adminU, err := util.Uint160DecodeBytesBE(adminHash)
	if err != nil {
		return fmt.Errorf("decode admin hash: %w", err)
	}
	report.Validation["admin"] = "0x" + adminU.StringLE()
	if action == "status" {
		report.Validation["admin_matches_signer"] = "not-checked"
	} else {
		report.Validation["admin_matches_signer"] = adminU == signerHash
	}
	if action != "status" && adminU != signerHash {
		return fmt.Errorf("signer %s is not the registry admin", signerAddress)
	}

	switch action {
	case "status":
		pending, pendingErr := ruReadPendingUpdate(client, regHash)
		if pendingErr != nil {
			report.Validation["pending_update_storage_read_error"] = pendingErr.Error()
			if err := ruWriteReport(&report, ruStatusNextSteps(ruPendingUpdate{}, pendingErr)); err != nil {
				return err
			}
			return fmt.Errorf("read Registry update storage: %w", pendingErr)
		}
		ruRecordPendingUpdate(&report, pending)
		ruRecordCandidateDigest(&report, pending)
		return ruWriteReport(&report, ruStatusNextSteps(pending, nil))
	case "schedule", "execute", "cancel":
		return ruSubmitUpdate(ctx, act, client, signerHash, regHash, action, dryRun, &report)
	default:
		return fmt.Errorf("unknown PLATFORM_REGISTRY_UPDATE_ACTION %q (schedule|execute|cancel|status)", action)
	}
}

func ruSubmitUpdate(ctx context.Context, act *actor.Actor, client *rpcclient.Client, signerHash util.Uint160, regHash util.Uint160, action string, dryRun bool, report *ruReport) error {
	if action == "cancel" {
		return ruCancelUpdate(ctx, act, client, signerHash, regHash, dryRun, report)
	}
	nefBytes, err := os.ReadFile(ruNEFPath)
	if err != nil {
		return fmt.Errorf("read NEF: %w", err)
	}
	manifestBytes, err := os.ReadFile(ruManifestPath)
	if err != nil {
		return fmt.Errorf("read manifest: %w", err)
	}
	report.Validation["nef_bytes"] = len(nefBytes)
	report.Validation["manifest_bytes"] = len(manifestBytes)
	report.Validation["candidate_update_hash"] = ruUpdateDigest(nefBytes, manifestBytes)
	nefFile, err := nef.FileFromBytes(nefBytes)
	if err != nil {
		return fmt.Errorf("parse NEF: %w", err)
	}
	report.Validation["nef_checksum"] = nefFile.Checksum

	method := "scheduleUpdate"
	if action == "execute" {
		method = "update"
	}
	params := []smartcontract.Parameter{
		{Type: smartcontract.ByteArrayType, Value: nefBytes},
		{Type: smartcontract.StringType, Value: string(manifestBytes)},
	}
	if action == "schedule" {
		probe, err := client.InvokeFunction(regHash, "update", params, []transaction.Signer{{
			Account: signerHash,
			Scopes:  transaction.Global,
		}})
		if err != nil {
			return fmt.Errorf("probe existing Registry update: %w", err)
		}
		probeStatus := ruClassifyUpdateProbe(probe.State, probe.FaultException)
		report.Validation["existing_update_status"] = probeStatus
		report.Validation["existing_update_probe_state"] = probe.State
		report.Validation["existing_update_probe_exception"] = probe.FaultException
		if pending, err := ruReadPendingUpdate(client, regHash); err == nil {
			if pending.Hash != "" {
				report.Validation["existing_update_storage_hash"] = pending.Hash
			}
			if pending.ExecuteAfterMS != "" {
				report.Validation["existing_update_execute_after_ms"] = pending.ExecuteAfterMS
				report.Validation["existing_update_execute_after_utc"] = pending.ExecuteAfterUTC
			}
			ruRecordCandidateDigest(report, pending)
		} else {
			report.Validation["existing_update_storage_read_error"] = err.Error()
		}
		switch probeStatus {
		case "pending":
			report.NextSteps = append(report.NextSteps,
				"a matching Registry update is already pending; do not rerun schedule because it would reset the 24h timelock; run the execute action after maturity")
			return ruWriteReport(report, nil)
		case "matured":
			report.NextSteps = append(report.NextSteps,
				"a matching Registry update is already matured; skip schedule and run the execute action")
			return ruWriteReport(report, nil)
		case "conflict":
			report.NextSteps = append(report.NextSteps,
				"a different Registry update is already scheduled; inspect its pinned artifact before canceling or executing it; this script will not overwrite its timelock")
			if err := ruWriteReport(report, nil); err != nil {
				return err
			}
			return fmt.Errorf("a different Registry update is already scheduled; refusing to overwrite its timelock")
		case "none":
		default:
			return fmt.Errorf("cannot classify existing Registry update probe: state=%s exception=%s", probe.State, probe.FaultException)
		}
	}
	if dryRun {
		signers := []transaction.Signer{{Account: signerHash, Scopes: transaction.Global}}
		res, err := client.InvokeFunction(regHash, method, params, signers)
		if err != nil {
			return fmt.Errorf("test-invoke %s: %w", method, err)
		}
		report.Validation["test_invoke_state"] = res.State
		report.Validation["test_invoke_exception"] = res.FaultException
		report.NextSteps = append(report.NextSteps,
			fmt.Sprintf("re-run with PLATFORM_REGISTRY_UPDATE_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_UPDATE=%s to send %s", ruConfirmPhrase, method))
		return ruWriteReport(report, nil)
	}
	txid, vub, err := act.SendCall(regHash, method, nefBytes, string(manifestBytes))
	if err != nil {
		return fmt.Errorf("send %s: %w", method, err)
	}
	report.Transactions = append(report.Transactions, ruTx{Label: "Registry " + method, TxID: "0x" + txid.StringLE(), VUB: vub})
	report.ChainWritesPerformed = true
	if err := ruWaitForTx(ctx, client, txid); err != nil {
		return fmt.Errorf("wait %s: %w", method, err)
	}
	if action == "schedule" {
		report.NextSteps = append(report.NextSteps,
			"update scheduled; execute after the 24h timelock with PLATFORM_REGISTRY_UPDATE_ACTION=execute PLATFORM_REGISTRY_UPDATE_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_UPDATE="+ruConfirmPhrase+" go run -tags scripts deploy/scripts/schedule_platform_registry_update.go")
	} else {
		state, err := client.GetContractStateByHash(regHash)
		if err != nil {
			return fmt.Errorf("read registry after update: %w", err)
		}
		report.Validation["update_counter_after"] = state.UpdateCounter
		report.Validation["on_chain_nef_checksum"] = state.NEF.Checksum
		if state.NEF.Checksum != nefFile.Checksum {
			return fmt.Errorf("registry checksum mismatch after update: got %d, expected %d", state.NEF.Checksum, nefFile.Checksum)
		}
		report.NextSteps = append(report.NextSteps, "registry updated on-chain; re-run deploy script verify action for full state")
	}
	return ruWriteReport(report, nil)
}

func ruCancelUpdate(ctx context.Context, act *actor.Actor, client *rpcclient.Client, signerHash util.Uint160, regHash util.Uint160, dryRun bool, report *ruReport) error {
	pending, err := ruReadPendingUpdate(client, regHash)
	if err != nil {
		return fmt.Errorf("read Registry update storage before cancel: %w", err)
	}
	ruRecordPendingUpdate(report, pending)
	if dryRun {
		result, err := client.InvokeFunction(regHash, "cancelUpdate", []smartcontract.Parameter{}, []transaction.Signer{{
			Account: signerHash,
			Scopes:  transaction.Global,
		}})
		if err != nil {
			return fmt.Errorf("test-invoke cancelUpdate: %w", err)
		}
		report.Validation["test_invoke_state"] = result.State
		report.Validation["test_invoke_exception"] = result.FaultException
		report.NextSteps = append(report.NextSteps,
			fmt.Sprintf("re-run with PLATFORM_REGISTRY_UPDATE_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_UPDATE=%s to cancel the pending Registry update", ruConfirmPhrase))
		return ruWriteReport(report, nil)
	}
	txid, vub, err := act.SendCall(regHash, "cancelUpdate")
	if err != nil {
		return fmt.Errorf("send cancelUpdate: %w", err)
	}
	report.Transactions = append(report.Transactions, ruTx{Label: "Cancel Registry update", TxID: "0x" + txid.StringLE(), VUB: vub})
	report.ChainWritesPerformed = true
	if err := ruWaitForTx(ctx, client, txid); err != nil {
		return fmt.Errorf("wait cancelUpdate: %w", err)
	}
	pending, err = ruReadPendingUpdate(client, regHash)
	if err != nil {
		return fmt.Errorf("read Registry update storage after cancel: %w", err)
	}
	if pending.Hash != "" || pending.ExecuteAfterMS != "" {
		return fmt.Errorf("cancelUpdate read-back still shows a pending Registry update")
	}
	report.Validation["pending_update_cleared"] = true
	report.NextSteps = append(report.NextSteps,
		"pending Registry update cleared; re-run schedule dry-run against the current candidate before any new write")
	return ruWriteReport(report, nil)
}

func ruRecordPendingUpdate(report *ruReport, pending ruPendingUpdate) {
	if pending.Hash != "" {
		report.Validation["existing_update_storage_hash"] = pending.Hash
	}
	if pending.ExecuteAfterMS != "" {
		report.Validation["existing_update_execute_after_ms"] = pending.ExecuteAfterMS
		report.Validation["existing_update_execute_after_utc"] = pending.ExecuteAfterUTC
	}
}

func ruRecordCandidateDigest(report *ruReport, pending ruPendingUpdate) {
	nefBytes, nefErr := os.ReadFile(ruNEFPath)
	manifestBytes, manifestErr := os.ReadFile(ruManifestPath)
	if nefErr != nil || manifestErr != nil {
		report.Validation["candidate_update_hash_error"] = fmt.Sprintf("read candidate artifact: nef=%v manifest=%v", nefErr, manifestErr)
		return
	}
	digest := ruUpdateDigest(nefBytes, manifestBytes)
	report.Validation["candidate_update_hash"] = digest
	if pending.Hash != "" {
		report.Validation["pending_update_matches_candidate"] = pending.Hash == digest
	}
}

func ruUpdateDigest(nefBytes, manifestBytes []byte) string {
	payload := make([]byte, 0, len(nefBytes)+len(manifestBytes))
	payload = append(payload, nefBytes...)
	payload = append(payload, manifestBytes...)
	digest := sha256.Sum256(payload)
	return "0x" + hex.EncodeToString(digest[:])
}

func ruStatusNextSteps(pending ruPendingUpdate, readErr error) []string {
	if readErr != nil {
		return []string{
			"pending update storage could not be read; do not schedule, execute, or cancel until the read succeeds",
		}
	}
	if pending.Hash != "" || pending.ExecuteAfterMS != "" {
		return []string{
			"a Registry update is already pending; inspect its pinned artifact before canceling or executing it",
		}
	}
	return []string{
		"schedule: set PLATFORM_REGISTRY_UPDATE_SIGNER to the public admin identity, then run PLATFORM_REGISTRY_UPDATE_ACTION=schedule with the default dry-run",
	}
}

func ruWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
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
	return fmt.Errorf("tx %s not confirmed in time", txid.StringLE())
}

func ruWriteReport(report *ruReport, extra []string) error {
	report.NextSteps = append(report.NextSteps, extra...)
	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	reportPath := ruFirstNonEmpty(
		os.Getenv("PLATFORM_REGISTRY_UPDATE_REPORT_PATH"),
		"deploy/config/platform-registry-update-latest.json",
	)
	if err := os.MkdirAll(filepath.Dir(reportPath), 0755); err != nil {
		return fmt.Errorf("create report directory: %w", err)
	}
	if err := os.WriteFile(reportPath, append(out, '\n'), 0644); err != nil {
		return fmt.Errorf("write report: %w", err)
	}
	fmt.Printf("Saved: %s\n", reportPath)
	return nil
}

func ruHashString(hash util.Uint160) string {
	if hash == (util.Uint160{}) {
		return ""
	}
	return "0x" + hash.StringLE()
}

func ruParseSignerIdentity(raw string) (util.Uint160, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return util.Uint160{}, fmt.Errorf("public signer identity is required as a Neo address or script hash")
	}
	if strings.HasPrefix(trimmed, "0x") || len(trimmed) == 40 {
		hash, err := util.Uint160DecodeStringLE(strings.TrimPrefix(trimmed, "0x"))
		if err != nil {
			return util.Uint160{}, fmt.Errorf("invalid public signer script hash")
		}
		return hash, nil
	}
	hash, err := address.StringToUint160(trimmed)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("invalid public signer Neo address")
	}
	return hash, nil
}

func ruClassifyUpdateProbe(state, exception string) string {
	if strings.EqualFold(strings.TrimSpace(state), "HALT") {
		return "matured"
	}
	fault := strings.ToLower(strings.TrimSpace(exception))
	switch {
	case strings.Contains(fault, "no upgrade scheduled"):
		return "none"
	case strings.Contains(fault, "timelock active"):
		return "pending"
	case strings.Contains(fault, "upgrade data mismatch"):
		return "conflict"
	default:
		return "unknown"
	}
}

func ruReadPendingUpdate(client *rpcclient.Client, registry util.Uint160) (ruPendingUpdate, error) {
	storedHash, err := client.GetStorageByHash(registry, []byte{0x07})
	if err != nil {
		return ruPendingUpdate{}, err
	}
	storedTime, err := client.GetStorageByHash(registry, []byte{0x06})
	if err != nil {
		return ruPendingUpdate{}, err
	}
	pending := ruPendingUpdate{}
	if len(storedHash) > 0 {
		pending.Hash = "0x" + hex.EncodeToString(storedHash)
	}
	if len(storedTime) > 0 {
		value := ruLittleEndianInteger(storedTime)
		pending.ExecuteAfterMS = value.String()
		if value.IsInt64() {
			pending.ExecuteAfterUTC = time.UnixMilli(value.Int64()).UTC().Format(time.RFC3339)
		}
	}
	return pending, nil
}

func ruLittleEndianInteger(raw []byte) *big.Int {
	value := new(big.Int)
	for index := len(raw) - 1; index >= 0; index-- {
		value.Lsh(value, 8)
		value.Add(value, big.NewInt(int64(raw[index])))
	}
	return value
}

func ruTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}

func ruFirstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
