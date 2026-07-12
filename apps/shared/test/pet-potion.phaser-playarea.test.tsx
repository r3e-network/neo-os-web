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
    LazyPhaserGameComponent: (props: { onReady?: () => void }) => {
      mocks.phaserGame(props);
      const { onReady } = props;
      React.useEffect(() => { onReady?.(); }, [onReady]);
      return <div data-testid="pet-potion-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../pet-potion/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    actionFeed: "Feed",
    actionPet: "Pet",
    actionPlay: "Play",
    actionRest: "Rest",
    actionTrailTitle: "Care actions",
    activeRouteLine: "{actions}/{max} actions · {time}",
    activeRunTitle: "Active care run",
    appEyebrow: "Pet Potion",
    appSubtitle: "Raise a sealed pet and claim GAS when happiness reaches target.",
    commitmentLine: "Game #{gameId} · sealed commitment {commitment}",
    creditLabel: "Credit",
    difficulty_easy: "Sprout Hatch",
    difficulty_medium: "Glow Garden",
    difficulty_hard: "Royal Bloom",
    difficultyTitle: "Nursery path",
    a11yCareAction: "{action}, {count} essence",
    a11yDifficultyDetail: "Target happiness {happiness}",
    a11yDifficultyGroup: "Choose nursery path",
    a11yLiveStatus: "Happiness {happiness} of {target}. {actions} actions. Recipe {recipe}.",
    brewPotionAction: "Brew potion",
    closeDrawer: "Close nursery drawer",
    continue: "Continue",
    drawerSummaryLabel: "Pet Potion player summary",
    drawerTitle: "Leaderboard & rules",
    expiredBanner: "Game expired",
    fairnessCopy: "The enclave validates every care action.",
    fairnessTitle: "Provably fair nurturing",
    guestBestLabel: "Best happiness",
    guestLeaderboardIntro: "Guest progress is stored on this device.",
    guestModeLine: "Free local nursery run",
    guestRunLabel: "Mode",
    guestRunValue: "Guest",
    happinessCurrent: "Happiness {happiness}",
    historyEmpty: "No care sessions yet.",
    historyTitle: "My solves",
    lastResultLine: "Last settlement: {payout} · {time}",
    leaderboardEmpty: "No solves yet.",
    leaderboardIntro: "Leaderboard is rebuilt from solved events.",
    leaderboardTitle: "Global leaderboard",
    lobbyTitle: "Open the nursery",
    networkBadge: "Neo N3",
    paidRunsUnavailableShort: "Paid care unavailable",
    poolLabel: "Reward pool",
    playingTitle: "{difficulty} pet in care",
    rankLabel: "Global rank",
    refreshRanks: "Refresh ranking",
    recipeComplete: "Complete",
    recipeIncomplete: "Incomplete",
    recipeShelfTitle: "Potion recipe",
    retry: "Retry",
    rulesCopy: "Pick a path, care for the pet, and claim before the deadline.",
    sceneAriaLabel: "Pet Potion nursery game",
    sceneLoadingLabel: "Opening pet nursery",
    sceneErrorLabel: "The nursery could not open.",
    sceneConnectWallet: "Connect wallet",
    sceneRetrySealing: "Retry sealing",
    scoreHappiness: "Happiness",
    scoreReward: "Reward",
    scoreTime: "Time left",
    scoreWon: "Total won",
    startAction: "Begin care",
    solvesCount: "{count} solves",
    statusDealPending: "Sealing is taking longer than usual.",
    statusShuffling: "Sealing pet",
    statusSubmitting: "Settling care",
    statusWonTitle: "Pet happy!",
    enableGameSound: "Enable game sound",
    muteGameSound: "Mute game sound",
    targetReachedHint: "Target reached.",
    withdrawAction: "Withdraw {amount} GAS",
    withdrawHint: "Pull credit back to your wallet.",
    withdrawTitle: "Withdraw winnings",
    youTag: "you",
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
    actionHistory: [],
    actionsUsed: 0,
    commitment: "",
    credit: 0,
    deadline: 0,
    dealtAt: 0,
    gameDifficulty: 0,
    gameStatus: "idle",
    happinessAchieved: 0,
    isDealing: false,
    isStarting: false,
    isSubmitting: false,
    lastElapsedMs: 0,
    lastPayoutFixed8: 0n,
    lastStatus: "",
    leaderboard: [],
    myHistory: [],
    myRank: 0,
    mySolves: 0,
    myTotalWon: 0,
    petEnergy: 50,
    petHappiness: 50,
    petHunger: 50,
    petStage: 0,
    poolFree: 25,
    appMode: "gamefi",
    ingredientCounts: { feed: 0, play: 0, pet: 0, rest: 0 },
    inputSyncFailed: false,
    isActing: false,
    isConnectingWallet: false,
    isRecovering: false,
    newPaidRunsEnabled: false,
    potionBrewed: false,
    releaseAt: 0,
    walletConnected: true,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("pet-potion Phaser playarea", () => {
  it("mounts the production pet nursery in Phaser without an outer start form", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state({ gameDifficulty: 2, poolFree: 12 })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".pp-playstage")).toBeTruthy();
    expect(container.querySelector(".pp-stage-shell")).toBeTruthy();
    expect(container.querySelector(".pp-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail__drawer-toggle")).toBeNull();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalled();

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("pp-phaser-canvas");
    expect(props.ariaLabel).toBe("Pet Potion nursery game");
    expect(props.loadingLabel).toBe("Opening pet nursery");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(580);
    expect(props.state.gameDifficulty).toBe(2);
    expect(props.state.poolFree).toBe(12);
    expect(props.state.petHappiness).toBe(50);
    expect(queryByText("Begin care")).toBeNull();
    expect(container.querySelector("form,input,textarea,select")).toBeNull();
  });

  it("passes active pet state into the canvas while the Phaser scene owns care and claim", () => {
    const { queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "31",
          actionHistory: ["feed", "play", "pet"],
          actionsUsed: 11,
          credit: 1.25,
          deadline: Date.now() + 120_000,
          dealtAt: Date.now() - 30_000,
          gameDifficulty: 1,
          gameStatus: "dealt",
          happinessAchieved: 72,
          petEnergy: 64,
          petHappiness: 72,
          petHunger: 35,
          petStage: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.activeGameId).toBe("31");
    expect(props.state.gameStatus).toBe("dealt");
    expect(props.state.happinessAchieved).toBe(72);
    expect(props.state.actionsUsed).toBe(11);
    expect(props.state.petStage).toBe(2);
    expect(props.state.credit).toBe(1.25);
    expect(queryByText("Refresh ranking")).toBeNull();
    expect(queryByText("Withdraw 1.25 GAS")).toBeNull();
    expect(queryByText("Claim reward")).toBeNull();
  });

  it("exposes the illustrated guest route, care tools, and brew loop to keyboard users", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByRole, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "guest", walletConnected: false })}
        dispatch={dispatch}
      />,
    );

    expect(getByRole("radiogroup", { name: "Choose nursery path" })).toBeTruthy();
    const routes = getAllByRole("radio");
    expect(routes).toHaveLength(3);
    fireEvent.click(routes[2] as Element);
    expect(dispatch).toHaveBeenCalledWith("selectDifficulty", { difficulty: 2 });
    fireEvent.click(getByRole("button", { name: "Begin care" }));
    expect(dispatch).toHaveBeenCalledWith("startGame", 0);

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          deadline: Date.now() + 60_000,
          petHappiness: 50,
          happinessAchieved: 50,
          ingredientCounts: { feed: 1, play: 1, pet: 1, rest: 0 },
        })}
        dispatch={dispatch}
      />,
    );
    expect(getByRole("button", { name: "Rest, 0 essence" })).toBeTruthy();
    expect(getByRole("button", { name: "Brew potion" }).hasAttribute("disabled")).toBe(true);

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          gameStatus: "dealt",
          deadline: Date.now() + 60_000,
          petHappiness: 50,
          happinessAchieved: 50,
          ingredientCounts: { feed: 1, play: 1, pet: 1, rest: 1 },
        })}
        dispatch={dispatch}
      />,
    );
    const brew = getByRole("button", { name: "Brew potion" });
    expect(brew.hasAttribute("disabled")).toBe(false);
    fireEvent.click(brew);
    expect(dispatch).toHaveBeenCalledWith("brewPotion");
  });

  it("localizes runtime recovery controls and closes the drawer with Escape", () => {
    const { container, getByText } = render(
      <PhaserPlayArea t={t} state={state({ appMode: "guest" })} dispatch={vi.fn()} />,
    );
    const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      errorLabel?: string;
      retryLabel?: string;
      enableSoundLabel?: string;
      muteSoundLabel?: string;
    };
    expect(props.errorLabel).toBe("The nursery could not open.");
    expect(props.retryLabel).toBe("Retry");
    expect(props.enableSoundLabel).toBe("Enable game sound");
    expect(props.muteSoundLabel).toBe("Mute game sound");

    fireEvent.click(getByText("Leaderboard & rules"));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    const close = container.querySelector(".pp-ingame-drawer__close") as HTMLButtonElement;
    close.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(getByText("Refresh ranking").closest("button"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("requires an explicit wallet reconnect gesture before historical recovery", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "91",
          appMode: "gamefi",
          deadline: Date.now() + 60_000,
          gameStatus: "dealt",
          inputSyncFailed: true,
          walletConnected: false,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Connect wallet" }));
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
    expect(dispatch).not.toHaveBeenCalledWith("recoverGame");
  });

  it("keeps sealing recovery inside Phaser while withdraw and ranking refresh stay in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "42",
          credit: 0.5,
          gameStatus: "committed",
          lastStatus: "deal-pending",
        })}
        dispatch={dispatch}
      />,
    );

    expect(queryByText("More actions")).toBeNull();
    expect(queryByText("Retry")).toBeNull();
    expect(queryByText("Release game")).toBeNull();
    expect(queryByText("Withdraw 0.50 GAS")).toBeNull();

    fireEvent.click(getByText("Leaderboard & rules"));
    expect(container.querySelector(".pp-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    fireEvent.click(getByText("Withdraw winnings"));
    fireEvent.click(getByText("Refresh ranking"));

    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
    expect(dispatch).not.toHaveBeenCalledWith("retryDeal");
    expect(dispatch).not.toHaveBeenCalledWith("expireGame");
  });

  it("opens a production drawer with run state, ranking, history, fairness, and credit recovery", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activeGameId: "77",
          actionHistory: ["feed", "play", "rest", "pet"],
          commitment: "ab".repeat(32),
          credit: 0.25,
          gameDifficulty: 2,
          happinessAchieved: 96,
          leaderboard: [
            { address: "Ntop1111111111111111111111111111111", rank: 1, totalWon: 2.5, solves: 5, isUser: false },
            { address: "Nme22222222222222222222222222222222", rank: 2, totalWon: 1.25, solves: 3, isUser: true },
          ],
          myHistory: [
            { gameId: "77", difficulty: 2, payout: "1.00 GAS", solveMs: 45_000, undos: 0, happinessAchieved: 96 },
          ],
          myRank: 2,
          mySolves: 3,
          myTotalWon: 1.25,
          poolFree: 8,
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".pp-drawer__summary")).toBeNull();
    fireEvent.click(getByText("Leaderboard & rules"));
    expect(container.querySelector(".pp-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();

    expect(container.querySelector(".pp-drawer__summary")?.textContent).toContain("#2");
    expect(container.querySelector(".pp-drawer__summary")?.textContent).toContain("1.25 GAS");
    expect(container.querySelector(".pp-drawer__credit")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".pp-run-card")?.textContent).toContain("Royal Bloom");
    expect(container.querySelector(".pp-action-trail")?.textContent).toContain("Feed");
    expect(container.querySelector(".pp-ranks")?.textContent).toContain("2.50 GAS");
    expect(container.querySelector(".pp-ranks")?.textContent).toContain("you");
    expect(container.querySelector(".pp-history")?.textContent).toContain("Happiness 96");
    expect(container.querySelector(".pp-history")?.textContent).toContain("1.00 GAS");
    expect(container.querySelector(".pp-drawer__fairness")?.textContent).toContain("Provably fair nurturing");
    expect(container.querySelector(".pp-drawer__seed")?.textContent).toContain("Game #77");

    fireEvent.click(container.querySelector(".pp-ranks__refresh") as Element);
    fireEvent.click(getByText("Withdraw winnings"));
    expect(dispatch).toHaveBeenCalledWith("refreshLeaderboard");
    expect(dispatch).toHaveBeenCalledWith("withdrawWinnings");
  });

  it("guards the Phaser shell against a flat form-style Pet Potion UI", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "pet-potion/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "pet-potion/src/scenes/PetPotionScene.ts"), "utf8");
    const main = readFileSync(resolve(root, "pet-potion/src/main.tsx"), "utf8");
    const rules = readFileSync(resolve(root, "pet-potion/src/logic/game-rules.ts"), "utf8");
    const styles = readFileSync(resolve(root, "pet-potion/src/PlayArea.scss"), "utf8");

    expect(wrapper).toContain("pp-drawer__summary");
    expect(wrapper).toContain("pp-drawer__fairness");
    expect(wrapper).toContain("pp-action-trail");
    expect(wrapper).toContain("pp-stage-shell");
    expect(wrapper).toContain("pp-stage-hud");
    expect(wrapper).toContain("pp-ingame-drawer");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain(`runAction("refreshLeaderboard"`);
    expect(wrapper).toContain(`runAction("withdrawWinnings"`);
    expect(wrapper).not.toContain(`dispatch("retryDeal"`);
    expect(wrapper).not.toContain(`dispatch("expireGame"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("secondary:");
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain(`this.dispatch("startGame", this.selectedDifficulty)`);
    expect(scene).toContain(`this.dispatch("recordAction", { type: action.key })`);
    expect(scene).toContain(`this.dispatch("submitSolution")`);
    expect(scene).toContain('this.dispatch(this.str("gameStatus", "idle") === "unknown" || this.bool("inputSyncFailed")');
    expect(scene).toContain('this.dispatch("connectWallet")');
    expect(scene).toContain(`this.dispatch("expireGame")`);
    expect(scene).toContain("private canRecoverRun()");
    expect(scene).toContain("private canReleaseAbandoned()");
    expect(scene).toContain("displayWidth: 62");
    expect(scene).not.toContain("this.actionCue.setAlpha(0).setScale");
    expect(scene).toContain("private isRunTimedOut");
    expect(scene).toContain("this.dispatch(\"connectWallet\")");
    expect(scene).toContain("this.updatePotion(activeMode.badge");
    expect(wrapper).toContain("sceneText");
    expect(wrapper).toContain("releaseAt");
    expect(main).toContain(`app.actions.register("connectWallet"`);
    expect(main).toContain("startResultMatchesIntent");
    expect(main).toContain(`obs.gameStatus.set("unknown")`);
    expect(main).toContain(`obs.lastStatus.set("settlement-pending")`);
    expect(main).toContain(`app.actions.register("recoverGame"`);
    expect(main).toContain("isActing.get()");
    expect(main).toContain("await app.chain.waitForState(");
    expect(main).toContain(`app.chain.readRaw("getGame", [app.chain.arg.integer(row.gameId)])`);
    expect(main).not.toContain(`settled.status === "unknown" ? "solved"`);
    expect(rules).toContain("SETTLEMENT_GRACE_MS = 600_000");
    expect(rules).toContain("nowMs > deadline + SETTLEMENT_GRACE_MS");
    expect(styles).toContain(".pp-stage-shell");
    expect(styles).toContain(".pp-stage-hud");
    expect(styles).toContain(".pp-ingame-drawer");
    expect(styles).toContain(".pp-drawer__summary");
    expect(styles).toContain(".pp-drawer__credit");
    expect(styles).toContain(".pp-drawer__seed");
    expect(styles).not.toContain(".pp-playarea .mx2-drawer.mx2-drawer--open");
  });
});
