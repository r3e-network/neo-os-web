/**
 * game-credits — the shared app-side glue for the platform Credits v2 lane
 * (`app.credits`, framework/credits.ts). Reference integration used by the
 * game fleet (color-clash, flappy-dash first) for the three credit touch
 * points every game exposes identically:
 *
 * - HUD balance chip (`creditsBalance` / `creditsStale` observables),
 * - fail-overlay "instant retry with credits" offer (`retryWithCredits`
 *   action: one feeless DB-first `spend`, then the game's own restart), and
 * - insufficient-balance → buy prompt (`buyCredits` action: on-chain GAS →
 *   credits at the fixed 1 GAS = 50 credits contract rate).
 *
 * Degradation contract (this is the part every consumer relies on):
 * - No `MiniAppFrameworkOptions.credits` config on the host (the dev default
 *   — the ledger endpoint does not exist there) ⇒ `creditsAvailable` stays
 *   false and every action is a silent no-op. The UI renders nothing.
 * - Guest mode never sees credits: the actions early-return before touching
 *   `app.credits` (whose own guards would throw), and the UI hides on the
 *   app's `appMode` observable. Credits are a GAS-backed feature.
 * - Buying is the only on-chain lane, so it is additionally gated by the S11
 *   `payments` manifest permission; when the manifest declares permissions
 *   without it, the buy action surfaces a localized hint instead of the raw
 *   framework error.
 *
 * The lane registers three framework actions (`refreshCredits`,
 * `retryWithCredits`, `buyCredits`), exposes plain observables for the
 * PlayArea (spread `lane.state` into the setup() state), and cleans up its
 * balance subscription through `app.lifecycle.cleanup`.
 */

import {
  CREDITS_PER_GAS,
  creditsForGas,
  FrameworkInsufficientCreditsError,
} from "../../../framework";
import type {
  FrameworkCreditsBalance,
  FrameworkCreditsBuyResult,
  FrameworkCreditsSpendResult,
} from "../../../framework";
import { createObservable } from "./context";
import type { Observable } from "./context";

/** Localized status severities (matches ctx.setStatus in both shells). */
type GameCreditsStatusType = "success" | "error" | "warning" | "info";

/**
 * The minimal structural slice of the framework the lane consumes. Narrow on
 * purpose: tests mock exactly this, and the real `ctx.framework` satisfies it.
 */
export interface GameCreditsAppSurface {
  credits: {
    readonly available: boolean;
    current: Observable<FrameworkCreditsBalance | null>;
    balance(): Promise<FrameworkCreditsBalance>;
    spend(amount: number, action: string): Promise<FrameworkCreditsSpendResult>;
    buy(gasAmount: bigint | number | string): Promise<FrameworkCreditsBuyResult>;
  };
  mode: { isGuest(): boolean };
  permissions: { has(permission: string): boolean };
  actions: {
    register(key: string, handler: (...args: unknown[]) => Promise<unknown>): void;
  };
  lifecycle: { cleanup(fn: () => void): void };
}

export interface GameCreditsLaneOptions {
  app: GameCreditsAppSurface;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (message: string, type: GameCreditsStatusType) => void;
  /** Credits one instant retry costs (positive integer). */
  reviveCostCredits: number;
  /** Ledger spend action recorded for the retry (e.g. "revive"). */
  reviveAction: string;
  /**
   * Whether the game can actually honor a paid retry right now. Games whose
   * paid starts are fail-closed (maintenance flags, supportsGameFi=false)
   * pass false so the offer is never sold and then refused; the balance chip
   * stays live either way.
   */
  reviveEnabled?: boolean;
  /** Decimal GAS per top-up buy (default 1 GAS = 50 credits). */
  buyGas?: number;
  /** The game's own restart, run only after the spend was debited. */
  onReviveUnlocked: () => void | Promise<void>;
}

export interface GameCreditsLaneState {
  /** Host injected a valid credits config (chip/offer render gate). */
  creditsAvailable: Observable<boolean>;
  /** Last known credit balance; -1 until the first successful read. */
  creditsBalance: Observable<number>;
  /** True when the balance is the settled on-chain fallback (ledger down). */
  creditsStale: Observable<boolean>;
  /** A spend or buy is in flight (disable the offer buttons). */
  creditsBusy: Observable<boolean>;
  /** Last spend was rejected for insufficient balance → show the buy prompt. */
  creditsNeedsTopUp: Observable<boolean>;
  /** The game honors paid retries right now (offer render gate). */
  creditsReviveEnabled: Observable<boolean>;
  /** Credits one retry costs (copy + affordability math in the UI). */
  creditsReviveCost: Observable<number>;
  /** Decimal GAS per top-up buy. */
  creditsBuyGas: Observable<number>;
  /** Credits that buy mints at the fixed contract rate. */
  creditsBuyCredits: Observable<number>;
  /** Fixed contract rate (credits per 1 GAS) for the "1 GAS = 50" copy. */
  creditsRate: Observable<number>;
}

export interface GameCreditsLane {
  /** Spread into the setup() state so the PlayArea can bind the observables. */
  state: GameCreditsLaneState;
  /** Best-effort ledger balance read (silent in guest / unconfigured hosts). */
  refresh(): Promise<void>;
  /** Spend-then-restart (the `retryWithCredits` action body). */
  revive(): Promise<void>;
  /** On-chain GAS → credits top-up (the `buyCredits` action body). */
  buy(): Promise<void>;
}

export function createGameCreditsLane(options: GameCreditsLaneOptions): GameCreditsLane {
  const { app, t, setStatus, onReviveUnlocked } = options;
  const reviveCost = Math.max(1, Math.trunc(options.reviveCostCredits));
  const buyGas = options.buyGas ?? 1;

  const available = Boolean(app.credits.available);
  const creditsAvailable = createObservable(available);
  const creditsBalance = createObservable(-1);
  const creditsStale = createObservable(false);
  const creditsBusy = createObservable(false);
  const creditsNeedsTopUp = createObservable(false);
  const creditsReviveEnabled = createObservable(options.reviveEnabled !== false);
  const creditsReviveCost = createObservable(reviveCost);
  const creditsBuyGas = createObservable(buyGas);
  const creditsBuyCredits = createObservable(Number(creditsForGas(buyGas)));
  const creditsRate = createObservable(Number(CREDITS_PER_GAS));

  // Mirror the framework's live balance observable: spends and buy polls
  // update `app.credits.current` themselves, so the chip stays fresh without
  // extra GETs. A balance that covers the retry cost clears the top-up flag.
  const syncFromCurrent = () => {
    const snapshot = app.credits.current.get();
    if (!snapshot) return;
    creditsBalance.set(snapshot.balance);
    creditsStale.set(snapshot.stale);
    if (snapshot.balance >= reviveCost) creditsNeedsTopUp.set(false);
  };
  if (available) {
    syncFromCurrent();
    app.lifecycle.cleanup(app.credits.current.subscribe(syncFromCurrent));
  }

  const active = (): boolean => available && !app.mode.isGuest();

  const refresh = async (): Promise<void> => {
    if (!active()) return;
    try {
      await app.credits.balance();
    } catch {
      // Ledger AND settled-chain fallback unreachable: keep the last known
      // value; the chip renders "--" until a read lands. Never block play.
    }
  };

  const revive = async (): Promise<void> => {
    if (!active() || creditsBusy.get()) return;
    creditsBusy.set(true);
    try {
      const result = await app.credits.spend(reviveCost, options.reviveAction);
      creditsNeedsTopUp.set(false);
      setStatus(
        t("creditsReviveUnlocked", { cost: result.spent, balance: result.balance }),
        "success",
      );
      await onReviveUnlocked();
    } catch (error) {
      if (error instanceof FrameworkInsufficientCreditsError) {
        creditsNeedsTopUp.set(true);
        setStatus(t("creditsInsufficientStatus", { cost: reviveCost }), "info");
      } else {
        setStatus(error instanceof Error ? error.message : t("creditsLaneFailed"), "error");
      }
    } finally {
      creditsBusy.set(false);
    }
  };

  const buy = async (): Promise<void> => {
    if (!active() || creditsBusy.get()) return;
    // S11: buying is the on-chain lane; surface the missing manifest grant as
    // a localized hint instead of letting the typed permission error escape.
    if (!app.permissions.has("payments")) {
      setStatus(t("creditsBuyNeedsPermission"), "warning");
      return;
    }
    creditsBusy.set(true);
    try {
      const result = await app.credits.buy(buyGas);
      if (result.credited) {
        setStatus(t("creditsBuyCredited", { credits: result.credits }), "success");
      } else {
        // Broadcast is real even when the indexer lags: the GAS transfer is
        // out; the ledger will reflect it. Do NOT present this as a failure.
        setStatus(t("creditsBuyBroadcast", { credits: result.credits }), "info");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("creditsLaneFailed"), "error");
    } finally {
      creditsBusy.set(false);
    }
  };

  app.actions.register("refreshCredits", refresh);
  app.actions.register("retryWithCredits", revive);
  app.actions.register("buyCredits", buy);

  return {
    state: {
      creditsAvailable,
      creditsBalance,
      creditsStale,
      creditsBusy,
      creditsNeedsTopUp,
      creditsReviveEnabled,
      creditsReviveCost,
      creditsBuyGas,
      creditsBuyCredits,
      creditsRate,
    },
    refresh,
    revive,
    buy,
  };
}
