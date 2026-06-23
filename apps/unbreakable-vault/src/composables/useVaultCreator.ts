/**
 * useVaultCreator — Vault creation + "my vaults" listing
 *
 * Talks DIRECTLY to the standalone MiniAppUnbreakableVault contract via
 * ctx.services.chain. The earlier path routed reads through ctx.os.storage and
 * badges through ctx.os.badge — both backed by the Morpheus OS kernel/edge,
 * which is offline, so the app was broken at runtime.
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
import type { ChainService } from "@shared/services/ChainService";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { sha256Hex } from "@shared/utils/hash";
import { parsePositiveFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import {
  CREATE_MEMO,
  MAX_MY_VAULTS_SCAN,
  isContractAddressUnavailableError,
  readRecentVaultDetails,
  type ChainVaultDetails,
} from "./vaultChain";

// ============================================================================
// Types
// ============================================================================

export interface MyVault {
  id: string;
  bounty: number;
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
}

export interface UseVaultCreatorOptions {
  /** Shared chain service for wallet-signed direct contract calls + reads. */
  chainService: ChainService;
  /** EventBus for UI events. */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function. */
  t: (key: string) => string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Read a single state slot from a VaultCreated event payload. */
function eventSlot(entry: unknown, index: number): unknown {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
}

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
  const normalized = hash.replace(/^0x/i, "");
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
  chainService,
  eventBus,
  t,
}: UseVaultCreatorOptions) {
  const myVaults = createObservable<MyVault[]>([]);
  const createdVaultId = createObservable<string | null>(null);
  const isCreating = createObservable(false);

  /**
   * Load vaults created by the current wallet by enumerating the most recent
   * vaults on-chain and filtering by creator. Newest first.
   */
  const loadMyVaults = async () => {
    try {
      const wallet = chainService.address.get();
      if (!wallet) {
        myVaults.set([]);
        return;
      }
      // Scan deep so a creator's older vaults (past the newest 12) stay
      // discoverable for reclaim — the contract has no per-creator index.
      const details = await readRecentVaultDetails(
        chainService,
        MAX_MY_VAULTS_SCAN,
      );
      const mine = details
        .filter((detail) => ownerMatchesAddress(detail.creator, wallet))
        .map(toMyVault)
        .sort((a, b) => b.created - a.created);
      myVaults.set(mine);
    } catch (e) {
      if (isContractAddressUnavailableError(e)) {
        myVaults.set([]);
        return;
      }
      console.error(
        "[unbreakable-vault] loadMyVaults error:",
        e instanceof Error ? e.message : String(e),
      );
      eventBus.emit("vault:error", { message: "My vaults unavailable" });
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
  ) => {
    if (isCreating.get()) return;
    isCreating.set(true);
    try {
      const bountyFixed8 = parseBountyFixed8(form.bounty, 100_000_000n);
      if (!bountyFixed8) {
        throw new Error(t("minBountyNote"));
      }
      const difficulty = Number(form.difficulty);
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) {
        throw new Error(t("invalidDifficulty"));
      }
      if (!form.secretHash && !form.secret.trim()) {
        throw new Error(t("secretRequired"));
      }
      const hash = form.secretHash || (await sha256Hex(form.secret));
      const creator = await chainService.ensureWallet();

      const result = await chainService.invokeWithPayment(
        bountyFixed8,
        CREATE_MEMO,
        "createVault",
        [
          { type: "Hash160", value: creator },
          { type: "ByteArray", value: hashHexToBase64(hash) },
          { type: "Integer", value: bountyFixed8 },
          { type: "Integer", value: String(difficulty) },
          { type: "String", value: form.title.trim().slice(0, 100) },
          { type: "String", value: form.description.trim().slice(0, 300) },
        ],
        { waitForEvent: "VaultCreated" },
      );

      // The new vault id is the first slot of the VaultCreated event.
      const eventId = parseBigInt(eventSlot(result.event, 0));
      const vaultId = eventId > 0n ? eventId.toString() : "";

      if (vaultId) {
        createdVaultId.set(vaultId);
      }

      eventBus.emit("vault:created", { action: t("vaultCreated") });

      onSuccess(vaultId);
      await loadRecentVaults();
      await loadMyVaults();
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("vaultCreateFailed"),
      });
      throw e;
    } finally {
      isCreating.set(false);
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
    onDone?: () => Promise<void>,
  ): Promise<{ vaultId: string; amountGas: string }> => {
    if (isCreating.get()) return { vaultId, amountGas: "0" };
    const id = String(vaultId ?? "").trim();
    if (!/^[1-9]\d*$/.test(id)) throw new Error(t("increaseBountyInvalidId"));
    const amountFixed8 = parseBountyFixed8(amountGas, 1n);
    if (!amountFixed8) throw new Error(t("increaseBountyInvalidAmount"));

    isCreating.set(true);
    try {
      await chainService.ensureWallet();
      await chainService.invokeWithPayment(
        amountFixed8,
        CREATE_MEMO,
        "increaseBounty",
        [
          { type: "Integer", value: id },
          { type: "Integer", value: amountFixed8 },
        ],
        { waitForEvent: "BountyIncreased" },
      );

      eventBus.emit("vault:bounty_increased", { vaultId: id, amountGas });
      if (onDone) await onDone();
      await loadMyVaults();
      return { vaultId: id, amountGas };
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("increaseBountyFailed"),
      });
      throw e;
    } finally {
      isCreating.set(false);
    }
  };

  return {
    address: createObservable(""),
    isCreating,
    myVaults,
    createdVaultId,
    loadMyVaults,
    createVault,
    increaseBounty,
  };
}

export type UseVaultCreatorReturn = ReturnType<typeof useVaultCreator>;
