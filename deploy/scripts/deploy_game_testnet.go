//go:build scripts

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
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
	gameAppLastSurvivor = "miniapp-last-survivor"
	gameTypeCountdown   = int64(1)
	gameKeyCost         = int64(10_000_000)

	gameDefaultRPCURL = "https://testnet1.neo.coz.io:443"
	gameGasHashLE     = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	gameReportPath    = "contracts/build/testnet_game_deployment.json"
)

type gameReport struct {
	Network        string            `json:"network"`
	RPCURL         string            `json:"rpc_url"`
	Deployer       string            `json:"deployer"`
	DeployerHash   string            `json:"deployer_hash"`
	PlatformGame   string            `json:"platform_game"`
	Transactions   []gameTxRecord    `json:"transactions"`
	Validation     map[string]string `json:"validation"`
	GeneratedAtUTC string            `json:"generated_at_utc"`
}

type gameTxRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

func main() {
	if err := runGameDeploy(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runGameDeploy() error {
	ctx := context.Background()
	rpcURL := gameFirstNonEmpty(os.Getenv("NEO_RPC_URL"), gameDefaultRPCURL)
	wif := gameFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF"), os.Getenv("FLAGSHIP_LIVE_WIF"))
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

	report := gameReport{
		Network:        "neo-n3-testnet",
		RPCURL:         rpcURL,
		Deployer:       acc.Address,
		DeployerHash:   "0x" + deployerHash.StringLE(),
		Transactions:   []gameTxRecord{},
		Validation:     map[string]string{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}

	gameHash, err := deployGame(ctx, client, act, deployerHash, &report)
	if err != nil {
		return err
	}
	report.PlatformGame = "0x" + gameHash.StringLE()

	if err := ensureCountdownGame(ctx, act, client, gameHash, deployerHash, &report); err != nil {
		return err
	}
	if err := validateCountdownGame(ctx, act, client, gameHash, deployerHash, &report); err != nil {
		return err
	}

	if err := writeGameReport(report); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	return nil
}

func deployGame(ctx context.Context, client *rpcclient.Client, act *actor.Actor, deployer util.Uint160, report *gameReport) (util.Uint160, error) {
	nefFile, err := gameLoadNEF("contracts/build/PlatformGame.nef")
	if err != nil {
		return util.Uint160{}, err
	}
	mani, err := gameLoadManifest("contracts/build/PlatformGame.manifest.json")
	if err != nil {
		return util.Uint160{}, err
	}
	expected := state.CreateContractHash(deployer, nefFile.Checksum, mani.Name)
	fmt.Printf("PlatformGame expected hash: 0x%s\n", expected.StringLE())
	if _, err := client.GetContractStateByHash(expected); err == nil {
		fmt.Println("PlatformGame already deployed")
		return expected, nil
	}
	txid, vub, err := management.New(act).Deploy(nefFile, mani, nil)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("deploy PlatformGame: %w", err)
	}
	report.Transactions = append(report.Transactions, gameTxRecord{Label: "Deploy PlatformGame", TxID: "0x" + txid.StringLE(), VUB: vub})
	if err := gameWaitForTx(ctx, client, txid); err != nil {
		return util.Uint160{}, fmt.Errorf("wait deploy PlatformGame: %w", err)
	}
	return expected, nil
}

func ensureCountdownGame(ctx context.Context, act *actor.Actor, client *rpcclient.Client, gameHash util.Uint160, admin util.Uint160, report *gameReport) error {
	current, err := gameCallInteger(act, gameHash, "getGameType", gameAppLastSurvivor)
	if err != nil {
		return err
	}
	if current.Int64() == gameTypeCountdown {
		return nil
	}
	if current.Sign() != 0 {
		return fmt.Errorf("%s already registered with unexpected game type %s", gameAppLastSurvivor, current.String())
	}
	return gameSendAndWait(ctx, act, client, gameHash, "registerGame", report, "Register "+gameAppLastSurvivor, gameAppLastSurvivor, gameTypeCountdown, admin, []byte{})
}

func validateCountdownGame(ctx context.Context, act *actor.Actor, client *rpcclient.Client, gameHash util.Uint160, deployer util.Uint160, report *gameReport) error {
	status, err := gameCallStatus(act, gameHash)
	if err != nil {
		return err
	}
	var startTx string
	if !status.Active {
		if err := gameSendAndWait(ctx, act, client, gameHash, "startCountdownRound", report, "LastSurvivor start countdown round", gameAppLastSurvivor); err != nil {
			return err
		}
		startTx = report.Transactions[len(report.Transactions)-1].TxID
		status, err = gameCallStatus(act, gameHash)
		if err != nil {
			return err
		}
	}
	if !status.Active || status.RoundID.Sign() == 0 {
		return fmt.Errorf("countdown round not active after start")
	}

	gasHash, err := gameParseHash(gameGasHashLE)
	if err != nil {
		return err
	}
	cost, err := gameCallInteger(act, gameHash, "calculateCountdownKeyCost", int64(1), status.TotalKeys)
	if err != nil {
		cost = big.NewInt(gameKeyCost)
	}
	if err := gameSendAndWait(ctx, act, client, gasHash, "transfer", report, "LastSurvivor fund key purchase", deployer, gameHash, cost.Int64(), fmt.Sprintf("%s:buy:%s", gameAppLastSurvivor, status.RoundID.String())); err != nil {
		return err
	}
	if err := gameSendAndWait(ctx, act, client, gameHash, "buyCountdownKeys", report, "LastSurvivor buy countdown key", gameAppLastSurvivor, deployer, int64(1)); err != nil {
		return err
	}
	after, err := gameCallStatus(act, gameHash)
	if err != nil {
		return err
	}
	if after.TotalKeys.Cmp(status.TotalKeys) <= 0 {
		return fmt.Errorf("countdown key purchase did not increase total keys")
	}
	report.Validation["app_id"] = gameAppLastSurvivor
	report.Validation["game_type"] = fmt.Sprint(gameTypeCountdown)
	report.Validation["round_id"] = after.RoundID.String()
	report.Validation["total_keys_after"] = after.TotalKeys.String()
	report.Validation["start_tx"] = startTx
	return nil
}

type countdownStatus struct {
	RoundID   *big.Int
	Active    bool
	TotalKeys *big.Int
}

func gameCallStatus(act *actor.Actor, contract util.Uint160) (countdownStatus, error) {
	inv, err := gameCallHALT(act, contract, "getCountdownStatus", gameAppLastSurvivor)
	if err != nil {
		return countdownStatus{}, err
	}
	status := countdownStatus{RoundID: big.NewInt(0), TotalKeys: big.NewInt(0)}
	if len(inv.Stack) == 0 {
		return status, nil
	}
	m, ok := inv.Stack[0].Value().([]stackitem.MapElement)
	if !ok {
		return status, nil
	}
	for _, entry := range m {
		keyBytes, err := entry.Key.TryBytes()
		if err != nil {
			continue
		}
		switch string(keyBytes) {
		case "roundId":
			if v, err := entry.Value.TryInteger(); err == nil {
				status.RoundID = v
			}
		case "active":
			if v, err := entry.Value.TryBool(); err == nil {
				status.Active = v
			}
		case "totalKeys":
			if v, err := entry.Value.TryInteger(); err == nil {
				status.TotalKeys = v
			}
		}
	}
	return status, nil
}

func gameSendAndWait(ctx context.Context, act *actor.Actor, client *rpcclient.Client, contract util.Uint160, method string, report *gameReport, label string, params ...any) error {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return fmt.Errorf("%s (%s): %w", label, method, err)
	}
	fmt.Printf("%s tx: 0x%s\n", label, txid.StringLE())
	report.Transactions = append(report.Transactions, gameTxRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	return gameWaitForTx(ctx, client, txid)
}

func gameCallInteger(act *actor.Actor, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := gameCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	return inv.Stack[0].TryInteger()
}

func gameCallHALT(act *actor.Actor, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func gameWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) error {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(120 * time.Second)
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

func gameLoadNEF(path string) (*nef.File, error) {
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

func gameLoadManifest(path string) (*manifest.Manifest, error) {
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

func gameParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func writeGameReport(report gameReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(gameReportPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(gameReportPath, append(out, '\n'), 0644)
}

func gameFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
