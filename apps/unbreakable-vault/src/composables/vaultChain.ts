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

import type { MiniAppFramework } from "@shared/react";

/** Deposit memo for createVault — prepays the bounty. */
export const CREATE_MEMO = "miniapp-unbreakablevault:create";

/** Deposit memo for attemptBreak — prepays the attempt fee. */
export const ATTEMPT_MEMO = "miniapp-unbreakablevault:attempt";

/** How many of the newest vaults to enumerate for the public catalog. */
export const MAX_RECENT_VAULTS = 12;

/**
 * How deep to enumerate when filtering by creator ("My Vaults"). The contract
 * has no per-creator index, so a creator's older vaults disappear from a shallow
 * 12-vault scan; scan deeper so reclaim stays discoverable.
 */
export const MAX_MY_VAULTS_SCAN = 200;

/** Hard cap on how many vaults to enumerate (defensive). */
const MAX_ENUMERATE = 200;

/** Static preview / hostless loads have no wallet contract binding yet. */
export function isContractAddressUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /contract address (not configured|unavailable)|wallet not detected|compatible neo wallet/i.test(message);
}

/** Normalized view of a getVaultDetails() Map. */
export interface ChainVaultDetails {
  id: string;
  creator: string;
  /** GAS base units. Kept as a decimal string so large values never round. */
  bounty: string;
  attemptCount: number;
  difficulty: number;
  difficultyName: string;
  /** GAS base units. Kept as a decimal string so large values never round. */
  attemptFee: string;
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
 * Preserve exact non-negative contract integers without turning malformed reads
 * into a believable zero. Large values must arrive as decimal strings/bigints;
 * unsafe JavaScript numbers are rejected because they have already rounded.
 */
export function exactUnsignedInteger(value: unknown): string | null {
  if (typeof value === "bigint") return value >= 0n ? value.toString() : null;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  }
  const normalized = String(value ?? "").trim();
  return /^\d+$/.test(normalized) ? BigInt(normalized).toString() : null;
}

function exactSafeUnsignedInteger(value: unknown): number | null {
  const exact = exactUnsignedInteger(value);
  if (exact === null) return null;
  const parsed = BigInt(exact);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
}

function exactBoolean(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
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

  const requestedId = exactUnsignedInteger(vaultId);
  const returnedId = exactUnsignedInteger(record.id ?? vaultId);
  const bounty = exactUnsignedInteger(record.bounty);
  const attemptFee = exactUnsignedInteger(record.attemptFee);
  const attemptCount = exactSafeUnsignedInteger(record.attemptCount);
  const difficulty = exactSafeUnsignedInteger(record.difficulty);
  const createdTime = exactSafeUnsignedInteger(record.createdTime);
  const expiryTime = exactSafeUnsignedInteger(record.expiryTime);
  const hintsRevealed = exactSafeUnsignedInteger(record.hintsRevealed);
  const broken = exactBoolean(record.broken);
  const expired = exactBoolean(record.expired);
  if (
    !requestedId
    || requestedId === "0"
    || !returnedId
    || returnedId !== requestedId
    || bounty === null
    || attemptFee === null
    || attemptCount === null
    || difficulty === null
    || difficulty < 1
    || difficulty > 3
    || createdTime === null
    || expiryTime === null
    || expiryTime < createdTime
    || hintsRevealed === null
    || broken === null
    || expired === null
  ) return null;

  const creatorRaw = String(record.creator ?? "");
  if (!creatorRaw || isZeroHash(creatorRaw)) return null;

  const winnerRaw = String(record.winner ?? "");
  const winner = isZeroHash(winnerRaw) ? "" : winnerRaw;

  const rawStatus = String(record.status ?? "").trim().toLowerCase();
  const allowedStatuses = ["active", "broken", "expired", "claimable", "reclaimed"];
  if (rawStatus && !allowedStatuses.includes(rawStatus)) return null;
  const status = rawStatus || (broken ? "broken" : expired ? "expired" : "active");

  return {
    id: returnedId,
    creator: creatorRaw,
    bounty,
    attemptCount,
    difficulty,
    difficultyName: String(record.difficultyName ?? ""),
    attemptFee,
    createdTime,
    expiryTime,
    hintsRevealed,
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
  app: MiniAppFramework,
  vaultId: string,
  scriptHash?: string,
): Promise<ChainVaultDetails | null> {
  const raw = await app.chain.readRaw("getVaultDetails", [
    app.chain.arg.integer(vaultId),
  ], scriptHash ? { scriptHash } : undefined);
  return parseVaultDetails(vaultId, raw);
}

/**
 * Enumerate the newest `limit` vaults from the contract.
 *
 * Vaults are sequential ids 1..totalVaults(); we read from the highest id down.
 * A failed/empty read for an individual id makes the snapshot incomplete. The
 * caller keeps its last verified catalog and surfaces a read error instead of
 * presenting a partial list as authoritative or mistaking it for zero vaults.
 */
export async function readRecentVaultDetails(
  app: MiniAppFramework,
  limit: number,
  scriptHash?: string,
): Promise<ChainVaultDetails[]> {
  const totalRaw = await app.chain.readRaw(
    "totalVaults",
    [],
    scriptHash ? { scriptHash } : undefined,
  );
  const total = exactUnsignedInteger(totalRaw);
  if (total === null) throw new Error("Vault catalog total is malformed");
  const highestId = BigInt(total);
  const requested = Number.isFinite(limit)
    ? Math.min(Math.max(0, Math.trunc(limit)), MAX_ENUMERATE)
    : 0;
  const count = Number(
    highestId < BigInt(requested) ? highestId : BigInt(requested),
  );
  if (count <= 0) return [];

  const ids = Array.from(
    { length: count },
    (_, index) => (highestId - BigInt(index)).toString(),
  );

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await readVaultDetails(app, id, scriptHash);
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

  if (results.some((detail) => detail === null)) {
    throw new Error("Vault catalog read incomplete");
  }

  return results.filter(
    (detail): detail is ChainVaultDetails => detail !== null,
  );
}
