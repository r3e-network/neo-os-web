import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../last-survivor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    buyKeys: "Insert Keys",
    buying: "Inserting...",
    estimatedCost: "Estimated cost",
    keyCapsules: "Key capsules",
    keyChamber: "Clock key chamber",
    keyLoadoutHint: "Loaded keys feed the pot and push the survival clock forward.",
    keyTuner: "Key load tuner",
    keysSuffix: "keys",
    keyPrice: "Key price",
    nextCost: `${params?.amount ?? "0.10"} GAS to load`,
    decreaseKeys: "Remove one key",
    increaseKeys: "Add one key",
    round: "Round",
    survivalArena: "Survival Arena",
    subtitle: "Last key wins the pot.",
    totalPot: "Total pot",
    totalKeys: "Total keys",
    yourKeys: "Your keys",
    share: "Your share",
    currentLeader: "Leader",
    roundStatusDisplay: "Live",
    countdown: "00:01:30",
    dangerLevelText: "Medium",
    safe: "Safe",
    awaitingFirstKey: "Awaiting first key",
    roundEnded: "Round ended",
    roundStateRequired: "Refresh round",
    settlingRound: "Settling...",
    settleRound: "Settle round",
    settleRoundHint: "Award the pot",
    youWon: "You won!",
    winnerDeclared: "Winner declared",
    recentHistory: "Recent history",
    noHistory: "No history yet",
    howItWorks: "How it works",
    ruleDepositDesc: "Buy keys with GAS.",
    ruleTimerDesc: "Each buy extends the timer.",
    ruleWinDesc: "Last buyer when time runs out wins the pot.",
    arenaMomentum: "Arena momentum",
    beatBuyKey: "Load key",
    beatExtendClock: "Extend clock",
    beatLastBuyer: "Win pot",
    prepaidCreditLabel: "Prepaid credit",
    prepaidCreditHint: "Withdrawable.",
    withdrawCredit: "Withdraw credit",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    formattedRound: "#1",
    roundStatusDisplay: "Live",
    countdown: "00:01:30",
    dangerLevel: "medium",
    dangerLevelText: "Medium",
    dangerProgress: 40,
    lastBuyer: "",
    lastBuyerLabel: "--",
    viewerAddress: "",
    totalPot: 5,
    totalPotDisplay: "5.00 GAS",
    userKeys: 0,
    totalKeysDisplay: 10,
    userSharePercent: 0,
    estimatedCost: "0.10",
    isRoundActive: true,
    shouldPulse: false,
    isBuyingKeys: false,
    isSettling: false,
    isLoading: false,
    roundDataAvailable: true,
    needsLifecycleSync: false,
    serviceNotice: "",
    prepaidCredit: 0,
    keyValidationError: null,
    history: [],
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([k, v]) => [k, createObservable(v)]),
  );
}

describe("Last Survivor PlayArea (v2 scene-driven)", () => {
  it("renders the survival vault with a foreground timer relic", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".survivor-scene")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".survivor-scene__arena-art")?.getAttribute("src")).toContain("last-survivor-arena.webp");
    expect(container.querySelector(".survivor-scene__shade")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".survivor-scene__relic-art")?.getAttribute("src")).toContain("survivor-scene-art.webp");
    expect(container.querySelector(".survivor-scene__timer")?.textContent).toContain("00:01:30");
    expect(container.querySelector(".survivor-scene__danger-track")).toBeTruthy();
    expect(container.querySelector(".survivor-scene__key-stack")).toBeTruthy();
    expect(container.querySelector(".survivor-scene__beats")).toBeTruthy();
    expect(container.textContent).toContain("Load key");
    expect(container.textContent).toContain("Extend clock");
    expect(container.textContent).toContain("Win pot");
    // The in-scene relic is the primary buy action.
    expect(container.querySelector(".mx2-btn--primary")).toBeTruthy();
  });

  it("renders a key chamber instead of a purchase form", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".survivor-controls__dock")).toBeTruthy();
    expect(container.querySelector(".survivor-controls__core")?.textContent).toContain("Clock key chamber");
    expect(container.querySelector(".survivor-controls__core")?.textContent).toContain("0.10 GAS to load");
    expect(container.querySelector(".survivor-controls__presets")?.getAttribute("aria-label")).toBe("Key capsules");
    expect(container.querySelector(".survivor-controls__stepper")?.getAttribute("aria-label")).toBe("Key load tuner");
    expect(container.querySelector(".survivor-stepper__track-fill")).toBeTruthy();
    expect(container.querySelector(".survivor-preset")?.getAttribute("aria-label")).toBe("1 keys");
    expect(container.querySelector("input, textarea, select, form")).toBeNull();
  });

  it("dispatches buyKeys from the tappable relic and shows motion only from authoritative busy state", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    // Select 3 keys.
    const preset3 = container.querySelectorAll(".survivor-preset")[1];
    fireEvent.click(preset3);

    // Fire the in-scene relic action, not only the rail button.
    fireEvent.click(container.querySelector(".survivor-scene__relic") as Element);

    expect(dispatch).toHaveBeenCalledWith("buyKeys", "3");
    expect(container.querySelector('.survivor-scene[data-state="buying"]')).toBeNull();

    rerender(<PlayArea t={t} state={state({ isBuyingKeys: true })} dispatch={dispatch} />);
    expect(container.querySelector('.survivor-scene[data-state="buying"]')).toBeTruthy();
    expect(container.querySelector(".survivor-scene__key-burst")).toBeTruthy();
    expect(container.querySelectorAll(".survivor-scene__key-token").length).toBe(3);
  });

  it("shows a settle affordance when the round needs settling", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ needsLifecycleSync: true, isRoundActive: false, seasonPhase: "ended" } as Record<string, unknown>)}
        dispatch={dispatch}
      />,
    );

    const settleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Settle round"),
    );
    expect(settleBtn).toBeTruthy();
    fireEvent.click(settleBtn!);
    expect(dispatch).toHaveBeenCalledWith("settleRound");
  });

  it("renders the leader readout when there is a last buyer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ lastBuyer: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa", lastBuyerLabel: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa" })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".survivor-scene__leader")).toBeTruthy();
    expect(container.textContent).toContain("Ndb1n4");
  });

  it("tucks history, how-it-works, and recovery into a drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ history: [{ round: 1, winner: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa", pot: "3.00 GAS" }] })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.textContent).toContain("3.00 GAS");
  });

  it("exposes prepaid-credit withdrawal as a secondary action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ prepaidCredit: 1.5 })} dispatch={dispatch} />,
    );

    const withdrawBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Withdraw credit"),
    );
    expect(withdrawBtn).toBeTruthy();
    fireEvent.click(withdrawBtn!);
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("keeps motion backed by reduced-motion fallbacks", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "last-survivor/src/PlayArea.scss"),
      "utf8",
    );
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.survivor-scene__beats span\[data-active="true"\]/);
  });

  it("keeps the game surface clean, resource-led, and away from form controls", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "last-survivor/src/PlayArea.scss"),
      "utf8",
    );
    const source = fs.readFileSync(
      path.join(appsRoot, "last-survivor/src/PlayArea.tsx"),
      "utf8",
    );

    // The arena is atmospheric, while the relic and key resources own the foreground.
    expect(styles).toMatch(/\.survivor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.survivor-play-area \.mx2-action-rail__drawer-toggle\s*\{[\s\S]*min-width:\s*176px/);
    expect(styles).toMatch(/\.survivor-scene__arena-art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.survivor-scene__arena-art\s*\{[\s\S]*opacity:\s*0\.78/);
    expect(styles).toMatch(/\.survivor-scene__shade\s*\{[\s\S]*linear-gradient/);
    expect(styles).not.toMatch(/var\(--mx2-scene-art-opacity|background-image:\s*url/);
    expect(styles).not.toMatch(/radial-gradient/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).toMatch(/\.survivor-scene\s*\{[\s\S]*background:\s*#f7fbf4/);
    expect(styles).toMatch(/\.survivor-scene__pot,[\s\S]*\.survivor-scene__notice \{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/);
    expect(styles).toMatch(/\.survivor-scene__relic\s*\{[\s\S]*min-height:\s*374px/);
    expect(styles).toMatch(/\.survivor-scene__relic-art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.survivor-scene__relic-art\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.survivor-scene__relic-art\s*\{[\s\S]*filter:\s*saturate\(1\.04\) contrast\(1\.03\)/);
    expect(styles).toMatch(/\.survivor-scene__relic-scrim\s*\{[\s\S]*display:\s*block/);
    expect(styles).toMatch(/\.survivor-scene__danger-track\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/\.survivor-scene__beats\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.survivor-scene__beats span\[data-active="true"\]\s*\{[\s\S]*animation:\s*survivor-beat-glow/);
    expect(styles).toMatch(/\.survivor-scene__relic-copy\s*\{[\s\S]*text-shadow:\s*none/);
    expect(styles).toMatch(/\.survivor-climax__card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.survivor-climax__medal\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.survivor-climax__medal img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.survivor-climax__medal img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.survivor-climax__medal img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.survivor-climax__medal::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.survivor-controls__dock[\s\S]*grid-template-columns:\s*minmax\(176px,\s*0\.56fr\)/);
    expect(styles).toMatch(/\.survivor-controls__core[\s\S]*background:\s*#fff8ed/);
    expect(styles).toMatch(/\.survivor-controls__stepper[\s\S]*background:\s*#fff8ed/);
    expect(styles).toMatch(/\.survivor-stepper__track-fill[\s\S]*background:\s*#f59e0b/);
    expect(styles).toMatch(/\.survivor-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.survivor-scene__notice\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-play-area \.mx2-stage\s*\{[\s\S]*padding:\s*8px 6px 10px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-play-area \.mx2-stage__subtitle\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-scene\s*\{[\s\S]*min-height:\s*456px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-scene__relic\s*\{[\s\S]*width:\s*min\(252px,\s*calc\(100vw - 92px\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-scene__relic-art\s*\{[\s\S]*height:\s*296px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-controls__presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-controls__dock\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.survivor-preset\s*\{[\s\S]*min-height:\s*54px/);
    expect(styles).not.toMatch(/\.survivor-climax__medal img\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/\.survivor-climax__medal img\s*\{[^}]*filter:\s*saturate/);
    expect(styles).not.toMatch(/\.survivor-climax__medal::after\s*\{[^}]*linear-gradient/);

    // Key buying stays game-like: tappable relic + presets + stepper, not a form.
    expect(source).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(source).not.toContain("setTimeout(");
    expect(source).toMatch(/ARENA_IMAGE = "last-survivor-arena\.webp"/);
    expect(source).toContain("survivor-scene__arena-art");
    expect(source).toContain("survivor-scene__shade");
    expect(source).toContain("survivor-scene__relic");
    expect(source).toContain("survivor-scene__beats");
    expect(source).toContain("survivor-controls__dock");
    expect(source).toContain("survivor-controls__core");
    expect(source).toContain("survivor-controls__presets");
    expect(source).toContain("survivor-controls__stepper");
  });
});
