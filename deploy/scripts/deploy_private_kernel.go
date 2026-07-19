//go:build scripts

// Deploy a PRIVATE MorpheusOracle kernel (MiniApp-OS kernel built from the
// current neo-morpheus-oracle source) on N3 testnet and wire the platform's
// game.session lane end to end.
//
// Why private: the shared testnet kernel 0xf54d8584ef82315c1800373272ab08ae0db2d5ef
// is administered by a key this program does not control and its deployed uc1
// build lacks the rich 8-arg onMiniAppResult dispatch. A private kernel
// (deployer = admin = updater = fee payer = runtime verifier) gives the
// platform's PlatformGame a full game.session loop under our own keys.
//
// Lifecycle (PRIVATE_KERNEL_ACTION):
//
//	deploy   (default) deploy the kernel artifacts (idempotent by predicted
//	         hash) and assert admin() == signer.
//	wire     set the runtime verification key (PRIVATE_KERNEL_VERIFIER_WIF),
//	         set updater = signer, register the game.session system module,
//	         register + grant each appId (PRIVATE_KERNEL_APP_IDS) with
//	         callbackContract = PlatformGame, top up kernel fee credit, then
//	         point PlatformGame.setOracle at the private kernel (read-back
//	         asserted). Every step is idempotent and safe to re-run.
//	fulfill  worker-simulator: rebuild the fulfillment digest EXACTLY as the
//	         kernel's ComputeFulfillmentDigest (MorpheusOracle.Fulfillment.cs)
//	         does, sign secp256r1SHA256 with the verifier WIF, and submit
//	         FulfillRequest for a pending kernel request.
//	verify   read-only state dump (admin, updater, verifier, module, apps,
//	         credit, PlatformGame oracle binding).
//
// Safety:
//   - Dry-run is the DEFAULT: PRIVATE_KERNEL_DEPLOY_DRY_RUN unset means dry.
//     Set it explicitly to 0/false AND CONFIRM_PRIVATE_KERNEL=
//     I_UNDERSTAND_THIS_WRITES_CHAIN for chain writes.
//   - Network magic is asserted before any write (testnet 894710606).
//   - deploy skips when the predicted contract hash already exists on-chain;
//     wire skips every step that is already in the target state; fulfill
//     refuses non-pending requests and (on success) non-79-byte results.
//   - The fulfillment digest builder is self-tested against two golden
//     vectors (one pinned by the morpheus repo's own C#/JS parity tests, one
//     with an asymmetric script hash to catch byte-order drift) before ANY
//     network access, on every action.
//
// Key environment:
//
//	PRIVATE_KERNEL_ACTION                deploy|wire|fulfill|verify (default deploy)
//	PRIVATE_KERNEL_DEPLOY_DRY_RUN        default dry when unset
//	CONFIRM_PRIVATE_KERNEL               I_UNDERSTAND_THIS_WRITES_CHAIN
//	NEO_TESTNET_WIF / FLAGSHIP_TESTNET_WIF  signer WIF (deployer / admin / updater / fee payer)
//	NEO_TESTNET_RPC_URL / NEO_RPC_URL    RPC endpoint (default https://testnet1.neo.coz.io:443)
//	PRIVATE_KERNEL_NEF_PATH              kernel NEF (default ../neo-morpheus-oracle/contracts/__tests__/Generated/MorpheusOracle.nef)
//	PRIVATE_KERNEL_MANIFEST_PATH         kernel manifest (default .../MorpheusOracle.manifest.json)
//	PRIVATE_KERNEL_TESTNET_HASH          deployed kernel hash override for wire/fulfill/verify
//	                                     (fallback: newest private-kernel-testnet report, then predicted hash)
//	PRIVATE_KERNEL_VERIFIER_WIF          runtime fulfillment verifier WIF (wire + fulfill; pubkey derived from it)
//	PRIVATE_KERNEL_MODULE_ID             system module id (default game.session)
//	PRIVATE_KERNEL_MODULE_ENDPOINT       module endpoint row value (default /session/finalize)
//	PRIVATE_KERNEL_MODULE_SCHEMA         module schema hash row value (default morpheus.module.game.session.v1)
//	PRIVATE_KERNEL_APP_IDS               csv of appIds to register + grant (default smoketest-1784285342)
//	PRIVATE_KERNEL_METADATA_URI          miniapp metadata uri (default empty)
//	PRIVATE_KERNEL_METADATA_HASH         miniapp metadata hash (default empty)
//	PRIVATE_KERNEL_FEE_CREDIT_GAS        signer fee-credit floor on the kernel (default 5)
//	PLATFORM_GAME_TESTNET_HASH / PLATFORM_GAME_HASH  PlatformGame override
//	                                     (default testnet 0xc75b181b4561462903bb27d8d9e0b32b637bec12)
//	PRIVATE_KERNEL_FULFILL_REQUEST_ID    kernel request id to fulfill (fulfill action)
//	PRIVATE_KERNEL_FULFILL_RESULT_HEX    79-byte game.session result codec, hex (fulfill action)
//	PRIVATE_KERNEL_FULFILL_SUCCESS       success flag (default true)
//	PRIVATE_KERNEL_FULFILL_ERROR         error string (default empty)
//	PRIVATE_KERNEL_MIN_GAS               signer GAS floor (default 15 deploy / 7 wire / 1 fulfill)
//	PRIVATE_KERNEL_DEPLOY_REPORT_PATH    report output override
package main

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
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
	pkConfirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN"
	pkTestnetMagic  = uint32(894710606)

	pkDefaultTestnetRPC = "https://testnet1.neo.coz.io:443"

	pkGasHashLE = "0xd2a4cff31913016155e38e474a2c06d08be276cf"
	pkNeoHashLE = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"

	// Kernel artifacts live in the sibling neo-morpheus-oracle repo (current
	// source build, NOT the retired uc1 kernel). Paths are relative to this
	// repo's root, the same CWD convention as deploy_platform_registry.go.
	pkDefaultKernelNEFPath      = "../neo-morpheus-oracle/contracts/__tests__/Generated/MorpheusOracle.nef"
	pkDefaultKernelManifestPath = "../neo-morpheus-oracle/contracts/__tests__/Generated/MorpheusOracle.manifest.json"

	// Kernel-side bounds mirrored from contracts/MorpheusOracle:
	// MAX_APP_ID_LENGTH / MAX_MODULE_ID_LENGTH (MorpheusOracle.cs:147-148),
	// ValidateModuleDefinition endpoint/schema caps (MorpheusOracle.Storage.cs:75-80).
	pkMaxIdentifierLength = 64
	pkMaxMetadataURILen   = 256
	pkMaxMetadataHashLen  = 128

	// game.session lane constants. The operation/result codec mirror
	// PlatformGame.RewardGame.cs (RG_MODULE_ID) and
	// PlatformGame.RewardGame.Settle.cs (RG_OP_FINALIZE, ParseRewardResult).
	pkDefaultModuleID       = "game.session"
	pkDefaultModuleEndpoint = "/session/finalize"
	pkDefaultModuleSchema   = "morpheus.module.game.session.v1"
	pkFulfillResultLength   = 79

	pkDefaultAppIDs        = "smoketest-1784285342"
	pkDefaultFeeCreditGas  = 5.0
	pkDefaultMinGasDeploy  = 15.0
	pkDefaultMinGasWire    = 7.0 // fee-credit floor (5) + ~8 write txs
	pkDefaultMinGasFulfill = 1.0

	pkTestnetPlatformGameHash  = "0xc75b181b4561462903bb27d8d9e0b32b637bec12"
	pkGasFractionsPerGas       = float64(100_000_000)
	pkTestnetFaucetInstruction = "fund it from the Neo N3 testnet faucet (https://neowish.ngd.network/) or transfer GAS from another testnet account"

	// Fulfillment signing domain, mirrored byte-for-byte from
	// FULFILLMENT_SIGNATURE_DOMAIN (MorpheusOracle.cs:145) = ASCII
	// "miniapp-os-fulfillment-v1".
	pkFulfillmentDomain = "miniapp-os-fulfillment-v1"

	// Golden vectors pinning the digest builder. The first is the canonical
	// cross-language vector asserted by the morpheus repo itself
	// (contracts/__tests__/MorpheusOracleGoldenDigestTests.cs and the relayer
	// JS golden-vector test). The second uses an ASYMMETRIC script hash and
	// was produced with the relayer's own buildFulfillmentDigestBytes
	// (workers/morpheus-relayer/src/router.js) to pin the script-hash byte
	// order that the symmetric 0x12 vector cannot catch.
	pkGoldenVector1Digest     = "cf2832f7e5ab9a37a6c93907be5d7762d7b6c62c256363df432adc7b2fb2192e"
	pkGoldenVector1Scripthash = "0x1212121212121212121212121212121212121212"
	pkGoldenVector2Digest     = "cf8c697bdc4e0d144249a86ddf78b0bdc7657219730a9d233e4dad9403fe0602"
	pkGoldenVector2Scripthash = "0x000102030405060708090a0b0c0d0e0f10111213"
)

var pkAppIDPattern = regexp.MustCompile(`^[a-z0-9\-_.]{1,64}$`)

type pkReport struct {
	Action         string                 `json:"action"`
	Network        string                 `json:"network"`
	RPCURL         string                 `json:"rpc_url"`
	NetworkMagic   uint32                 `json:"network_magic"`
	Signer         string                 `json:"signer"`
	SignerHash     string                 `json:"signer_hash"`
	DryRun         bool                   `json:"dry_run"`
	PrivateKernel  string                 `json:"private_kernel"`
	PlatformGame   string                 `json:"platform_game,omitempty"`
	PredictedHash  string                 `json:"predicted_hash,omitempty"`
	SkippedReason  string                 `json:"skipped_reason,omitempty"`
	Balances       map[string]string      `json:"balances"`
	Transactions   []pkTxRecord           `json:"transactions"`
	Wire           *pkWireRecord          `json:"wire,omitempty"`
	Fulfill        *pkFulfillRecord       `json:"fulfill,omitempty"`
	Validation     map[string]interface{} `json:"validation"`
	NextSteps      []string               `json:"next_steps"`
	GeneratedAtUTC string                 `json:"generated_at_utc"`
}

type pkTxRecord struct {
	Label string `json:"label"`
	TxID  string `json:"txid"`
	VUB   uint32 `json:"valid_until_block,omitempty"`
}

type pkStepRecord struct {
	Name   string `json:"name"`
	Status string `json:"status"` // done | simulated | skipped
	Note   string `json:"note,omitempty"`
}

type pkWireRecord struct {
	VerifierPublicKey string         `json:"verifier_public_key,omitempty"`
	Updater           string         `json:"updater,omitempty"`
	ModuleID          string         `json:"module_id"`
	AppIDs            []string       `json:"app_ids"`
	FeeCreditTarget   string         `json:"fee_credit_target_gas,omitempty"`
	FeeCreditBefore   string         `json:"fee_credit_before,omitempty"`
	FeeCreditAfter    string         `json:"fee_credit_after,omitempty"`
	OracleBefore      string         `json:"platform_game_oracle_before,omitempty"`
	OracleAfter       string         `json:"platform_game_oracle_after,omitempty"`
	Steps             []pkStepRecord `json:"steps"`
}

type pkFulfillRecord struct {
	RequestID    string `json:"request_id"`
	AppID        string `json:"app_id,omitempty"`
	ModuleID     string `json:"module_id,omitempty"`
	Operation    string `json:"operation,omitempty"`
	Success      bool   `json:"success"`
	ResultLength int    `json:"result_length"`
	Error        string `json:"error,omitempty"`
	DigestHex    string `json:"digest_hex,omitempty"`
	SignatureHex string `json:"signature_hex,omitempty"`
	TxID         string `json:"txid,omitempty"`
	StatusAfter  string `json:"status_after,omitempty"`
	SimulateNote string `json:"simulate_note,omitempty"`
}

// pkKernelRequest is the subset of the kernel's KernelRequest struct
// (MorpheusOracle.cs:192-212) the fulfill lane needs: array indices
// 0 Id, 1 AppId, 2 ModuleId, 3 Operation, 8 Status.
type pkKernelRequest struct {
	ID        *big.Int
	AppID     string
	ModuleID  string
	Operation string
	Status    int64
}

func main() {
	if err := pkRun(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func pkRun() error {
	// Digest self-test first: a drifted builder must fail before any network
	// access, on every action (it would otherwise strand requests on-chain).
	if err := pkDigestSelfTest(); err != nil {
		return err
	}

	action := strings.ToLower(pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_ACTION"), "deploy"))
	switch action {
	case "deploy", "wire", "fulfill", "verify", "update":
	default:
		return fmt.Errorf("unsupported PRIVATE_KERNEL_ACTION=%q (deploy|wire|fulfill|verify|update)", action)
	}

	// Safest convention: dry-run unless PRIVATE_KERNEL_DEPLOY_DRY_RUN is
	// explicitly set to a falsy value. verify never writes chain, so it is
	// exempt from the confirm gate.
	dryRun := true
	if raw, ok := os.LookupEnv("PRIVATE_KERNEL_DEPLOY_DRY_RUN"); ok {
		dryRun = pkTruthy(raw)
	}
	if action == "verify" {
		dryRun = true
	}
	if !dryRun && os.Getenv("CONFIRM_PRIVATE_KERNEL") != pkConfirmPhrase {
		return fmt.Errorf("set CONFIRM_PRIVATE_KERNEL=%s to write chain", pkConfirmPhrase)
	}
	if dryRun && action != "verify" && os.Getenv("CONFIRM_PRIVATE_KERNEL") == pkConfirmPhrase {
		fmt.Println("note: confirm phrase is set but PRIVATE_KERNEL_DEPLOY_DRY_RUN is not explicitly false; staying in dry-run")
	}

	expectedMagic, networkID, rpcURL, wif, err := pkNetworkConfig()
	if err != nil {
		return err
	}
	if wif == "" {
		return fmt.Errorf("testnet signer WIF is not configured (set NEO_TESTNET_WIF)")
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
		return fmt.Errorf("RPC network magic mismatch: got %d, expected %d for testnet", actualMagic, expectedMagic)
	}

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("invalid testnet signer WIF")
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

	neoBalance, gasBalance, err := pkSignerBalances(client, signerHash)
	if err != nil {
		return fmt.Errorf("read signer balances: %w", err)
	}
	mode := "write"
	if dryRun {
		mode = "dry-run"
	}
	fmt.Printf("Action: %s\n", action)
	fmt.Printf("Signer: %s\n", acc.Address)
	fmt.Printf("Network: %s (magic %d)\n", networkID, actualMagic)
	fmt.Printf("Mode: %s\n", mode)
	fmt.Printf("Balances: %d NEO, %s GAS\n\n", neoBalance, pkFormatGas(gasBalance))

	minGas := pkMinGasThreshold(action)
	if minGas > 0 && float64(gasBalance)/pkGasFractionsPerGas < minGas {
		message := fmt.Sprintf("insufficient GAS: signer %s holds %s GAS, action %q requires at least %.8g GAS "+
			"(deploy system fee + wiring txs + fee-credit deposit; tune with PRIVATE_KERNEL_MIN_GAS). "+
			"To continue, %s.",
			acc.Address, pkFormatGas(gasBalance), action, minGas, pkTestnetFaucetInstruction)
		if !dryRun {
			return fmt.Errorf("%s", message)
		}
		fmt.Println("warning: " + message)
	}

	report := pkReport{
		Action:         action,
		Network:        networkID,
		RPCURL:         rpcURL,
		NetworkMagic:   actualMagic,
		Signer:         acc.Address,
		SignerHash:     "0x" + signerHash.StringLE(),
		DryRun:         dryRun,
		Balances:       map[string]string{"neo": strconv.FormatInt(neoBalance, 10), "gas": pkFormatGas(gasBalance)},
		Transactions:   []pkTxRecord{},
		Validation:     map[string]interface{}{},
		NextSteps:      []string{},
		GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
	}

	var kernelHash util.Uint160
	switch action {
	case "deploy":
		kernelHash, err = pkActionDeploy(ctx, client, act, signerHash, dryRun, &report)
	case "wire":
		kernelHash, err = pkResolveKernelHash(client, signerHash)
		if err == nil {
			err = pkActionWire(ctx, client, act, kernelHash, signerHash, dryRun, &report)
		}
	case "fulfill":
		kernelHash, err = pkResolveKernelHash(client, signerHash)
		if err == nil {
			err = pkActionFulfill(ctx, client, act, kernelHash, signerHash, actualMagic, dryRun, &report)
		}
	case "verify":
		kernelHash, err = pkResolveKernelHash(client, signerHash)
		if err == nil {
			err = pkActionVerify(act, kernelHash, signerHash, &report)
		}
	case "update":
		kernelHash, err = pkResolveKernelHash(client, signerHash)
		if err == nil {
			err = pkActionUpdate(ctx, client, act, kernelHash, signerHash, dryRun, &report)
		}
	}
	if err != nil {
		return err
	}
	report.PrivateKernel = "0x" + kernelHash.StringLE()

	reportPath := pkReportPath()
	if err := pkWriteReport(reportPath, report); err != nil {
		return err
	}
	out, _ := json.MarshalIndent(report, "", "  ")
	fmt.Println(string(out))
	fmt.Printf("\nSaved: %s\n", reportPath)
	pkPrintNextSteps(report)
	return nil
}

// pkNetworkConfig is fixed to N3 testnet: the private kernel lane exists to
// validate the platform's game.session loop where we control every key.
func pkNetworkConfig() (uint32, string, string, string, error) {
	return pkTestnetMagic,
		"neo-n3-testnet",
		pkFirstNonEmpty(os.Getenv("NEO_TESTNET_RPC_URL"), os.Getenv("NEO_RPC_URL"), pkDefaultTestnetRPC),
		pkFirstNonEmpty(os.Getenv("NEO_TESTNET_WIF"), os.Getenv("FLAGSHIP_TESTNET_WIF")),
		nil
}

// ---------------------------------------------------------------------
// Action: deploy
// ---------------------------------------------------------------------

func pkActionDeploy(ctx context.Context, client *rpcclient.Client, act *actor.Actor, signerHash util.Uint160, dryRun bool, report *pkReport) (util.Uint160, error) {
	nefFile, mani, err := pkLoadKernelArtifacts(report)
	if err != nil {
		return util.Uint160{}, err
	}
	predicted := state.CreateContractHash(signerHash, nefFile.Checksum, mani.Name)
	report.PredictedHash = "0x" + predicted.StringLE()
	fmt.Printf("MorpheusOracle predicted hash: 0x%s\n", predicted.StringLE())

	if _, err := client.GetContractStateByHash(predicted); err == nil {
		fmt.Println("already deployed at predicted hash; reusing")
		report.Validation["kernel_deploy_skipped"] = "already deployed"
	} else if dryRun {
		report.SkippedReason = "dry run: MorpheusOracle kernel deployment is eligible"
		report.NextSteps = append(report.NextSteps,
			"Re-run with PRIVATE_KERNEL_DEPLOY_DRY_RUN=false CONFIRM_PRIVATE_KERNEL="+pkConfirmPhrase+" to write chain, then PRIVATE_KERNEL_ACTION=wire.")
		return predicted, nil
	} else {
		txid, vub, err := management.New(act).Deploy(nefFile, mani, nil)
		if err != nil {
			return util.Uint160{}, fmt.Errorf("deploy MorpheusOracle: %w", err)
		}
		report.Transactions = append(report.Transactions, pkTxRecord{Label: "Deploy MorpheusOracle kernel", TxID: "0x" + txid.StringLE(), VUB: vub})
		fmt.Printf("deploy tx: 0x%s (vub: %d)\n", txid.StringLE(), vub)
		if _, err := pkWaitForTx(ctx, client, txid); err != nil {
			return util.Uint160{}, fmt.Errorf("wait deploy MorpheusOracle: %w", err)
		}
		if _, err := client.GetContractStateByHash(predicted); err != nil {
			return util.Uint160{}, fmt.Errorf("MorpheusOracle not found at predicted hash after deploy: %w", err)
		}
	}

	admin, err := pkCallUint160(act, predicted, "admin")
	if err != nil {
		return util.Uint160{}, fmt.Errorf("read kernel admin: %w", err)
	}
	report.Validation["admin"] = "0x" + admin.StringLE()
	report.Validation["admin_matches_signer"] = admin == signerHash
	if admin != signerHash {
		return util.Uint160{}, fmt.Errorf("deployed kernel admin 0x%s is not the current signer", admin.StringLE())
	}
	report.NextSteps = append(report.NextSteps,
		"Wire the game.session lane: PRIVATE_KERNEL_ACTION=wire PRIVATE_KERNEL_VERIFIER_WIF=<verifier wif> (same dry-run/confirm gates).")
	return predicted, nil
}

// ---------------------------------------------------------------------
// Action: update (in-place NEF update of the private kernel)
// ---------------------------------------------------------------------

// pkActionUpdate pushes the current-source kernel build (pkLoadKernelArtifacts)
// onto the already-deployed private kernel via its admin-gated update method
// (MorpheusOracle.cs: Update(nef, manifest), hash preserved across Update).
// Used to land the same-operator callback-sharing fix on testnet.
func pkActionUpdate(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, signerHash util.Uint160, dryRun bool, report *pkReport) error {
	nefFile, mani, err := pkLoadKernelArtifacts(report)
	if err != nil {
		return err
	}
	nefPath := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_NEF_PATH"), pkDefaultKernelNEFPath)
	manifestPath := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_MANIFEST_PATH"), pkDefaultKernelManifestPath)
	nefBytes, err := os.ReadFile(nefPath)
	if err != nil {
		return fmt.Errorf("read kernel nef bytes %s: %w", nefPath, err)
	}
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("read kernel manifest bytes %s: %w", manifestPath, err)
	}
	_ = nefFile
	_ = mani

	admin, err := pkCallUint160(act, kernel, "admin")
	if err != nil {
		return fmt.Errorf("read kernel admin: %w", err)
	}
	report.Validation["admin_matches_signer"] = admin == signerHash
	if admin != signerHash {
		return fmt.Errorf("kernel admin 0x%s is not the current signer", admin.StringLE())
	}
	before, err := client.GetContractStateByHash(kernel)
	if err != nil {
		return fmt.Errorf("read kernel state: %w", err)
	}
	report.Validation["update_counter_before"] = before.UpdateCounter
	report.Validation["nef_bytes"] = len(nefBytes)

	if dryRun {
		res, err := act.Call(kernel, "update", nefBytes, string(manifestBytes))
		if err != nil {
			return fmt.Errorf("test-invoke update: %w", err)
		}
		report.Validation["test_invoke_state"] = res.State
		report.Validation["test_invoke_exception"] = res.FaultException
		report.NextSteps = append(report.NextSteps,
			"Re-run with PRIVATE_KERNEL_DEPLOY_DRY_RUN=false CONFIRM_PRIVATE_KERNEL="+pkConfirmPhrase+" to send the update.")
		return nil
	}

	txid, vub, err := act.SendCall(kernel, "update", nefBytes, string(manifestBytes))
	if err != nil {
		return fmt.Errorf("send kernel update: %w", err)
	}
	report.Transactions = append(report.Transactions, pkTxRecord{Label: "Update private kernel NEF", TxID: "0x" + txid.StringLE(), VUB: vub})
	fmt.Printf("update tx: 0x%s (vub: %d)\n", txid.StringLE(), vub)
	if _, err := pkWaitForTx(ctx, client, txid); err != nil {
		return fmt.Errorf("wait kernel update: %w", err)
	}
	after, err := client.GetContractStateByHash(kernel)
	if err != nil {
		return fmt.Errorf("read kernel state after update: %w", err)
	}
	report.Validation["update_counter_after"] = after.UpdateCounter
	if after.UpdateCounter != before.UpdateCounter+1 {
		return fmt.Errorf("update counter did not increment: before %d after %d", before.UpdateCounter, after.UpdateCounter)
	}
	report.NextSteps = append(report.NextSteps,
		"Kernel updated in place (hash preserved). Re-run PRIVATE_KERNEL_ACTION=wire for any appIds not yet registered, then PRIVATE_KERNEL_ACTION=verify.")
	return nil
}

// pkLoadKernelArtifacts loads the sibling-repo kernel build and asserts it is
// the current-source kernel (the rich fulfill/register ABI), not the retired
// uc1 build or an unrelated artifact.
func pkLoadKernelArtifacts(report *pkReport) (*nef.File, *manifest.Manifest, error) {
	nefPath := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_NEF_PATH"), pkDefaultKernelNEFPath)
	manifestPath := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_MANIFEST_PATH"), pkDefaultKernelManifestPath)
	nefFile, err := pkLoadNEF(nefPath)
	if err != nil {
		return nil, nil, fmt.Errorf("read kernel nef %s: %w", nefPath, err)
	}
	mani, err := pkLoadManifest(manifestPath)
	if err != nil {
		return nil, nil, fmt.Errorf("read kernel manifest %s: %w", manifestPath, err)
	}
	report.Validation["kernel_nef_path"] = nefPath
	report.Validation["kernel_manifest_path"] = manifestPath
	report.Validation["kernel_nef_checksum"] = nefFile.Checksum
	report.Validation["kernel_manifest_name"] = mani.Name
	methods := map[string]bool{}
	for _, m := range mani.ABI.Methods {
		methods[m.Name] = true
	}
	for _, required := range []string{"fulfillRequest", "registerMiniApp", "registerSystemModule", "setRuntimeVerificationPublicKey", "grantModuleToMiniApp"} {
		if !methods[required] {
			return nil, nil, fmt.Errorf("kernel manifest %s lacks method %q: this is not the current-source MorpheusOracle build (regenerate the artifacts in the neo-morpheus-oracle repo)", manifestPath, required)
		}
	}
	report.Validation["kernel_abi_method_count"] = len(mani.ABI.Methods)
	return nefFile, mani, nil
}

// ---------------------------------------------------------------------
// Action: wire
// ---------------------------------------------------------------------

func pkActionWire(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, signerHash util.Uint160, dryRun bool, report *pkReport) error {
	if _, err := client.GetContractStateByHash(kernel); err != nil {
		return fmt.Errorf("kernel contract 0x%s not found on-chain: %w", kernel.StringLE(), err)
	}
	admin, err := pkCallUint160(act, kernel, "admin")
	if err != nil {
		return fmt.Errorf("read kernel admin: %w", err)
	}
	report.Validation["kernel_admin"] = "0x" + admin.StringLE()
	if admin != signerHash {
		return fmt.Errorf("kernel admin 0x%s is not the current signer; wire is an admin lane", admin.StringLE())
	}

	record := &pkWireRecord{Steps: []pkStepRecord{}}
	report.Wire = record

	if err := pkWireVerifier(ctx, client, act, kernel, dryRun, report, record); err != nil {
		return err
	}
	if err := pkWireUpdater(ctx, client, act, kernel, signerHash, dryRun, report, record); err != nil {
		return err
	}
	moduleID, err := pkWireModule(ctx, client, act, kernel, dryRun, report, record)
	if err != nil {
		return err
	}
	if err := pkWireApps(ctx, client, act, kernel, moduleID, signerHash, dryRun, report, record); err != nil {
		return err
	}
	if err := pkWireFeeCredit(ctx, client, act, kernel, signerHash, dryRun, report, record); err != nil {
		return err
	}
	if err := pkWirePlatformGame(ctx, client, act, kernel, signerHash, dryRun, report, record); err != nil {
		return err
	}

	report.NextSteps = append(report.NextSteps,
		"Lane is wired. Drive a real loop: start/finalize a RewardGame on PlatformGame (finalizeGame submits the kernel request), then fulfill it with PRIVATE_KERNEL_ACTION=fulfill PRIVATE_KERNEL_FULFILL_REQUEST_ID=<id> PRIVATE_KERNEL_FULFILL_RESULT_HEX=<79-byte codec>.",
		"Read-only state check at any time: PRIVATE_KERNEL_ACTION=verify.")
	return nil
}

// pkWireVerifier pins the runtime fulfillment verifier key. The kernel's
// FulfillRequest asserts the signature against RuntimeVerificationPublicKey()
// (MorpheusOracle.cs:1118-1135), so wire requires the verifier WIF up front.
func pkWireVerifier(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, dryRun bool, report *pkReport, record *pkWireRecord) error {
	verifierWIF := strings.TrimSpace(os.Getenv("PRIVATE_KERNEL_VERIFIER_WIF"))
	if verifierWIF == "" {
		return fmt.Errorf("PRIVATE_KERNEL_VERIFIER_WIF is not set: the wire action pins the runtime fulfillment verifier (generate a fresh secp256r1 key and keep the WIF; fulfill signs with it)")
	}
	verifier, err := keys.NewPrivateKeyFromWIF(verifierWIF)
	if err != nil {
		return fmt.Errorf("invalid PRIVATE_KERNEL_VERIFIER_WIF")
	}
	pubBytes := verifier.PublicKey().Bytes()
	record.VerifierPublicKey = hex.EncodeToString(pubBytes)
	report.Validation["verifier_address"] = verifier.Address()

	current, err := pkCallVerifierKey(act, kernel)
	if err != nil {
		return fmt.Errorf("read runtimeVerificationPublicKey: %w", err)
	}
	if len(current) == len(pubBytes) && string(current) == string(pubBytes) {
		record.Steps = append(record.Steps, pkStepRecord{Name: "verifier-key", Status: "skipped", Note: "runtimeVerificationPublicKey already matches the verifier WIF"})
		fmt.Println("runtime verifier key already pinned; skipping")
		return nil
	}
	if err := pkSimulate(act, kernel, "setRuntimeVerificationPublicKey", verifier.PublicKey()); err != nil {
		return err
	}
	if dryRun {
		record.Steps = append(record.Steps, pkStepRecord{Name: "verifier-key", Status: "simulated", Note: "setRuntimeVerificationPublicKey simulation HALT (eligible)"})
		fmt.Println("dry run: setRuntimeVerificationPublicKey simulation HALT (eligible)")
		return nil
	}
	txid, _, err := pkSendAndWait(ctx, client, act, kernel, "setRuntimeVerificationPublicKey", report, "Set runtime verifier key", verifier.PublicKey())
	if err != nil {
		return err
	}
	fmt.Printf("setRuntimeVerificationPublicKey tx: 0x%s\n", txid.StringLE())
	after, err := pkCallVerifierKey(act, kernel)
	if err != nil {
		return fmt.Errorf("read runtimeVerificationPublicKey after write: %w", err)
	}
	if len(after) != len(pubBytes) || string(after) != string(pubBytes) {
		return fmt.Errorf("runtimeVerificationPublicKey read-back does not match the verifier key")
	}
	record.Steps = append(record.Steps, pkStepRecord{Name: "verifier-key", Status: "done", Note: "pinned to the PRIVATE_KERNEL_VERIFIER_WIF pubkey"})
	return nil
}

// pkWireUpdater sets updater = signer. _deploy does NOT seed the updater
// (MorpheusOracle.cs:290-305) and FulfillRequest is updater-gated
// (ValidateUpdater, MorpheusOracle.Storage.cs:34-39), so without this step no
// fulfillment can land.
func pkWireUpdater(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, signerHash util.Uint160, dryRun bool, report *pkReport, record *pkWireRecord) error {
	current, note, err := pkReadUpdater(act, kernel)
	if err != nil {
		return err
	}
	if note != "" {
		report.Validation["updater_read_note"] = note
	}
	if current == signerHash {
		record.Updater = "0x" + current.StringLE()
		record.Steps = append(record.Steps, pkStepRecord{Name: "updater", Status: "skipped", Note: "updater already the signer"})
		fmt.Println("kernel updater already the signer; skipping")
		return nil
	}
	if err := pkSimulate(act, kernel, "setUpdater", signerHash); err != nil {
		return err
	}
	if dryRun {
		record.Steps = append(record.Steps, pkStepRecord{Name: "updater", Status: "simulated", Note: "setUpdater simulation HALT (eligible)"})
		fmt.Println("dry run: setUpdater simulation HALT (eligible)")
		return nil
	}
	txid, _, err := pkSendAndWait(ctx, client, act, kernel, "setUpdater", report, "Set kernel updater", signerHash)
	if err != nil {
		return err
	}
	fmt.Printf("setUpdater tx: 0x%s\n", txid.StringLE())
	after, _, err := pkReadUpdater(act, kernel)
	if err != nil {
		return err
	}
	if after != signerHash {
		return fmt.Errorf("updater() read-back 0x%s does not match the signer", after.StringLE())
	}
	record.Updater = "0x" + after.StringLE()
	record.Steps = append(record.Steps, pkStepRecord{Name: "updater", Status: "done", Note: "updater = signer (fulfill lane open)"})
	return nil
}

// pkWireModule registers the game.session system module idempotently
// (RegisterSystemModule reverts "module already exists", MorpheusOracle.cs:881-884).
func pkWireModule(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, dryRun bool, report *pkReport, record *pkWireRecord) (string, error) {
	moduleID := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_MODULE_ID"), pkDefaultModuleID)
	if !pkAppIDPattern.MatchString(moduleID) {
		return "", fmt.Errorf("invalid PRIVATE_KERNEL_MODULE_ID %q (charset [a-z0-9-_.], 1-64 chars)", moduleID)
	}
	endpoint := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_MODULE_ENDPOINT"), pkDefaultModuleEndpoint)
	schema := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_MODULE_SCHEMA"), pkDefaultModuleSchema)
	if len(endpoint) == 0 || len(endpoint) > pkMaxMetadataURILen {
		return "", fmt.Errorf("invalid PRIVATE_KERNEL_MODULE_ENDPOINT (kernel requires 1..%d chars)", pkMaxMetadataURILen)
	}
	if len(schema) == 0 || len(schema) > pkMaxMetadataHashLen {
		return "", fmt.Errorf("invalid PRIVATE_KERNEL_MODULE_SCHEMA (kernel requires 1..%d chars)", pkMaxMetadataHashLen)
	}
	record.ModuleID = moduleID
	report.Validation["module_endpoint"] = endpoint
	report.Validation["module_schema"] = schema

	row, err := pkCallRow(act, kernel, "getSystemModule", moduleID)
	if err != nil {
		return "", fmt.Errorf("read getSystemModule(%s): %w", moduleID, err)
	}
	if pkRowCreated(row) {
		report.Validation["module_row"] = row
		record.Steps = append(record.Steps, pkStepRecord{Name: "register-module", Status: "skipped", Note: fmt.Sprintf("module %q already registered: %v", moduleID, row)})
		fmt.Printf("module %q already registered: %v\n", moduleID, row)
		return moduleID, nil
	}
	if err := pkSimulate(act, kernel, "registerSystemModule", moduleID, endpoint, schema); err != nil {
		return "", err
	}
	if dryRun {
		record.Steps = append(record.Steps, pkStepRecord{Name: "register-module", Status: "simulated", Note: "registerSystemModule simulation HALT (eligible)"})
		fmt.Println("dry run: registerSystemModule simulation HALT (eligible)")
		return moduleID, nil
	}
	txid, _, err := pkSendAndWait(ctx, client, act, kernel, "registerSystemModule", report, "Register module "+moduleID, moduleID, endpoint, schema)
	if err != nil {
		return "", err
	}
	fmt.Printf("registerSystemModule tx: 0x%s\n", txid.StringLE())
	row, err = pkCallRow(act, kernel, "getSystemModule", moduleID)
	if err != nil || !pkRowCreated(row) {
		return "", fmt.Errorf("getSystemModule(%s) still empty after registration", moduleID)
	}
	report.Validation["module_row"] = row
	record.Steps = append(record.Steps, pkStepRecord{Name: "register-module", Status: "done", Note: fmt.Sprintf("module %q registered", moduleID)})
	return moduleID, nil
}

// pkWireApps registers each appId with callbackContract = PlatformGame and
// grants the module. RegisterMiniApp is NOT admin-gated but requires the
// appAdmin/Admin witness plus fee-payer authorization (MorpheusOracle.cs:898-909);
// the signer plays all three roles here.
func pkWireApps(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, moduleID string, signerHash util.Uint160, dryRun bool, report *pkReport, record *pkWireRecord) error {
	appIDs, err := pkParseAppIDs()
	if err != nil {
		return err
	}
	record.AppIDs = appIDs
	engineHash, engineSource, err := pkResolveEngineHash()
	if err != nil {
		return err
	}
	report.Validation["platform_game_hash"] = "0x" + engineHash.StringLE()
	report.Validation["platform_game_hash_source"] = engineSource
	report.PlatformGame = "0x" + engineHash.StringLE()
	metadataURI := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_METADATA_URI"), "")
	metadataHash := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_METADATA_HASH"), "")
	if len(metadataURI) > pkMaxMetadataURILen || len(metadataHash) > pkMaxMetadataHashLen {
		return fmt.Errorf("miniapp metadata exceeds kernel bounds (uri <= %d, hash <= %d)", pkMaxMetadataURILen, pkMaxMetadataHashLen)
	}

	for _, appID := range appIDs {
		if err := pkWireOneApp(ctx, client, act, kernel, moduleID, appID, engineHash, signerHash, metadataURI, metadataHash, dryRun, report, record); err != nil {
			return err
		}
	}
	return nil
}

func pkWireOneApp(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, moduleID string, appID string, engineHash util.Uint160, signerHash util.Uint160, metadataURI string, metadataHash string, dryRun bool, report *pkReport, record *pkWireRecord) error {
	row, err := pkCallRow(act, kernel, "getMiniApp", appID)
	if err != nil {
		return fmt.Errorf("read getMiniApp(%s): %w", appID, err)
	}
	if pkRowCreated(row) {
		report.Validation["miniapp_row_"+appID] = row
		record.Steps = append(record.Steps, pkStepRecord{Name: "register-app:" + appID, Status: "skipped", Note: fmt.Sprintf("already registered: %v", row)})
		fmt.Printf("miniapp %q already registered: %v\n", appID, row)
	} else {
		if err := pkSimulate(act, kernel, "registerMiniApp", appID, signerHash, signerHash, engineHash, metadataURI, metadataHash); err != nil {
			return err
		}
		if dryRun {
			record.Steps = append(record.Steps, pkStepRecord{Name: "register-app:" + appID, Status: "simulated", Note: "registerMiniApp simulation HALT (eligible)"})
			fmt.Printf("dry run: registerMiniApp(%s) simulation HALT (eligible)\n", appID)
		} else {
			txid, _, err := pkSendAndWait(ctx, client, act, kernel, "registerMiniApp", report, "Register miniapp "+appID, appID, signerHash, signerHash, engineHash, metadataURI, metadataHash)
			if err != nil {
				return err
			}
			fmt.Printf("registerMiniApp(%s) tx: 0x%s\n", appID, txid.StringLE())
			row, err = pkCallRow(act, kernel, "getMiniApp", appID)
			if err != nil || !pkRowCreated(row) {
				return fmt.Errorf("getMiniApp(%s) still empty after registration", appID)
			}
			report.Validation["miniapp_row_"+appID] = row
			record.Steps = append(record.Steps, pkStepRecord{Name: "register-app:" + appID, Status: "done", Note: "registered with callbackContract=PlatformGame, feePayer=signer"})
		}
	}

	granted, err := pkCallBool(act, kernel, "isModuleGrantedToMiniApp", appID, moduleID)
	if err != nil {
		return fmt.Errorf("read isModuleGrantedToMiniApp(%s): %w", appID, err)
	}
	if granted {
		record.Steps = append(record.Steps, pkStepRecord{Name: "grant-module:" + appID, Status: "skipped", Note: "module already granted"})
		fmt.Printf("module %q already granted to %q\n", moduleID, appID)
		return nil
	}
	if dryRun {
		// A simulated registerMiniApp leaves no state, so grant would fault on
		// "miniapp not found" even though the write run will succeed; record
		// eligibility instead of simulating.
		note := "grantModuleToMiniApp simulation HALT (eligible)"
		if !pkRowCreated(row) {
			note = "grant follows the (simulated) registration in write mode"
		} else if err := pkSimulate(act, kernel, "grantModuleToMiniApp", appID, moduleID); err != nil {
			return err
		}
		record.Steps = append(record.Steps, pkStepRecord{Name: "grant-module:" + appID, Status: "simulated", Note: note})
		fmt.Printf("dry run: grantModuleToMiniApp(%s) %s\n", appID, note)
		return nil
	}
	if err := pkSimulate(act, kernel, "grantModuleToMiniApp", appID, moduleID); err != nil {
		return err
	}
	txid, _, err := pkSendAndWait(ctx, client, act, kernel, "grantModuleToMiniApp", report, "Grant "+moduleID+" to "+appID, appID, moduleID)
	if err != nil {
		return err
	}
	fmt.Printf("grantModuleToMiniApp(%s) tx: 0x%s\n", appID, txid.StringLE())
	granted, err = pkCallBool(act, kernel, "isModuleGrantedToMiniApp", appID, moduleID)
	if err != nil || !granted {
		return fmt.Errorf("isModuleGrantedToMiniApp(%s) still false after grant", appID)
	}
	record.Steps = append(record.Steps, pkStepRecord{Name: "grant-module:" + appID, Status: "done", Note: "module granted"})
	return nil
}

// pkWireFeeCredit tops the signer's kernel fee credit up to the floor. The
// kernel's OnNEP17Payment credits ResolveCreditBeneficiary(from, data)
// (MorpheusOracle.Requests.cs:100-126): a nil memo credits the depositor
// itself, which is exactly the app fee payer lane wired above.
func pkWireFeeCredit(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, signerHash util.Uint160, dryRun bool, report *pkReport, record *pkWireRecord) error {
	target, err := pkGasFractionsEnv("PRIVATE_KERNEL_FEE_CREDIT_GAS", pkDefaultFeeCreditGas)
	if err != nil {
		return err
	}
	record.FeeCreditTarget = pkFormatGas(target)
	credit, err := pkCallInteger(act, kernel, "feeCreditOf", signerHash)
	if err != nil {
		return fmt.Errorf("read feeCreditOf(signer): %w", err)
	}
	record.FeeCreditBefore = pkFormatBigGas(credit)
	deficit := new(big.Int).Sub(big.NewInt(target), credit)
	if deficit.Sign() <= 0 {
		record.Steps = append(record.Steps, pkStepRecord{Name: "fee-credit", Status: "skipped", Note: fmt.Sprintf("feeCreditOf(signer) %s GAS already >= %s GAS target", pkFormatBigGas(credit), pkFormatGas(target))})
		fmt.Println("kernel fee credit floor already met; deposit skipped")
		return nil
	}
	gasHash, err := pkParseHash(pkGasHashLE)
	if err != nil {
		return err
	}
	amount := deficit.Int64()
	if err := pkSimulate(act, gasHash, "transfer", signerHash, kernel, amount, nil); err != nil {
		return err
	}
	if dryRun {
		record.Steps = append(record.Steps, pkStepRecord{Name: "fee-credit", Status: "simulated", Note: fmt.Sprintf("would deposit %s GAS with nil memo (credits the depositor = app fee payer)", pkFormatGas(amount))})
		fmt.Printf("dry run: fee-credit deposit simulation HALT (%s GAS, nil memo)\n", pkFormatGas(amount))
		return nil
	}
	txid, _, err := pkSendAndWait(ctx, client, act, gasHash, "transfer", report, "Kernel fee-credit deposit (nil memo)", signerHash, kernel, amount, nil)
	if err != nil {
		return err
	}
	fmt.Printf("fee-credit deposit tx: 0x%s (%s GAS)\n", txid.StringLE(), pkFormatGas(amount))
	after, err := pkCallInteger(act, kernel, "feeCreditOf", signerHash)
	if err != nil {
		return fmt.Errorf("read feeCreditOf(signer) after deposit: %w", err)
	}
	record.FeeCreditAfter = pkFormatBigGas(after)
	if new(big.Int).Sub(after, credit).Cmp(big.NewInt(amount)) != 0 {
		return fmt.Errorf("feeCreditOf delta %s != deposited amount %s", pkFormatBigGas(new(big.Int).Sub(after, credit)), pkFormatGas(amount))
	}
	record.Steps = append(record.Steps, pkStepRecord{Name: "fee-credit", Status: "done", Note: fmt.Sprintf("feeCreditOf(signer) %s -> %s GAS", pkFormatBigGas(credit), pkFormatBigGas(after))})
	return nil
}

// pkWirePlatformGame points PlatformGame at the private kernel. The signer is
// the PlatformGame admin (asserted first); the oracle() read-back is asserted
// after the write. Unlike the registry lane, re-pointing a non-zero oracle is
// the PURPOSE of this action (the old binding is recorded in the report).
func pkWirePlatformGame(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, signerHash util.Uint160, dryRun bool, report *pkReport, record *pkWireRecord) error {
	engineHash, _, err := pkResolveEngineHash()
	if err != nil {
		return err
	}
	if _, err := client.GetContractStateByHash(engineHash); err != nil {
		return fmt.Errorf("PlatformGame 0x%s not found on-chain: %w", engineHash.StringLE(), err)
	}
	admin, err := pkCallUint160(act, engineHash, "admin")
	if err != nil {
		return fmt.Errorf("read PlatformGame admin: %w", err)
	}
	report.Validation["platform_game_admin"] = "0x" + admin.StringLE()
	if admin != signerHash {
		return fmt.Errorf("PlatformGame admin 0x%s is not the current signer; cannot setOracle", admin.StringLE())
	}

	current, err := pkCallUint160(act, engineHash, "oracle")
	if err != nil {
		return fmt.Errorf("read PlatformGame oracle(): %w", err)
	}
	record.OracleBefore = "0x" + current.StringLE()
	if current == kernel {
		record.OracleAfter = record.OracleBefore
		record.Steps = append(record.Steps, pkStepRecord{Name: "platform-game-oracle", Status: "skipped", Note: "PlatformGame oracle() already the private kernel"})
		fmt.Println("PlatformGame oracle() already the private kernel; skipping setOracle")
		return nil
	}
	if current != (util.Uint160{}) {
		fmt.Printf("note: PlatformGame oracle() is currently 0x%s; re-pointing to the private kernel 0x%s\n", current.StringLE(), kernel.StringLE())
	}
	if err := pkSimulate(act, engineHash, "setOracle", kernel); err != nil {
		return err
	}
	if dryRun {
		record.Steps = append(record.Steps, pkStepRecord{Name: "platform-game-oracle", Status: "simulated", Note: "setOracle simulation HALT (eligible)"})
		fmt.Println("dry run: PlatformGame setOracle simulation HALT (eligible)")
		return nil
	}
	txid, _, err := pkSendAndWait(ctx, client, act, engineHash, "setOracle", report, "PlatformGame setOracle(private kernel)", kernel)
	if err != nil {
		return err
	}
	fmt.Printf("setOracle tx: 0x%s\n", txid.StringLE())
	after, err := pkCallUint160(act, engineHash, "oracle")
	if err != nil {
		return fmt.Errorf("read PlatformGame oracle() after setOracle: %w", err)
	}
	record.OracleAfter = "0x" + after.StringLE()
	if after != kernel {
		return fmt.Errorf("PlatformGame oracle() read-back 0x%s does not match the private kernel 0x%s", after.StringLE(), kernel.StringLE())
	}
	record.Steps = append(record.Steps, pkStepRecord{Name: "platform-game-oracle", Status: "done", Note: fmt.Sprintf("oracle() %s -> %s", record.OracleBefore, record.OracleAfter)})
	return nil
}

// ---------------------------------------------------------------------
// Action: fulfill
// ---------------------------------------------------------------------

func pkActionFulfill(ctx context.Context, client *rpcclient.Client, act *actor.Actor, kernel util.Uint160, signerHash util.Uint160, networkMagic uint32, dryRun bool, report *pkReport) error {
	if _, err := client.GetContractStateByHash(kernel); err != nil {
		return fmt.Errorf("kernel contract 0x%s not found on-chain: %w", kernel.StringLE(), err)
	}
	record := &pkFulfillRecord{}
	report.Fulfill = record

	verifierWIF := strings.TrimSpace(os.Getenv("PRIVATE_KERNEL_VERIFIER_WIF"))
	if verifierWIF == "" {
		return fmt.Errorf("PRIVATE_KERNEL_VERIFIER_WIF is not set: fulfill signs the digest with the runtime verifier key pinned by the wire action")
	}
	verifier, err := keys.NewPrivateKeyFromWIF(verifierWIF)
	if err != nil {
		return fmt.Errorf("invalid PRIVATE_KERNEL_VERIFIER_WIF")
	}

	requestID, err := pkParseRequestID()
	if err != nil {
		return err
	}
	record.RequestID = requestID.String()

	success := true
	if raw, ok := os.LookupEnv("PRIVATE_KERNEL_FULFILL_SUCCESS"); ok {
		success = pkTruthy(raw)
	}
	record.Success = success
	errorMessage := strings.TrimSpace(os.Getenv("PRIVATE_KERNEL_FULFILL_ERROR"))
	record.Error = errorMessage
	result, err := pkParseFulfillResult(success)
	if err != nil {
		return err
	}
	record.ResultLength = len(result)

	// Gate checks mirror the kernel's own assertions so failures are loud and
	// local instead of a chain FAULT: updater == signer (ValidateUpdater,
	// MorpheusOracle.Storage.cs:34-39) and the on-chain verifier key == the
	// WIF pubkey (MorpheusOracle.cs:1118-1120).
	updater, note, err := pkReadUpdater(act, kernel)
	if err != nil {
		return err
	}
	if note != "" {
		report.Validation["updater_read_note"] = note
	}
	if updater != signerHash {
		return fmt.Errorf("kernel updater 0x%s is not the current signer: fulfillRequest is updater-gated; run PRIVATE_KERNEL_ACTION=wire first (it sets updater = signer)", updater.StringLE())
	}
	onChainKey, err := pkCallVerifierKey(act, kernel)
	if err != nil {
		return fmt.Errorf("read runtimeVerificationPublicKey: %w", err)
	}
	if len(onChainKey) == 0 {
		return fmt.Errorf("kernel runtimeVerificationPublicKey is not set; run PRIVATE_KERNEL_ACTION=wire first")
	}
	if string(onChainKey) != string(verifier.PublicKey().Bytes()) {
		return fmt.Errorf("PRIVATE_KERNEL_VERIFIER_WIF pubkey %x does not match the on-chain runtimeVerificationPublicKey %x", verifier.PublicKey().Bytes(), onChainKey)
	}

	req, err := pkCallRequest(act, kernel, requestID)
	if err != nil {
		return fmt.Errorf("read getRequest(%s): %w", requestID.String(), err)
	}
	if req.ID.Sign() == 0 {
		return fmt.Errorf("kernel request %s not found (finalizeGame on PlatformGame submits it)", requestID.String())
	}
	if req.Status != 0 {
		return fmt.Errorf("kernel request %s is not pending (status %d); already fulfilled or expired", requestID.String(), req.Status)
	}
	record.AppID = req.AppID
	record.ModuleID = req.ModuleID
	record.Operation = req.Operation
	fmt.Printf("fulfilling request %s: app=%q module=%q op=%q success=%t result=%d bytes\n",
		requestID.String(), req.AppID, req.ModuleID, req.Operation, success, len(result))

	digest := pkFulfillmentDigest(requestID, req.AppID, req.ModuleID, req.Operation, success, result, errorMessage, kernel, networkMagic)
	record.DigestHex = hex.EncodeToString(digest)
	signature := verifier.Sign(digest) // neo-go Sign = SHA256(digest) + RFC6979 ECDSA -> 64-byte r||s
	record.SignatureHex = hex.EncodeToString(signature)

	if err := pkSimulate(act, kernel, "fulfillRequest", requestID, success, result, errorMessage, signature); err != nil {
		return err
	}
	if dryRun {
		record.SimulateNote = "dry run: fulfillRequest simulation HALT (eligible)"
		fmt.Println("dry run: fulfillRequest simulation HALT (eligible)")
		return nil
	}
	txid, _, err := pkSendAndWait(ctx, client, act, kernel, "fulfillRequest", report, "Fulfill kernel request "+requestID.String(), requestID, success, result, errorMessage, signature)
	if err != nil {
		return err
	}
	record.TxID = "0x" + txid.StringLE()
	fmt.Printf("fulfillRequest tx: 0x%s\n", txid.StringLE())

	after, err := pkCallRequest(act, kernel, requestID)
	if err != nil {
		return fmt.Errorf("read getRequest(%s) after fulfill: %w", requestID.String(), err)
	}
	expectedStatus := int64(2)
	if success {
		expectedStatus = 1
	}
	if after.Status != expectedStatus {
		return fmt.Errorf("request %s status %d after fulfill, expected %d", requestID.String(), after.Status, expectedStatus)
	}
	record.StatusAfter = strconv.FormatInt(after.Status, 10)
	report.NextSteps = append(report.NextSteps,
		"Request is fulfilled. PlatformGame.onMiniAppResult settlement is effects-only (pull payment): a win lands in the player's reward credit, a failed run refunds the entry. Inspect with PRIVATE_KERNEL_ACTION=verify.")
	return nil
}

func pkParseRequestID() (*big.Int, error) {
	raw := strings.TrimSpace(os.Getenv("PRIVATE_KERNEL_FULFILL_REQUEST_ID"))
	if raw == "" {
		return nil, fmt.Errorf("PRIVATE_KERNEL_FULFILL_REQUEST_ID is not set (the kernel request id returned by PlatformGame.finalizeGame)")
	}
	requestID, ok := new(big.Int).SetString(raw, 10)
	if !ok || requestID.Sign() <= 0 {
		return nil, fmt.Errorf("invalid PRIVATE_KERNEL_FULFILL_REQUEST_ID %q (must be a positive integer)", raw)
	}
	return requestID, nil
}

// pkParseFulfillResult decodes the game.session result codec. A successful
// finalize carries the fixed 79-byte codec parsed by PlatformGame's
// ParseRewardResult (0x02 || commitment(32) || answerHash(32) ||
// elapsedMs(u64BE) || undos(1) || score(u32BE) || difficulty(1)); anything
// else would settle garbage, so it is rejected locally.
func pkParseFulfillResult(success bool) ([]byte, error) {
	raw := strings.TrimSpace(os.Getenv("PRIVATE_KERNEL_FULFILL_RESULT_HEX"))
	raw = strings.TrimPrefix(raw, "0x")
	if raw == "" {
		if success {
			return nil, fmt.Errorf("PRIVATE_KERNEL_FULFILL_RESULT_HEX is not set: a successful session.finalize carries the 79-byte result codec")
		}
		return []byte{}, nil
	}
	result, err := hex.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid PRIVATE_KERNEL_FULFILL_RESULT_HEX: %w", err)
	}
	if success && len(result) != pkFulfillResultLength {
		return nil, fmt.Errorf("PRIVATE_KERNEL_FULFILL_RESULT_HEX is %d bytes, expected exactly %d (0x02 || commitment(32) || answerHash(32) || elapsedMs(u64BE) || undos(1) || score(u32BE) || difficulty(1))", len(result), pkFulfillResultLength)
	}
	if success && result[0] != 0x02 {
		return nil, fmt.Errorf("PRIVATE_KERNEL_FULFILL_RESULT_HEX tag byte 0x%02x, expected 0x02 (game.session result codec)", result[0])
	}
	return result, nil
}

// ---------------------------------------------------------------------
// Action: verify
// ---------------------------------------------------------------------

func pkActionVerify(act *actor.Actor, kernel util.Uint160, signerHash util.Uint160, report *pkReport) error {
	admin, err := pkCallUint160(act, kernel, "admin")
	if err != nil {
		return fmt.Errorf("read admin: %w", err)
	}
	report.Validation["admin"] = "0x" + admin.StringLE()
	report.Validation["admin_matches_signer"] = admin == signerHash
	fmt.Printf("admin: 0x%s (signer match: %t)\n", admin.StringLE(), admin == signerHash)

	updater, note, err := pkReadUpdater(act, kernel)
	if err != nil {
		return err
	}
	report.Validation["updater"] = "0x" + updater.StringLE()
	report.Validation["updater_matches_signer"] = updater == signerHash
	if note != "" {
		report.Validation["updater_read_note"] = note
	}
	fmt.Printf("updater: 0x%s (signer match: %t)\n", updater.StringLE(), updater == signerHash)

	verifierKey, err := pkCallVerifierKey(act, kernel)
	if err != nil {
		return fmt.Errorf("read runtimeVerificationPublicKey: %w", err)
	}
	if len(verifierKey) == 0 {
		report.Validation["runtime_verification_public_key"] = "not set"
		fmt.Println("runtimeVerificationPublicKey: not set")
	} else {
		report.Validation["runtime_verification_public_key"] = hex.EncodeToString(verifierKey)
		fmt.Printf("runtimeVerificationPublicKey: %x\n", verifierKey)
	}

	moduleID := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_MODULE_ID"), pkDefaultModuleID)
	if row, err := pkCallRow(act, kernel, "getSystemModule", moduleID); err == nil && pkRowCreated(row) {
		report.Validation["module_row"] = row
		fmt.Printf("module %q: %v\n", moduleID, row)
	} else {
		report.Validation["module_row"] = "not registered"
		fmt.Printf("module %q: not registered\n", moduleID)
	}

	appIDs, err := pkParseAppIDs()
	if err != nil {
		return err
	}
	for _, appID := range appIDs {
		row, err := pkCallRow(act, kernel, "getMiniApp", appID)
		if err != nil || !pkRowCreated(row) {
			report.Validation["miniapp_row_"+appID] = "not registered"
			fmt.Printf("app %q: not registered\n", appID)
			continue
		}
		report.Validation["miniapp_row_"+appID] = row
		granted, _ := pkCallBool(act, kernel, "isModuleGrantedToMiniApp", appID, moduleID)
		report.Validation["module_granted_"+appID] = granted
		fmt.Printf("app %q: %v (game.session granted: %t)\n", appID, row, granted)
	}

	credit, err := pkCallInteger(act, kernel, "feeCreditOf", signerHash)
	if err != nil {
		return fmt.Errorf("read feeCreditOf(signer): %w", err)
	}
	report.Validation["fee_credit_signer_gas"] = pkFormatBigGas(credit)
	fmt.Printf("feeCreditOf(signer): %s GAS\n", pkFormatBigGas(credit))

	if engineHash, _, err := pkResolveEngineHash(); err == nil {
		if engineAdmin, err := pkCallUint160(act, engineHash, "admin"); err == nil {
			report.Validation["platform_game_admin"] = "0x" + engineAdmin.StringLE()
			report.Validation["platform_game_admin_matches_signer"] = engineAdmin == signerHash
		}
		if oracle, err := pkCallUint160(act, engineHash, "oracle"); err == nil {
			report.Validation["platform_game_oracle"] = "0x" + oracle.StringLE()
			report.Validation["platform_game_oracle_is_private_kernel"] = oracle == kernel
			fmt.Printf("PlatformGame oracle(): 0x%s (private kernel: %t)\n", oracle.StringLE(), oracle == kernel)
		}
	}

	if requestID, err := pkParseRequestID(); err == nil {
		if req, err := pkCallRequest(act, kernel, requestID); err == nil && req.ID.Sign() > 0 {
			report.Validation["request_"+requestID.String()] = map[string]interface{}{
				"app_id": req.AppID, "module_id": req.ModuleID, "operation": req.Operation, "status": req.Status,
			}
			fmt.Printf("request %s: app=%q module=%q op=%q status=%d\n", requestID.String(), req.AppID, req.ModuleID, req.Operation, req.Status)
		}
	}
	report.NextSteps = append(report.NextSteps, "Nothing pending in this read-only verification.")
	return nil
}

// ---------------------------------------------------------------------
// Fulfillment digest (byte-exact mirror of the kernel)
// ---------------------------------------------------------------------

// pkFulfillmentDigest reproduces ComputeFulfillmentDigest
// (MorpheusOracle.Fulfillment.cs:45-60) byte for byte:
//
//	sha256( "miniapp-os-fulfillment-v1"                  (domain, :47)
//	      || requestId as 32-byte BIG-endian u256        (ToUInt256Bytes, :25-43)
//	      || sha256(appId UTF-8)                         (:48)
//	      || sha256(moduleId UTF-8)                      (:49)
//	      || sha256(operation UTF-8)                     (:50)
//	      || 0x01/0x00 success byte                      (:51)
//	      || sha256(result bytes)                        (:52, ComputeResultHash :15-18)
//	      || sha256(error UTF-8)                         (:53)
//	      || ExecutingScriptHash 20 VM bytes             (:57 — the reverse of
//	      ||                                                the 0x display form;
//	      ||                                                util.Uint160.BytesBE())
//	      || network magic 4-byte little-endian )        (:58, NetworkMagicLe4 :65-75)
func pkFulfillmentDigest(requestID *big.Int, appID, moduleID, operation string, success bool, result []byte, errorMessage string, kernel util.Uint160, networkMagic uint32) []byte {
	payload := append([]byte{}, pkFulfillmentDomain...)
	payload = append(payload, pkUint256BE(requestID)...)
	payload = append(payload, pkSHA256([]byte(appID))...)
	payload = append(payload, pkSHA256([]byte(moduleID))...)
	payload = append(payload, pkSHA256([]byte(operation))...)
	if success {
		payload = append(payload, 0x01)
	} else {
		payload = append(payload, 0x00)
	}
	payload = append(payload, pkSHA256(result)...)
	payload = append(payload, pkSHA256([]byte(errorMessage))...)
	payload = append(payload, kernel.BytesBE()...)
	var magic [4]byte
	binary.LittleEndian.PutUint32(magic[:], networkMagic)
	payload = append(payload, magic[:]...)
	sum := sha256.Sum256(payload)
	return sum[:]
}

// pkUint256BE mirrors ToUInt256Bytes (MorpheusOracle.Fulfillment.cs:25-43):
// non-negative, max 32 bytes, big-endian padded to exactly 32.
func pkUint256BE(value *big.Int) []byte {
	raw := value.Bytes() // big-endian, no sign byte (value is non-negative)
	out := make([]byte, 32)
	copy(out[32-len(raw):], raw)
	return out
}

func pkSHA256(data []byte) []byte {
	sum := sha256.Sum256(data)
	return sum[:]
}

// pkDigestSelfTest pins the builder to the two golden vectors before any
// network access. Both use the canonical vector fields from
// MorpheusOracleGoldenDigestTests.cs: requestId 42, appId demo.app, moduleId
// oracle.fetch, operation fetch, success, result {"v":1}, empty error,
// testnet magic.
func pkDigestSelfTest() error {
	for i, vector := range []struct{ scriptHash, expected string }{
		{pkGoldenVector1Scripthash, pkGoldenVector1Digest},
		{pkGoldenVector2Scripthash, pkGoldenVector2Digest},
	} {
		hash, err := pkParseHash(vector.scriptHash)
		if err != nil {
			return fmt.Errorf("digest self-test vector %d: %w", i+1, err)
		}
		digest := pkFulfillmentDigest(big.NewInt(42), "demo.app", "oracle.fetch", "fetch", true, []byte(`{"v":1}`), "", hash, pkTestnetMagic)
		if hex.EncodeToString(digest) != vector.expected {
			return fmt.Errorf("fulfillment digest self-test FAILED on vector %d: got %x, expected %s — the local builder diverged from the kernel's ComputeFulfillmentDigest; do NOT fulfill", i+1, digest, vector.expected)
		}
	}
	return nil
}

// ---------------------------------------------------------------------
// Hash / id resolution
// ---------------------------------------------------------------------

// pkResolveKernelHash resolves the deployed private kernel: env first, then
// the newest deploy/config/private-kernel-testnet-*.json report, then the
// predicted hash from the sibling-repo artifacts.
func pkResolveKernelHash(client *rpcclient.Client, signerHash util.Uint160) (util.Uint160, error) {
	for _, key := range []string{"PRIVATE_KERNEL_TESTNET_HASH", "PRIVATE_KERNEL_HASH"} {
		if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
			return pkParseHash(raw)
		}
	}
	if hash, source, ok := pkKernelHashFromReports(); ok {
		if _, err := client.GetContractStateByHash(hash); err == nil {
			fmt.Printf("resolved private kernel 0x%s from %s\n", hash.StringLE(), source)
			return hash, nil
		} else {
			return util.Uint160{}, fmt.Errorf("private kernel 0x%s (from %s) not found on-chain: %w", hash.StringLE(), source, err)
		}
	}
	nefFile, mani, err := pkLoadKernelArtifacts(&pkReport{Validation: map[string]interface{}{}})
	if err != nil {
		return util.Uint160{}, err
	}
	predicted := state.CreateContractHash(signerHash, nefFile.Checksum, mani.Name)
	if _, err := client.GetContractStateByHash(predicted); err == nil {
		fmt.Printf("resolved private kernel at predicted hash 0x%s\n", predicted.StringLE())
		return predicted, nil
	}
	return util.Uint160{}, fmt.Errorf("private kernel not found at predicted hash 0x%s and no deploy/config/private-kernel-testnet-*.json report records it; deploy first (PRIVATE_KERNEL_ACTION=deploy) or set PRIVATE_KERNEL_TESTNET_HASH", predicted.StringLE())
}

// pkPreviousReport is the subset of this script's own JSON reports that later
// runs consume for kernel-hash resolution.
type pkPreviousReport struct {
	PrivateKernel string `json:"private_kernel"`
}

// pkReportCandidates returns the report files, newest first (the date-stamped
// names sort chronologically).
func pkReportCandidates() []string {
	matches, err := filepath.Glob(filepath.Join("deploy", "config", "private-kernel-testnet-*.json"))
	if err != nil {
		return nil
	}
	sort.Strings(matches)
	for i, j := 0, len(matches)-1; i < j; i, j = i+1, j-1 {
		matches[i], matches[j] = matches[j], matches[i]
	}
	return matches
}

func pkKernelHashFromReports() (util.Uint160, string, bool) {
	for _, path := range pkReportCandidates() {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var previous pkPreviousReport
		if err := json.Unmarshal(data, &previous); err != nil {
			continue
		}
		if strings.TrimSpace(previous.PrivateKernel) == "" {
			continue
		}
		hash, err := pkParseHash(previous.PrivateKernel)
		if err != nil {
			continue
		}
		return hash, path, true
	}
	return util.Uint160{}, "", false
}

// pkResolveEngineHash mirrors update_platform_contracts.go loadTargets /
// prResolveEngineHash: network-scoped env first, then the game deployment
// record, then the committed default.
func pkResolveEngineHash() (util.Uint160, string, error) {
	for _, key := range []string{"PLATFORM_GAME_TESTNET_HASH", "PLATFORM_GAME_HASH"} {
		if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
			hash, err := pkParseHash(raw)
			return hash, "env " + key, err
		}
	}
	type gameDeployment struct {
		PlatformGame string `json:"platform_game"`
	}
	var deployed gameDeployment
	recordPath := "contracts/build/testnet_game_deployment.json"
	if data, err := os.ReadFile(recordPath); err == nil {
		if err := json.Unmarshal(data, &deployed); err == nil && strings.TrimSpace(deployed.PlatformGame) != "" {
			hash, err := pkParseHash(deployed.PlatformGame)
			return hash, recordPath, err
		}
	}
	hash, err := pkParseHash(pkTestnetPlatformGameHash)
	return hash, "built-in default", err
}

func pkParseAppIDs() ([]string, error) {
	raw := pkFirstNonEmpty(os.Getenv("PRIVATE_KERNEL_APP_IDS"), pkDefaultAppIDs)
	seen := map[string]bool{}
	out := []string{}
	for _, part := range strings.Split(raw, ",") {
		appID := strings.TrimSpace(part)
		if appID == "" || seen[appID] {
			continue
		}
		if !pkAppIDPattern.MatchString(appID) {
			return nil, fmt.Errorf("invalid appId %q in PRIVATE_KERNEL_APP_IDS (charset [a-z0-9-_.], 1-64 chars)", appID)
		}
		seen[appID] = true
		out = append(out, appID)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("PRIVATE_KERNEL_APP_IDS is empty")
	}
	return out, nil
}

// ---------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------

func pkSendAndWait(ctx context.Context, client *rpcclient.Client, act *actor.Actor, contract util.Uint160, method string, report *pkReport, label string, params ...any) (util.Uint256, *result.ApplicationLog, error) {
	txid, vub, err := act.SendCall(contract, method, params...)
	if err != nil {
		return util.Uint256{}, nil, fmt.Errorf("%s (%s): %w", label, method, err)
	}
	report.Transactions = append(report.Transactions, pkTxRecord{Label: label, TxID: "0x" + txid.StringLE(), VUB: vub})
	appLog, err := pkWaitForTx(ctx, client, txid)
	if err != nil {
		return txid, nil, err
	}
	return txid, appLog, nil
}

func pkWaitForTx(ctx context.Context, client *rpcclient.Client, txid util.Uint256) (*result.ApplicationLog, error) {
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

// pkSimulate test-invokes a write method and asserts HALT before any send.
func pkSimulate(act *actor.Actor, contract util.Uint160, method string, params ...any) error {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return fmt.Errorf("simulate %s: %w", method, err)
	}
	if inv.State != "HALT" {
		return fmt.Errorf("simulate %s fault: %s", method, inv.FaultException)
	}
	return nil
}

func pkCallHALT(act *actor.Actor, contract util.Uint160, method string, params ...any) (*result.Invoke, error) {
	inv, err := act.Call(contract, method, params...)
	if err != nil {
		return nil, fmt.Errorf("%s call: %w", method, err)
	}
	if inv.State != "HALT" {
		return nil, fmt.Errorf("%s fault: %s", method, inv.FaultException)
	}
	return inv, nil
}

func pkCallInteger(act *actor.Actor, contract util.Uint160, method string, params ...any) (*big.Int, error) {
	inv, err := pkCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return big.NewInt(0), nil
	}
	return inv.Stack[0].TryInteger()
}

func pkCallUint160(act *actor.Actor, contract util.Uint160, method string, params ...any) (util.Uint160, error) {
	inv, err := pkCallHALT(act, contract, method, params...)
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

func pkCallBool(act *actor.Actor, contract util.Uint160, method string, params ...any) (bool, error) {
	inv, err := pkCallHALT(act, contract, method, params...)
	if err != nil {
		return false, err
	}
	if len(inv.Stack) == 0 {
		return false, nil
	}
	return inv.Stack[0].TryBool()
}

// pkCallVerifierKey reads runtimeVerificationPublicKey, tolerating the null
// the kernel returns while the key is unset (MorpheusOracle.cs:339-343).
func pkCallVerifierKey(act *actor.Actor, kernel util.Uint160) ([]byte, error) {
	inv, err := pkCallHALT(act, kernel, "runtimeVerificationPublicKey")
	if err != nil {
		return nil, err
	}
	if len(inv.Stack) == 0 {
		return nil, nil
	}
	if inv.Stack[0].Type() == stackitem.AnyT {
		return nil, nil
	}
	return inv.Stack[0].TryBytes()
}

// pkReadUpdater reads updater(), tolerating an unset row. _deploy does not
// seed the updater and the plain cast may fault on some builds, so a FAULT is
// reported as zero + note instead of aborting the lane.
func pkReadUpdater(act *actor.Actor, kernel util.Uint160) (util.Uint160, string, error) {
	inv, err := act.Call(kernel, "updater")
	if err != nil {
		return util.Uint160{}, "", fmt.Errorf("updater call: %w", err)
	}
	if inv.State != "HALT" {
		return util.Uint160{}, fmt.Sprintf("updater() faulted (%s); treating as unset", inv.FaultException), nil
	}
	if len(inv.Stack) == 0 || inv.Stack[0].Type() == stackitem.AnyT {
		return util.Uint160{}, "updater() returned null (unset)", nil
	}
	bytes, err := inv.Stack[0].TryBytes()
	if err != nil {
		return util.Uint160{}, "", fmt.Errorf("decode updater(): %w", err)
	}
	hash, err := util.Uint160DecodeBytesBE(bytes)
	return hash, "", err
}

// pkCallRow decodes a [Safe] method returning a struct (GetMiniApp /
// GetSystemModule) into display values.
func pkCallRow(act *actor.Actor, contract util.Uint160, method string, params ...any) ([]interface{}, error) {
	inv, err := pkCallHALT(act, contract, method, params...)
	if err != nil {
		return nil, err
	}
	return pkStackValues(inv), nil
}

// pkRowCreated reports whether a decoded MiniAppRecord / SystemModuleRecord
// row exists: both structs carry CreatedAt as the second-to-last integer
// field (MorpheusOracle.cs:169-190) and the kernel returns an all-zero empty
// record for unknown ids.
func pkRowCreated(row []interface{}) bool {
	if len(row) < 2 {
		return false
	}
	createdAt, ok := row[len(row)-2].(string)
	if !ok {
		return false
	}
	value, ok := new(big.Int).SetString(createdAt, 10)
	return ok && value.Sign() > 0
}

// pkCallRequest decodes GetRequest: [Id, AppId, ModuleId, Operation, Payload,
// Requester, Sponsor, CallbackContract, Status, CreatedAt, FulfilledAt,
// Success, Result, Error, FeePaid] (MorpheusOracle.cs:192-212).
func pkCallRequest(act *actor.Actor, kernel util.Uint160, requestID *big.Int) (pkKernelRequest, error) {
	inv, err := pkCallHALT(act, kernel, "getRequest", requestID)
	if err != nil {
		return pkKernelRequest{}, err
	}
	if len(inv.Stack) == 0 {
		return pkKernelRequest{ID: big.NewInt(0)}, nil
	}
	items, ok := inv.Stack[0].Value().([]stackitem.Item)
	if !ok || len(items) < 9 {
		return pkKernelRequest{}, fmt.Errorf("getRequest returned an unexpected shape (%d items)", len(items))
	}
	req := pkKernelRequest{ID: big.NewInt(0)}
	if id, err := items[0].TryInteger(); err == nil {
		req.ID = id
	}
	if appID, err := items[1].TryBytes(); err == nil {
		req.AppID = string(appID)
	}
	if moduleID, err := items[2].TryBytes(); err == nil {
		req.ModuleID = string(moduleID)
	}
	if operation, err := items[3].TryBytes(); err == nil {
		req.Operation = string(operation)
	}
	if status, err := items[8].TryInteger(); err == nil {
		req.Status = status.Int64()
	}
	return req, nil
}

func pkStackValues(inv *result.Invoke) []interface{} {
	out := []interface{}{}
	if len(inv.Stack) == 0 {
		return out
	}
	items, ok := inv.Stack[0].Value().([]stackitem.Item)
	if !ok {
		return append(out, pkStackValue(inv.Stack[0]))
	}
	for _, item := range items {
		out = append(out, pkStackValue(item))
	}
	return out
}

func pkStackValue(item stackitem.Item) interface{} {
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

func pkSignerBalances(client *rpcclient.Client, signer util.Uint160) (int64, int64, error) {
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
		case pkNeoHashLE:
			neo = amount
		case pkGasHashLE:
			gas = amount
		}
	}
	return neo, gas, nil
}

// ---------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------

func pkLoadNEF(path string) (*nef.File, error) {
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

func pkLoadManifest(path string) (*manifest.Manifest, error) {
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

func pkParseHash(raw string) (util.Uint160, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(raw), "0x")
	return util.Uint160DecodeStringLE(trimmed)
}

func pkMinGasThreshold(action string) float64 {
	if raw := strings.TrimSpace(os.Getenv("PRIVATE_KERNEL_MIN_GAS")); raw != "" {
		if value, err := strconv.ParseFloat(raw, 64); err == nil && value >= 0 {
			return value
		}
	}
	switch action {
	case "wire":
		return pkDefaultMinGasWire
	case "fulfill":
		return pkDefaultMinGasFulfill
	case "verify":
		return 0
	case "update":
		return pkDefaultMinGasDeploy
	}
	return pkDefaultMinGasDeploy
}

// pkGasFractionsEnv parses a GAS-denominated float env into base fractions.
func pkGasFractionsEnv(key string, defaultGas float64) (int64, error) {
	value, err := strconv.ParseFloat(pkFirstNonEmpty(os.Getenv(key), strconv.FormatFloat(defaultGas, 'f', -1, 64)), 64)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("invalid %s (must be a positive number of GAS)", key)
	}
	return int64(math.Round(value * pkGasFractionsPerGas)), nil
}

func pkReportPath() string {
	if raw := strings.TrimSpace(os.Getenv("PRIVATE_KERNEL_DEPLOY_REPORT_PATH")); raw != "" {
		return raw
	}
	return filepath.Join("deploy", "config", fmt.Sprintf("private-kernel-testnet-%s.json", time.Now().UTC().Format("2006-01-02")))
}

func pkWriteReport(path string, report pkReport) error {
	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, append(out, '\n'), 0644)
}

func pkPrintNextSteps(report pkReport) {
	fmt.Println()
	fmt.Println("NEXT STEPS")
	fmt.Println("==========")
	if report.DryRun && report.Action != "verify" {
		fmt.Println("   This was a dry run. To write chain, re-run with:")
		fmt.Println("     PRIVATE_KERNEL_DEPLOY_DRY_RUN=false CONFIRM_PRIVATE_KERNEL=" + pkConfirmPhrase + " \\")
		fmt.Println("       NEO_TESTNET_WIF=<wif> go run -tags scripts deploy/scripts/deploy_private_kernel.go")
	}
	fmt.Println("   Read-only state check at any time:")
	fmt.Println("     PRIVATE_KERNEL_ACTION=verify go run -tags scripts deploy/scripts/deploy_private_kernel.go")
	for _, step := range report.NextSteps {
		fmt.Println(" - " + step)
	}
}

func pkFormatGas(fractions int64) string {
	return strconv.FormatFloat(float64(fractions)/pkGasFractionsPerGas, 'f', 8, 64)
}

func pkFormatBigGas(value *big.Int) string {
	rat := new(big.Rat).SetFrac(value, big.NewInt(100_000_000))
	return rat.FloatString(8)
}

func pkFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func pkTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
