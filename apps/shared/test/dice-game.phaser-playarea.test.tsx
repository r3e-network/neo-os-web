import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
      return <div data-testid="dice-game-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../dice-game/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    rollTab: "Roll",
    rollDescription: "Choose one face and stake GAS.",
    readyTitle: "Choose a face and roll",
    throwingTitle: "Dice is rolling",
    statusReady: "Ready",
    statusWon: "You won",
    statusLost: "No win",
    statusSettlementPending: "Reveal pending",
    networkLabel: "Network",
    diceHistoryTitle: "Recent rolls",
    drawerTitleShort: "Rules",
    diceHistoryEmpty: "No local roll history yet.",
    selectedFace: "Face",
    faceMetric: "Face",
    stakeMetric: "Stake",
    payoutMetric: "Payout",
    checkAgain: "Reveal result",
    settlementPendingBody: "Retry settlement safely.",
    fairnessShort: "Commit first; reveal later.",
    rulesShort: "Pick a face, place a GAS chip, then roll.",
    withdrawCredit: "Withdraw",
    directCreditLabel: "Roll credit",
    howItWorks: "How it works",
    docHowItWorks: "Commit and reveal across blocks.",
    safetyModel: "Safety model",
    docSafetyModel: "The result is unknowable at commit.",
    diceVrfRouteTitle: "Settlement route",
    vrfTrustLine: "Native randomness reveals the roll.",
    diceRiskTitle: "House model",
    diceRiskCopy: "A match pays 5.70x.",
    maxStakeNote: "Max on this network",
    rangeLabel: "Stake range",
    feeLabel: "Platform fee",
    sceneThrowDice: "Throw dice",
    sceneRolling: "Rolling…",
    sceneConnectWallet: "Connect wallet",
    sceneRevealPending: "Reveal result",
    sceneLowerStake: "Lower stake",
    sceneHouseLimit: "House limit",
    sceneInsufficientGas: "Insufficient GAS",
    sceneTableTitle: "Lucky face table",
    sceneTableHint: "Pick a face, stack a chip, throw once.",
    scenePredictionRail: "Prediction rail",
    sceneChipRail: "Chip rail",
    sceneOnTable: "On table",
    sceneHitPays: "Hit pays",
    guestUnit: "chips",
    sceneYouWin: "You win",
    sceneHouseWins: "Missed",
    sceneRefunded: "Refunded",
    sceneRolled: "Rolled",
    sceneBetterLuck: "Try another throw",
    sceneStakeReturned: "Your stake has been returned",
    diceCanvasAria: "Interactive lucky dice table",
    diceCanvasLoading: "Opening the lucky dice table",
    gameActionFailed: "The dice table could not continue",
    retry: "Retry",
    continue: "Continue",
    enableGameSound: "Enable game sound",
    muteGameSound: "Mute game sound",
    accessibleDiceControls: "Accessible dice controls",
    closeRules: "Close rules and history",
    faceTrayHint: "Tap a die to set the roll target",
    stakePresets: "Stake presets",
    dieShowing: `Die showing ${params?.face ?? 6}`,
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
    selectedFace: "6",
    stakeAmount: "0.10 GAS",
    payoutPreview: "0.57 GAS",
    lastStatus: "Ready",
    lastOutcome: "",
    lastRoll: "",
    lastPayout: "",
    chainLabel: "Neo N3",
    isSubmitting: false,
    isResolving: false,
    isUnresolved: false,
    maxStake: 20,
    maxPayableStake: 0,
    directCredit: 0,
    walletConnected: true,
    walletGasBalance: 10,
    rollHistory: [],
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("dice-game Phaser playarea", () => {
  it("mounts the production Phaser dice table and passes the wager state into the bridge", () => {
    const { container, queryByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({ selectedFace: "4", stakeAmount: "1.00 GAS", directCredit: 1.25 })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".dice-playstage")).toBeTruthy();
    expect(container.querySelector(".dice-stage-shell")).toBeTruthy();
    expect(container.querySelector(".dice-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      errorLabel?: string;
      retryLabel?: string;
      continueLabel?: string;
      enableSoundLabel?: string;
      muteSoundLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("dice-phaser-canvas");
    expect(props.ariaLabel).toBe("Interactive lucky dice table");
    expect(props.loadingLabel).toBe("Opening the lucky dice table");
    expect(props.errorLabel).toBe("The dice table could not continue");
    expect(props.retryLabel).toBe("Retry");
    expect(props.continueLabel).toBe("Continue");
    expect(props.enableSoundLabel).toBe("Enable game sound");
    expect(props.muteSoundLabel).toBe("Mute game sound");
    expect(props.config?.width).toBe(520);
    expect(props.config?.height).toBe(660);
    expect(props.state.selectedFace).toBe("4");
    expect(props.state.stakeAmount).toBe("1.00 GAS");
    expect(props.state.directCredit).toBe(1.25);
    expect(props.state.walletConnected).toBe(true);
    expect(props.state.walletGasBalance).toBe(10);
    expect(props.state.isEvmChain).toBe(false);
    expect(props.state.lastPayout).toBe("");
    expect(props.state.sceneText).toEqual({
      throwDice: "Throw dice",
      rolling: "Rolling…",
      connectWallet: "Connect wallet",
      revealPending: "Reveal result",
      lowerStake: "Lower stake",
      houseLimit: "House limit",
      insufficientGas: "Insufficient GAS",
      tableTitle: "Lucky face table",
      tableHint: "Pick a face, stack a chip, throw once.",
      predictionRail: "Prediction rail",
      chipRail: "Chip rail",
      onTable: "On table",
      hitPays: "Hit pays",
      practiceChips: "chips",
      youWin: "You win",
      houseWins: "Missed",
      refunded: "Refunded",
      rolled: "Rolled",
      betterLuck: "Try another throw",
      stakeReturned: "Your stake has been returned",
    });
    expect(queryByRole("button", { name: /^Roll$/ })).toBeNull();
  });

  it("surfaces pending settlement recovery and real roll history inside the game drawer", () => {
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          isUnresolved: true,
          rollHistory: [{
            face: "4",
            stake: "0.50 GAS",
            result: "Won roll 4",
            payout: "2.85 GAS",
            outcome: "won",
            txid: "0x1234567890abcdef",
          }],
        })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText("Reveal pending")).toBeTruthy();
    const semanticReveal = screen.getByRole("button", { name: /reveal result/i });
    fireEvent.click(semanticReveal);
    expect(dispatch).toHaveBeenCalledWith("recheckSettlement", {});
    fireEvent.click(screen.getByRole("button", { name: /^Rules$/i }));
    expect(container.querySelector(".dice-ingame-drawer")).toBeTruthy();
    const revealButtons = screen.getAllByRole("button", { name: /reveal result/i });
    expect(revealButtons).toHaveLength(2);
    fireEvent.click(revealButtons[1]!);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Won roll 4")).toBeTruthy();
    expect(screen.getByText("How it works")).toBeTruthy();
    expect(screen.getByText("Stake range")).toBeTruthy();
    expect(container.querySelector(".mx2-history__tx")?.textContent).toMatch(/0x1234.*cdef/i);
  });

  it("keeps Neo N3 credit withdrawal visible but hides it for Neo X atomic rolls", () => {
    const n3Dispatch = vi.fn(async () => undefined);
    const { unmount } = render(
      <PhaserPlayArea
        t={t}
        state={state({ directCredit: 1.25, chainLabel: "Neo N3", mode: "gamefi" })}
        dispatch={n3Dispatch}
      />,
    );

    expect(screen.queryByRole("button", { name: /withdraw/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Rules$/i }));
    fireEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    expect(n3Dispatch).toHaveBeenCalledWith("withdrawCredit", {});

    unmount();
    render(
      <PhaserPlayArea
        t={t}
        state={state({ directCredit: 1.25, chainLabel: "Neo X Mainnet", mode: "gamefi" })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Rules$/i }));
    expect(screen.queryByRole("button", { name: /withdraw/i })).toBeNull();
  });

  it("keeps Phaser canvas, HUD, and secondary controls inside the full-height dice table", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const styles = readFileSync(
      resolve(sharedRoot, "../dice-game/src/PlayArea.scss"),
      "utf8",
    );
    const wrapper = readFileSync(
      resolve(sharedRoot, "../dice-game/src/PhaserPlayArea.tsx"),
      "utf8",
    );
    const scene = readFileSync(
      resolve(sharedRoot, "../dice-game/src/scenes/DiceScene.ts"),
      "utf8",
    );

    expect(wrapper).toContain("className=\"dice-playstage\"");
    expect(wrapper).toContain("className=\"dice-phaser-canvas\"");
    expect(wrapper).toContain("stage={{}}");
    expect(wrapper).toContain("dice-stage-status");
    expect(wrapper).toContain("dice-stage-hud");
    expect(wrapper).toContain("dice-ingame-drawer");
    expect(wrapper).toContain("dice-a11y-controls");
    expect(wrapper).toContain('role="radiogroup"');
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(styles).toMatch(
      /\.dice-playarea \.mx2-stage\s*\{[\s\S]*min-height:\s*100dvh/,
    );
    expect(styles).toContain(".dice-stage-shell");
    expect(styles).toContain(".dice-stage-status");
    expect(styles).toContain(".dice-stage-hud");
    expect(styles).toContain(".dice-ingame-drawer");
    expect(styles).toContain("height: min(820px, calc(100dvh - 16px))");
    expect(styles).toContain("height: calc(100dvh - 12px)");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2");
    expect(styles).toMatch(
      /@media \(max-width:\s*720px\)[\s\S]*\.dice-playarea \.mx2-playstage\.mx2-cat-game\s*\{[\s\S]*min-height:\s*100dvh/,
    );
    expect(styles).not.toContain("calc(100dvh - 66px)");
    expect(styles).not.toContain(".dice-playarea .mx2-action-rail__row");
    expect(styles).not.toContain(".dice-playarea .mx2-score");
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("this.sfx.");
    expect(scene).toContain("this.playSfx(\"select\")");
    expect(scene).toContain("this.playSfx(\"chip\")");
    expect(scene).toContain("this.playSfx(\"throw\")");
    expect(scene).toContain("this.playSfx(\"land\")");
    expect(scene).toContain("this.playSfx(\"win\")");
    expect(scene).toContain("freezePredictionRailForThrow()");
    expect(scene).toContain("restorePredictionRailAfterThrow()");
    expect(scene).toContain("if (this.reducedMotion)");
    expect(scene).toContain("protected onReducedMotionChange(enabled: boolean)");
    expect(scene).toContain('const isGuest = this.str("mode", "guest") === "guest"');
    expect(scene).toContain("this.tweens.killTweensOf(btn)");
    expect(scene).toContain("btn.setAlpha(0.42).setAngle(0).setScale(1)");
    expect(scene).toContain("die?.setAngle(0).setScale(1).setDisplaySize(34, 34)");
    expect(scene).toContain("targets: this.diceGroup");
    expect(scene).toContain("private canRoll()");
    expect(scene).toContain('this.bool("walletConnected")');
    expect(scene).toContain('this.num("maxPayableStake", 0)');
    expect(scene).toContain('this.num("walletGasBalance", 0)');
    expect(scene).toContain('this.num("directCredit", 0)');
    expect(scene).toContain('this.dispatch("connectWallet", {})');
    expect(scene).toContain('this.dispatch("recheckSettlement", {})');
    expect(scene).toContain('this.str(\n            "lastPayout"');
    expect(scene).toContain("const hit = this.add.rectangle(0, 0, 188, 54");
    expect(scene).toContain("enabled: () => this.canEditBet()");
    expect(scene).not.toContain("targets: this.faceButtons");
    expect(scene).not.toContain("ASSET_HERO_DIE");
    expect(scene).not.toContain("throwGhosts");
    expect(scene).not.toContain("heroDieY");
    expect(scene).not.toContain("ghostLeftY");
    expect(scene).not.toContain("ghostTopY");
  });
});
