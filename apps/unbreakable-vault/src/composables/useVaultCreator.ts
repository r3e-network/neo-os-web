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
import { toFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import {
  CREATE_MEMO,
  MAX_RECENT_VAULTS,
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
  const bytes = normalized.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
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
      const details = await readRecentVaultDetails(chainService, MAX_RECENT_VAULTS);
      const mine = details
        .filter((detail) => ownerMatchesAddress(detail.creator, wallet))
        .map(toMyVault)
        .sort((a, b) => b.created - a.created);
      myVaults.set(mine);
    } catch (e) {
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
      const amount = Number.parseFloat(form.bounty);
      if (!Number.isFinite(amount) || amount < 1) {
        throw new Error(t("vaultCreateFailed"));
      }
      const bountyFixed8 = toFixed8(form.bounty);
      if (bountyFixed8 === "0") {
        throw new Error(t("vaultCreateFailed"));
      }
      const difficulty = Number(form.difficulty);
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) {
        throw new Error(t("vaultCreateFailed"));
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

  return {
    address: createObservable(""),
    isCreating,
    myVaults,
    createdVaultId,
    loadMyVaults,
    createVault,
  };
}

export type UseVaultCreatorReturn = ReturnType<typeof useVaultCreator>;
