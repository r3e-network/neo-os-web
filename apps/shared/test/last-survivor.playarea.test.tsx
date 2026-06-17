import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    roundEnded:
      "Timer expired. The settlement transaction pays the winner and opens the next live round.",
    safe: "SAFE",
    settleBeforeBuy:
      "The countdown has expired. Settle the round to pay the winner, then a fresh round opens.",
    settleRound: "Settle Round",
    settleRoundHint:
      "Anyone can settle: the last buyer is paid the entire pot on-chain and a fresh round begins.",
    settlingRound: "Settling...",
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
    isSettling: createObservable(false),
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

    // The page now renders more than one status region (the service notice plus
    // the shared StateView empty state for Recent Rounds), so assert the notice
    // text is present in one of them rather than assuming a single status node.
    expect(
      screen
        .getAllByRole("status")
        .some((el) => el.textContent?.includes("The countdown service is not available")),
    ).toBe(true);
    expect(screen.queryByText(/OS service error|os-game-status|Not Found/i)).toBeNull();
    expect(screen.getAllByRole("button", { name: "Refresh Round" }).length).toBeGreaterThan(0);
    expect(
      (screen.getByRole("button", { name: "Buy Keys" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("surfaces a permissionless Settle affordance for an ended round and blocks buying", async () => {
    // The on-chain contract rejects a buy on an ended round ("settle first"), so
    // the ended-round affordance is Settle — which dispatches the permissionless
    // settle() — NOT a buy-and-rollover. (Replaces the old OS-rollover behavior.)
    const dispatch = vi.fn(async () => {});
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
        dispatch={dispatch}
      />,
    );

    // Settle is the live action; clicking it dispatches settleRound.
    const settle = screen.getByRole("button", { name: "Settle Round" });
    expect((settle as HTMLButtonElement).disabled).toBe(false);
    settle.click();
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("settleRound"));

    // Buying is blocked while the round needs settlement.
    const buy = screen.getByRole("button", { name: "Buy Keys" });
    expect((buy as HTMLButtonElement).disabled).toBe(true);
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
