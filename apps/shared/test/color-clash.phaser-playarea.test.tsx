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
      return <div data-testid="color-clash-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../color-clash/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Color Clash",
    appSubtitle: "Watch the colors, then replay the sequence.",
    close: "Close",
    color_blue: "Blue",
    color_green: "Green",
    color_red: "Red",
    color_yellow: "Yellow",
    colorClashActionFailed: "The memory run could not continue",
    colorClashStageAlt: "Color Clash memory game",
    continue: "Continue",
    checkSettlementAction: "Check settlement",
    checkDealAgain: "Retry deal",
    commitmentLine: "Game #{gameId} sealed #{commitment}",
    creditLabel: "Withdrawable credit",
    drawerTitle: "Leaderboard & rules",
    expiredBanner: "Game released",
    fairnessCopy: "TEE seals the sequence commitment before settlement.",
    fairnessTitle: "Provably fair sequences",
    historyEmpty: "Your completed sequences will appear here.",
    historyTitle: "My solves",
    leaderboardTitle: "Global leaderboard",
    leaderboardIntro: "Rebuilt from on-chain events.",
    leaderboardEmpty: "No solves recorded yet.",
    guestBestLabel: "Best local score",
    guestBoardTitle: "Guest leaderboard",
    guestDrawerTitle: "Guest board & rules",
    guestEyebrow: "Color Clash · Guest",
    guestExpiredTitle: "Local run ended",
    guestFairnessCopy: "Guest mode uses local randomness.",
    guestFairnessTitle: "Local random sequence",
    guestHistoryEmpty: "Saved guest runs appear here.",
    guestHistoryTitle: "Local runs",
    guestLeaderboardEmpty: "No local scores yet.",
    guestLeaderboardIntro: "Guest scores record cue counts.",
    guestLobbyTitle: "Local memory board",
    guestModeBadge: "Guest mode",
    guestModeLabel: "Mode",
    guestModeValue: "No token",
    guestPlayingTitle: "Local sequence in play",
    guestProgressLabel: "Local progress",
    guestRefreshBoard: "Refresh board",
    guestRestartAction: "Restart run",
    guestRestartHint: "Clear this local sequence.",
    guestRulesCopy: "Repeat the local sequence. No token or chain action is involved.",
    guestScoreValue: "{count} cues",
    guestSolvedTitle: "Local sequence mastered",
    guestStatusSaving: "Saving local score...",
    guestSubmitAction: "Save score",
    guestSubmitHint: "Save the cue count.",
    guestSubtitle: "Play locally with no GAS, transaction, or oracle request.",
    lobbyTitle: "Enter the arcade",
    muteGameSound: "Mute game sound",
    networkBadge: "Neo N3",
    openingColorBoard: "Opening color board",
    pressButton: "Press {color}",
    rankBadge: "Rank #{rank}",
    rankLabel: "Global rank",
    repeatPhase: "Repeat the sequence!",
    retry: "Retry",
    refreshRanks: "Refresh ranking",
    releaseAction: "Release game",
    releaseHint: "Release stuck or expired game.",
    releaseReadyStatus: "Recovery complete.",
    releaseWaitAction: "Recovery countdown",
    releaseWaitStatus: "Wait for the recovery window.",
    releaseWaitTitle: "Run sealed — recovery pending",
    settlementCheckingTitle: "Checking settlement...",
    rulesCopy: "Pick a mode, watch the colors, repeat the full sequence.",
    roundLabel: "Round",
    startAction: "Play sequence",
    scoreReward: "Reward at stake",
    scoreReleaseIn: "Release in",
    scoreSeqLen: "Sequence length",
    scoreTime: "Time left",
    scoreWon: "Total won",
    sidebarTitle: "My memory record",
    solvesCount: "{count} solves",
    statusDealPending: "Sealing is taking longer than usual.",
    statusShuffling: "Sealing your sequence...",
    statusSubmitting: "Enclave verifying...",
    statusWonTitle: "Correct!",
    submitAction: "Claim reward",
    submitHint: "Sequence completed.",
    timeUpAction: "Time is up",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pull credit back to your wallet.",
    withdrawTitle: "Withdraw winnings",
    youTag: "you",
    difficulty_easy: "Pulse Arcade",
    difficulty_medium: "Neon Rush",
    difficulty_hard: "Master Circuit",
    difficultyTitle: "Arcade mode",
    enableGameSound: "Enable game sound",
    targetSeqLabel: "{count} cues",
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
    appMode: "gamefi",
    gameStatus: "idle",
    gameDifficulty: 2,
    selectedDifficulty: 2,
    sequence: "",
    playerSequence: "",
    activeGameId: "0",
    commitment: "",
    deadline: 0,
    dealtAt: 0,
    undosUsed: 0,
    seqAchieved: 0,
    roundNumber: 0,
    roundPhase: "lobby",
    isPressing: false,
    isStarting: false,
    isDealing: false,
    isSubmitting: false,
    isRecovering: false,
    settlementGraceMs: 600_000,
    poolFree: 25,
    credit: 0,
    lastStatus: "",
    myRank: 0,
    myTotalWon: 0,
    mySolves: 0,
    leaderboard: [],
    myHistory: [],
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

describe("color-clash Phaser playarea", () => {
  it("passes game state into the production Phaser memory board without a duplicate outer start action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getAllByRole, getByRole } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.gameStatus).toBe("idle");
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.selectedDifficulty).toBe(2);
    expect(props.state.appMode).toBe("gamefi");
    expect(props.state.poolFree).toBe(25);
    expect(props.state.sequence).toBe("");
    expect(props.state.activeGameId).toBe("0");
    expect(props.state.deadline).toBe(0);
    expect(props.state.undosUsed).toBe(0);
    expect(props.state.roundNumber).toBe(0);
    expect(props.state.roundPhase).toBe("lobby");
    expect(props.state.isPressing).toBe(false);
    expect((props as { className?: string }).className).toBe("cclash-phaser-canvas");
    expect((props as { ariaLabel?: string }).ariaLabel).toBe("Color Clash memory game");
    expect((props as { loadingLabel?: string }).loadingLabel).toBe("Opening color board");
    expect((props as { errorLabel?: string }).errorLabel).toBe("The memory run could not continue");
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(getAllByRole("radio")).toHaveLength(3);
    fireEvent.click(getByRole("button", { name: "Play sequence" }));
    expect(dispatch).toHaveBeenCalledWith("startGame", 2);
  });

  it("provides keyboard difficulty, pad, and primary controls over the Phaser assets", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByRole, rerender } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    const radios = getAllByRole("radio") as HTMLButtonElement[];
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, -1, 0]);

    radios[2]!.focus();
    fireEvent.keyDown(radios[2]!, { key: "ArrowLeft" });
    expect(dispatch).toHaveBeenCalledWith("setDifficulty", 1);
    expect(document.activeElement).toBe(radios[1]);
    expect((getByRole("button", { name: "Press Red" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          sequence: "0",
          roundNumber: 1,
          roundPhase: "input",
          deadline: Date.now() + 60_000,
          dealtAt: Date.now(),
        })}
        dispatch={dispatch}
      />,
    );
    const red = getByRole("button", { name: "Press Red" });
    expect((red as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(red);
    expect(dispatch).toHaveBeenCalledWith("recordPress", 0);
  });

  it("renders guest mode without GAS, Neo, or withdraw framing", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          gameDifficulty: 0,
          sequence: "01230123",
          playerSequence: "0123",
          seqAchieved: 4,
          roundNumber: 8,
          roundPhase: "input",
          credit: 1,
          leaderboard: [
            { address: "Nlocal111111111111111111111111111111", rank: 1, totalWon: 8, solves: 1 },
          ],
          myRank: 1,
        })}
        dispatch={dispatch}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.appMode).toBe("guest");
    expect(getByText("Color Clash · Guest")).toBeTruthy();
    expect(getByText("Repeat the sequence!")).toBeTruthy();
    expect(getByText("Local progress")).toBeTruthy();
    expect(getByText("4/8")).toBeTruthy();
    expect(getByText("No token")).toBeTruthy();
    expect(queryByText("Neo N3")).toBeNull();
    expect(queryByText("Withdraw 1.00 GAS")).toBeNull();
    expect(container.textContent).not.toContain("Reward at stake");
    expect(container.textContent).not.toContain("Total won");

    fireEvent.click(getByText("Guest leaderboard"));

    expect(container.querySelector(".cclash-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".cclash-drawer__credit")).toBeNull();
    expect(container.textContent).toContain("Guest scores record cue counts.");
    expect(container.textContent).toContain("Guest mode uses local randomness.");
    expect(container.textContent).not.toContain("Withdrawable credit");
    expect(container.textContent).not.toContain("Withdraw 1.00 GAS");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".cclash-ingame-drawer")).toBeNull();
  });

  it("keeps settlement action inside the Phaser board after the sequence is completed", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole, queryByRole, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          gameStatus: "dealt",
          sequence: "0123",
          playerSequence: "01",
          lastStatus: "",
        })}
        dispatch={dispatch}
      />,
    );

    expect(queryByRole("button", { name: "Claim reward" })).toBeNull();
    let props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };
    expect(props.state.playerSequence).toBe("01");

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          gameStatus: "dealt",
          sequence: "0123",
          playerSequence: "",
          lastStatus: "all-correct",
        })}
        dispatch={dispatch}
      />,
    );
    props = mocks.phaserGame.mock.calls[mocks.phaserGame.mock.calls.length - 1]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(getByRole("button", { name: "Claim reward" })).toBeTruthy();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(props.state.lastStatus).toBe("all-correct");
    expect(props.state.actionSubmit).toBe("Claim reward");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("surfaces the contract recovery countdown for a sealed GameFi loss", () => {
    const deadline = Date.now() - 1_000;
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          gameStatus: "dealt",
          activeGameId: "42",
          sequence: "01",
          roundPhase: "wrong",
          deadline,
          dealtAt: deadline - 30_000,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByText("Run sealed — recovery pending")).toBeTruthy();
    expect(getByText("Release in")).toBeTruthy();
    const props = mocks.phaserGame.mock.calls[0]?.[0] as { state: Record<string, unknown> };
    expect(props.state.settlementGraceMs).toBe(600_000);
    expect(props.state.actionReleaseWait).toBe("Recovery countdown");
  });

  it("keeps an unresolved oracle settlement recoverable after reload", () => {
    const deadline = Date.now() - 10_000;
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          gameStatus: "unknown",
          activeGameId: "77",
          lastStatus: "settlement-pending",
          deadline,
          dealtAt: deadline - 60_000,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByText("Run sealed — recovery pending")).toBeTruthy();
    expect(getByText("Release in")).toBeTruthy();
    const props = mocks.phaserGame.mock.calls[0]?.[0] as { state: Record<string, unknown> };
    expect(props.state.actionCheckSettlement).toBe("Check settlement");
    expect(props.state.isRecovering).toBe(false);
  });

  it("keeps deal retry and release recovery inside Phaser while credit withdrawal stays in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole, getByText, queryByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "12",
          gameStatus: "committed",
          lastStatus: "deal-pending",
          credit: 0.5,
        })}
        dispatch={dispatch}
      />,
    );
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(getByRole("button", { name: "Retry deal" })).toBeTruthy();
    expect(queryByRole("button", { name: "Release game" })).toBeNull();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(props.state.actionRetry).toBe("Retry deal");
    expect(props.state.actionRelease).toBe("Release game");

    fireEvent.click(getByText("Global leaderboard"));
    getByText("Withdraw 0.50 GAS").click();

    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
  });

  it("turns a failed deal into an actionable release after the contract grace window", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const deadline = Date.now() - 600_001;
    const { getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "18",
          gameStatus: "dealt",
          lastStatus: "deal-pending",
          deadline,
          dealtAt: deadline - 120_000,
        })}
        dispatch={dispatch}
      />,
    );

    expect(getByText("Run sealed — recovery pending")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Release game" }));
    expect(dispatch).toHaveBeenCalledWith("expireGame");
  });

  it("renders leaderboard, history, fairness, and credit recovery inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "42",
          commitment: "ab".repeat(32),
          credit: 0.25,
          myRank: 2,
          myTotalWon: 1.25,
          mySolves: 3,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5 },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: "42", difficulty: 2, payout: 100_000_000, solveMs: 45000, undos: 0, seqAchieved: 16 },
          ],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Global leaderboard"));

    expect(container.querySelector(".cclash-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail__drawer-toggle")).toBeNull();
    expect(container.querySelector(".cclash-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".cclash-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".cclash-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".cclash-history")?.textContent).toContain("Master Circuit");
    expect(container.querySelector(".cclash-history")?.textContent).toContain("+1.00 GAS");
    expect(container.textContent).toContain("Provably fair sequences");
    expect(container.textContent).toContain("Game #42 sealed");
    expect(container.querySelector(".cclash-drawer__credit")?.textContent).toContain("0.25 GAS");

    getByText("Refresh ranking").click();
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
    fireEvent.click(getByRole("button", { name: "Close" }));
    expect(container.querySelector(".cclash-ingame-drawer")).toBeNull();
  });

  it("keeps the Phaser wrapper from regressing to a one-line rules drawer", () => {
    const source = fs.readFileSync(path.join(appsRoot(), "color-clash/src/PhaserPlayArea.tsx"), "utf8");
    const styles = fs.readFileSync(path.join(appsRoot(), "color-clash/src/PlayArea.scss"), "utf8");
    const manifest = fs.readFileSync(path.join(appsRoot(), "color-clash/src/manifest.ts"), "utf8");

    expect(source).toContain("cclash-ranks");
    expect(source).toContain("cclash-history");
    expect(source).toContain("cclash-stage-shell");
    expect(source).toContain("cclash-stage-hud");
    expect(source).toContain("cclash-ingame-drawer");
    expect(source).toContain("refreshLeaderboard");
    expect(source).toContain("actions={{}}");
    expect(source).toContain("actionSubmit:");
    expect(source).toContain("actionRetry:");
    expect(source).toContain("roundPhase,");
    expect(source).toContain("cclash-a11y-layer");
    expect(source).toContain('role="radiogroup"');
    expect(source).toContain('dispatch("setDifficulty"');
    expect(source).toContain("setInterval(() => setNowMs(Date.now()), 1_000)");
    expect(source).not.toContain("score={");
    expect(source).not.toContain("drawerToggleLabel=");
    expect(source).not.toContain("drawer={{");
    expect(source).not.toContain("primary: canClaim");
    expect(source).not.toContain("secondaryActions");
    expect(source).not.toContain("drawer={{ children: <p>{t(\"rulesTitle\")}</p> }}");
    expect(styles).toContain("@media (max-width: 560px) and (max-height: 700px)");
    expect(styles).toContain("height: calc(100dvh - 8px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".cclash-drawer__close:focus-visible");

    const scene = fs.readFileSync(path.join(appsRoot(), "color-clash/src/scenes/ColorClashScene.ts"), "utf8");
    expect(scene).toContain('action: "submitSolution"');
    expect(scene).toContain('action: "retryDeal"');
    expect(scene).toContain('action: "checkSettlement"');
    expect(scene).toContain('action: "expireGame"');
    expect(scene.indexOf("ctx.dealPending && ctx.timeUp")).toBeLessThan(
      scene.indexOf("if (ctx.dealPending)"),
    );
    expect(scene).toContain("this.dispatch(this.primaryAction)");
    expect(scene).toContain('this.dispatch("sequencePlaybackComplete")');
    expect(scene).toContain('this.currentRoundPhase === "input"');
    expect(scene).toContain("private pressLocked = false");
    expect(scene).toContain("private pressUnlockAt = 0");
    expect(scene).toContain("private expirationDispatched = false");
    expect(scene).toContain("this.scheduleGameplay");
    expect(scene).toContain("this.sfx.unlock()");
    expect(scene).toContain("CLASH_ASSETS.pads[index]!");
    expect(scene).toContain("PAD_CENTER_DEGREES = [225, 315, 135, 45]");
    expect(scene.indexOf("if (ctx.isLobby)")).toBeLessThan(
      scene.indexOf("if (ctx.completedSequence)"),
    );
    expect(scene).not.toContain("drawPadChip");

    const main = fs.readFileSync(path.join(appsRoot(), "color-clash/src/main.tsx"), "utf8");
    expect(main).toContain('app.actions.register("sequencePlaybackComplete"');
    expect(main).toContain("if (app.mode.isGuest()) { await guest.enter(); return; }");
    expect(main).toContain('roundPhase.get() !== "input"');
    expect(main).toContain("canReleaseExpiredGame");
    expect(main).toContain("Keep every verified press");
    expect(main).toContain("initialCueOf");
    expect(main).toContain("payoutFixed8 <= 0n");
    expect(main).toContain("manifest.supportsGameFi === false");
    expect(main).toContain('app.actions.register("setDifficulty"');
    expect(main).toContain('app.actions.register("checkSettlement"');
    expect(main).toContain('obs.lastStatus.set("settlement-pending")');
    expect(main).not.toContain("rewardGame.storage.save(gameId, previousOps)");
    expect(manifest).toContain("directPlay: true");
    expect(manifest).toContain("supportsGameFi: false");
    expect(manifest).toContain("walletRequired: false");
  });
});
