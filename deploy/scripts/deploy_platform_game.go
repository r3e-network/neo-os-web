//go:build scripts

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
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
	pgConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	pgTestnetMagic  = uint32(894710606)
	pgMainnetMagic  = uint32(860833102)

	pgGameTypeCountdown = int64(1)
	pgGameTypeCoinFlip  = int64(2)
	pgGameTypeGacha     = int64(3)
	pgGameTypeDice      = int64(4)

	pgDefaultMainnetRPC = "https://mainnet2.neo.coz.io:443"
	pgDefaultTestnetRPC = "https://testnet1.neo.coz.io:443"

	pgMainnetMorpheusOracle = "0x5b492098fc094c760402e01f7e0b631b939d2bea"
	pgMainnetAA             = "0x0268a387913b250166ddec032b03332690a1ef78"
)

type pgReport struct {
	Network        string                 `json:"network"`
	RPCURL         string                 `json:"rpc_url"`
	NetworkMagic   uint32                 `json:"network_magic"`
	Signer         string                 `json:"signer"`
	SignerHash     string                 `json:"signer_hash"`
	PlatformGame   string                 `json:"platform_game"`
	PredictedHash  string                 `json:"predicted_hash"`
	DryRun         bool                   `json:"dry_run"`
	SkippedReason  string                 `json:"skipped_reason,omitempty"`
	Transactions   []pgTxRecord           `json:"transactions"`
	Registrations  []pgRegistrationRecord `json:"registrations"`
	Validation     map[string]interface{} `json:"validation"`
	GeneratedAtUTC string                 `json:"generated_at_utc"`
}

type pgTxRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

type pgRegistrationRecord struct {
	AppID         string `json:"app_id"`
	GameType      int64  `json:"game_type"`
	Registered    bool   `json:"registered"`
	SkippedReason string `json:"skipped_reason,omitempty"`
	TxID          string `json:"txid,omitempty"`
}

type pgAppSpec struct {
	AppID    string
	GameType int64
}

func main() {
	if err := pgRun(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func pgRun() error {
	dryRun := pgTruthy(os.Getenv("PLATFORM_GAME_DEPLOY_DRY_RUN"))
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_GAME_DEPLOY") != pgConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_GAME_DEPLOY=%s to write chain", pgConfirmPhrase)
	}

	network := strings.ToLower(pgFirstNonEmpty(os.Getenv("PLATFORM_GAME_DEPLOY_NETWORK"), "testnet"))
	expectedMagic, networkID, rpcURL, wif, reportPath, err := pgNetworkConfig(network)
	if err != nil {
		return err
	}
	if wif == "" {
		return fmt.Errorf("%s deployer WIF is not configured", network)
	}

	ctx := context.Background()
	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{DialTimeout: 20 * time.Second, RequestTimeout: 20 * time.Second})
	if err != nil {
		return fmt.Errorf("connect RPC: %w", err)
	}
	version, err := client.GetVersion()
	if err != nil {
		return fmt.Errorf("read RPC version: %w", err)
	}
	actualMagic := uint32(version.Protocol.Network)
	if actualMagic != expectedMagic {
		return fmt.Errorf("RPC network magic mismatch: got %d, expected %d for %s", actualMagic, expectedMagic, network)
	}

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("invalid %s deployer WIF", network)
	}
	acc := wallet.NewAccountFromPrivateKey(priv)
	signerHash := priv.GetScriptHash()

	act, err := actor.New(client, []actor.SignerAccount{{
		Signer:  transaction.Signer{Account: acc.Contract.ScriptHash(), Scopes: transaction.Global},
		Account: acc,
	}})
	if err != nil {
		return fmt.Errorf("create actor: %w", err)
	}

	report := pgReport{
		Network:        networkID,
		RPCURL:         rpcURL,
		NetworkMagic:   actualMagic,
		Signer:         acc.Address,
		SignerHash:     "0x" + signerHash.StringLE(),
		DryRun:         dryRun,
		Transactions:   []pgTxRecord{},
		Registrations:  []pgRegistrationRecord{},
		Validation:     map[string]interface{}{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}

	gameHash, predicted, deployed, err := pgDeploy(ctx, client, act, signerHash, dryRun, &report)
	if err != nil {
		return err
	}
	report.PredictedHash = "0x" + predicted.StringLE()
	report.PlatformGame = "0x" + gameHash.StringLE()
	if dryRun && !deployed {
		report.SkippedReason = "dry run: PlatformGame deployment is eligible"
		return pgWriteReport(reportPath, report)
	}

	if err := pgEnsureAdminControlled(act, gameHash, signerHash, &report); err != nil {
		return err
	}
	if err := pgConfigureDependency(ctx, act, client, gameHash, "oracle", pgResolveOracleHash(network), dryRun, &report); err != nil {
		return err
	}
	if err := pgConfigureDependency(ctx, act, client, gameHash, "abstractAccount", pgResolveAAHash(network), dryRun, &report); err != nil {
		return err
	}
	if err := pgRegisterApps(ctx, act, client, gameHash, signerHash, dryRun, &report); err != nil {
		return err
	}
	if err := pgValidateRuntime(ctx, act, client, gameHash, dryRun, &report); err != nil {
		return err
	}

	if err := pgWriteReport(reportPath, report); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	return nil
}

func pgNetworkConfig(network string) (uint32, string, string, string, string, error) {
	switch network {
	case "mainnet":
		return pgMainnetMagic,
			"neo-n3-mainnet",
			pgFirstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), pgDefaultMainnetRPC),
			pgFirstNonEmpty(os.Getenv("MINIAPP_MAINNET_DEPLOY_WIF"), os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF")),
			"contracts/build/mainnet_game_deployment.json",
			nil
	case "testnet":
		return pgTestnetMagic,
			"neo-n3-testnet",
			pgFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), pgDefaultTestnetRPC),
			pgFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"), os.Getenv("FLAGSHIP_LIVE_WIF")),
			"contracts/build/testnet_game_deployment.json",
			nil
	default:
		return 0, "", "", "", "", fmt.Errorf("unsupported PLATFORM_GAME_DEPLOY_NETWORK=%q", network)
	}
}

func pgDeploy(ctx context.Context, client *rpcclient.Client, act *actor.Actor, deployer util.Uint160, dryRun bool, report *pgReport) (util.Uint160, util.Uint160, bool, error) {
	nefFile, err := pgLoadNEF("contracts/build/PlatformGame.nef")
	if err != nil {
		return util.Uint160{}, util.Uint160{}, false, err
	}
	mani, err := pgLoadManifest("contracts/build/PlatformGame.manifest.json")
	if err != nil {
		return util.Uint160{}, util.Uint160{}, false, err
	}
	expected := state.CreateContractHash(deployer, nefFile.Checksum, mani.Name)
	if _, err := client.GetContractStateByHash(expected); err == nil {
		return expected, expected, true, nil
	}
	if dryRun {
		return expected, expected, false, nil
	}
	txid, vub, err := management.New(act).Deploy(nefFile, mani, nil)
	if err != nil {
		return util.Uint160{}, expected, false, fmt.Errorf("deploy PlatformGame: %w", err)
	}
	report.Transactions = append(report.Transactions, pgTxRecord{Label: "Deploy PlatformGame", TxID: "0x" + txid.StringLE(), VUB: vub})
	if err := pgWaitForTx(ctx, client, txid); err != nil {
		return util.Uint160{}, expected, false, fmt.Errorf("wait deploy PlatformGame: %w", err)
	}
	return expected, expected, true, nil
}

func pgEnsureAdminControlled(act *actor.Actor, gameHash util.Uint160, signer util.Uint160, report *pgReport) error {
	admin, err := pgCallUint160(act, gameHash, "admin")
	if err != nil {
		return fmt.Errorf("read PlatformGame admin: %w", err)
	}
	report.Validation["admin"] = "0x" + admin.StringLE()
	report.Validation["admin_matches_signer"] = admin == signer
	if admin != signer {
		return fmt.Errorf("deployed PlatformGame admin is not current signer")
	}
	return nil
}

func pgConfigureDependency(ctx context.Context, act *actor.Actor, client *rpcclient.Client, gameHash util.Uint160, getter string, targetRaw string, dryRun bool, report *pgReport) error {
	if strings.TrimSpace(targetRaw) == "" {
		report.Validation[getter+"_configured"] = false
		report.Validation[getter+"_skipped_reason"] = "target hash not configured"
		return nil
	}
	target, err := pgParseHash(targetRaw)
	if err != nil {
		return fmt.Errorf("parse %s target: %w", getter, err)
	}
	current, err := pgCallUint160(act, gameHash, getter)
	if err != nil {
		return fmt.Errorf("read %s: %w", getter, err)
	}
	report.Validation[getter] = "0x" + current.StringLE()
	report.Validation[getter+"_target"] = "0x" + target.StringLE()
	if current == target {
		report.Validation[getter+"_configured"] = true
		return nil
	}
	if dryRun {
		report.Validation[getter+"_configured"] = false
		report.Validation[getter+"_skipped_reason"] = "dry run: eligible for update"
		return nil
	}
	method := "set" + strings.ToUpper(getter[:1]) + getter[1:]
	if err := pgSendAndWait(ctx, act, client, gameHash, method, report, "Configure PlatformGame "+getter, target); err != nil {
		return err
	}
	after, err := pgCallUint160(act, gameHash, getter)
	if err != nil {
		return fmt.Errorf("read %s after configure: %w", getter, err)
	}
	report.Validation[getter] = "0x" + after.StringLE()
	report.Validation[getter+"_configured"] = after == target
	if after != target {
		return fmt.Errorf("%s configuration did not persist", getter)
	}
	return nil
}

func pgRegisterApps(ctx context.Context, act *actor.Actor, client *rpcclient.Client, gameHash util.Uint160, admin util.Uint160, dryRun bool, report *pgReport) error {
	for _, spec := range pgAppSpecs() {
		record := pgRegistrationRecord{AppID: spec.AppID, GameType: spec.GameType}
		current, err := pgCallInteger(act, gameHash, "getGameType", spec.AppID)
		if err != nil {
			return fmt.Errorf("read game type for %s: %w", spec.AppID, err)
		}
		switch {
		case current.Int64() == spec.GameType:
			record.Registered = true
			record.SkippedReason = "already registered"
		case current.Sign() != 0:
			record.SkippedReason = "appId already registered with different game type " + current.String()
		case dryRun:
			record.SkippedReason = "dry run: eligible for registerGame"
		default:
			txid, vub, err := act.SendCall(gameHash, "registerGame", spec.AppID, spec.GameType, admin, []byte{})
			if err != nil {
				return fmt.Errorf("register %s: %w", spec.AppID, err)
			}
			record.TxID = "0x" + txid.StringLE()
			report.Transactions = append(report.Transactions, pgTxRecord{Label: "Register " + spec.AppID, TxID: record.TxID, VUB: vub})
			if err := pgWaitForTx(ctx, client, txid); err != nil {
				return fmt.Errorf("wait register %s: %w", spec.AppID, err)
			}
			after, err := pgCallInteger(act, gameHash, "getGameType", spec.AppID)
			if err != nil {
				return fmt.Errorf("validate registration %s: %w", spec.AppID, err)
			}
			record.Registered = after.Int64() == spec.GameType
			if !record.Registered {
				return fmt.Errorf("%s registration validation failed", spec.AppID)
			}
		}
		report.Registrations = append(report.Registrations, record)
	}
	return nil
}

func pgValidateRuntime(ctx context.Context, act *actor.Actor, client *rpcclient.Client, gameHash util.Uint160, dryRun bool, report *pgReport) error {
	for _, spec := range pgAppSpecs() {
		current, err := pgCallInteger(act, gameHash, "getGameType", spec.AppID)
		if err != nil {
			return err
		}
		report.Validation[spec.AppID+"_game_type"] = current.String()
	}
	if dryRun {
		return nil
	}
	status, err := pgCallCountdownStatus(act, gameHash, "miniapp-last-survivor")
	if err != nil {
		return err
	}
	if !status.Active {
		if err := pgSendAndWait(ctx, act, client, gameHash, "startCountdownRound", report, "Start LastSurvivor countdown round", "miniapp-last-survivor"); err != nil {
			return err
		}
		status, err = pgCallCountdownStatus(act, gameHash, "miniapp-last-survivor")
		if err != nil {
			return err
		}
	}
	report.Validation["last_survivor_round_id"] = status.RoundID.String()
	report.Validation["last_survivor_active"] = status.Active
	if !status.Active || status.RoundID.Sign() == 0 {
		return fmt.Errorf("LastSurvivor round is not active after deployment validation")
	}
	limits, err := pgCallMap(act, gameHash, "getDiceBetLimits", "miniapp-dice-game")
	if err != nil {
		return err
	}
	report.Validation["dice_limits"] = limits
	return nil
}

type pgCountdownStatus struct {
	RoundID *big.Int
	Active  bool
}

func pgCallCountdownStatus(act *actor.Actor, contract util.Uint160, appID string) (pgCountdownStatus, error) {
	raw, err := pgCallMap(act, contract, "getCountdownStatus", appID)
	if err != nil {
		return pgCountdownStatus{}, err
	}
	status := pgCountdownStatus{RoundID: big.NewInt(0)}
	if v, ok := raw["roundId"].(string); ok {
		if parsed, ok := new(big.Int).SetString(v, 10); ok {
			status.RoundID = parsed
		}
	}
	if v, ok := raw["active"].(bool); ok {
		status.Active = v
	}
	return status, nil
}

func pgAppSpecs() []pgAppSpec {
	raw := pgFirstNonEmpty(os.Getenv("PLATFORM_GAME_DEPLOY_APP_SPECS"), "miniapp-last-survivor:1,miniapp-fogplay:2,miniapp-gasbox:3,miniapp-dice-game:4")
	parts := strings.Split(raw, ",")
	specs := make([]pgAppSpec, 0, len(parts))
	for _, part := range parts {
		pair := strings.Split(strings.TrimSpace(part), ":")
		if len(pair) != 2 {
			continue
		}
		gameType, err := strconv.ParseInt(strings.TrimSpace(pair[1]), 10, 64)
		if err != nil || gameType <= 0 {
			continue
		}
		specs = append(specs, pgAppSpec{AppID: strings.TrimSpace(pair[0]), GameType: gameType})
	}
	return specs
}

func pgResolveOracleHash(network string) string {
	return pgFirstNonEmpty(os.Getenv("PLATFORM_GAME_ORACLE_HASH"), os.Getenv("MORPHEUS_ORACLE_HASH"), pgNetworkDefault(network, pgMainnetMorpheusOracle, ""))
}

func pgResolveAAHash(network string) string {
	return pgFirstNonEmpty(os.Getenv("PLATFORM_GAME_AA_HASH"), os.Getenv("ABSTRACT_ACCOUNT_HASH"), pgNetworkDefault(network, pgMainnetAA, ""))
}

func pgNetworkDefault(network string, mainnetValue string, testnetValue string) string {
	if network == "mainnet" {
		return mainnetValue
	}
	return testnetValue
}

func pgSendAndWait(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, method string, report *pgReport, label string, params ...any) error {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return fmt.Errorf("%s (%s): %w", label, method, err)
	}
	report.Transactions = append(report.Transactions, pgTxRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	return pgWaitForTx(ctx, client, txid)
}

func pgCallHALT(act *actor.Actor, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func pgCallInteger(act *actor.Actor, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := pgCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	return inv.Stack[0].TryInteger()
}

func pgCallUint160(act *actor.Actor, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
	inv, err := pgCallHALT(act, contract, method, params...)
	if err != nil {
		return util.Uint160{}, err
	}
	if len(inv.Stack) == 0 {
		return util.Uint160{}, nil
	}
	bytes, err := inv.Stack[0].TryBytes()
	if err != nil {
		return util.Uint160{}, err
	}
	return util.Uint160DecodeBytesBE(bytes)
}

func pgCallMap(act *actor.Actor, contract util.Uint160, method string, params ...any) (map[string]interface{}, error) {
	inv, err := pgCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	out := map[string]interface{}{}
	if len(inv.Stack) == 0 {
		return out, nil
	}
	elements, ok := inv.Stack[0].Value().([]stackitem.MapElement)
	if !ok {
		return out, nil
	}
	for _, element := range elements {
		keyBytes, err := element.Key.TryBytes()
		if err != nil {
			continue
		}
		out[string(keyBytes)] = pgStackValue(element.Value)
	}
	return out, nil
}

func pgStackValue(item stackitem.Item) interface{} {
	switch item.Type() {
	case stackitem.BooleanT:
		if v, err := item.TryBool(); err == nil {
			return v
		}
	case stackitem.IntegerT:
		if v, err := item.TryInteger(); err == nil {
			return v.String()
		}
	case stackitem.ByteArrayT, stackitem.BufferT:
		bytes, err := item.TryBytes()
		if err != nil {
			break
		}
		if len(bytes) == 20 {
			if hash, err := util.Uint160DecodeBytesBE(bytes); err == nil {
				return "0x" + hash.StringLE()
			}
		}
		return string(bytes)
	}
	return fmt.Sprintf("%v", item.Value())
}

func pgWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(150 * time.Second)
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

func pgLoadNEF(path string) (*nef.File, error) {
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

func pgLoadManifest(path string) (*manifest.Manifest, error) {
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

func pgParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func pgWriteReport(path string, report pgReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, append(out, '\n'), 0644)
}

func pgFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func pgTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y":
		return true
	default:
		return false
	}
}
