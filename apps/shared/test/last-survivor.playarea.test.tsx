import React from "react";
import fs from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../last-survivor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    activeRound: "Active",
    arenaMomentum: "Arena momentum",
    arenaMomentumHint:
      "Leader, your stake, and the pot move as the round heats up.",
    awaitingFirstKey: "Be the first to buy a key",
    buying: "Buying...",
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
    leaderMarker: "Leader",
    noHistory: "No events yet",
    recentHistory: "Recent Rounds",
    refreshRound: "Refresh Round",
    refreshRoundHint: "Refresh the game state before buying keys.",
    round: "Round",
    roundStateRequired:
      "Refresh the round state before submitting a key purchase.",
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
    pressConsole: "Press console",
    pressConsoleHint:
      "Every key feeds the pot. The final buyer survives when the clock runs out.",
    pressConsoleTitle: "Buy a key. Reset the clock.",
    playerMarker: "You",
    potMarker: "Pot",
    survivorSeats: "Survivor seats",
    survivorSeatsHint: "The final live seat wins when the clock stops.",
    survivorSeatEmpty: "Open seat",
    survivalArena: "Last Survivor arena",
    survivalArenaAlt:
      "Bright futuristic arena with a glowing button console and GAS prize pool",
    survivorStageEyebrow: "Pressure game",
    timeUntilEvent: "Time Until Event",
    title: "LastSurvivor",
    tokenGas: "GAS",
    totalKeys: "Total Keys",
    totalPot: "Total Pot",
    yourKeys: "Your Keys",
  };
  return messages[key] ?? key;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
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
        .some((el) =>
          el.textContent?.includes("The countdown service is not available"),
        ),
    ).toBe(true);
    expect(
      screen.queryByText(/OS service error|os-game-status|Not Found/i),
    ).toBeNull();
    expect(screen.getByLabelText("Last Survivor arena")).toBeTruthy();
    expect(
      screen.getByAltText(
        "Bright futuristic arena with a glowing button console and GAS prize pool",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Buy a key. Reset the clock.")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Refresh Round" }).length,
    ).toBeGreaterThan(0);
    expect(
      (screen.getByRole("button", { name: "Buy Keys" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("keeps the stage key controls wired to the local key count", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          isRoundActive: true,
          lastBuyer: "NMockLastBuyer111111111111111111111111111",
          roundDataAvailable: true,
          roundStatusDisplay: "Active",
          totalPot: 4.2,
          totalKeysDisplay: 2,
          userKeys: 1,
          userSharePercent: 50,
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(container.querySelector(".key-count-value")?.textContent).toBe("2");
    expect(container.querySelector(".survivor-key-burst--active")).toBeTruthy();
    expect(container.querySelectorAll(".survivor-key-burst span")).toHaveLength(
      6,
    );
    expect(container.querySelector(".survivor-play-area--live")).toBeTruthy();
    expect(
      container.querySelector(".survivor-stage.survivor-play-area--live"),
    ).toBeTruthy();
    const lane = container.querySelector(".survivor-arena-lane") as HTMLElement;
    expect(lane).toBeTruthy();
    expect(lane.style.getPropertyValue("--survivor-player-progress")).toBe(
      "50%",
    );
    expect(
      container.querySelectorAll(".survivor-arena-lane__marker").length,
    ).toBe(3);
    expect(
      container.querySelector(".survivor-arena-lane__marker--leader.is-live"),
    ).toBeTruthy();
    expect(
      container.querySelector(".survivor-arena-lane__marker--player.is-live"),
    ).toBeTruthy();
    expect(
      container.querySelector(".survivor-arena-lane__marker--pot.is-live"),
    ).toBeTruthy();
    expect(container.querySelector(".survivor-seat-strip")).toBeTruthy();
    expect(
      container.querySelector(".survivor-seat--leader.is-live"),
    ).toBeTruthy();
    expect(
      container.querySelector(".survivor-seat--player.is-live"),
    ).toBeTruthy();
    expect(container.querySelector(".survivor-seat--pot.is-live")).toBeTruthy();
    expect(container.querySelectorAll(".survivor-seat__icon svg").length).toBe(
      3,
    );
    expect(container.querySelector(".key-adjust-btn.plus svg")).toBeTruthy();
    expect(container.querySelector(".key-adjust-btn.minus svg")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(container.querySelector(".key-count-value")?.textContent).toBe("5");
    expect(container.querySelector(".preset-chip.active")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Buy Keys" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("turns a key purchase into immediate arena motion instead of a static submit", async () => {
    let resolveBuy: (() => void) | undefined;
    const dispatch = vi.fn((name: string) => {
      if (name === "buyKeys") {
        return new Promise<void>((resolve) => {
          resolveBuy = resolve;
        });
      }
      return Promise.resolve();
    });
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          isRoundActive: true,
          lastBuyer: "NMockLastBuyer111111111111111111111111111",
          roundDataAvailable: true,
          roundStatusDisplay: "Active",
          totalPot: 4.2,
          totalKeysDisplay: 2,
          userKeys: 1,
          userSharePercent: 50,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buy Keys" }));

    expect(dispatch).toHaveBeenCalledWith("buyKeys", "1");
    await waitFor(() => {
      expect(
        container.querySelector(".survivor-play-area--buying"),
      ).toBeTruthy();
      expect(
        container.querySelector(".survivor-stage.survivor-play-area--buying"),
      ).toBeTruthy();
      expect(
        container.querySelector(".survivor-key-burst--active"),
      ).toBeTruthy();
      expect(
        container.querySelector(
          ".survivor-play-area--buying .survivor-seat--player",
        ),
      ).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "Buying..." })
          .getAttribute("aria-busy"),
      ).toBe("true");
    });

    resolveBuy?.();
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("setKeyCount", "1"),
    );
  });

  it("surfaces a permissionless Settle affordance for an ended round and blocks buying", async () => {
    // The on-chain contract rejects a buy on an ended round ("settle first"), so
    // the ended-round affordance is Settle — which dispatches the permissionless
    // settle() — NOT a buy-and-rollover. (Replaces the old OS-rollover behavior.)
    let resolveSettle: (() => void) | undefined;
    const dispatch = vi.fn((name: string) => {
      if (name === "settleRound") {
        return new Promise<void>((resolve) => {
          resolveSettle = resolve;
        });
      }
      return Promise.resolve();
    });
    const { container } = render(
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
    await waitFor(() => {
      expect(
        container.querySelector(".survivor-play-area--settling"),
      ).toBeTruthy();
      expect(
        container.querySelector(".survivor-stage.survivor-play-area--settling"),
      ).toBeTruthy();
      expect(
        container.querySelector(".claim-card-inner.is-settling"),
      ).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "Settling..." })
          .getAttribute("aria-busy"),
      ).toBe("true");
    });
    resolveSettle?.();

    // Buying is blocked while the round needs settlement.
    const buy = screen.getByRole("button", { name: "Buy Keys" });
    expect((buy as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses app icons and motion states instead of text-symbol chrome", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          isRoundActive: true,
          lastBuyer: "NMockLastBuyer111111111111111111111111111",
          roundDataAvailable: true,
          roundStatusDisplay: "Active",
          totalKeysDisplay: 4,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".hero-badge svg")).toBeTruthy();
    expect(container.querySelector(".last-buyer-icon svg")).toBeTruthy();
    expect(container.querySelectorAll(".participation-icon svg").length).toBe(
      3,
    );
    expect(container.querySelector(".history-section-icon svg")).toBeTruthy();
    expect(container.querySelector(".cost-gas-icon")).toBeTruthy();
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

  it("keeps survivor stage motion backed by reduced-motion fallbacks", () => {
    const playAreaStyles = fs.readFileSync(
      `${process.cwd()}/../last-survivor/src/PlayArea.scss`,
      "utf8",
    );
    const buyKeysStyles = fs.readFileSync(
      `${process.cwd()}/../last-survivor/src/pages/index/components/BuyKeysCard.scss`,
      "utf8",
    );

    expect(playAreaStyles).toContain("@keyframes survivor-arena-drift");
    expect(playAreaStyles).toContain("@keyframes survivor-stage-sweep");
    expect(playAreaStyles).toContain("@keyframes survivor-lane-progress");
    expect(playAreaStyles).toContain("@keyframes survivor-lane-scan");
    expect(playAreaStyles).toContain("@keyframes survivor-lane-marker-ready");
    expect(playAreaStyles).toContain("@keyframes survivor-stage-buying");
    expect(playAreaStyles).toContain("@keyframes survivor-lane-buy-charge");
    expect(playAreaStyles).toContain("@keyframes survivor-stage-settling");
    expect(playAreaStyles).toContain("@keyframes survivor-lane-settle-charge");
    expect(playAreaStyles).toContain("@keyframes survivor-seat-settle-award");
    expect(playAreaStyles).toContain("@keyframes survivor-settle-crown-turn");
    expect(playAreaStyles).toContain("@keyframes survivor-claim-settle-sweep");
    expect(playAreaStyles).toContain("@keyframes survivor-seat-enter");
    expect(playAreaStyles).toContain("@keyframes survivor-seat-breathe");
    expect(playAreaStyles).toContain("@keyframes survivor-seat-buy-press");
    expect(playAreaStyles).toContain("@keyframes survivor-key-icon-turn");
    expect(playAreaStyles).toContain("@keyframes survivor-seat-scan");
    expect(playAreaStyles).toContain("@keyframes survivor-key-burst-flight");
    expect(playAreaStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.survivor-stage\.survivor-play-area--buying[\s\S]*animation:\s*none/,
    );
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.survivor-seat\.is-live::after[\s\S]*animation:\s*none/,
    );
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.survivor-play-area--buying \.survivor-seat--player[\s\S]*animation:\s*none/,
    );
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.survivor-stage\.survivor-play-area--settling[\s\S]*animation:\s*none/,
    );
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.survivor-play-area--settling \.survivor-seat--leader[\s\S]*animation:\s*none/,
    );
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.claim-card-inner\.is-settling::before[\s\S]*animation:\s*none/,
    );
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.survivor-key-burst--active span[\s\S]*animation:\s*none/,
    );
    expect(buyKeysStyles).toContain("@keyframes survivor-preset-confirm");
    expect(buyKeysStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(buyKeysStyles).toContain(
      ".buy-keys-card .neo-btn--primary:disabled:not(.neo-btn--loading)",
    );
  });
});
