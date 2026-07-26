//go:build scripts

// Deploy the PlatformRegistry estate spine and its post-deploy wiring.
//
// Lifecycle (PLATFORM_REGISTRY_ACTION):
//
//	deploy             (default) deploy PlatformRegistry (idempotent by
//	                   predicted hash), propose the canonical AppAccount
//	                   artifact, propose the platform-game engine row, and
//	                   smoke-test a lite (engineless) registration.
//	execute-timelocks  after the 24h timelocks mature: setAppAccountArtifact
//	                   + registerEngine("platform-game").
//	wire-engine        bind the engine to the registry: setRegistry(registry)
//	                   on PlatformGame + read-back assert of registry().
//	full-loop          post-timelock end-to-end: execute-timelocks inline,
//	                   wire-engine inline, mint the smoke app's AppAccount,
//	                   register an app on the engine (activateApp push proof),
//	                   apply a RewardGame descriptor, fund the reward pool.
//	verify             read-only state dump (admin, artifact, engine, smoke app).
//
// Safety:
//   - Dry-run is the DEFAULT: PLATFORM_REGISTRY_DEPLOY_DRY_RUN unset means dry.
//     Set it explicitly to 0/false AND CONFIRM_PLATFORM_REGISTRY_DEPLOY=
//     I_UNDERSTAND_THIS_WRITES_CHAIN for chain writes.
//   - Network magic is asserted before any write (testnet 894710606 /
//     mainnet 860833102).
//   - deploy skips the deployment when the predicted contract hash already
//     exists on-chain, skips proposals that are already pending/active, and
//     skips the smoke registration when the appId is already registered.
//
// Key environment:
//
//	PLATFORM_REGISTRY_ACTION               deploy|execute-timelocks|verify
//	PLATFORM_REGISTRY_DEPLOY_DRY_RUN       default dry when unset
//	CONFIRM_PLATFORM_REGISTRY_DEPLOY       I_UNDERSTAND_THIS_WRITES_CHAIN
//	PLATFORM_REGISTRY_DEPLOY_NETWORK       testnet (default) | mainnet
//	NEO_TESTNET_WIF / FLAGSHIP_TESTNET_WIF signer WIF (mainnet: NEO_MAINNET_WIF / FLAGSHIP_MAINNET_WIF)
//	PLATFORM_REGISTRY_VERIFY_SIGNER        public signer address/hash for verify when no WIF is configured
//	PLATFORM_REGISTRY_DRY_RUN_SIGNER       public signer address/hash for dry-run simulation when no WIF is configured
//	NEO_TESTNET_RPC_URL / NEO_RPC_URL      RPC endpoint (default https://testnet1.neo.coz.io:443)
//	PLATFORM_REGISTRY_MIN_GAS              signer GAS floor (default 15 deploy / 1 execute-timelocks)
//	PLATFORM_GAME_TESTNET_HASH             engine hash override (mainnet: PLATFORM_GAME_MAINNET_HASH)
//	PLATFORM_REGISTRY_ENGINE_ID            engine id (default platform-game)
//	PLATFORM_REGISTRY_ENGINE_SCHEMA_VERSION engine schema version (default 1)
//	PLATFORM_REGISTRY_SMOKE_APP_ID         smoke appId (default smoketest-<unixtime>;
//	                                       full-loop mint falls back to the newest report's smoke_test.app_id)
//	PLATFORM_REGISTRY_SMOKE_CREDIT_GAS     smoke credit deposit (default 1.5)
//	PLATFORM_REGISTRY_SKIP_SMOKE_TEST      truthy skips the smoke registration
//	PLATFORM_REGISTRY_TESTNET_HASH         registry hash override for execute-timelocks/verify/wire-engine/full-loop
//	PLATFORM_REGISTRY_FULLLOOP_APP_ID      full-loop engine app (default fullloop-<unixtime>)
//	PLATFORM_REGISTRY_FULLLOOP_CREDIT_GAS  full-loop registration credit deposit (default 1.5)
//	PLATFORM_REGISTRY_FULLLOOP_MINT_CREDIT_GAS mint credit floor for the smoke app (default 10)
//	PLATFORM_REGISTRY_FULLLOOP_DESCRIPTOR_KEY   descriptor key (default <engineId>:dailyCap)
//	PLATFORM_REGISTRY_FULLLOOP_DESCRIPTOR_VALUE descriptor integer value (default 10)
//	PLATFORM_REGISTRY_FULLLOOP_FUND_GAS    reward-pool fund target (default 2)
//	PLATFORM_REGISTRY_DEPLOY_REPORT_PATH   report output override
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/neorpc/result"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/invoker"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/management"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	prConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	prTestnetMagic  = uint32(894710606)
	prMainnetMagic  = uint32(860833102)

	prDefaultTestnetRPC = "https://testnet1.neo.coz.io:443"
	prDefaultMainnetRPC = "https://mainnet2.neo.coz.io:443"

	prGasHashLE = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	prNeoHashLE = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"

	// Registry constants mirrored from contracts/platform/PlatformRegistry:
	// TIMELOCK_DELAY_MS (PlatformRegistry.cs), FEE_LITE_REGISTRATION and the
	// ValidateArtifact probe id (PlatformRegistry.Accounts.cs).
	prTimelockDelayMS     = int64(86400000)
	prLiteRegistrationFee = int64(100_000_000) // 1 GAS in fractions
	prArtifactProbeID     = "artifact-probe.app_1"
	prMaxAppIDLength      = 64
	prPlatformAppIDPrefix = "miniapp-"
	prMaxManifestLength   = 65536

	prDefaultEngineID          = "platform-game"
	prDefaultEngineSchema      = int64(1)
	prDefaultMinGasDeploy      = 15.0
	prDefaultMinGasTimelocks   = 1.0
	prDefaultMinGasWireEngine  = 1.0
	prDefaultMinGasFullLoop    = 30.0 // AppAccount mint deploy system fee (10) + credit top-ups + tx fees
	prDefaultSmokeCreditGas    = 1.5
	prTestnetPlatformGameHash  = "0xc75b181b4561462903bb27d8d9e0b32b637bec12"
	prMainnetPlatformGameHash  = "0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7"
	prRegistryNEFPath          = "contracts/build/PlatformRegistry.nef"
	prRegistryManifestPath     = "contracts/build/PlatformRegistry.manifest.json"
	prAppAccountNEFPath        = "contracts/build/AppAccount.nef"
	prAppAccountManifestPath   = "contracts/build/AppAccount.manifest.json"
	prGasFractionsPerGas       = float64(100_000_000)
	prTestnetFaucetInstruction = "fund it from the Neo N3 testnet faucet (https://neowish.ngd.network/) or transfer GAS from another testnet account"

	// full-loop defaults. The mint fee mirrors FEE_ACCOUNT_MINT
	// (PlatformRegistry.cs); the RewardGame dailyCap bound mirrors
	// RG_MAX_DAILY_CAP (PlatformGame.RewardGame.Descriptor.cs).
	prAccountMintFee          = int64(1_000_000_000) // 10 GAS in fractions
	prFullLoopMintCreditGas   = 10.0
	prFullLoopCreditGas       = 1.5
	prFullLoopFundGas         = 2.0
	prFullLoopDescriptorParam = "dailyCap"
	prFullLoopDescriptorValue = int64(10)
	prRewardGameMaxDailyCap   = int64(100)
	prRewardGameType          = int64(5)
)

var prAppIDPattern = regexp.MustCompile(`^[a-z0-9\-_.]{1,64}$`)

func prIsPlatformOwnedAppID(appID string) bool {
	return strings.HasPrefix(appID, prPlatformAppIDPrefix)
}

func prRegistrationMethod(appID string) string {
	if prIsPlatformOwnedAppID(appID) {
		return "registerAppByPlatform"
	}
	return "registerApp"
}

type prCaller interface {
	Call(util.Uint160, string, ...any) (*result.Invoke, error)
}

type prReport struct {
	Action           string                 `json:"action"`
	Network          string                 `json:"network"`
	RPCURL           string                 `json:"rpc_url"`
	NetworkMagic     uint32                 `json:"network_magic"`
	Signer           string                 `json:"signer"`
	SignerHash       string                 `json:"signer_hash"`
	DryRun           bool                   `json:"dry_run"`
	PlatformRegistry string                 `json:"platform_registry"`
	PredictedHash    string                 `json:"predicted_hash,omitempty"`
	SkippedReason    string                 `json:"skipped_reason,omitempty"`
	Balances         map[string]string      `json:"balances"`
	Transactions     []prTxRecord           `json:"transactions"`
	PendingTimelocks []prTimelockRecord     `json:"pending_timelocks"`
	SmokeTest        *prSmokeRecord         `json:"smoke_test,omitempty"`
	FullLoop         *prFullLoopRecord      `json:"full_loop,omitempty"`
	Validation       map[string]interface{} `json:"validation"`
	NextSteps        []string               `json:"next_steps"`
	GeneratedAtUTC   string                 `json:"generated_at_utc"`
}

type prTxRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

type prTimelockRecord struct {
	Kind            string `json:"kind"` // "app-account-artifact" | "engine:<engineId>"
	Status          string `json:"status"`
	TxID            string `json:"txid,omitempty"`
	ExecuteAfterMS  int64  `json:"execute_after_ms,omitempty"`
	ExecuteAfterUTC string `json:"execute_after_utc,omitempty"`
	Note            string `json:"note,omitempty"`
}

type prSmokeRecord struct {
	AppID           string        `json:"app_id"`
	CreditGas       float64       `json:"credit_gas"`
	Registered      bool          `json:"registered"`
	SkippedReason   string        `json:"skipped_reason,omitempty"`
	CreditTxID      string        `json:"credit_txid,omitempty"`
	RegisterTxID    string        `json:"register_txid,omitempty"`
	CreditBefore    string        `json:"credit_before,omitempty"`
	CreditAfter     string        `json:"credit_after,omitempty"`
	AppRow          []interface{} `json:"app_row,omitempty"`
	RegisterSimNote string        `json:"register_simulation_note,omitempty"`
}

func main() {
	if err := prRun(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func prRun() error {
	action := strings.ToLower(prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ACTION"), "deploy"))
	switch action {
	case "deploy", "execute-timelocks", "wire-engine", "full-loop", "verify":
	default:
		return fmt.Errorf("unsupported PLATFORM_REGISTRY_ACTION=%q (deploy|execute-timelocks|wire-engine|full-loop|verify)", action)
	}

	// Safest convention: dry-run unless PLATFORM_REGISTRY_DEPLOY_DRY_RUN is
	// explicitly set to a falsy value. verify never writes chain, so it is
	// exempt from the confirm gate.
	dryRun := true
	if raw, ok := os.LookupEnv("PLATFORM_REGISTRY_DEPLOY_DRY_RUN"); ok {
		dryRun = prTruthy(raw)
	}
	if action == "verify" {
		dryRun = true
	}
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_REGISTRY_DEPLOY") != prConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s to write chain", prConfirmPhrase)
	}
	if dryRun && action != "verify" && os.Getenv("CONFIRM_PLATFORM_REGISTRY_DEPLOY") == prConfirmPhrase {
		fmt.Println("note: confirm phrase is set but PLATFORM_REGISTRY_DEPLOY_DRY_RUN is not explicitly false; staying in dry-run")
	}

	network := strings.ToLower(prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_DEPLOY_NETWORK"), "testnet"))
	expectedMagic, networkID, rpcURL, wif, err := prNetworkConfig(network)
	if err != nil {
		return err
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

	var (
		act           *actor.Actor
		caller        prCaller
		signerHash    util.Uint160
		signerAddress string
		signerInput   string
	)
	if wif != "" {
		priv, err := keys.NewPrivateKeyFromWIF(wif)
		if err != nil {
			return fmt.Errorf("invalid %s signer WIF", network)
		}
		acc := wallet.NewAccountFromPrivateKey(priv)
		signerHash = priv.GetScriptHash()
		signerAddress = acc.Address
		signerInput = "private-key"
		act, err = actor.New(client, []actor.SignerAccount{{
			Signer:  transaction.Signer{Account: acc.Contract.ScriptHash(), Scopes: transaction.Global},
			Account: acc,
		}})
		if err != nil {
			return fmt.Errorf("create actor: %w", err)
		}
		caller = act
	} else if action == "verify" {
		signerHash, err = prParseSignerIdentity(os.Getenv("PLATFORM_REGISTRY_VERIFY_SIGNER"))
		if err != nil {
			return err
		}
		signerAddress = address.Uint160ToString(signerHash)
		signerInput = "public-identity"
		caller = invoker.New(client, nil)
	} else if dryRun {
		signerHash, err = prParseSignerIdentity(prFirstNonEmpty(
			os.Getenv("PLATFORM_REGISTRY_DRY_RUN_SIGNER"),
			os.Getenv("PLATFORM_REGISTRY_VERIFY_SIGNER"),
		))
		if err != nil {
			return fmt.Errorf("dry-run signer: %w", err)
		}
		signerAddress = address.Uint160ToString(signerHash)
		signerInput = "public-identity"
		watchOnly := &wallet.Account{
			Address: signerAddress,
			Contract: &wallet.Contract{
				Deployed: true,
			},
		}
		act, err = actor.New(client, []actor.SignerAccount{{
			Signer:  transaction.Signer{Account: signerHash, Scopes: transaction.Global},
			Account: watchOnly,
		}})
		if err != nil {
			return fmt.Errorf("create watch-only dry-run actor: %w", err)
		}
		caller = act
	} else {
		return fmt.Errorf("%s signer WIF is not configured (set NEO_%s_WIF)", network, strings.ToUpper(network))
	}

	neoBalance, gasBalance, err := prSignerBalances(client, signerHash)
	if err != nil {
		return fmt.Errorf("read signer balances: %w", err)
	}
	mode := "write"
	if action == "verify" {
		mode = "read-only"
	} else if dryRun {
		mode = "dry-run"
	}
	fmt.Printf("Action: %s\n", action)
	fmt.Printf("Signer: %s\n", signerAddress)
	fmt.Printf("Network: %s (magic %d)\n", networkID, actualMagic)
	fmt.Printf("Mode: %s\n", mode)
	fmt.Printf("Balances: %d NEO, %s GAS\n\n", neoBalance, prFormatGas(gasBalance))

	minGas := prMinGasThreshold(action)
	if minGas > 0 && float64(gasBalance)/prGasFractionsPerGas < minGas {
		message := fmt.Sprintf("insufficient GAS: signer %s holds %s GAS, action %q requires at least %.8g GAS "+
			"(deploy system fee + propose txs + smoke-test credit; tune with PLATFORM_REGISTRY_MIN_GAS). "+
			"To continue, %s.",
			signerAddress, prFormatGas(gasBalance), action, minGas, prTestnetFaucetInstruction)
		if !dryRun {
			return fmt.Errorf("%s", message)
		}
		fmt.Println("warning: " + message)
	}

	report := prReport{
		Action:           action,
		Network:          networkID,
		RPCURL:           rpcURL,
		NetworkMagic:     actualMagic,
		Signer:           signerAddress,
		SignerHash:       "0x" + signerHash.StringLE(),
		DryRun:           dryRun,
		Balances:         map[string]string{"neo": strconv.FormatInt(neoBalance, 10), "gas": prFormatGas(gasBalance)},
		Transactions:     []prTxRecord{},
		PendingTimelocks: []prTimelockRecord{},
		Validation:       map[string]interface{}{},
		NextSteps:        []string{},
		GeneratedAtUTC:   time.Now().UTC().Format(time.RFC3339),
	}
	report.Validation["signer_input"] = signerInput

	var registryHash util.Uint160
	switch action {
	case "deploy":
		registryHash, err = prActionDeploy(ctx, client, act, network, signerHash, dryRun, &report)
	case "execute-timelocks":
		registryHash, err = prResolveRegistryHash(client, network, signerHash)
		if err == nil {
			err = prActionExecuteTimelocks(ctx, client, act, network, registryHash, dryRun, &report)
		}
	case "wire-engine":
		registryHash, err = prResolveRegistryHash(client, network, signerHash)
		if err == nil {
			err = prWireEngine(ctx, client, act, network, registryHash, dryRun, &report)
		}
	case "full-loop":
		registryHash, err = prResolveRegistryHash(client, network, signerHash)
		if err == nil {
			err = prActionFullLoop(ctx, client, act, network, registryHash, signerHash, dryRun, &report)
		}
	case "verify":
		registryHash, err = prResolveRegistryHash(client, network, signerHash)
		if err == nil {
			err = prActionVerify(caller, registryHash, signerHash, &report)
		}
	}
	if err != nil {
		return err
	}
	report.PlatformRegistry = "0x" + registryHash.StringLE()

	reportPath := prReportPath(network)
	if err := prWriteReport(reportPath, report); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	fmt.Printf("\nSaved: %s\n", reportPath)
	prPrintNextSteps(report)
	return nil
}

func prNetworkConfig(network string) (uint32, string, string, string, error) {
	switch network {
	case "mainnet":
		return prMainnetMagic,
			"neo-n3-mainnet",
			prFirstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), prDefaultMainnetRPC),
			prFirstNonEmpty(os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF")),
			nil
	case "testnet":
		return prTestnetMagic,
			"neo-n3-testnet",
			prFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), prDefaultTestnetRPC),
			prFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF")),
			nil
	default:
		return 0, "", "", "", fmt.Errorf("unsupported PLATFORM_REGISTRY_DEPLOY_NETWORK=%q", network)
	}
}

// ---------------------------------------------------------------------
// Action: deploy
// ---------------------------------------------------------------------

func prActionDeploy(ctx context.Context, client *rpcclient.Client, act *actor.Actor, network string, signerHash util.Uint160, dryRun bool, report *prReport) (util.Uint160, error) {
	nefFile, err := prLoadNEF(prRegistryNEFPath)
	if err != nil {
		return util.Uint160{}, err
	}
	mani, err := prLoadManifest(prRegistryManifestPath)
	if err != nil {
		return util.Uint160{}, err
	}
	predicted := state.CreateContractHash(signerHash, nefFile.Checksum, mani.Name)
	report.PredictedHash = "0x" + predicted.StringLE()
	fmt.Printf("PlatformRegistry predicted hash: 0x%s\n", predicted.StringLE())

	deployed := false
	if _, err := client.GetContractStateByHash(predicted); err == nil {
		fmt.Println("already deployed at predicted hash; reusing")
		report.Validation["registry_deploy_skipped"] = "already deployed"
		deployed = true
	} else if dryRun {
		report.SkippedReason = "dry run: PlatformRegistry deployment is eligible"
	} else {
		txid, vub, err := management.New(act).Deploy(nefFile, mani, nil)
		if err != nil {
			return util.Uint160{}, fmt.Errorf("deploy PlatformRegistry: %w", err)
		}
		report.Transactions = append(report.Transactions, prTxRecord{Label: "Deploy PlatformRegistry", TxID: "0x" + txid.StringLE(), VUB: vub})
		fmt.Printf("deploy tx: 0x%s (vub: %d)\n", txid.StringLE(), vub)
		if _, err := prWaitForTx(ctx, client, txid); err != nil {
			return util.Uint160{}, fmt.Errorf("wait deploy PlatformRegistry: %w", err)
		}
		if _, err := client.GetContractStateByHash(predicted); err != nil {
			return util.Uint160{}, fmt.Errorf("PlatformRegistry not found at predicted hash after deploy: %w", err)
		}
		deployed = true
	}

	if !deployed {
		// Nothing on-chain to probe or configure; record the exact plan.
		nefBytes, head, tail, err := prLoadAccountArtifact()
		if err != nil {
			return util.Uint160{}, err
		}
		accountNEF, err := prLoadNEF(prAppAccountNEFPath)
		if err != nil {
			return util.Uint160{}, err
		}
		report.Validation["artifact_nef_bytes"] = len(nefBytes)
		report.Validation["artifact_nef_checksum"] = accountNEF.Checksum
		report.Validation["artifact_manifest_head_length"] = len(head)
		report.Validation["artifact_manifest_tail_length"] = len(tail)
		engineHash, engineSource, err := prResolveEngineHash(network)
		if err != nil {
			return util.Uint160{}, err
		}
		report.Validation["engine_id"] = prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ENGINE_ID"), prDefaultEngineID)
		report.Validation["engine_hash"] = "0x" + engineHash.StringLE()
		report.Validation["engine_hash_source"] = engineSource
		report.NextSteps = append(report.NextSteps,
			"Re-run with PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_DEPLOY="+prConfirmPhrase+" to write chain.")
		return predicted, nil
	}

	admin, err := prCallUint160(act, predicted, "admin")
	if err != nil {
		return util.Uint160{}, fmt.Errorf("read PlatformRegistry admin: %w", err)
	}
	report.Validation["admin"] = "0x" + admin.StringLE()
	report.Validation["admin_matches_signer"] = admin == signerHash
	if admin != signerHash {
		return util.Uint160{}, fmt.Errorf("deployed PlatformRegistry admin 0x%s is not the current signer", admin.StringLE())
	}

	if err := prProposeArtifact(ctx, client, act, predicted, dryRun, report); err != nil {
		return util.Uint160{}, err
	}
	if err := prProposeEngine(ctx, client, act, network, predicted, dryRun, report); err != nil {
		return util.Uint160{}, err
	}
	if prTruthy(os.Getenv("PLATFORM_REGISTRY_SKIP_SMOKE_TEST")) {
		report.Validation["smoke_test_skipped"] = "PLATFORM_REGISTRY_SKIP_SMOKE_TEST set"
	} else if err := prSmokeTest(ctx, client, act, predicted, signerHash, dryRun, report); err != nil {
		return util.Uint160{}, err
	}
	return predicted, nil
}

// prProposeArtifact proposes the canonical AppAccount NEF + manifest halves.
// Safe to re-run: skips when the artifact is already active or a proposal is
// already pending (re-proposing would reset the 24h timelock).
func prProposeArtifact(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, dryRun bool, report *prReport) error {
	version, err := prCallInteger(act, registry, "artifactVersion")
	if err != nil {
		return fmt.Errorf("read artifactVersion: %w", err)
	}
	report.Validation["artifact_version"] = version.String()
	if version.Sign() > 0 {
		fmt.Println("AppAccount artifact already active; skipping proposeAppAccountArtifact")
		report.Validation["artifact_propose_skipped"] = "artifact already active"
		return nil
	}

	probe, probeErr := act.Call(registry, "setAppAccountArtifact")
	switch {
	case probeErr == nil && probe.State == "HALT":
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{
			Kind:   "app-account-artifact",
			Status: "matured",
			Note:   "pending artifact is already executable; run PLATFORM_REGISTRY_ACTION=execute-timelocks",
		})
		report.NextSteps = append(report.NextSteps,
			"The AppAccount artifact timelock has ALREADY matured: run PLATFORM_REGISTRY_ACTION=execute-timelocks to activate it.")
		fmt.Println("AppAccount artifact proposal already pending and matured; skipping re-propose")
		return nil
	case probeErr == nil && strings.Contains(probe.FaultException, "timelock active"):
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{
			Kind:   "app-account-artifact",
			Status: "pending",
			Note:   "proposal already in flight (safe ABI exposes no ETA; see the original deploy report)",
		})
		report.Validation["artifact_propose_skipped"] = "proposal already pending, timelock active"
		fmt.Println("AppAccount artifact proposal already pending (timelock active); skipping re-propose")
		return nil
	case probeErr == nil && strings.Contains(probe.FaultException, "no pending artifact"):
		// fall through and propose
	case probeErr != nil:
		return fmt.Errorf("probe setAppAccountArtifact: %w", probeErr)
	default:
		return fmt.Errorf("probe setAppAccountArtifact fault: %s", probe.FaultException)
	}

	nefBytes, head, tail, err := prLoadAccountArtifact()
	if err != nil {
		return err
	}
	nefFile, err := prLoadNEF(prAppAccountNEFPath)
	if err != nil {
		return err
	}
	report.Validation["artifact_nef_checksum"] = nefFile.Checksum
	report.Validation["artifact_manifest_head_length"] = len(head)
	report.Validation["artifact_manifest_tail_length"] = len(tail)

	if dryRun {
		inv, err := act.Call(registry, "proposeAppAccountArtifact", nefBytes, head, tail)
		if err != nil {
			return fmt.Errorf("simulate proposeAppAccountArtifact: %w", err)
		}
		if inv.State != "HALT" {
			return fmt.Errorf("simulate proposeAppAccountArtifact fault: %s", inv.FaultException)
		}
		report.Validation["artifact_propose_simulated"] = true
		fmt.Println("dry run: proposeAppAccountArtifact simulation HALT (eligible)")
		return nil
	}

	txid, appLog, err := prSendAndWait(ctx, client, act, registry, "proposeAppAccountArtifact", report, "Propose AppAccount artifact", nefBytes, head, tail)
	if err != nil {
		return err
	}
	fmt.Printf("proposeAppAccountArtifact tx: 0x%s\n", txid.StringLE())
	etaMS, ok := prEventInteger(appLog, registry, "ArtifactProposed", 1)
	if !ok {
		etaMS = time.Now().UnixMilli() + prTimelockDelayMS
	}
	record := prTimelockRecord{
		Kind:            "app-account-artifact",
		Status:          "pending",
		TxID:            "0x" + txid.StringLE(),
		ExecuteAfterMS:  etaMS,
		ExecuteAfterUTC: time.UnixMilli(etaMS).UTC().Format(time.RFC3339),
	}
	if !ok {
		record.Note = "ETA estimated as now+24h (ArtifactProposed event not found in application log)"
	}
	report.PendingTimelocks = append(report.PendingTimelocks, record)
	fmt.Printf("artifact timelock executes after %s\n", record.ExecuteAfterUTC)
	report.NextSteps = append(report.NextSteps,
		fmt.Sprintf("After %s, activate the AppAccount artifact: PLATFORM_REGISTRY_ACTION=execute-timelocks PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s NEO_TESTNET_WIF=<wif> go run -tags scripts deploy/scripts/deploy_platform_registry.go",
			record.ExecuteAfterUTC, prConfirmPhrase))
	return nil
}

// prProposeEngine proposes the platform-game engine row. It never blocks on
// the separate PlatformGame ABI update: proposeEngine only records the hash,
// and the engine contract existence assert fires at registerEngine execution.
func prProposeEngine(ctx context.Context, client *rpcclient.Client, act *actor.Actor, network string, registry util.Uint160, dryRun bool, report *prReport) error {
	engineID := prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ENGINE_ID"), prDefaultEngineID)
	if !prAppIDPattern.MatchString(engineID) {
		return fmt.Errorf("invalid PLATFORM_REGISTRY_ENGINE_ID %q (charset [a-z0-9-_.], 1-64 chars)", engineID)
	}
	if engineID == "registry" {
		return fmt.Errorf("engineId %q is reserved by the registry descriptor namespace", engineID)
	}
	schemaVersion, err := strconv.ParseInt(prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ENGINE_SCHEMA_VERSION"), strconv.FormatInt(prDefaultEngineSchema, 10)), 10, 64)
	if err != nil || schemaVersion <= 0 {
		return fmt.Errorf("invalid PLATFORM_REGISTRY_ENGINE_SCHEMA_VERSION (must be a positive integer)")
	}
	engineHash, engineSource, err := prResolveEngineHash(network)
	if err != nil {
		return err
	}
	if engineHash == registry {
		return fmt.Errorf("engine hash equals the registry hash (the registry rejects self-registration)")
	}
	report.Validation["engine_id"] = engineID
	report.Validation["engine_hash"] = "0x" + engineHash.StringLE()
	report.Validation["engine_hash_source"] = engineSource
	report.Validation["engine_schema_version"] = schemaVersion
	if _, err := client.GetContractStateByHash(engineHash); err != nil {
		// Not fatal: proposeEngine does not require the engine to exist yet
		// (the PlatformGame engine-ABI update lands separately).
		report.Validation["engine_deployed_on_chain"] = false
		fmt.Printf("warning: engine contract 0x%s not found on-chain; proposal is still valid, registration will require it\n", engineHash.StringLE())
	} else {
		report.Validation["engine_deployed_on_chain"] = true
	}

	if inv, err := act.Call(registry, "getEngine", engineID); err == nil && inv.State == "HALT" {
		fmt.Printf("engine %q already registered: %v; skipping proposeEngine\n", engineID, prStackValues(inv))
		report.Validation["engine_propose_skipped"] = "engine already registered"
		return nil
	}

	probe, probeErr := act.Call(registry, "registerEngine", engineID)
	switch {
	case probeErr == nil && probe.State == "HALT":
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{
			Kind:   "engine:" + engineID,
			Status: "matured",
			Note:   "pending engine registration is already executable; run PLATFORM_REGISTRY_ACTION=execute-timelocks",
		})
		report.NextSteps = append(report.NextSteps,
			fmt.Sprintf("The engine %q timelock has ALREADY matured: run PLATFORM_REGISTRY_ACTION=execute-timelocks to register it.", engineID))
		fmt.Printf("engine %q proposal already pending and matured; skipping re-propose\n", engineID)
		return nil
	case probeErr == nil && strings.Contains(probe.FaultException, "timelock active"):
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{
			Kind:   "engine:" + engineID,
			Status: "pending",
			Note:   "proposal already in flight (safe ABI exposes no ETA; see the original deploy report)",
		})
		report.Validation["engine_propose_skipped"] = "proposal already pending, timelock active"
		fmt.Printf("engine %q proposal already pending (timelock active); skipping re-propose\n", engineID)
		return nil
	case probeErr == nil && strings.Contains(probe.FaultException, "retirement"):
		return fmt.Errorf("a pending RETIREMENT for engine %q is in flight; resolve it before proposing a registration", engineID)
	case probeErr == nil && strings.Contains(probe.FaultException, "no pending engine change"):
		// fall through and propose
	case probeErr != nil:
		return fmt.Errorf("probe registerEngine: %w", probeErr)
	default:
		return fmt.Errorf("probe registerEngine fault: %s", probe.FaultException)
	}

	if dryRun {
		inv, err := act.Call(registry, "proposeEngine", engineID, engineHash, schemaVersion)
		if err != nil {
			return fmt.Errorf("simulate proposeEngine: %w", err)
		}
		if inv.State != "HALT" {
			return fmt.Errorf("simulate proposeEngine fault: %s", inv.FaultException)
		}
		report.Validation["engine_propose_simulated"] = true
		fmt.Println("dry run: proposeEngine simulation HALT (eligible)")
		return nil
	}

	txid, appLog, err := prSendAndWait(ctx, client, act, registry, "proposeEngine", report, "Propose engine "+engineID, engineID, engineHash, schemaVersion)
	if err != nil {
		return err
	}
	fmt.Printf("proposeEngine tx: 0x%s\n", txid.StringLE())
	etaMS, ok := prEventInteger(appLog, registry, "EngineChangeProposed", 4)
	if !ok {
		etaMS = time.Now().UnixMilli() + prTimelockDelayMS
	}
	record := prTimelockRecord{
		Kind:            "engine:" + engineID,
		Status:          "pending",
		TxID:            "0x" + txid.StringLE(),
		ExecuteAfterMS:  etaMS,
		ExecuteAfterUTC: time.UnixMilli(etaMS).UTC().Format(time.RFC3339),
	}
	if !ok {
		record.Note = "ETA estimated as now+24h (EngineChangeProposed event not found in application log)"
	}
	report.PendingTimelocks = append(report.PendingTimelocks, record)
	fmt.Printf("engine timelock executes after %s\n", record.ExecuteAfterUTC)
	report.NextSteps = append(report.NextSteps,
		fmt.Sprintf("After %s, register engine %q with the same execute-timelocks command (one run executes both matured timelocks).", record.ExecuteAfterUTC, engineID))
	return nil
}

// prSmokeTest deposits memo-routed credit ("<appId>:credit") and performs a
// lite (engineless, descriptor-null) registration, then prints the getApp row.
// In dry-run all steps are test-invocations only.
func prSmokeTest(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, signerHash util.Uint160, dryRun bool, report *prReport) error {
	appID := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_SMOKE_APP_ID"))
	if appID == "" {
		appID = fmt.Sprintf("smoketest-%d", time.Now().Unix())
	}
	if !prAppIDPattern.MatchString(appID) {
		return fmt.Errorf("invalid PLATFORM_REGISTRY_SMOKE_APP_ID %q (charset [a-z0-9-_.], 1-64 chars)", appID)
	}
	creditGas := float64(0)
	creditFractions := int64(0)
	if !prIsPlatformOwnedAppID(appID) {
		var err error
		creditGas, err = strconv.ParseFloat(prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_SMOKE_CREDIT_GAS"), strconv.FormatFloat(prDefaultSmokeCreditGas, 'f', -1, 64)), 64)
		if err != nil || creditGas <= 0 {
			return fmt.Errorf("invalid PLATFORM_REGISTRY_SMOKE_CREDIT_GAS (must be a positive number of GAS)")
		}
		creditFractions = int64(math.Round(creditGas * prGasFractionsPerGas))
	}
	record := &prSmokeRecord{AppID: appID, CreditGas: creditGas}
	report.SmokeTest = record

	if row, err := prCallAppRow(act, registry, appID); err == nil {
		record.Registered = true
		record.SkippedReason = "appId already registered"
		record.AppRow = row
		fmt.Printf("smoke app %q already registered: %v\n", appID, row)
		return nil
	}

	method := prRegistrationMethod(appID)
	if prIsPlatformOwnedAppID(appID) {
		record.RegisterSimNote = "platform-owned namespace: fee-exempt registerAppByPlatform"
	} else {
		credit, err := prCallInteger(act, registry, "creditOf", appID, signerHash)
		if err != nil {
			return fmt.Errorf("read creditOf(%s): %w", appID, err)
		}
		record.CreditBefore = prFormatBigGas(credit)
		gasHash, err := prParseHash(prGasHashLE)
		if err != nil {
			return err
		}
		memo := appID + ":credit"

		if credit.Cmp(big.NewInt(prLiteRegistrationFee)) < 0 {
			if dryRun {
				inv, err := act.Call(gasHash, "transfer", signerHash, registry, creditFractions, memo)
				if err != nil {
					return fmt.Errorf("simulate smoke credit transfer: %w", err)
				}
				if inv.State != "HALT" {
					return fmt.Errorf("simulate smoke credit transfer fault: %s", inv.FaultException)
				}
				record.RegisterSimNote = fmt.Sprintf("dry run: would transfer %s GAS with memo %q", prFormatGas(creditFractions), memo)
			} else {
				inv, err := act.Call(gasHash, "transfer", signerHash, registry, creditFractions, memo)
				if err != nil {
					return fmt.Errorf("simulate smoke credit transfer: %w", err)
				}
				if inv.State != "HALT" {
					return fmt.Errorf("simulate smoke credit transfer fault: %s", inv.FaultException)
				}
				txid, _, err := prSendAndWait(ctx, client, act, gasHash, "transfer", report, "Smoke credit deposit ("+memo+")", signerHash, registry, creditFractions, memo)
				if err != nil {
					return err
				}
				record.CreditTxID = "0x" + txid.StringLE()
				fmt.Printf("smoke credit tx: 0x%s (%s GAS, memo %q)\n", txid.StringLE(), prFormatGas(creditFractions), memo)
				credit, err = prCallInteger(act, registry, "creditOf", appID, signerHash)
				if err != nil {
					return fmt.Errorf("read creditOf(%s) after deposit: %w", appID, err)
				}
			}
		} else {
			record.RegisterSimNote = "existing credit covers the 1 GAS registration fee; deposit skipped"
		}
	}

	// Lite registration: empty engineId, null descriptor (the registry
	// asserts descriptor == null || empty when no engine is attached).
	inv, err := act.Call(registry, method, appID, "", signerHash, nil)
	if err != nil {
		return fmt.Errorf("simulate %s(%s): %w", method, appID, err)
	}
	if inv.State != "HALT" {
		if dryRun && strings.Contains(inv.FaultException, "insufficient credit") {
			note := method + " becomes eligible after the credit deposit"
			if record.RegisterSimNote != "" {
				note = record.RegisterSimNote + "; " + note
			}
			record.RegisterSimNote = note
			fmt.Printf("dry run: %s(%s) pending credit deposit (simulation faulted with %q as expected)\n", method, appID, inv.FaultException)
			return nil
		}
		return fmt.Errorf("simulate %s(%s) fault: %s", method, appID, inv.FaultException)
	}
	if dryRun {
		record.RegisterSimNote = prFirstNonEmpty(record.RegisterSimNote, "dry run: "+method+" simulation HALT (eligible)")
		fmt.Printf("dry run: %s(%s) simulation HALT (eligible)\n", method, appID)
		return nil
	}

	txid, _, err := prSendAndWait(ctx, client, act, registry, method, report, "Smoke "+method+" "+appID, appID, "", signerHash, nil)
	if err != nil {
		return err
	}
	record.RegisterTxID = "0x" + txid.StringLE()
	fmt.Printf("%s tx: 0x%s\n", method, txid.StringLE())

	row, err := prCallAppRow(act, registry, appID)
	if err != nil {
		return fmt.Errorf("read getApp(%s) after registration: %w", appID, err)
	}
	record.AppRow = row
	record.Registered = true
	creditAfter, err := prCallInteger(act, registry, "creditOf", appID, signerHash)
	if err != nil {
		return fmt.Errorf("read creditOf(%s) after registration: %w", appID, err)
	}
	record.CreditAfter = prFormatBigGas(creditAfter)
	fmt.Printf("smoke app %q registered: %v\n", appID, row)
	fmt.Printf("smoke credit remaining: %s GAS (1 GAS fee consumed)\n", record.CreditAfter)
	report.NextSteps = append(report.NextSteps,
		fmt.Sprintf("Smoke app %q is registered lite (no engine, no account). Unconsumed credit is reclaimable via withdrawCredit(%q, amount); mint its AppAccount later with mintAccount(%q) once the artifact timelock has been executed (10 GAS credit).", appID, appID, appID))
	return nil
}

// ---------------------------------------------------------------------
// Action: execute-timelocks
// ---------------------------------------------------------------------

func prActionExecuteTimelocks(ctx context.Context, client *rpcclient.Client, act *actor.Actor, network string, registry util.Uint160, dryRun bool, report *prReport) error {
	if err := prExecuteArtifactTimelock(ctx, client, act, registry, dryRun, report); err != nil {
		return err
	}
	if err := prExecuteEngineTimelock(ctx, client, act, network, registry, dryRun, report); err != nil {
		return err
	}
	return nil
}

func prExecuteArtifactTimelock(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, dryRun bool, report *prReport) error {
	version, err := prCallInteger(act, registry, "artifactVersion")
	if err != nil {
		return fmt.Errorf("read artifactVersion: %w", err)
	}
	report.Validation["artifact_version_before"] = version.String()

	probe, err := act.Call(registry, "setAppAccountArtifact")
	if err != nil {
		return fmt.Errorf("probe setAppAccountArtifact: %w", err)
	}
	if probe.State != "HALT" {
		note := "setAppAccountArtifact not executable: " + probe.FaultException
		if version.Sign() > 0 && strings.Contains(probe.FaultException, "no pending artifact") {
			note = "artifact already active (version " + version.String() + "), no pending proposal"
		}
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{Kind: "app-account-artifact", Status: "not-executable", Note: note})
		fmt.Println("artifact timelock: " + note)
		return nil
	}
	if dryRun {
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{Kind: "app-account-artifact", Status: "matured", Note: "dry run: setAppAccountArtifact simulation HALT (eligible)"})
		fmt.Println("dry run: setAppAccountArtifact simulation HALT (eligible)")
		return nil
	}
	txid, _, err := prSendAndWait(ctx, client, act, registry, "setAppAccountArtifact", report, "Activate AppAccount artifact")
	if err != nil {
		return err
	}
	fmt.Printf("setAppAccountArtifact tx: 0x%s\n", txid.StringLE())

	after, err := prCallInteger(act, registry, "artifactVersion")
	if err != nil {
		return fmt.Errorf("read artifactVersion after activation: %w", err)
	}
	report.Validation["artifact_version_after"] = after.String()
	if after.Cmp(version) <= 0 {
		return fmt.Errorf("artifactVersion did not increase after setAppAccountArtifact")
	}
	checksum, err := prCallInteger(act, registry, "artifactChecksum")
	if err != nil {
		return fmt.Errorf("read artifactChecksum after activation: %w", err)
	}
	report.Validation["artifact_checksum"] = checksum.String()
	if nefFile, err := prLoadNEF(prAppAccountNEFPath); err == nil {
		matches := checksum.Cmp(new(big.Int).SetUint64(uint64(nefFile.Checksum))) == 0
		report.Validation["artifact_checksum_matches_local_nef"] = matches
		if !matches {
			return fmt.Errorf("activated artifact checksum %s does not match local AppAccount.nef checksum %d", checksum.String(), nefFile.Checksum)
		}
	}
	report.NextSteps = append(report.NextSteps,
		"AppAccount artifact is ACTIVE: apps can now mint treasury accounts via mintAccount(appId) (10 GAS credit per mint).")
	return nil
}

func prExecuteEngineTimelock(ctx context.Context, client *rpcclient.Client, act *actor.Actor, network string, registry util.Uint160, dryRun bool, report *prReport) error {
	engineID := prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ENGINE_ID"), prDefaultEngineID)
	if inv, err := act.Call(registry, "getEngine", engineID); err == nil && inv.State == "HALT" {
		row := prStackValues(inv)
		report.Validation["engine_row"] = row
		fmt.Printf("engine %q already registered: %v\n", engineID, row)
		return nil
	}

	probe, err := act.Call(registry, "registerEngine", engineID)
	if err != nil {
		return fmt.Errorf("probe registerEngine(%s): %w", engineID, err)
	}
	if probe.State != "HALT" {
		note := "registerEngine not executable: " + probe.FaultException
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{Kind: "engine:" + engineID, Status: "not-executable", Note: note})
		fmt.Printf("engine timelock: %s\n", note)
		return nil
	}
	if dryRun {
		report.PendingTimelocks = append(report.PendingTimelocks, prTimelockRecord{Kind: "engine:" + engineID, Status: "matured", Note: "dry run: registerEngine simulation HALT (eligible)"})
		fmt.Println("dry run: registerEngine simulation HALT (eligible)")
		return nil
	}
	txid, _, err := prSendAndWait(ctx, client, act, registry, "registerEngine", report, "Register engine "+engineID, engineID)
	if err != nil {
		return err
	}
	fmt.Printf("registerEngine tx: 0x%s\n", txid.StringLE())

	inv, err := prCallHALT(act, registry, "getEngine", engineID)
	if err != nil {
		return fmt.Errorf("read getEngine(%s) after registration: %w", engineID, err)
	}
	row := prStackValues(inv)
	report.Validation["engine_row"] = row
	fmt.Printf("engine %q registered: %v\n", engineID, row)

	engineHash, _, err := prResolveEngineHash(network)
	if err == nil && len(row) == 3 && row[0] != "0x"+engineHash.StringLE() {
		return fmt.Errorf("registered engine hash %v does not match resolved PlatformGame hash 0x%s", row[0], engineHash.StringLE())
	}
	report.NextSteps = append(report.NextSteps,
		fmt.Sprintf("Engine %q is REGISTERED: custom apps can use registerApp(appId, %q, appAdmin, descriptor); platform-owned miniapp-* ids use registerAppByPlatform or attachEngine.", engineID, engineID))
	return nil
}

// ---------------------------------------------------------------------
// Action: verify
// ---------------------------------------------------------------------

func prActionVerify(caller prCaller, registry util.Uint160, signerHash util.Uint160, report *prReport) error {
	admin, err := prCallUint160(caller, registry, "admin")
	if err != nil {
		return fmt.Errorf("read admin: %w", err)
	}
	report.Validation["admin"] = "0x" + admin.StringLE()
	report.Validation["admin_matches_signer"] = admin == signerHash
	fmt.Printf("admin: 0x%s (signer match: %t)\n", admin.StringLE(), admin == signerHash)

	version, err := prCallInteger(caller, registry, "artifactVersion")
	if err != nil {
		return fmt.Errorf("read artifactVersion: %w", err)
	}
	report.Validation["artifact_version"] = version.String()
	fmt.Printf("artifact version: %s\n", version.String())
	if version.Sign() > 0 {
		checksum, err := prCallInteger(caller, registry, "artifactChecksum")
		if err != nil {
			return fmt.Errorf("read artifactChecksum: %w", err)
		}
		report.Validation["artifact_checksum"] = checksum.String()
		fmt.Printf("artifact checksum: %s\n", checksum.String())
		if nefFile, err := prLoadNEF(prAppAccountNEFPath); err == nil {
			report.Validation["artifact_checksum_matches_local_nef"] = checksum.Cmp(new(big.Int).SetUint64(uint64(nefFile.Checksum))) == 0
		}
	}

	if inv, err := caller.Call(registry, "getEngine", prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ENGINE_ID"), prDefaultEngineID)); err == nil && inv.State == "HALT" {
		row := prStackValues(inv)
		report.Validation["engine_row"] = row
		fmt.Printf("engine row: %v\n", row)
	} else {
		report.Validation["engine_row"] = "not registered"
		fmt.Println("engine row: not registered")
	}

	pause, err := prCallHALT(caller, registry, "getGlobalPause")
	if err != nil {
		return fmt.Errorf("read getGlobalPause: %w", err)
	}
	report.Validation["global_pause"] = prStackValues(pause)
	fmt.Printf("global pause: %v\n", prStackValues(pause))

	fees, err := prCallInteger(caller, registry, "accruedFees")
	if err != nil {
		return fmt.Errorf("read accruedFees: %w", err)
	}
	report.Validation["accrued_fees_gas"] = prFormatBigGas(fees)
	liability, err := prCallInteger(caller, registry, "totalCreditLiability")
	if err != nil {
		return fmt.Errorf("read totalCreditLiability: %w", err)
	}
	report.Validation["total_credit_liability_gas"] = prFormatBigGas(liability)
	fmt.Printf("accrued fees: %s GAS, total credit liability: %s GAS\n", prFormatBigGas(fees), prFormatBigGas(liability))

	if appID := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_SMOKE_APP_ID")); appID != "" {
		if row, err := prCallAppRow(caller, registry, appID); err == nil {
			report.Validation["smoke_app_row"] = row
			fmt.Printf("app %q: %v\n", appID, row)
		} else {
			report.Validation["smoke_app_row"] = "not registered"
			fmt.Printf("app %q: not registered\n", appID)
		}
	}
	report.NextSteps = append(report.NextSteps, "Nothing pending in this read-only verification.")
	return nil
}

// ---------------------------------------------------------------------
// Action: wire-engine
// ---------------------------------------------------------------------

// prWireEngine binds PlatformGame to the registry via setRegistry (admin
// lane on the engine) and asserts the read-back. Refusing to overwrite a
// DIFFERENT non-zero binding keeps a misconfiguration loud instead of
// silently re-pointing the engine.
func prWireEngine(ctx context.Context, client *rpcclient.Client, act *actor.Actor, network string, registry util.Uint160, dryRun bool, report *prReport) error {
	engineHash, engineSource, err := prResolveEngineHash(network)
	if err != nil {
		return err
	}
	report.Validation["engine_id"] = prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ENGINE_ID"), prDefaultEngineID)
	report.Validation["engine_hash"] = "0x" + engineHash.StringLE()
	report.Validation["engine_hash_source"] = engineSource
	if _, err := client.GetContractStateByHash(engineHash); err != nil {
		return fmt.Errorf("engine contract 0x%s not found on-chain (%s): %w", engineHash.StringLE(), engineSource, err)
	}

	current, err := prCallUint160(act, engineHash, "registry")
	if err != nil {
		return fmt.Errorf("read PlatformGame registry(): %w", err)
	}
	report.Validation["platform_game_registry_before"] = "0x" + current.StringLE()
	switch {
	case current == registry:
		report.Validation["wire_engine_skipped"] = "PlatformGame already bound to this registry"
		fmt.Printf("PlatformGame registry() already 0x%s; nothing to do\n", current.StringLE())
		return nil
	case current != (util.Uint160{}):
		return fmt.Errorf("PlatformGame is already bound to a DIFFERENT registry 0x%s; refusing to rebind to 0x%s automatically", current.StringLE(), registry.StringLE())
	}

	if dryRun {
		inv, err := act.Call(engineHash, "setRegistry", registry)
		if err != nil {
			return fmt.Errorf("simulate setRegistry: %w", err)
		}
		if inv.State != "HALT" {
			return fmt.Errorf("simulate setRegistry fault: %s", inv.FaultException)
		}
		report.Validation["wire_engine_simulated"] = true
		fmt.Println("dry run: setRegistry simulation HALT (eligible)")
		return nil
	}

	inv, err := act.Call(engineHash, "setRegistry", registry)
	if err != nil {
		return fmt.Errorf("simulate setRegistry: %w", err)
	}
	if inv.State != "HALT" {
		return fmt.Errorf("simulate setRegistry fault: %s", inv.FaultException)
	}
	txid, _, err := prSendAndWait(ctx, client, act, engineHash, "setRegistry", report, "Wire PlatformGame setRegistry", registry)
	if err != nil {
		return err
	}
	fmt.Printf("setRegistry tx: 0x%s\n", txid.StringLE())
	after, err := prCallUint160(act, engineHash, "registry")
	if err != nil {
		return fmt.Errorf("read PlatformGame registry() after setRegistry: %w", err)
	}
	report.Validation["platform_game_registry_after"] = "0x" + after.StringLE()
	if after != registry {
		return fmt.Errorf("PlatformGame registry() read-back 0x%s does not match target 0x%s", after.StringLE(), registry.StringLE())
	}
	report.Validation["wire_engine_bound"] = true
	report.NextSteps = append(report.NextSteps,
		"PlatformGame is BOUND to the registry: registration (registerApp for custom ids or registerAppByPlatform for miniapp-* ids) and setDescriptor now push activateApp / validateAndApplyDescriptor into the engine.")
	return nil
}

// ---------------------------------------------------------------------
// Action: full-loop
// ---------------------------------------------------------------------

type prFullLoopRecord struct {
	SmokeAppID      string           `json:"smoke_app_id"`
	AccountHash     string           `json:"account_hash,omitempty"`
	AccountMintTxID string           `json:"account_mint_txid,omitempty"`
	MintCreditTxID  string           `json:"mint_credit_txid,omitempty"`
	MintFeeLane     string           `json:"mint_fee_lane,omitempty"`
	FullLoopAppID   string           `json:"fullloop_app_id"`
	CreditTxID      string           `json:"credit_txid,omitempty"`
	RegisterTxID    string           `json:"register_txid,omitempty"`
	AttachTxID      string           `json:"attach_txid,omitempty"`
	AppRow          []interface{}    `json:"app_row,omitempty"`
	GameType        string           `json:"game_type,omitempty"`
	DescriptorKey   string           `json:"descriptor_key,omitempty"`
	DescriptorValue string           `json:"descriptor_value,omitempty"`
	DescriptorTxID  string           `json:"descriptor_txid,omitempty"`
	FundAmount      string           `json:"fund_amount,omitempty"`
	FundTxID        string           `json:"fund_txid,omitempty"`
	FreePoolBefore  string           `json:"free_pool_before,omitempty"`
	FreePoolAfter   string           `json:"free_pool_after,omitempty"`
	HeldForApp      string           `json:"held_for_app,omitempty"`
	Steps           []prFullLoopStep `json:"steps"`
}

type prFullLoopStep struct {
	Name   string `json:"name"`
	Status string `json:"status"` // done | simulated | skipped
	Note   string `json:"note,omitempty"`
}

func prFullLoopStepHasStatus(record *prFullLoopRecord, name string, status string) bool {
	for i := len(record.Steps) - 1; i >= 0; i-- {
		if record.Steps[i].Name == name {
			return record.Steps[i].Status == status
		}
	}
	return false
}

func prActionFullLoop(ctx context.Context, client *rpcclient.Client, act *actor.Actor, network string, registry util.Uint160, signerHash util.Uint160, dryRun bool, report *prReport) error {
	record := &prFullLoopRecord{Steps: []prFullLoopStep{}}
	report.FullLoop = record
	engineID := prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_ENGINE_ID"), prDefaultEngineID)
	engineHash, engineSource, err := prResolveEngineHash(network)
	if err != nil {
		return err
	}
	report.Validation["engine_id"] = engineID
	report.Validation["engine_hash"] = "0x" + engineHash.StringLE()
	report.Validation["engine_hash_source"] = engineSource

	// (a) Execute any matured timelocks inline (idempotent probing idiom),
	// then gate the engine-dependent steps on the outcomes.
	if err := prActionExecuteTimelocks(ctx, client, act, network, registry, dryRun, report); err != nil {
		return err
	}
	version, err := prCallInteger(act, registry, "artifactVersion")
	if err != nil {
		return fmt.Errorf("read artifactVersion: %w", err)
	}
	artifactActive := version.Sign() > 0
	_, engineErr := prCallHALT(act, registry, "getEngine", engineID)
	engineRegistered := engineErr == nil
	report.Validation["full_loop_artifact_active"] = artifactActive
	report.Validation["full_loop_engine_registered"] = engineRegistered
	gatesOpen := artifactActive && engineRegistered
	if !gatesOpen {
		note := fmt.Sprintf("timelocks not yet executed (artifact active: %t, engine registered: %t)", artifactActive, engineRegistered)
		if !dryRun {
			return fmt.Errorf("full-loop cannot proceed: %s — re-run after the timelocks mature (see pending_timelocks)", note)
		}
		record.Steps = append(record.Steps, prFullLoopStep{Name: "execute-timelocks", Status: "skipped", Note: note + " (dry run)"})
		fmt.Println("dry run: " + note + "; engine-dependent steps recorded as skipped")
	} else {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "execute-timelocks", Status: prStepStatus(dryRun), Note: "artifact active and engine registered"})
	}

	// (b) Bind the engine to the registry if it is not already bound.
	if err := prWireEngine(ctx, client, act, network, registry, dryRun, report); err != nil {
		return err
	}
	record.Steps = append(record.Steps, prFullLoopStep{Name: "wire-engine", Status: prStepStatus(dryRun), Note: prWireNote(report)})

	// (c) Mint the smoke app's AppAccount (needs the active artifact).
	if !gatesOpen && dryRun {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "mint-account", Status: "skipped", Note: "awaiting artifact timelock execution"})
	} else if err := prFullLoopMint(ctx, client, act, network, registry, signerHash, dryRun, report, record); err != nil {
		return err
	}

	// (d) Register a fresh app ON the engine (needs engine registered + wired).
	if !gatesOpen && dryRun {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "register-on-engine", Status: "skipped", Note: "awaiting engine timelock execution"})
	} else if err := prFullLoopRegister(ctx, client, act, registry, engineID, engineHash, signerHash, dryRun, report, record); err != nil {
		return err
	}
	registrationSimulated := dryRun && prFullLoopStepHasStatus(record, "register-on-engine", "simulated")
	dependentDryRunNote := "planned after simulated engine registration; independent RPC dry-runs do not persist state"

	// (e) Descriptor lane through the registry into the engine.
	if record.FullLoopAppID == "" {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "descriptor", Status: "skipped", Note: "no engine-backed app available"})
	} else if registrationSimulated {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "descriptor", Status: "skipped", Note: dependentDryRunNote})
	} else if err := prFullLoopDescriptor(ctx, client, act, registry, engineID, record.FullLoopAppID, dryRun, report, record); err != nil {
		return err
	}

	// (f) Fund the app's RewardGame pool on the engine.
	if record.FullLoopAppID == "" {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "fund-pool", Status: "skipped", Note: "no engine-backed app available"})
	} else if registrationSimulated {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "fund-pool", Status: "skipped", Note: dependentDryRunNote})
	} else if err := prFullLoopFund(ctx, client, act, engineHash, record.FullLoopAppID, signerHash, dryRun, report, record); err != nil {
		return err
	}

	// (g) What remains manual.
	report.NextSteps = append(report.NextSteps,
		"RewardGame settlement (startGame/finalizeGame) is deliberately NOT exercised: it requires a live kernel session (module game.session, op session.finalize) — served on testnet by the private kernel 0x2e67d3a62d0020675fd7ba0fa0611fe4d3767a35 wired via deploy_private_kernel.go (PlatformGame oracle repointed 2026-07-18) — out of scope for this script.",
		"Cohort registration and production app onboarding remain manual lanes (registerAppByPlatform + per-app descriptors).",
		"Unconsumed registry credit is reclaimable per app via withdrawCredit(appId, amount).")
	return nil
}

func prStepStatus(dryRun bool) string {
	if dryRun {
		return "simulated"
	}
	return "done"
}

func prWireNote(report *prReport) string {
	if _, ok := report.Validation["wire_engine_skipped"]; ok {
		return "already bound"
	}
	if _, ok := report.Validation["wire_engine_simulated"]; ok {
		return "setRegistry eligible"
	}
	if _, ok := report.Validation["wire_engine_bound"]; ok {
		return "bound this run"
	}
	return "checked"
}

// prFullLoopMint ensures the smoke app holds the mint credit floor and
// calls mintAccount (app-admin lane; free when the signer is also the
// platform admin — the registry's pipeline exemption).
func prFullLoopMint(ctx context.Context, client *rpcclient.Client, act *actor.Actor, network string, registry util.Uint160, signerHash util.Uint160, dryRun bool, report *prReport, record *prFullLoopRecord) error {
	appID := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_SMOKE_APP_ID"))
	if appID == "" {
		if fromReport, ok := prSmokeAppIDFromReports(network); ok {
			appID = fromReport
		} else {
			return fmt.Errorf("no smoke app known: set PLATFORM_REGISTRY_SMOKE_APP_ID (no deploy report records smoke_test.app_id)")
		}
	}
	if !prAppIDPattern.MatchString(appID) {
		return fmt.Errorf("invalid smoke appId %q (charset [a-z0-9-_.], 1-64 chars)", appID)
	}
	record.SmokeAppID = appID

	if _, err := prCallAppRow(act, registry, appID); err != nil {
		return fmt.Errorf("smoke app %q is not registered: %w", appID, err)
	}

	existing, err := prCallUint160(act, registry, "appAccountOf", appID)
	if err != nil {
		return fmt.Errorf("read appAccountOf(%s): %w", appID, err)
	}
	if existing != (util.Uint160{}) {
		record.AccountHash = "0x" + existing.StringLE()
		echo, err := prCallString(act, registry, "appIdOfAccount", existing)
		if err != nil {
			return fmt.Errorf("read appIdOfAccount(%s): %w", record.AccountHash, err)
		}
		if echo != appID {
			return fmt.Errorf("appIdOfAccount(%s) round-trip returned %q, expected %q", record.AccountHash, echo, appID)
		}
		record.Steps = append(record.Steps, prFullLoopStep{Name: "mint-account", Status: "skipped", Note: "account already minted at " + record.AccountHash})
		fmt.Printf("smoke app %q already has account 0x%s (round-trip ok)\n", appID, existing.StringLE())
		return nil
	}

	admin, err := prCallUint160(act, registry, "admin")
	if err != nil {
		return fmt.Errorf("read registry admin: %w", err)
	}
	platformAdmin := admin == signerHash
	if platformAdmin {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "mint-credit", Status: "skipped", Note: "platform-admin mint lane is exempt from the 10 GAS registry fee"})
	} else {
		target, err := prGasFractionsEnv("PLATFORM_REGISTRY_FULLLOOP_MINT_CREDIT_GAS", prFullLoopMintCreditGas)
		if err != nil {
			return err
		}
		credit, err := prCallInteger(act, registry, "creditOf", appID, signerHash)
		if err != nil {
			return fmt.Errorf("read creditOf(%s): %w", appID, err)
		}
		gasHash, err := prParseHash(prGasHashLE)
		if err != nil {
			return err
		}
		deficit := new(big.Int).Sub(big.NewInt(target), credit)
		if deficit.Sign() > 0 {
			memo := appID + ":credit"
			if err := prDepositCredit(ctx, client, act, gasHash, registry, signerHash, deficit.Int64(), memo, dryRun, report, "Mint credit top-up ("+memo+")"); err != nil {
				return err
			}
			record.Steps = append(record.Steps, prFullLoopStep{Name: "mint-credit", Status: prStepStatus(dryRun), Note: fmt.Sprintf("topped up %s GAS to the %s GAS floor (memo %q)", prFormatBigGas(deficit), prFormatGas(target), memo)})
			if !dryRun {
				record.MintCreditTxID = report.Transactions[len(report.Transactions)-1].TxID
				credit, err = prCallInteger(act, registry, "creditOf", appID, signerHash)
				if err != nil {
					return fmt.Errorf("read creditOf(%s) after top-up: %w", appID, err)
				}
				if credit.Cmp(big.NewInt(target)) < 0 {
					return fmt.Errorf("credit %s below the %s GAS mint floor after top-up", prFormatBigGas(credit), prFormatGas(target))
				}
			}
		} else {
			record.Steps = append(record.Steps, prFullLoopStep{Name: "mint-credit", Status: "skipped", Note: "credit floor already met"})
		}
	}

	feesBefore, err := prCallInteger(act, registry, "accruedFees")
	if err != nil {
		return fmt.Errorf("read accruedFees: %w", err)
	}
	if dryRun {
		inv, err := act.Call(registry, "mintAccount", appID)
		if err != nil {
			return fmt.Errorf("simulate mintAccount(%s): %w", appID, err)
		}
		if inv.State != "HALT" {
			return fmt.Errorf("simulate mintAccount(%s) fault: %s", appID, inv.FaultException)
		}
		record.Steps = append(record.Steps, prFullLoopStep{Name: "mint-account", Status: "simulated", Note: "mintAccount simulation HALT (eligible)"})
		fmt.Printf("dry run: mintAccount(%s) simulation HALT (eligible)\n", appID)
		return nil
	}

	txid, _, err := prSendAndWait(ctx, client, act, registry, "mintAccount", report, "Mint AppAccount "+appID, appID)
	if err != nil {
		return err
	}
	record.AccountMintTxID = "0x" + txid.StringLE()
	fmt.Printf("mintAccount tx: 0x%s\n", txid.StringLE())

	account, err := prCallUint160(act, registry, "appAccountOf", appID)
	if err != nil {
		return fmt.Errorf("read appAccountOf(%s) after mint: %w", appID, err)
	}
	if account == (util.Uint160{}) {
		return fmt.Errorf("appAccountOf(%s) still zero after mintAccount", appID)
	}
	record.AccountHash = "0x" + account.StringLE()
	echo, err := prCallString(act, registry, "appIdOfAccount", account)
	if err != nil {
		return fmt.Errorf("read appIdOfAccount(%s): %w", record.AccountHash, err)
	}
	if echo != appID {
		return fmt.Errorf("appIdOfAccount(%s) round-trip returned %q, expected %q", record.AccountHash, echo, appID)
	}
	feesAfter, err := prCallInteger(act, registry, "accruedFees")
	if err != nil {
		return fmt.Errorf("read accruedFees after mint: %w", err)
	}
	if new(big.Int).Sub(feesAfter, feesBefore).Cmp(big.NewInt(prAccountMintFee)) == 0 {
		record.MintFeeLane = "app-admin-credit (10 GAS consumed)"
	} else {
		record.MintFeeLane = "platform-admin-exempt (no credit consumed)"
	}
	record.Steps = append(record.Steps, prFullLoopStep{Name: "mint-account", Status: "done", Note: "account " + record.AccountHash + "; fee lane: " + record.MintFeeLane})
	fmt.Printf("smoke app %q account minted: %s (fee lane: %s)\n", appID, record.AccountHash, record.MintFeeLane)
	report.NextSteps = append(report.NextSteps,
		fmt.Sprintf("Smoke app %q now has a materialized AppAccount at %s (the treasury shim; descriptor-governed spend lanes live in the registry treasury ABI).", appID, record.AccountHash))
	return nil
}

// prFullLoopRegister registers a fresh app ON the engine, proving the
// registry -> engine activateApp push (gameType 5 row appears engine-side).
func prFullLoopRegister(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, engineID string, engineHash util.Uint160, signerHash util.Uint160, dryRun bool, report *prReport, record *prFullLoopRecord) error {
	appID := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_FULLLOOP_APP_ID"))
	if appID == "" {
		appID = fmt.Sprintf("fullloop-%d", time.Now().Unix())
	}
	if !prAppIDPattern.MatchString(appID) {
		return fmt.Errorf("invalid PLATFORM_REGISTRY_FULLLOOP_APP_ID %q (charset [a-z0-9-_.], 1-64 chars)", appID)
	}
	record.FullLoopAppID = appID

	attachOnly := false
	if row, err := prCallAppRow(act, registry, appID); err == nil {
		attached, _ := row[0].(string)
		switch attached {
		case engineID:
			record.AppRow = row
			record.Steps = append(record.Steps, prFullLoopStep{Name: "register-on-engine", Status: "skipped", Note: "appId already registered on engine " + engineID})
			fmt.Printf("fullloop app %q already registered on engine %q\n", appID, engineID)
			return prFullLoopAssertEngineRow(act, engineHash, appID, record)
		case "":
			attachOnly = true // lite row from an earlier run: attach the engine now
		default:
			return fmt.Errorf("appId %q already registered on a DIFFERENT engine %q", appID, attached)
		}
	}

	if !attachOnly && !prIsPlatformOwnedAppID(appID) {
		creditGas, err := strconv.ParseFloat(prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_FULLLOOP_CREDIT_GAS"), strconv.FormatFloat(prFullLoopCreditGas, 'f', -1, 64)), 64)
		if err != nil || creditGas <= 0 {
			return fmt.Errorf("invalid PLATFORM_REGISTRY_FULLLOOP_CREDIT_GAS (must be a positive number of GAS)")
		}
		creditFractions := int64(math.Round(creditGas * prGasFractionsPerGas))
		credit, err := prCallInteger(act, registry, "creditOf", appID, signerHash)
		if err != nil {
			return fmt.Errorf("read creditOf(%s): %w", appID, err)
		}
		gasHash, err := prParseHash(prGasHashLE)
		if err != nil {
			return err
		}
		if credit.Cmp(big.NewInt(prLiteRegistrationFee)) < 0 {
			memo := appID + ":credit"
			if err := prDepositCredit(ctx, client, act, gasHash, registry, signerHash, creditFractions, memo, dryRun, report, "Full-loop credit deposit ("+memo+")"); err != nil {
				return err
			}
			record.Steps = append(record.Steps, prFullLoopStep{Name: "register-credit", Status: prStepStatus(dryRun), Note: fmt.Sprintf("deposited %s GAS (memo %q)", prFormatGas(creditFractions), memo)})
			if !dryRun {
				record.CreditTxID = report.Transactions[len(report.Transactions)-1].TxID
			}
		}
	}

	method, label := prRegistrationMethod(appID), "Full-loop "+prRegistrationMethod(appID)+" "+appID
	var params []any
	if attachOnly {
		method, label = "attachEngine", "Full-loop attachEngine "+appID
		params = []any{appID, engineID}
	} else {
		params = []any{appID, engineID, signerHash, nil}
	}
	inv, err := act.Call(registry, method, params...)
	if err != nil {
		return fmt.Errorf("simulate %s: %w", label, err)
	}
	if inv.State != "HALT" {
		if dryRun && strings.Contains(inv.FaultException, "insufficient credit") {
			record.Steps = append(record.Steps, prFullLoopStep{Name: "register-on-engine", Status: "simulated", Note: method + " becomes eligible after the credit deposit"})
			return nil
		}
		return fmt.Errorf("simulate %s fault: %s", label, inv.FaultException)
	}
	if dryRun {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "register-on-engine", Status: "simulated", Note: method + " simulation HALT (eligible)"})
		fmt.Printf("dry run: %s simulation HALT (eligible)\n", label)
		return nil
	}
	txid, _, err := prSendAndWait(ctx, client, act, registry, method, report, label, params...)
	if err != nil {
		return err
	}
	if attachOnly {
		record.AttachTxID = "0x" + txid.StringLE()
	} else {
		record.RegisterTxID = "0x" + txid.StringLE()
	}
	fmt.Printf("%s tx: 0x%s\n", method, txid.StringLE())

	row, err := prCallAppRow(act, registry, appID)
	if err != nil {
		return fmt.Errorf("read getApp(%s) after %s: %w", appID, method, err)
	}
	record.AppRow = row
	attached, _ := row[0].(string)
	if attached != engineID {
		return fmt.Errorf("getApp(%s) engineId %q, expected %q", appID, attached, engineID)
	}
	if rowHash, _ := row[1].(string); rowHash != "0x"+engineHash.StringLE() {
		return fmt.Errorf("getApp(%s) engineHash %v, expected 0x%s", appID, row[1], engineHash.StringLE())
	}
	record.Steps = append(record.Steps, prFullLoopStep{Name: "register-on-engine", Status: "done", Note: "registry row engineId=" + attached})
	return prFullLoopAssertEngineRow(act, engineHash, appID, record)
}

// prFullLoopAssertEngineRow proves the activateApp push landed: the engine
// holds a gameType-5 row for the app.
func prFullLoopAssertEngineRow(act *actor.Actor, engineHash util.Uint160, appID string, record *prFullLoopRecord) error {
	gameType, err := prCallInteger(act, engineHash, "getGameType", appID)
	if err != nil {
		return fmt.Errorf("read PlatformGame getGameType(%s): %w", appID, err)
	}
	record.GameType = gameType.String()
	if gameType.Cmp(big.NewInt(prRewardGameType)) != 0 {
		return fmt.Errorf("PlatformGame getGameType(%s) = %s, expected %d (RewardGame) — the activateApp push did not land", appID, gameType.String(), prRewardGameType)
	}
	fmt.Printf("PlatformGame getGameType(%s) = %s (RewardGame)\n", appID, gameType.String())
	return nil
}

// prFullLoopDescriptor exercises the registry -> engine descriptor lane
// (default "<engineId>:dailyCap", engine-validated range 1..100).
func prFullLoopDescriptor(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, engineID string, appID string, dryRun bool, report *prReport, record *prFullLoopRecord) error {
	key := prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_FULLLOOP_DESCRIPTOR_KEY"), engineID+":"+prFullLoopDescriptorParam)
	if !strings.HasPrefix(key, engineID+":") || len(key) <= len(engineID)+1 {
		return fmt.Errorf("descriptor key %q must be namespaced %q", key, engineID+":<param>")
	}
	value, err := strconv.ParseInt(prFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_FULLLOOP_DESCRIPTOR_VALUE"), strconv.FormatInt(prFullLoopDescriptorValue, 10)), 10, 64)
	if err != nil {
		return fmt.Errorf("invalid PLATFORM_REGISTRY_FULLLOOP_DESCRIPTOR_VALUE (must be an integer)")
	}
	if strings.HasSuffix(key, ":"+prFullLoopDescriptorParam) && (value < 1 || value > prRewardGameMaxDailyCap) {
		return fmt.Errorf("dailyCap value %d out of the engine-validated range 1..%d", value, prRewardGameMaxDailyCap)
	}
	record.DescriptorKey = key
	record.DescriptorValue = strconv.FormatInt(value, 10)

	if _, err := prCallAppRow(act, registry, appID); err != nil {
		if dryRun {
			record.Steps = append(record.Steps, prFullLoopStep{Name: "descriptor", Status: "skipped", Note: "app not registered on-chain (registration was only simulated)"})
			return nil
		}
		return fmt.Errorf("app %q not registered for the descriptor step: %w", appID, err)
	}

	current, err := prCallInteger(act, registry, "getDescriptor", appID, key)
	if err == nil && current.Cmp(big.NewInt(value)) == 0 {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "descriptor", Status: "skipped", Note: fmt.Sprintf("%s already %d", key, value)})
		fmt.Printf("descriptor %s already %d for %q; skipping\n", key, value, appID)
		return nil
	}

	inv, err := act.Call(registry, "setDescriptor", appID, key, value)
	if err != nil {
		return fmt.Errorf("simulate setDescriptor(%s): %w", key, err)
	}
	if inv.State != "HALT" {
		return fmt.Errorf("simulate setDescriptor(%s) fault: %s", key, inv.FaultException)
	}
	if dryRun {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "descriptor", Status: "simulated", Note: "setDescriptor simulation HALT (eligible)"})
		fmt.Printf("dry run: setDescriptor(%s, %s, %d) simulation HALT (eligible)\n", appID, key, value)
		return nil
	}
	txid, _, err := prSendAndWait(ctx, client, act, registry, "setDescriptor", report, "Full-loop setDescriptor "+key, appID, key, value)
	if err != nil {
		return err
	}
	record.DescriptorTxID = "0x" + txid.StringLE()
	fmt.Printf("setDescriptor tx: 0x%s\n", txid.StringLE())

	after, err := prCallInteger(act, registry, "getDescriptor", appID, key)
	if err != nil {
		return fmt.Errorf("read getDescriptor(%s) after write: %w", key, err)
	}
	if after.Cmp(big.NewInt(value)) != 0 {
		return fmt.Errorf("getDescriptor(%s) = %s after write, expected %d", key, after.String(), value)
	}
	record.Steps = append(record.Steps, prFullLoopStep{Name: "descriptor", Status: "done", Note: fmt.Sprintf("%s=%d (engine applied via validateAndApplyDescriptor; no engine-side economics read exists, the HALTed forward call is the range proof)", key, value)})
	fmt.Printf("descriptor %s=%d applied for %q\n", key, value, appID)
	return nil
}

// prFullLoopFund tops the app's RewardGame pool up to the fund target with
// the "appId:fund" memo, then asserts the freePool delta.
func prFullLoopFund(ctx context.Context, client *rpcclient.Client, act *actor.Actor, engineHash util.Uint160, appID string, signerHash util.Uint160, dryRun bool, report *prReport, record *prFullLoopRecord) error {
	target, err := prGasFractionsEnv("PLATFORM_REGISTRY_FULLLOOP_FUND_GAS", prFullLoopFundGas)
	if err != nil {
		return err
	}
	gameType, err := prCallInteger(act, engineHash, "getGameType", appID)
	if err != nil || gameType.Cmp(big.NewInt(prRewardGameType)) != 0 {
		if dryRun {
			record.Steps = append(record.Steps, prFullLoopStep{Name: "fund-pool", Status: "skipped", Note: "app not registered on the engine (registration was only simulated)"})
			return nil
		}
		if err != nil {
			return fmt.Errorf("read getGameType(%s) for the fund step: %w", appID, err)
		}
		return fmt.Errorf("PlatformGame getGameType(%s) = %s, expected %d (RewardGame) before funding", appID, gameType.String(), prRewardGameType)
	}
	freeBefore, err := prCallInteger(act, engineHash, "freePool", appID)
	if err != nil {
		return fmt.Errorf("read freePool(%s): %w", appID, err)
	}
	record.FreePoolBefore = prFormatBigGas(freeBefore)
	heldBefore, err := prCallInteger(act, engineHash, "heldForApp", appID)
	if err != nil {
		return fmt.Errorf("read heldForApp(%s): %w", appID, err)
	}

	amount := new(big.Int).Sub(big.NewInt(target), freeBefore)
	if amount.Sign() <= 0 {
		held, err := prCallInteger(act, engineHash, "heldForApp", appID)
		if err != nil {
			return fmt.Errorf("read heldForApp(%s): %w", appID, err)
		}
		record.HeldForApp = prFormatBigGas(held)
		record.Steps = append(record.Steps, prFullLoopStep{Name: "fund-pool", Status: "skipped", Note: fmt.Sprintf("freePool %s GAS already >= %s GAS target", prFormatBigGas(freeBefore), prFormatGas(target))})
		fmt.Printf("freePool(%s) already %s GAS; fund skipped\n", appID, prFormatBigGas(freeBefore))
		return nil
	}

	gasHash, err := prParseHash(prGasHashLE)
	if err != nil {
		return err
	}
	memo := appID + ":fund"
	record.FundAmount = prFormatBigGas(amount)
	inv, err := act.Call(gasHash, "transfer", signerHash, engineHash, amount.Int64(), memo)
	if err != nil {
		return fmt.Errorf("simulate pool fund transfer: %w", err)
	}
	if inv.State != "HALT" {
		return fmt.Errorf("simulate pool fund transfer fault: %s", inv.FaultException)
	}
	if dryRun {
		record.Steps = append(record.Steps, prFullLoopStep{Name: "fund-pool", Status: "simulated", Note: fmt.Sprintf("would fund %s GAS with memo %q", prFormatBigGas(amount), memo)})
		fmt.Printf("dry run: pool fund simulation HALT (%s GAS, memo %q)\n", prFormatBigGas(amount), memo)
		return nil
	}
	txid, _, err := prSendAndWait(ctx, client, act, gasHash, "transfer", report, "Full-loop pool fund ("+memo+")", signerHash, engineHash, amount.Int64(), memo)
	if err != nil {
		return err
	}
	record.FundTxID = "0x" + txid.StringLE()
	fmt.Printf("pool fund tx: 0x%s (%s GAS, memo %q)\n", txid.StringLE(), prFormatBigGas(amount), memo)

	freeAfter, err := prCallInteger(act, engineHash, "freePool", appID)
	if err != nil {
		return fmt.Errorf("read freePool(%s) after fund: %w", appID, err)
	}
	record.FreePoolAfter = prFormatBigGas(freeAfter)
	if new(big.Int).Sub(freeAfter, freeBefore).Cmp(amount) != 0 {
		return fmt.Errorf("freePool delta %s != funded amount %s", prFormatBigGas(new(big.Int).Sub(freeAfter, freeBefore)), prFormatBigGas(amount))
	}
	heldAfter, err := prCallInteger(act, engineHash, "heldForApp", appID)
	if err != nil {
		return fmt.Errorf("read heldForApp(%s) after fund: %w", appID, err)
	}
	record.HeldForApp = prFormatBigGas(heldAfter)
	if new(big.Int).Sub(heldAfter, heldBefore).Cmp(amount) != 0 {
		return fmt.Errorf("heldForApp delta %s != funded amount %s (solvency counter must track external inflow)", prFormatBigGas(new(big.Int).Sub(heldAfter, heldBefore)), prFormatBigGas(amount))
	}
	record.Steps = append(record.Steps, prFullLoopStep{Name: "fund-pool", Status: "done", Note: fmt.Sprintf("freePool %s -> %s GAS, heldForApp %s GAS", prFormatBigGas(freeBefore), prFormatBigGas(freeAfter), prFormatBigGas(heldAfter))})
	fmt.Printf("freePool(%s) %s -> %s GAS; heldForApp %s GAS\n", appID, prFormatBigGas(freeBefore), prFormatBigGas(freeAfter), prFormatBigGas(heldAfter))
	return nil
}

// prDepositCredit sends (or simulates) a memo-routed GAS credit transfer.
func prDepositCredit(ctx context.Context, client *rpcclient.Client, act *actor.Actor, gasHash util.Uint160, to util.Uint160, signerHash util.Uint160, amount int64, memo string, dryRun bool, report *prReport, label string) error {
	inv, err := act.Call(gasHash, "transfer", signerHash, to, amount, memo)
	if err != nil {
		return fmt.Errorf("simulate credit transfer (%s): %w", memo, err)
	}
	if inv.State != "HALT" {
		return fmt.Errorf("simulate credit transfer (%s) fault: %s", memo, inv.FaultException)
	}
	if dryRun {
		fmt.Printf("dry run: credit transfer simulation HALT (%s GAS, memo %q)\n", prFormatGas(amount), memo)
		return nil
	}
	txid, _, err := prSendAndWait(ctx, client, act, gasHash, "transfer", report, label, signerHash, to, amount, memo)
	if err != nil {
		return err
	}
	fmt.Printf("credit transfer tx: 0x%s (%s GAS, memo %q)\n", txid.StringLE(), prFormatGas(amount), memo)
	return nil
}

// prGasFractionsEnv parses a GAS-denominated float env into base fractions.
func prGasFractionsEnv(key string, defaultGas float64) (int64, error) {
	value, err := strconv.ParseFloat(prFirstNonEmpty(os.Getenv(key), strconv.FormatFloat(defaultGas, 'f', -1, 64)), 64)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid %s (must be a positive number of GAS)", key)
	}
	return int64(math.Round(value * prGasFractionsPerGas)), nil
}

// prCallString reads a String-valued [Safe] method.
func prCallString(act *actor.Actor, contract util.Uint160, method string, params ...any) (string, error) {
	inv, err := prCallHALT(act, contract, method, params...)
	if err != nil {
		return "", err
	}
	if len(inv.Stack) == 0 {
		return "", nil
	}
	bytes, err := inv.Stack[0].TryBytes()
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ---------------------------------------------------------------------
// Artifact splice (byte-exact mirror of the on-chain ValidateArtifact
// and the contracts/__tests__ PlatformRegistryHarness.LoadAccountArtifact
// split): head ends at the 8-char marker `"name":"`, tail opens with the
// name-closing quote, and the probe splice must parse with name round-trip.
// ---------------------------------------------------------------------

func prLoadAccountArtifact() ([]byte, string, string, error) {
	nefBytes, err := os.ReadFile(prAppAccountNEFPath)
	if err != nil {
		return nil, "", "", fmt.Errorf("read nef %s: %w", prAppAccountNEFPath, err)
	}
	head, tail, err := prSplitAppAccountManifest()
	if err != nil {
		return nil, "", "", err
	}
	return nefBytes, head, tail, nil
}

func prSplitAppAccountManifest() (string, string, error) {
	raw, err := os.ReadFile(prAppAccountManifestPath)
	if err != nil {
		return "", "", fmt.Errorf("read manifest %s: %w", prAppAccountManifestPath, err)
	}
	const marker = `"name":"AppAccount"`
	idx := strings.Index(string(raw), marker)
	if idx < 0 {
		return "", "", fmt.Errorf("%s does not contain the %s marker; the committed AppAccount manifest must keep its compact canonical form", prAppAccountManifestPath, marker)
	}
	headEnd := idx + len(`"name":"`)
	tailStart := headEnd + len("AppAccount")
	head := string(raw[:headEnd])
	tail := string(raw[tailStart:])

	// Local mirror of PlatformRegistry.Accounts.cs ValidateArtifact.
	if len(head) < 8 || !strings.HasSuffix(head, `"name":"`) {
		return "", "", fmt.Errorf("manifest head does not end at the name marker")
	}
	if len(tail) < 1 || !strings.HasPrefix(tail, `"`) {
		return "", "", fmt.Errorf("manifest tail does not open with the name-closing quote")
	}
	if len(head)+len(tail)+prMaxAppIDLength > prMaxManifestLength {
		return "", "", fmt.Errorf("manifest halves exceed the on-chain maximum")
	}
	var probe map[string]interface{}
	if err := json.Unmarshal([]byte(head+prArtifactProbeID+tail), &probe); err != nil {
		return "", "", fmt.Errorf("manifest halves do not splice with the probe id: %w", err)
	}
	if probe["name"] != prArtifactProbeID {
		return "", "", fmt.Errorf("manifest name is not splice-addressable (probe round-trip failed)")
	}
	return head, tail, nil
}

// ---------------------------------------------------------------------
// Hash resolution
// ---------------------------------------------------------------------

// prResolveRegistryHash resolves the deployed registry: network-scoped env
// first, then the newest deploy/config/platform-registry-<network>-*.json
// report, then the predicted hash from the local artifacts.
func prResolveRegistryHash(client *rpcclient.Client, network string, signerHash util.Uint160) (util.Uint160, error) {
	networkName := strings.ToUpper(strings.ReplaceAll(network, "-", "_"))
	for _, key := range []string{"PLATFORM_REGISTRY_" + networkName + "_HASH", "PLATFORM_REGISTRY_HASH"} {
		if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
			return prParseHash(raw)
		}
	}
	if hash, source, ok := prRegistryHashFromReports(network); ok {
		if _, err := client.GetContractStateByHash(hash); err == nil {
			fmt.Printf("resolved PlatformRegistry 0x%s from %s\n", hash.StringLE(), source)
			return hash, nil
		} else {
			return util.Uint160{}, fmt.Errorf("PlatformRegistry 0x%s (from %s) not found on-chain: %w", hash.StringLE(), source, err)
		}
	}
	nefFile, err := prLoadNEF(prRegistryNEFPath)
	if err != nil {
		return util.Uint160{}, err
	}
	mani, err := prLoadManifest(prRegistryManifestPath)
	if err != nil {
		return util.Uint160{}, err
	}
	predicted := state.CreateContractHash(signerHash, nefFile.Checksum, mani.Name)
	if _, err := client.GetContractStateByHash(predicted); err == nil {
		fmt.Printf("resolved PlatformRegistry at predicted hash 0x%s\n", predicted.StringLE())
		return predicted, nil
	}
	return util.Uint160{}, fmt.Errorf("PlatformRegistry not found at predicted hash 0x%s and no deploy/config/platform-registry-%s-*.json report records it; deploy first (PLATFORM_REGISTRY_ACTION=deploy) or set PLATFORM_REGISTRY_%s_HASH", predicted.StringLE(), network, networkName)
}

// prPreviousReport is the subset of this script's own JSON reports that
// later runs consume for hash/appId resolution.
type prPreviousReport struct {
	PlatformRegistry string `json:"platform_registry"`
	SmokeTest        *struct {
		AppID string `json:"app_id"`
	} `json:"smoke_test"`
}

// prReportCandidates returns the report files for a network, newest first
// (the date-stamped names sort chronologically).
func prReportCandidates(network string) []string {
	matches, err := filepath.Glob(filepath.Join("deploy", "config", "platform-registry-"+network+"-*.json"))
	if err != nil {
		return nil
	}
	sort.Strings(matches)
	for i, j := 0, len(matches)-1; i < j; i, j = i+1, j-1 {
		matches[i], matches[j] = matches[j], matches[i]
	}
	return matches
}

func prRegistryHashFromReports(network string) (util.Uint160, string, bool) {
	for _, path := range prReportCandidates(network) {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var previous prPreviousReport
		if err := json.Unmarshal(data, &previous); err != nil {
			continue
		}
		if strings.TrimSpace(previous.PlatformRegistry) == "" {
			continue
		}
		hash, err := prParseHash(previous.PlatformRegistry)
		if err != nil {
			continue
		}
		return hash, path, true
	}
	return util.Uint160{}, "", false
}

// prSmokeAppIDFromReports finds the newest recorded smoke app id.
func prSmokeAppIDFromReports(network string) (string, bool) {
	for _, path := range prReportCandidates(network) {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var previous prPreviousReport
		if err := json.Unmarshal(data, &previous); err != nil {
			continue
		}
		if previous.SmokeTest != nil && prAppIDPattern.MatchString(previous.SmokeTest.AppID) {
			return previous.SmokeTest.AppID, true
		}
	}
	return "", false
}

// prResolveEngineHash mirrors update_platform_contracts.go loadTargets:
// network-scoped env first, then the game deployment record, then the
// committed default.
func prResolveEngineHash(network string) (util.Uint160, string, error) {
	networkName := strings.ToUpper(strings.ReplaceAll(network, "-", "_"))
	for _, key := range []string{"PLATFORM_GAME_" + networkName + "_HASH", "PLATFORM_GAME_HASH"} {
		if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
			hash, err := prParseHash(raw)
			return hash, "env " + key, err
		}
	}
	type gameDeployment struct {
		PlatformGame string `json:"platform_game"`
	}
	var deployed gameDeployment
	recordPath := fmt.Sprintf("contracts/build/%s_game_deployment.json", network)
	if data, err := os.ReadFile(recordPath); err == nil {
		if err := json.Unmarshal(data, &deployed); err == nil && strings.TrimSpace(deployed.PlatformGame) != "" {
			hash, err := prParseHash(deployed.PlatformGame)
			return hash, recordPath, err
		}
	}
	fallback := prTestnetPlatformGameHash
	if network == "mainnet" {
		fallback = prMainnetPlatformGameHash
	}
	hash, err := prParseHash(fallback)
	return hash, "built-in default", err
}

// ---------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------

func prSendAndWait(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contract util.Uint160, method string, report *prReport, label string, params ...any) (util.Uint256, *result.ApplicationLog, error) {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return util.Uint256{}, nil, fmt.Errorf("%s (%s): %w", label, method, err)
	}
	report.Transactions = append(report.Transactions, prTxRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	appLog, err := prWaitForTx(ctx, client, txid)
	if err != nil {
		return txid, nil, err
	}
	return txid, appLog, nil
}

func prWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) (*result.ApplicationLog, error) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	timeout := time.After(150 * time.Second)
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timeout:
			return nil, fmt.Errorf("timeout waiting for transaction 0x%s", txid.StringLE())
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
				return appLog, nil
			}
			return nil, fmt.Errorf("transaction 0x%s failed: %s", txid.StringLE(), exec.FaultException)
		}
	}
}

func prCallHALT(caller prCaller, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := caller.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func prCallInteger(caller prCaller, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := prCallHALT(caller, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	return inv.Stack[0].TryInteger()
}

func prCallUint160(caller prCaller, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
	inv, err := prCallHALT(caller, contract, method, params...)
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

// prCallAppRow decodes getApp: [engineId, engineHash, appAdmin, accountHash,
// materialized, active].
func prCallAppRow(caller prCaller, contract util.Uint160, appID string) ([]interface{}, error) {
	inv, err := prCallHALT(caller, contract, "getApp", appID)
	if err != nil {
		return nil, err
	}
	return prStackValues(inv), nil
}

func prStackValues(inv *result.Invoke) []interface{} {
	out := []interface{}{}
	if len(inv.Stack) == 0 {
		return out
	}
	items, ok := inv.Stack[0].Value().([]stackitem.Item)
	if !ok {
		return append(out, prStackValue(inv.Stack[0]))
	}
	for _, item := range items {
		out = append(out, prStackValue(item))
	}
	return out
}

func prStackValue(item stackitem.Item) interface{} {
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

// prEventInteger extracts an integer event argument from a confirmed
// transaction's application log (e.g. the executeAfter of ArtifactProposed
// [version, executeAfter] or EngineChangeProposed [engineId, engineHash,
// schemaVersion, retire, executeAfter]).
func prEventInteger(appLog *result.ApplicationLog, contract util.Uint160, eventName string, index int) (int64, bool) {
	if appLog == nil || len(appLog.Executions) == 0 {
		return 0, false
	}
	for _, event := range appLog.Executions[0].Events {
		if event.ScriptHash != contract || event.Name != eventName || event.Item == nil {
			continue
		}
		items, ok := event.Item.Value().([]stackitem.Item)
		if !ok || len(items) <= index {
			continue
		}
		if value, err := items[index].TryInteger(); err == nil {
			return value.Int64(), true
		}
	}
	return 0, false
}

func prSignerBalances(client *rpcclient.Client, signer util.Uint160) (int64, int64, error) {
	balances, err := client.GetNEP17Balances(signer)
	if err != nil {
		return 0, 0, err
	}
	var neo, gas int64
	for _, bal := range balances.Balances {
		amount, err := strconv.ParseInt(bal.Amount, 10, 64)
		if err != nil {
			continue
		}
		switch strings.ToLower("0x" + bal.Asset.StringLE()) {
		case prNeoHashLE:
			neo = amount
		case prGasHashLE:
			gas = amount
		}
	}
	return neo, gas, nil
}

// ---------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------

func prLoadNEF(path string) (*nef.File, error) {
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

func prLoadManifest(path string) (*manifest.Manifest, error) {
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

func prParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func prParseSignerIdentity(raw string) (util.Uint160, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return util.Uint160{}, fmt.Errorf("public signer identity is required as a Neo address or script hash")
	}
	if strings.HasPrefix(trimmed, "0x") || len(trimmed) == 40 {
		hash, err := prParseHash(trimmed)
		if err != nil {
			return util.Uint160{}, fmt.Errorf("invalid PLATFORM_REGISTRY_VERIFY_SIGNER script hash")
		}
		return hash, nil
	}
	hash, err := address.StringToUint160(trimmed)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("invalid PLATFORM_REGISTRY_VERIFY_SIGNER Neo address")
	}
	return hash, nil
}

func prMinGasThreshold(action string) float64 {
	if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_MIN_GAS")); raw != "" {
		if value, err := strconv.ParseFloat(raw, 64); err == nil && value >= 0 {
			return value
		}
	}
	switch action {
	case "execute-timelocks":
		return prDefaultMinGasTimelocks
	case "wire-engine":
		return prDefaultMinGasWireEngine
	case "full-loop":
		return prDefaultMinGasFullLoop
	case "verify":
		return 0
	}
	return prDefaultMinGasDeploy
}

func prReportPath(network string) string {
	if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_DEPLOY_REPORT_PATH")); raw != "" {
		return raw
	}
	return filepath.Join("deploy", "config", fmt.Sprintf("platform-registry-%s-%s.json", network, time.Now().UTC().Format("2006-01-02")))
}

func prWriteReport(path string, report prReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, append(out, '\n'), 0644)
}

func prPrintNextSteps(report prReport) {
	fmt.Println()
	fmt.Println("NEXT STEPS")
	fmt.Println("==========")
	pending := 0
	for _, record := range report.PendingTimelocks {
		if record.Status == "pending" || record.Status == "matured" {
			pending++
			when := record.ExecuteAfterUTC
			if when == "" {
				when = "unknown (re-proposed elsewhere; probe with execute-timelocks)"
			}
			fmt.Printf("%d. Pending timelock %s (%s) — executes after %s [tx %s]\n", pending, record.Kind, record.Status, when, record.TxID)
		}
	}
	if pending > 0 {
		fmt.Println("   After the timelocks mature, execute both with:")
		fmt.Println("     PLATFORM_REGISTRY_ACTION=execute-timelocks PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false \\")
		fmt.Printf("       CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s NEO_TESTNET_WIF=<wif> \\\n", prConfirmPhrase)
		fmt.Println("       go run -tags scripts deploy/scripts/deploy_platform_registry.go")
	}
	fmt.Println("   Read-only state check at any time:")
	fmt.Println("     PLATFORM_REGISTRY_ACTION=verify go run -tags scripts deploy/scripts/deploy_platform_registry.go")
	for _, step := range report.NextSteps {
		fmt.Println(" - " + step)
	}
	fmt.Println("   Note: the PlatformGame engine-ABI update is tracked separately; this script does not block on it.")
}

func prFormatGas(fractions int64) string {
	return strconv.FormatFloat(float64(fractions)/prGasFractionsPerGas, 'f', 8, 64)
}

func prFormatBigGas(value *big.Int) string {
	rat := new(big.Rat).SetFrac(value, big.NewInt(100_000_000))
	return rat.FloatString(8)
}

func prFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func prTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
