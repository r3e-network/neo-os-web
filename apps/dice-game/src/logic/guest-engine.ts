/**
 * Guest (free / local) engine for the Dice Game.
 *
 * Guest mode is a purely LOCAL casino dice table: the roll is drawn with the
 * Web-Crypto RNG (the local analog of the enclave/native randomness), the
 * win/score is resolved entirely client-side, and the running win count is
 * (optionally) submitted to the OFF-CHAIN guest leaderboard. The engine drives
 * the SAME observables + dispatch actions the Phaser scene already reads
 * (selectedFace / stakeAmount / payoutPreview / isResolving / lastRoll /
 * lastOutcome / lastStatus / rollHistory), so the frozen scene contract is
 * reused verbatim. It NEVER makes a chain, oracle, or reward call — the
 * framework guest guard therefore never fires.
 *
 * This is the (b) "chance game, no engine" recipe from the adoption contract: a
 * faithful single-player RNG simulation of the dice mechanic.
 */
import type { BetTracker } from "../bet-tracker";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

// Mirrors the deployed 5.70x payout (see main.tsx / DiceScene PAYOUT_MULT).
const PAYOUT_MULT = 5.7;
// Let the tumble animation play before the local result is revealed. The scene
// keeps "rolling" while isResolving is true, so this is purely cosmetic pacing.
const REVEAL_MS = 1100;
const REDUCED_MOTION_REVEAL_MS = 120;
const MIN_STAKE = 0.05;
const MAX_STAKE = 20;

export interface DiceGuestEngineDeps {
  tracker: BetTracker;
  selectedFace: Obs<string>;
  stakeAmount: Obs<string>;
  payoutPreview: Obs<string>;
  lastStatus: Obs<string>;
  isSubmitting: Obs<boolean>;
  chainLabel: Obs<string>;
  houseLiquidity: Obs<number>;
  directCredit: Obs<number>;
  maxPayableStake: Obs<number>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface DiceBetForm {
  chosenNumber?: unknown;
  amount?: unknown;
}

export interface DiceGuestEngine {
  placeDiceBet(form: DiceBetForm): void;
  /** No-op local acknowledgements for chain-only actions (never reached via the scene). */
  withdrawCredit(): void;
  fundGameCredit(): void;
  recheckSettlement(): void;
  /** Reset to a clean local table + zero the on-chain-only counters (on entering guest). */
  enter(): Promise<void>;
}

function sanitizeFace(value: unknown): number {
  const face = Number(value);
  if (!Number.isInteger(face) || face < 1 || face > 6) return 6;
  return face;
}

function sanitizeStake(value: unknown): number {
  const raw = Number(String(value ?? "").trim());
  if (!Number.isFinite(raw) || raw <= 0) return 0.1;
  return Math.min(MAX_STAKE, Math.max(MIN_STAKE, raw));
}

/**
 * Draw an unbiased local die with rejection sampling.
 *
 * 252 is the largest multiple of six below 256, so accepting only bytes below
 * that boundary gives every face exactly 42 source values. A missing browser
 * CSPRNG fails closed instead of quietly downgrading to non-cryptographic input.
 */
export function rollLocalDie(
  cryptoSource: Pick<Crypto, "getRandomValues"> | undefined = globalThis.crypto,
): number | null {
  if (!cryptoSource?.getRandomValues) return null;
  const sample = new Uint8Array(1);
  for (let attempt = 0; attempt < 128; attempt += 1) {
    cryptoSource.getRandomValues(sample);
    const value = sample[0]!;
    if (value < 252) return (value % 6) + 1;
  }
  return null;
}

export function createDiceGuestEngine(deps: DiceGuestEngineDeps): DiceGuestEngine {
  const {
    tracker,
    selectedFace,
    stakeAmount,
    payoutPreview,
    lastStatus,
    isSubmitting,
    chainLabel,
    houseLiquidity,
    directCredit,
    maxPayableStake,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Running number of wins this local session — the guest leaderboard metric.
  let guestWins = 0;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;

  const payoutOf = (stake: number): number => stake * PAYOUT_MULT;

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* off-chain board unreachable / no wallet — guest scores are best-effort */
    }
  };

  return {
    placeDiceBet(form: DiceBetForm): void {
      // Local re-entry guard: one bet resolves at a time (the reveal is delayed).
      if (tracker.isResolving.get() || isSubmitting.get()) return;

      const face = sanitizeFace(form.chosenNumber);
      const stake = sanitizeStake(form.amount);
      const stakeDisplay = stake.toFixed(2);
      const payout = payoutOf(stake).toFixed(2);
      const guestUnit = t("guestUnit");

      // Reflect the chosen bet on the shared observables (HUD + scene read them).
      selectedFace.set(String(face));
      stakeAmount.set(`${stakeDisplay} ${guestUnit}`);
      payoutPreview.set(`${payout} ${guestUnit}`);

      // Draw before opening a pending row. If the browser CSPRNG is unavailable,
      // the local table stays idle and makes no fairness claim it cannot uphold.
      const rolled = rollLocalDie();
      if (rolled === null) {
        const message = t("guestRandomUnavailable");
        lastStatus.set(message);
        setStatus(message, "error");
        return;
      }

      // Start the roll: beginBet flips isResolving → the scene tumbles the die.
      const rowId = tracker.beginBet({
        face: String(face),
        stake: `${stakeDisplay} ${guestUnit}`,
        result: t("statusRolling"),
        payout: `${payout} ${guestUnit}`,
        outcome: "pending",
        at: new Date().toISOString(),
      });
      lastStatus.set(t("statusRolling"));

      // Reveal the already-drawn outcome after the tumble so the animation reads
      // naturally. No chain/oracle call is ever made.
      const won = rolled === face;

      const reduceMotion = typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      revealTimer = setTimeout(() => {
        revealTimer = null;
        const label = won ? t("outcomeWon") : t("outcomeLost");
        tracker.settleBet(rowId, {
          outcome: won ? "won" : "lost",
          rolled,
          result: `${label} · ${t("rolledLabel")} ${rolled}`,
          payout: won ? `${payout} ${guestUnit}` : `0 ${guestUnit}`,
        });
        if (won) {
          guestWins += 1;
          lastStatus.set(t("statusWon"));
          setStatus(t("statusWon"), "success");
          void submitScore(guestWins);
        } else {
          lastStatus.set(t("statusLost"));
          setStatus(t("statusLost"), "info");
        }
      }, reduceMotion ? REDUCED_MOTION_REVEAL_MS : REVEAL_MS);
    },

    withdrawCredit(): void {
      setStatus(t("noCreditToWithdraw"), "info");
    },

    fundGameCredit(): void {
      /* No credit concept in guest — nothing to fund. */
    },

    recheckSettlement(): void {
      /* Guest bets settle locally and instantly — nothing to re-poll. */
    },

    async enter(): Promise<void> {
      if (revealTimer) {
        clearTimeout(revealTimer);
        revealTimer = null;
      }
      guestWins = 0;
      // Reset to a clean local table.
      tracker.rollHistory.set([]);
      tracker.lastRoll.set("");
      tracker.lastOutcome.set("");
      tracker.lastPayout.set("");
      tracker.isResolving.set(false);
      tracker.isUnresolved.set(false);
      isSubmitting.set(false);
      lastStatus.set(t("statusReady"));
      // Zero the on-chain-only counters so a prior gamefi read (from the
      // mount-time loadData) never bleeds into the guest surface, and the
      // credit/withdraw chrome stays hidden.
      chainLabel.set("");
      houseLiquidity.set(0);
      directCredit.set(0);
      maxPayableStake.set(0);
    },
  };
}
