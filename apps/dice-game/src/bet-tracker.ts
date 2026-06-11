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
  /** Pre-translated row result label (e.g. "Won · 🎲 4"). */
  result: string;
  /** Pre-formatted payout (e.g. "2.85 GAS" or "0 GAS"). */
  payout: string;
};

const HISTORY_LIMIT = 6;

export function createBetTracker() {
  const rollHistory = createObservable<RollHistoryItem[]>([]);
  const lastRoll = createObservable(""); // the active bet's settled face (1..6), revealed
  const lastOutcome = createObservable<RollOutcome>("");
  const isResolving = createObservable(false); // active bet placed, awaiting settlement

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
    isResolving.set(true);
    return id;
  };

  /** Record an untracked row (e.g. a failed bet whose stake already left). */
  const recordRow = (row: Omit<RollHistoryItem, "id">): string => unshiftRow(row);

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
      isResolving.set(false);
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
    }
  };

  return {
    rollHistory,
    lastRoll,
    lastOutcome,
    isResolving,
    beginBet,
    recordRow,
    settleBet,
    markUnresolved,
  };
}

export type BetTracker = ReturnType<typeof createBetTracker>;
