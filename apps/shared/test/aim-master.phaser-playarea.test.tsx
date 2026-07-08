import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
      return <div data-testid="aim-master-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../aim-master/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

const SAMPLE_PATTERN = "150,176,202,224,238,244";
const COMMITMENT = "ab".repeat(32);

function appSource(app: string, file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src", file), "utf8");
}

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Aim Master",
    appSubtitle: "Stop the moving reticle on the bullseye.",
    lobbyTitle: "Open the target range",
    playingTitle: "{difficulty} run in play",
    submitRound: "Submit round",
    statusShuffling: "Sealing your target pattern...",
    statusWonTitle: "Bullseye!",
    expiredBanner: "That game expired",
    difficulty_easy: "Warm-up Lane",
    difficulty_medium: "Arcade Range",
    difficulty_hard: "Pro Circuit",
    networkBadge: "Neo N3",
    rankBadge: "Rank #{rank}",
    scoreTime: "Time left",
    timeMetric: "Time",
    scoreRings: "Accuracy hits",
    hitsMetric: "Hits",
    scoreReward: "Reward at stake",
    rewardMetric: "Reward",
    scoreWon: "Total won",
    drawerTitle: "Leaderboard & rules",
    drawerTitleShort: "Rules",
    leaderboardIntro: "The global ranking is rebuilt from on-chain Solved events.",
    leaderboardTitle: "Global leaderboard",
    leaderboardEmpty: "No solves recorded yet.",
    refreshRanks: "Refresh ranking",
    solvesCount: "{count} solves",
    youTag: "you",
    historyTitle: "My solves",
    historyEmpty: "Your solved games will appear here.",
    historyRings: "{rings} hits",
    rulesTitle: "How it works",
    rulesCopy: "Tap when the reticle crosses the bullseye.",
    rulesShort: "Tap the range when the moving reticle crosses the bullseye.",
    fairnessTitle: "Provably fair target",
    fairnessCopy: "The pattern is generated inside the TEE.",
    fairnessShort: "The target path stays sealed inside the TEE.",
    checkDealAgain: "Retry sealing",
    releaseAction: "Release game",
    releaseHint: "Frees the reward reservation.",
    shufflingCopy: "The target is sealed inside the Morpheus enclave.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Withdraw winnings.",
    commitmentLine: "Game #{gameId} sealed as {commitment}",
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
    poolFree: 25,
    credit: 0,
    activeGameId: "42",
    gameStatus: "dealt",
    gameDifficulty: 1,
    pattern: SAMPLE_PATTERN,
    targetAccuracy: 5,
    ringsHit: 0,
    roundIndex: 0,
    roundResults: [],
    commitment: COMMITMENT,
    leaderboard: [],
    myRank: 0,
    myTotalWon: 0,
    myHistory: [],
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    lastStatus: "Target sealed and bound",
    deadline: Date.now() + 60_000,
    dealtAt: Date.now() - 30_000,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("aim-master Phaser playarea", () => {
  it("passes the sealed TEE aim pattern into the production Phaser scene bridge", () => {
    const { container } = render(<PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      state: Record<string, unknown>;
    };

    expect(container.querySelector(".aim-stage-shell")).toBeTruthy();
    expect(container.querySelector(".aim-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(props.className).toBe("aim-phaser-canvas");
    expect(props.ariaLabel).toBe("Aim Master archery game");
    expect(props.config?.width).toBe(520);
    expect(props.config?.height).toBe(720);
    expect(props.state.pattern).toBe(SAMPLE_PATTERN);
    expect(props.state.targetAccuracy).toBe(5);
    expect(props.state.gameDifficulty).toBe(1);
    expect(props.state.poolFree).toBe(25);
    expect(props.state.ringsHit).toBe(0);
    expect(props.state.lastStatus).toBe("Target sealed and bound");
    expect(props.state).not.toHaveProperty("patternData");
  });

  it("keeps compact in-stage HUD synced with the active Phaser run", () => {
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({ ringsHit: 3, targetAccuracy: 5, myTotalWon: 1.25 })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".aim-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(screen.getByText("3/5")).toBeTruthy();
    expect(screen.queryByText("0/5")).toBeNull();
    expect(screen.queryByText("1.25 GAS")).toBeNull();
  });

  it("surfaces recovery actions, leaderboard, history, and sealed TEE proof inside the in-stage drawer", () => {
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          credit: 0.75,
          gameStatus: "committed",
          isDealing: false,
          myRank: 2,
          leaderboard: [
            { rank: 1, address: "0xabcdef1234567890abcdef1234567890abcdef12", totalWon: 12.3, solves: 20, isUser: false },
            { rank: 2, address: "0x1234567890abcdef1234567890abcdef12345678", totalWon: 8.1, solves: 11, isUser: true },
          ],
          myHistory: [{
            gameId: "7",
            difficulty: 1,
            payout: "0.50 GAS",
            solveMs: 42_000,
            undos: 0,
            ringsHit: 5,
          }],
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".aim-ingame-drawer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^rules$/i }));
    expect(container.querySelector(".aim-ingame-drawer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry sealing/i }));
    expect(dispatch).toHaveBeenCalledWith("retryDeal", {});
    fireEvent.click(screen.getByRole("button", { name: /withdraw 0.75 GAS/i }));
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings", {});

    expect(screen.getByText("12.30 GAS")).toBeTruthy();
    expect(screen.getByText("8.10 GAS")).toBeTruthy();
    expect(screen.getByText("5 hits")).toBeTruthy();
    expect(container.querySelector(".aim-drawer__seed")?.textContent).toContain("Game #42");

    fireEvent.click(screen.getByRole("button", { name: /refresh ranking/i }));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard", {});
  });

  it("streams aim taps through the registered aimHit action instead of an orphan action name", () => {
    const sceneSource = appSource("aim-master", "scenes/AimMasterScene.ts");

    expect(sceneSource).toContain('this.dispatch("aimHit"');
    expect(sceneSource).toContain("roundResults: this.shotResults");
    expect(sceneSource).not.toContain('this.dispatch("recordMove"');
  });

  it("keeps the Aim Master shell full-height with in-stage HUD and drawer controls", () => {
    const styles = appSource("aim-master", "PlayArea.scss");
    const wrapper = appSource("aim-master", "PhaserPlayArea.tsx");

    expect(styles).toContain(".aim-stage-shell");
    expect(styles).toContain(".aim-stage-hud");
    expect(styles).toContain(".aim-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2.08");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("secondaryActions");
  });
});
