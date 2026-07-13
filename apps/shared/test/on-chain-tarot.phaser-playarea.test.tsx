import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { messages as tarotMessages } from "../../on-chain-tarot/src/locale/messages";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => {
  return {
    LazyPhaserGameComponent: (props: unknown) => {
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
    cardUnavailable: "Card art unavailable · try a new reading",
    close: "Close",
    continue: "Continue",
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
    localeCode: "en",
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
    ritualActionConfirm: "Confirm intention · Draw 3 cards",
    ritualIntentPrompt: "What do you most want to understand right now?",
    ritualNetworkStatus: "Neo N3 online",
    ritualOpeningTable: "Opening the ritual table",
    ritualStepChooseIntent: "Step one · Choose an intention",
    ritualStepDraw: "Draw",
    ritualStepIntent: "Intention",
    ritualStepRead: "Reading",
    rulesTitle: "How to play",
    gameFiMaintenanceShort: "GameFi rewards under maintenance",
    guestRitualStatus: "Local · no wallet",
    enableGameSound: "Enable game sound",
    gameActionFailed: "The reading could not continue",
    muteGameSound: "Mute game sound",
    quickIntentLabel: "Quick reading intents",
    readerWalletLabel: "Wallet",
    readerWalletMissing: "Not connected",
    retry: "Retry",
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
    tarotStageAlt: "Three Neo tarot cards arranged on a bright reading table.",
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

function zhT(key: string, params?: Record<string, string | number>) {
  const entry = (
    tarotMessages as unknown as Record<
      string,
      string | { en: string; zh?: string }
    >
  )[key];
  let value = typeof entry === "string" ? entry : entry?.zh ?? entry?.en ?? key;
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
    assetRecoveryCount: 0,
    assetRetryNonce: 0,
    cardsDrawnCount: 0,
    drawn: [],
    hasDrawn: false,
    intentId: "decision",
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
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getAllByRole, getByRole, queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    expect(container.querySelector(".tarot-stage-shell")).toBeTruthy();
    expect(container.querySelector(".tarot-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail__drawer-toggle")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      continueLabel?: string;
      config?: { width?: number; height?: number };
      enableSoundLabel?: string;
      errorLabel?: string;
      loadingLabel?: string;
      muteSoundLabel?: string;
      retryLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("tarot-phaser-canvas");
    expect(props.ariaLabel).toBe("Three Neo tarot cards arranged on a bright reading table.");
    expect(props.loadingLabel).toBe("Opening the ritual table");
    expect(props.errorLabel).toBe("The reading could not continue");
    expect(props.retryLabel).toBe("Retry");
    expect(props.continueLabel).toBe("Continue");
    expect(props.enableSoundLabel).toBe("Enable game sound");
    expect(props.muteSoundLabel).toBe("Mute game sound");
    expect(props.config?.width).toBe(390);
    expect(props.config?.height).toBe(780);
    expect(props.state.intentOptions).toHaveLength(3);
    expect(props.state.walletConnected).toBe(false);
    expect(props.state.sceneText).toMatchObject({
      actionConfirm: "Confirm intention · Draw 3 cards",
      actionReveal: "Reveal cards",
      actionNew: "New reading",
    });
    expect(getAllByRole("radio")).toHaveLength(3);
    fireEvent.click(getByRole("button", { name: "Confirm intention · Draw 3 cards" }));
    expect(dispatch).toHaveBeenCalledWith("draw");
    expect(queryByText("Draw 3 Cards")).toBeNull();
  });

  it("uses roving radio focus and arrow keys to select reading intents", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByRole } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    const radios = getAllByRole("radio") as HTMLButtonElement[];

    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);

    dispatch.mockClear();
    radios[1]!.focus();
    fireEvent.keyDown(radios[1]!, { key: "ArrowRight" });
    expect(dispatch).toHaveBeenNthCalledWith(1, "setIntent", "momentum");
    expect(document.activeElement).toBe(radios[2]);

    fireEvent.keyDown(radios[2]!, { key: "ArrowDown" });
    expect(dispatch).toHaveBeenNthCalledWith(2, "setIntent", "clarity");
    expect(document.activeElement).toBe(radios[0]);

    fireEvent.keyDown(radios[0]!, { key: "ArrowLeft" });
    expect(dispatch).toHaveBeenNthCalledWith(3, "setIntent", "momentum");
    expect(document.activeElement).toBe(radios[2]);

    fireEvent.keyDown(radios[2]!, { key: "ArrowUp" });
    expect(dispatch).toHaveBeenNthCalledWith(4, "setIntent", "decision");
    expect(document.activeElement).toBe(radios[1]);
  });

  it("restores focus to the help trigger after Close and Escape", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    const trigger = getByRole("button", { name: "How to play" });

    fireEvent.click(trigger);
    const close = getByRole("button", { name: "Close" });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    getByRole("button", { name: "Close" }).focus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  it("mirrors critical artwork recovery into an accessible retry path", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={state({ assetRecoveryCount: 2 })}
        dispatch={dispatch}
      />,
    );

    expect(getByRole("alert").textContent).toContain("assetErrorTitle");
    expect(
      (getByRole("button", {
        name: "Confirm intention · Draw 3 cards",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(getByRole("button", { name: "assetRetry" }));
    expect(dispatch).toHaveBeenCalledWith("retryTarotAssets");
  });

  it("keeps primary reading actions canvas-owned and support actions inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole, getByText, queryByText, rerender } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          drawn: cards,
          hasDrawn: true,
          mode: "gamefi",
          prepaidCredit: 0.25,
          walletAddress: "Nabc1234567890abcdef1234567890abcdef",
        })}
        dispatch={dispatch}
      />,
    );

    expect(getByRole("button", { name: "Reveal cards" })).toBeTruthy();
    expect(queryByText("Draw 3 Cards")).toBeNull();
    expect(queryByText("More actions")).toBeNull();

    fireEvent.click(getByRole("button", { name: "Reveal cards" }));
    expect(dispatch).toHaveBeenCalledWith("flipTarotReading");

    fireEvent.click(getByText("How to play"));
    expect(container.querySelector(".tarot-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    fireEvent.click(getByText("Draw again"));
    fireEvent.click(getByText("Withdraw credit"));
    fireEvent.click(getByText("Refresh state"));
    expect(dispatch).toHaveBeenCalledWith("reset");
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
    expect(dispatch).toHaveBeenCalledWith("refreshReadingState");
    expect(dispatch).not.toHaveBeenCalledWith("draw");
    expect(dispatch).not.toHaveBeenCalledWith("flipCard", 0);

    rerender(
      <PhaserPlayArea
        t={t}
        state={state({
          allFlipped: true,
          drawn: cards.map((card) => ({ ...card, flipped: true })),
          hasDrawn: true,
          mode: "gamefi",
        })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(container.querySelector(".tarot-a11y-primary") as HTMLButtonElement);
    fireEvent.click(getByText("Copy reading"));
    expect(dispatch).toHaveBeenCalledWith("reset");
    expect(dispatch).toHaveBeenCalledWith("copyReading");
    fireEvent.click(getByRole("button", { name: "Close" }));
    expect(container.querySelector(".tarot-ingame-drawer")).toBeNull();
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
          intentId: "clarity",
          mode: "gamefi",
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
    fireEvent.click(getByText("How to play"));

    expect(container.querySelector(".tarot-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".tarot-drawer__summary")?.textContent).toContain("8");
    expect(container.querySelector(".tarot-drawer__summary")?.textContent).toContain("0.25 GAS");
    expect(container.querySelector(".tarot-drawer__intent-grid")?.textContent).toContain("Clarity");
    const intentButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".tarot-drawer__intent-card"),
    );
    expect(intentButtons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(intentButtons.every((button) => button.disabled)).toBe(true);
    expect(container.querySelector(".tarot-spread-list")?.textContent).toContain("The Fool");
    expect(container.querySelector(".tarot-spread-list")?.textContent).toContain("Sealed card");
    expect(container.querySelector(".tarot-drawer__verify")?.textContent).toContain("Cards are picked on-chain");
    expect(container.querySelector(".tarot-drawer__actions")?.textContent).toContain("Draw again");
    expect(container.querySelector(".tarot-drawer__actions")?.textContent).toContain("Refresh state");
    expect(container.querySelector(".tarot-drawer__credit")?.textContent).toContain("Withdraw credit");

    fireEvent.click(container.querySelector(".tarot-drawer__credit button") as Element);
    expect(dispatch).not.toHaveBeenCalledWith("setIntent", "decision");
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("uses one Chinese card presentation across canvas, drawer, and ARIA", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const revealed = cards.map((card) => ({ ...card, flipped: true }));
    const { container, getByRole, getByText } = render(
      <PhaserPlayArea
        t={zhT}
        state={state({
          allFlipped: true,
          drawn: revealed,
          hasDrawn: true,
          mode: "guest",
          readingMode: "local",
        })}
        dispatch={dispatch}
      />,
    );

    const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      state: {
        localeCode?: string;
        drawn?: Array<{
          id: number;
          name: string;
          image: string;
          keywords?: string[];
        }>;
      };
    };
    expect(props.state.localeCode).toBe("zh");
    expect(props.state.drawn?.map((card) => card.name)).toEqual([
      "愚者",
      "魔术师",
      "女祭司",
    ]);
    expect(props.state.drawn?.[0]).toMatchObject({
      id: 0,
      image: "./cards/00-the-fool.webp",
      keywords: ["启示", "大阿卡纳"],
    });

    expect(getByRole("button", { name: "过去: 愚者" })).toBeTruthy();
    expect(getByRole("button", { name: "现在: 魔术师" })).toBeTruthy();
    expect(getByRole("button", { name: "未来: 女祭司" })).toBeTruthy();

    fireEvent.click(getByText("怎么玩"));
    const spread = container.querySelector(".tarot-spread-list")?.textContent ?? "";
    expect(spread).toContain("愚者");
    expect(spread).toContain("魔术师");
    expect(spread).toContain("女祭司");
    // The redesign added a per-card upright interpretation (the "解答" layer in
    // tarot-data.ts). The drawer spread now shows each flipped card's localized
    // `reading` (PhaserPlayArea renders `card.reading ?? cardKeywords(card)`),
    // so the bare "启示 / 大阿卡纳" keyword tag is now only the fallback for
    // cards without a meaning. The card's keyword data is still "启示"/"大阿卡纳"
    // (asserted above at drawn[0].keywords); here we assert the drawer renders
    // the localized zh reading for The Fool rather than the old keyword tag.
    expect(spread).toContain("愚者邀你放下计划");
    expect(spread).not.toContain("The Fool");
  });

  it("guards the Phaser shell against a flat form-style tarot UI", () => {
    const root = resolve(__dirname, "../..");
    const wrapper = readFileSync(resolve(root, "on-chain-tarot/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(root, "on-chain-tarot/src/scenes/TarotScene.ts"), "utf8");
    const styles = readFileSync(resolve(root, "on-chain-tarot/src/PlayArea.scss"), "utf8");
    const main = readFileSync(resolve(root, "on-chain-tarot/src/main.tsx"), "utf8");
    const manifest = readFileSync(resolve(root, "on-chain-tarot/src/manifest.ts"), "utf8");

    expect(wrapper).toContain("tarot-drawer__summary");
    expect(wrapper).toContain("tarot-spread-list");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("tarot-drawer__actions");
    expect(wrapper).toContain("tarot-stage-shell");
    expect(wrapper).toContain("tarot-stage-hud");
    expect(wrapper).toContain("tarot-ingame-drawer");
    expect(wrapper).toContain(`runAction("withdrawCredit"`);
    expect(wrapper).toContain(`runAction("refreshReadingState"`);
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("primary,");
    expect(wrapper).not.toContain("secondary,");
    expect(wrapper).toContain("tarot-a11y-layer");
    expect(wrapper).toContain('role="radiogroup"');
    expect(wrapper).toContain(`runAction("draw"`);
    expect(wrapper).toContain(`runAction("flipCard"`);
    expect(wrapper).toContain(`runAction("flipTarotReading"`);
    expect(wrapper).toContain("MiniAppRoot already displayed the action failure");
    expect(wrapper).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(scene).toContain(`this.dispatch("draw")`);
    expect(scene).toContain(`this.dispatch("flipCard", index)`);
    expect(scene).toContain(`this.dispatch("flipTarotReading")`);
    expect(scene).toContain(`this.dispatch("reset")`);
    expect(scene).toContain("playDealMotion");
    expect(styles).toContain(".tarot-stage-shell");
    expect(styles).toContain(".tarot-stage-hud");
    expect(styles).toContain(".tarot-ingame-drawer");
    expect(styles).toContain(".tarot-drawer__summary");
    expect(styles).toContain(".tarot-drawer__actions");
    expect(styles).toContain(".tarot-spread-list");
    expect(styles).toContain("min-width: 44px;");
    expect(styles).toContain("min-height: 44px;");
    expect(styles).toContain(".tarot-drawer__close:focus-visible");
    expect(styles).toContain("outline: 3px solid #0b6257;");
    expect(styles).toContain("@media (max-height: 900px)");
    expect(styles).not.toContain(".tarot-play-area .mx2-drawer.mx2-drawer--open");
    expect(main).toContain(`actions.register("refreshReadingState"`);
    expect(main).toContain(`actions.register("setAssetRecoveryState"`);
    expect(main).toContain(`actions.register("retryTarotAssets"`);
    expect(main).toContain("manifest.supportsGameFi === false");
    expect(main).toContain("walletAddress: tarot.address");
    expect(manifest).toContain("supportsGameFi: false");
    expect(manifest).toContain("walletRequired: false");
    expect(manifest).toContain("payments: false");
  });
});
