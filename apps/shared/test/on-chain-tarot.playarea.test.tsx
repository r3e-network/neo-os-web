import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../on-chain-tarot/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    awaitingCards: "Awaiting draw",
    awaitingDraw: "Awaiting draw",
    cardBackAlt: "Neo Tarot card back",
    contractRouteLabel: "Contract route",
    dealTableLabel: "Reading table",
    dealTableReady: "Past, Present, Future ready",
    drawCards: "Draw 3 Cards",
    drawValueHint: "Pay 0.1 GAS to draw your spread.",
    drawingCards: "Drawing cards...",
    feeLabel: "Draw fee",
    future: "Future",
    hiddenCard: "Sealed card",
    intentionDeckLabel: "Intention deck",
    intentClarityLabel: "Clarity",
    intentDecisionLabel: "Decision",
    intentMomentumLabel: "Momentum",
    oraclePendingShort: "Waiting",
    oraclePromptLabel: "Question prompt",
    oracleRequestTitle: "Neo N3 reading",
    oracleSealed: "Sealed",
    past: "Past",
    present: "Present",
    questionCharacterCount: "{count}/{max} characters",
    questionPreviewFallback: "Place your question on the reading slip.",
    questionPreviewLabel: "Reading slip",
    questionPresetClarity: "What needs clarity right now?",
    questionPresetDecision: "Which path should I choose?",
    questionPresetMomentum: "Where is momentum building?",
    quickIntentLabel: "Quick reading intents",
    readingFlowTitle: "Reading flow",
    readingIntentCopy: "Choose a quick intent or write one focused question.",
    readingIntentTitle: "Reading intent",
    readingStepOneShort: "Ask",
    readingStepThreeShort: "Reveal",
    readingStepTwoShort: "Pay",
    requestReady: "Ready",
    spreadPanelTitle: "Three-card spread",
    submitQuestionFirst: "Ask first",
    tapToReveal: "Tap to reveal",
    tarotContractRoute: "transfer -> draw()",
    tarotFee: "0.1 GAS",
    tarotHeroSubtitle: "Ask, pay, then reveal three cards.",
    tarotHeroTitle: "On-Chain Tarot Reading Desk",
    tarotStageAlt: "Bright tarot reading table",
    tokenGas: "GAS",
    verificationPanelCopy: "Every draw is wallet reviewed.",
    verificationPanelTitle: "Transaction safety",
    verificationPointFee: "Fee is shown before approval.",
    verificationPointRandom: "Cards are drawn on-chain.",
    verificationPointWallet: "Events are auditable.",
  };

  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    allFlipped: false,
    drawn: [],
    hasDrawn: false,
    isLoading: false,
    prepaidCredit: 0,
    question: "",
    readingMode: "idle",
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("On-Chain Tarot PlayArea", () => {
  it("keeps the reading slip, table assets, and draw action wired", async () => {
    const appState = state();
    const dispatch = vi.fn(async (name: string, value?: unknown) => {
      if (name === "setQuestion") {
        appState.question.set(value);
      }
    });

    render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    expect(document.querySelector('.tarot-hero-stage img[src="./tarot-reading-table.jpg"]')).toBeTruthy();
    expect(document.querySelector('.tarot-spread-table__mat[src="./tarot-reading-table.jpg"]')).toBeTruthy();
    expect(document.querySelectorAll(".tarot-intention-deck__card").length).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Which path should I choose?" }));

    await waitFor(() =>
      expect((screen.getByLabelText("Question prompt") as HTMLTextAreaElement).value)
        .toBe("Which path should I choose?"),
    );
    expect(document.querySelector(".tarot-play-area--question-ready")).toBeTruthy();
    expect(document.querySelector(".tarot-spread-table--ready")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Question prompt"), {
      target: { value: "How should this launch unfold?" },
    });

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        "setQuestion",
        "How should this launch unfold?",
      ),
    );
    expect(screen.getAllByText("Awaiting draw").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Draw 3 Cards" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("draw"));
  });

  it("marks dealing, sealed, revealed, and complete card-table states", () => {
    const sampleCards = [
      {
        id: 0,
        name: "The Fool",
        image: "./cards/00-the-fool.svg",
        backImage: "./cards/back.svg",
        flipped: true,
        keywords: ["Oracle", "Major Arcana"],
      },
      {
        id: 1,
        name: "The Magician",
        image: "./cards/01-the-magician.svg",
        backImage: "./cards/back.svg",
        flipped: true,
        keywords: ["Oracle", "Major Arcana"],
      },
      {
        id: 2,
        name: "The High Priestess",
        image: "./cards/02-the-high-priestess.svg",
        backImage: "./cards/back.svg",
        flipped: true,
        keywords: ["Oracle", "Major Arcana"],
      },
    ];

    const dealingView = render(
      <PlayArea
        t={t}
        state={state({ isLoading: true, question: "What is next?" })}
        dispatch={vi.fn()}
      />,
    );

    expect(dealingView.container.querySelector(".tarot-play-area--dealing")).toBeTruthy();
    expect(dealingView.container.querySelector(".tarot-spread-table--dealing")).toBeTruthy();
    dealingView.unmount();

    const completeView = render(
      <PlayArea
        t={t}
        state={state({
          allFlipped: true,
          drawn: sampleCards,
          hasDrawn: true,
          question: "What is next?",
          readingMode: "oracle",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(completeView.container.querySelector(".tarot-play-area--complete")).toBeTruthy();
    expect(completeView.container.querySelector(".tarot-spread-table--complete")).toBeTruthy();
    expect(completeView.container.querySelectorAll(".tarot-card-slot--revealed").length).toBe(3);
  });

  it("keeps tarot card motion backed by reduced-motion fallbacks", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../on-chain-tarot/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain("@keyframes tarot-table-drift");
    expect(styles).toContain("@keyframes tarot-spread-ready");
    expect(styles).toContain("@keyframes tarot-card-back-glint");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
