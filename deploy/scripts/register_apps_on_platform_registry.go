//go:build scripts

// Reconcile the cohort-0 roster — every apps/*/neo-manifest.json id — with
// the PlatformRegistry. The default action registers missing lite-tier
// directory rows; materialize-accounts plans or mints the canonical unique
// AppAccount for each active row; materialize-abstract-accounts creates the
// default shared UnifiedSmartWallet identity without deploying a per-app
// contract (design doc docs/platform-contract-library-v2.md).
//
// Per appId: test-invoke getApp(appId) and skip when already registered
// (idempotent); otherwise top up the signer's prepaid (appId, signer) GAS
// credit by ONLY the deficit toward the 1 GAS lite fee (GAS transfer with
// memo "<appId>:credit") and call registerApp for custom ids or
// registerAppByPlatform for the reserved miniapp-* namespace — lite tier:
// no engine, no descriptor, no AppAccount mint.
//
// Safety:
//   - Dry-run is the DEFAULT: PLATFORM_REGISTRY_DEPLOY_DRY_RUN unset means
//     dry. Set it explicitly to 0/false AND CONFIRM_PLATFORM_REGISTRY_DEPLOY=
//     I_UNDERSTAND_THIS_WRITES_CHAIN for chain writes.
//   - Network magic is asserted before any write (testnet 894710606 /
//     mainnet 860833102).
//   - Pre-flight: every roster id is validated against the on-chain charset
//     [a-z0-9-_.]{1,64} before anything is simulated or sent; invalid ids
//     are reported and excluded (they would FAULT the registration call
//     on-chain).
//   - Per-app failures are recorded and never abort the run; the JSON report
//     is rewritten after every batch so an interrupted run keeps the txids
//     confirmed so far. The run aborts early only after 5 CONSECUTIVE app
//     failures (the signature of a systemic RPC/balance problem).
//   - A full 77-app registration write run sends up to ~154 confirmed transactions
//     (credit top-up where needed + registration each) — plan for the better part of an
//     hour on testnet.
//   - A full account-materialization write run sends one confirmed
//     ContractManagement.Deploy-backed mintAccount transaction per missing
//     account. Review the dry-run system-fee total and predicted hashes first.
//   - A shared-AA write run additionally requires a fresh successful
//     docs/reports/shared-aa-upgrade-preflight-latest.json and the complete
//     shared-aa-account-roster-preflight-latest.json; missing or stale gates
//     fail closed before the first transaction.
//
// Key environment:
//
//	PLATFORM_REGISTRY_COHORT_ACTION        register (default) | materialize-abstract-accounts | materialize-accounts
//	PLATFORM_REGISTRY_DEPLOY_DRY_RUN       default dry when unset
//	CONFIRM_PLATFORM_REGISTRY_DEPLOY       I_UNDERSTAND_THIS_WRITES_CHAIN
//	PLATFORM_REGISTRY_DEPLOY_NETWORK       testnet (default) | mainnet
//	NEO_TESTNET_WIF / FLAGSHIP_TESTNET_WIF signer WIF (mainnet: NEO_MAINNET_WIF / FLAGSHIP_MAINNET_WIF)
//	PLATFORM_REGISTRY_DRY_RUN_SIGNER       public signer address/hash for dry-run simulation when no WIF is configured
//	NEO_TESTNET_RPC_URL / NEO_RPC_URL      RPC endpoint (default https://testnet1.neo.coz.io:443)
//	PLATFORM_REGISTRY_TESTNET_HASH         registry hash override (mainnet: PLATFORM_REGISTRY_MAINNET_HASH,
//	                                       generic: PLATFORM_REGISTRY_HASH); otherwise resolved from the
//	                                       newest deploy/config/platform-registry-<network>-*.json report
//	ROSTER_FILE                            roster override: one appId per line, '#' comment lines allowed
//	                                       (default: scan apps/*/neo-manifest.json for the "id" field)
//	ONLY_APPS                              csv allowlist — only these roster ids are processed
//	SKIP_APPS                              csv denylist — these roster ids are skipped
//	PLATFORM_REGISTRY_REGISTER_BATCH_SIZE  apps per progress/report-flush batch (default 10)
//	PLATFORM_REGISTRY_MIN_GAS              signer GAS floor override (default: computed plan estimate)
//	PLATFORM_REGISTRY_REGISTER_REPORT_PATH report output override
//	                                       (default deploy/config/cohort0-registration-<network>-<date>.json)
//	PLATFORM_REGISTRY_MATERIALIZE_REPORT_PATH account-materialization report override
//	                                       (default deploy/config/cohort0-account-materialization-<network>-<date>.json)
//	PLATFORM_REGISTRY_ABSTRACT_ACCOUNT_REPORT_PATH shared-AA materialization report override
//	                                       (default deploy/config/cohort0-abstract-account-materialization-<network>-<date>.json)
//	PLATFORM_REGISTRY_SHARED_AA_PREFLIGHT_PATH upgrade preflight override for shared-AA writes
//	                                       (default docs/reports/shared-aa-upgrade-preflight-latest.json)
//	PLATFORM_REGISTRY_SHARED_AA_ROSTER_PREFLIGHT_PATH roster preflight override for shared-AA writes
//	                                       (default docs/reports/shared-aa-account-roster-preflight-latest.json)
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
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
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	rrConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	rrTestnetMagic  = uint32(894710606)
	rrMainnetMagic  = uint32(860833102)

	rrDefaultTestnetRPC = "https://testnet1.neo.coz.io:443"
	rrDefaultMainnetRPC = "https://mainnet2.neo.coz.io:443"

	rrGasHashLE = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	rrNeoHashLE = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"

	// Registry constants mirrored from contracts/platform/PlatformRegistry:
	// FEE_LITE_REGISTRATION (PlatformRegistry.cs) and the appId charset +
	// length bound (ValidateAppIdFormat, PlatformRegistry.Directory.cs).
	rrLiteRegistrationFee = int64(100_000_000) // 1 GAS in fractions
	rrMaxAppIDLength      = 64
	rrPlatformAppIDPrefix = "miniapp-"

	rrAppsManifestGlob          = "apps/*/neo-manifest.json"
	rrDefaultBatchSize          = 10
	rrMaxConsecutiveFailures    = 5
	rrPerTxFeeEstimateFractions = int64(30_000_000) // 0.3 GAS budget estimate per confirmed tx
	rrGasFractionsPerGas        = float64(100_000_000)
	rrTestnetFaucetInstruction  = "fund it from the Neo N3 testnet faucet (https://neowish.ngd.network/) or transfer GAS from another testnet account"
)

type rrReport struct {
	Action               string            `json:"action"`
	Status               string            `json:"status,omitempty"`
	Error                string            `json:"error,omitempty"`
	Network              string            `json:"network"`
	RPCURL               string            `json:"rpc_url"`
	NetworkMagic         uint32            `json:"network_magic"`
	Signer               string            `json:"signer"`
	SignerHash           string            `json:"signer_hash"`
	SignerInput          string            `json:"signer_input"`
	DryRun               bool              `json:"dry_run"`
	ChainWritesPerformed bool              `json:"chain_writes_performed"`
	PlatformRegistry     string            `json:"platform_registry"`
	AbstractAccountCore  string            `json:"abstract_account_core,omitempty"`
	RosterSource         string            `json:"roster_source"`
	Filters              map[string]string `json:"filters,omitempty"`
	Summary              rrSummary         `json:"summary"`
	Apps                 []rrAppRecord     `json:"apps"`
	Transactions         []rrTxRecord      `json:"transactions"`
	Balances             map[string]string `json:"balances"`
	NextSteps            []string          `json:"next_steps"`
	GeneratedAtUTC       string            `json:"generated_at_utc"`
}

type rrSummary struct {
	RosterTotal            int    `json:"roster_total"`
	DuplicatesDropped      int    `json:"duplicates_dropped,omitempty"`
	Filtered               int    `json:"filtered_out"`
	Invalid                int    `json:"invalid"`
	AlreadyRegistered      int    `json:"already_registered"`
	NewlyRegistered        int    `json:"newly_registered"`
	Planned                int    `json:"planned_registrations"`
	Failed                 int    `json:"failed"`
	Pending                int    `json:"pending"`
	DirectoryRowsConfirmed int    `json:"directory_rows_confirmed"`
	DirectoryRowsAfterRun  int    `json:"directory_rows_after_run"`
	ActiveRows             int    `json:"active_rows"`
	EngineAttachedRows     int    `json:"engine_attached_rows"`
	MaterializedAccounts   int    `json:"materialized_accounts"`
	AccountsAlreadyMinted  int    `json:"accounts_already_materialized"`
	AccountsPlanned        int    `json:"accounts_planned"`
	AccountsNewlyMinted    int    `json:"accounts_newly_materialized"`
	AccountRoundTrips      int    `json:"account_round_trips_verified"`
	UniqueAccountHashes    int    `json:"unique_account_hashes"`
	DuplicateAccountHashes int    `json:"duplicate_account_hashes"`
	TotalTopUpGas          string `json:"total_credit_top_up_gas"`
	EstimatedTxFeesGas     string `json:"estimated_tx_fees_gas"`
	EstimatedMintSystemGas string `json:"estimated_mint_system_fee_gas"`
}

type rrAppRecord struct {
	AppID                      string        `json:"app_id"`
	Status                     string        `json:"status"` // pending|planned|registered|skipped|failed|invalid|filtered
	Reason                     string        `json:"reason,omitempty"`
	Source                     string        `json:"source,omitempty"`
	CreditBefore               string        `json:"credit_before,omitempty"`
	TopUpFractions             int64         `json:"-"`
	TopUpGas                   string        `json:"credit_top_up_gas,omitempty"`
	CreditAfter                string        `json:"credit_after,omitempty"`
	CreditTxID                 string        `json:"credit_txid,omitempty"`
	RegisterTxID               string        `json:"register_txid,omitempty"`
	AccountHash                string        `json:"account_hash,omitempty"`
	PredictedHash              string        `json:"predicted_account_hash,omitempty"`
	MintTxID                   string        `json:"mint_txid,omitempty"`
	MintSystemGas              string        `json:"mint_system_fee_gas,omitempty"`
	MintSystemFee              int64         `json:"-"`
	AbstractAccountCore        string        `json:"abstract_account_core,omitempty"`
	AbstractAccountID          string        `json:"abstract_account_id,omitempty"`
	PredictedAbstractAccountID string        `json:"predicted_abstract_account_id,omitempty"`
	AbstractAccountTxID        string        `json:"abstract_account_txid,omitempty"`
	RoundTripOK                bool          `json:"round_trip_verified,omitempty"`
	AppRow                     []interface{} `json:"app_row,omitempty"`
	Note                       string        `json:"note,omitempty"`
}

type rrTxRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

// rrRosterEntry is one raw roster line/manifest before validation.
type rrRosterEntry struct {
	AppID     string
	Source    string
	LoadError string
}

type rrNeoManifest struct {
	ID string `json:"id"`
}

func main() {
	if err := rrRun(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func rrRun() error {
	cohortAction := strings.ToLower(rrFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_COHORT_ACTION"), "register"))
	if cohortAction != "register" && cohortAction != "materialize-accounts" && cohortAction != "materialize-abstract-accounts" {
		return fmt.Errorf("unsupported PLATFORM_REGISTRY_COHORT_ACTION=%q", cohortAction)
	}
	// Safest convention (the deploy_platform_registry.go idiom): dry-run
	// unless PLATFORM_REGISTRY_DEPLOY_DRY_RUN is explicitly set falsy.
	dryRun := true
	if raw, ok := os.LookupEnv("PLATFORM_REGISTRY_DEPLOY_DRY_RUN"); ok {
		dryRun = rrTruthy(raw)
	}
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_REGISTRY_DEPLOY") != rrConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s to write chain", rrConfirmPhrase)
	}
	if dryRun && os.Getenv("CONFIRM_PLATFORM_REGISTRY_DEPLOY") == rrConfirmPhrase {
		fmt.Println("note: confirm phrase is set but PLATFORM_REGISTRY_DEPLOY_DRY_RUN is not explicitly false; staying in dry-run")
	}

	network := strings.ToLower(rrFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_DEPLOY_NETWORK"), "testnet"))
	expectedMagic, networkID, rpcURL, wif, err := rrNetworkConfig(network)
	if err != nil {
		return err
	}
	batchSize, err := rrBatchSize()
	if err != nil {
		return err
	}

	// Roster load + pre-flight are offline: they run before any RPC I/O so a
	// bad roster fails fast and the charset sweep is reviewable in dry logs.
	entries, rosterSource, err := rrLoadRoster()
	if err != nil {
		return err
	}
	entries, duplicatesDropped := rrDedupeRoster(entries)
	apps, filters := rrClassifyRoster(entries)
	invalid := rrCountStatus(apps, "invalid")
	fmt.Printf("Pre-flight: %d roster ids from %s (%d unique", len(entries)+duplicatesDropped, rosterSource, len(entries))
	if duplicatesDropped > 0 {
		fmt.Printf(", %d duplicates dropped", duplicatesDropped)
	}
	fmt.Printf("), %d invalid (would FAULT on-chain), %d filtered, %d in scope\n",
		invalid, rrCountStatus(apps, "filtered"), rrCountStatus(apps, "pending"))
	for _, rec := range apps {
		if rec.Status == "invalid" {
			fmt.Printf("  INVALID %q (%s): %s\n", rec.AppID, rec.Source, rec.Reason)
		}
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
	} else if dryRun {
		signerHash, err = rrParseSignerIdentity(os.Getenv("PLATFORM_REGISTRY_DRY_RUN_SIGNER"))
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
	} else {
		return fmt.Errorf("%s signer WIF is not configured (set NEO_%s_WIF)", network, strings.ToUpper(network))
	}

	neoBalance, gasBalance, err := rrSignerBalances(client, signerHash)
	if err != nil {
		return fmt.Errorf("read signer balances: %w", err)
	}
	registryHash, err := rrResolveRegistryHash(client, network)
	if err != nil {
		return err
	}
	mode := "write"
	if dryRun {
		mode = "dry-run"
	}
	fmt.Printf("Signer: %s\n", signerAddress)
	fmt.Printf("Network: %s (magic %d)\n", networkID, actualMagic)
	fmt.Printf("Mode: %s\n", mode)
	fmt.Printf("Balances: %d NEO, %s GAS\n", neoBalance, rrFormatGas(gasBalance))
	fmt.Printf("PlatformRegistry: 0x%s\n\n", registryHash.StringLE())

	reportAction := "cohort0-register"
	if cohortAction == "materialize-accounts" {
		reportAction = "cohort0-materialize-accounts"
	} else if cohortAction == "materialize-abstract-accounts" {
		reportAction = "cohort0-materialize-abstract-accounts"
	}
	report := rrReport{
		Action:               reportAction,
		Network:              networkID,
		RPCURL:               rpcURL,
		NetworkMagic:         actualMagic,
		Signer:               signerAddress,
		SignerInput:          signerInput,
		SignerHash:           "0x" + signerHash.StringLE(),
		DryRun:               dryRun,
		ChainWritesPerformed: false,
		PlatformRegistry:     "0x" + registryHash.StringLE(),
		RosterSource:         rosterSource,
		Filters:              filters,
		Apps:                 apps,
		Transactions:         []rrTxRecord{},
		Balances:             map[string]string{"neo": strconv.FormatInt(neoBalance, 10), "gas": rrFormatGas(gasBalance)},
		NextSteps:            []string{},
		GeneratedAtUTC:       time.Now().UTC().Format(time.RFC3339),
	}
	report.Summary.DuplicatesDropped = duplicatesDropped
	reportPath := rrReportPath(network, cohortAction)
	if cohortAction == "materialize-accounts" {
		return rrRunMaterializeAccounts(ctx, client, act, registryHash, signerHash, signerAddress, gasBalance, dryRun, batchSize, reportPath, &report)
	}
	if cohortAction == "materialize-abstract-accounts" {
		return rrRunMaterializeAbstractAccounts(ctx, client, act, registryHash, signerHash, signerAddress, gasBalance, dryRun, batchSize, reportPath, &report)
	}

	// Plan: probe every pending appId's directory row and prepaid credit.
	gasHash, err := rrParseHash(rrGasHashLE)
	if err != nil {
		return err
	}
	var totalTopUp, txCount int64
	pending := 0
	for i := range report.Apps {
		rec := &report.Apps[i]
		if rec.Status != "pending" {
			continue
		}
		row, registered, err := rrProbeApp(act, registryHash, rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = err.Error()
			continue
		}
		if registered {
			rec.Status = "skipped"
			rec.Reason = "already registered"
			rec.AppRow = row
			if len(row) >= 6 {
				if active, ok := row[5].(bool); ok && !active {
					rec.Note = "app row exists but is paused"
				}
			}
			continue
		}
		if rrIsPlatformOwnedAppID(rec.AppID) {
			rec.Note = "platform-owned namespace: fee-exempt registerAppByPlatform"
		} else {
			credit, err := rrCallInteger(act, registryHash, "creditOf", rec.AppID, signerHash)
			if err != nil {
				rec.Status = "failed"
				rec.Reason = fmt.Sprintf("read creditOf(%s): %s", rec.AppID, err)
				continue
			}
			rec.CreditBefore = rrFormatBigGas(credit)
			if deficit := new(big.Int).Sub(big.NewInt(rrLiteRegistrationFee), credit); deficit.Sign() > 0 {
				rec.TopUpFractions = deficit.Int64()
				rec.TopUpGas = rrFormatGas(rec.TopUpFractions)
			}
			totalTopUp += rec.TopUpFractions
		}
		txCount++ // registerApp or registerAppByPlatform
		if rec.TopUpFractions > 0 {
			txCount++ // credit top-up transfer
		}
		pending++
	}
	probeFailed := rrCountStatus(report.Apps, "failed")
	fmt.Printf("Plan: %d to register (%s GAS credit top-ups over %d transactions estimated), %d already registered, %d failed probes, %d invalid, %d filtered\n\n",
		pending, rrFormatGas(totalTopUp), txCount, rrCountStatus(report.Apps, "skipped"), probeFailed, invalid, rrCountStatus(report.Apps, "filtered"))

	// Signer GAS budget: credit top-ups + a per-tx fee estimate, in the
	// sibling script's insufficient-GAS idiom (override PLATFORM_REGISTRY_MIN_GAS).
	requiredGas := rrMinGasRequired(totalTopUp, txCount)
	if requiredGas > 0 && float64(gasBalance)/rrGasFractionsPerGas < requiredGas {
		message := fmt.Sprintf("insufficient GAS: signer %s holds %s GAS, the registration plan requires at least %.8g GAS "+
			"(%s GAS credit top-ups + ~%s GAS estimated tx fees for %d transactions; tune with PLATFORM_REGISTRY_MIN_GAS). "+
			"To continue, %s.",
			signerAddress, rrFormatGas(gasBalance), requiredGas, rrFormatGas(totalTopUp),
			rrFormatGas(txCount*rrPerTxFeeEstimateFractions), txCount, rrTestnetFaucetInstruction)
		if !dryRun {
			return fmt.Errorf("%s", message)
		}
		fmt.Println("warning: " + message)
	}

	// Execute: per-tx confirmation (send + wait for HALT) like the sibling,
	// with a report flush after every batch.
	processed := 0
	consecutiveFailures := 0
	for i := range report.Apps {
		rec := &report.Apps[i]
		if rec.Status != "pending" {
			continue
		}
		processed++
		rrExecuteApp(ctx, client, act, registryHash, gasHash, signerHash, dryRun, rec, &report)
		if rec.Status == "failed" {
			consecutiveFailures++
		} else {
			consecutiveFailures = 0
		}
		fmt.Printf("[%d/%d] %s: %s\n", processed, pending, rec.AppID, rrProgressLine(rec))
		if processed%batchSize == 0 {
			rrRecomputeSummary(&report)
			if err := rrWriteReport(reportPath, report); err != nil {
				return err
			}
			fmt.Printf("... batch checkpoint: report flushed to %s\n", reportPath)
		}
		if consecutiveFailures >= rrMaxConsecutiveFailures {
			rrRecomputeSummary(&report)
			_ = rrWriteReport(reportPath, report)
			return fmt.Errorf("aborting after %d consecutive app failures (last: %s); report flushed to %s", consecutiveFailures, rec.Reason, reportPath)
		}
	}

	report.NextSteps = []string{
		"Rows are lite tier (identity + directory only): no engine, no descriptor, no AppAccount. Upgrade an app later with mintAccount(appId) (10 GAS credit, once the AppAccount artifact timelock has executed) and attach engines with attachEngine(appId, engineId).",
		"Unconsumed per-app credit dust is reclaimable by the signer with withdrawCredit(appId, amount) (witness-gated, pause-immune).",
		"Cohort 1 starts with curve-arrow: roster id miniapp-curve-arrow is a plain directory row after this run; engine binding is a separate attach step (docs/platform-contract-library-v2.md §7).",
	}
	rrRecomputeSummary(&report)
	if err := rrWriteReport(reportPath, report); err != nil {
		return err
	}
	rrPrintReconciliation(report)
	fmt.Printf("\nSaved: %s\n", reportPath)
	for _, step := range report.NextSteps {
		fmt.Println(" - " + step)
	}
	if dryRun {
		fmt.Println("\ndry-run: nothing was written. To write chain, rerun with:")
		fmt.Printf("  PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s NEO_TESTNET_WIF=<wif> \\\n", rrConfirmPhrase)
		fmt.Println("    go run -tags scripts deploy/scripts/register_apps_on_platform_registry.go")
	}
	return nil
}

func rrRunMaterializeAccounts(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, signerHash util.Uint160, signerAddress string, gasBalance int64, dryRun bool, batchSize int, reportPath string, report *rrReport) error {
	admin, err := rrCallUint160(act, registry, "admin")
	if err != nil {
		return fmt.Errorf("read registry admin: %w", err)
	}
	if admin != signerHash {
		return fmt.Errorf("account materialization requires the platform admin signer 0x%s; got 0x%s", admin.StringLE(), signerHash.StringLE())
	}
	artifactVersion, err := rrCallInteger(act, registry, "artifactVersion")
	if err != nil {
		return fmt.Errorf("read artifactVersion: %w", err)
	}
	if artifactVersion.Sign() <= 0 {
		return fmt.Errorf("AppAccount artifact is not active")
	}

	predictedOwners := map[string]string{}
	planned := 0
	for i := range report.Apps {
		rec := &report.Apps[i]
		if rec.Status != "pending" {
			continue
		}
		row, registered, err := rrProbeApp(act, registry, rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = err.Error()
			continue
		}
		if !registered {
			rec.Status = "failed"
			rec.Reason = "app is not registered"
			continue
		}
		rec.AppRow = row
		if len(row) < 6 {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("getApp returned %d fields, expected 6", len(row))
			continue
		}
		if active, ok := row[5].(bool); !ok || !active {
			rec.Status = "failed"
			rec.Reason = "app directory row is not active"
			continue
		}
		materialized, _ := row[4].(bool)
		if materialized {
			accountHash, err := rrVerifyAccountRoundTrip(act, registry, rec.AppID)
			if err != nil {
				rec.Status = "failed"
				rec.Reason = err.Error()
				continue
			}
			rec.AccountHash = "0x" + accountHash.StringLE()
			if rowHash, ok := row[3].(string); !ok || rowHash != rec.AccountHash {
				rec.Status = "failed"
				rec.Reason = fmt.Sprintf("getApp account hash %v does not match appAccountOf %s", row[3], rec.AccountHash)
				continue
			}
			rec.RoundTripOK = true
			if owner, duplicate := predictedOwners[rec.AccountHash]; duplicate {
				rec.Status = "failed"
				rec.Reason = fmt.Sprintf("account hash duplicates app %q", owner)
				continue
			}
			predictedOwners[rec.AccountHash] = rec.AppID
			rec.Status = "skipped"
			rec.Reason = "AppAccount already materialized and reverse index verified"
			continue
		}

		inv, err := act.Call(registry, "mintAccount", rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate mintAccount: %s", err)
			continue
		}
		if inv.State != "HALT" {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate mintAccount fault: %s", inv.FaultException)
			continue
		}
		predictedHash, err := rrInvokeUint160(inv)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("decode predicted AppAccount: %s", err)
			continue
		}
		rec.PredictedHash = "0x" + predictedHash.StringLE()
		if owner, duplicate := predictedOwners[rec.PredictedHash]; duplicate {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("predicted account hash duplicates app %q", owner)
			continue
		}
		predictedOwners[rec.PredictedHash] = rec.AppID
		rec.MintSystemFee = inv.GasConsumed
		rec.MintSystemGas = rrFormatGas(inv.GasConsumed)
		planned++
	}

	rrRecomputeMaterializeSummary(report)
	failures := report.Summary.Failed
	fmt.Printf("Materialization plan: %d to mint, %d already materialized, %d failed probes; %d unique existing/predicted account hashes\n",
		planned, report.Summary.AccountsAlreadyMinted, failures, report.Summary.UniqueAccountHashes)
	fmt.Printf("Estimated mint system fee: %s GAS plus approximately %s GAS transaction fees\n\n",
		report.Summary.EstimatedMintSystemGas, report.Summary.EstimatedTxFeesGas)

	requiredGas := rrMaterializeRequiredGas(report)
	if gasBalance < requiredGas {
		message := fmt.Sprintf("insufficient GAS: signer %s holds %s GAS, account materialization estimates %s GAS total system/network fees; %s",
			signerAddress, rrFormatGas(gasBalance), rrFormatGas(requiredGas), rrTestnetFaucetInstruction)
		if !dryRun {
			return fmt.Errorf("%s", message)
		}
		fmt.Println("warning: " + message)
	}

	processed := 0
	consecutiveFailures := 0
	for i := range report.Apps {
		rec := &report.Apps[i]
		if rec.Status != "pending" {
			continue
		}
		processed++
		if dryRun {
			rec.Status = "planned"
			rec.Reason = "mintAccount simulation HALT; platform-admin fee exemption applies"
		} else {
			txid, _, err := rrSendAndWait(ctx, client, act, registry, "mintAccount", report, "Mint AppAccount "+rec.AppID, rec.AppID)
			if err != nil {
				rec.Status = "failed"
				rec.Reason = err.Error()
			} else {
				rec.MintTxID = "0x" + txid.StringLE()
				accountHash, verifyErr := rrVerifyAccountRoundTrip(act, registry, rec.AppID)
				if verifyErr != nil {
					rec.Status = "failed"
					rec.Reason = verifyErr.Error()
				} else if actual := "0x" + accountHash.StringLE(); actual != rec.PredictedHash {
					rec.Status = "failed"
					rec.Reason = fmt.Sprintf("materialized account %s does not match dry-run prediction %s", actual, rec.PredictedHash)
				} else {
					rec.AccountHash = "0x" + accountHash.StringLE()
					rec.RoundTripOK = true
					rec.Status = "materialized"
					rec.Reason = "AppAccount materialized and bidirectional index verified"
				}
			}
		}
		if rec.Status == "failed" {
			consecutiveFailures++
		} else {
			consecutiveFailures = 0
		}
		fmt.Printf("[%d/%d] %s: %s\n", processed, planned, rec.AppID, rrProgressLine(rec))
		if processed%batchSize == 0 {
			rrRecomputeMaterializeSummary(report)
			if err := rrWriteReport(reportPath, *report); err != nil {
				return err
			}
			fmt.Printf("... batch checkpoint: report flushed to %s\n", reportPath)
		}
		if consecutiveFailures >= rrMaxConsecutiveFailures {
			rrRecomputeMaterializeSummary(report)
			_ = rrWriteReport(reportPath, *report)
			return fmt.Errorf("aborting after %d consecutive account materialization failures; report flushed to %s", consecutiveFailures, reportPath)
		}
	}

	report.NextSteps = []string{
		"Review the per-app predicted hashes and aggregate system-fee estimate before authorizing any write run.",
		"A write run sends one ContractManagement.Deploy-backed mintAccount transaction per planned app and verifies appAccountOf/appIdOfAccount after confirmation.",
		"Materializing AppAccounts creates app-owned treasury addresses; user-owned refundable balances must remain in engine ledgers under the two-ledger doctrine.",
	}
	rrRecomputeMaterializeSummary(report)
	if err := rrWriteReport(reportPath, *report); err != nil {
		return err
	}
	rrPrintMaterializeReconciliation(*report)
	fmt.Printf("\nSaved: %s\n", reportPath)
	for _, step := range report.NextSteps {
		fmt.Println(" - " + step)
	}
	if dryRun {
		fmt.Println("\ndry-run: nothing was written. After reviewing this exact report, a separately approved write run would use:")
		fmt.Printf("  PLATFORM_REGISTRY_COHORT_ACTION=materialize-accounts PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s NEO_TESTNET_WIF=<wif> \\\n", rrConfirmPhrase)
		fmt.Println("    go run -tags scripts deploy/scripts/register_apps_on_platform_registry.go")
	}
	return nil
}

func rrRunMaterializeAbstractAccounts(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, signerHash util.Uint160, signerAddress string, gasBalance int64, dryRun bool, batchSize int, reportPath string, report *rrReport) error {
	core, err := rrCallUint160(act, registry, "abstractAccountCore")
	if err != nil {
		return rrBlockMaterializationReport(
			reportPath,
			report,
			fmt.Sprintf("PlatformRegistry upgrade required before shared abstract-account materialization: %s", err),
		)
	}
	if core == (util.Uint160{}) {
		return rrBlockMaterializationReport(
			reportPath,
			report,
			"shared abstract-account core is not configured; proposeAbstractAccountCore and execute the timelock before materialization",
		)
	}
	if !dryRun {
		if err := rrRequireSharedAaMaterializationPreflight(registry, core); err != nil {
			return rrBlockMaterializationReport(reportPath, report, err.Error())
		}
	}
	report.AbstractAccountCore = "0x" + core.StringLE()

	admin, err := rrCallUint160(act, registry, "admin")
	if err != nil {
		return rrBlockMaterializationReport(reportPath, report, fmt.Sprintf("read registry admin: %s", err))
	}
	if admin != signerHash {
		return rrBlockMaterializationReport(
			reportPath,
			report,
			fmt.Sprintf("cohort shared-account materialization requires the platform admin signer 0x%s; got 0x%s", admin.StringLE(), signerHash.StringLE()),
		)
	}

	accountOwners := map[string]string{}
	planned := 0
	for i := range report.Apps {
		rec := &report.Apps[i]
		if rec.Status != "pending" {
			continue
		}
		row, registered, err := rrProbeApp(act, registry, rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = err.Error()
			continue
		}
		if !registered {
			rec.Status = "failed"
			rec.Reason = "app is not registered"
			continue
		}
		rec.AppRow = row
		if len(row) < 6 {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("getApp returned %d fields, expected 6", len(row))
			continue
		}
		if active, ok := row[5].(bool); !ok || !active {
			rec.Status = "failed"
			rec.Reason = "app directory row is not active"
			continue
		}

		storedCore, accountID, materialized, err := rrReadAbstractAccountState(act, registry, rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = err.Error()
			continue
		}
		if materialized {
			if storedCore == (util.Uint160{}) || accountID == (util.Uint160{}) {
				rec.Status = "failed"
				rec.Reason = "materialized shared account returned a zero core or account id"
				continue
			}
			if err := rrVerifyAbstractAccountRoundTrip(act, registry, rec.AppID, storedCore, accountID); err != nil {
				rec.Status = "failed"
				rec.Reason = err.Error()
				continue
			}
			key := "0x" + storedCore.StringLE() + ":0x" + accountID.StringLE()
			if owner, duplicate := accountOwners[key]; duplicate {
				rec.Status = "failed"
				rec.Reason = fmt.Sprintf("shared account duplicates app %q", owner)
				continue
			}
			accountOwners[key] = rec.AppID
			rec.AbstractAccountCore = "0x" + storedCore.StringLE()
			rec.AbstractAccountID = "0x" + accountID.StringLE()
			rec.RoundTripOK = true
			rec.Status = "skipped"
			rec.Reason = "shared abstract account already materialized and reverse index verified"
			continue
		}

		inv, err := act.Call(registry, "materializeAbstractAccount", rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate materializeAbstractAccount: %s", err)
			continue
		}
		if inv.State != "HALT" {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate materializeAbstractAccount fault: %s", inv.FaultException)
			continue
		}
		predictedID, err := rrInvokeUint160(inv)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("decode predicted abstract account id: %s", err)
			continue
		}
		if predictedID == (util.Uint160{}) {
			rec.Status = "failed"
			rec.Reason = "materializeAbstractAccount predicted a zero account id"
			continue
		}
		key := "0x" + core.StringLE() + ":0x" + predictedID.StringLE()
		if owner, duplicate := accountOwners[key]; duplicate {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("predicted shared account duplicates app %q", owner)
			continue
		}
		accountOwners[key] = rec.AppID
		rec.AbstractAccountCore = "0x" + core.StringLE()
		rec.PredictedAbstractAccountID = "0x" + predictedID.StringLE()
		rec.MintSystemFee = inv.GasConsumed
		rec.MintSystemGas = rrFormatGas(inv.GasConsumed)
		planned++
	}

	rrRecomputeMaterializeSummary(report)
	fmt.Printf("Shared-AA plan: %d to materialize, %d already materialized, %d failed probes; %d unique core/account-id pairs\n",
		planned, report.Summary.AccountsAlreadyMinted, report.Summary.Failed, report.Summary.UniqueAccountHashes)
	fmt.Printf("Estimated system fee: %s GAS plus approximately %s GAS transaction fees\n\n",
		report.Summary.EstimatedMintSystemGas, report.Summary.EstimatedTxFeesGas)

	requiredGas := rrMaterializeRequiredGas(report)
	if gasBalance < requiredGas {
		message := fmt.Sprintf("insufficient GAS: signer %s holds %s GAS, shared-account materialization estimates %s GAS total system/network fees; %s",
			signerAddress, rrFormatGas(gasBalance), rrFormatGas(requiredGas), rrTestnetFaucetInstruction)
		if !dryRun {
			return fmt.Errorf("%s", message)
		}
		fmt.Println("warning: " + message)
	}

	processed := 0
	consecutiveFailures := 0
	for i := range report.Apps {
		rec := &report.Apps[i]
		if rec.Status != "pending" {
			continue
		}
		processed++
		if dryRun {
			rec.Status = "planned"
			rec.Reason = "materializeAbstractAccount simulation HALT; no per-app contract deployment"
		} else {
			txid, _, err := rrSendAndWait(ctx, client, act, registry, "materializeAbstractAccount", report, "Materialize shared AA "+rec.AppID, rec.AppID)
			if err != nil {
				rec.Status = "failed"
				rec.Reason = err.Error()
			} else {
				rec.AbstractAccountTxID = "0x" + txid.StringLE()
				storedCore, accountID, materialized, verifyErr := rrReadAbstractAccountState(act, registry, rec.AppID)
				if verifyErr != nil {
					rec.Status = "failed"
					rec.Reason = verifyErr.Error()
				} else if !materialized {
					rec.Status = "failed"
					rec.Reason = "shared abstract account remained unmaterialized after confirmation"
				} else if actual := "0x" + accountID.StringLE(); actual != rec.PredictedAbstractAccountID {
					rec.Status = "failed"
					rec.Reason = fmt.Sprintf("materialized account id %s does not match dry-run prediction %s", actual, rec.PredictedAbstractAccountID)
				} else if verifyErr := rrVerifyAbstractAccountRoundTrip(act, registry, rec.AppID, storedCore, accountID); verifyErr != nil {
					rec.Status = "failed"
					rec.Reason = verifyErr.Error()
				} else {
					rec.AbstractAccountCore = "0x" + storedCore.StringLE()
					rec.AbstractAccountID = "0x" + accountID.StringLE()
					rec.RoundTripOK = true
					rec.Status = "materialized"
					rec.Reason = "shared abstract account materialized and reverse index verified"
				}
			}
		}
		if rec.Status == "failed" {
			consecutiveFailures++
		} else {
			consecutiveFailures = 0
		}
		fmt.Printf("[%d/%d] %s: %s\n", processed, planned, rec.AppID, rrProgressLine(rec))
		if processed%batchSize == 0 {
			rrRecomputeMaterializeSummary(report)
			if err := rrWriteReport(reportPath, *report); err != nil {
				return err
			}
			fmt.Printf("... batch checkpoint: report flushed to %s\n", reportPath)
		}
		if consecutiveFailures >= rrMaxConsecutiveFailures {
			rrRecomputeMaterializeSummary(report)
			_ = rrWriteReport(reportPath, *report)
			return fmt.Errorf("aborting after %d consecutive shared-account materialization failures; report flushed to %s", consecutiveFailures, reportPath)
		}
	}

	report.NextSteps = []string{
		"Review every predicted (core, accountId) pair before authorizing a write run; the virtual Neo address is derived deterministically by framework/utils/aa-account.ts.",
		"A write run stores the registry mapping and registers state in the single shared UnifiedSmartWallet core; it does not deploy 77 per-app contracts.",
		"Keep materialize-accounts only for apps that explicitly need an isolated deployed treasury shim.",
	}
	rrRecomputeMaterializeSummary(report)
	if err := rrWriteReport(reportPath, *report); err != nil {
		return err
	}
	rrPrintAbstractAccountReconciliation(*report)
	fmt.Printf("\nSaved: %s\n", reportPath)
	for _, step := range report.NextSteps {
		fmt.Println(" - " + step)
	}
	if dryRun {
		fmt.Println("\ndry-run: nothing was written. After reviewing this exact report, a separately approved write run would use:")
		fmt.Printf("  PLATFORM_REGISTRY_COHORT_ACTION=materialize-abstract-accounts PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s NEO_TESTNET_WIF=<wif> \\\n", rrConfirmPhrase)
		fmt.Println("    go run -tags scripts deploy/scripts/register_apps_on_platform_registry.go")
	}
	return nil
}

func rrBlockMaterializationReport(reportPath string, report *rrReport, reason string) error {
	report.Status = "blocked"
	report.Error = reason
	report.NextSteps = []string{
		"Upgrade and verify PlatformRegistry and UnifiedSmartWalletV3 before retrying shared-account materialization.",
		"Re-run this dry-run and review the persisted roster, predictions, and reverse-index gates before any write authorization.",
	}
	rrRecomputeMaterializeSummary(report)
	if err := rrWriteReport(reportPath, *report); err != nil {
		return fmt.Errorf("%s; failed to persist blocked report: %w", reason, err)
	}
	return fmt.Errorf("%s; blocked report flushed to %s", reason, reportPath)
}

type rrSharedAaUpgradePreflight struct {
	Evaluation struct {
		Phase             string `json:"phase"`
		SafeToMaterialize bool   `json:"safe_to_materialize"`
	} `json:"evaluation"`
	Contracts struct {
		Registry struct {
			Hash string `json:"hash"`
		} `json:"registry"`
		AbstractAccount struct {
			Hash string `json:"hash"`
		} `json:"abstract_account"`
	} `json:"contracts"`
	ChainWritesPerformed bool `json:"chain_writes_performed"`
}

type rrSharedAaRosterPreflight struct {
	Source struct {
		RegistryHash string `json:"registry_hash"`
	} `json:"source"`
	Summary struct {
		RosterTotal               int  `json:"roster_total"`
		DerivedAccountIDs         int  `json:"derived_account_ids"`
		UniquePredictedAccountIDs int  `json:"unique_predicted_account_ids"`
		Complete                  bool `json:"complete"`
	} `json:"summary"`
}

func rrNormalizeHashText(raw string) string {
	return strings.ToLower(strings.TrimPrefix(strings.TrimSpace(raw), "0x"))
}

func rrReadJSONFile(path string, target interface{}) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("parse %s: %w", path, err)
	}
	return nil
}

func rrRequireSharedAaMaterializationPreflight(registry, core util.Uint160) error {
	upgradePath := rrFirstNonEmpty(
		os.Getenv("PLATFORM_REGISTRY_SHARED_AA_PREFLIGHT_PATH"),
		filepath.Join("docs", "reports", "shared-aa-upgrade-preflight-latest.json"),
	)
	var upgrade rrSharedAaUpgradePreflight
	if err := rrReadJSONFile(upgradePath, &upgrade); err != nil {
		return fmt.Errorf("shared-AA write gate: %w", err)
	}
	if upgrade.ChainWritesPerformed {
		return fmt.Errorf("shared-AA write gate: upgrade preflight is marked as having performed chain writes")
	}
	if upgrade.Evaluation.Phase != "ready_to_materialize_dry_run" || !upgrade.Evaluation.SafeToMaterialize {
		return fmt.Errorf(
			"shared-AA write gate: upgrade preflight is not ready (phase=%s safe_to_materialize=%t)",
			upgrade.Evaluation.Phase,
			upgrade.Evaluation.SafeToMaterialize,
		)
	}
	if rrNormalizeHashText(upgrade.Contracts.Registry.Hash) != rrNormalizeHashText("0x"+registry.StringLE()) {
		return fmt.Errorf("shared-AA write gate: upgrade preflight Registry hash does not match the live target")
	}
	if rrNormalizeHashText(upgrade.Contracts.AbstractAccount.Hash) != rrNormalizeHashText("0x"+core.StringLE()) {
		return fmt.Errorf("shared-AA write gate: upgrade preflight AA core hash does not match the active Registry core")
	}

	rosterPath := rrFirstNonEmpty(
		os.Getenv("PLATFORM_REGISTRY_SHARED_AA_ROSTER_PREFLIGHT_PATH"),
		filepath.Join("docs", "reports", "shared-aa-account-roster-preflight-latest.json"),
	)
	var roster rrSharedAaRosterPreflight
	if err := rrReadJSONFile(rosterPath, &roster); err != nil {
		return fmt.Errorf("shared-AA write gate: %w", err)
	}
	if !roster.Summary.Complete || roster.Summary.RosterTotal == 0 ||
		roster.Summary.DerivedAccountIDs != roster.Summary.RosterTotal ||
		roster.Summary.UniquePredictedAccountIDs != roster.Summary.RosterTotal {
		return fmt.Errorf("shared-AA write gate: roster preflight is incomplete or non-unique")
	}
	if rrNormalizeHashText(roster.Source.RegistryHash) != rrNormalizeHashText("0x"+registry.StringLE()) {
		return fmt.Errorf("shared-AA write gate: roster preflight Registry hash does not match the live target")
	}
	return nil
}

func rrCountStatus(apps []rrAppRecord, status string) int {
	count := 0
	for _, rec := range apps {
		if rec.Status == status {
			count++
		}
	}
	return count
}

func rrNetworkConfig(network string) (uint32, string, string, string, error) {
	switch network {
	case "mainnet":
		return rrMainnetMagic,
			"neo-n3-mainnet",
			rrFirstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), rrDefaultMainnetRPC),
			rrFirstNonEmpty(os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF")),
			nil
	case "testnet":
		return rrTestnetMagic,
			"neo-n3-testnet",
			rrFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), rrDefaultTestnetRPC),
			rrFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF")),
			nil
	default:
		return 0, "", "", "", fmt.Errorf("unsupported PLATFORM_REGISTRY_DEPLOY_NETWORK=%q", network)
	}
}

// ---------------------------------------------------------------------
// Roster load + pre-flight
// ---------------------------------------------------------------------

func rrLoadRoster() ([]rrRosterEntry, string, error) {
	if path := strings.TrimSpace(os.Getenv("ROSTER_FILE")); path != "" {
		return rrLoadRosterFile(path)
	}
	matches, err := filepath.Glob(rrAppsManifestGlob)
	if err != nil {
		return nil, "", fmt.Errorf("scan %s: %w", rrAppsManifestGlob, err)
	}
	if len(matches) == 0 {
		return nil, "", fmt.Errorf("no manifests matched %s (run from the repo root or set ROSTER_FILE)", rrAppsManifestGlob)
	}
	sort.Strings(matches)
	entries := []rrRosterEntry{}
	for _, path := range matches {
		data, err := os.ReadFile(path)
		if err != nil {
			entries = append(entries, rrRosterEntry{Source: path, LoadError: fmt.Sprintf("read manifest: %s", err)})
			continue
		}
		var manifest rrNeoManifest
		if err := json.Unmarshal(data, &manifest); err != nil {
			entries = append(entries, rrRosterEntry{Source: path, LoadError: fmt.Sprintf("parse manifest: %s", err)})
			continue
		}
		entries = append(entries, rrRosterEntry{AppID: strings.TrimSpace(manifest.ID), Source: path})
	}
	return entries, rrAppsManifestGlob, nil
}

func rrLoadRosterFile(path string) ([]rrRosterEntry, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", fmt.Errorf("read ROSTER_FILE %s: %w", path, err)
	}
	entries := []rrRosterEntry{}
	for lineno, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		entries = append(entries, rrRosterEntry{AppID: line, Source: fmt.Sprintf("%s:%d", path, lineno+1)})
	}
	if len(entries) == 0 {
		return nil, "", fmt.Errorf("ROSTER_FILE %s has no app ids", path)
	}
	return entries, path, nil
}

func rrDedupeRoster(entries []rrRosterEntry) ([]rrRosterEntry, int) {
	seen := map[string]bool{}
	out := []rrRosterEntry{}
	dropped := 0
	for _, entry := range entries {
		if entry.LoadError == "" {
			if seen[entry.AppID] {
				dropped++
				continue
			}
			seen[entry.AppID] = true
		}
		out = append(out, entry)
	}
	return out, dropped
}

// rrClassifyRoster turns raw roster entries into report records: load
// failures and charset violations are "invalid" (excluded — they would
// FAULT on-chain), ONLY_APPS/SKIP_APPS narrow the rest to "pending".
func rrClassifyRoster(entries []rrRosterEntry) ([]rrAppRecord, map[string]string) {
	only := rrCSVEnv("ONLY_APPS")
	skip := rrCSVEnv("SKIP_APPS")
	filters := map[string]string{}
	if len(only) > 0 {
		filters["only_apps"] = strings.Join(only, ",")
	}
	if len(skip) > 0 {
		filters["skip_apps"] = strings.Join(skip, ",")
	}
	rosterIDs := map[string]bool{}
	for _, entry := range entries {
		rosterIDs[entry.AppID] = true
	}
	for _, id := range only {
		if !rosterIDs[id] {
			fmt.Printf("warning: ONLY_APPS entry %q not in roster (ignored)\n", id)
		}
	}
	onlySet := map[string]bool{}
	for _, id := range only {
		onlySet[id] = true
	}
	skipSet := map[string]bool{}
	for _, id := range skip {
		skipSet[id] = true
	}
	apps := []rrAppRecord{}
	for _, entry := range entries {
		rec := rrAppRecord{AppID: entry.AppID, Source: entry.Source}
		switch {
		case entry.LoadError != "":
			rec.Status = "invalid"
			rec.Reason = entry.LoadError
		case rrInvalidAppIDReason(entry.AppID) != "":
			rec.Status = "invalid"
			rec.Reason = rrInvalidAppIDReason(entry.AppID) + " (on-chain charset [a-z0-9-_.], 1-64 chars)"
		case len(onlySet) > 0 && !onlySet[entry.AppID]:
			rec.Status = "filtered"
			rec.Reason = "not in ONLY_APPS"
		case skipSet[entry.AppID]:
			rec.Status = "filtered"
			rec.Reason = "in SKIP_APPS"
		default:
			rec.Status = "pending"
		}
		apps = append(apps, rec)
	}
	return apps, filters
}

// rrInvalidAppIDReason is a byte-exact mirror of ValidateAppIdFormat
// (PlatformRegistry.Directory.cs): 1-64 chars of [a-z0-9-_.]. It returns ""
// for valid ids, otherwise the reason the on-chain call would FAULT.
func rrInvalidAppIDReason(appID string) string {
	if appID == "" {
		return "empty appId"
	}
	if len(appID) > rrMaxAppIDLength {
		return fmt.Sprintf("longer than %d chars", rrMaxAppIDLength)
	}
	for _, c := range appID {
		ok := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.'
		if !ok {
			return fmt.Sprintf("character %q outside [a-z0-9-_.]", c)
		}
	}
	return ""
}

func rrCSVEnv(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	out := []string{}
	for _, part := range strings.Split(raw, ",") {
		if value := strings.TrimSpace(part); value != "" {
			out = append(out, value)
		}
	}
	return out
}

func rrBatchSize() (int, error) {
	raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_REGISTER_BATCH_SIZE"))
	if raw == "" {
		return rrDefaultBatchSize, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid PLATFORM_REGISTRY_REGISTER_BATCH_SIZE (must be a positive integer)")
	}
	return value, nil
}

func rrMinGasRequired(totalTopUpFractions, txCount int64) float64 {
	if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_MIN_GAS")); raw != "" {
		if value, err := strconv.ParseFloat(raw, 64); err == nil && value >= 0 {
			return value
		}
	}
	return float64(totalTopUpFractions+txCount*rrPerTxFeeEstimateFractions) / rrGasFractionsPerGas
}

// ---------------------------------------------------------------------
// Plan execution
// ---------------------------------------------------------------------

// rrProbeApp test-invokes getApp: registered only when the call HALTs,
// unregistered only on the contract's own "appId not registered" fault —
// transport errors and unexpected faults are errors, never "unregistered".
func rrProbeApp(act *actor.Actor, registry util.Uint160, appID string) ([]interface{}, bool, error) {
	inv, err := act.Call(registry, "getApp", appID)
	if err != nil {
		return nil, false, fmt.Errorf("getApp(%s) call: %w", appID, err)
	}
	if inv.State == "HALT" {
		return rrStackValues(inv), true, nil
	}
	if strings.Contains(inv.FaultException, "appId not registered") {
		return nil, false, nil
	}
	return nil, false, fmt.Errorf("getApp(%s) fault: %s", appID, inv.FaultException)
}

func rrExecuteApp(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, gasHash util.Uint160, signerHash util.Uint160, dryRun bool, rec *rrAppRecord, report *rrReport) {
	memo := rec.AppID + ":credit"
	if rec.TopUpFractions > 0 {
		inv, err := act.Call(gasHash, "transfer", signerHash, registry, rec.TopUpFractions, memo)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate credit transfer: %s", err)
			return
		}
		if inv.State != "HALT" {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate credit transfer fault: %s", inv.FaultException)
			return
		}
		if dryRun {
			rec.Note = rrFirstNonEmpty(rec.Note, fmt.Sprintf("would transfer %s GAS with memo %q", rec.TopUpGas, memo))
		} else {
			txid, _, err := rrSendAndWait(ctx, client, act, gasHash, "transfer", report, "Credit top-up ("+memo+")", signerHash, registry, rec.TopUpFractions, memo)
			if err != nil {
				rec.Status = "failed"
				rec.Reason = err.Error()
				return
			}
			rec.CreditTxID = "0x" + txid.StringLE()
		}
	}

	// Lite registration: empty engineId, null descriptor (the registry
	// asserts descriptor == null || empty when no engine is attached).
	method := rrRegistrationMethod(rec.AppID)
	inv, err := act.Call(registry, method, rec.AppID, "", signerHash, nil)
	if err != nil {
		rec.Status = "failed"
		rec.Reason = fmt.Sprintf("simulate %s: %s", method, err)
		return
	}
	if inv.State != "HALT" {
		switch {
		case dryRun && rec.TopUpFractions > 0 && strings.Contains(inv.FaultException, "insufficient credit"):
			// Expected in dry-run: the top-up above was simulated, not sent.
			rec.Status = "planned"
			rec.Reason = method + " becomes eligible after the simulated credit top-up"
		case strings.Contains(inv.FaultException, "appId already registered"):
			rec.Status = "skipped"
			rec.Reason = "already registered (registered concurrently with the run)"
		default:
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate %s fault: %s", method, inv.FaultException)
		}
		return
	}
	if dryRun {
		rec.Status = "planned"
		rec.Reason = method + " simulation HALT (eligible)"
		return
	}
	txid, _, err := rrSendAndWait(ctx, client, act, registry, method, report, method+" "+rec.AppID, rec.AppID, "", signerHash, nil)
	if err != nil {
		rec.Status = "failed"
		rec.Reason = err.Error()
		return
	}
	rec.RegisterTxID = "0x" + txid.StringLE()
	rec.Status = "registered"
	if row, registered, err := rrProbeApp(act, registry, rec.AppID); err == nil && registered {
		rec.AppRow = row
	} else if err != nil {
		rec.Note = rrFirstNonEmpty(rec.Note, "post-registration getApp read failed: "+err.Error())
	}
	if credit, err := rrCallInteger(act, registry, "creditOf", rec.AppID, signerHash); err == nil {
		rec.CreditAfter = rrFormatBigGas(credit)
	}
}

func rrIsPlatformOwnedAppID(appID string) bool {
	return strings.HasPrefix(appID, rrPlatformAppIDPrefix)
}

func rrRegistrationMethod(appID string) string {
	if rrIsPlatformOwnedAppID(appID) {
		return "registerAppByPlatform"
	}
	return "registerApp"
}

func rrProgressLine(rec *rrAppRecord) string {
	switch rec.Status {
	case "registered":
		return "registered tx " + rec.RegisterTxID
	case "materialized":
		if rec.AbstractAccountID != "" {
			return "materialized shared AA " + rec.AbstractAccountID + " tx " + rec.AbstractAccountTxID
		}
		return "materialized " + rec.AccountHash + " tx " + rec.MintTxID
	case "planned":
		return "planned — " + rec.Reason
	case "skipped":
		return "skipped — " + rec.Reason
	default:
		return "FAILED — " + rec.Reason
	}
}

// ---------------------------------------------------------------------
// Summary + reconciliation
// ---------------------------------------------------------------------

func rrRecomputeSummary(report *rrReport) {
	summary := rrSummary{
		RosterTotal:       len(report.Apps),
		DuplicatesDropped: report.Summary.DuplicatesDropped,
	}
	var totalTopUp, txCount int64
	for _, rec := range report.Apps {
		switch rec.Status {
		case "invalid":
			summary.Invalid++
		case "filtered":
			summary.Filtered++
		case "skipped":
			summary.AlreadyRegistered++
		case "registered":
			summary.NewlyRegistered++
		case "planned":
			summary.Planned++
		case "failed":
			summary.Failed++
		case "pending":
			summary.Pending++
		}
		if rec.Status == "registered" || rec.Status == "planned" || rec.Status == "pending" {
			totalTopUp += rec.TopUpFractions
			txCount++
			if rec.TopUpFractions > 0 {
				txCount++
			}
		}
		if len(rec.AppRow) >= 6 {
			if engineID, ok := rec.AppRow[0].(string); ok && engineID != "" {
				summary.EngineAttachedRows++
			}
			if materialized, ok := rec.AppRow[4].(bool); ok && materialized {
				summary.MaterializedAccounts++
			}
			if active, ok := rec.AppRow[5].(bool); ok && active {
				summary.ActiveRows++
			}
		}
	}
	summary.DirectoryRowsConfirmed = summary.AlreadyRegistered + summary.NewlyRegistered
	summary.DirectoryRowsAfterRun = summary.DirectoryRowsConfirmed + summary.Planned + summary.Pending
	summary.TotalTopUpGas = rrFormatGas(totalTopUp)
	summary.EstimatedTxFeesGas = rrFormatGas(txCount * rrPerTxFeeEstimateFractions)
	report.Summary = summary
}

func rrRecomputeMaterializeSummary(report *rrReport) {
	summary := rrSummary{
		RosterTotal:       len(report.Apps),
		DuplicatesDropped: report.Summary.DuplicatesDropped,
		TotalTopUpGas:     rrFormatGas(0),
	}
	accountOwners := map[string]string{}
	var systemFee, txCount int64
	for _, rec := range report.Apps {
		switch rec.Status {
		case "invalid":
			summary.Invalid++
		case "filtered":
			summary.Filtered++
		case "failed":
			summary.Failed++
		case "pending":
			summary.Pending++
		case "planned":
			summary.AccountsPlanned++
		case "materialized":
			summary.AccountsNewlyMinted++
		case "skipped":
			summary.AccountsAlreadyMinted++
		}
		if len(rec.AppRow) >= 6 {
			summary.DirectoryRowsConfirmed++
			if engineID, ok := rec.AppRow[0].(string); ok && engineID != "" {
				summary.EngineAttachedRows++
			}
			if active, ok := rec.AppRow[5].(bool); ok && active {
				summary.ActiveRows++
			}
			if materialized, ok := rec.AppRow[4].(bool); ok && materialized {
				summary.MaterializedAccounts++
			}
		}
		if rec.Status == "materialized" {
			summary.MaterializedAccounts++
		}
		if rec.RoundTripOK {
			summary.AccountRoundTrips++
		}
		accountHash := rrFirstNonEmpty(rec.AbstractAccountID, rec.PredictedAbstractAccountID, rec.AccountHash, rec.PredictedHash)
		if rec.AbstractAccountCore != "" && accountHash != "" {
			accountHash = rec.AbstractAccountCore + ":" + accountHash
		}
		if accountHash != "" {
			if owner, ok := accountOwners[accountHash]; ok && owner != rec.AppID {
				summary.DuplicateAccountHashes++
			} else {
				accountOwners[accountHash] = rec.AppID
			}
		}
		systemFee += rec.MintSystemFee
		if rec.Status == "pending" || rec.Status == "planned" || rec.Status == "materialized" {
			txCount++
		}
	}
	summary.DirectoryRowsAfterRun = summary.DirectoryRowsConfirmed
	summary.UniqueAccountHashes = len(accountOwners)
	summary.EstimatedMintSystemGas = rrFormatGas(systemFee)
	summary.EstimatedTxFeesGas = rrFormatGas(txCount * rrPerTxFeeEstimateFractions)
	report.Summary = summary
}

func rrMaterializeRequiredGas(report *rrReport) int64 {
	var systemFee, txCount int64
	for _, rec := range report.Apps {
		if rec.Status != "pending" && rec.Status != "planned" {
			continue
		}
		systemFee += rec.MintSystemFee
		txCount++
	}
	return systemFee + txCount*rrPerTxFeeEstimateFractions
}

func rrPrintReconciliation(report rrReport) {
	s := report.Summary
	fmt.Println()
	fmt.Println("RECONCILIATION")
	fmt.Println("==============")
	fmt.Printf("Roster source:            %s\n", report.RosterSource)
	fmt.Printf("Roster apps:              %d\n", s.RosterTotal)
	if s.DuplicatesDropped > 0 {
		fmt.Printf("Duplicates dropped:       %d\n", s.DuplicatesDropped)
	}
	fmt.Printf("Filtered out:             %d\n", s.Filtered)
	fmt.Printf("Invalid appIds:           %d (excluded — would FAULT on-chain)\n", s.Invalid)
	fmt.Printf("Already registered:       %d\n", s.AlreadyRegistered)
	if report.DryRun {
		fmt.Printf("Planned registrations:    %d (dry-run — nothing written)\n", s.Planned+s.Pending)
	} else {
		fmt.Printf("Newly registered:         %d\n", s.NewlyRegistered)
	}
	fmt.Printf("Failed:                   %d\n", s.Failed)
	fmt.Printf("Active directory rows:    %d/%d\n", s.ActiveRows, s.DirectoryRowsConfirmed)
	fmt.Printf("Engine-attached rows:     %d/%d\n", s.EngineAttachedRows, s.DirectoryRowsConfirmed)
	fmt.Printf("Materialized AppAccounts: %d/%d\n", s.MaterializedAccounts, s.DirectoryRowsConfirmed)
	if report.DryRun {
		fmt.Printf("Directory rows confirmed: %d/%d on registry %s (+%d planned → %d/%d after a write run)\n",
			s.DirectoryRowsConfirmed, s.RosterTotal, report.PlatformRegistry,
			s.Planned+s.Pending, s.DirectoryRowsAfterRun, s.RosterTotal)
	} else {
		fmt.Printf("Directory rows confirmed: %d/%d on registry %s\n",
			s.DirectoryRowsConfirmed, s.RosterTotal, report.PlatformRegistry)
	}
}

func rrPrintMaterializeReconciliation(report rrReport) {
	s := report.Summary
	fmt.Println()
	fmt.Println("APPACCOUNT MATERIALIZATION RECONCILIATION")
	fmt.Println("=========================================")
	fmt.Printf("Roster source:             %s\n", report.RosterSource)
	fmt.Printf("Roster apps:               %d\n", s.RosterTotal)
	fmt.Printf("Active registered rows:    %d/%d\n", s.ActiveRows, s.RosterTotal)
	fmt.Printf("Already materialized:      %d\n", s.AccountsAlreadyMinted)
	if report.DryRun {
		fmt.Printf("Planned materializations:  %d (dry-run — nothing written)\n", s.AccountsPlanned+s.Pending)
	} else {
		fmt.Printf("Newly materialized:        %d\n", s.AccountsNewlyMinted)
	}
	fmt.Printf("Current materialized rows: %d/%d\n", s.MaterializedAccounts, s.RosterTotal)
	fmt.Printf("Verified reverse indexes:  %d\n", s.AccountRoundTrips)
	fmt.Printf("Unique account hashes:     %d (duplicates: %d)\n", s.UniqueAccountHashes, s.DuplicateAccountHashes)
	fmt.Printf("Estimated system fee:      %s GAS\n", s.EstimatedMintSystemGas)
	fmt.Printf("Estimated network fees:    %s GAS\n", s.EstimatedTxFeesGas)
	fmt.Printf("Failed:                    %d\n", s.Failed)
}

func rrPrintAbstractAccountReconciliation(report rrReport) {
	s := report.Summary
	fmt.Println()
	fmt.Println("SHARED ABSTRACT-ACCOUNT MATERIALIZATION RECONCILIATION")
	fmt.Println("===================================================")
	fmt.Printf("Roster source:             %s\n", report.RosterSource)
	fmt.Printf("Roster apps:               %d\n", s.RosterTotal)
	fmt.Printf("Shared AA core:            %s\n", report.AbstractAccountCore)
	fmt.Printf("Active registered rows:    %d/%d\n", s.ActiveRows, s.RosterTotal)
	fmt.Printf("Already materialized:      %d\n", s.AccountsAlreadyMinted)
	if report.DryRun {
		fmt.Printf("Planned materializations:  %d (dry-run — nothing written)\n", s.AccountsPlanned+s.Pending)
	} else {
		fmt.Printf("Newly materialized:        %d\n", s.AccountsNewlyMinted)
	}
	fmt.Printf("Verified reverse indexes:  %d\n", s.AccountRoundTrips)
	fmt.Printf("Unique core/account ids:   %d (duplicates: %d)\n", s.UniqueAccountHashes, s.DuplicateAccountHashes)
	fmt.Printf("Estimated system fee:      %s GAS\n", s.EstimatedMintSystemGas)
	fmt.Printf("Estimated network fees:    %s GAS\n", s.EstimatedTxFeesGas)
	fmt.Printf("Failed:                    %d\n", s.Failed)
}

// ---------------------------------------------------------------------
// Chain helpers (mirrors of the deploy_platform_registry.go idioms)
// ---------------------------------------------------------------------

func rrResolveRegistryHash(client *rpcclient.Client, network string) (util.Uint160, error) {
	networkName := strings.ToUpper(strings.ReplaceAll(network, "-", "_"))
	for _, key := range []string{"PLATFORM_REGISTRY_" + networkName + "_HASH", "PLATFORM_REGISTRY_HASH"} {
		if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
			return rrParseHash(raw)
		}
	}
	if hash, source, ok := rrRegistryHashFromReports(network); ok {
		if _, err := client.GetContractStateByHash(hash); err == nil {
			fmt.Printf("resolved PlatformRegistry 0x%s from %s\n", hash.StringLE(), source)
			return hash, nil
		} else {
			return util.Uint160{}, fmt.Errorf("PlatformRegistry 0x%s (from %s) not found on-chain: %w", hash.StringLE(), source, err)
		}
	}
	return util.Uint160{}, fmt.Errorf("PlatformRegistry hash not configured: set PLATFORM_REGISTRY_%s_HASH or deploy first (deploy_platform_registry.go records deploy/config/platform-registry-%s-*.json)", networkName, network)
}

// rrPreviousReport is the subset of the deploy script's JSON reports that
// this script consumes for registry hash resolution.
type rrPreviousReport struct {
	PlatformRegistry string `json:"platform_registry"`
}

// rrReportCandidates returns the deploy reports for a network, newest first
// (the date-stamped names sort chronologically).
func rrReportCandidates(network string) []string {
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

func rrRegistryHashFromReports(network string) (util.Uint160, string, bool) {
	for _, path := range rrReportCandidates(network) {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var previous rrPreviousReport
		if err := json.Unmarshal(data, &previous); err != nil {
			continue
		}
		if strings.TrimSpace(previous.PlatformRegistry) == "" {
			continue
		}
		hash, err := rrParseHash(previous.PlatformRegistry)
		if err != nil {
			continue
		}
		return hash, path, true
	}
	return util.Uint160{}, "", false
}

func rrSendAndWait(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contract util.Uint160, method string, report *rrReport, label string, params ...any) (util.Uint256, *result.ApplicationLog, error) {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return util.Uint256{}, nil, fmt.Errorf("%s (%s): %w", label, method, err)
	}
	report.ChainWritesPerformed = true
	report.Transactions = append(report.Transactions, rrTxRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	appLog, err := rrWaitForTx(ctx, client, txid)
	if err != nil {
		return txid, nil, err
	}
	return txid, appLog, nil
}

func rrWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) (*result.ApplicationLog, error) {
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

func rrCallHALT(act *actor.Actor, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func rrCallInteger(act *actor.Actor, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := rrCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	return inv.Stack[0].TryInteger()
}

func rrCallUint160(act *actor.Actor, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
	inv, err := rrCallHALT(act, contract, method, params...)
	if err != nil {
		return util.Uint160{}, err
	}
	return rrInvokeUint160(inv)
}

func rrInvokeUint160(inv *result.Invoke) (util.Uint160, error) {
	if len(inv.Stack) == 0 {
		return util.Uint160{}, fmt.Errorf("empty result stack")
	}
	bytes, err := inv.Stack[0].TryBytes()
	if err != nil {
		return util.Uint160{}, err
	}
	if len(bytes) != util.Uint160Size {
		return util.Uint160{}, fmt.Errorf("expected %d-byte UInt160, got %d bytes", util.Uint160Size, len(bytes))
	}
	return util.Uint160DecodeBytesBE(bytes)
}

func rrCallString(act *actor.Actor, contract util.Uint160, method string, params ...any) (string, error) {
	inv, err := rrCallHALT(act, contract, method, params...)
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

func rrVerifyAccountRoundTrip(act *actor.Actor, registry util.Uint160, appID string) (util.Uint160, error) {
	accountHash, err := rrCallUint160(act, registry, "appAccountOf", appID)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("read appAccountOf(%s): %w", appID, err)
	}
	if accountHash == (util.Uint160{}) {
		return util.Uint160{}, fmt.Errorf("appAccountOf(%s) returned zero", appID)
	}
	echo, err := rrCallString(act, registry, "appIdOfAccount", accountHash)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("read appIdOfAccount(0x%s): %w", accountHash.StringLE(), err)
	}
	if echo != appID {
		return util.Uint160{}, fmt.Errorf("appIdOfAccount(0x%s) returned %q, expected %q", accountHash.StringLE(), echo, appID)
	}
	return accountHash, nil
}

func rrReadAbstractAccountState(act *actor.Actor, registry util.Uint160, appID string) (util.Uint160, util.Uint160, bool, error) {
	inv, err := rrCallHALT(act, registry, "getAppAbstractAccount", appID)
	if err != nil {
		return util.Uint160{}, util.Uint160{}, false, fmt.Errorf("read getAppAbstractAccount(%s): %w", appID, err)
	}
	if len(inv.Stack) == 0 {
		return util.Uint160{}, util.Uint160{}, false, fmt.Errorf("getAppAbstractAccount(%s) returned an empty stack", appID)
	}
	items, ok := inv.Stack[0].Value().([]stackitem.Item)
	if !ok || len(items) != 3 {
		return util.Uint160{}, util.Uint160{}, false, fmt.Errorf("getAppAbstractAccount(%s) returned an invalid tuple", appID)
	}
	core, err := rrStackItemUint160(items[0])
	if err != nil {
		return util.Uint160{}, util.Uint160{}, false, fmt.Errorf("decode abstract-account core for %s: %w", appID, err)
	}
	accountID, err := rrStackItemUint160(items[1])
	if err != nil {
		return util.Uint160{}, util.Uint160{}, false, fmt.Errorf("decode abstract account id for %s: %w", appID, err)
	}
	materialized, err := items[2].TryBool()
	if err != nil {
		return util.Uint160{}, util.Uint160{}, false, fmt.Errorf("decode materialized flag for %s: %w", appID, err)
	}
	return core, accountID, materialized, nil
}

func rrVerifyAbstractAccountRoundTrip(act *actor.Actor, registry util.Uint160, appID string, core util.Uint160, accountID util.Uint160) error {
	echo, err := rrCallString(act, registry, "appIdOfAbstractAccount", core, accountID)
	if err != nil {
		return fmt.Errorf("read appIdOfAbstractAccount(0x%s, 0x%s): %w", core.StringLE(), accountID.StringLE(), err)
	}
	if echo != appID {
		return fmt.Errorf("appIdOfAbstractAccount(0x%s, 0x%s) returned %q, expected %q", core.StringLE(), accountID.StringLE(), echo, appID)
	}
	return nil
}

func rrStackItemUint160(item stackitem.Item) (util.Uint160, error) {
	bytes, err := item.TryBytes()
	if err != nil {
		return util.Uint160{}, err
	}
	if len(bytes) == 0 {
		return util.Uint160{}, nil
	}
	if len(bytes) != util.Uint160Size {
		return util.Uint160{}, fmt.Errorf("expected %d-byte UInt160, got %d bytes", util.Uint160Size, len(bytes))
	}
	return util.Uint160DecodeBytesBE(bytes)
}

func rrStackValues(inv *result.Invoke) []interface{} {
	out := []interface{}{}
	if len(inv.Stack) == 0 {
		return out
	}
	items, ok := inv.Stack[0].Value().([]stackitem.Item)
	if !ok {
		return append(out, rrStackValue(inv.Stack[0]))
	}
	for _, item := range items {
		out = append(out, rrStackValue(item))
	}
	return out
}

func rrStackValue(item stackitem.Item) interface{} {
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

func rrSignerBalances(client *rpcclient.Client, signer util.Uint160) (int64, int64, error) {
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
		case rrNeoHashLE:
			neo = amount
		case rrGasHashLE:
			gas = amount
		}
	}
	return neo, gas, nil
}

// ---------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------

func rrParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func rrParseSignerIdentity(raw string) (util.Uint160, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return util.Uint160{}, fmt.Errorf("public signer identity is required as a Neo address or script hash (set PLATFORM_REGISTRY_DRY_RUN_SIGNER)")
	}
	if strings.HasPrefix(trimmed, "0x") || len(trimmed) == 40 {
		hash, err := rrParseHash(trimmed)
		if err != nil {
			return util.Uint160{}, fmt.Errorf("invalid PLATFORM_REGISTRY_DRY_RUN_SIGNER script hash")
		}
		return hash, nil
	}
	hash, err := address.StringToUint160(trimmed)
	if err != nil {
		return util.Uint160{}, fmt.Errorf("invalid PLATFORM_REGISTRY_DRY_RUN_SIGNER Neo address")
	}
	return hash, nil
}

func rrReportPath(network string, cohortAction string) string {
	if cohortAction == "materialize-abstract-accounts" {
		if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_ABSTRACT_ACCOUNT_REPORT_PATH")); raw != "" {
			return raw
		}
		return filepath.Join("deploy", "config", fmt.Sprintf("cohort0-abstract-account-materialization-%s-%s.json", network, time.Now().UTC().Format("2006-01-02")))
	}
	if cohortAction == "materialize-accounts" {
		if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_MATERIALIZE_REPORT_PATH")); raw != "" {
			return raw
		}
		return filepath.Join("deploy", "config", fmt.Sprintf("cohort0-account-materialization-%s-%s.json", network, time.Now().UTC().Format("2006-01-02")))
	}
	if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_REGISTER_REPORT_PATH")); raw != "" {
		return raw
	}
	return filepath.Join("deploy", "config", fmt.Sprintf("cohort0-registration-%s-%s.json", network, time.Now().UTC().Format("2006-01-02")))
}

func rrWriteReport(path string, report rrReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, append(out, '\n'), 0644)
}

func rrFormatGas(fractions int64) string {
	return strconv.FormatFloat(float64(fractions)/rrGasFractionsPerGas, 'f', 8, 64)
}

func rrFormatBigGas(value *big.Int) string {
	rat := new(big.Rat).SetFrac(value, big.NewInt(100_000_000))
	return rat.FloatString(8)
}

func rrFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func rrTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
