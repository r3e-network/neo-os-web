import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../last-survivor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    activeRound: "Active",
    buyKeys: "Buy Keys",
    buyKeysAndRollover: "Buy Keys and Roll Forward",
    buyKeysRolloverHint:
      "The next key purchase rolls the expired round forward before applying your bid.",
    critical: "CRITICAL",
    estimatedCost: "Estimated Cost",
    howItWorks: "How It Works",
    inactiveRound: "Rollover ready",
    keyPrice: "Base price: 0.1 GAS per key",
    keysSuffix: "Keys",
    lastBuyer: "Current leader",
    noHistory: "No events yet",
    recentHistory: "Recent Rounds",
    refreshRound: "Refresh Round",
    refreshRoundHint: "Refresh the game state before buying keys.",
    round: "Round",
    roundStateRequired: "Refresh the round state before submitting a key purchase.",
    roundStateUnavailableTitle: "Round state unavailable",
    ruleDeposit: "Buy keys",
    ruleDepositDesc: "Each purchase adds GAS to the prize pool.",
    ruleTimer: "Timer pressure increases",
    ruleTimerDesc: "Later bids add less time.",
    ruleWin: "Last buyer wins",
    ruleWinDesc: "When the timer reaches zero, the last buyer wins.",
    safe: "SAFE",
    share: "Share",
    status: "Status",
    timeUntilEvent: "Time Until Event",
    tokenGas: "GAS",
    totalKeys: "Total Keys",
    totalPot: "Total Pot",
    yourKeys: "Your Keys",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return {
    countdown: createObservable("00:00:00"),
    dangerLevel: createObservable("low"),
    dangerLevelText: createObservable("LOW RISK"),
    dangerProgress: createObservable(0),
    estimatedCost: createObservable("0.10"),
    formattedRound: createObservable("#0"),
    history: createObservable([]),
    isBuyingKeys: createObservable(false),
    isLoading: createObservable(false),
    isRoundActive: createObservable(false),
    keyCount: createObservable(0),
    keyValidationError: createObservable(null),
    lastBuyer: createObservable(""),
    lastBuyerLabel: createObservable("---"),
    needsLifecycleSync: createObservable(false),
    roundDataAvailable: createObservable(false),
    roundStatusDisplay: createObservable("Rollover ready"),
    serviceNotice: createObservable(""),
    shouldPulse: createObservable(false),
    totalKeysDisplay: createObservable(0),
    totalPot: createObservable(0),
    totalPotDisplay: createObservable("0.00 GAS"),
    userKeys: createObservable(0),
    userSharePercent: createObservable(0),
    ...Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [
        key,
        createObservable(value),
      ]),
    ),
  };
}

describe("LastSurvivor PlayArea", () => {
  it("shows a professional service notice and keeps Buy Keys visible", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          serviceNotice:
            "The countdown service is not available in this environment yet.",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "The countdown service is not available",
    );
    expect(screen.queryByText(/OS service error|os-game-status|Not Found/i)).toBeNull();
    expect(screen.getAllByRole("button", { name: "Refresh Round" }).length).toBeGreaterThan(0);
    expect(
      (screen.getByRole("button", { name: "Buy Keys" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("keeps the transaction entry enabled for rollover-ready rounds", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          isRoundActive: false,
          lastBuyer: "NMockLastBuyer111111111111111111111111111",
          needsLifecycleSync: true,
          roundDataAvailable: true,
          totalPot: 12.5,
          totalPotDisplay: "12.50 GAS",
        })}
        dispatch={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Buy Keys and Roll Forward",
    });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/rolls the expired round forward/i)).toBeTruthy();
  });

  it("binds TOTAL KEYS and YOUR SHARE to the round total, not the buy-selector", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          // Buy-selector dialed to 10 — must NOT leak into the strip.
          keyCount: 10,
          userKeys: 5,
          totalKeysDisplay: 20,
          // userShare = 5 / 20 * 100 = 25% (round total denominator, not 10).
          userSharePercent: 25,
        })}
        dispatch={vi.fn()}
      />,
    );

    const values = Array.from(
      container.querySelectorAll(".participation-value"),
    ).map((el) => el.textContent);

    // [YOUR KEYS, TOTAL KEYS, YOUR SHARE]
    expect(values).toEqual(["5", "20", "25.0%"]);
    // The picker value (10) must not appear in the participation strip.
    expect(values).not.toContain("10");
    // Share must not be the meaningless 5/10 = 50%.
    expect(values).not.toContain("50.0%");
  });

  it("shows an em-dash share when no keys have been sold in the round", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          keyCount: 3,
          userKeys: 0,
          totalKeysDisplay: 0,
          userSharePercent: 0,
        })}
        dispatch={vi.fn()}
      />,
    );

    const values = Array.from(
      container.querySelectorAll(".participation-value"),
    ).map((el) => el.textContent);

    expect(values).toEqual(["0", "0", "—"]);
  });
});
