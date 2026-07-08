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

vi.mock("@framework/phaser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@framework/phaser")>();
  return {
    ...actual,
    PhaserGameComponent: (props: unknown) => {
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
    chainLabel: "Neo N3",
    isSubmitting: false,
    isResolving: false,
    isUnresolved: false,
    maxStake: 20,
    maxPayableStake: 0,
    directCredit: 0,
    walletConnected: true,
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
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("dice-phaser-canvas");
    expect(props.ariaLabel).toBe("Dice Game table");
    expect(props.loadingLabel).toBe("Opening dice table");
    expect(props.config?.width).toBe(520);
    expect(props.config?.height).toBe(660);
    expect(props.state.selectedFace).toBe("4");
    expect(props.state.stakeAmount).toBe("1.00 GAS");
    expect(props.state.directCredit).toBe(1.25);
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
    expect(screen.queryByRole("button", { name: /reveal result/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Rules$/i }));
    expect(container.querySelector(".dice-ingame-drawer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reveal result/i }));
    expect(dispatch).toHaveBeenCalledWith("recheckSettlement", {});
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
        state={state({ directCredit: 1.25, chainLabel: "Neo N3" })}
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
        state={state({ directCredit: 1.25, chainLabel: "Neo X Mainnet" })}
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
    expect(wrapper).toContain("dice-stage-hud");
    expect(wrapper).toContain("dice-ingame-drawer");
    expect(wrapper).toContain("drawerActions");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("score={");
    expect(styles).toMatch(
      /\.dice-playarea \.mx2-stage\s*\{[\s\S]*min-height:\s*100dvh/,
    );
    expect(styles).toContain(".dice-stage-shell");
    expect(styles).toContain(".dice-stage-hud");
    expect(styles).toContain(".dice-ingame-drawer");
    expect(styles).toContain("--phaser-mobile-height-ratio: 2");
    expect(styles).toMatch(
      /@media \(max-width:\s*720px\)[\s\S]*\.dice-playarea \.mx2-playstage\.mx2-cat-game\s*\{[\s\S]*min-height:\s*100dvh/,
    );
    expect(styles).not.toContain(".dice-playarea .mx2-action-rail__row");
    expect(styles).not.toContain(".dice-playarea .mx2-score");
    expect(scene).toContain("private playSfx");
    expect(scene).toContain("this.sfx.");
    expect(scene).toContain("this.playSfx(\"select\")");
    expect(scene).toContain("this.playSfx(\"chip\")");
    expect(scene).toContain("this.playSfx(\"throw\")");
    expect(scene).toContain("this.playSfx(\"land\")");
    expect(scene).toContain("this.playSfx(\"win\")");
    expect(scene).not.toContain("ASSET_HERO_DIE");
    expect(scene).not.toContain("throwGhosts");
  });
});
