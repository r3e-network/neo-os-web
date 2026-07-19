//go:build scripts

// Attach the 11 TEE skill-game clone appIds of the clone-family absorption
// (Phase 5 of the joint platform program) to the platform-game engine row on
// the PlatformRegistry, then push each app's descriptor set so the engine's
// per-app economics match the legacy clone constants exactly (design doc
// docs/platform-contract-library-v2.md §3.1/§3.3; app roster + values:
// deploy/config/rewardgame-absorption-manifest.json).
//
// Per appId: test-invoke getApp(appId) — skip the attach when the row
// already shows engineId == platform-game (idempotent; attachEngine reverts
// "engine already attached"); otherwise attachEngine(appId, "platform-game"),
// which records the attachment and pushes activateApp(appId, appAdmin,
// descriptor=null) into the engine. Then per namespaced descriptor key
// platform-game:<limitMs0..2|minSolveMs0..2|targetScore0..2> read
// getDescriptor(appId, key) and skip keys already at the manifest value;
// otherwise setDescriptor(appId, key, value) with the value as an Integer —
// the registry persists its directory copy and forwards to the engine's
// validateAndApplyDescriptor, which range-validates engine-side
// (PlatformGame.RewardGame.Descriptor.cs). Only the 9 timing/score keys are
// pushed: entry/reward/dailyCap/undoPenaltyBps/settleGraceMs are identical
// to the engine DefaultEconomics, which unset keys fall back to (manifest
// engine notes).
//
// Descriptor write ORDER within an app is limitMs*, then minSolveMs*, then
// targetScore*: the engine cross-asserts minSolveMs{d} <= limitMs{d} on
// every write against the CURRENT stored row, so a solve-floor raise only
// lands after its time limit (sudoku's minSolveMs0 90000 would exceed the
// 60000 default limitMs0 and FAULT mid-run if written first).
//
// Safety:
//   - Dry-run is the DEFAULT: PLATFORM_REGISTRY_DEPLOY_DRY_RUN unset means
//     dry. Set it explicitly to 0/false AND CONFIRM_PLATFORM_REGISTRY_DEPLOY=
//     I_UNDERSTAND_THIS_WRITES_CHAIN for chain writes.
//   - Network magic is asserted before any write (testnet 894710606 /
//     mainnet 860833102).
//   - Pre-flight: every manifest appId is validated against the on-chain
//     charset [a-z0-9-_.]{1,64}, and every descriptor value against the
//     engine's own bounds (mirrored below) plus the minSolveMs<=limitMs
//     cross-field rule, before anything is simulated or sent.
//   - The engine row goes live only after its registration timelock
//     executes. While getEngine("platform-game") finds no ACTIVE row the run
//     classifies every step NOT-READY, records what gates the run (a
//     registerEngine probe classifies the pending timelock), writes the
//     report, and exits 0 — nothing errors, nothing writes.
//   - Per-app failures are recorded and never abort the run; the JSON report
//     is rewritten after every batch so an interrupted run keeps the txids
//     confirmed so far. The run aborts early only after 5 CONSECUTIVE app
//     failures (the signature of a systemic RPC/balance problem).
//   - A full 11-app write run sends up to ~110 confirmed transactions (1
//     attach + 9 descriptors each) — plan for the better part of an hour on
//     testnet.
//
// Key environment:
//
//	PLATFORM_REGISTRY_DEPLOY_DRY_RUN       default dry when unset
//	CONFIRM_PLATFORM_REGISTRY_DEPLOY       I_UNDERSTAND_THIS_WRITES_CHAIN
//	PLATFORM_REGISTRY_DEPLOY_NETWORK       testnet (default) | mainnet
//	NEO_TESTNET_WIF / FLAGSHIP_TESTNET_WIF signer WIF — must be the app admin of every roster row
//	                                       (mainnet: NEO_MAINNET_WIF / FLAGSHIP_MAINNET_WIF)
//	NEO_TESTNET_RPC_URL / NEO_RPC_URL      RPC endpoint (default https://testnet1.neo.coz.io:443)
//	PLATFORM_REGISTRY_TESTNET_HASH         registry hash override (mainnet: PLATFORM_REGISTRY_MAINNET_HASH,
//	                                       generic: PLATFORM_REGISTRY_HASH); otherwise resolved from the
//	                                       newest deploy/config/platform-registry-<network>-*.json report
//	ATTACH_MANIFEST_PATH                   absorption manifest override
//	                                       (default deploy/config/rewardgame-absorption-manifest.json)
//	PLATFORM_REGISTRY_ATTACH_BATCH_SIZE    apps per progress/report-flush batch (default 5)
//	PLATFORM_REGISTRY_MIN_GAS              signer GAS floor override (default: computed plan estimate)
//	PLATFORM_REGISTRY_ATTACH_REPORT_PATH   report output override
//	                                       (default deploy/config/engine-attach-<network>-<date>.json)
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
	"github.com/nspcc-dev/neo-go/pkg/neorpc/result"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	atgConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	atgTestnetMagic  = uint32(894710606)
	atgMainnetMagic  = uint32(860833102)

	atgDefaultTestnetRPC = "https://testnet1.neo.coz.io:443"
	atgDefaultMainnetRPC = "https://mainnet2.neo.coz.io:443"

	atgGasHashLE = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	atgNeoHashLE = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"

	atgDefaultManifestPath = "deploy/config/rewardgame-absorption-manifest.json"
	atgDefaultEngineID     = "platform-game"

	// On-chain bounds mirrored from the contracts: the appId/engineId charset
	// (ValidateAppIdFormat/ValidateEngineIdFormat, PlatformRegistry.Directory.cs),
	// the descriptor key cap (MAX_DESCRIPTOR_KEY_LENGTH, PlatformRegistry.cs),
	// and the engine descriptor ranges + gameType (PlatformGame.RewardGame.Descriptor.cs).
	atgMaxAppIDLength         = 64
	atgMaxDescriptorKeyLength = 128
	atgRGMinLimitMs           = int64(1_000)
	atgRGMaxLimitMs           = int64(3_600_000)
	atgRGMaxMinSolveMs        = int64(3_600_000)
	atgRGMinTargetScore       = int64(1)
	atgRGMaxTargetScore       = int64(1_000_000)
	atgRewardGameType         = int64(5)

	atgDefaultBatchSize          = 5 // each app is up to 10 confirmed txs (1 attach + 9 descriptors)
	atgMaxConsecutiveFailures    = 5
	atgPerTxFeeEstimateFractions = int64(30_000_000) // 0.3 GAS budget estimate per confirmed tx
	atgGasFractionsPerGas        = float64(100_000_000)
	atgTestnetFaucetInstruction  = "fund it from the Neo N3 testnet faucet (https://neowish.ngd.network/) or transfer GAS from another testnet account"
)

// atgDescriptorParamOrder is the canonical write order within an app:
// limits before solve floors before score targets (the engine cross-asserts
// minSolveMs{d} <= limitMs{d} against the current stored row on every write).
var atgDescriptorParamOrder = []string{
	"limitMs0", "limitMs1", "limitMs2",
	"minSolveMs0", "minSolveMs1", "minSolveMs2",
	"targetScore0", "targetScore1", "targetScore2",
}

type atgReport struct {
	Action           string                 `json:"action"`
	Network          string                 `json:"network"`
	RPCURL           string                 `json:"rpc_url"`
	NetworkMagic     uint32                 `json:"network_magic"`
	Signer           string                 `json:"signer"`
	SignerHash       string                 `json:"signer_hash"`
	DryRun           bool                   `json:"dry_run"`
	PlatformRegistry string                 `json:"platform_registry"`
	EngineID         string                 `json:"engine_id"`
	EngineHash       string                 `json:"engine_hash,omitempty"`
	EngineActive     bool                   `json:"engine_active"`
	NotReadyReason   string                 `json:"not_ready_reason,omitempty"`
	ManifestPath     string                 `json:"manifest_path"`
	Summary          atgSummary             `json:"summary"`
	Apps             []atgAppRecord         `json:"apps"`
	Transactions     []atgTxRecord          `json:"transactions"`
	Balances         map[string]string      `json:"balances"`
	Validation       map[string]interface{} `json:"validation"`
	NextSteps        []string               `json:"next_steps"`
	GeneratedAtUTC   string                 `json:"generated_at_utc"`
}

type atgSummary struct {
	ManifestTotal             int    `json:"manifest_total"`
	Invalid                   int    `json:"invalid"`
	Attached                  int    `json:"attached"`
	SkippedExisting           int    `json:"skipped_existing"`
	Planned                   int    `json:"planned_attaches"`
	NotReady                  int    `json:"not_ready"`
	Failed                    int    `json:"failed"`
	DescriptorsSet            int    `json:"descriptors_set"`
	DescriptorsPlanned        int    `json:"descriptors_planned"`
	DescriptorsSkippedPresent int    `json:"descriptors_skipped_present"`
	DescriptorsFailed         int    `json:"descriptors_failed"`
	EstimatedTxFeesGas        string `json:"estimated_tx_fees_gas"`
}

type atgAppRecord struct {
	AppID       string                `json:"app_id"`
	Contract    string                `json:"contract,omitempty"`
	Status      string                `json:"status"` // pending|planned|attached|skipped-existing|not-ready|failed|invalid
	Reason      string                `json:"reason,omitempty"`
	AttachTxID  string                `json:"attach_txid,omitempty"`
	Descriptors []atgDescriptorRecord `json:"descriptors"`
	AppRow      []interface{}         `json:"app_row,omitempty"`
	Note        string                `json:"note,omitempty"`
}

type atgDescriptorRecord struct {
	Key     string `json:"key"` // full namespaced key "<engineId>:<param>"
	Param   string `json:"param"`
	Target  int64  `json:"target"`
	Current string `json:"current,omitempty"` // on-chain value when read ("unset" when absent)
	Status  string `json:"status"`            // pending|planned|set|skipped-present|not-ready|failed
	Reason  string `json:"reason,omitempty"`
	TxID    string `json:"txid,omitempty"`
}

type atgTxRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

// atgManifest is the subset of the absorption manifest this tool consumes.
type atgManifest struct {
	Schema string                    `json:"$schema"`
	Engine atgManifestEngine         `json:"engine"`
	Apps   map[string]atgManifestApp `json:"apps"`
}

type atgManifestEngine struct {
	EngineID    string `json:"engineId"`
	TestnetHash string `json:"testnetHash"`
}

type atgManifestApp struct {
	Contract    string           `json:"contract"`
	Descriptors map[string]int64 `json:"descriptors"`
}

// atgEngineInfo is the probed state of the engine row.
type atgEngineInfo struct {
	Ready          bool
	Row            []interface{}
	Hash           util.Uint160
	Active         bool
	NotReadyReason string
	ShortReason    string // one-line gate summary for per-app/descriptor classification lines
	ProbeNote      string // registerEngine probe classification while no active row exists
}

func main() {
	if err := atgRun(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func atgRun() error {
	// Safest convention (the deploy_platform_registry.go idiom): dry-run
	// unless PLATFORM_REGISTRY_DEPLOY_DRY_RUN is explicitly set falsy.
	dryRun := true
	if raw, ok := os.LookupEnv("PLATFORM_REGISTRY_DEPLOY_DRY_RUN"); ok {
		dryRun = atgTruthy(raw)
	}
	if !dryRun && os.Getenv("CONFIRM_PLATFORM_REGISTRY_DEPLOY") != atgConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s to write chain", atgConfirmPhrase)
	}
	if dryRun && os.Getenv("CONFIRM_PLATFORM_REGISTRY_DEPLOY") == atgConfirmPhrase {
		fmt.Println("note: confirm phrase is set but PLATFORM_REGISTRY_DEPLOY_DRY_RUN is not explicitly false; staying in dry-run")
	}

	network := strings.ToLower(atgFirstNonEmpty(os.Getenv("PLATFORM_REGISTRY_DEPLOY_NETWORK"), "testnet"))
	expectedMagic, networkID, rpcURL, wif, err := atgNetworkConfig(network)
	if err != nil {
		return err
	}
	if wif == "" {
		return fmt.Errorf("%s signer WIF is not configured (set NEO_%s_WIF)", network, strings.ToUpper(network))
	}

	batchSize, err := atgBatchSize()
	if err != nil {
		return err
	}

	// Manifest load + pre-flight are offline: they run before any RPC I/O so
	// a bad manifest fails fast and the validation sweep is reviewable in dry
	// logs.
	manifestPath := atgFirstNonEmpty(os.Getenv("ATTACH_MANIFEST_PATH"), atgDefaultManifestPath)
	manifest, err := atgLoadManifest(manifestPath)
	if err != nil {
		return err
	}
	engineID := strings.TrimSpace(manifest.Engine.EngineID)
	if engineID == "" {
		engineID = atgDefaultEngineID
	}
	if reason := atgInvalidAppIDReason(engineID); reason != "" {
		return fmt.Errorf("manifest engine.engineId %q is invalid: %s (on-chain charset [a-z0-9-_.], 1-64 chars)", engineID, reason)
	}
	if engineID == "registry" {
		return fmt.Errorf("engineId %q is reserved by the registry descriptor namespace", engineID)
	}
	apps := atgClassifyManifest(manifest, engineID)
	invalid := atgCountStatus(apps, "invalid")
	fmt.Printf("Pre-flight: %d manifest apps from %s, %d invalid (excluded — would FAULT on-chain), %d in scope (engine %q, %d descriptor keys each)\n",
		len(apps), manifestPath, invalid, atgCountStatus(apps, "pending"), engineID, len(atgDescriptorParamOrder))
	for _, rec := range apps {
		if rec.Status == "invalid" {
			fmt.Printf("  INVALID %q (%s): %s\n", rec.AppID, rec.Contract, rec.Reason)
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

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("invalid %s signer WIF", network)
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

	neoBalance, gasBalance, err := atgSignerBalances(client, signerHash)
	if err != nil {
		return fmt.Errorf("read signer balances: %w", err)
	}
	registryHash, err := atgResolveRegistryHash(client, network)
	if err != nil {
		return err
	}
	mode := "write"
	if dryRun {
		mode = "dry-run"
	}
	fmt.Printf("Signer: %s\n", acc.Address)
	fmt.Printf("Network: %s (magic %d)\n", networkID, actualMagic)
	fmt.Printf("Mode: %s\n", mode)
	fmt.Printf("Balances: %d NEO, %s GAS\n", neoBalance, atgFormatGas(gasBalance))
	fmt.Printf("PlatformRegistry: 0x%s\n\n", registryHash.StringLE())

	report := atgReport{
		Action:           "engine-attach",
		Network:          networkID,
		RPCURL:           rpcURL,
		NetworkMagic:     actualMagic,
		Signer:           acc.Address,
		SignerHash:       "0x" + signerHash.StringLE(),
		DryRun:           dryRun,
		PlatformRegistry: "0x" + registryHash.StringLE(),
		EngineID:         engineID,
		ManifestPath:     manifestPath,
		Apps:             apps,
		Transactions:     []atgTxRecord{},
		Balances:         map[string]string{"neo": strconv.FormatInt(neoBalance, 10), "gas": atgFormatGas(gasBalance)},
		Validation:       map[string]interface{}{"manifest_schema": manifest.Schema},
		NextSteps:        []string{},
		GeneratedAtUTC:   time.Now().UTC().Format(time.RFC3339),
	}
	reportPath := atgReportPath(network)

	// Engine probe first: it gates every step of the run.
	engine, err := atgProbeEngine(act, client, registryHash, engineID, network, manifest, &report)
	if err != nil {
		return err
	}
	report.EngineActive = engine.Ready
	if engine.Ready {
		report.EngineHash = "0x" + engine.Hash.StringLE()
	} else {
		report.NotReadyReason = engine.NotReadyReason
	}

	if engine.Ready {
		// Plan: probe every in-scope appId's directory row (and, for rows
		// already on the engine, the current descriptor values).
		atgPlanApps(act, registryHash, engine, engineID, signerHash, &report)

		// Signer GAS budget over the exact plan, in the sibling script's
		// insufficient-GAS idiom (override PLATFORM_REGISTRY_MIN_GAS).
		var txCount int64
		for _, rec := range report.Apps {
			switch rec.Status {
			case "planned":
				txCount += 1 + int64(len(rec.Descriptors))
			case "skipped-existing":
				for _, d := range rec.Descriptors {
					if d.Status == "planned" {
						txCount++
					}
				}
			}
		}
		requiredGas := atgMinGasRequired(txCount)
		if requiredGas > 0 && float64(gasBalance)/atgGasFractionsPerGas < requiredGas {
			message := fmt.Sprintf("insufficient GAS: signer %s holds %s GAS, the attach plan requires at least %.8g GAS "+
				"(~%s GAS estimated tx fees for %d transactions; tune with PLATFORM_REGISTRY_MIN_GAS). "+
				"To continue, %s.",
				acc.Address, atgFormatGas(gasBalance), requiredGas,
				atgFormatGas(txCount*atgPerTxFeeEstimateFractions), txCount, atgTestnetFaucetInstruction)
			if !dryRun {
				return fmt.Errorf("%s", message)
			}
			fmt.Println("warning: " + message)
		}

		// Execute: per-tx confirmation (send + wait for HALT) like the
		// sibling, with a report flush after every batch.
		pending := atgCountStatus(report.Apps, "planned") + atgCountStatus(report.Apps, "skipped-existing")
		processed := 0
		consecutiveFailures := 0
		for i := range report.Apps {
			rec := &report.Apps[i]
			if rec.Status != "planned" && rec.Status != "skipped-existing" {
				continue
			}
			processed++
			atgExecuteApp(ctx, client, act, registryHash, engine, engineID, dryRun, rec, &report)
			appFailed := rec.Status == "failed"
			if !appFailed {
				for _, d := range rec.Descriptors {
					if d.Status == "failed" {
						appFailed = true
						break
					}
				}
			}
			if appFailed {
				consecutiveFailures++
			} else {
				consecutiveFailures = 0
			}
			fmt.Printf("[%d/%d] %s: %s\n", processed, pending, rec.AppID, atgProgressLine(rec))
			if processed%batchSize == 0 {
				atgRecomputeSummary(&report)
				if err := atgWriteReport(reportPath, report); err != nil {
					return err
				}
				fmt.Printf("... batch checkpoint: report flushed to %s\n", reportPath)
			}
			if consecutiveFailures >= atgMaxConsecutiveFailures {
				atgRecomputeSummary(&report)
				_ = atgWriteReport(reportPath, report)
				return fmt.Errorf("aborting after %d consecutive app failures (last: %s); report flushed to %s", consecutiveFailures, rec.Reason, reportPath)
			}
		}
	} else {
		// Engine gate closed: classify every in-scope step NOT-READY (exit 0 —
		// the report records what gates the run).
		fmt.Printf("NOT-READY: %s\n\n", engine.NotReadyReason)
		for i := range report.Apps {
			rec := &report.Apps[i]
			if rec.Status != "pending" {
				continue
			}
			row, registered, probeErr := atgProbeApp(act, registryHash, rec.AppID)
			switch {
			case probeErr != nil:
				rec.Status = "failed"
				rec.Reason = probeErr.Error()
			case !registered:
				rec.Status = "not-ready"
				rec.Reason = "appId not registered on-chain (Phase 2b lane: go run -tags scripts deploy/scripts/register_apps_on_platform_registry.go) and " + engine.ShortReason
			default:
				rec.AppRow = row
				rec.Status = "not-ready"
				rec.Reason = engine.ShortReason
			}
			atgMarkDescriptors(rec, "not-ready", engine.ShortReason)
			atgPrintAppPlan(rec)
		}
		report.NextSteps = append(report.NextSteps,
			fmt.Sprintf("GATE: engine %q is not active on registry %s — %s Execute the pending engine-registration timelock first via deploy_platform_registry.go's execute-timelocks action (same dry-run/confirm gates as this tool; maturity per the pending_timelocks section of the newest deploy/config/platform-registry-%s-*.json — 24h from the proposal).",
				engineID, report.PlatformRegistry, engine.NotReadyReason, network),
			"Then re-run this script: the dry-run will classify all in-scope apps planned, and a write run attaches + pushes the descriptor sets.",
		)
	}

	report.NextSteps = append(report.NextSteps,
		"Kernel lane: register + grant all 11 appIds on the private kernel with callbackContract=PlatformGame (PRIVATE_KERNEL_ACTION=wire PRIVATE_KERNEL_APP_IDS=<csv of the 11 appIds> on deploy_private_kernel.go).",
		"Frontend: switch ContractBinding to moduleId 'platform-game' mode 'shared' and migrate event/stat names per the manifest readSurfaceRenames (migration outline step 4).",
		"Verify per-app: start -> finalize -> settle loop on testnet through the private kernel and compare economics against the legacy clone tables (migration outline step 5); only then decommission the 11 MiniApp<Name> contracts.",
	)
	if dryRun {
		report.NextSteps = append(report.NextSteps,
			fmt.Sprintf("Dry-run wrote nothing. To write chain, rerun with: PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s NEO_TESTNET_WIF=<wif> go run -tags scripts deploy/scripts/attach_apps_to_platform_game.go", atgConfirmPhrase),
		)
	}
	atgRecomputeSummary(&report)
	if err := atgWriteReport(reportPath, report); err != nil {
		return err
	}
	atgPrintReconciliation(report)
	fmt.Printf("\nSaved: %s\n", reportPath)
	for _, step := range report.NextSteps {
		fmt.Println(" - " + step)
	}
	if dryRun {
		fmt.Println("\ndry-run: nothing was written. To write chain, rerun with:")
		fmt.Printf("  PLATFORM_REGISTRY_DEPLOY_DRY_RUN=false CONFIRM_PLATFORM_REGISTRY_DEPLOY=%s NEO_TESTNET_WIF=<wif> \\\n", atgConfirmPhrase)
		fmt.Println("    go run -tags scripts deploy/scripts/attach_apps_to_platform_game.go")
	}
	return nil
}

func atgCountStatus(apps []atgAppRecord, status string) int {
	count := 0
	for _, rec := range apps {
		if rec.Status == status {
			count++
		}
	}
	return count
}

func atgNetworkConfig(network string) (uint32, string, string, string, error) {
	switch network {
	case "mainnet":
		return atgMainnetMagic,
			"neo-n3-mainnet",
			atgFirstNonEmpty(os.Getenv("NEO_MAINNET_RPC_URL"), atgDefaultMainnetRPC),
			atgFirstNonEmpty(os.Getenv("NEO_MAINNET_WIF"), os.Getenv("FLAGSHIP_MAINNET_WIF")),
			nil
	case "testnet":
		return atgTestnetMagic,
			"neo-n3-testnet",
			atgFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), atgDefaultTestnetRPC),
			atgFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF")),
			nil
	default:
		return 0, "", "", "", fmt.Errorf("unsupported PLATFORM_REGISTRY_DEPLOY_NETWORK=%q", network)
	}
}

// ---------------------------------------------------------------------
// Manifest load + pre-flight
// ---------------------------------------------------------------------

func atgLoadManifest(path string) (*atgManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read manifest %s: %w", path, err)
	}
	var manifest atgManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("parse manifest %s: %w", path, err)
	}
	if len(manifest.Apps) == 0 {
		return nil, fmt.Errorf("manifest %s has no apps", path)
	}
	return &manifest, nil
}

// atgClassifyManifest turns manifest entries into report records in sorted
// appId order: charset/descriptor violations are "invalid" (excluded — they
// would FAULT on-chain), the rest are "pending".
func atgClassifyManifest(manifest *atgManifest, engineID string) []atgAppRecord {
	appIDs := make([]string, 0, len(manifest.Apps))
	for appID := range manifest.Apps {
		appIDs = append(appIDs, appID)
	}
	sort.Strings(appIDs)
	apps := []atgAppRecord{}
	for _, appID := range appIDs {
		entry := manifest.Apps[appID]
		rec := atgAppRecord{AppID: appID, Contract: entry.Contract}
		for _, param := range atgDescriptorParamOrder {
			rec.Descriptors = append(rec.Descriptors, atgDescriptorRecord{
				Key:    engineID + ":" + param,
				Param:  param,
				Target: entry.Descriptors[param],
				Status: "pending",
			})
		}
		switch {
		case atgInvalidAppIDReason(appID) != "":
			rec.Status = "invalid"
			rec.Reason = atgInvalidAppIDReason(appID) + " (on-chain charset [a-z0-9-_.], 1-64 chars)"
			atgMarkDescriptors(&rec, "not-ready", "app invalid")
		default:
			if reason := atgValidateDescriptorSet(entry.Descriptors, engineID); reason != "" {
				rec.Status = "invalid"
				rec.Reason = reason
				atgMarkDescriptors(&rec, "not-ready", "app invalid")
			} else {
				rec.Status = "pending"
			}
		}
		apps = append(apps, rec)
	}
	return apps
}

// atgValidateDescriptorSet mirrors the engine's descriptor acceptance rules
// (ApplyRewardDescriptor, PlatformGame.RewardGame.Descriptor.cs): exactly the
// 9 canonical keys, per-family ranges, and the minSolveMs{d} <= limitMs{d}
// cross-field rule. It returns "" for a valid set, otherwise the reason the
// on-chain setDescriptor would FAULT.
func atgValidateDescriptorSet(descriptors map[string]int64, engineID string) string {
	if len(descriptors) != len(atgDescriptorParamOrder) {
		return fmt.Sprintf("descriptor set has %d keys, expected exactly %d (%s)", len(descriptors), len(atgDescriptorParamOrder), strings.Join(atgDescriptorParamOrder, ","))
	}
	for _, param := range atgDescriptorParamOrder {
		value, ok := descriptors[param]
		if !ok {
			return fmt.Sprintf("missing descriptor %q", param)
		}
		if len(engineID)+1+len(param) > atgMaxDescriptorKeyLength {
			return fmt.Sprintf("descriptor key %q exceeds %d chars", engineID+":"+param, atgMaxDescriptorKeyLength)
		}
		if reason := atgDescriptorBoundsReason(param, value); reason != "" {
			return reason
		}
	}
	for param := range descriptors {
		known := false
		for _, canonical := range atgDescriptorParamOrder {
			if param == canonical {
				known = true
				break
			}
		}
		if !known {
			return fmt.Sprintf("unknown descriptor key %q (engine reverts \"unknown descriptor key\")", param)
		}
	}
	for d := 0; d < 3; d++ {
		limit := descriptors[fmt.Sprintf("limitMs%d", d)]
		floor := descriptors[fmt.Sprintf("minSolveMs%d", d)]
		if floor > limit {
			return fmt.Sprintf("minSolveMs%d (%d) above limitMs%d (%d) — the engine cross-field rule rejects it", d, floor, d, limit)
		}
	}
	return ""
}

// atgDescriptorBoundsReason mirrors the per-family engine ranges: limitMs in
// [1000, 3.6M], minSolveMs in [0, 3.6M], targetScore in [1, 1M].
func atgDescriptorBoundsReason(param string, value int64) string {
	stem := param[:len(param)-1]
	switch stem {
	case "limitMs":
		if value < atgRGMinLimitMs || value > atgRGMaxLimitMs {
			return fmt.Sprintf("%s=%d out of the engine range %d..%d", param, value, atgRGMinLimitMs, atgRGMaxLimitMs)
		}
	case "minSolveMs":
		if value < 0 || value > atgRGMaxMinSolveMs {
			return fmt.Sprintf("%s=%d out of the engine range 0..%d", param, value, atgRGMaxMinSolveMs)
		}
	case "targetScore":
		if value < atgRGMinTargetScore || value > atgRGMaxTargetScore {
			return fmt.Sprintf("%s=%d out of the engine range %d..%d", param, value, atgRGMinTargetScore, atgRGMaxTargetScore)
		}
	}
	return ""
}

// atgInvalidAppIDReason is a byte-exact mirror of ValidateAppIdFormat
// (PlatformRegistry.Directory.cs): 1-64 chars of [a-z0-9-_.]. It returns ""
// for valid ids, otherwise the reason the on-chain call would FAULT.
func atgInvalidAppIDReason(appID string) string {
	if appID == "" {
		return "empty appId"
	}
	if len(appID) > atgMaxAppIDLength {
		return fmt.Sprintf("longer than %d chars", atgMaxAppIDLength)
	}
	for _, c := range appID {
		ok := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.'
		if !ok {
			return fmt.Sprintf("character %q outside [a-z0-9-_.]", c)
		}
	}
	return ""
}

func atgBatchSize() (int, error) {
	raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_ATTACH_BATCH_SIZE"))
	if raw == "" {
		return atgDefaultBatchSize, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid PLATFORM_REGISTRY_ATTACH_BATCH_SIZE (must be a positive integer)")
	}
	return value, nil
}

func atgMinGasRequired(txCount int64) float64 {
	if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_MIN_GAS")); raw != "" {
		if value, err := strconv.ParseFloat(raw, 64); err == nil && value >= 0 {
			return value
		}
	}
	return float64(txCount*atgPerTxFeeEstimateFractions) / atgGasFractionsPerGas
}

// ---------------------------------------------------------------------
// Engine + app probes
// ---------------------------------------------------------------------

// atgProbeEngine resolves the engine row state that gates the whole run.
// Ready only when getEngine returns a row with active=true AND the engine
// contract is deployed (the attachEngine activateApp push calls it). While
// no row exists, a registerEngine probe classifies the pending timelock (the
// deploy script's own idiom — the safe ABI exposes no pending-ETA read).
func atgProbeEngine(act *actor.Actor, client *rpcclient.Client, registry util.Uint160, engineID string, network string, manifest *atgManifest, report *atgReport) (atgEngineInfo, error) {
	info := atgEngineInfo{}
	report.Validation["engine_id"] = engineID
	inv, err := act.Call(registry, "getEngine", engineID)
	if err != nil {
		return info, fmt.Errorf("getEngine(%s) call: %w", engineID, err)
	}
	if inv.State == "HALT" {
		row := atgStackValues(inv)
		info.Row = row
		report.Validation["engine_row"] = row
		fmt.Printf("engine %q row: %v\n", engineID, row)
		if len(row) != 3 {
			return info, fmt.Errorf("getEngine(%s) returned %d values, expected 3 [engineHash, schemaVersion, active]", engineID, len(row))
		}
		hashStr, _ := row[0].(string)
		hash, err := atgParseHash(hashStr)
		if err != nil {
			return info, fmt.Errorf("parse engine hash from getEngine row: %w", err)
		}
		info.Hash = hash
		report.Validation["engine_hash"] = "0x" + hash.StringLE()
		active, _ := row[2].(bool)
		info.Active = active
		if !active {
			info.NotReadyReason = fmt.Sprintf("engine %q row exists but is INACTIVE (retired) — attachEngine/setDescriptor revert \"engine not active\"; a retired engine is never re-activated, re-attachment rides a NEW engineId", engineID)
			info.ShortReason = fmt.Sprintf("engine %q is retired (row inactive)", engineID)
			return info, nil
		}
		if _, err := client.GetContractStateByHash(hash); err != nil {
			report.Validation["engine_deployed_on_chain"] = false
			info.NotReadyReason = fmt.Sprintf("engine %q row is active but the engine contract 0x%s is not deployed (%s) — the activateApp push would FAULT", engineID, hash.StringLE(), err)
			info.ShortReason = fmt.Sprintf("engine %q contract not deployed", engineID)
			return info, nil
		}
		report.Validation["engine_deployed_on_chain"] = true
		if network == "testnet" && strings.TrimSpace(manifest.Engine.TestnetHash) != "" {
			pinned, err := atgParseHash(manifest.Engine.TestnetHash)
			if err == nil {
				report.Validation["engine_hash_matches_manifest"] = pinned == hash
				if pinned != hash {
					fmt.Printf("warning: on-chain engine hash 0x%s differs from the manifest's pinned testnetHash %s (manifest descriptor values were computed for that build)\n",
						hash.StringLE(), manifest.Engine.TestnetHash)
				}
			}
		}
		info.Ready = true
		return info, nil
	}
	if !strings.Contains(inv.FaultException, "engine not found") {
		return info, fmt.Errorf("getEngine(%s) fault: %s", engineID, inv.FaultException)
	}
	report.Validation["engine_row"] = "not registered"
	fmt.Printf("engine %q: no row on the registry\n", engineID)
	// Classify the pending registration with a registerEngine probe: HALT =
	// matured and executable by anyone; "timelock active" = proposed, still
	// locked; "no pending engine change" = never proposed.
	probe, probeErr := act.Call(registry, "registerEngine", engineID)
	switch {
	case probeErr == nil && probe.State == "HALT":
		info.ProbeNote = "the pending engine registration is MATURED and executable — run the deploy tool's execute-timelocks action now (deploy_platform_registry.go)"
	case probeErr == nil && strings.Contains(probe.FaultException, "timelock active"):
		info.ProbeNote = "the engine registration is proposed but the 24h timelock has not matured (the safe ABI exposes no ETA — see the pending_timelocks section of the newest deploy/config/platform-registry report)"
	case probeErr == nil && strings.Contains(probe.FaultException, "no pending engine change"):
		info.ProbeNote = "no engine registration has been proposed (deploy_platform_registry.go's deploy action proposes it)"
	case probeErr != nil:
		info.ProbeNote = fmt.Sprintf("registerEngine probe call failed: %s", probeErr)
	default:
		info.ProbeNote = fmt.Sprintf("registerEngine probe fault: %s", probe.FaultException)
	}
	report.Validation["register_engine_probe"] = info.ProbeNote
	fmt.Printf("registerEngine probe: %s\n\n", info.ProbeNote)
	info.NotReadyReason = fmt.Sprintf("engine %q is not registered on the registry (%s)", engineID, info.ProbeNote)
	info.ShortReason = fmt.Sprintf("engine %q is not registered on the registry", engineID)
	return info, nil
}

// atgProbeApp test-invokes getApp: registered only when the call HALTs,
// unregistered only on the contract's own "appId not registered" fault —
// transport errors and unexpected faults are errors, never "unregistered".
func atgProbeApp(act *actor.Actor, registry util.Uint160, appID string) ([]interface{}, bool, error) {
	inv, err := act.Call(registry, "getApp", appID)
	if err != nil {
		return nil, false, fmt.Errorf("getApp(%s) call: %w", appID, err)
	}
	if inv.State == "HALT" {
		return atgStackValues(inv), true, nil
	}
	if strings.Contains(inv.FaultException, "appId not registered") {
		return nil, false, nil
	}
	return nil, false, fmt.Errorf("getApp(%s) fault: %s", appID, inv.FaultException)
}

// atgReadDescriptor test-invokes getDescriptor: the stored copy deserializes
// to an Integer; an absent key comes back as a null (Any) stack item.
func atgReadDescriptor(act *actor.Actor, registry util.Uint160, appID string, key string) (*big.Int, bool, error) {
	inv, err := act.Call(registry, "getDescriptor", appID, key)
	if err != nil {
		return nil, false, fmt.Errorf("getDescriptor(%s, %s) call: %w", appID, key, err)
	}
	if inv.State != "HALT" {
		return nil, false, fmt.Errorf("getDescriptor(%s, %s) fault: %s", appID, key, inv.FaultException)
	}
	if len(inv.Stack) == 0 {
		return nil, false, nil
	}
	item := inv.Stack[0]
	if item == nil || item.Type() == stackitem.AnyT {
		return nil, false, nil
	}
	value, err := item.TryInteger()
	if err != nil {
		return nil, false, fmt.Errorf("getDescriptor(%s, %s) returned a non-integer (%s): %w", appID, key, item.Type(), err)
	}
	return value, true, nil
}

// ---------------------------------------------------------------------
// Plan + execution
// ---------------------------------------------------------------------

// atgPlanApps classifies every in-scope app from its directory row: already
// on the engine ("skipped-existing", with descriptor reads), a lite row to
// attach ("planned"), or gated ("not-ready"/"failed"). The per-app plan —
// attach + the 9 namespaced descriptor keys with manifest values — is
// printed as it is classified.
func atgPlanApps(act *actor.Actor, registry util.Uint160, engine atgEngineInfo, engineID string, signerHash util.Uint160, report *atgReport) {
	total := atgCountStatus(report.Apps, "pending")
	processed := 0
	for i := range report.Apps {
		rec := &report.Apps[i]
		if rec.Status != "pending" {
			continue
		}
		processed++
		row, registered, err := atgProbeApp(act, registry, rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = err.Error()
			atgMarkDescriptors(rec, "not-ready", "getApp probe failed")
			fmt.Printf("[%d/%d] %s: probe FAILED — %s\n", processed, total, rec.AppID, rec.Reason)
			continue
		}
		if !registered {
			rec.Status = "not-ready"
			rec.Reason = "appId not registered on-chain (Phase 2b lane: go run -tags scripts deploy/scripts/register_apps_on_platform_registry.go)"
			atgMarkDescriptors(rec, "not-ready", "appId not registered")
			fmt.Printf("[%d/%d] %s: NOT-READY — %s\n", processed, total, rec.AppID, rec.Reason)
			continue
		}
		rec.AppRow = row
		attached, _ := row[0].(string)
		admin, _ := row[2].(string)
		adminMismatch := admin != "" && admin != "0x"+signerHash.StringLE()
		switch attached {
		case engineID:
			rec.Status = "skipped-existing"
			rec.Reason = "engine already attached"
			rec.Note = atgEngineTenantNote(act, engine.Hash, rec.AppID)
			if adminMismatch {
				warning := fmt.Sprintf("WARNING: signer is not the app admin (row admin %s) — setDescriptor is app-admin gated", admin)
				if rec.Note != "" {
					rec.Note += "; " + warning
				} else {
					rec.Note = warning
				}
			}
			for j := range rec.Descriptors {
				d := &rec.Descriptors[j]
				if adminMismatch {
					d.Status = "not-ready"
					d.Reason = "signer is not the app admin"
					continue
				}
				atgClassifyDescriptor(act, registry, rec.AppID, d)
			}
		case "":
			rec.Status = "planned"
			rec.Reason = "lite directory row — attachEngine planned"
			if adminMismatch {
				rec.Status = "not-ready"
				rec.Reason = fmt.Sprintf("signer is not the app admin (row admin %s); attachEngine is app-admin witnessed", admin)
				atgMarkDescriptors(rec, "not-ready", "signer is not the app admin")
			}
		default:
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("appId is attached to a DIFFERENT engine %q; re-attachment is an explicit opt-in for schema upgrades, not this tool's lane", attached)
			atgMarkDescriptors(rec, "not-ready", "attached to a different engine")
		}
		fmt.Printf("[%d/%d] ", processed, total)
		atgPrintAppPlan(rec)
	}
	fmt.Println()
}

// atgClassifyDescriptor reads the stored directory copy and classifies the
// key skipped-present (already at the manifest value) or planned.
func atgClassifyDescriptor(act *actor.Actor, registry util.Uint160, appID string, d *atgDescriptorRecord) {
	current, isSet, err := atgReadDescriptor(act, registry, appID, d.Key)
	if err != nil {
		d.Status = "failed"
		d.Reason = err.Error()
		return
	}
	if !isSet {
		d.Current = "unset"
		d.Status = "planned"
		return
	}
	d.Current = current.String()
	if current.Cmp(big.NewInt(d.Target)) == 0 {
		d.Status = "skipped-present"
		d.Reason = "already at target"
		return
	}
	d.Status = "planned"
	d.Reason = fmt.Sprintf("%s -> %d", current.String(), d.Target)
}

// atgPrintAppPlan prints one app's attach classification plus the 9
// namespaced descriptor keys with their manifest target values.
func atgPrintAppPlan(rec *atgAppRecord) {
	label := rec.AppID
	if rec.Contract != "" {
		label += " (" + rec.Contract + ")"
	}
	fmt.Printf("%s: attach %s — %s\n", label, strings.ToUpper(rec.Status), rec.Reason)
	for _, d := range rec.Descriptors {
		current := d.Current
		if current == "" {
			current = "-"
		}
		note := d.Status
		if d.Reason != "" {
			note += ", " + d.Reason
		}
		fmt.Printf("    %-28s = %-8d (current: %s) %s\n", d.Key, d.Target, current, note)
	}
	if rec.Note != "" {
		fmt.Printf("    note: %s\n", rec.Note)
	}
}

// atgExecuteApp runs one app's attach (when planned) and descriptor lane.
// Dry-run simulates every write and classifies eligibility; write mode sends
// with per-tx confirmation and read-back asserts, mirroring the sibling
// full-loop idioms.
func atgExecuteApp(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, engine atgEngineInfo, engineID string, dryRun bool, rec *atgAppRecord, report *atgReport) {
	attachReady := false
	switch rec.Status {
	case "skipped-existing":
		attachReady = true
	case "planned":
		inv, err := act.Call(registry, "attachEngine", rec.AppID, engineID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("simulate attachEngine: %s", err)
			break
		}
		if inv.State != "HALT" {
			switch {
			case strings.Contains(inv.FaultException, "engine already attached"):
				rec.Status = "skipped-existing"
				rec.Reason = "already attached (attached concurrently with the run)"
				attachReady = true
			case strings.Contains(inv.FaultException, "engine not active"):
				rec.Status = "not-ready"
				rec.Reason = "engine went inactive between probe and simulation"
			default:
				rec.Status = "failed"
				rec.Reason = fmt.Sprintf("simulate attachEngine fault: %s", inv.FaultException)
			}
			break
		}
		if dryRun {
			rec.Reason = "attachEngine simulation HALT (eligible)"
			break
		}
		txid, _, err := atgSendAndWait(ctx, client, act, registry, "attachEngine", report, "attachEngine "+rec.AppID, rec.AppID, engineID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = err.Error()
			break
		}
		rec.AttachTxID = "0x" + txid.StringLE()
		row, registered, err := atgProbeApp(act, registry, rec.AppID)
		if err != nil || !registered {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("read getApp(%s) after attach: %v", rec.AppID, err)
			break
		}
		rec.AppRow = row
		if attached, _ := row[0].(string); attached != engineID {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("getApp(%s) engineId %q after attach, expected %q", rec.AppID, attached, engineID)
			break
		}
		if rowHash, _ := row[1].(string); rowHash != "0x"+engine.Hash.StringLE() {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("getApp(%s) engineHash %v after attach, expected 0x%s", rec.AppID, row[1], engine.Hash.StringLE())
			break
		}
		// The activateApp push is proven engine-side (the full-loop idiom):
		// the engine holds a gameType-5 row for the app.
		gameType, err := atgCallInteger(act, engine.Hash, "getGameType", rec.AppID)
		if err != nil {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("read engine getGameType(%s) after attach: %s", rec.AppID, err)
			break
		}
		if gameType.Cmp(big.NewInt(atgRewardGameType)) != 0 {
			rec.Status = "failed"
			rec.Reason = fmt.Sprintf("engine getGameType(%s) = %s after attach, expected %d (RewardGame) — the activateApp push did not land", rec.AppID, gameType.String(), atgRewardGameType)
			break
		}
		rec.Status = "attached"
		rec.Reason = ""
		rec.Note = atgFirstNonEmpty(rec.Note, "activateApp push confirmed engine-side (getGameType=5 RewardGame)")
		attachReady = true
	}

	for j := range rec.Descriptors {
		d := &rec.Descriptors[j]
		if d.Status == "skipped-present" || d.Status == "set" || d.Status == "failed" {
			continue
		}
		if !attachReady {
			if dryRun && rec.Status == "planned" {
				d.Status = "planned"
				d.Reason = "follows the planned attachEngine in write mode"
			} else {
				d.Status = "not-ready"
				d.Reason = "attach step did not complete"
			}
			continue
		}
		atgExecuteDescriptor(ctx, client, act, registry, rec.AppID, d, dryRun, report)
	}
}

// atgExecuteDescriptor re-reads the stored copy (freshness over the plan
// phase), then simulates setDescriptor and — in write mode — sends it with a
// read-back assert. The value goes as an Integer param.
func atgExecuteDescriptor(ctx context.Context, client *rpcclient.Client, act *actor.Actor, registry util.Uint160, appID string, d *atgDescriptorRecord, dryRun bool, report *atgReport) {
	current, isSet, err := atgReadDescriptor(act, registry, appID, d.Key)
	if err != nil {
		d.Status = "failed"
		d.Reason = err.Error()
		return
	}
	if isSet {
		d.Current = current.String()
		if current.Cmp(big.NewInt(d.Target)) == 0 {
			d.Status = "skipped-present"
			d.Reason = "already at target"
			return
		}
	} else {
		d.Current = "unset"
	}
	inv, err := act.Call(registry, "setDescriptor", appID, d.Key, d.Target)
	if err != nil {
		d.Status = "failed"
		d.Reason = fmt.Sprintf("simulate setDescriptor(%s): %s", d.Key, err)
		return
	}
	if inv.State != "HALT" {
		d.Status = "failed"
		d.Reason = fmt.Sprintf("simulate setDescriptor(%s) fault: %s", d.Key, inv.FaultException)
		return
	}
	if dryRun {
		d.Status = "planned"
		d.Reason = "setDescriptor simulation HALT (eligible)"
		return
	}
	txid, _, err := atgSendAndWait(ctx, client, act, registry, "setDescriptor", report, "setDescriptor "+d.Key+" ("+appID+")", appID, d.Key, d.Target)
	if err != nil {
		d.Status = "failed"
		d.Reason = err.Error()
		return
	}
	d.TxID = "0x" + txid.StringLE()
	after, isSet, err := atgReadDescriptor(act, registry, appID, d.Key)
	if err != nil || !isSet || after.Cmp(big.NewInt(d.Target)) != 0 {
		d.Status = "failed"
		d.Reason = fmt.Sprintf("getDescriptor(%s) read-back after write does not match the target %d", d.Key, d.Target)
		return
	}
	d.Status = "set"
	d.Reason = ""
}

// atgEngineTenantNote is the soft (never failing) engine-side proof that an
// earlier attach's activateApp push landed: getGameType(appId) == 5.
func atgEngineTenantNote(act *actor.Actor, engineHash util.Uint160, appID string) string {
	gameType, err := atgCallInteger(act, engineHash, "getGameType", appID)
	if err != nil {
		return "engine getGameType read failed: " + err.Error()
	}
	if gameType.Cmp(big.NewInt(atgRewardGameType)) != 0 {
		return fmt.Sprintf("WARNING: engine getGameType(%s) = %s, expected %d (RewardGame) — the activateApp push did not land", appID, gameType.String(), atgRewardGameType)
	}
	return "engine tenant row confirmed (getGameType=5 RewardGame)"
}

func atgMarkDescriptors(rec *atgAppRecord, status string, reason string) {
	for j := range rec.Descriptors {
		if rec.Descriptors[j].Status == "pending" {
			rec.Descriptors[j].Status = status
			rec.Descriptors[j].Reason = reason
		}
	}
}

func atgProgressLine(rec *atgAppRecord) string {
	set, planned, present, failed := 0, 0, 0, 0
	for _, d := range rec.Descriptors {
		switch d.Status {
		case "set":
			set++
		case "planned":
			planned++
		case "skipped-present":
			present++
		case "failed":
			failed++
		}
	}
	detail := fmt.Sprintf("descriptors set=%d planned=%d present=%d failed=%d", set, planned, present, failed)
	switch rec.Status {
	case "attached":
		return "attached tx " + rec.AttachTxID + " (" + detail + ")"
	case "planned":
		return "planned — " + rec.Reason + " (" + detail + ")"
	case "skipped-existing":
		return "attach skipped — already on engine (" + detail + ")"
	case "not-ready":
		return "NOT-READY — " + rec.Reason
	default:
		return "FAILED — " + rec.Reason + " (" + detail + ")"
	}
}

// ---------------------------------------------------------------------
// Summary + reconciliation
// ---------------------------------------------------------------------

func atgRecomputeSummary(report *atgReport) {
	summary := atgSummary{ManifestTotal: len(report.Apps)}
	var txCount int64
	for _, rec := range report.Apps {
		switch rec.Status {
		case "invalid":
			summary.Invalid++
		case "attached":
			summary.Attached++
		case "skipped-existing":
			summary.SkippedExisting++
		case "planned":
			summary.Planned++
		case "not-ready":
			summary.NotReady++
		case "failed":
			summary.Failed++
		}
		if rec.Status == "attached" || rec.Status == "planned" {
			txCount++ // the attach itself
		}
		for _, d := range rec.Descriptors {
			switch d.Status {
			case "set":
				summary.DescriptorsSet++
				txCount++
			case "planned":
				summary.DescriptorsPlanned++
				txCount++
			case "skipped-present":
				summary.DescriptorsSkippedPresent++
			case "failed":
				summary.DescriptorsFailed++
			}
		}
	}
	summary.EstimatedTxFeesGas = atgFormatGas(txCount * atgPerTxFeeEstimateFractions)
	report.Summary = summary
}

func atgPrintReconciliation(report atgReport) {
	s := report.Summary
	fmt.Println()
	fmt.Println("RECONCILIATION")
	fmt.Println("==============")
	fmt.Printf("Manifest:                 %s\n", report.ManifestPath)
	fmt.Printf("Engine:                   %q on registry %s (active: %t)\n", report.EngineID, report.PlatformRegistry, report.EngineActive)
	fmt.Printf("Manifest apps:            %d\n", s.ManifestTotal)
	fmt.Printf("Invalid appIds:           %d (excluded — would FAULT on-chain)\n", s.Invalid)
	fmt.Printf("Already attached:         %d\n", s.SkippedExisting)
	if report.DryRun {
		fmt.Printf("Planned attaches:         %d (dry-run — nothing written)\n", s.Planned)
	} else {
		fmt.Printf("Newly attached:           %d\n", s.Attached)
	}
	fmt.Printf("Not-ready (gated):        %d\n", s.NotReady)
	fmt.Printf("Failed:                   %d\n", s.Failed)
	fmt.Printf("Descriptors at target:    %d\n", s.DescriptorsSkippedPresent)
	if report.DryRun {
		fmt.Printf("Descriptors planned:      %d (dry-run)\n", s.DescriptorsPlanned)
	} else {
		fmt.Printf("Descriptors set:          %d\n", s.DescriptorsSet)
	}
	fmt.Printf("Descriptors failed:       %d\n", s.DescriptorsFailed)
}

// ---------------------------------------------------------------------
// Chain helpers (mirrors of the register_apps_on_platform_registry.go idioms)
// ---------------------------------------------------------------------

func atgResolveRegistryHash(client *rpcclient.Client, network string) (util.Uint160, error) {
	networkName := strings.ToUpper(strings.ReplaceAll(network, "-", "_"))
	for _, key := range []string{"PLATFORM_REGISTRY_" + networkName + "_HASH", "PLATFORM_REGISTRY_HASH"} {
		if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
			return atgParseHash(raw)
		}
	}
	if hash, source, ok := atgRegistryHashFromReports(network); ok {
		if _, err := client.GetContractStateByHash(hash); err == nil {
			fmt.Printf("resolved PlatformRegistry 0x%s from %s\n", hash.StringLE(), source)
			return hash, nil
		} else {
			return util.Uint160{}, fmt.Errorf("PlatformRegistry 0x%s (from %s) not found on-chain: %w", hash.StringLE(), source, err)
		}
	}
	return util.Uint160{}, fmt.Errorf("PlatformRegistry hash not configured: set PLATFORM_REGISTRY_%s_HASH or deploy first (deploy_platform_registry.go records deploy/config/platform-registry-%s-*.json)", networkName, network)
}

// atgPreviousReport is the subset of the deploy script's JSON reports that
// this script consumes for registry hash resolution.
type atgPreviousReport struct {
	PlatformRegistry string `json:"platform_registry"`
}

// atgReportCandidates returns the deploy reports for a network, newest first
// (the date-stamped names sort chronologically).
func atgReportCandidates(network string) []string {
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

func atgRegistryHashFromReports(network string) (util.Uint160, string, bool) {
	for _, path := range atgReportCandidates(network) {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var previous atgPreviousReport
		if err := json.Unmarshal(data, &previous); err != nil {
			continue
		}
		if strings.TrimSpace(previous.PlatformRegistry) == "" {
			continue
		}
		hash, err := atgParseHash(previous.PlatformRegistry)
		if err != nil {
			continue
		}
		return hash, path, true
	}
	return util.Uint160{}, "", false
}

func atgSendAndWait(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contract util.Uint160, method string, report *atgReport, label string, params ...any) (util.Uint256, *result.ApplicationLog, error) {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return util.Uint256{}, nil, fmt.Errorf("%s (%s): %w", label, method, err)
	}
	report.Transactions = append(report.Transactions, atgTxRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	appLog, err := atgWaitForTx(ctx, client, txid)
	if err != nil {
		return txid, nil, err
	}
	return txid, appLog, nil
}

func atgWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) (*result.ApplicationLog, error) {
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

func atgCallHALT(act *actor.Actor, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func atgCallInteger(act *actor.Actor, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := atgCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	return inv.Stack[0].TryInteger()
}

func atgStackValues(inv *result.Invoke) []interface{} {
	out := []interface{}{}
	if len(inv.Stack) == 0 {
		return out
	}
	items, ok := inv.Stack[0].Value().([]stackitem.Item)
	if !ok {
		return append(out, atgStackValue(inv.Stack[0]))
	}
	for _, item := range items {
		out = append(out, atgStackValue(item))
	}
	return out
}

func atgStackValue(item stackitem.Item) interface{} {
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

func atgSignerBalances(client *rpcclient.Client, signer util.Uint160) (int64, int64, error) {
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
		case atgNeoHashLE:
			neo = amount
		case atgGasHashLE:
			gas = amount
		}
	}
	return neo, gas, nil
}

// ---------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------

func atgParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func atgReportPath(network string) string {
	if raw := strings.TrimSpace(os.Getenv("PLATFORM_REGISTRY_ATTACH_REPORT_PATH")); raw != "" {
		return raw
	}
	return filepath.Join("deploy", "config", fmt.Sprintf("engine-attach-%s-%s.json", network, time.Now().UTC().Format("2006-01-02")))
}

func atgWriteReport(path string, report atgReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, append(out, '\n'), 0644)
}

func atgFormatGas(fractions int64) string {
	return strconv.FormatFloat(float64(fractions)/atgGasFractionsPerGas, 'f', 8, 64)
}

func atgFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func atgTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
