import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    accuracyCount: "{count} hits needed",
    startAction: "Enter range",
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
    a11yStageLabel: "Aim Master target range",
    a11yOpeningRange: "Opening target range",
    a11yDifficultyGroup: "Choose target lane",
    a11yShoot: "Fire at the current reticle position",
    scenePoolNeedsGas: "Reward pool needs GAS before entry",
    close: "Close",
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
    scorePoints: 0,
    combo: 0,
    maxCombo: 0,
    selectedDifficulty: 0,
    mode: "gamefi",
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
    expect(props.ariaLabel).toBe("Aim Master target range");
    expect(props.config?.width).toBe(520);
    expect(props.config?.height).toBe(720);
    expect(props.state.pattern).toBe(SAMPLE_PATTERN);
    expect(props.state.targetAccuracy).toBe(5);
    expect(props.state.gameDifficulty).toBe(1);
    expect(props.state.poolFree).toBe(25);
    expect(props.state.ringsHit).toBe(0);
    expect(props.state.scorePoints).toBe(0);
    expect(props.state.combo).toBe(0);
    expect(props.state.maxCombo).toBe(0);
    expect(props.state.selectedDifficulty).toBe(0);
    expect(props.state.a11yShotPulse).toBe(0);
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

  it("exposes the physical lobby and shot loop to keyboard and assistive technology", () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "0",
          gameStatus: "idle",
          mode: "guest",
          selectedDifficulty: 1,
          pattern: "",
          deadline: 0,
          dealtAt: 0,
        })}
        dispatch={dispatch}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[1]?.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(radios[1]!, { key: "ArrowRight" });
    expect(dispatch).toHaveBeenCalledWith("selectDifficulty", { difficulty: 2 });
    fireEvent.click(screen.getByRole("button", { name: /enter range/i }));
    expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 1 });
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
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(container.querySelector(".aim-ingame-drawer")).toBeNull();
  });

  it("streams aim taps through the registered aimHit action instead of an orphan action name", () => {
    const sceneSource = appSource("aim-master", "scenes/AimMasterScene.ts");

    expect(sceneSource).toContain('this.dispatch("aimHit"');
    expect(sceneSource).toContain("roundResults: this.shotResults");
    expect(sceneSource).not.toContain('this.dispatch("recordMove"');
  });

  it("guards duplicate shots, deadline expiry, restart state, and reduced motion in-scene", () => {
    const sceneSource = appSource("aim-master", "scenes/AimMasterScene.ts");

    expect(sceneSource).toContain("private inputLocked = false");
    expect(sceneSource).toContain("this.inputLocked = true");
    expect(sceneSource).toContain("SHOT_ACK_TIMEOUT_MS");
    expect(sceneSource).toContain("private awaitingShotAck = false");
    expect(sceneSource).toContain("private syncCanonicalShotLog(force = false)");
    expect(sceneSource).toContain("private expirationDispatched = false");
    expect(sceneSource).toContain("private expireRoundOnce()");
    expect(sceneSource.match(/this\.dispatch\("expireGame"/g)).toHaveLength(1);
    expect(sceneSource).toContain("this.updateTimerBar();");
    expect(sceneSource).toContain("time - this.lastTimerPaintAt >= 100");
    expect(sceneSource).toContain("private resetRoundRuntime()");
    expect(sceneSource).toContain("this.clearGameplayTimers()");
    expect(sceneSource).toContain("difficultyProfile(this.currentDifficulty).reducedMotionStepMs");
    expect(sceneSource).toContain("generateDifficultyPattern(\"aim-master-fallback\", difficulty)");
    expect(sceneSource).toContain("this.runSummary = scored.summary");
  });

  it("re-derives UI score and GameFi telemetry from the canonical shot log", () => {
    const mainSource = appSource("aim-master", "main.tsx");
    const guestSource = appSource("aim-master", "logic/guest-engine.ts");

    expect(mainSource).toContain("const evaluated = evaluateHitResults(form.roundResults)");
    expect(mainSource).toContain("scorePoints.set(evaluated.summary.score)");
    expect(guestSource).toContain("ringsHit / totalRings / totalPoints are intentionally ignored");
    expect(guestSource).toContain("if (ringsHit.get() < targetAccuracy.get()) return");
    expect(guestSource).toContain("generateDifficultyPattern(seedSource(), diff, rule.limitMs)");
    expect(guestSource).not.toContain("Math.random(");
    expect(guestSource).toContain("next.results.length !== previous.results.length + 1");
  });

  it("keeps paid settlement fail-closed and reads the real Aim Master event slots", () => {
    const mainSource = appSource("aim-master", "main.tsx");
    const rulesSource = appSource("aim-master", "logic/game-rules.ts");
    const sceneSource = appSource("aim-master", "scenes/AimMasterScene.ts");

    expect(mainSource).toContain("solvedPayout: 5");
    expect(mainSource).toContain("totalWon: 6");
    expect(mainSource).toContain("eventSlots: { solvedPayout: 5 }");
    expect(mainSource).toContain("export const NEW_PAID_RUNS_ENABLED = false");
    expect(mainSource).toContain("if (!NEW_PAID_RUNS_ENABLED)");
    expect(mainSource).toContain("startResultMatchesIntent");
    expect(mainSource).toContain("gameMatchesIdentity");
    expect(mainSource).toContain("sessionMatchesRule");
    expect(mainSource).toContain('settled.status === "unknown"');
    expect(mainSource).toContain('obs.gameStatus.set("unknown")');
    expect(mainSource).toContain("canReleaseAfterGrace(obs.deadline.get())");
    expect(rulesSource).toContain('case 5:\n      // Finalize was broadcast');
    expect(rulesSource).toContain('return "unknown"');
    expect(sceneSource).toContain('this.dispatch("submitSolution", {})');
    expect(sceneSource).toContain('this.str("mode", "gamefi") === "guest"');
  });

  it("keeps the Aim Master shell full-height with in-stage HUD and drawer controls", () => {
    const styles = appSource("aim-master", "PlayArea.scss");
    const wrapper = appSource("aim-master", "PhaserPlayArea.tsx");

    expect(styles).toContain(".aim-stage-shell");
    expect(styles).toContain(".aim-stage-hud");
    expect(styles).toContain(".aim-ingame-drawer");
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2.08");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 70");
    expect(styles).toContain(".aim-a11y-layer");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("secondaryActions");
  });

  // The stage title/subtitle are rendered by the shared PlayStage (Stage.tsx
  // emits .mx2-stage__title / .mx2-stage__subtitle) inside .aim-playarea — the
  // wrapper's root class. These rules are live for the Phaser surface; the
  // shell test above never covers the mx2-stage__* lane.
  it("styles the shared stage title and hides the subtitle on narrow screens", () => {
    const styles = appSource("aim-master", "PlayArea.scss");

    expect(styles).toMatch(
      /\.aim-playarea \.mx2-stage__title \{[^}]*font-weight: 560;[^}]*\}/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 560px\) \{[\s\S]*?\.aim-playarea \.mx2-stage__subtitle \{[^}]*display: none;[^}]*\}/,
    );
  });

  it("titles the stage with the expired banner once the game has expired", () => {
    render(
      <PhaserPlayArea t={t} state={state({ gameStatus: "expired" })} dispatch={vi.fn()} />,
    );

    expect(screen.getByText("That game expired")).toBeTruthy();
  });

  // GUARD (restored fleet regression): a paid run must never start while the
  // reward pool cannot cover the payout. The accessible start path dispatches
  // startGame directly, so it must carry the same gate as the canvas —
  // disabled AND explained, never a live-looking control that leaks a start.
  it("blocks the accessible paid start while the reward pool cannot cover the payout", () => {
    const dispatch = vi.fn(async () => undefined);
    const lobby = {
      activeGameId: "0",
      gameStatus: "idle",
      mode: "gamefi",
      selectedDifficulty: 1,
      pattern: "",
      deadline: 0,
      dealtAt: 0,
    };
    const { container, rerender } = render(
      <PhaserPlayArea t={t} state={state({ ...lobby, poolFree: 0 })} dispatch={dispatch} />,
    );

    // Click first: with the gate removed this leaks a paid start on an empty
    // pool, so the dispatch assertion is the one that names the regression.
    const blocked = container.querySelector(".aim-a11y-start") as HTMLButtonElement;
    fireEvent.click(blocked);
    expect(dispatch).not.toHaveBeenCalledWith("startGame", expect.anything());
    expect(blocked.disabled).toBe(true);
    expect(blocked.textContent).toContain("Reward pool needs GAS before entry");

    rerender(
      <PhaserPlayArea t={t} state={state({ ...lobby, poolFree: 25 })} dispatch={dispatch} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enter range/i }));
    expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 1 });
  });

  it("keeps guest (free local) starts exempt from the reward pool gate", () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "0",
          gameStatus: "idle",
          mode: "guest",
          selectedDifficulty: 2,
          pattern: "",
          deadline: 0,
          dealtAt: 0,
          poolFree: 0,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enter range/i }));
    expect(dispatch).toHaveBeenCalledWith("startGame", { difficulty: 2 });
  });

  // The in-canvas start button funnels through bindGameButton; its enabled()
  // gate is what keeps a pointer press from dispatching a paid start while the
  // pool is short, independent of the syncLobbyCards interactivity toggle.
  it("pool-gates the canvas start dispatch inside the scene chokepoint", () => {
    const sceneSource = appSource("aim-master", "scenes/AimMasterScene.ts");

    expect(sceneSource).toContain(
      'enabled: () => !this.bool("isStarting")',
    );
    expect(sceneSource).toContain(
      'this.selectedPoolIsReady(this.num("poolFree", 0))',
    );
    expect(sceneSource).toContain("private selectedPoolIsReady(poolFree: number): boolean");
  });

  it("traps keyboard focus inside the modal rules drawer", async () => {
    render(<PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /^rules$/i });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: /close/i });
    await waitFor(() => expect(document.activeElement).toBe(close));
    const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    const last = focusable.at(-1)!;
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    close.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
