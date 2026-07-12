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

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => {
  return {
    LazyPhaserGameComponent: (props: unknown) => {
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
    arenaCanvasAria: "Interactive Last Survivor arena",
    arenaCanvasLoading: "Opening the survival arena",
    a11yArenaControls: "Accessible arena controls",
    activeRound: "Active",
    buyQuote: `Buy ${params?.count ?? 1} ${params?.unit ?? "key"} · ${params?.amount ?? "0.10 GAS"}`,
    connectWallet: "Connect wallet",
    closeDrawer: "Close round details",
    currentLeader: "Current leader",
    drawerSummaryLabel: "Last Survivor round summary",
    inactiveRound: "Rollover ready",
    keyCapsules: "Key capsules",
    keyChamber: "Clock key chamber",
    keyUnitOne: "key",
    keyUnitMany: "keys",
    historyTitle: "History & rules",
    fundingBreakdown: `Wallet ${params?.wallet ?? "0 GAS"} · prepaid ${params?.credit ?? "0 GAS"}`,
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
    statusFundsReady: `Funds ready · wallet ${params?.wallet ?? "0 GAS"} + prepaid ${params?.credit ?? "0 GAS"}`,
    totalKeys: "Total Keys",
    totalPot: "Total Pot",
    yourKeys: "Your Keys",
    waitingForRound: "Waiting for round",
    withdrawCredit: "Withdraw credit",
    transactionRecoveryTitle: "Transaction recovery",
    transactionRecoveryPending: "Transaction pending",
    recoverTransaction: "Check transaction",
    transactionIdLabel: "Transaction",
    pendingOperationPurchase: "Key purchase",
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
    estimatedCostGas: 0.3,
    formattedRound: "#4",
    history: [],
    isBuyingKeys: false,
    isConnectingWallet: false,
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
    walletGasBalance: "0.45",
    walletBalanceAvailable: true,
    appMode: "gamefi",
    creditAvailable: true,
    userKeysAvailable: true,
    historyAvailable: true,
    quoteAvailable: true,
    storageHealthy: true,
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
    expect(container.querySelector(".survivor-stage-shell")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail__drawer-toggle")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("survivor-phaser-canvas");
    expect(props.ariaLabel).toBe("Interactive Last Survivor arena");
    expect(props.loadingLabel).toBe("Opening the survival arena");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(600);
    expect(props.state.totalPotDisplay).toBe("9.50 GAS");
    expect(props.state.totalKeys).toBe(18);
    expect(props.state.totalKeysDisplay).toBe(18);
    expect(props.state.userKeys).toBe(2);
    expect(props.state.keyCount).toBe("3");
    expect(props.state.estimatedCostGas).toBe(0.3);
    expect(props.state.prepaidCredit).toBe(0);
    expect(props.state.walletGasBalance).toBe(0.45);
    expect(props.state.walletConnected).toBe(true);
    expect(props.state.sceneBuyQuote).toBe("Buy 3 keys · 0.30 GAS");
    expect(container.textContent).toContain("History & rules");
    expect(queryByText("Buy 3 keys")).toBeNull();
  });

  it("does not present an unreadable wallet balance as verified zero", () => {
    const { container, getAllByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ paidActionsAvailable: true, walletBalanceAvailable: false })}
        dispatch={vi.fn()}
      />,
    );
    const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      state: Record<string, unknown>;
    };
    expect(props.state.writeDataAvailable).toBe(false);

    fireEvent.click(getAllByText("History & rules")[0]);
    expect(container.textContent).toContain("Wallet notAvailable");
    expect(container.textContent).not.toContain("Wallet 0.00 GAS");
  });

  it("scales guest danger to the 26-second duel instead of showing critical for the whole run", () => {
    const view = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          guestOutcome: "running",
          guestScore: 18,
          guestLeaderLabel: "You",
          guestMoveReady: false,
          lastBuyer: "guest-local",
          timeRemainingSeconds: 20,
          viewerAddress: "",
        })}
        dispatch={vi.fn()}
      />,
    );

    const safeProps = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      state: Record<string, unknown>;
    };
    expect(safeProps.state.dangerProgress).toBeCloseTo(23.08, 1);
    expect(safeProps.state.dangerLevel).toBe("low");
    expect(safeProps.state.shouldPulse).toBe(false);

    view.rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          guestOutcome: "running",
          guestScore: 18,
          guestLeaderLabel: "Ember Fox",
          guestMoveReady: true,
          lastBuyer: "guest-rival:ember",
          timeRemainingSeconds: 2,
          viewerAddress: "",
        })}
        dispatch={vi.fn()}
      />,
    );
    const criticalProps = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      state: Record<string, unknown>;
    };
    expect(criticalProps.state.dangerProgress).toBeGreaterThan(90);
    expect(criticalProps.state.dangerLevel).toBe("critical");
    expect(criticalProps.state.shouldPulse).toBe(true);
  });

  it("keeps Phaser lifecycle controls mirrored for keyboard users and support actions in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getAllByText, getByText, queryByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({ isRoundActive: false, needsLifecycleSync: true })}
        dispatch={dispatch}
      />,
    );

    expect(queryByText("Settle round")).toBeTruthy();
    expect(queryByText("Refresh Round")).toBeTruthy();
    fireEvent.click(getByText("Settle round"));
    expect(dispatch).toHaveBeenCalledWith("settleRound");
    fireEvent.click(getAllByText("History & rules")[0]);
    expect(container.querySelector(".survivor-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(getAllByText("Refresh Round")).toHaveLength(2);
    expect(queryByText("Withdraw credit")).toBeNull();
    fireEvent.click(getAllByText("Refresh Round")[1]);
    expect(dispatch).toHaveBeenCalledWith("refreshRound");

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({ prepaidCredit: 1.25 })}
        dispatch={dispatch}
      />,
    );

    if (!container.querySelector(".survivor-ingame-drawer")) {
      fireEvent.click(getAllByText("History & rules")[0]);
    }
    expect(getByText("Withdraw credit")).toBeTruthy();
    fireEvent.click(getByText("Withdraw credit"));
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
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
    expect(container.querySelector(".survivor-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".survivor-drawer__summary")).toBeTruthy();
    expect(container.querySelector(".survivor-state-card")).toBeTruthy();
    expect(container.querySelector(".survivor-economy")).toBeTruthy();
    expect(container.querySelector(".survivor-history")).toBeTruthy();
    expect(getByText("Winner declared")).toBeTruthy();
    expect(getByText("Keys are non-refundable.")).toBeTruthy();
    expect(getByText("Participation only.")).toBeTruthy();

    fireEvent.click(getAllByText("Refresh Round")[1]);
    expect(dispatch).toHaveBeenCalledWith("refreshRound");
  });

  it("surfaces one friendly recovery action and blocks duplicate purchase controls", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByText, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          purchasePending: true,
          pendingOperationKind: "purchase",
          pendingTransactionId: `0x${"ab".repeat(32)}`,
          recoveryNotice: "Transaction pending",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getAllByText("History & rules")[0]);
    expect(getByText("Transaction recovery")).toBeTruthy();
    expect(getByText("Key purchase")).toBeTruthy();
    fireEvent.click(getByText("Check transaction"));
    expect(dispatch).toHaveBeenCalledWith("recoverTransaction");
  });

  it("guards the Phaser wrapper and scene against a form-like Last Survivor shell", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "last-survivor/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "last-survivor/src/scenes/LastSurvivorScene.ts"), "utf8");
    const main = readFileSync(resolve(root, "last-survivor/src/main.tsx"), "utf8");
    const composable = readFileSync(resolve(root, "last-survivor/src/composables/useLastSurvivor.ts"), "utf8");
    const guestEngine = readFileSync(resolve(root, "last-survivor/src/logic/guest-engine.ts"), "utf8");
    const styles = readFileSync(resolve(root, "last-survivor/src/PlayArea.scss"), "utf8");
    const connectStart = main.indexOf('actions.register("connectWallet"');
    const connectEnd = main.indexOf('actions.register("refreshRound"', connectStart);
    const connectAction = main.slice(connectStart, connectEnd);

    expect(wrapper).toContain("survivor-drawer__summary");
    expect(wrapper).toContain("survivor-stage-shell");
    expect(wrapper).toContain("survivor-stage-hud");
    expect(wrapper).toContain("survivor-ingame-drawer");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("survivor-drawer__actions");
    expect(wrapper).toContain("survivor-history");
    expect(wrapper).toContain(`dispatch("refreshRound"`);
    expect(wrapper).toContain(`dispatch("withdrawCredit"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).toContain(`dispatch("settleRound"`);
    expect(wrapper).toContain("survivor-a11y-controls");
    expect(wrapper).toContain('role="radiogroup"');
    expect(wrapper).toContain('role="radio"');
    expect(wrapper).toContain('role="dialog"');
    expect(wrapper).toContain('event.key !== "Escape"');
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toMatch(/primary:\s*\{/);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain(`this.dispatch("buyKeys", this.selectedKeyCount)`);
    expect(scene).toContain(`this.dispatch("settleRound")`);
    expect(scene).toMatch(
      /gate\.primaryAction === "connect"[\s\S]*this\.dispatch\("connectWallet"\);[\s\S]*return;/,
    );
    expect(scene).toContain("enabled: () => this.transactionGate().presetsEnabled");
    expect(connectStart).toBeGreaterThan(-1);
    expect(connectAction).toContain("app.wallet.ensure()");
    expect(connectAction).toContain("refreshGasBalance()");
    expect(connectAction).toContain("game.loadAll()");
    expect(connectAction).not.toContain("game.buyKeys(");
    expect(main).toMatch(
      /game\.isBuyingKeys\.get\(\)[\s\S]*game\.purchasePending\.get\(\)[\s\S]*game\.isSettling\.get\(\)[\s\S]*game\.isLoading\.get\(\)/,
    );
    expect(main).toContain('throw new Error(ctx.t("paidRoundsUnavailable"))');
    expect(main).not.toContain('successKey: "keysPurchased"');
    expect(main).not.toContain('successKey: "roundSettled"');
    expect(guestEngine).toContain("MAX_RIVAL_RAIDS");
    expect(guestEngine).toContain("secureRandomInt");
    expect(guestEngine).toContain("precisionBonus");
    expect(guestEngine).toContain("guestMoveReady.set(true)");
    expect(guestEngine).toContain("guestMoveReady.set(false)");
    expect(composable).toContain("costBase - credit");
    expect(composable).toContain('waitForEvent: "Credited"');
    expect(styles).toContain(".survivor-drawer__summary");
    expect(styles).toContain(".survivor-drawer__actions");
    expect(styles).toContain(".survivor-state-card");
    expect(styles).toContain(".survivor-rules");
    expect(styles).toContain(".survivor-stage-shell");
    expect(styles).toContain(".survivor-stage-hud");
    expect(styles).toContain(".survivor-ingame-drawer");
  });
});
