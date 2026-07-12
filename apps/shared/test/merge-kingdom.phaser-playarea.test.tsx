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
      return <div data-testid="merge-kingdom-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../merge-kingdom/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    a11yBoardLabel: "Kingdom plots",
    a11yControlsLabel: "Accessible kingdom controls",
    a11yMoveRejected: "That move is not available.",
    a11ySelected: "Building selected.",
    a11yStartRun: "Start {difficulty} local kingdom",
    appEyebrow: "Merge Kingdom",
    appSubtitle: "Move, merge, and raise the kingdom target.",
    activeRouteLine: "{route} route · {moves} moves · target {target} · {time}",
    checkDealAgain: "Retry sealing",
    checkSettlementAction: "Check settlement",
    closeDrawer: "Close player summary",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
    creditLabel: "Credit",
    drawerSummaryLabel: "Merge Kingdom player summary",
    drawerTitle: "Leaderboard & rules",
    difficulty_easy: "Easy",
    difficulty_medium: "Medium",
    difficulty_hard: "Hard",
    difficultyTitle: "Choose a kingdom route",
    fairnessCopy: "The enclave validates every move before settlement.",
    fairnessTitle: "Provably fair boards",
    gameAriaLabel: "Merge Kingdom board game",
    gameLoadingLabel: "Opening kingdom board",
    gameTitle: "Merge Kingdom",
    gameFiMaintenanceBody: "Paid runs are unavailable while reward funding and oracle callback access are verified.",
    gameFiMaintenanceShort: "GameFi maintenance",
    guestBestLabel: "Best building",
    guestClearsLabel: "Routes cleared",
    guestClearsCount: "{count} clears",
    guestHistoryWon: "Cleared",
    guestHistoryFinished: "Finished",
    guestScoreLabel: "Local best",
    guestModeLine: "Free local kingdom run",
    guestRulesCopy: "Move buildings into adjacent plots and merge matching tiers.",
    guestRulesTitle: "How to build",
    guestRunLabel: "Run",
    guestRunValue: "LOCAL",
    guestStartHint: "Choose a route and start building.",
    guestSubmitAction: "Finish run",
    historyEmpty: "No solves yet.",
    historyTitle: "My solves",
    lastResultLine: "Last settlement: {payout} · {time}",
    leaderboardIntro: "Leaderboard is rebuilt from solved events.",
    leaderboardTitle: "Leaderboard & rules",
    leaderboardEmpty: "No leaderboard entries yet.",
    lobbyTitle: "Build the kingdom",
    moreActions: "More actions",
    networkBadge: "Neo N3",
    poolLabel: "Reward pool",
    rankLabel: "Rank",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release an expired or stalled game.",
    rulesCopy: "Pick a route, merge adjacent kingdom tiles, and claim before the deadline.",
    scoreReward: "Reward",
    scoreTile: "Best tile",
    scoreTime: "Time left",
    scoreWon: "Total won",
    solvesCount: "{count} solves",
    statusDealPending: "Sealing is taking longer than usual.",
    statusShuffling: "Sealing board",
    statusSettlementPending: "Settlement pending",
    startAction: "Play again",
    startHint: "Entry {amount} GAS",
    statusExpired: "That kingdom expired",
    statusWonTitle: "Realm complete",
    submitAction: "Claim reward",
    submitHint: "Target reached.",
    tileAchieved: "Tile {tile}",
    tileTarget: "Reach {tile}",
    withdrawHint: "Pull credit back to your wallet.",
    walletRequiredStatus: "Connect wallet to play",
    withdrawTitle: "Withdraw winnings",
    withdrawAction: "Withdraw {amount} GAS",
    youTag: "you",
    building_2: "Camp",
    building_4: "Cottage",
    building_8: "Village",
    building_16: "Town",
    building_32: "Keep",
    building_64: "Castle",
    building_128: "Citadel",
    building_256: "Royal city",
    building_512: "Sky palace",
    building_1024: "Golden capital",
    building_2048: "Celestial realm",
    building_4096: "Eternal kingdom",
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
    appMode: "guest",
    board: [],
    credit: 0,
    deadline: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    lastElapsedMs: 0,
    lastPayoutFixed8: 0n,
    lastStatus: "",
    leaderboard: [],
    moveCount: 0,
    myHistory: [],
    myRank: 0,
    mySolves: 0,
    myTotalWon: 0,
    poolFree: 25,
    tileAchieved: 0,
    undosUsed: 0,
    walletConnected: true,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("merge-kingdom Phaser playarea", () => {
  it("mounts the production board in Phaser and exposes an accessible guest start", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText, queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    expect(container.querySelector(".mk-playstage")).toBeTruthy();
    expect(container.querySelector(".mk-stage-shell")).toBeTruthy();
    expect(container.querySelector(".mk-stage-hud")).toBeTruthy();
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

    expect(props.className).toBe("mk-phaser-canvas");
    expect(props.ariaLabel).toBe("Merge Kingdom board game");
    expect(props.loadingLabel).toBe("Opening kingdom board");
    expect(props.config?.width).toBe(400);
    expect(props.config?.height).toBe(600);
    expect(props.state.gameStatus).toBe("idle");
    expect(props.state.activeGameId).toBe("0");
    expect(props.state.walletConnected).toBe(true);
    expect(props.state.poolFree).toBe(25);
    expect(props.state.credit).toBe(0);
    expect(props.state.appMode).toBe("guest");
    expect(props.state.gameFiNewEntriesEnabled).toBe(false);
    expect(queryByText("Build Realm")).toBeNull();
    fireEvent.click(getByText("Start Easy local kingdom"));
    expect(dispatch).toHaveBeenCalledWith("startGame", 0);
    fireEvent.click(getByText("Medium · Castle"));
    expect(dispatch).toHaveBeenCalledWith("selectDifficulty", 1);
    fireEvent.click(getByText("Start Medium local kingdom"));
    expect(dispatch).toHaveBeenCalledWith("startGame", 1);
  });

  it("passes active board state and exposes a keyboard-accessible finish action", () => {
    const board = [
      [2, 4, 0, 0],
      [0, 8, 0, 0],
      [0, 0, 16, 0],
      [0, 0, 0, 64],
    ];
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "12",
          board,
          gameDifficulty: 0,
          gameStatus: "dealt",
          deadline: Date.now() + 60_000,
          moveCount: 7,
          tileAchieved: 64,
        })}
        dispatch={dispatch}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.board).toEqual(board);
    expect(props.state.activeGameId).toBe("12");
    expect(props.state.moveCount).toBe(7);
    expect(props.state.tileAchieved).toBe(64);
    fireEvent.click(getByText("Finish run"));
    expect(dispatch).toHaveBeenCalledWith("submitSolution");
  });

  it("keeps new paid entries visibly disabled while historical recovery stays reachable", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "gamefi" })}
        dispatch={dispatch}
      />,
    );

    expect((getByText("GameFi maintenance") as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "gamefi", activeGameId: "0", gameStatus: "unknown" })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(getByText("Check settlement"));
    expect(dispatch).toHaveBeenCalledWith("refreshGame");
  });

  it("shows device-local guest results without GAS payout framing", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          myHistory: [{
            gameId: "guest-1",
            difficulty: 0,
            payout: "0 GAS",
            solveMs: 18_000,
            undos: 0,
            tileAchieved: 32,
            won: true,
          }],
          mySolves: 1,
          myTotalWon: 32,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Leaderboard & rules"));
    const history = container.querySelector(".mk-history");
    expect(history?.textContent).toContain("Cleared");
    expect(history?.textContent).not.toContain("GAS");
    expect(container.querySelector(".mk-drawer__summary")?.textContent).toContain("1 clears");
  });

  it("keeps sealing recovery and release in Phaser while support actions stay in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "42",
          appMode: "gamefi",
          credit: 0.5,
          gameStatus: "committed",
        })}
        dispatch={dispatch}
      />,
    );

    expect(queryByText("More actions")).toBeNull();
    fireEvent.click(getByText("Retry sealing"));
    expect(queryByText("Release game")).toBeNull();

    fireEvent.click(getByText("Leaderboard & rules"));
    expect(container.querySelector(".mk-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".mk-drawer__credit")?.textContent).toContain("0.50 GAS");
    fireEvent.click(getByText("Withdraw winnings"));
    fireEvent.click(container.querySelector(".mk-ranks__refresh") as Element);

    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
    expect(dispatch).toHaveBeenCalledWith("retryDeal");
  });

  it("opens a production drawer with ranking, history, fairness, and credit recovery", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "77",
          appMode: "gamefi",
          commitment: "ab".repeat(32),
          credit: 0.25,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: "77", difficulty: 2, payout: "1.00 GAS", solveMs: 45_000, undos: 0, tileAchieved: 1024 },
          ],
          myRank: 2,
          mySolves: 3,
          myTotalWon: 1.25,
          poolFree: 8,
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".mk-drawer__summary")).toBeNull();
    fireEvent.click(getByText("Leaderboard & rules"));

    expect(container.querySelector(".mk-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".mk-drawer__summary")?.textContent).toContain("#2");
    expect(container.querySelector(".mk-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".mk-drawer__credit")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".mk-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".mk-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".mk-history")?.textContent).toContain("Tile 1024");
    expect(container.querySelector(".mk-history")?.textContent).toContain("1.00 GAS");
    expect(container.querySelector(".mk-drawer__fairness")?.textContent).toContain("Provably fair boards");
    expect(container.querySelector(".mk-drawer__seed")?.textContent).toContain("Game #77");

    fireEvent.click(container.querySelector(".mk-ranks__refresh") as Element);
    fireEvent.click(getByText("Withdraw winnings"));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
  });

  it("guards the Phaser shell against a flat form-style Merge Kingdom UI", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "merge-kingdom/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "merge-kingdom/src/scenes/MergeKingdomScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "merge-kingdom/src/PlayArea.scss"), "utf8");
    const main = readFileSync(resolve(root, "merge-kingdom/src/main.tsx"), "utf8");
    const manifest = readFileSync(resolve(root, "merge-kingdom/src/manifest.ts"), "utf8");

    expect(wrapper).toContain("mk-drawer__summary");
    expect(wrapper).toContain("mk-drawer__fairness");
    expect(wrapper).toContain("mk-history");
    expect(wrapper).toContain("mk-stage-shell");
    expect(wrapper).toContain("mk-stage-hud");
    expect(wrapper).toContain("mk-ingame-drawer");
    expect(wrapper).toContain("mk-a11y-controls");
    expect(wrapper).toContain('role="radiogroup"');
    expect(wrapper).toContain('role="dialog"');
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain(`dispatch("refreshLeaderboard"`);
    expect(wrapper).toContain(`dispatch("withdrawWinnings"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("primary,");
    expect(wrapper).not.toContain("secondary,");
    expect(wrapper).not.toContain("primary:");
    expect(wrapper).not.toContain("secondary:");
    expect(wrapper).toContain(`dispatch("submitSolution"`);
    expect(wrapper).toContain(`dispatch("recordMove"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    const drawerStart = wrapper.indexOf("const drawerContent");
    const mainReturn = wrapper.indexOf("\n  return (", drawerStart);
    const drawerSource = wrapper.slice(drawerStart, mainReturn);
    expect(drawerSource).toContain(`dispatch("retryDeal"`);
    expect(drawerSource).toContain(`dispatch("expireGame"`);
    expect(scene).toContain(`this.dispatch("startGame", this.selectedDiff)`);
    expect(scene).toContain(`this.dispatch("selectDifficulty", diffIdx)`);
    expect(scene).toContain(`this.dispatch("startGame", this.num("gameDifficulty", this.selectedDiff))`);
    expect(scene).toContain(`this.dispatch("recordMove", from.row, from.col, to.row, to.col)`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(scene).toContain(`this.dispatch("retryDeal")`);
    expect(scene).toContain(`this.dispatch("expireGame")`);
    expect(scene).toContain("private handlePointerUp(");
    expect(scene).toContain("private handlePointerMove(");
    expect(scene).toContain("private handleKeyboardMove(");
    expect(scene).toContain("private canRetryDeal()");
    expect(scene).toContain("private canReleaseCommitted()");
    expect(scene).toContain("this.refreshBtn.setVisible(settlementPending");
    expect(scene).not.toMatch(/#8b7355|#a07030|#a89070|#0f9f6e/);
    expect(styles).toContain(".mk-stage-shell");
    expect(styles).toContain(".mk-stage-hud");
    expect(styles).toContain(".mk-ingame-drawer");
    expect(styles).toContain(".mk-drawer__summary");
    expect(styles).toContain(".mk-drawer__credit");
    expect(styles).toContain(".mk-drawer__seed");
    expect(styles).toContain(".mk-a11y-controls:focus-within");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 92px");
    expect(styles).not.toContain(".mk-playarea .mx2-drawer.mx2-drawer--open");
    expect(main).toContain("if (!GAMEFI_NEW_ENTRIES_ENABLED)");
    expect(main).toContain("canExpireAfterGrace(obs.deadline.get())");
    expect(main).toContain("rewardGame.recoverActive()");
    expect(main).toContain("never offer another entry while that outcome remains uncertain");
    expect(manifest).toContain("supportsGameFi: false");
    expect(manifest).toContain("operations: []");
  });
});
