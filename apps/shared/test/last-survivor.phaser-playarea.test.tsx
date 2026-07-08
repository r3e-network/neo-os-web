import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@framework/phaser")>();
  return {
    ...actual,
    PhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="last-survivor-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../last-survivor/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Last Survivor",
    appSubtitle: "Buy keys, extend the clock, and survive for the pot.",
    activeRound: "Active",
    currentLeader: "Current leader",
    drawerSummaryLabel: "Last Survivor round summary",
    inactiveRound: "Rollover ready",
    keyCapsules: "Key capsules",
    keyChamber: "Clock key chamber",
    historyTitle: "History & rules",
    moreActions: "More",
    noHistory: "No events yet",
    nonRefundableNote: "Keys are non-refundable.",
    playerMarker: "You",
    prepaidCreditHint: "Withdrawable credit.",
    prepaidCreditLabel: "Prepaid credit",
    recentHistory: "Recent Rounds",
    refreshRound: "Refresh Round",
    refreshRoundHint: "Refresh the game state before buying keys.",
    round: "Round",
    roundEnded: "Round ended",
    roundActive: "Live survival round",
    ruleDeposit: "Buy keys",
    ruleDepositDesc: "Each purchase adds GAS to the prize pool.",
    ruleTimer: "Each key extends the clock",
    ruleTimerDesc: "Every key extends the countdown.",
    ruleWin: "Last buyer wins",
    ruleWinDesc: "The final buyer wins the pot.",
    rulesTitle: "Last key wins the pot.",
    safe: "Safe",
    settleRoundHint: "Award the pot.",
    share: "Key share",
    shareHint: "Participation only.",
    sidebarTimeLeft: "Time left",
    settleRound: "Settle round",
    totalKeys: "Total Keys",
    totalPot: "Total Pot",
    yourKeys: "Your Keys",
    waitingForRound: "Waiting for round",
    withdrawCredit: "Withdraw credit",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{${paramKey}}`, String(paramValue));
    }
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    countdown: "00:01:30",
    dangerLevel: "medium",
    dangerLevelText: "Medium risk",
    dangerProgress: 42,
    estimatedCost: "0.30",
    formattedRound: "#4",
    history: [],
    isBuyingKeys: false,
    isLoading: false,
    isRoundActive: true,
    isSettling: false,
    keyCount: "3",
    keyValidationError: "",
    lastBuyerLabel: "Ndb1n4...m2Aa",
    needsLifecycleSync: false,
    prepaidCredit: 0,
    roundDataAvailable: true,
    roundStatusDisplay: "Live",
    serviceNotice: "",
    shouldPulse: false,
    totalKeysDisplay: 18,
    totalPotDisplay: "9.50 GAS",
    userSharePercent: 11.1,
    userKeys: 2,
    viewerAddress: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("last-survivor Phaser playarea", () => {
  it("mounts the production arena in Phaser and passes live round state", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".survivor-playstage")).toBeTruthy();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("survivor-phaser-canvas");
    expect(props.ariaLabel).toBe("Last Survivor arena game");
    expect(props.loadingLabel).toBe("Opening arena");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(600);
    expect(props.state.totalPotDisplay).toBe("9.50 GAS");
    expect(props.state.totalKeys).toBe(18);
    expect(props.state.totalKeysDisplay).toBe(18);
    expect(props.state.userKeys).toBe(2);
    expect(props.state.keyCount).toBe("3");
    expect(container.textContent).toContain("History & rules");
    expect(queryByText("Buy 3 keys")).toBeNull();
  });

  it("keeps lifecycle, refresh, and prepaid-credit actions outside the canvas as secondary only", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, queryByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({ isRoundActive: false, needsLifecycleSync: true })}
        dispatch={dispatch}
      />,
    );

    expect(getByText("Settle round")).toBeTruthy();
    expect(getByText("Refresh Round")).toBeTruthy();
    expect(queryByText("Withdraw credit")).toBeNull();

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({ prepaidCredit: 1.25 })}
        dispatch={dispatch}
      />,
    );

    expect(getByText("Withdraw credit")).toBeTruthy();
  });

  it("opens a production drawer with round summary, history, economics, and rules", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getAllByText, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          history: [
            {
              id: "round-3",
              title: "Winner declared",
              details: "#3 - Ndb1n4...m2Aa - 4.20 GAS",
              date: "",
              sortKey: 3,
            },
          ],
          prepaidCredit: 0.5,
          viewerAddress: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".survivor-drawer__summary")).toBeNull();

    fireEvent.click(getAllByText("History & rules")[0]);
    expect(container.querySelector(".survivor-drawer__summary")).toBeTruthy();
    expect(container.querySelector(".survivor-state-card")).toBeTruthy();
    expect(container.querySelector(".survivor-economy")).toBeTruthy();
    expect(container.querySelector(".survivor-history")).toBeTruthy();
    expect(getByText("Winner declared")).toBeTruthy();
    expect(getByText("Keys are non-refundable.")).toBeTruthy();
    expect(getByText("Participation only.")).toBeTruthy();

    fireEvent.click(getByText("Refresh Round"));
    expect(dispatch).toHaveBeenCalledWith("refreshRound");
  });

  it("guards the Phaser wrapper and scene against a form-like Last Survivor shell", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "last-survivor/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "last-survivor/src/scenes/LastSurvivorScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "last-survivor/src/PlayArea.scss"), "utf8");

    expect(wrapper).toContain("survivor-drawer__summary");
    expect(wrapper).toContain("survivor-history");
    expect(wrapper).toContain(`dispatch("refreshRound"`);
    expect(wrapper).toContain(`dispatch("withdrawCredit"`);
    expect(wrapper).not.toMatch(/primary:\s*\{/);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain(`this.dispatch("buyKeys", this.selectedKeyCount)`);
    expect(scene).toContain(`this.dispatch("settleRound")`);
    expect(styles).toContain(".survivor-drawer__summary");
    expect(styles).toContain(".survivor-state-card");
    expect(styles).toContain(".survivor-rules");
  });
});
