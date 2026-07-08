import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
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
      return <div data-testid="curve-arrow-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../curve-arrow/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
  window.localStorage.clear();
});

const GAME_ID = "8";
const SAMPLE_CLUES = JSON.stringify({
  levels: [
    {
      target: { x: 1300, y: 430 },
      obstacles: [{ x: 760, y: 260, w: 70, h: 640 }],
    },
    {
      target: { x: 1340, y: 380 },
      obstacles: [
        { x: 640, y: 0, w: 70, h: 500 },
        { x: 1020, y: 320, w: 70, h: 580 },
      ],
    },
    {
      target: { x: 1380, y: 460 },
      obstacles: [{ x: 900, y: 180, w: 80, h: 720 }],
    },
  ],
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Curve Arrow",
    appSubtitle: "Shoot, then hold to curve the arrow over the walls and hit every target before time runs out.",
    checkDealAgain: "Retry sealing",
    creditLabel: "Withdrawable credit",
    difficulty_easy: "Meadow Range",
    difficulty_medium: "Forest Range",
    difficulty_hard: "Summit Range",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    expiredBanner: "That game expired",
    fairnessShort: "TEE wall layouts stay private.",
    lobbyTitle: "Open the archery range",
    networkBadge: "Neo N3",
    playingTitle: "{difficulty} game in play",
    progressionNextRoute: "Next: {difficulty}",
    progressionStatusLabel: "Range",
    progressionUnavailableShort: "History offline",
    rankBadge: "Rank #{rank}",
    releaseAction: "Release game",
    rewardMetric: "Reward",
    routeSummary: "Selected range reward, entry, targets, and clock",
    rulesShort: "Curve over the walls and clear every target.",
    scoreReward: "Reward at stake",
    scoreWon: "Total won",
    startAction: "Start range",
    statusReady: "Choose an archery range to start",
    statusStarted: "Game started",
    statusWonTitle: "Range cleared!",
    timeMetric: "Time",
    timeUpAction: "Time is up",
    withdrawAction: "Withdraw {amount} GAS",
    wonMetric: "Won",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    credit: 0,
    poolFree: 25,
    activeGameId: "0",
    gameStatus: "idle",
    gameDifficulty: 0,
    progressionReady: true,
    progressionRequiredDifficulty: 0,
    progressionMaxDifficulty: 2,
    progressionHardChallengeLevel: 0,
    progressionEffectiveLimitMs: 0,
    clues: "",
    commitment: "",
    dealtAt: 0,
    deadline: 0,
    lastPayout: "",
    lastElapsedMs: 0,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    walletConnected: true,
    lastStatus: "Choose an archery range to start",
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([k, v]) => [k, createObservable(v)]),
  );
}

function dealtState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return state({
    activeGameId: GAME_ID,
    gameStatus: "dealt",
    gameDifficulty: 0,
    clues: SAMPLE_CLUES,
    commitment: "ab".repeat(32),
    dealtAt: Date.now() - 60_000,
    deadline: Date.now() + 100_000,
    ...overrides,
  });
}

function sceneSource(): string {
  const sharedRoot = process.cwd().endsWith("/apps/shared")
    ? process.cwd()
    : resolve(process.cwd(), "apps/shared");
  return readFileSync(
    resolve(sharedRoot, "../curve-arrow/src/scenes/CurveArrowScene.ts"),
    "utf8",
  );
}

describe("curve-arrow playarea (TEE mode)", () => {
  it("renders a game-first archery stage with the range inside the Phaser canvas", () => {
    const { container, getByText, getByTestId } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".curve-arrow-playarea")).toBeTruthy();
    expect(container.querySelector(".curve-arrow-stage-shell")).toBeTruthy();
    expect(container.querySelector(".curve-arrow-stage-hud")).toBeTruthy();
    expect(getByTestId("curve-arrow-phaser-host")).toBeTruthy();
    expect(container.querySelector("form")).toBeNull();
    expect(getByText("Open the archery range")).toBeTruthy();
    expect(getByText("Reward")).toBeTruthy();
    expect(getByText("Time")).toBeTruthy();
    expect(getByText("Won")).toBeTruthy();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
  });

  it("bridges the dealt enclave layouts into the Phaser scene state", () => {
    render(<PhaserPlayArea t={t} state={dealtState()} dispatch={vi.fn()} />);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };
    expect(props.state.gameStatus).toBe("dealt");
    expect(props.state.clues).toBe(SAMPLE_CLUES);
    expect(props.state.activeGameId).toBe(GAME_ID);
    expect(props.state.deadline).toBeGreaterThan(Date.now());
    expect(props.state.dealtAt).toBeGreaterThan(0);
  });

  it("shows the playing title for a dealt game and the expiry title after release", () => {
    const dealt = render(<PhaserPlayArea t={t} state={dealtState()} dispatch={vi.fn()} />);
    expect(dealt.getByText("Meadow Range game in play")).toBeTruthy();
    dealt.unmount();

    const expired = render(
      <PhaserPlayArea t={t} state={state({ gameStatus: "expired" })} dispatch={vi.fn()} />,
    );
    expect(expired.getByText("That game expired")).toBeTruthy();
  });

  it("shows the won title after a solve", () => {
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ gameStatus: "solved", lastPayout: "0.10 GAS" })}
        dispatch={vi.fn()}
      />,
    );
    expect(getByText("Range cleared!")).toBeTruthy();
  });

  it("triggers withdraw from the in-stage drawer", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ credit: 1.5, gameStatus: "solved" })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(getByRole("button", { name: /Rules/i }));
    fireEvent.click(getByText("Withdraw 1.50 GAS"));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});
    });
  });

  it("keeps the time-up release action inside the drawer when the deadline passes", () => {
    const { getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={dealtState({ deadline: Date.now() - 1000 })}
        dispatch={vi.fn()}
      />,
    );
    fireEvent.click(getByRole("button", { name: /Rules/i }));
    expect(getByText("Time is up")).toBeTruthy();
  });
});

describe("curve-arrow scene source guard", () => {
  it("builds on the framework Phaser SDK with the shared SFX mixer", () => {
    const source = sceneSource();
    expect(source).toContain('from "@framework/phaser"');
    expect(source).not.toContain("@shared/phaser");
    expect(source).toContain("extends BaseScene");
    expect((source.match(/this\.sfx\./g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(source).toContain('this.sfx.play("start")');
    expect(source).toContain('this.sfx.play("throw")');
    expect(source).toContain('this.sfx.play("score")');
    expect(source).toContain('this.sfx.play("combo")');
    expect(source).toContain('this.sfx.play("win")');
    expect(source).toContain('this.sfx.play("lose")');
    expect(source).toContain('this.sfx.play("error")');
    expect(source).toContain('this.sfx.play("land")');
    expect(source).toContain("this.sfx.tones(");
  });

  it("preloads all nine range art assets", () => {
    const source = sceneSource();
    const artFiles = [
      "range-sky.webp",
      "bow.webp",
      "arrow.webp",
      "target-board.webp",
      "wall-stone.webp",
      "badge-easy.webp",
      "badge-medium.webp",
      "badge-hard.webp",
      "reward-medal.webp",
    ];
    for (const file of artFiles) {
      expect(source, `scene must preload ./art/${file}`).toContain(`./art/${file}`);
    }
    expect((source.match(/this\.load\.image\(/g) ?? []).length).toBe(9);
  });

  it("replays the deterministic engine tick loop and dispatches the shot ops", () => {
    const source = sceneSource();
    // The live flight loop must use the exact integer rotation the enclave
    // replays: Q12 shifts with the shared TURN constants and Q8 positions.
    expect(source).toContain("TURN_COS + flight.vy * TURN_SIN) >> 12");
    expect(source).toContain("flight.posX >> 8");
    expect(source).toContain("MAX_HOLD_PAIRS");
    expect(source).toContain("applyShot(this.run, this.levels, holds)");
    expect(source).toContain('this.dispatch("recordShot", { holds })');
    expect(source).toContain('this.dispatch("submitSolution")');
    expect(source).toContain('this.dispatch("startGame", { difficulty })');
    expect(source).toContain('this.dispatch("selectDifficulty", { difficulty })');
    expect(source).toContain("this.reducedMotion");
    expect(source).toContain("this.bindGameButton(");
  });

  it("keeps the scene source free of emoji placeholders", () => {
    const source = sceneSource();
    const emojiPattern = new RegExp(
      "[\\u{1F000}-\\u{1FAFF}]|[\\u{2600}-\\u{27BF}]|\\u{FE0F}",
      "u",
    );
    expect(emojiPattern.test(source)).toBe(false);
    expect(source).not.toContain("emoji");
  });
});
