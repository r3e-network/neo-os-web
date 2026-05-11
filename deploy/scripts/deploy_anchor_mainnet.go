//go:build scripts

package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/hash"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/neorpc/result"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/management"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	mainnetAnchorTrustApp         = "miniapp-trustanchor"
	mainnetAnchorProfitApp        = "miniapp-profitanchor"
	mainnetAnchorModeTrust        = int64(1)
	mainnetAnchorModeProfit       = int64(2)
	mainnetAnchorAATimelock       = int64(30 * 24 * 60 * 60)
	mainnetAnchorConfirm          = "I_UNDERSTAND_THIS_WRITES_MAINNET"
	mainnetAnchorDefaultRPC       = "https://mainnet2.neo.coz.io:443"
	mainnetAnchorDefaultAAHash    = "0x0268a387913b250166ddec032b03332690a1ef78"
	mainnetAnchorDefaultCand      = "023e9b32ea89b94d066e649b124fd50e396ee91369e8e2a6ae1b11c170d022256d"
	mainnetAnchorReportPath       = "contracts/build/mainnet_anchor_deployment.json"
	mainnetAnchorContractNEF      = "contracts/build/PlatformAnchor.nef"
	mainnetAnchorContractManifest = "contracts/build/PlatformAnchor.manifest.json"
)

type mainnetAnchorReport struct {
	Network        string            `json:"network"`
	RPCURL         string            `json:"rpc_url"`
	Deployer       string            `json:"deployer"`
	DeployerHash   string            `json:"deployer_hash"`
	PlatformAnchor string            `json:"platform_anchor"`
	AACore         string            `json:"aa_core"`
	Candidate      string            `json:"candidate"`
	AAAccounts     map[string]string `json:"aa_accounts"`
	Transactions   []mainnetTxRecord `json:"transactions"`
	Validation     map[string]any    `json:"validation"`
	GeneratedAtUTC string            `json:"generated_at_utc"`
}

type mainnetTxRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

func main() {
	if err := runMainnetAnchorDeploy(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runMainnetAnchorDeploy() error {
	if os.Getenv("CONFIRM_MAINNET_ANCHOR_DEPLOY") != mainnetAnchorConfirm {
		return fmt.Errorf("set CONFIRM_MAINNET_ANCHOR_DEPLOY=%s to allow mainnet writes", mainnetAnchorConfirm)
	}

	ctx := context.Background()
	rpcURL := mainnetAnchorFirstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), os.Getenv("NEO_RPC_MAINNET"), os.Getenv("NEO_RPC_URL"), mainnetAnchorDefaultRPC)
	if strings.Contains(strings.ToLower(rpcURL), "testnet") {
		return fmt.Errorf("refusing to deploy mainnet contract through a testnet RPC URL: %s", rpcURL)
	}
	wif := mainnetAnchorFirstNonEmpty(os.Getenv("MINIAPP_MAINNET_DEPLOY_WIF"), os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF"))
	if wif == "" {
		return fmt.Errorf("MINIAPP_MAINNET_DEPLOY_WIF, NEO_MAINNET_WIF, or FLAGSHIP_MAINNET_WIF is required")
	}

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("invalid mainnet WIF: %w", err)
	}
	acc := wallet.NewAccountFromPrivateKey(priv)
	deployerHash := priv.GetScriptHash()

	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{DialTimeout: 20 * time.Second, RequestTimeout: 20 * time.Second})
	if err != nil {
		return fmt.Errorf("connect RPC: %w", err)
	}
	act, err := actor.New(client, []actor.SignerAccount{{
		Signer: transaction.Signer{
			Account: acc.Contract.ScriptHash(),
			Scopes:  transaction.Global,
		},
		Account: acc,
	}})
	if err != nil {
		return fmt.Errorf("create actor: %w", err)
	}

	aaHash, err := mainnetAnchorParseHash(mainnetAnchorFirstNonEmpty(os.Getenv("AA_CORE_HASH_MAINNET"), os.Getenv("CONTRACT_AA_CORE_MAINNET_HASH"), mainnetAnchorDefaultAAHash))
	if err != nil {
		return fmt.Errorf("parse AA core hash: %w", err)
	}
	candidate, err := keys.NewPublicKeyFromString(mainnetAnchorFirstNonEmpty(os.Getenv("ANCHOR_MAINNET_CANDIDATE"), mainnetAnchorDefaultCand))
	if err != nil {
		return fmt.Errorf("parse candidate public key: %w", err)
	}
	agentNonce := mainnetAnchorFirstNonEmpty(os.Getenv("ANCHOR_MAINNET_AGENT_NONCE"), os.Getenv("ANCHOR_AGENT_NONCE"), "v1")

	report := mainnetAnchorReport{
		Network:        "neo-n3-mainnet",
		RPCURL:         rpcURL,
		Deployer:       acc.Address,
		DeployerHash:   "0x" + deployerHash.StringLE(),
		AACore:         "0x" + aaHash.StringLE(),
		Candidate:      candidate.StringCompressed(),
		AAAccounts:     map[string]string{},
		Transactions:   []mainnetTxRecord{},
		Validation:     map[string]any{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}

	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Deployer: %s\n", acc.Address)

	anchorHash, err := mainnetAnchorDeploy(ctx, client, act, deployerHash, &report)
	if err != nil {
		return err
	}
	report.PlatformAnchor = "0x" + anchorHash.StringLE()

	if err := mainnetAnchorEnsureApp(ctx, act, client, anchorHash, mainnetAnchorTrustApp, mainnetAnchorModeTrust, deployerHash, &report); err != nil {
		return err
	}
	if err := mainnetAnchorEnsureApp(ctx, act, client, anchorHash, mainnetAnchorProfitApp, mainnetAnchorModeProfit, deployerHash, &report); err != nil {
		return err
	}

	trustAgents, err := mainnetAnchorEnsureAgentSet(ctx, act, client, aaHash, anchorHash, mainnetAnchorTrustApp, "trustanchor", agentNonce, deployerHash, candidate, &report)
	if err != nil {
		return err
	}
	profitAgents, err := mainnetAnchorEnsureAgentSet(ctx, act, client, aaHash, anchorHash, mainnetAnchorProfitApp, "profitanchor", agentNonce, deployerHash, candidate, &report)
	if err != nil {
		return err
	}
	report.Validation["anchor_agent_sets"] = map[string]any{
		"trustanchor_agents":  len(trustAgents),
		"profitanchor_agents": len(profitAgents),
	}

	if err := mainnetAnchorEnsureAAVerifyScopes(ctx, act, client, aaHash, anchorHash, &report); err != nil {
		return err
	}
	if err := mainnetAnchorValidateRead(act, anchorHash, &report); err != nil {
		return err
	}
	if err := mainnetAnchorWriteReport(report); err != nil {
		return err
	}

	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	return nil
}

func mainnetAnchorDeploy(ctx context.Context, client *rpcclient.Client, act *actor.Actor, deployer util.Uint160, report *mainnetAnchorReport) (util.Uint160, error) {
	nefFile, err := mainnetAnchorLoadNEF(mainnetAnchorContractNEF)
	if err != nil {
		return util.Uint160{}, err
	}
	mani, err := mainnetAnchorLoadManifest(mainnetAnchorContractManifest)
	if err != nil {
		return util.Uint160{}, err
	}
	expected := state.CreateContractHash(deployer, nefFile.Checksum, mani.Name)
	fmt.Printf("PlatformAnchor expected hash: 0x%s\n", expected.StringLE())

	if _, err := client.GetContractStateByHash(expected); err == nil {
		fmt.Println("PlatformAnchor already deployed")
		return expected, nil
	}

	txid, vub, err := management.New(act).Deploy(nefFile, mani, nil)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("deploy PlatformAnchor: %w", err)
	}
	report.Transactions = append(report.Transactions, mainnetTxRecord{Label: "Deploy PlatformAnchor", TxID: "0x" + txid.StringLE(), VUB: vub})
	if err := mainnetAnchorWaitForTx(ctx, client, txid); err != nil {
		return util.Uint160{}, fmt.Errorf("wait deploy PlatformAnchor: %w", err)
	}
	if _, err := client.GetContractStateByHash(expected); err != nil {
		return util.Uint160{}, fmt.Errorf("PlatformAnchor deploy tx confirmed but contract missing: %w", err)
	}
	return expected, nil
}

func mainnetAnchorEnsureApp(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, appID string, mode int64, admin util.Uint160, report *mainnetAnchorReport) error {
	current, err := mainnetAnchorCallInteger(act, contract, "getAppMode", appID)
	if err != nil {
		return err
	}
	if current.Int64() == mode {
		return nil
	}
	if current.Sign() != 0 {
		return fmt.Errorf("%s already registered with unexpected mode %s", appID, current.String())
	}
	return mainnetAnchorSendAndWait(ctx, act, client, contract, "registerAnchorApp", report, "Register "+appID, appID, mode, admin)
}

func mainnetAnchorEnsureAA(ctx context.Context, act *actor.Actor, client *rpcclient.Client, aaCore util.Uint160, backupOwner util.Uint160, verifierParams []byte, report *mainnetAnchorReport, label string) (util.Uint160, error) {
	zero := util.Uint160{}
	accountID, err := mainnetAnchorComputeRegistrationAccountID(zero, verifierParams, zero, backupOwner, mainnetAnchorAATimelock)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("compute %s: %w", label, err)
	}
	backup, err := mainnetAnchorCallUint160(act, aaCore, "getBackupOwner", accountID)
	if err != nil {
		if !strings.Contains(err.Error(), "Account not found") {
			return util.Uint160{}, fmt.Errorf("read %s backup owner: %w", label, err)
		}
		backup = util.Uint160{}
	}
	if backup != (util.Uint160{}) {
		return accountID, nil
	}
	if err := mainnetAnchorSendAndWait(ctx, act, client, aaCore, "registerAccount", report, label, accountID, zero, verifierParams, zero, backupOwner, mainnetAnchorAATimelock); err != nil {
		return util.Uint160{}, err
	}
	return accountID, nil
}

func mainnetAnchorComputeRegistrationAccountID(verifier util.Uint160, verifierParams []byte, hook util.Uint160, backupOwner util.Uint160, escapeTimelock int64) (util.Uint160, error) {
	if escapeTimelock < 0 || escapeTimelock > int64(^uint32(0)) {
		return util.Uint160{}, fmt.Errorf("invalid escape timelock")
	}
	payload := []byte{0xAA, 0x52, 0x47, 0x01}
	payload = append(payload, backupOwner.BytesLE()...)
	payload = append(payload, verifier.BytesLE()...)
	payload = append(payload, hook.BytesLE()...)
	timelock := make([]byte, 4)
	binary.LittleEndian.PutUint32(timelock, uint32(escapeTimelock))
	payload = append(payload, timelock...)
	payload = append(payload, verifierParams...)
	digest := hash.Hash160(payload)
	return util.Uint160DecodeBytesLE(digest.BytesBE())
}

func mainnetAnchorAAProxyScriptHash(aaCore util.Uint160, accountID util.Uint160) (util.Uint160, error) {
	script := []byte{0x0c, 0x14}
	script = append(script, accountID.BytesLE()...)
	script = append(script, []byte{0x11, 0xc0, 0x1f, 0x0c, 0x06, 'v', 'e', 'r', 'i', 'f', 'y', 0x0c, 0x14}...)
	script = append(script, aaCore.BytesBE()...)
	script = append(script, []byte{0x41, 0x62, 0x7d, 0x5b, 0x52}...)
	digest := hash.Hash160(script)
	return util.Uint160DecodeBytesBE(digest.BytesLE())
}

func mainnetAnchorEnsureAgent(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, appID string, account util.Uint160, candidate *keys.PublicKey, report *mainnetAnchorReport) error {
	count, err := mainnetAnchorCallInteger(act, contract, "getAgentCount", appID)
	if err != nil {
		return err
	}
	if count.Sign() > 0 {
		return nil
	}
	return mainnetAnchorSendAndWait(ctx, act, client, contract, "registerAgent", report, "Register "+appID+" AA agent", appID, account, candidate, account.BytesBE())
}

func mainnetAnchorEnsureAgentSet(ctx context.Context, act *actor.Actor, client *rpcclient.Client, aaCore util.Uint160, anchorHash util.Uint160, appID string, seedPrefix string, nonce string, backupOwner util.Uint160, candidate *keys.PublicKey, report *mainnetAnchorReport) ([]util.Uint160, error) {
	count, err := mainnetAnchorCallInteger(act, anchorHash, "getAgentCount", appID)
	if err != nil {
		return nil, err
	}
	current := int(count.Int64())
	if current > 21 {
		return nil, fmt.Errorf("%s has unexpected agent count %d", appID, current)
	}

	agents := make([]util.Uint160, 0, 21)
	for i := 1; i <= 21; i++ {
		label := fmt.Sprintf("%s-agent-%d", seedPrefix, i)
		verifierParams := []byte(fmt.Sprintf("anchor:%s:app:%s:agent:%02d:nonce:%s", seedPrefix, appID, i, nonce))
		accountID, err := mainnetAnchorEnsureAA(ctx, act, client, aaCore, backupOwner, verifierParams, report, label+" AA")
		if err != nil {
			return nil, err
		}
		agentAccount, err := mainnetAnchorAAProxyScriptHash(aaCore, accountID)
		if err != nil {
			return nil, fmt.Errorf("derive %s proxy account: %w", label, err)
		}
		report.AAAccounts[label] = "0x" + accountID.StringLE()
		agents = append(agents, agentAccount)
		if current < i {
			if err := mainnetAnchorSendAndWait(ctx, act, client, anchorHash, "registerAgent", report, "Register "+label, appID, agentAccount, candidate, accountID.BytesBE()); err != nil {
				return nil, err
			}
			continue
		}
		currentAccount, err := mainnetAnchorCallUint160(act, anchorHash, "getAgentAccount", appID, int64(i))
		if err != nil {
			return nil, fmt.Errorf("read %s current agent account: %w", label, err)
		}
		if currentAccount != agentAccount {
			if err := mainnetAnchorSendAndWait(ctx, act, client, anchorHash, "setAgentAccount", report, "Migrate "+label+" AA proxy account", appID, int64(i), agentAccount, accountID.BytesBE()); err != nil {
				return nil, err
			}
		}
	}
	return agents, nil
}

func mainnetAnchorEnsureAAVerifyScopes(ctx context.Context, act *actor.Actor, client *rpcclient.Client, aaCore util.Uint160, anchorHash util.Uint160, report *mainnetAnchorReport) error {
	if len(report.AAAccounts) == 0 {
		return nil
	}
	state, err := client.GetContractStateByHash(aaCore)
	if err != nil {
		return fmt.Errorf("read AA core manifest: %w", err)
	}
	if !mainnetAnchorHasMethod(&state.Manifest, "setVerifyScopeTargets", 2) {
		report.Validation["aa_verify_scope_skipped"] = "AA core does not expose setVerifyScopeTargets"
		return nil
	}
	accountIDs := make([]util.Uint160, 0, len(report.AAAccounts)*2)
	seen := map[string]bool{}
	for _, raw := range report.AAAccounts {
		accountID, err := mainnetAnchorParseHash(raw)
		if err != nil {
			return fmt.Errorf("parse AA account id %q: %w", raw, err)
		}
		appendScopeAccount := func(value util.Uint160) {
			key := value.StringLE()
			if seen[key] {
				return
			}
			seen[key] = true
			accountIDs = append(accountIDs, value)
		}
		appendScopeAccount(accountID)
		appendScopeAccount(mainnetAnchorReverseUint160LE(accountID))
	}
	if err := mainnetAnchorSendAndWait(ctx, act, client, aaCore, "setVerifyScopeTargets", report, "Set Anchor AA verify scopes", accountIDs, anchorHash); err != nil {
		return err
	}
	report.Validation["aa_verify_scope_target"] = "0x" + anchorHash.StringLE()
	report.Validation["aa_verify_scope_accounts"] = len(report.AAAccounts)
	report.Validation["aa_verify_scope_storage_keys"] = len(accountIDs)
	return nil
}

func mainnetAnchorReverseUint160LE(value util.Uint160) util.Uint160 {
	bytes := value.BytesLE()
	for left, right := 0, len(bytes)-1; left < right; left, right = left+1, right-1 {
		bytes[left], bytes[right] = bytes[right], bytes[left]
	}
	reversed, err := util.Uint160DecodeBytesLE(bytes)
	if err != nil {
		panic(err)
	}
	return reversed
}

func mainnetAnchorValidateRead(act *actor.Actor, contract util.Uint160, report *mainnetAnchorReport) error {
	trustMode, err := mainnetAnchorCallInteger(act, contract, "getAppMode", mainnetAnchorTrustApp)
	if err != nil {
		return err
	}
	profitMode, err := mainnetAnchorCallInteger(act, contract, "getAppMode", mainnetAnchorProfitApp)
	if err != nil {
		return err
	}
	trustAgents, err := mainnetAnchorCallInteger(act, contract, "getAgentCount", mainnetAnchorTrustApp)
	if err != nil {
		return err
	}
	profitAgents, err := mainnetAnchorCallInteger(act, contract, "getAgentCount", mainnetAnchorProfitApp)
	if err != nil {
		return err
	}
	selectedAgent, err := mainnetAnchorCallInteger(act, contract, "getSelectedAgentId", mainnetAnchorProfitApp)
	if err != nil {
		return err
	}
	if trustMode.Int64() != mainnetAnchorModeTrust || profitMode.Int64() != mainnetAnchorModeProfit {
		return fmt.Errorf("unexpected anchor modes: trust=%s profit=%s", trustMode.String(), profitMode.String())
	}
	if trustAgents.Int64() != 21 || profitAgents.Int64() != 21 {
		return fmt.Errorf("anchor agent validation failed: trustAgents=%s profitAgents=%s", trustAgents.String(), profitAgents.String())
	}
	report.Validation["trustanchor"] = map[string]string{"mode": trustMode.String(), "agent_count": trustAgents.String()}
	report.Validation["profitanchor"] = map[string]string{"mode": profitMode.String(), "agent_count": profitAgents.String(), "selected_agent_id": selectedAgent.String()}
	report.Validation["mainnet_stake_smoke"] = "not_run_by_deploy_script; requires a funded user account with at least 1 NEO"
	return nil
}

func mainnetAnchorSendAndWait(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, method string, report *mainnetAnchorReport, label string, params ...any) error {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return fmt.Errorf("%s (%s): %w", label, method, err)
	}
	fmt.Printf("%s tx: 0x%s\n", label, txid.StringLE())
	report.Transactions = append(report.Transactions, mainnetTxRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	return mainnetAnchorWaitForTx(ctx, client, txid)
}

func mainnetAnchorCallInteger(act *actor.Actor, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := mainnetAnchorCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	value, err := inv.Stack[0].TryInteger()
	if err != nil {
		return nil, fmt.Errorf("%s integer result: %w", method, err)
	}
	return value, nil
}

func mainnetAnchorCallUint160(act *actor.Actor, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
	inv, err := mainnetAnchorCallHALT(act, contract, method, params...)
	if err != nil {
		return util.Uint160{}, err
	}
	if len(inv.Stack) == 0 {
		return util.Uint160{}, nil
	}
	bytes, err := inv.Stack[0].TryBytes()
	if err != nil {
		return util.Uint160{}, fmt.Errorf("%s hash160 result: %w", method, err)
	}
	return util.Uint160DecodeBytesBE(bytes)
}

func mainnetAnchorCallBytes(act *actor.Actor, contract util.Uint160, method string, params ...any) ([]byte, error) {
	inv, err := mainnetAnchorCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return nil, nil
	}
	return inv.Stack[0].TryBytes()
}

func mainnetAnchorCallHALT(act *actor.Actor, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func mainnetAnchorWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(2 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("timeout waiting for transaction 0x%s", txid.StringLE())
		case <-ticker.C:
			appLog, err := client.GetApplicationLog(txid, nil)
			if err != nil {
				continue
			}
			if len(appLog.Executions) == 0 {
				continue
			}
			exec := appLog.Executions[0]
			if exec.VMState.HasFlag(1) {
				return nil
			}
			return fmt.Errorf("transaction 0x%s failed: %s", txid.StringLE(), exec.FaultException)
		}
	}
}

func mainnetAnchorLoadNEF(path string) (*nef.File, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	file, err := nef.FileFromBytes(data)
	if err != nil {
		return nil, err
	}
	return &file, nil
}

func mainnetAnchorLoadManifest(path string) (*manifest.Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m manifest.Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

func mainnetAnchorHasMethod(m *manifest.Manifest, name string, paramCount int) bool {
	if m == nil {
		return false
	}
	for _, method := range m.ABI.Methods {
		if method.Name == name && len(method.Parameters) == paramCount {
			return true
		}
	}
	return false
}

func mainnetAnchorParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func mainnetAnchorWriteReport(report mainnetAnchorReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(mainnetAnchorReportPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(mainnetAnchorReportPath, append(out, '\n'), 0644)
}

func mainnetAnchorFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
