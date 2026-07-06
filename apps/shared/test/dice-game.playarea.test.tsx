import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../dice-game/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}

function playAreaSource(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.tsx"), "utf8");
}

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    rollTab: "Roll",
    rollDescription: "Choose one face and stake GAS.",
    pickYourFace: "Pick your lucky face",
    selectedFace: "Face",
    stakeAmount: "Stake",
    payoutPreview: "Win payout",
    betLaneLabel: "Face, stake, and payout path",
    oddsLabel: "Chance",
    networkLabel: "Network",
    rollAction: "Roll",
    rollDice: "Roll Dice",
    dieShowing: "die showing {face}",
    customStakeTitle: "Fine tune stake",
    customStakeHint: "Exact GAS",
    stakeRackTitle: "Chip rack",
    invalidStake: "Enter a GAS stake from 0.05.",
    statusReady: "Ready",
    statusRolling: "Rolling...",
    statusSubmitting: "Submitting roll...",
    statusRevealing: "Revealing...",
    statusSettlementPending: "Settlement pending",
    statusWon: "You won!",
    statusLost: "No win",
    statusRefunded: "Refunded",
    readyTitle: "Choose a face and roll",
    throwingTitle: "Dice is rolling",
    maxStakeNote: "Max on this network",
    rangeLabel: "Stake range",
    feeLabel: "Platform fee",
    tokenGas: "GAS",
    directCreditLabel: "Roll credit",
    withdrawCredit: "Withdraw",
    checkAgain: "Reveal result",
    diceHistoryTitle: "Recent rolls",
    diceHistoryEmpty: "No local roll history yet.",
    howItWorks: "How it works",
    docHowItWorks: "Commit and reveal.",
    safetyModel: "Safety model",
    docSafetyModel: "Commit/reveal across two blocks.",
    diceVrfRouteTitle: "Settlement route",
    vrfTrustLine: "Commit/reveal randomness.",
    diceRiskTitle: "House model",
    diceRiskCopy: "A match pays 5.70x.",
    statusStakeOverLiquidity: "Over house cap.",
    youPicked: "You picked",
  };
  let s = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    selectedFace: "6",
    stakeAmount: "0.10 GAS",
    payoutPreview: "0.57 GAS",
    lastStatus: "Ready",
    isSubmitting: false,
    lastRoll: "",
    lastOutcome: "",
    rollHistory: [],
    chainLabel: "Neo N3",
    maxStake: 20,
    maxPayableStake: 0,
    directCredit: 0,
    isResolving: false,
    isUnresolved: false,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Dice Game PlayArea (v2 scene-driven)", () => {
  it("submits a selected face and GAS stake from the scene", async () => {
    const dispatch = vi.fn(async () => undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    // Face selection is a playable betting spot, not a segmented form control.
    fireEvent.click(screen.getByRole("button", { name: /die showing 3.*roll dice/i }));
    // Exact stake entry is available, but tucked away behind a secondary chip action.
    fireEvent.click(screen.getByRole("button", { name: /exact gas/i }));
    fireEvent.change(screen.getByPlaceholderText("0.10"), {
      target: { value: "0.5" },
    });
    // Primary action.
    fireEvent.click(screen.getByRole("button", { name: /^Roll$/ }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("placeDiceBet", {
        chosenNumber: "3",
        amount: "0.5",
      });
    });
  });

  it("marks the scene as rolling while a bet is submitting", async () => {
    let resolveRoll: (() => void) | undefined;
    const dispatch = vi.fn((name: string) => {
      if (name === "placeDiceBet") {
        return new Promise<void>((resolve) => {
          resolveRoll = resolve;
        });
      }
      return Promise.resolve();
    });
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Roll$/ }));

    expect(dispatch).toHaveBeenCalledWith("placeDiceBet", {
      chosenNumber: "6",
      amount: "0.1",
    });
    await waitFor(() => {
      // The scene flips to "rolling" state and the die gains the tumble anim.
      expect(container.querySelector(".dice-scene")?.getAttribute("data-state")).toBe("rolling");
      expect(container.querySelector(".dice-scene__die-anchor.mx2-roll")).toBeTruthy();
      // The primary button shows the submitting state (aria-busy).
      expect(container.querySelector(".mx2-btn--primary")?.getAttribute("aria-busy")).toBe("true");
    });

    resolveRoll?.();
  });

  it("lets the main die submit the roll as a playable resource", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /roll dice - face 6/i }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("placeDiceBet", {
        chosenNumber: "6",
        amount: "0.1",
      });
    });
  });

  it("blocks out-of-range stakes by disabling the primary action", () => {
    const dispatch = vi.fn(async () => undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /exact gas/i }));
    fireEvent.change(screen.getByPlaceholderText("0.10"), {
      target: { value: "0.01" },
    });

    const rollButton = screen.getByRole("button", { name: /^Roll$/ }) as HTMLButtonElement;
    expect(rollButton.disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("applies a chip preset and updates the payout readout", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    // Click the 1.00 chip preset.
    const oneChip = screen.getByRole("button", { name: /1\.00 GAS/i });
    fireEvent.click(oneChip);

    // The payout is promoted into the table HUD and bet lane without a duplicate score rail.
    expect(screen.getAllByText("5.70 GAS")).toHaveLength(2);
    expect(oneChip.className).toContain("dice-chip-btn--active");
  });

  it("renders the scene-driven layout (felt table, die, chip, face strip)", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    // The dominant scene.
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector(".dice-scene")).toBeTruthy();
    expect(container.querySelector(".dice-scene__felt")).toBeTruthy();
    expect(container.querySelector(".dice-scene__felt-track")).toBeTruthy();
    expect(container.querySelector(".dice-scene__table-rim")).toBeTruthy();
    expect(container.querySelector(".dice-scene__hud")).toBeTruthy();
    expect(container.querySelector(".dice-scene__table-mat")).toBeTruthy();
    expect(container.querySelector(".dice-scene__dealer-rail")).toBeTruthy();
    expect(container.querySelector(".dice-scene__table-photo")).toBeNull();
    expect(container.querySelector(".dice-scene__play-table")).toBeTruthy();
    expect(container.querySelector(".dice-scene__live-zone")).toBeTruthy();
    expect(container.querySelectorAll(".dice-scene__side-die")).toHaveLength(2);
    expect(container.querySelector(".dice-scene__die-anchor")?.tagName).toBe("BUTTON");
    expect(container.querySelector(".dice-scene__die")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".dice-scene__die")?.getAttribute("src")).toBe("./art/die-white-6.webp");
    expect(container.querySelector(".dice-scene__throw-path")).toBeTruthy();
    expect(container.querySelector(".dice-scene__landing-ring")).toBeTruthy();
    expect(container.querySelector(".dice-scene__stake-chip")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".dice-scene__stake-chip img")?.getAttribute("src")).toBe("./art/chip-green.webp");
    expect(container.querySelector(".dice-scene__bet-lane")).toBeTruthy();
    expect(container.querySelectorAll(".dice-scene__bet-node")).toHaveLength(3);
    expect(container.querySelectorAll(".dice-scene__bet-beam")).toHaveLength(2);
    expect(
      container.querySelector<HTMLImageElement>(".dice-scene__bet-node--face img")?.getAttribute("src"),
    ).toBe("./art/die-white-6.webp");
    const stakeNodeText = container.querySelector(".dice-scene__bet-node--stake")?.textContent ?? "";
    expect(stakeNodeText).toContain("0.10");
    expect(stakeNodeText).toContain("GAS");
    expect(stakeNodeText).not.toContain("0.100.10");
    expect(container.querySelector(".dice-scene__bet-node--payout")?.textContent).toContain("0.57 GAS");
    expect(container.querySelector(".dice-scene .dice-controls")).toBeTruthy();
    expect(container.querySelector(".dice-controls__rack-art")).toBeNull();
    // The scene is the game: 6 face betting spots + 4 chips + exact stake.
    expect(container.querySelector(".dice-bet-spots")).toBeTruthy();
    expect(container.querySelectorAll(".dice-bet-spot").length).toBe(6);
    expect(container.querySelectorAll(".dice-bet-spot__die").length).toBe(6);
    expect(container.querySelector(".dice-chip-tray")).toBeTruthy();
    expect(container.querySelectorAll(".dice-chip-btn").length).toBe(5);
    expect(screen.queryByPlaceholderText("0.10")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /exact gas/i }));
    expect(screen.getByPlaceholderText("0.10")).toBeTruthy();
    // Primary/secondary hierarchy via the shared PlayStage scaffold.
    expect(container.querySelector(".mx2-btn--primary")).toBeTruthy();
    expect(container.querySelector(".mx2-btn--primary svg")).toBeTruthy();
    expect(container.querySelector(".mx2-stage")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
  });

  it("keeps the game resources visible without muddying text layers", () => {
    const source = playAreaSource("dice-game");
    const styles = playAreaStyles("dice-game");

    expect(source).toContain("OpenUiProvider");
    expect(source).toContain("OpenUiTextField");
    expect(source).not.toContain("<form");
    expect(source).not.toContain("OpenUiSegmented");
    expect(source).not.toContain("ChipArt");
    expect(source).not.toMatch(/<(input|textarea|select)\b/);
    expect(source).not.toContain('role="radio"');
    expect(source).not.toContain('role="radiogroup"');
    expect(source).toContain("dice-bet-spots");
    expect(source).toContain("dice-chip-tray");
    expect(styles).toMatch(/\.dice-playarea\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/\.dice-scene\s*\{[\s\S]*background:\s*#fffdf7/);
    expect(styles).toMatch(/\.dice-scene__felt\s*\{[\s\S]*#fff8e8/);
    expect(styles).toMatch(/dice-scene__felt-track[\s\S]*display:\s*none/);
    expect(styles).toMatch(/dice-scene__felt-track[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/\.dice-scene__table-rim\s*\{[\s\S]*width:\s*min\(690px,\s*82%\)/);
    expect(styles).toMatch(/\.dice-scene__dealer-rail\s*\{[\s\S]*width:\s*min\(340px,\s*44%\)/);
    expect(styles).toMatch(/\.dice-scene__play-table\s*\{[\s\S]*min-height:\s*318px/);
    expect(styles).toMatch(/dice-scene__live-zone[\s\S]*grid-template-columns:\s*88px minmax\(188px,\s*230px\) 88px/);
    expect(styles).toMatch(/\.dice-bet-spots\s*\{[\s\S]*pointer-events:\s*none/);
    expect(styles).toMatch(/\.dice-bet-spot\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/\.dice-bet-spot\s*\{[\s\S]*border-radius:\s*999px/);
    expect(styles).toMatch(/\.dice-bet-spot\s*\{[\s\S]*background:\s*#fffef9/);
    expect(styles).toMatch(/\.dice-bet-spot--active\s*\{[\s\S]*background:\s*#f3fff9/);
    expect(styles).toMatch(/\.dice-bet-spot__die\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.dice-bet-spot__label\s*\{[\s\S]*border-radius:\s*999px/);
    expect(styles).toMatch(/\.dice-scene__die-anchor\s*\{[\s\S]*cursor:\s*pointer/);
    expect(styles).toMatch(/\.dice-scene__die-anchor\s*\{[\s\S]*grid-column:\s*2/);
    expect(styles).toMatch(/\.dice-scene__die-anchor:hover:not\(:disabled\)\s*\{[\s\S]*translateY\(-3px\) scale\(1\.015\)/);
    expect(styles).toMatch(/\.dice-scene__die,[\s\S]*\.dice-scene__side-die\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.dice-scene__die,[\s\S]*\.dice-scene__side-die\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/dice-scene__side-die[\s\S]*opacity:\s*0\.22/);
    expect(styles).toMatch(/\.dice-scene__bet-lane\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 42px minmax\(0,\s*1fr\) 42px minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.dice-scene__bet-node\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-pill\)/);
    expect(styles).toMatch(/\.dice-scene__bet-node img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.dice-scene\[data-state="rolling"\] \.dice-scene__bet-lane\s*\{[\s\S]*animation:\s*dice-bet-lane-lift/);
    expect(styles).toMatch(/@keyframes dice-bet-beam/);
    expect(styles).not.toMatch(/\.dice-scene__die,[\s\S]*\.dice-scene__side-die\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.dice-chip-tray\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.88\)/);
    expect(styles).toMatch(/\.dice-chip-btn\s*\{[\s\S]*border-radius:\s*999px/);
    expect(styles).toMatch(/\.dice-chip-btn\s*\{[\s\S]*min-width:\s*58px/);
    expect(styles).toMatch(/\.dice-chip-btn img\s*\{[\s\S]*width:\s*52px/);
    expect(styles).toMatch(/\.dice-chip-btn img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.dice-chip-btn--active\s*\{[\s\S]*background:\s*#fff5d8/);
    expect(styles).toMatch(/\.dice-chip-btn span:not\(:only-child\)\s*\{[\s\S]*background:\s*rgba\(31,\s*41,\s*55,\s*0\.74\)/);
    expect(styles).toMatch(/\.dice-controls__fine-input \.semi-input\s*\{[\s\S]*text-align:\s*center/);
    expect(styles).not.toContain("backdrop-filter");
    expect(styles).not.toContain("dice-controls__rail");
    expect(styles).not.toContain("dice-face-btn");
    expect(styles).not.toContain("dice-controls__rack-art");
    expect(styles).not.toContain("semi-radioGroup");
    expect(styles).toMatch(/dice-scene__table-mat[\s\S]*opacity:\s*0\.58/);
    expect(styles).toMatch(/dice-scene__throw-path[\s\S]*opacity:\s*0;/);
    expect(styles).toMatch(/dice-scene__landing-ring[\s\S]*opacity:\s*0;/);
    expect(styles).toMatch(/dice-scene\[data-state="rolling"\] \.dice-scene__table-mat[\s\S]*opacity:\s*0\.48/);
    expect(styles).toMatch(/dice-scene\[data-state="rolling"\] \.dice-scene__throw-path[\s\S]*opacity:\s*0\.12/);
    expect(styles).toMatch(/dice-scene\[data-state="won"\] \.dice-scene__felt[\s\S]*border-color:\s*rgba\(16,\s*185,\s*129,\s*0\.22\)/);
    expect(styles).toMatch(/dice-scene\[data-state="won"\] \.dice-scene__felt[\s\S]*#fffaf0/);
    expect(styles).toMatch(/\.dice-scene__die-anchor\.mx2-roll\s*\{[\s\S]*animation:\s*dice-clean-tumble/);
    expect(styles).toMatch(/@keyframes dice-clean-tumble/);
    const feltWashBlock = styles.match(/\.dice-scene__felt::after\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? "";
    const tableMatBlock = styles.match(/\.dice-scene__table-mat\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? "";
    const controlsRailWashBlock =
      styles.match(/\.dice-controls__rail::after\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? "";
    expect(styles).not.toMatch(/dice-scene__felt::after/);
    expect(feltWashBlock).toBe("");
    expect(tableMatBlock).not.toContain("radial-gradient");
    expect(styles).not.toMatch(/dice-scene__table-photo/);
    expect(styles).toMatch(/\.dice-controls\s*\{[\s\S]*max-width:\s*620px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-playarea \.mx2-stage\s*\{[\s\S]*padding:\s*13px 14px 14px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-playarea \.mx2-stage__subtitle\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-scene__bet-lane\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-scene__play-table\s*\{[\s\S]*min-height:\s*278px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-bet-spot\s*\{[\s\S]*width:\s*58px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-bet-spot__die\s*\{[\s\S]*width:\s*34px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-chip-tray\s*\{[\s\S]*gap:\s*7px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-chip-btn\s*\{[\s\S]*min-width:\s*46px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.dice-playarea \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).not.toMatch(/@media \(max-width:\s*720px\)[\s\S]*grid-template-columns:\s*repeat\(3,\s*64px\)/);
    expect(controlsRailWashBlock).toBe("");
    expect(styles).not.toContain("opacity: 0.06;");
    expect(styles).toMatch(/dice-scene__hud-card[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.dice-playarea \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 154px/);
    expect(styles).not.toMatch(/\.dice-playarea \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dice-scene__die-anchor\.mx2-roll/);
    for (const match of styles.matchAll(/letter-spacing:\s*([^;]+);/g)) {
      expect(match[1].trim()).toBe("0");
    }
  });

  it("shows a won scene with the landed-die animation after a win", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ lastOutcome: "won", lastRoll: "4" })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".dice-scene")?.getAttribute("data-state")).toBe("won");
    expect(container.querySelector(".dice-scene__die-anchor.mx2-land")).toBeTruthy();
    // A win fires the celebratory coin burst.
    expect(container.querySelector(".mx2-burst")).toBeTruthy();
  });

  it("tucks history + rules into a detail drawer (primary/secondary hierarchy)", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    // The drawer toggle exists and the drawer body is hidden by default.
    const toggle = container.querySelector(".mx2-action-rail__drawer-toggle");
    expect(toggle).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();

    // Opening reveals the tucked-away history + rules.
    fireEvent.click(toggle as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
  });

  it("renders real local roll history inside the drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          rollHistory: [
            {
              face: "4",
              stake: "0.5 GAS",
              result: "Won · 🎲 4",
              payout: "2.85 GAS",
              outcome: "won",
              at: "2026-06-01T00:00:00.000Z",
            },
          ],
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    // Open the tucked-away drawer, then the history row appears.
    const toggle = container.querySelector(".mx2-action-rail__drawer-toggle") as Element;
    fireEvent.click(toggle);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    // The history result is rendered (the face/result may be split across spans).
    const historyItem = container.querySelector(".mx2-history__item");
    expect(historyItem).toBeTruthy();
    expect(historyItem?.textContent ?? "").toContain("Won · 🎲 4");
  });
});
