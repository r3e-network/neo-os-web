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

// Mirrors the deployed 5.70x payout (see main.tsx / DiceScene PAYOUT_MULT).
const PAYOUT_MULT = 5.7;
// The local currency word shown in guest history rows. The scene/HUD reframe
// the "GAS" token to this same word so no GAS-at-stake framing leaks in guest.
const GUEST_UNIT = "chips";
// Let the tumble animation play before the local result is revealed. The scene
// keeps "rolling" while isResolving is true, so this is purely cosmetic pacing.
const REVEAL_MS = 1100;
const MIN_STAKE = 0.05;
const MAX_STAKE = 20;

/** Structural (method-syntax → bivariant) observable handle. */
interface Obs<T> {
  get(): T;
  set(value: T): void;
}

/** Off-chain guest leaderboard surface (app.mode.guestLeaderboard). */
interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

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

/** Web-Crypto (Math.random fallback) die roll in 1..6. */
function rollDie(): number {
  const buf = new Uint32Array(1);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(buf);
    return (buf[0]! % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
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

      // Reflect the chosen bet on the shared observables (HUD + scene read them).
      selectedFace.set(String(face));
      stakeAmount.set(`${stakeDisplay} GAS`);
      payoutPreview.set(`${payout} GAS`);

      // Start the roll: beginBet flips isResolving → the scene tumbles the die.
      const rowId = tracker.beginBet({
        face: String(face),
        stake: `${stakeDisplay} ${GUEST_UNIT}`,
        result: t("statusRolling"),
        payout: `${payout} ${GUEST_UNIT}`,
        outcome: "pending",
        at: new Date().toISOString(),
      });
      lastStatus.set(t("statusRolling"));

      // Draw the outcome now (crypto RNG) but reveal it after the tumble so the
      // animation reads naturally. No chain/oracle call is ever made.
      const rolled = rollDie();
      const won = rolled === face;

      revealTimer = setTimeout(() => {
        revealTimer = null;
        const label = won ? t("outcomeWon") : t("outcomeLost");
        tracker.settleBet(rowId, {
          outcome: won ? "won" : "lost",
          rolled,
          result: `${label} · 🎲 ${rolled}`,
          payout: won ? `${payout} ${GUEST_UNIT}` : `0 ${GUEST_UNIT}`,
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
      }, REVEAL_MS);
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
