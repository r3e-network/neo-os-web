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
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	appTrustAnchor  = "miniapp-trustanchor"
	appProfitAnchor = "miniapp-profitanchor"
	appSelfLoan     = "miniapp-self-loan"

	modeTrust      = int64(1)
	modeProfit     = int64(2)
	productLending = int64(1)

	oneNeo          = int64(1)
	centGasFixed8   = int64(1_000_000)
	selfLoanGasSeed = int64(20_000_000)
	aaTimelock      = int64(30 * 24 * 60 * 60)

	defaultRPCURL     = "https://testnet1.neo.coz.io:443"
	defaultAAHash     = "0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38"
	defaultCandidate  = "023e9b32ea89b94d066e649b124fd50e396ee91369e8e2a6ae1b11c170d022256d"
	neoNativeHashLE   = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"
	gasNativeHashLE   = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	reportOutputPath  = "contracts/build/testnet_anchor_deployment.json"
)

type deploymentReport struct {
	Network          string            `json:"network"`
	RPCURL           string            `json:"rpc_url"`
	Deployer         string            `json:"deployer"`
	DeployerHash     string            `json:"deployer_hash"`
	PlatformAnchor   string            `json:"platform_anchor"`
	PlatformDeFi     string            `json:"platform_defi"`
	AACore           string            `json:"aa_core"`
	Candidate        string            `json:"candidate"`
	AAAccounts       map[string]string `json:"aa_accounts"`
	Transactions     []txRecord        `json:"transactions"`
	Validation       map[string]any    `json:"validation"`
	GeneratedAtUTC   string            `json:"generated_at_utc"`
}

type txRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

type deployableContract struct {
	Name     string
	NEFPath  string
	Manifest string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	ctx := context.Background()
	rpcURL := firstNonEmpty(os.Getenv("NEO_RPC_URL"), defaultRPCURL)
	wif := firstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"), os.Getenv("FLAGSHIP_LIVE_WIF"))
	if wif == "" {
		return fmt.Errorf("NEO_TESTNET_WIF, FLAGSHIP_TESTNET_WIF, or FLAGSHIP_LIVE_WIF is required")
	}

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("invalid testnet WIF: %w", err)
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

	neoHash, err := parseHash(neoNativeHashLE)
	if err != nil {
		return err
	}
	gasHash, err := parseHash(gasNativeHashLE)
	if err != nil {
		return err
	}
	aaHash, err := parseHash(firstNonEmpty(os.Getenv("AA_CORE_HASH_TESTNET"), os.Getenv("CONTRACT_AA_CORE_HASH"), defaultAAHash))
	if err != nil {
		return fmt.Errorf("parse AA core hash: %w", err)
	}
	candidate, err := keys.NewPublicKeyFromString(firstNonEmpty(os.Getenv("ANCHOR_TESTNET_CANDIDATE"), defaultCandidate))
	if err != nil {
		return fmt.Errorf("parse candidate public key: %w", err)
	}

	report := deploymentReport{
		Network:        "neo-n3-testnet",
		RPCURL:         rpcURL,
		Deployer:       acc.Address,
		DeployerHash:   "0x" + deployerHash.StringLE(),
		AACore:         "0x" + aaHash.StringLE(),
		Candidate:      candidate.StringCompressed(),
		AAAccounts:     map[string]string{},
		Transactions:   []txRecord{},
		Validation:     map[string]any{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}

	fmt.Printf("RPC: %s\n", rpcURL)
	fmt.Printf("Deployer: %s\n", acc.Address)

	anchorHash, err := deploy(ctx, client, act, deployerHash, deployableContract{
		Name:     "PlatformAnchor",
		NEFPath:  "contracts/build/PlatformAnchor.nef",
		Manifest: "contracts/build/PlatformAnchor.manifest.json",
	}, &report)
	if err != nil {
		return err
	}
	report.PlatformAnchor = "0x" + anchorHash.StringLE()

	defiHash, err := deploy(ctx, client, act, deployerHash, deployableContract{
		Name:     "PlatformDeFi",
		NEFPath:  "contracts/build/PlatformDeFi.nef",
		Manifest: "contracts/build/PlatformDeFi.manifest.json",
	}, &report)
	if err != nil {
		return err
	}
	report.PlatformDeFi = "0x" + defiHash.StringLE()

	if err := ensureAnchorApp(ctx, act, client, anchorHash, appTrustAnchor, modeTrust, deployerHash, &report); err != nil {
		return err
	}
	if err := ensureAnchorApp(ctx, act, client, anchorHash, appProfitAnchor, modeProfit, deployerHash, &report); err != nil {
		return err
	}
	if err := ensureProduct(ctx, act, client, defiHash, appSelfLoan, productLending, deployerHash, &report); err != nil {
		return err
	}

	trustAA, err := ensureAAAccount(ctx, act, client, aaHash, deployerHash, []byte("trustanchor-agent-1"), &report, "TrustAnchor agent AA")
	if err != nil {
		return err
	}
	profitAA, err := ensureAAAccount(ctx, act, client, aaHash, deployerHash, []byte("profitanchor-agent-1"), &report, "ProfitAnchor agent AA")
	if err != nil {
		return err
	}
	report.AAAccounts["trustanchor-agent-1"] = "0x" + trustAA.StringLE()
	report.AAAccounts["profitanchor-agent-1"] = "0x" + profitAA.StringLE()

	if err := ensureAgent(ctx, act, client, anchorHash, appTrustAnchor, trustAA, candidate, &report); err != nil {
		return err
	}
	if err := ensureAgent(ctx, act, client, anchorHash, appProfitAnchor, profitAA, candidate, &report); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, anchorHash, "setAgentProfitScore", &report, "Set ProfitAnchor agent score", appProfitAnchor, int64(1), int64(1_000_000)); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, defiHash, "setProfitAnchor", &report, "Configure SelfLoan ProfitAnchor", appSelfLoan, anchorHash, appProfitAnchor); err != nil {
		return err
	}

	if err := validateTrustAnchor(ctx, act, client, neoHash, anchorHash, deployerHash, &report); err != nil {
		return err
	}
	if err := validateProfitAnchor(ctx, act, client, neoHash, gasHash, anchorHash, deployerHash, &report); err != nil {
		return err
	}
	if err := validateSelfLoan(ctx, act, client, neoHash, gasHash, defiHash, deployerHash, &report); err != nil {
		return err
	}

	if err := writeReport(report); err != nil {
		return err
	}

	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	return nil
}

func deploy(ctx context.Context, client *rpcclient.Client, act *actor.Actor, deployer util.Uint160, target deployableContract, report *deploymentReport) (util.Uint160, error) {
	nefFile, err := loadNEF(target.NEFPath)
	if err != nil {
		return util.Uint160{}, err
	}
	mani, err := loadManifest(target.Manifest)
	if err != nil {
		return util.Uint160{}, err
	}
	expected := state.CreateContractHash(deployer, nefFile.Checksum, mani.Name)
	fmt.Printf("%s expected hash: 0x%s\n", target.Name, expected.StringLE())

	if _, err := client.GetContractStateByHash(expected); err == nil {
		fmt.Printf("%s already deployed\n", target.Name)
		return expected, nil
	}

	txid, vub, err := management.New(act).Deploy(nefFile, mani, nil)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("deploy %s: %w", target.Name, err)
	}
	report.Transactions = append(report.Transactions, txRecord{Label: "Deploy " + target.Name, TxID: "0x" + txid.StringLE(), VUB: vub})
	if err := waitForTx(ctx, client, txid); err != nil {
		return util.Uint160{}, fmt.Errorf("wait deploy %s: %w", target.Name, err)
	}
	if _, err := client.GetContractStateByHash(expected); err != nil {
		return util.Uint160{}, fmt.Errorf("%s deployed tx confirmed but contract missing: %w", target.Name, err)
	}
	return expected, nil
}

func ensureAnchorApp(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, appID string, mode int64, admin util.Uint160, report *deploymentReport) error {
	current, err := callInteger(act, contract, "getAppMode", appID)
	if err != nil {
		return err
	}
	if current.Int64() == mode {
		return nil
	}
	if current.Sign() != 0 {
		return fmt.Errorf("%s already registered with unexpected mode %s", appID, current.String())
	}
	return sendAndWait(ctx, act, client, contract, "registerAnchorApp", report, "Register "+appID, appID, mode, admin)
}

func ensureProduct(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, appID string, productType int64, admin util.Uint160, report *deploymentReport) error {
	current, err := callInteger(act, contract, "getProductType", appID)
	if err != nil {
		return err
	}
	if current.Int64() == productType {
		return nil
	}
	if current.Sign() != 0 {
		return fmt.Errorf("%s already registered with unexpected product type %s", appID, current.String())
	}
	return sendAndWait(ctx, act, client, contract, "registerProduct", report, "Register "+appID, appID, productType, admin, []byte{})
}

func ensureAAAccount(ctx context.Context, act *actor.Actor, client *rpcclient.Client, aaCore util.Uint160, backupOwner util.Uint160, verifierParams []byte, report *deploymentReport, label string) (util.Uint160, error) {
	zero := util.Uint160{}
	accountID, err := computeRegistrationAccountID(zero, verifierParams, zero, backupOwner, aaTimelock)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("compute %s: %w", label, err)
	}
	backup, err := callUint160(act, aaCore, "getBackupOwner", accountID)
	if err != nil {
		if !strings.Contains(err.Error(), "Account not found") {
			return util.Uint160{}, fmt.Errorf("read %s backup owner: %w", label, err)
		}
		backup = util.Uint160{}
	}
	if backup != (util.Uint160{}) {
		return accountID, nil
	}
	if err := sendAndWait(ctx, act, client, aaCore, "registerAccount", report, label, accountID, zero, verifierParams, zero, backupOwner, aaTimelock); err != nil {
		return util.Uint160{}, err
	}
	return accountID, nil
}

func computeRegistrationAccountID(verifier util.Uint160, verifierParams []byte, hook util.Uint160, backupOwner util.Uint160, escapeTimelock int64) (util.Uint160, error) {
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

func ensureAgent(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, appID string, account util.Uint160, candidate *keys.PublicKey, report *deploymentReport) error {
	count, err := callInteger(act, contract, "getAgentCount", appID)
	if err != nil {
		return err
	}
	if count.Sign() > 0 {
		return nil
	}
	return sendAndWait(ctx, act, client, contract, "registerAgent", report, "Register "+appID+" AA agent", appID, account, candidate, account.BytesBE())
}

func validateTrustAnchor(ctx context.Context, act *actor.Actor, client *rpcclient.Client, neoHash util.Uint160, anchorHash util.Uint160, deployer util.Uint160, report *deploymentReport) error {
	if err := sendAndWait(ctx, act, client, neoHash, "transfer", report, "TrustAnchor stake 1 NEO", deployer, anchorHash, oneNeo, appTrustAnchor); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, anchorHash, "votePooledStake", report, "TrustAnchor pooled vote", appTrustAnchor, int64(1)); err != nil {
		return err
	}
	stake, err := callInteger(act, anchorHash, "getUserStake", appTrustAnchor, deployer)
	if err != nil {
		return err
	}
	if stake.Int64() < oneNeo {
		return fmt.Errorf("TrustAnchor live stake validation failed: got %s", stake.String())
	}
	if err := sendAndWait(ctx, act, client, anchorHash, "withdraw", report, "TrustAnchor withdraw 1 NEO", appTrustAnchor, deployer, oneNeo); err != nil {
		return err
	}
	stakeAfter, err := callInteger(act, anchorHash, "getUserStake", appTrustAnchor, deployer)
	if err != nil {
		return err
	}
	report.Validation["trustanchor"] = map[string]string{"stake_after_deposit": stake.String(), "stake_after_withdraw": stakeAfter.String()}
	return nil
}

func validateProfitAnchor(ctx context.Context, act *actor.Actor, client *rpcclient.Client, neoHash util.Uint160, gasHash util.Uint160, anchorHash util.Uint160, deployer util.Uint160, report *deploymentReport) error {
	if err := sendAndWait(ctx, act, client, neoHash, "transfer", report, "ProfitAnchor stake 1 NEO", deployer, anchorHash, oneNeo, appProfitAnchor); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, gasHash, "transfer", report, "ProfitAnchor fund 0.01 GAS credit", deployer, anchorHash, centGasFixed8, nil); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, anchorHash, "fundRewards", report, "ProfitAnchor fund rewards", appProfitAnchor, deployer, centGasFixed8); err != nil {
		return err
	}
	pending, err := callInteger(act, anchorHash, "getPendingRewards", appProfitAnchor, deployer)
	if err != nil {
		return err
	}
	if pending.Int64() < centGasFixed8 {
		return fmt.Errorf("ProfitAnchor pending rewards too low: got %s", pending.String())
	}
	if err := sendAndWait(ctx, act, client, anchorHash, "claimRewards", report, "ProfitAnchor claim rewards", appProfitAnchor, deployer); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, anchorHash, "voteBestProfitCandidate", report, "ProfitAnchor vote best candidate", appProfitAnchor); err != nil {
		return err
	}
	best, err := callBytes(act, anchorHash, "getBestCandidate", appProfitAnchor)
	if err != nil {
		return err
	}
	if len(best) != 33 {
		return fmt.Errorf("ProfitAnchor best candidate missing after score set")
	}
	if err := sendAndWait(ctx, act, client, anchorHash, "withdraw", report, "ProfitAnchor withdraw 1 NEO", appProfitAnchor, deployer, oneNeo); err != nil {
		return err
	}
	stakeAfter, err := callInteger(act, anchorHash, "getUserStake", appProfitAnchor, deployer)
	if err != nil {
		return err
	}
	report.Validation["profitanchor"] = map[string]string{
		"pending_reward_before_claim": pending.String(),
		"best_candidate_bytes":        fmt.Sprintf("%x", best),
		"stake_after_withdraw":        stakeAfter.String(),
	}
	return nil
}

func validateSelfLoan(ctx context.Context, act *actor.Actor, client *rpcclient.Client, neoHash util.Uint160, gasHash util.Uint160, defiHash util.Uint160, deployer util.Uint160, report *deploymentReport) error {
	before, err := callInteger(act, defiHash, "getProductType", appSelfLoan)
	if err != nil {
		return err
	}
	if before.Int64() != productLending {
		return fmt.Errorf("SelfLoan product not registered: got %s", before.String())
	}
	if err := sendAndWait(ctx, act, client, gasHash, "transfer", report, "SelfLoan seed 0.2 GAS", deployer, defiHash, selfLoanGasSeed, nil); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, neoHash, "transfer", report, "SelfLoan deposit 1 NEO collateral", deployer, defiHash, oneNeo, nil); err != nil {
		return err
	}
	totalBefore, err := callInteger(act, defiHash, "getLendingStatsTotalLoans", appSelfLoan)
	if err != nil {
		totalBefore = big.NewInt(0)
	}
	if err := sendAndWait(ctx, act, client, defiHash, "createLoan", report, "SelfLoan create loan", appSelfLoan, deployer, int64(1)); err != nil {
		return err
	}
	totalAfter, err := callInteger(act, defiHash, "getLendingStatsTotalLoans", appSelfLoan)
	if err != nil {
		totalAfter = big.NewInt(0)
	}
	if totalAfter.Sign() == 0 {
		stats, statsErr := callMap(act, defiHash, "getLendingStats", appSelfLoan)
		if statsErr == nil {
			if value, ok := stats["totalLoans"]; ok {
				totalAfter = value
			}
		}
	}
	if totalAfter.Sign() == 0 {
		return fmt.Errorf("SelfLoan loan count did not increase")
	}
	loanID := totalAfter.Int64()
	if err := sendAndWait(ctx, act, client, defiHash, "syncProfitAnchorVote", report, "SelfLoan sync ProfitAnchor vote", appSelfLoan); err != nil {
		return err
	}
	if err := sendAndWait(ctx, act, client, defiHash, "repayLoan", report, "SelfLoan repay and close loan", appSelfLoan, loanID); err != nil {
		return err
	}
	stats, err := callMap(act, defiHash, "getLendingStats", appSelfLoan)
	if err != nil {
		return err
	}
	report.Validation["selfloan"] = map[string]string{
		"total_loans_before": totalBefore.String(),
		"total_loans_after":  totalAfter.String(),
		"total_debt":         stringValue(stats["totalDebt"]),
		"total_collateral":   stringValue(stats["totalCollateral"]),
	}
	return nil
}

func sendAndWait(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, method string, report *deploymentReport, label string, params ...any) error {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return fmt.Errorf("%s (%s): %w", label, method, err)
	}
	fmt.Printf("%s tx: 0x%s\n", label, txid.StringLE())
	report.Transactions = append(report.Transactions, txRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	return waitForTx(ctx, client, txid)
}

func callInteger(act *actor.Actor, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := callHALT(act, contract, method, params...)
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

func callUint160(act *actor.Actor, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
	inv, err := callHALT(act, contract, method, params...)
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

func callBytes(act *actor.Actor, contract util.Uint160, method string, params ...any) ([]byte, error) {
	inv, err := callHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return nil, nil
	}
	return inv.Stack[0].TryBytes()
}

func callMap(act *actor.Actor, contract util.Uint160, method string, params ...any) (map[string]*big.Int, error) {
	inv, err := callHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	result := map[string]*big.Int{}
	if len(inv.Stack) == 0 {
		return result, nil
	}
	m, ok := inv.Stack[0].Value().([]stackitem.MapElement)
	if !ok {
		return result, nil
	}
	for _, entry := range m {
		keyBytes, err := entry.Key.TryBytes()
		if err != nil {
			continue
		}
		value, err := entry.Value.TryInteger()
		if err != nil {
			continue
		}
		result[string(keyBytes)] = value
	}
	return result, nil
}

func callHALT(act *actor.Actor, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func waitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
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

func loadNEF(path string) (*nef.File, error) {
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

func loadManifest(path string) (*manifest.Manifest, error) {
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

func parseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func writeReport(report deploymentReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(reportOutputPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(reportOutputPath, append(out, '\n'), 0644)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func stringValue(value *big.Int) string {
	if value == nil {
		return "0"
	}
	return value.String()
}
