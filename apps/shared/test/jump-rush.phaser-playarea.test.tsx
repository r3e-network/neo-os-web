import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
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
      return <div data-testid="jump-rush-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../jump-rush/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Jump Rush",
    appSubtitle: "Hold, jump, land clean, and clear the route for GAS.",
    activeRunTitle: "Active run",
    creditLabel: "Withdrawable credit",
    creditShort: "Credit",
    difficulty_easy: "Meadow Hop",
    difficulty_medium: "Cloud Dash",
    difficulty_hard: "Summit Leap",
    drawerSummaryLabel: "Jump Rush account summary",
    drawerTitle: "Leaderboard & rules",
    closeDrawer: "Close leaderboard and rules",
    fairnessCopy: "TEE seals the route.",
    fairnessTitle: "Fair route",
    historyEmpty: "Your verified runs will appear here.",
    historyTitle: "My runs",
    historyUndos: "{undos} undos",
    lastRunLine: "Last verified: {payout} in {time}",
    leaderboardEmpty: "No verified runs yet.",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    lobbyTitle: "Choose your route",
    moreActions: "More",
    nextRunTitle: "Next run",
    poolShort: "Pool",
    playingTitle: "Racing to {difficulty}",
    rankLabel: "Global rank",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Frees the reserved reward.",
    runEconomyLine: "Entry {entry} GAS · prize {reward} GAS",
    rulesCopy: "Clear all platforms before time runs out.",
    rulesTitle: "How it works",
    scoreReward: "Reward at stake",
    scoreTime: "Time left",
    scoreUndos: "Undos left",
    scoreWon: "Total won",
    shufflingCopy: "Sealing inside the enclave.",
    solvesCount: "{count} runs",
    statusReady: "Choose a jump route to start",
    statusShuffling: "Sealing your run",
    statusPoolLow: "Pool refilling for this route",
    statusSubmitting: "Submitting run",
    statusWonTitle: "Target reached!",
    timeUpAction: "Time is up",
    undoAction: "Undo jump",
    undoHint: "Undo through the enclave.",
    youTag: "you",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Withdraw winnings.",
    gameAriaLabel: "Jump Rush illustrated platform-jumping game",
    gameLoadingLabel: "Loading the jump arena",
    gameActionFailed: "The game surface could not start",
    enableGameSound: "Enable game sound",
    muteGameSound: "Mute game sound",
    a11yDifficultyGroup: "Choose a jump route",
    a11yDifficultyDetail: "{count} platforms to clear",
    a11yStartRoute: "Start selected route",
    a11yChargePower: "Jump power {power} percent",
    a11yJumpAtPower: "Jump at {power} percent power",
    a11yUndoJump: "Undo missed jump, {count} left",
    a11yEndRun: "End this run",
    a11ySubmitRun: "Save cleared route",
    perfectLabel: "Perfect",
    comboLabel: "{x}x combo",
    guestJumpsLabel: "Jumps",
    guestSubtitle: "Free local jumping.",
    guestModeValue: "Local",
    guestBestLabel: "Best run",
    guestRouteLabel: "Route",
    guestModeLabel: "Mode",
    guestRunsLabel: "Runs",
    guestJumpsValue: "{count} jumps",
    guestLeaderboardIntro: "Free local scores.",
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
    activeGameId: "0",
    commitment: "",
    credit: 0,
    deadline: 0,
    dealtAt: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    isUndoing: false,
    lastPayout: "",
    lastElapsedMs: 0,
    lastStatus: "Choose a jump route to start",
    leaderboard: [],
    myHistory: [],
    myRank: 0,
    myTotalWon: 0,
    myRuns: 0,
    currentPlatform: 0,
    jumpCount: 0,
    perfectCount: 0,
    comboCount: 0,
    missedPlatform: false,
    inputSyncFailed: false,
    platformsView: [],
    poolFree: 25,
    undosUsed: 0,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("jump-rush Phaser playarea", () => {
  it("mounts the production platform game in Phaser without an outer start action", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state({ gameDifficulty: 2, poolFree: 12 })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".jr-playstage")).toBeTruthy();
    expect(container.querySelector(".jr-stage-shell")).toBeTruthy();
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

    expect(props.className).toBe("jr-phaser-canvas");
    expect(props.ariaLabel).toBe("Jump Rush illustrated platform-jumping game");
    expect(props.loadingLabel).toBe("Loading the jump arena");
    expect(props.config?.width).toBe(400);
    expect(props.config?.height).toBe(580);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(12);
    expect(props.state.isUndoing).toBe(false);
    expect(props.state.isGuest).toBe(true);
    expect(queryByText("Start run")).toBeNull();
  });

  it("passes active run timing and payout state into the canvas", () => {
    const deadline = Date.now() + 100_000;
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "7",
          deadline,
          dealtAt: Date.now() - 20_000,
          gameDifficulty: 1,
          gameStatus: "dealt",
          currentPlatform: 1,
          jumpCount: 1,
          perfectCount: 1,
          comboCount: 1,
          platformsView: [
            { x: 60, width: 120, gap: 0 },
            { x: 280, width: 100, gap: 100 },
            { x: 510, width: 90, gap: 130 },
          ],
          undosUsed: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.activeGameId).toBe("7");
    expect(props.state.gameStatus).toBe("dealt");
    expect(props.state.platformsView).toEqual([
      { x: 60, width: 120, gap: 0 },
      { x: 280, width: 100, gap: 100 },
      { x: 510, width: 90, gap: 130 },
    ]);
    expect(props.state.undosUsed).toBe(1);
    expect(props.state.undosLeft).toBe(2);
    expect(props.state.currentPlatform).toBe(1);
    expect(props.state.jumpCount).toBe(1);
    expect(props.state.perfectCount).toBe(1);
    expect(props.state.comboCount).toBe(1);
    expect(props.state.remainingMs).toBeGreaterThan(0);
    expect(props.state.lastStatus).toBeUndefined();
    expect(container.querySelector(".jr-playarea")?.getAttribute("data-playing")).toBe("true");
  });

  it("keeps rankings and history in the drawer while game recovery stays in Phaser", () => {
    const dispatch = vi.fn();
    const { container, getAllByText, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "9",
          credit: 1.25,
          deadline: Date.now() - 1000,
          dealtAt: Date.now() - 80_000,
          gameStatus: "dealt",
          leaderboard: [
            { rank: 1, address: "0xabcdef1234567890abcdef1234567890abcdef12", totalWon: 6.5, runs: 4, isUser: false },
            { rank: 2, address: "0x1234567890abcdef1234567890abcdef12345678", totalWon: 2.75, runs: 2, isUser: true },
          ],
          myHistory: [
            { gameId: "8", difficulty: 1, elapsedMs: 42_000, undos: 1, jumps: 20, perfects: 7, payout: "0.35 GAS" },
          ],
          myRank: 2,
          myTotalWon: 2.75,
          appMode: "gamefi",
          platformsView: [
            { x: 60, width: 120, gap: 0 },
            { x: 280, width: 100, gap: 100 },
          ],
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".jr-ranks--phaser")).toBeNull();

    fireEvent.click(getAllByText("Leaderboard & rules")[0]);
    expect(container.querySelector(".jr-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".jr-drawer__summary")).toBeTruthy();
    expect(container.querySelector(".jr-run-card")).toBeTruthy();
    expect(container.querySelector(".jr-ranks--phaser")).toBeTruthy();
    expect(getByText("6.50 GAS")).toBeTruthy();
    expect(getByText("0.35 GAS")).toBeTruthy();
    expect(queryByText("Time is up")).toBeNull();
    expect(queryByText("More")).toBeNull();
    expect(queryByText("Undo jump")).toBeNull();
    expect(queryByText("Release game")).toBeNull();
    const pausedProps = mocks.phaserGame.mock.calls.at(-1)?.[0] as { state: Record<string, unknown> };
    expect(pausedProps.state.interactionPaused).toBe(true);

    fireEvent.click(getAllByText("Refresh ranking")[0].closest("button")!);
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard", {});
  });

  it("keeps GameFi asset withdrawal in the support drawer and hides it for guest play", () => {
    const dispatch = vi.fn();
    const { container, getAllByText, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "gamefi",
          credit: 1.25,
          gameStatus: "solved",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getAllByText("Leaderboard & rules")[0]);
    expect(container.querySelector(".jr-drawer__actions")).toBeTruthy();
    fireEvent.click(getByText("Withdraw 1.25 GAS").closest("button")!);
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});

    cleanup();
    const guest = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          credit: 1.25,
          gameStatus: "solved",
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(guest.getAllByText("Leaderboard & rules")[0]);
    expect(guest.queryByText("Withdraw 1.25 GAS")).toBeNull();
    expect(guest.container.querySelector(".jr-drawer__actions")).toBeNull();
  });

  it("exposes keyboard route selection and a charge-preserving jump control", () => {
    const dispatch = vi.fn();
    const view = render(<PhaserPlayArea t={t} state={state()} dispatch={dispatch} />);
    const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as { onReady?: () => void };
    act(() => props.onReady?.());

    const routes = view.getAllByRole("radio");
    expect(routes).toHaveLength(3);
    fireEvent.keyDown(routes[0]!, { key: "ArrowRight" });
    expect(dispatch).toHaveBeenCalledWith("selectDifficulty", { difficulty: 1 });

    fireEvent.click(view.getByRole("button", { name: /Start selected route/ }));
    const latest = mocks.phaserGame.mock.calls.at(-1)?.[0] as { state: Record<string, unknown> };
    expect(latest.state.a11yStartPulse).toBe(1);

    cleanup();
    const playing = render(
      <PhaserPlayArea
        t={t}
        state={state({
          gameStatus: "dealt",
          deadline: Date.now() + 60_000,
          dealtAt: Date.now(),
          platformsView: [
            { x: 60, width: 120, gap: 0 },
            { x: 280, width: 100, gap: 100 },
          ],
        })}
        dispatch={dispatch}
      />,
    );
    const playingProps = mocks.phaserGame.mock.calls.at(-1)?.[0] as { onReady?: () => void };
    act(() => playingProps.onReady?.());
    const power = playing.getByRole("slider", { name: /Jump power/ });
    fireEvent.change(power, { target: { value: "67" } });
    fireEvent.click(playing.getByRole("button", { name: "Jump at 67 percent power" }));
    const latestPlaying = mocks.phaserGame.mock.calls.at(-1)?.[0] as { state: Record<string, unknown> };
    expect(latestPlaying.state.a11yChargeLevel).toBe(67);
    expect(latestPlaying.state.a11yJumpPulse).toBe(1);
  });

  it("keeps an accessible end-run action available when a guest route times out", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          deadline: Date.now() - 1_000,
          dealtAt: Date.now() - 61_000,
          platformsView: [
            { x: 60, width: 120, gap: 0 },
            { x: 280, width: 100, gap: 100 },
          ],
        })}
        dispatch={dispatch}
      />,
    );
    const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as { onReady?: () => void };
    act(() => props.onReady?.());

    expect(view.queryByRole("slider")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "End this run" }));
    expect(dispatch).toHaveBeenCalledWith("expireGame", {});
  });

  it("guards the Phaser source against demo-only platform gameplay", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "jump-rush/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "jump-rush/src/scenes/JumpRushScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "jump-rush/src/PlayArea.scss"), "utf8");
    const main = readFileSync(resolve(root, "jump-rush/src/main.tsx"), "utf8");

    expect(wrapper).toContain("jr-drawer__summary");
    expect(wrapper).toContain("jr-stage-shell");
    expect(wrapper).toContain("jr-stage-hud");
    expect(wrapper).toContain("jr-ingame-drawer");
    expect(wrapper).toContain("leaderboard");
    expect(wrapper).toContain("myHistory");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain(`runAction("withdrawWinnings"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("primaryAction");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).toContain("jr-a11y-layer");
    // The countdown clock lives in the shared useNowMs hook now.
    expect(wrapper).toContain("useNowMs(");
    expect(wrapper).toContain("a11yChargeLevel");
    expect(wrapper).toContain("handleDrawerKeyDown");
    expect(wrapper).toContain("interactionPaused");
    expect(scene).toContain("private canSubmitRun()");
    expect(scene).toContain("private canReleaseRun()");
    expect(scene).toContain("private canRetryDeal()");
    expect(scene).toContain("private poolCanCoverSelectedRoute()");
    expect(scene).toContain("private onMissedLanding()");
    expect(scene).toContain("this.dispatch(\"useUndo\", {})");
    expect(scene).toContain("this.dispatch(\"retryDeal\", {})");
    expect(scene).toContain("this.dispatch(\"expireGame\", {})");
    expect(scene).toContain("evaluateJumpLevel(chargeLevel, to.gap, to.width)");
    expect(scene).toContain('this.input.on("pointerupoutside"');
    expect(scene).toContain('window.addEventListener("blur", this.onChargeCancel)');
    expect(scene).not.toContain("MAX_PLATFORMS");
    expect(scene).toContain("const logicalIndex = windowStart + i");
    expect(scene.indexOf("if (!landed)")).toBeLessThan(scene.indexOf("this.currentPlatformIndex += 1"));
    expect(main).toContain("guest.recordJump(");
    expect(main).toContain("view.perfect === true");
    expect(scene).toContain("this.minSolveRemainingMs()");
    expect(main).toContain("undosUsed.get() >= GAMEFI_MAX_UNDOS");
    expect(styles).toContain(".jr-drawer__summary");
    expect(styles).toContain(".jr-drawer__actions");
    expect(styles).toContain(".jr-run-card");
    expect(styles).toContain(".jr-history");
    expect(styles).toContain(".jr-stage-shell");
    expect(styles).toContain(".jr-stage-hud");
    expect(styles).toContain(".jr-ingame-drawer");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.45");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 112");
  });
});
