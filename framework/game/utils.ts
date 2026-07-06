/**
 * Shared game utility functions used across all miniapp reward games.
 *
 * These replace the repetitive local helpers (playerScriptHash, asNumber,
 * shortHash, parseLeaderboard, formatPayout) that every game's main.tsx
 * previously redeclared independently.
 *
 * Migrated from apps/shared/game/utils.ts; imports now use @shared/ alias.
 */

import { addressToScriptHash } from "@shared/utils/neo";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import { eventHashMatches, normalizedHash } from "@shared/gamefi";
import type { LeaderEntry, SolveRow, SolvedEventSlots } from "./types";

// ─── Address / hash helpers ───────────────────────────────────────────────────

/**
 * Convert a Neo N3 wallet address to its script-hash string (0x-prefixed hex).
 * Returns "" when `address` is null or empty — use the empty check to guard
 * reads that require a connected wallet.
 */
export function toScriptHash(address: string | null | undefined): string {
  if (!address) return "";
  return addressToScriptHash(address);
}

/**
 * Truncate an address or hex string for display:
 * `NXabc...xyz` → `NXabc…xyz`
 */
export function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Truncate a Neo address for compact leaderboard display.
 */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr ?? "---";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Number parsing ───────────────────────────────────────────────────────────

/**
 * Parse a raw chain value (BigInt, string, number) to a JavaScript number.
 * Returns 0 on failure rather than NaN to prevent display glitches.
 */
export function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

// ─── GAS formatting ───────────────────────────────────────────────────────────

/**
 * Convert fixed8 bigint/number/string to a floating-point GAS amount.
 */
export function gasFromFixed8(fixed8: unknown): number {
  return fromFixed8(parseBigInt(fixed8));
}

/**
 * Format a GAS amount (already floating-point) to "X.XX GAS" display string.
 */
export function formatGas(amount: number, maxDecimals = 2): string {
  if (!Number.isFinite(amount) || amount < 0) return "0.00 GAS";
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  })} GAS`;
}

/**
 * Format a fixed8 raw value to "X.XX GAS" display string.
 */
export function formatFixed8Gas(fixed8: unknown, maxDecimals = 2): string {
  return formatGas(gasFromFixed8(fixed8), maxDecimals);
}

// ─── Leaderboard builder ──────────────────────────────────────────────────────

const DEFAULT_SLOTS: Required<SolvedEventSlots> = {
  gameId:       0,
  player:       1,
  difficulty:   2,
  elapsedMs:    3,
  solvedPayout: 4,
  totalWon:     5,
  undos:        6,
};

/**
 * Build a ranked leaderboard from raw Solved events (returned by
 * `app.chain.events("Solved", {limit})`).
 *
 * Takes the MAX totalWon per player and ranks by descending totalWon.
 * Also extracts the caller's own history rows from the same event scan.
 */
export function buildLeaderboard<TRow extends SolveRow = SolveRow>(
  events: unknown[],
  playerHash: string,
  slots: SolvedEventSlots = {},
  extraRowFields?: (ev: unknown) => Partial<TRow>,
): { ranked: LeaderEntry[]; mine: TRow[] } {
  const s = { ...DEFAULT_SLOTS, ...slots } as Required<SolvedEventSlots>;
  const bestByPlayer = new Map<string, { totalWon: number; solves: number; raw: unknown }>();
  const mine: TRow[] = [];

  for (const ev of events) {
    const who = normalizedHash(eventStateValue(ev, s.player));
    if (!who) continue;
    const totalWon = gasFromFixed8(eventStateValue(ev, s.totalWon));
    const prior = bestByPlayer.get(who);
    bestByPlayer.set(who, {
      totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
      solves: (prior?.solves ?? 0) + 1,
      raw: eventStateValue(ev, s.player),
    });
    if (playerHash && eventHashMatches(eventStateValue(ev, s.player), playerHash)) {
      const payout = gasFromFixed8(eventStateValue(ev, s.solvedPayout));
      const base: SolveRow = {
        gameId:     String(parseBigInt(eventStateValue(ev, s.gameId)) ?? ""),
        difficulty: asNumber(eventStateValue(ev, s.difficulty)),
        payout:     `${payout.toFixed(2)} GAS`,
        solveMs:    asNumber(eventStateValue(ev, s.elapsedMs)),
        undos:      asNumber(eventStateValue(ev, s.undos)),
      };
      mine.push({ ...base, ...(extraRowFields?.(ev) ?? {}) } as TRow);
    }
  }

  const ranked: LeaderEntry[] = [...bestByPlayer.entries()]
    .map(([address, entry]) => ({
      address,
      totalWon: entry.totalWon,
      solves:   entry.solves,
      isUser:   playerHash ? eventHashMatches(entry.raw, playerHash) : false,
    }))
    .sort((a, b) => b.totalWon - a.totalWon)
    .map((entry, idx) => ({ rank: idx + 1, ...entry }));

  return { ranked, mine: mine.reverse().slice(0, 20) };
}
