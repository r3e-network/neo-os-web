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

vi.mock("@framework/phaser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@framework/phaser")>();
  return {
    ...actual,
    PhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="tarot-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../on-chain-tarot/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "Neo Tarot",
    appSubtitle: "Ask, draw, and reveal three cards.",
    awaitingDraw: "Awaiting draw",
    cardsDrawnCount: "Cards drawn",
    copyReading: "Copy reading",
    currentSpreadTitle: "Current spread",
    dealingCards: "Dealing the spread...",
    drawAgain: "Draw again",
    drawCards: "Draw 3 Cards",
    drawingCards: "Drawing cards...",
    drawValueHint: "Pay 0.1 GAS to draw.",
    drawerSummaryLabel: "Tarot reading summary",
    fairnessCopy: "The contract draws three distinct cards.",
    future: "Future",
    hiddenCard: "Sealed card",
    intentClarityLabel: "Clarity",
    intentDecisionLabel: "Decision",
    intentMomentumLabel: "Momentum",
    moreActions: "More actions",
    newReading: "New reading",
    notDrawnYet: "Not drawn yet",
    oraclePendingShort: "Waiting",
    oracleSealed: "Sealed",
    oracleVerifiedShort: "On-chain verified",
    past: "Past",
    prepaidCreditHint: "Unused GAS can be withdrawn or reused.",
    prepaidCreditLabel: "Prepaid credit",
    present: "Present",
    questionPresetClarity: "What needs clarity right now?",
    questionPresetDecision: "Which path should I choose?",
    questionPresetMomentum: "Where is momentum building?",
    quickIntentLabel: "Quick reading intents",
    readerWalletLabel: "Wallet",
    readerWalletMissing: "Not connected",
    readingCopied: "Reading copied",
    readingFlowTitle: "Reading flow",
    readingIntentCopy: "Choose a quick intent. The prompt stays local.",
    readingIntentTitle: "Reading intent",
    readingStateLabel: "Reading state",
    readings: "Readings",
    readingStepOneCopy: "Prompt stays local.",
    readingStepOneShort: "Ask",
    readingStepTwoCopy: "Wallet pays the fee.",
    readingStepTwoShort: "Pay",
    readingStepThreeCopy: "Tap each card to reveal.",
    readingStepThreeShort: "Reveal",
    refreshReadingState: "Refresh state",
    revealAllCards: "Reveal cards",
    revealed: "Revealed",
    sealedReadingHint: "Tap the card to reveal.",
    tapToReveal: "Tap to reveal",
    tarotContractRoute: "transfer -> draw()",
    tarotFee: "0.1 GAS",
    verificationPanelTitle: "Transaction safety",
    verificationPointFee: "0.1 GAS draw fee is shown in wallet.",
    verificationPointRandom: "Cards are picked on-chain.",
    verificationPointWallet: "Result is recorded in ReadingDrawn.",
    contractRouteLabel: "Contract route",
    withdrawCredit: "Withdraw credit",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{${paramKey}}`, String(paramValue));
    }
  }
  return value;
}

const cards = [
  {
    id: 0,
    name: "The Fool",
    image: "./cards/00-the-fool.webp",
    backImage: "./cards/back.webp",
    keywords: ["beginning", "risk"],
    arcana: "Major Arcana",
    suitLabel: "Major",
    flipped: false,
  },
  {
    id: 1,
    name: "The Magician",
    image: "./cards/01-the-magician.webp",
    backImage: "./cards/back.webp",
    keywords: ["will", "focus"],
    arcana: "Major Arcana",
    suitLabel: "Major",
    flipped: false,
  },
  {
    id: 2,
    name: "The High Priestess",
    image: "./cards/02-the-high-priestess.webp",
    backImage: "./cards/back.webp",
    keywords: ["intuition", "depth"],
    arcana: "Major Arcana",
    suitLabel: "Major",
    flipped: false,
  },
];

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    allFlipped: false,
    cardsDrawnCount: 0,
    drawn: [],
    hasDrawn: false,
    isLoading: false,
    prepaidCredit: 0,
    question: "",
    readingMode: "idle",
    readingsCount: 0,
    walletAddress: "",
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("on-chain-tarot Phaser playarea", () => {
  it("mounts the real Phaser tarot table with intent options and production labels", () => {
    const { queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("tarot-phaser-canvas");
    expect(props.ariaLabel).toBe("On-chain tarot reading table");
    expect(props.loadingLabel).toBe("Opening tarot table");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(520);
    expect(props.state.intentOptions).toHaveLength(3);
    expect(props.state.walletConnected).toBe(false);
    expect(queryByText("Draw 3 Cards")).toBeTruthy();
  });

  it("keeps draw, reveal, reset, copy, withdraw, and refresh wired without exposing a form UI", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          drawn: cards,
          hasDrawn: true,
          prepaidCredit: 0.25,
          walletAddress: "Nabc1234567890abcdef1234567890abcdef",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText("Reveal cards"));
    expect(dispatch).toHaveBeenCalledWith("flipCard", 0);
    expect(dispatch).toHaveBeenCalledWith("flipCard", 1);
    expect(dispatch).toHaveBeenCalledWith("flipCard", 2);

    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Draw again"));
    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Withdraw credit"));
    fireEvent.click(getByText("More actions"));
    fireEvent.click(getByText("Refresh state"));
    expect(dispatch).toHaveBeenCalledWith("reset");
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
    expect(dispatch).toHaveBeenCalledWith("refreshReadingState");

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          allFlipped: true,
          drawn: cards.map((card) => ({ ...card, flipped: true })),
          hasDrawn: true,
        })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(getByText("New reading"));
    fireEvent.click(getByText("Copy reading"));
    expect(dispatch).toHaveBeenCalledWith("copyReading");
    expect(container.querySelector("form,input,textarea,select")).toBeNull();
  });

  it("opens a production drawer with intents, current spread, safety, and credit recovery", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const revealed = [
      { ...cards[0], flipped: true },
      cards[1],
      cards[2],
    ];
    const { container, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          cardsDrawnCount: 24,
          drawn: revealed,
          hasDrawn: true,
          prepaidCredit: 0.25,
          question: "What needs clarity right now?",
          readingMode: "oracle",
          readingsCount: 8,
          walletAddress: "Nabc1234567890abcdef1234567890abcdef",
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".tarot-drawer__summary")).toBeNull();
    fireEvent.click(getByText("Reading intent"));

    expect(container.querySelector(".tarot-drawer__summary")?.textContent).toContain("8");
    expect(container.querySelector(".tarot-drawer__summary")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".tarot-drawer__intent-grid")?.textContent).toContain("Clarity");
    expect(container.querySelector(".tarot-spread-list")?.textContent).toContain("The Fool");
    expect(container.querySelector(".tarot-spread-list")?.textContent).toContain("Sealed card");
    expect(container.querySelector(".tarot-drawer__verify")?.textContent).toContain("Cards are picked on-chain");
    expect(container.querySelector(".tarot-drawer__credit")?.textContent).toContain("Withdraw credit");

    fireEvent.click(getByText("Which path should I choose?"));
    fireEvent.click(container.querySelector(".tarot-drawer__credit button") as Element);
    expect(dispatch).toHaveBeenCalledWith("setQuestion", "Which path should I choose?");
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("guards the Phaser shell against a flat form-style tarot UI", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "on-chain-tarot/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "on-chain-tarot/src/scenes/TarotScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "on-chain-tarot/src/PlayArea.scss"), "utf8");
    const main = readFileSync(resolve(root, "on-chain-tarot/src/main.tsx"), "utf8");

    expect(wrapper).toContain("tarot-drawer__summary");
    expect(wrapper).toContain("tarot-spread-list");
    expect(wrapper).toContain(`dispatch("withdrawCredit"`);
    expect(wrapper).toContain(`dispatch("refreshReadingState"`);
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain(`this.dispatch("draw")`);
    expect(scene).toContain(`this.dispatch("flipCard", index)`);
    expect(scene).toContain("playDealMotion");
    expect(styles).toContain(".tarot-play-area .mx2-drawer.mx2-drawer--open");
    expect(styles).toContain(".tarot-drawer__summary");
    expect(styles).toContain(".tarot-spread-list");
    expect(main).toContain(`actions.register("refreshReadingState"`);
    expect(main).toContain("walletAddress: tarot.address");
  });
});
