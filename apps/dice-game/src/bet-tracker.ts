/**
 * Per-bet settlement tracking for the dice game.
 *
 * Each placed bet gets its own history row id; settlement updates the MATCHING
 * row instead of blindly rewriting row 0, so two interleaved bets can never
 * stomp each other's result. The shared reveal state (lastRoll / lastOutcome /
 * isResolving) follows only the ACTIVE bet — the most recently placed one —
 * while older bets settle silently into their own history rows.
 */

import { createObservable } from "@shared/react";
import type { RollOutcome } from "./dice-logic";

export type RollHistoryItem = {
  id: string;
  face: string;
  stake: string;
  result: string;
  payout: string;
  outcome?: RollOutcome;
  rolled?: string;
  txid?: string;
  at: string;
};

export type BetSettlement = {
  outcome: RollOutcome;
  /** The settled face (1..6), or 0 when unknown (e.g. a refund). */
  rolled: number;
  /** Pre-translated row result label (e.g. "Won · Rolled 4"). */
  result: string;
  /** Pre-formatted payout (e.g. "2.85 GAS" or "0 GAS"). */
  payout: string;
};

const HISTORY_LIMIT = 6;

export function createBetTracker() {
  const rollHistory = createObservable<RollHistoryItem[]>([]);
  const lastRoll = createObservable(""); // the active bet's settled face (1..6), revealed
  const lastOutcome = createObservable<RollOutcome>("");
  const lastPayout = createObservable("");
  const isResolving = createObservable(false); // active bet placed, awaiting settlement
  // The active bet's settlement poll gave up without a result (the VRF oracle
  // has not called back yet). Distinct from isResolving so the UI can show a
  // definite "settlement pending — check again" state instead of a frozen
  // spinner. Cleared whenever a new active bet begins or the active bet settles.
  const isUnresolved = createObservable(false);

  let seq = 0;
  let activeBetId: string | null = null;

  const unshiftRow = (row: Omit<RollHistoryItem, "id">): string => {
    seq += 1;
    const id = `bet-${seq}`;
    rollHistory.set([{ id, ...row }, ...rollHistory.get()].slice(0, HISTORY_LIMIT));
    return id;
  };

  /**
   * Track a freshly broadcast bet: prepend its history row, make it the active
   * bet and switch the reveal state to "rolling".
   */
  const beginBet = (row: Omit<RollHistoryItem, "id">): string => {
    const id = unshiftRow(row);
    activeBetId = id;
    lastRoll.set("");
    lastOutcome.set("pending");
    lastPayout.set("");
    isResolving.set(true);
    isUnresolved.set(false);
    return id;
  };

  /** Record an untracked row (e.g. a failed bet whose stake already left). */
  const recordRow = (row: Omit<RollHistoryItem, "id">): string => unshiftRow(row);

  /**
   * Seed the history from already-settled chain rows (e.g. on reload, so a
   * refresh during the resolve loop doesn't lose the payout that DID land
   * on-chain). Rows arrive newest-first and only seed when the history is empty,
   * so a live session's in-memory rows are never overwritten. Returns the count
   * seeded.
   */
  const seedSettled = (rows: Array<Omit<RollHistoryItem, "id">>): number => {
    if (rollHistory.get().length > 0 || rows.length === 0) return 0;
    const seeded = rows.slice(0, HISTORY_LIMIT).map((row) => {
      seq += 1;
      return { id: `bet-${seq}`, ...row };
    });
    rollHistory.set(seeded);
    return seeded.length;
  };

  /**
   * Settle a bet into ITS OWN history row (matched by id — a later bet may
   * occupy row 0 by now). The reveal state only updates when the settling bet
   * is still the active one; returns whether it was, so the caller can scope
   * status banners/fireworks to the bet the user is actually watching.
   */
  const settleBet = (id: string, settlement: BetSettlement): boolean => {
    const { outcome, rolled, result, payout } = settlement;
    rollHistory.set(
      rollHistory.get().map((row) =>
        row.id === id
          ? { ...row, result, payout, outcome, rolled: rolled ? String(rolled) : "" }
          : row,
      ),
    );
    const isActive = id === activeBetId;
    if (isActive) {
      lastRoll.set(rolled ? String(rolled) : "");
      lastOutcome.set(outcome);
      lastPayout.set(payout);
      isResolving.set(false);
      isUnresolved.set(false);
    }
    return isActive;
  };

  /**
   * A bet's settlement poll gave up — its row stays "rolling". Only the active
   * bet's spinner is cleared, so an older bet timing out never hides the
   * rolling state of a newer one.
   */
  const markUnresolved = (id: string) => {
    if (id === activeBetId) {
      isResolving.set(false);
      isUnresolved.set(true);
    }
  };

  return {
    rollHistory,
    lastRoll,
    lastOutcome,
    lastPayout,
    isResolving,
    isUnresolved,
    beginBet,
    recordRow,
    settleBet,
    seedSettled,
    markUnresolved,
  };
}

export type BetTracker = ReturnType<typeof createBetTracker>;
