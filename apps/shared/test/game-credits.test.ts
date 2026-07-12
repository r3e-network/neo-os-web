/**
 * game-credits lane contract (platform Credits v2 reference integration).
 *
 * Locks the app-side glue both reference games (color-clash, flappy-dash)
 * consume, against a mocked app.credits:
 * - degradation: unconfigured hosts (available=false) and guest mode are
 *   silent no-ops — no ledger call, no chain call, no status noise;
 * - retryWithCredits: exactly one spend(cost, action), restart runs ONLY
 *   after the debit, the 402 typed error flips the buy prompt on without
 *   restarting, and a busy lane ignores double-clicks;
 * - buyCredits: S11 payments gate surfaces a localized hint (no chain call),
 *   credited vs indexer-lag broadcasts get distinct non-failure statuses;
 * - the chip observables mirror app.credits.current (balance + stale flag),
 *   and a balance covering the cost clears the top-up flag.
 */
import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameCreditsLane } from "../react/game-credits";
import type { GameCreditsAppSurface } from "../react/game-credits";
import { FrameworkInsufficientCreditsError } from "../../../framework";
import type { FrameworkCreditsBalance } from "../../../framework";

function balanceSnapshot(
  overrides: Partial<FrameworkCreditsBalance> = {},
): FrameworkCreditsBalance {
  return {
    wallet: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    network: "testnet",
    balance: 100,
    totalPurchased: 150,
    totalSpent: 50,
    totalExited: 0,
    updatedAt: "2026-07-12T00:00:00Z",
    source: "ledger",
    stale: false,
    ...overrides,
  };
}

function makeHarness(options: {
  available?: boolean;
  guest?: boolean;
  payments?: boolean;
} = {}) {
  const current = createObservable<FrameworkCreditsBalance | null>(null);
  const balance = vi.fn(async () => balanceSnapshot());
  const spend = vi.fn(async (amount: number, action: string) => ({
    appId: "test-app",
    action,
    network: "testnet",
    spent: amount,
    balance: 95,
    eventId: 1,
    deduped: false,
    idempotencyKey: "test-app.revive.k.deadbeef",
  }));
  const buy = vi.fn(async () => ({
    txid: "0xabc",
    gasFixed8: "100000000",
    credits: 50,
    credited: true,
    balance: balanceSnapshot({ balance: 145 }),
    event: null,
  }));
  const registered = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const cleanups: Array<() => void> = [];
  const setStatus = vi.fn();
  const onReviveUnlocked = vi.fn(async () => undefined);

  const app: GameCreditsAppSurface = {
    credits: {
      available: options.available !== false,
      current,
      balance,
      spend,
      buy,
    },
    mode: { isGuest: () => options.guest === true },
    permissions: { has: () => options.payments !== false },
    actions: { register: (key, handler) => registered.set(key, handler) },
    lifecycle: { cleanup: (fn) => cleanups.push(fn) },
  };

  const lane = createGameCreditsLane({
    app,
    t: (key, params) => `${key}${params ? `:${JSON.stringify(params)}` : ""}`,
    setStatus,
    reviveCostCredits: 5,
    reviveAction: "revive",
    onReviveUnlocked,
  });

  return { lane, current, balance, spend, buy, registered, cleanups, setStatus, onReviveUnlocked };
}

describe("game-credits lane", () => {
  it("registers the three uniform credit actions", () => {
    const { registered } = makeHarness();
    expect([...registered.keys()].sort()).toEqual([
      "buyCredits",
      "refreshCredits",
      "retryWithCredits",
    ]);
  });

  it("degrades to silent no-ops when the host injects no credits config", async () => {
    const { lane, balance, spend, buy, setStatus } = makeHarness({ available: false });
    expect(lane.state.creditsAvailable.get()).toBe(false);
    await lane.refresh();
    await lane.revive();
    await lane.buy();
    expect(balance).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
    expect(buy).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("never spends or buys in guest mode", async () => {
    const { lane, spend, buy, balance, onReviveUnlocked } = makeHarness({ guest: true });
    await lane.refresh();
    await lane.revive();
    await lane.buy();
    expect(balance).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
    expect(buy).not.toHaveBeenCalled();
    expect(onReviveUnlocked).not.toHaveBeenCalled();
  });

  it("debits exactly one spend and only then unlocks the restart", async () => {
    const { lane, spend, setStatus, onReviveUnlocked } = makeHarness();
    await lane.revive();
    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend).toHaveBeenCalledWith(5, "revive");
    expect(onReviveUnlocked).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenCalledWith(
      expect.stringContaining("creditsReviveUnlocked"),
      "success",
    );
    expect(spend.mock.invocationCallOrder[0]!).toBeLessThan(
      onReviveUnlocked.mock.invocationCallOrder[0]!,
    );
  });

  it("flips the buy prompt on for the typed insufficient-credits rejection without restarting", async () => {
    const { lane, spend, setStatus, onReviveUnlocked } = makeHarness();
    spend.mockRejectedValueOnce(new FrameworkInsufficientCreditsError(5, 2));
    await lane.revive();
    expect(lane.state.creditsNeedsTopUp.get()).toBe(true);
    expect(onReviveUnlocked).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      expect.stringContaining("creditsInsufficientStatus"),
      "info",
    );
  });

  it("surfaces other spend failures as errors without restarting", async () => {
    const { lane, spend, setStatus, onReviveUnlocked } = makeHarness();
    spend.mockRejectedValueOnce(new Error("ledger exploded"));
    await lane.revive();
    expect(onReviveUnlocked).not.toHaveBeenCalled();
    expect(lane.state.creditsNeedsTopUp.get()).toBe(false);
    expect(setStatus).toHaveBeenCalledWith("ledger exploded", "error");
  });

  it("ignores a second revive while one is in flight (double-click safety)", async () => {
    const { lane, spend } = makeHarness();
    let release: (value: {
      appId: string; action: string; network: string; spent: number; balance: number;
      eventId: number; deduped: boolean; idempotencyKey: string;
    }) => void = () => undefined;
    spend.mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve; }),
    );
    const first = lane.revive();
    const second = lane.revive();
    release({
      appId: "test-app", action: "revive", network: "testnet",
      spent: 5, balance: 95, eventId: 1, deduped: false, idempotencyKey: "k".repeat(8),
    });
    await Promise.all([first, second]);
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it("gates the buy behind the S11 payments permission with a localized hint", async () => {
    const { lane, buy, setStatus } = makeHarness({ payments: false });
    await lane.buy();
    expect(buy).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("creditsBuyNeedsPermission", "warning");
  });

  it("reports a credited buy as success and an indexer-lag broadcast as info, never failure", async () => {
    const { lane, buy, setStatus } = makeHarness();
    await lane.buy();
    expect(buy).toHaveBeenCalledWith(1);
    expect(setStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("creditsBuyCredited"),
      "success",
    );
    buy.mockResolvedValueOnce({
      txid: "0xdef",
      gasFixed8: "100000000",
      credits: 50,
      credited: false,
      balance: null,
      event: null,
    });
    await lane.buy();
    expect(setStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("creditsBuyBroadcast"),
      "info",
    );
  });

  it("mirrors app.credits.current into the chip observables and clears the top-up flag when covered", () => {
    const { lane, current } = makeHarness();
    expect(lane.state.creditsBalance.get()).toBe(-1);
    lane.state.creditsNeedsTopUp.set(true);
    current.set(balanceSnapshot({ balance: 3, source: "chain", stale: true }));
    expect(lane.state.creditsBalance.get()).toBe(3);
    expect(lane.state.creditsStale.get()).toBe(true);
    expect(lane.state.creditsNeedsTopUp.get()).toBe(true);
    current.set(balanceSnapshot({ balance: 42 }));
    expect(lane.state.creditsBalance.get()).toBe(42);
    expect(lane.state.creditsStale.get()).toBe(false);
    expect(lane.state.creditsNeedsTopUp.get()).toBe(false);
  });

  it("refresh reads the ledger and stays silent when even the fallback fails", async () => {
    const { lane, balance, setStatus } = makeHarness();
    await lane.refresh();
    expect(balance).toHaveBeenCalledTimes(1);
    balance.mockRejectedValueOnce(new Error("ledger down"));
    await expect(lane.refresh()).resolves.toBeUndefined();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("exposes the fixed 1 GAS = 50 credits rate for the buy prompt copy", () => {
    const { lane } = makeHarness();
    expect(lane.state.creditsRate.get()).toBe(50);
    expect(lane.state.creditsBuyGas.get()).toBe(1);
    expect(lane.state.creditsBuyCredits.get()).toBe(50);
    expect(lane.state.creditsReviveCost.get()).toBe(5);
  });

  it("registers its balance subscription for lifecycle cleanup", () => {
    const { cleanups } = makeHarness();
    expect(cleanups.length).toBe(1);
    expect(typeof cleanups[0]).toBe("function");
  });
});
