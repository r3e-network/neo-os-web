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

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/neorpc/result"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	gameRegisterConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	gameRegisterTestnetMagic  = uint32(894710606)
	gameRegisterMainnetMagic  = uint32(860833102)
)

type gameRegisterReport struct {
	Network        string                 `json:"network"`
	RPCURL         string                 `json:"rpc_url"`
	NetworkMagic   uint32                 `json:"network_magic"`
	Signer         string                 `json:"signer"`
	SignerHash     string                 `json:"signer_hash"`
	PlatformGame   string                 `json:"platform_game"`
	AppID          string                 `json:"app_id"`
	GameType       int64                  `json:"game_type"`
	AppAdmin       string                 `json:"app_admin"`
	Registered     bool                   `json:"registered"`
	SkippedReason  string                 `json:"skipped_reason,omitempty"`
	Transaction    string                 `json:"transaction,omitempty"`
	Validation     map[string]interface{} `json:"validation"`
	GeneratedAtUTC string                 `json:"generated_at_utc"`
}

func main() {
	if err := runGameRegister(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runGameRegister() error {
	dryRun := gameRegisterTruthy(os.Getenv("PLATFORM_GAME_REGISTER_DRY_RUN"))
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_GAME_REGISTER") != gameRegisterConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_GAME_REGISTER=%s to write chain", gameRegisterConfirmPhrase)
	}

	network := strings.ToLower(gameRegisterFirstNonEmpty(os.Getenv("PLATFORM_GAME_REGISTER_NETWORK"), "testnet"))
	expectedMagic, rpcURL, wif, reportPath, err := gameRegisterNetworkConfig(network)
	if err != nil {
		return err
	}
	if wif == "" {
		return fmt.Errorf("%s signer WIF is not configured", network)
	}

	gameHashRaw, err := gameRegisterResolvePlatformGameHash(network)
	if err != nil {
		return err
	}
	gameHash, err := gameRegisterParseHash(gameHashRaw)
	if err != nil {
		return fmt.Errorf("parse PlatformGame hash: %w", err)
	}

	appID := gameRegisterFirstNonEmpty(os.Getenv("PLATFORM_GAME_APP_ID"), "miniapp-dice-game")
	gameTypeRaw := gameRegisterFirstNonEmpty(os.Getenv("PLATFORM_GAME_TYPE"), "4")
	gameType, err := strconv.ParseInt(gameTypeRaw, 10, 64)
	if err != nil || gameType <= 0 {
		return fmt.Errorf("invalid PLATFORM_GAME_TYPE=%q", gameTypeRaw)
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
		return fmt.Errorf("invalid %s signer WIF", network)
	}
	acc := wallet.NewAccountFromPrivateKey(priv)
	signerHash := priv.GetScriptHash()
	appAdmin, err := gameRegisterResolveAppAdmin(os.Getenv("PLATFORM_GAME_APP_ADMIN_ADDRESS"), signerHash)
	if err != nil {
		return err
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

	report := gameRegisterReport{
		Network:        network,
		RPCURL:         rpcURL,
		NetworkMagic:   actualMagic,
		Signer:         acc.Address,
		SignerHash:     "0x" + signerHash.StringLE(),
		PlatformGame:   "0x" + gameHash.StringLE(),
		AppID:          appID,
		GameType:       gameType,
		AppAdmin:       "0x" + appAdmin.StringLE(),
		Validation:     map[string]interface{}{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}

	admin, err := gameRegisterCallUint160(act, gameHash, "admin")
	if err != nil {
		return fmt.Errorf("read PlatformGame admin: %w", err)
	}
	report.Validation["admin_matches_signer"] = admin == signerHash
	if admin != signerHash {
		report.SkippedReason = "signer is not PlatformGame admin"
		return gameRegisterWriteReport(reportPath, report)
	}

	currentType, err := gameRegisterCallInteger(act, gameHash, "getGameType", appID)
	if err != nil {
		return fmt.Errorf("read current game type: %w", err)
	}
	report.Validation["current_game_type"] = currentType.String()
	if currentType.Int64() == gameType {
		report.Registered = true
		report.SkippedReason = "already registered"
		return gameRegisterWriteReport(reportPath, report)
	}
	if currentType.Sign() != 0 {
		report.SkippedReason = "appId already registered with different game type"
		return gameRegisterWriteReport(reportPath, report)
	}
	if dryRun {
		report.SkippedReason = "dry run: eligible for registerGame"
		return gameRegisterWriteReport(reportPath, report)
	}

	txid, vub, err := act.SendCall(gameHash, "registerGame", appID, gameType, appAdmin, []byte{})
	if err != nil {
		return fmt.Errorf("send registerGame: %w", err)
	}
	report.Transaction = "0x" + txid.StringLE()
	report.Validation["valid_until_block"] = vub
	if err := gameRegisterWaitForTx(ctx, client, txid); err != nil {
		return fmt.Errorf("wait registerGame: %w", err)
	}
	afterType, err := gameRegisterCallInteger(act, gameHash, "getGameType", appID)
	if err != nil {
		return fmt.Errorf("read game type after register: %w", err)
	}
	report.Validation["registered_game_type"] = afterType.String()
	report.Registered = afterType.Int64() == gameType
	if !report.Registered {
		return fmt.Errorf("registration validation failed: game type is %s", afterType.String())
	}
	return gameRegisterWriteReport(reportPath, report)
}

func gameRegisterNetworkConfig(network string) (uint32, string, string, string, error) {
	switch network {
	case "testnet":
		return gameRegisterTestnetMagic,
			gameRegisterFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), "https://testnet1.neo.coz.io:443"),
			gameRegisterFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"), os.Getenv("FLAGSHIP_LIVE_WIF")),
			"contracts/build/testnet_platform_game_register_latest.json",
			nil
	case "mainnet":
		return gameRegisterMainnetMagic,
			gameRegisterFirstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), "https://mainnet2.neo.coz.io:443"),
			gameRegisterFirstNonEmpty(os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF"), os.Getenv("MINIAPP_MAINNET_DEPLOY_WIF")),
			"contracts/build/mainnet_platform_game_register_latest.json",
			nil
	default:
		return 0, "", "", "", fmt.Errorf("unsupported PLATFORM_GAME_REGISTER_NETWORK=%q", network)
	}
}

func gameRegisterResolvePlatformGameHash(network string) (string, error) {
	hash := gameRegisterFirstNonEmpty(
		os.Getenv("PLATFORM_GAME_HASH"),
		os.Getenv("PLATFORM_GAME_"+strings.ToUpper(network)+"_HASH"),
		os.Getenv("CONTRACT_PLATFORM_GAME_HASH"),
	)
	if hash != "" {
		return hash, nil
	}
	var deployment struct {
		PlatformGame string `json:"platform_game"`
	}
	path := fmt.Sprintf("contracts/build/%s_game_deployment.json", network)
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &deployment)
		if strings.TrimSpace(deployment.PlatformGame) != "" {
			return deployment.PlatformGame, nil
		}
	}
	return "", fmt.Errorf("PlatformGame hash is not configured")
}

func gameRegisterResolveAppAdmin(raw string, fallback util.Uint160) (util.Uint160, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return fallback, nil
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "0x") {
		return gameRegisterParseHash(trimmed)
	}
	hash, err := address.StringToUint160(trimmed)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("invalid PLATFORM_GAME_APP_ADMIN_ADDRESS: %w", err)
	}
	return hash, nil
}

func gameRegisterCallHALT(act *actor.Actor, contract util.Uint160, method string, params ...interface{}) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, err
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func gameRegisterCallInteger(act *actor.Actor, contract util.Uint160, method string, params ...interface{}) (*big.Int, error) {
	inv, err := gameRegisterCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	value, err := inv.Stack[0].TryInteger()
	if err != nil {
		return nil, err
	}
	return value, nil
}

func gameRegisterCallUint160(act *actor.Actor, contract util.Uint160, method string, params ...interface{}) (util.Uint160, error) {
	inv, err := gameRegisterCallHALT(act, contract, method, params...)
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

func gameRegisterWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
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

func gameRegisterWriteReport(path string, report gameRegisterReport) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, append(out, '\n'), 0644); err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}

func gameRegisterParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func gameRegisterFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func gameRegisterTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
