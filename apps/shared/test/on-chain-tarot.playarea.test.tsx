import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../on-chain-tarot/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    cardBackAlt: "Neo Tarot card back",
    cardsDrawnCount: "Cards drawn",
    contractRouteLabel: "Contract route",
    drawCards: "Draw 3 Cards",
    drawAgain: "Draw Again",
    drawingCards: "Drawing cards...",
    dealingCards: "Dealing the cards...",
    flipCard: "Flip",
    revealAllCards: "Reveal cards",
    revealed: "Revealed",
    reset: "Reset",
    copyReading: "Copy reading",
    readingCopied: "Copied",
    future: "Future",
    past: "Past",
    present: "Present",
    neoTarot: "Neo Tarot",
    no: "No",
    yes: "Yes",
    awaitingDraw: "Awaiting draw",
    oracleSealed: "Sealed",
    notDrawnYet: "Not drawn yet",
    tapToReveal: "Tap to reveal",
    oracleVerifiedShort: "Reading verified",
    oraclePendingShort: "Waiting",
    readingStateLabel: "Reading ready",
    readingIntentTitle: "Reading intent",
    readingFlowTitle: "Reading flow",
    readingStepOneShort: "Ask",
    readingStepOneCopy: "Ask.",
    readingStepTwoShort: "Pay",
    readingStepTwoCopy: "Pay.",
    readingStepThreeShort: "Reveal",
    readingStepThreeCopy: "Reveal.",
    revealProgress: "{count}/{total} revealed",
    questionLabel: "Your question",
    questionPlaceholder: "Ask one focused question.",
    questionPreviewLabel: "Focus",
    questionPreviewFallback: "Set the tone for this spread.",
    questionCharacterCount: "{count}/{max} characters",
    questionPresetClarity: "What needs clarity right now?",
    questionPresetDecision: "Which path should I choose?",
    questionPresetMomentum: "Where is momentum building?",
    intentClarityLabel: "Clarity",
    intentDecisionLabel: "Decision",
    intentMomentumLabel: "Momentum",
    quickIntentLabel: "Quick intents",
    tarotFee: "0.1 GAS",
    tarotHeroSubtitle: "Ask, pay, then reveal three cards.",
    tokenGas: "GAS",
    verificationPanelTitle: "Transaction safety",
    verificationPointFee: "Fee is shown before approval.",
    verificationPointRandom: "Cards are drawn on-chain.",
    verificationPointWallet: "Events are auditable.",
    tarotContractRoute: "transfer -> draw()",
    prepaidCreditLabel: "Prepaid credit",
    prepaidCreditHint: "Withdrawable.",
    withdrawCredit: "Withdraw",
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
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("On-Chain Tarot PlayArea (v2 scene-driven)", () => {
  it("wires the spread scene, intent drawer, and draw action", async () => {
    const appState = state();
    const dispatch = vi.fn(async (name: string, value?: unknown) => {
      if (name === "setQuestion") appState.question.set(value);
    });

    const { container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    // The dominant scene + 3 empty spread slots (past/present/future).
    expect(container.querySelector(".tarot-scene")).toBeTruthy();
    expect(container.querySelectorAll(".tarot-scene__slot").length).toBe(3);
    // The card-led table, deal paths, and deck visuals are present.
    expect(container.querySelector(".tarot-scene__cloth")).toBeTruthy();
    expect(container.querySelector(".tarot-scene__table")).toBeTruthy();
    expect(container.querySelector(".tarot-scene__deck-zone")).toBeTruthy();
    expect(container.querySelector(".tarot-scene__reading-zone")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".tarot-scene__table-art")?.getAttribute("src")).toContain("tarot-reading-table.webp");
    expect(container.querySelectorAll(".tarot-scene__deal-path").length).toBe(3);
    expect(container.querySelector(".tarot-scene__deck")).toBeTruthy();
    expect(container.querySelectorAll<HTMLImageElement>(".tarot-scene__deck-card").length).toBe(3);
    expect(container.querySelector(".tarot-scene__slip")).toBeTruthy();
    expect(container.querySelectorAll<HTMLImageElement>(".tarot-scene__slot-empty-card").length).toBe(3);
    expect(container.querySelector(".mx2-btn--primary svg")).toBeTruthy();
    expect(container.textContent).not.toContain("Reading ready");
    expect(container.textContent).not.toContain("Cards drawn");

    // Primary action is wired.
    fireEvent.click(screen.getByRole("button", { name: "Draw 3 Cards" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("draw"));
  });

  it("previews dealing motion immediately and locks repeat draws", async () => {
    let finishDraw: (() => void) | undefined;
    const drawPromise = new Promise<void>((resolve) => {
      finishDraw = resolve;
    });
    const dispatch = vi.fn((name: string) =>
      name === "draw" ? drawPromise : Promise.resolve(),
    );

    const { container } = render(
      <PlayArea
        t={t}
        state={state({ question: "What should I notice?" })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Draw 3 Cards" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("draw");
      // The scene flips to "dealing" and dealing cards fly out.
      expect(container.querySelector('.tarot-scene[data-state="dealing"]')).toBeTruthy();
      expect(container.querySelector(".tarot-scene__dealing")).toBeTruthy();
      expect(container.querySelectorAll(".tarot-scene__deal-card").length).toBe(3);
      expect(container.querySelectorAll<HTMLImageElement>(".tarot-scene__deal-card-image").length).toBe(3);
      // The primary button is busy.
      expect(container.querySelector(".mx2-btn--primary")?.getAttribute("aria-busy")).toBe("true");
    });

    // While dealing, the primary button shows its loading state; locate it by
    // its primary-action class and assert it is disabled (repeat draws locked).
    const busyButton = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);

    // A second click must NOT re-dispatch while dealing.
    fireEvent.click(busyButton);
    expect(dispatch).toHaveBeenCalledTimes(1);

    finishDraw?.();
  });

  it("marks sealed, revealed, and complete scene states", () => {
    const sampleCards = [
      { id: 0, name: "The Fool", image: "./cards/00-the-fool.webp", flipped: false, keywords: ["Oracle"] },
      { id: 1, name: "The Magician", image: "./cards/01-the-magician.webp", flipped: false, keywords: ["Oracle"] },
      { id: 2, name: "The High Priestess", image: "./cards/02-the-high-priestess.webp", flipped: false, keywords: ["Oracle"] },
    ];

    // Sealed (dealt, none flipped yet).
    const sealedView = render(
      <PlayArea
        t={t}
        state={state({ drawn: sampleCards, hasDrawn: true, question: "What is next?" })}
        dispatch={vi.fn()}
      />,
    );
    expect(sealedView.container.querySelector('.tarot-scene[data-state="dealt"]')).toBeTruthy();
    expect(sealedView.container.querySelectorAll(".tarot-scene__slot--sealed").length).toBe(3);
    sealedView.unmount();

    // Complete (all revealed).
    const revealedCards = sampleCards.map((c) => ({ ...c, flipped: true }));
    const completeView = render(
      <PlayArea
        t={t}
        state={state({
          allFlipped: true,
          drawn: revealedCards,
          hasDrawn: true,
          question: "What is next?",
          readingMode: "oracle",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(completeView.container.querySelector('.tarot-scene[data-state="complete"]')).toBeTruthy();
    expect(completeView.container.querySelectorAll(".tarot-scene__slot--revealed").length).toBe(3);
    expect(completeView.container.textContent).toContain("The Fool");
  });

  it("flips a sealed card on tap to reveal it", () => {
    const sampleCards = [
      { id: 0, name: "The Fool", image: "./cards/00-the-fool.webp", flipped: false, keywords: ["Oracle"] },
      { id: 1, name: "The Magician", image: "./cards/01-the-magician.webp", flipped: false, keywords: ["Oracle"] },
      { id: 2, name: "The High Priestess", image: "./cards/02-the-high-priestess.webp", flipped: false, keywords: ["Oracle"] },
    ];
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ drawn: sampleCards, hasDrawn: true })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelectorAll(".tarot-scene__slot")[1]);
    expect(dispatch).toHaveBeenCalledWith("flipCard", 1);
  });

  it("uses the primary action to reveal existing cards before resetting the spread", () => {
    const sampleCards = [
      { id: 0, name: "The Fool", image: "./cards/00-the-fool.webp", flipped: false, keywords: ["Oracle"] },
      { id: 1, name: "The Magician", image: "./cards/01-the-magician.webp", flipped: true, keywords: ["Oracle"] },
      { id: 2, name: "The High Priestess", image: "./cards/02-the-high-priestess.webp", flipped: false, keywords: ["Oracle"] },
    ];
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        t={t}
        state={state({ drawn: sampleCards, hasDrawn: true })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal cards" }));
    expect(dispatch).toHaveBeenCalledWith("flipCard", 0);
    expect(dispatch).toHaveBeenCalledWith("flipCard", 2);
    expect(dispatch).not.toHaveBeenCalledWith("draw");
  });

  it("tucks the question/intent/verification into a drawer", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    // Drawer is collapsed initially.
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    const toggle = container.querySelector(".mx2-action-rail__drawer-toggle") as Element;
    expect(toggle).toBeTruthy();

    // Opening reveals intent cards + the compact reading slip input.
    fireEvent.click(toggle);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelector(".tarot-drawer__intent-grid")).toBeTruthy();
    expect(container.querySelectorAll(".tarot-drawer__intent-card").length).toBe(3);
    expect(container.querySelector(".tarot-drawer__question-card")).toBeTruthy();
    expect(container.querySelector(".tarot-drawer__textarea")).toBeTruthy();
  });

  it("exposes prepaid credit withdrawal inside the drawer", () => {
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ prepaidCredit: 0.2 })} dispatch={dispatch} />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const creditPanel = container.querySelector(".tarot-drawer__credit");
    expect(creditPanel).toBeTruthy();
    fireEvent.click(creditPanel!.querySelector("button")!);
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("keeps tarot card motion and low-noise scene hierarchy backed by tests", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "on-chain-tarot/src/PlayArea.scss"),
      "utf8",
    );
    const source = fs.readFileSync(
      path.join(appsRoot, "on-chain-tarot/src/PlayArea.tsx"),
      "utf8",
    );
    const tokens = fs.readFileSync(
      path.join(appsRoot, "shared/styles/v2/_tokens.scss"),
      "utf8",
    );

    // The scene consumes the shared motion kit.
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    // Shared stage tokens and the tarot desk stay low-noise and linear.
    expect(tokens).not.toMatch(/radial-gradient/);
    expect(tokens).toMatch(/--mx2-scene-bg:\s*#ffffff/);
    expect(styles).not.toMatch(/radial-gradient/);
    expect(styles).not.toMatch(/\.tarot-scene__aura/);
    // The table stays clean while cards/text remain on high-contrast foreground pieces.
    expect(styles).toMatch(/\.tarot-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/\.tarot-play-area \.mx2-stage\s*\{[\s\S]*--mx2-scene-art-opacity:\s*0\.3/);
    expect(styles).toMatch(/tarot-scene__cloth\s*\{[\s\S]*background:\s*#fffaf3/);
    expect(styles).toMatch(/tarot-scene__cloth::after\s*\{[\s\S]*linear-gradient/);
    expect(styles).toMatch(/\.tarot-scene__table-art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.tarot-scene__table-art\s*\{[\s\S]*opacity:\s*var\(--mx2-scene-art-opacity\)/);
    expect(styles).toMatch(/\.tarot-scene__table\s*\{[\s\S]*grid-template-columns:\s*minmax\(144px,\s*0\.36fr\) minmax\(360px,\s*1fr\)/);
    expect(styles).toMatch(/\.tarot-scene__deck-zone\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\)/);
    expect(styles).toMatch(/\.tarot-scene__reading-zone\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.78\)/);
    expect(styles).toMatch(/\.tarot-scene__deck\s*\{[\s\S]*position:\s*relative/);
    expect(styles).toMatch(/\.tarot-scene\s*\{[\s\S]*--tarot-card-w:\s*124px/);
    expect(styles).toMatch(/\.tarot-scene\s*\{[\s\S]*--tarot-card-h:\s*214px/);
    expect(styles).toMatch(/\.tarot-scene__deck-card\s*\{[\s\S]*width:\s*78px/);
    expect(styles).toMatch(/\.tarot-scene__deck-card\s*\{[\s\S]*height:\s*135px/);
    expect(styles).toMatch(/\.tarot-scene__deck-card\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.tarot-scene__deal-card-image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.tarot-scene__slip\s*\{[\s\S]*box-shadow:\s*0 8px 18px/);
    expect(source).toContain("tarot-reading-table.webp");
    expect(styles).not.toMatch(/filter:\s*grayscale|blur\(0\.2px\)/);
    expect(styles).toMatch(/tarot-scene__spread::before[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.72\)/);
    expect(styles).toMatch(/\.tarot-scene__spread\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(var\(--tarot-card-w\),\s*150px\)\)/);
    expect(styles).toMatch(/\.tarot-scene__slot-frame\s*\{[\s\S]*width:\s*var\(--tarot-card-w\)/);
    expect(styles).toMatch(/\.tarot-scene__slot-empty\s*\{[\s\S]*width:\s*var\(--tarot-card-w\)/);
    expect(styles).toMatch(/\.tarot-scene__slot-empty\s*\{[\s\S]*height:\s*var\(--tarot-card-h\)/);
    expect(styles).toMatch(/\.tarot-scene__card-flip\s*\{[\s\S]*width:\s*var\(--tarot-card-w\)/);
    expect(styles).toMatch(/\.tarot-scene__card-flip\s*\{[\s\S]*height:\s*var\(--tarot-card-h\)/);
    expect(styles).toMatch(/\.tarot-scene__slot-empty-card\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.tarot-scene__slot-empty-card\s*\{[^}]*opacity:\s*1/);
    expect(styles).toMatch(/\.tarot-scene__slot-empty-card\s*\{[^}]*filter:\s*none/);
    expect(styles).toMatch(/\.tarot-scene__card-face img\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.tarot-scene__slot-index\s*\{[^}]*position:\s*absolute/);
    expect(styles).not.toMatch(/\.tarot-scene__slot-empty-card\s*\{[^}]*object-fit:\s*contain/);
    expect(styles).not.toMatch(/\.tarot-scene__card-face img\s*\{[^}]*object-fit:\s*contain/);
    expect(styles).not.toMatch(/\.tarot-scene__slot-empty-card\s*\{[^}]*opacity:\s*0\.52/);
    expect(styles).toMatch(/@keyframes tarot-path-light[\s\S]*opacity:\s*0\.18/);
    expect(styles).toMatch(/@keyframes tarot-deck-cut/);
    expect(styles).toMatch(/@keyframes tarot-slot-wait/);
    expect(styles).toMatch(/\.tarot-scene\[data-state="dealing"\] \.tarot-scene__deck\s*\{[\s\S]*animation:\s*tarot-deck-cut/);
    expect(styles).toMatch(/\.tarot-scene\[data-state="idle"\] \.tarot-scene__slot-empty\s*\{[\s\S]*animation:\s*tarot-slot-wait/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*--tarot-card-w:\s*78px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*--tarot-card-h:\s*135px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.tarot-scene__deck\s*\{[\s\S]*transform:\s*scale\(0\.5\)/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.tarot-scene\[data-state="dealing"\] \.tarot-scene__deck\s*\{[\s\S]*animation-name:\s*tarot-deck-cut-mobile/);
    expect(styles).toMatch(/@keyframes tarot-deck-cut-mobile[\s\S]*transform:\s*scale\(0\.5\)/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.tarot-scene__reading-zone\s*\{[\s\S]*min-height:\s*226px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.tarot-scene__deal-card--0\s*\{[\s\S]*--tarot-deal-x:\s*-54px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.tarot-scene__deal-card--2\s*\{[\s\S]*--tarot-deal-x:\s*54px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.tarot-scene__deal-card-image\s*\{[\s\S]*width:\s*68px/);
    expect(styles).not.toMatch(/@media \(max-width:\s*720px\)[\s\S]*--tarot-deal-x:\s*-72px/);
    expect(styles).not.toMatch(/@media \(max-width:\s*720px\)[\s\S]*--tarot-deal-x:\s*72px/);
    expect(styles).not.toMatch(/opacity:\s*0\.42/);
    expect(styles).toMatch(/\.tarot-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(styles).toMatch(/\.tarot-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*white-space:\s*nowrap/);
    expect(styles).not.toMatch(/\.tarot-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
    expect(styles).toMatch(/tarot-drawer__intent-card[\s\S]*min-height:\s*76px/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).not.toMatch(/\.tarot-scene__deck\s*\{[^}]*display:\s*none/);
    // Reduced-motion collapses the dealing/flip/float animations.
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.tarot-scene__slot-empty/);
  });
});
