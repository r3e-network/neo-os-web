import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => {
  return {
    LazyPhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="game-2048-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../game-2048/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

const GAME_ID = "88";
const COMMITMENT = "ab".repeat(32);
const INIT_BOARD = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const WINNING_BOARD = [9, 5, 2, 1, 4, 3, 1, 0, 2, 1, 0, 0, 1, 0, 0, 0];
const MOVE_TRANSITION = {
  sequence: 3,
  direction: 3,
  before: [1, 1, ...new Array(14).fill(0)],
  afterSlide: [2, ...new Array(15).fill(0)],
  after: [2, ...new Array(14).fill(0), 1],
  motions: [
    { source: 0, destination: 0, exponent: 1, merge: 0 },
    { source: 1, destination: 0, exponent: 1, merge: 0 },
  ],
  merges: [{
    sources: [0, 1],
    destination: 0,
    sourceExponent: 1,
    resultExponent: 2,
  }],
  spawn: { destination: 15, exponent: 1 },
};

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "2048 Rush",
    appSubtitle: "Merge tiles, chase the target, and submit a verified run before time runs out.",
    checkSettlementAction: "Check settlement",
    checkDealAgain: "Retry sealing",
    close: "Close",
    commitmentLine: "Game #{gameId} sealed #{commitment}",
    creditLabel: "Withdrawable credit",
    drawerTitle: "Leaderboard & rules",
    fairnessCopy: "TEE seals the tile stream before settlement.",
    fairnessTitle: "Provably fair spawns",
    historyEmpty: "Your verified runs will appear here.",
    historyTitle: "My runs",
    historyUndos: "{undos} undos",
    game2048ActionFailed: "The 2048 run could not continue",
    game2048StageAlt: "2048 Rush tile merge game",
    leaderboardEmpty: "No verified runs yet.",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardTitle: "Global leaderboard",
    lobbyTitle: "Build the target tile",
    moveDown: "Slide down",
    moveLeft: "Slide left",
    moveRight: "Slide right",
    moveUp: "Slide up",
    moreActions: "More actions",
    networkBadge: "Neo N3",
    playingTitle: "Racing to {tile}",
    rankBadge: "Rank #{rank}",
    rankLabel: "Global rank",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release stuck or expired game.",
    releaseWaitAction: "Recovery countdown",
    releaseWaitStatus: "Wait for the recovery window.",
    releaseWaitTitle: "Run sealed — recovery pending",
    rulesCopy: "Reach the target within the limit.",
    rulesTitle: "How it works",
    scoreBest: "Best tile",
    scoreReward: "Reward at stake",
    scoreReleaseIn: "Release in",
    scoreTime: "Time left",
    scoreWon: "Total won",
    sidebarTitle: "My rush record",
    solvesCount: "{count} runs",
    solvedBanner: "You won {payout}!",
    statusDealPending: "Sealing is taking longer than usual.",
    statusReady: "Pick a lane, then merge to the glowing tile",
    statusShuffling: "Sealing your run…",
    statusWonTitle: "Target reached!",
    expiredBanner: "That run got away",
    startOpenRun: "Open run",
    startOpening: "Opening…",
    submitAction: "Submit run",
    submitHint: "Target reached",
    timeUpHint: "The deadline passed.",
    undoHint: "Recorded by the enclave session.",
    useUndo: "Use undo",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pull credit back to your wallet.",
    withdrawTitle: "Withdraw winnings",
    youTag: "you",
    difficulty_sprint: "Sprint",
    difficulty_climb: "Climb",
    difficulty_summit: "Summit",
    targetTile: "target {tile}",
    padLabel: "Move controls",
    openingTileBoard: "Opening tile board",
    retry: "Retry",
    continue: "Continue",
    enableGameSound: "Enable game sound",
    muteGameSound: "Mute game sound",
    endRunAction: "Settle run",
    settlementCheckingTitle: "Checking settlement…",
    settlementPendingTitle: "Settlement pending",
    settlementStillPending: "Settlement is still pending.",
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
    commitment: "",
    credit: 0,
    dealtAt: 0,
    deadline: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    isDealing: false,
    isMoving: false,
    isStarting: false,
    isSubmitting: false,
    isUndoing: false,
    isRecovering: false,
    lastElapsedMs: 0,
    lastPayout: "",
    lastStatus: "Pick a lane, then merge to the glowing tile",
    leaderboard: [],
    myHistory: [],
    myRank: 0,
    mySolves: 0,
    myTotalWon: 0,
    moveTransition: null,
    poolFree: 25,
    selectedDifficulty: 0,
    settlementGraceMs: 600_000,
    runBoard: [],
    runMaxExp: 0,
    runMoveCount: 0,
    undosUsed: 0,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

function dealtState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return state({
    activeGameId: GAME_ID,
    commitment: COMMITMENT,
    dealtAt: Date.now() - 90_000,
    deadline: Date.now() + 90_000,
    gameStatus: "dealt",
    runBoard: [...INIT_BOARD],
    runMaxExp: 1,
    runMoveCount: 0,
    ...overrides,
  });
}

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

describe("game-2048 Phaser playarea", () => {
  it("passes production run state into the Phaser board without a duplicate outer start action", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "9",
          commitment: COMMITMENT,
          credit: 0.4,
          dealtAt: 123,
          deadline: 456,
          gameDifficulty: 2,
          myRank: 3,
          moveTransition: MOVE_TRANSITION,
          poolFree: 8,
          runBoard: [...INIT_BOARD],
          runMaxExp: 1,
          runMoveCount: 2,
          undosUsed: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".rush-stage-shell")).toBeTruthy();
    expect(container.querySelector(".rush-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      errorLabel?: string;
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("rush-phaser-canvas");
    expect(props.ariaLabel).toBe("2048 Rush tile merge game");
    expect(props.loadingLabel).toBe("Opening tile board");
    expect(props.errorLabel).toBe("The 2048 run could not continue");
    expect(props.state.activeGameId).toBe("9");
    expect(props.state.commitment).toBe(COMMITMENT);
    expect(props.state.credit).toBe(0.4);
    expect(props.state.deadline).toBe(456);
    expect(props.state.dealtAt).toBe(123);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.moveTransition).toBe(MOVE_TRANSITION);
    expect(props.state.poolFree).toBe(8);
    expect(props.state.runMoveCount).toBe(2);
    expect(props.state.undosUsed).toBe(1);
    // The dealt board itself has to reach the renderer, not just its counters.
    expect(props.state.runBoard).toEqual(INIT_BOARD);
    expect(props.state.runMaxExp).toBe(1);
    expect(queryByText("Start run")).toBeNull();
  });

  it("provides keyboard difficulty, move, and primary controls over the Phaser assets", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByRole, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "guest", selectedDifficulty: 1 })}
        dispatch={dispatch}
      />,
    );

    const radios = getAllByRole("radio") as HTMLButtonElement[];
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
    radios[1]!.focus();
    fireEvent.keyDown(radios[1]!, { key: "ArrowRight" });
    expect(dispatch).toHaveBeenCalledWith("setDifficulty", 2);
    expect(document.activeElement).toBe(radios[2]);

    fireEvent.click(getByRole("button", { name: "Open run" }));
    expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 1 });

    rerender(
      <PhaserPlayArea
        t={t}
        state={dealtState({ appMode: "guest", selectedDifficulty: 0 })}
        dispatch={dispatch}
      />,
    );
    const slideLeft = getByRole("button", { name: "Slide left" });
    expect((slideLeft as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(slideLeft);
    expect(dispatch).toHaveBeenCalledWith("playMove", { dir: 3 });
  });

  it("keeps premature contract release disabled during the settlement grace window", () => {
    const { getByRole, queryByRole } = render(
      <PhaserPlayArea
        t={t}
        state={dealtState({ appMode: "gamefi", deadline: Date.now() - 1_000 })}
        dispatch={vi.fn()}
      />,
    );

    expect(queryByRole("button", { name: "Release game" })).toBeNull();
    expect((getByRole("button", { name: "Recovery countdown" }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("keeps an unresolved oracle settlement explicitly recoverable", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: GAME_ID,
          appMode: "gamefi",
          gameStatus: "unknown",
          deadline: Date.now() + 60_000,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Check settlement" }));
    expect(dispatch).toHaveBeenCalledWith("checkSettlement", {});
  });

  it("only exposes settlement after the target tile and anti-bot floor are both satisfied", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, queryByRole, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={dealtState({ appMode: "gamefi" })}
        dispatch={dispatch}
      />,
    );

    expect(queryByRole("button", { name: "Submit run" })).toBeNull();

    rerender(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          appMode: "gamefi",
          dealtAt: Date.now() - 5_000,
          runBoard: [...WINNING_BOARD],
          runMaxExp: 9,
        })}
        dispatch={dispatch}
      />,
    );
    expect(queryByRole("button", { name: "Submit run" })).toBeNull();

    rerender(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          appMode: "gamefi",
          runBoard: [...WINNING_BOARD],
          runMaxExp: 9,
          runMoveCount: 254,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".rush-stage-hud__submit")!);
    expect(dispatch).toHaveBeenCalledWith("submitRun", {});
  });

  it("keeps deal retry, release, undo, and credit withdrawal inside the in-game drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          appMode: "gamefi",
          runMoveCount: 4,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Leaderboard & rules"));
    fireEvent.click(getByText("Use undo"));

    rerender(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          appMode: "gamefi",
          deadline: Date.now() - 610_000,
          runMoveCount: 4,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getAllByRole("button", { name: "Release game" })[0]!);

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: GAME_ID,
          appMode: "gamefi",
          credit: 0.5,
          gameStatus: "committed",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getAllByRole("button", { name: "Retry sealing" })[0]!);
    fireEvent.click(getByText("Withdraw winnings"));

    expect(dispatch).toHaveBeenCalledWith("useUndo", {});
    expect(dispatch).toHaveBeenCalledWith("expireGame", {});
    expect(dispatch).toHaveBeenCalledWith("retryDeal", {});
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
  });

  it("renders leaderboard, history, fairness, and credit recovery inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: GAME_ID,
          appMode: "gamefi",
          commitment: COMMITMENT,
          credit: 0.25,
          myRank: 2,
          mySolves: 3,
          myTotalWon: 1.25,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: GAME_ID, difficulty: 2, payout: "1.00 GAS", solveMs: 45_000, undos: 0 },
          ],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Leaderboard & rules"));

    expect(container.querySelector(".rush-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".rush-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".rush-drawer__credit")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".rush-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".rush-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".rush-history")?.textContent).toContain("2048");
    expect(container.querySelector(".rush-history")?.textContent).toContain("1.00 GAS");
    expect(container.textContent).toContain("Provably fair spawns");
    expect(container.textContent).toContain("Game #88 sealed");

    fireEvent.click(getByText("Refresh ranking"));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard", {});

    fireEvent.click(getByRole("button", { name: "Close" }));
    expect(container.querySelector(".rush-ingame-drawer")).toBeNull();
  });

  it("keeps 2048 Rush production Phaser code game-led and recovery-safe", () => {
    const wrapper = fs.readFileSync(path.join(appsRoot(), "game-2048/src/PhaserPlayArea.tsx"), "utf8");
    const styles = fs.readFileSync(path.join(appsRoot(), "game-2048/src/PlayArea.scss"), "utf8");
    const scene = fs.readFileSync(path.join(appsRoot(), "game-2048/src/scenes/Game2048Scene.ts"), "utf8");
    const main = fs.readFileSync(path.join(appsRoot(), "game-2048/src/main.tsx"), "utf8");
    const guest = fs.readFileSync(path.join(appsRoot(), "game-2048/src/logic/guest-engine.ts"), "utf8");
    const manifest = fs.readFileSync(path.join(appsRoot(), "game-2048/src/manifest.ts"), "utf8");

    expect(wrapper).toContain("rush-stage-shell");
    expect(wrapper).toContain("rush-stage-hud");
    expect(wrapper).toContain("rush-ingame-drawer");
    expect(wrapper).toContain("rush-drawer__summary");
    expect(wrapper).toContain("rush-history");
    expect(wrapper).toContain("rush-a11y-layer");
    expect(wrapper).toContain('role="radiogroup"');
    expect(wrapper).toContain('aria-live="polite"');
    expect(wrapper).toContain("const canSubmit");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).toContain("refreshLeaderboard");
    expect(wrapper).toContain('val<MoveTransition | null>("moveTransition")');
    expect(wrapper).not.toContain("dispatch(\"startGame\"");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(styles).toContain(".rush-stage-shell");
    expect(styles).toContain(".rush-stage-hud");
    expect(styles).toContain(".rush-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.78");
    expect(styles).toContain("(max-height: 700px)");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain(".rush-a11y-hit:focus-visible");
    expect(scene).toContain("private canStartPicked()");
    expect(scene).toContain("private canMove(dir: number)");
    expect(scene).toContain("return applyMove([...board], dir)");
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("./art/building-e1.webp");
    expect(scene).toContain("./art/building-e11.webp");
    expect(scene).toContain("rush-building-e");
    expect(scene).toContain("this.sfx.");
    expect(scene).toContain("this.playSfx(\"move\")");
    expect(scene).toContain("this.playSfx(\"merge\")");
    expect(scene).toContain('this.dispatch("setDifficulty", idx)');
    expect(scene).toContain("this.reducedMotion");
    expect(scene).toContain("private animateMoveTransition(transition: MoveTransition)");
    expect(scene).toContain("motion.source");
    expect(scene).toContain("motion.destination");
    expect(scene).toContain("merge.sources");
    expect(scene).toContain("transition.spawn");
    expect(scene).toContain("private inputLocked = false");
    expect(scene).toContain("this.inputLocked = true");
    expect(scene).toContain("this.finishMoveAnimation(transition.after)");
    expect(scene).toContain("baseScales");
    expect(scene).toContain("base.x * scale");
    expect(scene).toContain("private tweenTileScale(");
    expect(scene).toContain("this.tweenTileScale(tile, 1.16");
    expect(scene).not.toContain("newTileIndices");
    expect(scene).not.toContain("animateBoardTransition");
    expect(scene).not.toContain("playSlideHint");
    expect(main).toContain("createObservable<MoveTransition | null>(null)");
    expect(main).toContain("applyStepWithTransition(run, dir, result.spawn, moveSequence + 1)");
    expect(main).toContain("moveTransition.set(applied.transition)");
    expect(main).toContain("scheduleMoveUnlock()");
    expect(main).toContain("manifest.supportsGameFi === false");
    expect(main).toContain("requireBoard(opened.view.board)");
    expect(main).toContain("rewardGame.replayOps(opened, ops");
    expect(main).toContain("canReleaseExpiredGame(obs.deadline.get(), settlementGraceMs.get())");
    expect(main).toContain('obs.gameStatus.set("unknown")');
    expect(main).not.toContain('settled.status === "unknown" ? "solved"');
    expect(guest).toContain("webCrypto.getRandomValues");
    expect(guest).not.toContain("Math.random");
    expect(manifest).toContain("directPlay: true");
    expect(manifest).toContain("supportsGameFi: false");
    expect(manifest).toContain("operations: []");
  });

  // The engine drops in-flight moves and the scene has its own inputLocked, but
  // nothing covered the React gate that disables the accessible move buttons.
  it("locks the accessible move controls while a move is in flight", () => {
    const dispatch = vi.fn();
    const { getByRole } = render(
      <PhaserPlayArea t={t} state={dealtState({ isMoving: true })} dispatch={dispatch} />,
    );

    const slideLeft = getByRole("button", { name: "Slide left" }) as HTMLButtonElement;
    expect(slideLeft.disabled).toBe(true);

    fireEvent.click(slideLeft);
    expect(dispatch).not.toHaveBeenCalledWith("playMove", { dir: 3 });
  });

  // The drawer test asserts the "you" tag; data-me is the separate attribute
  // the row highlight (PlayArea.scss `&[data-me="true"]`) hangs off.
  it("marks the viewer's own leaderboard row for styling", () => {
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "gamefi",
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(getByText("Leaderboard & rules"));

    const rows = container.querySelectorAll(".rush-ranks__row");
    expect(rows.length).toBe(2);
    expect(rows[0]?.getAttribute("data-me")).toBeNull();
    expect(rows[1]?.getAttribute("data-me")).toBe("true");
  });

  // canSubmit excludes timeUp. The existing past-deadline case uses INIT_BOARD,
  // where the target tile is absent anyway — so it never proved the timeUp arm.
  it("closes submission once the deadline passes even with the target tile on the board", () => {
    const { queryByRole } = render(
      <PhaserPlayArea
        t={t}
        state={dealtState({
          appMode: "gamefi",
          runBoard: [...WINNING_BOARD],
          runMaxExp: 9,
          runMoveCount: 254,
          deadline: Date.now() - 1_000,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(queryByRole("button", { name: "Submit run" })).toBeNull();
  });

  // "refunded" is an alias of "expired" in the wrapper (isExpired).
  it.each(["expired", "refunded"])(
    "titles the stage with the expired banner when a GameFi run is %s",
    (gameStatus) => {
      const { getByText } = render(
        <PhaserPlayArea
          t={t}
          state={state({ appMode: "gamefi", gameStatus })}
          dispatch={vi.fn()}
        />,
      );

      expect(getByText("That run got away")).toBeTruthy();
    },
  );

  it("announces the payout in the drawer after a GameFi win", () => {
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: GAME_ID,
          appMode: "gamefi",
          gameStatus: "solved",
          lastPayout: "0.5",
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(getByText("Leaderboard & rules"));

    expect(container.querySelector(".rush-drawer__seed")?.textContent).toContain("0.5");
  });
});
