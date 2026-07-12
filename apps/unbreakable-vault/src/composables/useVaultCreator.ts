/**
 * useVaultCreator — Vault creation + "my vaults" listing
 *
 * Talks DIRECTLY to the standalone MiniAppUnbreakableVault contract via the
 * MiniApp framework (ctx.framework / app.chain). The earlier path routed reads
 * through ctx.os.storage and badges through ctx.os.badge — both backed by the
 * Morpheus OS kernel/edge, which is offline, so the app was broken at runtime.
 *
 * Contract interaction model (verified against the deployed ABI at
 * 0x78fbd57ccfae14fff4b043a82eb491de542d8eb0):
 *
 *   CREATE (deposit-then-act):
 *     1. transfer(creator, CONTRACT, bountyBaseUnits, "miniapp-unbreakablevault:create")
 *        { scriptHash: GAS_HASH } — OnNEP17Payment credits the prepaid bounty.
 *     2. createVault(creator, secretHash, bounty, difficulty, title, description)
 *        -> Integer vaultId. The id is read from the "VaultCreated" event:
 *        VaultCreated(vaultId, creator, bounty, difficulty).
 *     invokeWithPayment performs both steps; the secret is hashed locally with
 *     SHA-256 and only the digest is sent on-chain.
 *
 *   READS (chain.read, default app contract script hash):
 *     totalVaults()              -> Integer (vaults are ids 1..totalVaults)
 *     getVaultDetails(vaultId)   -> Map{id,creator,bounty,attemptCount,difficulty,
 *                                       difficultyName,attemptFee,createdTime,
 *                                       expiryTime,hintsRevealed,broken,expired,
 *                                       winner,title,description,status}
 *
 * "My vaults" are derived by enumerating the most recent vaults and filtering
 * those whose creator matches the connected wallet — the contract has no
 * per-creator index, so this reuses the shared catalog read.
 *
 * AMOUNT CONVENTION: bounty is GAS in BASE UNITS (1e8 per GAS).
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { sha256Hex } from "@shared/utils/hash";
import { parsePositiveFixed8 } from "@shared/utils/format";
import {
  CREATE_MEMO,
  MAX_MY_VAULTS_SCAN,
  exactUnsignedInteger,
  isContractAddressUnavailableError,
  readRecentVaultDetails,
  readVaultDetails,
  type ChainVaultDetails,
} from "./vaultChain";
import {
  VaultVerificationError,
  VAULT_EVENT_WAIT_MS,
  requireCanonicalVaultContext,
  requireWritableVaultContext,
  type PendingVaultOperation,
  type VaultFinalization,
} from "./vaultSafety";
import type { createVaultSafety } from "./vaultSafety";

// ============================================================================
// Types
// ============================================================================

export interface MyVault {
  id: string;
  /** GAS base units. */
  bounty: string;
  created: number;
  status: string;
}

export interface VaultCreateForm {
  bounty: string;
  title: string;
  description: string;
  difficulty: number;
  secret: string;
  secretHash: string;
  /** Mainnet only: receipt from the already-settled PaymentHub deposit. */
  receiptId?: string;
}

export interface UseVaultCreatorOptions {
  /** MiniApp framework (ctx.framework) for wallet-signed contract calls + reads. */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string) => string;
  safety: ReturnType<typeof createVaultSafety>;
}

export type VaultWriteOutcome =
  | { status: "confirmed"; finalization: VaultFinalization }
  | { status: "pending"; pending: PendingVaultOperation };

// ============================================================================
// Helpers
// ============================================================================

function base64FromBytes(bytes: number[]): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return output;
}

/** Convert a hex SHA-256 digest to base64 for the ByteArray contract arg. */
function hashHexToBase64(hash: string): string {
  const normalized = hash.replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("invalidSecretHash");
  }
  const bytes =
    normalized.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
  return base64FromBytes(bytes);
}

function toMyVault(detail: ChainVaultDetails): MyVault {
  return {
    id: detail.id,
    bounty: detail.bounty,
    created: detail.createdTime,
    status: detail.status,
  };
}

function parseBountyFixed8(value: string, minimumFixed8: bigint): string | null {
  const fixed8 = parsePositiveFixed8(value);
  if (!fixed8) return null;
  return BigInt(fixed8) >= minimumFixed8 ? fixed8 : null;
}

// ============================================================================
// Composable
// ============================================================================

export function useVaultCreator({
  app,
  t,
  safety,
}: UseVaultCreatorOptions) {
  const myVaults = createObservable<MyVault[]>([]);
  const myVaultsReadError = createObservable("");
  const createdVaultId = createObservable<string | null>(null);
  const isCreating = createObservable(false);
  let myVaultLoadEpoch = 0;

  /**
   * Load vaults created by the current wallet by enumerating the most recent
   * vaults on-chain and filtering by creator. Newest first.
   */
  const loadMyVaults = async () => {
    const epoch = ++myVaultLoadEpoch;
    try {
      const wallet = app.chain.address.get();
      if (!wallet) {
        myVaults.set([]);
        myVaultsReadError.set("");
        return;
      }
      // Scan deep so a creator's older vaults (past the newest 12) stay
      // discoverable for reclaim — the contract has no per-creator index.
      const context = await requireCanonicalVaultContext(app, t("chainContextMismatch"));
      const details = await readRecentVaultDetails(
        app,
        MAX_MY_VAULTS_SCAN,
        context.contractHash,
      );
      const current = await requireCanonicalVaultContext(app, t("chainContextMismatch"));
      if (
        epoch !== myVaultLoadEpoch
        || current.network !== context.network
        || current.contractHash !== context.contractHash
        || !app.chain.address.get()
        || !ownerMatchesAddress(app.chain.address.get()!, wallet)
      ) return;
      const mine = details
        .filter((detail) => ownerMatchesAddress(detail.creator, wallet))
        .map(toMyVault)
        .sort((a, b) => b.created - a.created);
      myVaults.set(mine);
      myVaultsReadError.set("");
    } catch (e) {
      if (epoch !== myVaultLoadEpoch) return;
      if (isContractAddressUnavailableError(e)) {
        myVaults.set([]);
        myVaultsReadError.set("");
        return;
      }
      myVaultsReadError.set(t("myVaultsReadFailed"));
      console.error(
        "[unbreakable-vault] loadMyVaults error:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  /**
   * Create a vault via the deposit-then-act contract flow:
   *   transfer(GAS, "miniapp-unbreakablevault:create") » createVault(...).
   */
  const createVault = async (
    form: VaultCreateForm,
    onSuccess: (vaultId: string) => void,
    loadRecentVaults: () => Promise<void>,
  ): Promise<VaultWriteOutcome | undefined> => {
    if (isCreating.get()) return undefined;
    const releaseOperation = safety.beginOperation();
    isCreating.set(true);
    try {
      safety.assertNoPending();
      const bountyFixed8 = parseBountyFixed8(form.bounty, 100_000_000n);
      if (!bountyFixed8) {
        throw new Error(t("minBountyNote"));
      }
      const difficulty = Number(form.difficulty);
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) {
        throw new Error(t("invalidDifficulty"));
      }
      const normalizedSecret = String(form.secret ?? "").trim();
      const suppliedHash = String(form.secretHash ?? "").trim();
      if (!suppliedHash && !normalizedSecret) {
        throw new Error(t("secretRequired"));
      }
      let secretHashBase64 = "";
      try {
        const hash = suppliedHash || (await sha256Hex(normalizedSecret));
        secretHashBase64 = hashHexToBase64(hash);
      } catch {
        throw new Error(t("invalidSecretHash"));
      }
      const title = String(form.title ?? "").trim().slice(0, 100);
      const description = String(form.description ?? "").trim().slice(0, 300);
      if (!title) throw new Error(t("createNeedTitle"));
      const creator = await app.chain.ensureWallet();
      const context = await requireWritableVaultContext(app, t);
      const beforeTotalVaults = exactUnsignedInteger(await app.chain.readRaw(
        "totalVaults",
        [],
        { scriptHash: context.contractHash },
      ));
      if (beforeTotalVaults === null) throw new Error(t("catalogReadFailed"));
      const draft = await safety.prepare("create", creator, {
        amountFixed8: bountyFixed8,
        difficulty,
        title,
        description,
        secretHashBase64,
        beforeTotalVaults,
      });
      createdVaultId.set(null);

      const args = [
        app.chain.arg.hash160(creator),
        app.chain.arg.byteArray(secretHashBase64),
        app.chain.arg.integer(bountyFixed8),
        app.chain.arg.integer(difficulty),
        app.chain.arg.string(title),
        app.chain.arg.string(description),
      ];

      const onTransactionSent = (id: string) => safety.persistAction(draft, id);
      const result = context.network === "mainnet"
        ? await (() => {
            const receiptId = String(form.receiptId ?? "").trim();
            if (!/^[1-9]\d*$/.test(receiptId)) throw new Error(t("receiptIdRequired"));
            return app.funds.receiptPay({
              operation: "createVault",
              args,
              receiptId,
              scriptHash: context.contractHash,
              waitForEvent: "VaultCreated",
              waitTimeoutMs: VAULT_EVENT_WAIT_MS,
              onTransactionSent,
              notify: "silent",
            });
          })()
        : await app.chain.invokeWithPayment(
            bountyFixed8,
            CREATE_MEMO,
            "createVault",
            args,
            {
              scriptHash: context.contractHash,
              waitForEvent: "VaultCreated",
              waitTimeoutMs: VAULT_EVENT_WAIT_MS,
              onPaymentSent: (id) => safety.persistPayment(draft, id),
              onTransactionSent,
            },
          );
      // Re-persist from the returned txid even if the callback populated the
      // in-memory atom: this readbacks durable storage after broadcast.
      if (result.txid) safety.persistAction(draft, result.txid);
      const pending = safety.pendingOperation.get();
      if (!pending) throw new Error(t("transactionIdUnavailable"));
      if (result.verified === true && result.event && pending) {
        const finalization = await safety.finalize(pending, result.event);
        createdVaultId.set(finalization.vaultId);
        onSuccess(finalization.vaultId);
        await loadRecentVaults();
        await loadMyVaults();
        return { status: "confirmed", finalization };
      }
      return { status: "pending", pending: pending! };
    } catch (error) {
      if (error instanceof VaultVerificationError) throw error;
      const pending = safety.pendingOperation.get();
      if (pending) return { status: "pending", pending };
      throw error;
    } finally {
      isCreating.set(false);
      releaseOperation();
    }
  };

  /**
   * Top up an existing vault's bounty via the deposit-then-act flow:
   *   transfer(GAS, "miniapp-unbreakablevault:create") » increaseBounty(vaultId, amount).
   *
   * Anyone may grow any active vault's bounty (the contract has no creator
   * gate). The amount is GAS; we convert to base units and reuse the create memo
   * the contract's OnNEP17Payment validates. Returns the topped-up vault id so the
   * caller can refresh + toast.
   */
  const increaseBounty = async (
    vaultId: string,
    amountGas: string,
    receiptId?: string,
    onDone?: () => Promise<void>,
  ): Promise<VaultWriteOutcome | undefined> => {
    if (isCreating.get()) return undefined;
    const id = String(vaultId ?? "").trim();
    if (!/^[1-9]\d*$/.test(id)) throw new Error(t("increaseBountyInvalidId"));
    const amountFixed8 = parseBountyFixed8(amountGas, 1n);
    if (!amountFixed8) throw new Error(t("increaseBountyInvalidAmount"));
    const releaseOperation = safety.beginOperation();

    isCreating.set(true);
    try {
      safety.assertNoPending();
      const player = await app.chain.ensureWallet();
      const context = await requireWritableVaultContext(app, t);
      const before = await readVaultDetails(app, id, context.contractHash);
      if (!before || before.id !== id || before.status !== "active") {
        throw new Error(t("vaultNotActive"));
      }
      const draft = await safety.prepare("increase", player, {
        vaultId: id,
        amountFixed8,
        beforeBounty: String(before.bounty),
      });
      const args = [
        app.chain.arg.integer(id),
        app.chain.arg.integer(amountFixed8),
      ];
      const onTransactionSent = (targetTxid: string) => safety.persistAction(draft, targetTxid);
      const result = context.network === "mainnet"
        ? await (() => {
            const normalizedReceipt = String(receiptId ?? "").trim();
            if (!/^[1-9]\d*$/.test(normalizedReceipt)) throw new Error(t("receiptIdRequired"));
            return app.funds.receiptPay({
              operation: "increaseBounty",
              args,
              receiptId: normalizedReceipt,
              scriptHash: context.contractHash,
              waitForEvent: "BountyIncreased",
              waitTimeoutMs: VAULT_EVENT_WAIT_MS,
              onTransactionSent,
              notify: "silent",
            });
          })()
        : await app.chain.invokeWithPayment(
            amountFixed8,
            CREATE_MEMO,
            "increaseBounty",
            args,
            {
              scriptHash: context.contractHash,
              waitForEvent: "BountyIncreased",
              waitTimeoutMs: VAULT_EVENT_WAIT_MS,
              onPaymentSent: (paymentTxid) => safety.persistPayment(draft, paymentTxid),
              onTransactionSent,
            },
          );
      if (result.txid) safety.persistAction(draft, result.txid);
      const pending = safety.pendingOperation.get();
      if (!pending) throw new Error(t("transactionIdUnavailable"));
      if (result.verified === true && result.event && pending) {
        const finalization = await safety.finalize(pending, result.event);
        if (onDone) await onDone();
        await loadMyVaults();
        return { status: "confirmed", finalization };
      }
      return { status: "pending", pending: pending! };
    } catch (error) {
      if (error instanceof VaultVerificationError) throw error;
      const pending = safety.pendingOperation.get();
      if (pending) return { status: "pending", pending };
      throw error;
    } finally {
      isCreating.set(false);
      releaseOperation();
    }
  };

  return {
    address: createObservable(""),
    isCreating,
    myVaults,
    myVaultsReadError,
    createdVaultId,
    loadMyVaults,
    createVault,
    increaseBounty,
  };
}

export type UseVaultCreatorReturn = ReturnType<typeof useVaultCreator>;
