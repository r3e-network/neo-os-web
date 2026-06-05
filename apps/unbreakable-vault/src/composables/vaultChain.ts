/**
 * vaultChain — shared on-chain helpers for the MiniAppUnbreakableVault contract.
 *
 * Centralises the contract's deposit memos and the read model used by both the
 * creator and breaker composables. All values are verified against the deployed
 * ABI + the live-validate harness
 * (deploy/scripts/live_validate_remaining_contracts_part1.js, "vault" section).
 *
 *   Deposit memos (GAS transfer to the contract):
 *     create  → "miniapp-unbreakablevault:create"  (prepays the vault bounty)
 *     attempt → "miniapp-unbreakablevault:attempt" (prepays a break attempt fee)
 *
 *   Reads:
 *     totalVaults()            -> Integer (vaults are ids 1..totalVaults)
 *     getVaultDetails(vaultId) -> Map (see ChainVaultDetails)
 *
 *   Attempt fees by difficulty (base units, GAS) come from getVaultConstants():
 *     Easy=0.1 GAS, Medium=0.5 GAS, Hard=1 GAS.
 */

import type { ChainService } from "@shared/services/ChainService";
import { toSafeNumber } from "@shared/utils/format";

/** Deposit memo for createVault — prepays the bounty. */
export const CREATE_MEMO = "miniapp-unbreakablevault:create";

/** Deposit memo for attemptBreak — prepays the attempt fee. */
export const ATTEMPT_MEMO = "miniapp-unbreakablevault:attempt";

/** Default attempt fee fallback in GAS base units (0.1 GAS = Easy tier). */
export const DEFAULT_ATTEMPT_FEE_BASE = "10000000";

/** How many of the newest vaults to enumerate per catalog refresh. */
export const MAX_RECENT_VAULTS = 12;

/** Hard cap on how many vaults to enumerate (defensive). */
const MAX_ENUMERATE = 200;

/** Normalized view of a getVaultDetails() Map. */
export interface ChainVaultDetails {
  id: string;
  creator: string;
  bounty: number;
  attemptCount: number;
  difficulty: number;
  difficultyName: string;
  attemptFee: number;
  createdTime: number;
  expiryTime: number;
  hintsRevealed: number;
  broken: boolean;
  expired: boolean;
  winner: string;
  title: string;
  description: string;
  /** One of "active" | "broken" | "expired" | "claimable". */
  status: string;
}

/** A 20-byte all-zero script hash decodes as a null/unset address. */
function isZeroHash(value: string): boolean {
  const cleaned = value.replace(/^0x/i, "");
  return cleaned === "" || /^0+$/.test(cleaned) || !/[1-9a-fA-F]/.test(cleaned);
}

/**
 * Coerce a getVaultDetails() Map into a ChainVaultDetails. Returns null when the
 * vault does not exist (no creator / zeroed creator hash).
 */
export function parseVaultDetails(
  vaultId: string,
  raw: unknown,
): ChainVaultDetails | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const creatorRaw = String(record.creator ?? "");
  if (!creatorRaw || isZeroHash(creatorRaw)) return null;

  const winnerRaw = String(record.winner ?? "");
  const winner = isZeroHash(winnerRaw) ? "" : winnerRaw;

  const broken = Boolean(record.broken);
  const expired = Boolean(record.expired);
  const status =
    String(record.status ?? "") ||
    (broken ? "broken" : expired ? "expired" : "active");

  return {
    id: String(record.id ?? vaultId),
    creator: creatorRaw,
    bounty: toSafeNumber(record.bounty),
    attemptCount: toSafeNumber(record.attemptCount),
    difficulty: toSafeNumber(record.difficulty),
    difficultyName: String(record.difficultyName ?? ""),
    attemptFee: toSafeNumber(record.attemptFee),
    createdTime: toSafeNumber(record.createdTime),
    expiryTime: toSafeNumber(record.expiryTime),
    hintsRevealed: toSafeNumber(record.hintsRevealed),
    broken,
    expired,
    winner,
    title: String(record.title ?? ""),
    description: String(record.description ?? ""),
    status,
  };
}

/** Read a single vault's details from the contract. */
export async function readVaultDetails(
  chain: ChainService,
  vaultId: string,
): Promise<ChainVaultDetails | null> {
  const raw = await chain.read("getVaultDetails", [
    { type: "Integer", value: vaultId },
  ]);
  return parseVaultDetails(vaultId, raw);
}

/**
 * Enumerate the newest `limit` vaults from the contract.
 *
 * Vaults are sequential ids 1..totalVaults(); we read from the highest id down.
 * A failed/empty read for an individual id is skipped rather than failing the
 * whole list.
 */
export async function readRecentVaultDetails(
  chain: ChainService,
  limit: number,
): Promise<ChainVaultDetails[]> {
  const total = toSafeNumber(await chain.read("totalVaults", []));
  const top = Math.min(total, MAX_ENUMERATE);
  if (top <= 0) return [];

  const ids: string[] = [];
  const lowest = Math.max(1, top - limit + 1);
  for (let id = top; id >= lowest; id -= 1) ids.push(String(id));

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await readVaultDetails(chain, id);
      } catch (e) {
        console.warn(
          "[unbreakable-vault] getVaultDetails failed for",
          id,
          ":",
          e instanceof Error ? e.message : String(e),
        );
        return null;
      }
    }),
  );

  return results.filter((detail): detail is ChainVaultDetails => detail !== null);
}
