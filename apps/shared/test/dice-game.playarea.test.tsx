import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
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

import PlayArea from "../../dice-game/src/PlayArea";

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
    mode: "gamefi",
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Dice Game PlayArea compatibility", () => {
  it("routes legacy PlayArea imports to the Phaser table", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector("[data-testid='dice-game-phaser-host']")).toBeTruthy();
    expect(container.querySelector(".dice-scene")).toBeNull();
    expect(container.querySelector(".dice-scene__die-anchor")).toBeNull();
    expect(container.querySelector(".dice-bet-spot")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      className?: string;
      state: Record<string, unknown>;
    };
    expect(props.className).toBe("dice-phaser-canvas");
    expect(props.state.selectedFace).toBe("6");
    expect(props.state.mode).toBe("gamefi");
  });

  it("keeps the compatibility file free of the old DOM dice stage", () => {
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : resolve(process.cwd(), "apps/shared");
    const source = readFileSync(
      resolve(sharedRoot, "../dice-game/src/PlayArea.tsx"),
      "utf8",
    );

    expect(source.trim()).toBe('export { default } from "./PhaserPlayArea";');
    expect(source).not.toContain("throwPreview");
    expect(source).not.toContain("dice-scene__die-anchor");
    expect(source).not.toContain("diceFaceUrl");
  });
});
