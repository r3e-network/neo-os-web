import React from "react";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../fogplay/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) {
  const m: Record<string,string> = { title:"Coin Flip", docSubtitle:"Heads or tails.", heads:"Heads", tails:"Tails", choiceHeader:"Pick a side", youPicked:"Selected", betHeader:"Place your bet", wager:"Wager Amount", flipCoin:"Flip Coin", flipping:"Flipping...", committing:"Flipping...", betPlacedRevealing:"Revealing...", timelineResultReady:"Reveal Result", revealResult:"Reveal result", youWon:"You won!", youLost:"You lost", wins:"Wins", totalGames:"Games", totalWon:"Won", withdrawCredit:"Withdraw", creditWithdrawn:"Withdrawn", commitRevealTimeline:"How it works", timelineCommit:"Commit bet", timelineReveal:"Reveal", timelineNeedsRetry:"Retry needed", wagerRange:"Max bet", resetGame:"Reset", displayOutcome:"Outcome" };
  return m[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { wins:0, losses:0, totalGames:0, formattedTotalWon:"0", betAmount:"0.1", choice:"heads", isFlipping:false, revealing:false, result:"", displayOutcome:"", showWinOverlay:false, winAmount:"", validationError:"", canBet:true, hasPendingBet:false, revealFailed:false, gameHistory:[], formattedCredit:"0", hasCredit:false, formattedMaxPayable:"5", ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}
function readPngInfo(file: string) {
  const bytes = readFileSync(file);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}
function readPngStats(file: string) {
  const png = PNG.sync.read(readFileSync(file));
  let opaque = 0;
  let transparent = 0;
  let magentaResidue = 0;
  let blueDominant = 0;
  let greenDominant = 0;
  let graphiteDominant = 0;
  let goldDominant = 0;
  let grayBoardResidue = 0;
  let maxX = 0;
  let maxY = 0;
  let minX = png.width;
  let minY = png.height;
  let semiTransparent = 0;

  for (let i = 0; i < png.data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % png.width;
    const red = png.data[i];
    const green = png.data[i + 1];
    const blue = png.data[i + 2];
    const alpha = png.data[i + 3];

    if (alpha < 8) transparent += 1;
    if (alpha >= 8 && alpha < 220) semiTransparent += 1;
    if (alpha <= 220) continue;

    opaque += 1;
    if (red > 220 && blue > 220 && green < 80) magentaResidue += 1;
    if (
      (red + green + blue) / 3 > 208 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) < 8
    ) {
      grayBoardResidue += 1;
    }
    if (blue > green + 35 && blue > red + 15) blueDominant += 1;
    if (green > blue + 20 && green > red + 5) greenDominant += 1;
    if (red < 55 && green < 55 && blue < 55) graphiteDominant += 1;
    if (red > 150 && green > 90 && blue < 80) goldDominant += 1;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, Math.floor(pixelIndex / png.width));
    maxY = Math.max(maxY, Math.floor(pixelIndex / png.width));
  }

  const cornerAlpha = [
    png.data[3],
    png.data[(png.width - 1) * 4 + 3],
    png.data[(png.height - 1) * png.width * 4 + 3],
    png.data[(png.height * png.width - 1) * 4 + 3],
  ];

  return {
    blueDominant,
    cornerAlpha,
    grayBoardResidue,
    greenDominant,
    graphiteDominant,
    goldDominant,
    maxX,
    maxY,
    minX,
    minY,
    magentaResidue,
    opaque,
    semiTransparent,
    transparent,
    total: png.width * png.height,
  };
}
describe("Fogplay PlayArea (v2)", () => {
  it("ships polished full-frame Neo coin assets for both sides", () => {
    const heads = path.join(appsRoot(), "fogplay/src/static/coin_heads.png");
    const tails = path.join(appsRoot(), "fogplay/src/static/coin_tails.png");
    const headsStats = readPngStats(heads);
    const tailsStats = readPngStats(tails);

    expect(existsSync(heads)).toBe(true);
    expect(existsSync(tails)).toBe(true);
    expect(readPngInfo(heads)).toEqual({ width: 768, height: 768, bitDepth: 8, colorType: 6 });
    expect(readPngInfo(tails)).toEqual({ width: 768, height: 768, bitDepth: 8, colorType: 6 });
    expect(statSync(heads).size).toBeGreaterThan(180_000);
    expect(statSync(tails).size).toBeGreaterThan(180_000);
    expect(statSync(heads).size).toBeLessThan(1_600_000);
    expect(statSync(tails).size).toBeLessThan(1_600_000);
    expect(readFileSync(heads).equals(readFileSync(tails))).toBe(false);
    expect(headsStats.cornerAlpha).toEqual([0, 0, 0, 0]);
    expect(tailsStats.cornerAlpha).toEqual([0, 0, 0, 0]);
    expect(headsStats.opaque).toBeGreaterThan(headsStats.total * 0.5);
    expect(tailsStats.opaque).toBeGreaterThan(tailsStats.total * 0.5);
    expect(headsStats.transparent).toBeGreaterThan(headsStats.total * 0.25);
    expect(tailsStats.transparent).toBeGreaterThan(tailsStats.total * 0.25);
    expect(headsStats.semiTransparent).toBeLessThan(headsStats.total * 0.04);
    expect(tailsStats.semiTransparent).toBeLessThan(tailsStats.total * 0.04);
    expect(headsStats.magentaResidue).toBe(0);
    expect(tailsStats.magentaResidue).toBe(0);
    expect(headsStats.grayBoardResidue).toBeLessThan(headsStats.opaque * 0.006);
    expect(tailsStats.grayBoardResidue).toBeLessThan(tailsStats.opaque * 0.006);
    expect(headsStats.greenDominant).toBeGreaterThan(headsStats.opaque * 0.12);
    expect(tailsStats.greenDominant).toBeGreaterThan(tailsStats.opaque * 0.05);
    expect(headsStats.goldDominant).toBeGreaterThan(headsStats.opaque * 0.14);
    expect(tailsStats.goldDominant).toBeGreaterThan(tailsStats.opaque * 0.16);
    expect(headsStats.graphiteDominant).toBeGreaterThan(headsStats.opaque * 0.26);
    expect(tailsStats.graphiteDominant).toBeGreaterThan(tailsStats.opaque * 0.32);
    expect(headsStats.blueDominant).toBeLessThan(headsStats.opaque * 0.01);
    expect(tailsStats.blueDominant).toBeLessThan(tailsStats.opaque * 0.01);
    expect(headsStats.minX).toBeLessThan(60);
    expect(tailsStats.minX).toBeLessThan(60);
    expect(headsStats.maxX).toBeGreaterThan(708);
    expect(tailsStats.maxX).toBeGreaterThan(708);
    expect(headsStats.minY).toBeLessThan(40);
    expect(tailsStats.minY).toBeLessThan(40);
    expect(headsStats.maxY).toBeGreaterThan(720);
    expect(tailsStats.maxY).toBeGreaterThan(720);
  });

  it("renders the resource-led coin-flip scene with heads/tails choice", () => { const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />); expect(container.querySelector(".fogplay-scene")).toBeTruthy(); expect(container.querySelector(".fogplay-scene__arena")).toBeTruthy(); expect(container.querySelector(".fogplay-scene__coin")).toBeTruthy(); expect(container.querySelector(".coin-scene")).toBeTruthy(); expect(container.querySelector(".fogplay-scene__pedestal")).toBeTruthy(); expect(container.querySelector(".fogplay-scene__coin-face")).toBeNull(); expect(container.querySelector(".fogplay-scene__backdrop")).toBeNull(); expect(container.querySelectorAll(".fogplay-choice-btn").length).toBe(2); });
  it("dispatches setChoice when selecting heads/tails", () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />); fireEvent.click(container.querySelectorAll(".fogplay-choice-btn")[1]); expect(d).toHaveBeenCalledWith("setChoice", "tails"); });
  it("dispatches setBetAmount on preset click", () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />); fireEvent.click(container.querySelectorAll(".fogplay-bet-chip")[2]); expect(d).toHaveBeenCalledWith("setBetAmount", "10"); });
  it("dispatches placeBet on primary action", async () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />); fireEvent.click(container.querySelector(".mx2-btn--primary") as Element); await waitFor(() => expect(d).toHaveBeenCalledWith("placeBet")); });
  it("shows the flipping scene state immediately after the primary action", async () => {
    const d = vi.fn(() => new Promise<void>(() => undefined));
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => {
      expect(container.querySelector(".fogplay-scene")?.getAttribute("data-state")).toBe("flipping");
      expect(container.querySelector(".coin-scene--flipping")).toBeTruthy();
    });
  });
  it("dispatches revealResult when bet is pending", async () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state({ hasPendingBet:true, canBet:false })} dispatch={d} />); fireEvent.click(container.querySelector(".mx2-btn--primary") as Element); await waitFor(() => expect(d).toHaveBeenCalledWith("revealResult")); });
  it("shows win overlay when showWinOverlay is true", () => { const { container } = render(<PlayArea t={t} state={state({ showWinOverlay:true, winAmount:"1.5 GAS" })} dispatch={vi.fn()} />); expect(container.querySelector(".fogplay-win-overlay")).toBeTruthy(); expect(container.textContent).toContain("1.5 GAS"); });
  it("shows game history in drawer", () => { const { container } = render(<PlayArea t={t} state={state({ gameHistory: [{ id:"1", choice:"heads", amount:"0.5", result:"won" }] })} dispatch={vi.fn()} />); fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element); expect(container.textContent).toContain("Heads"); });
  it("tones history rows by outcome for both fixture and composable shapes", () => {
    const { container } = render(<PlayArea t={t} state={state({ gameHistory: [
      { id: "1", choice: "heads", amount: "0.5", result: "won" },
      { betId: "2", choice: "tails", amount: 1, won: false },
    ] })} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const rows = container.querySelectorAll(".mx2-history__item");
    expect(rows[0].getAttribute("data-outcome")).toBe("won");
    expect(rows[1].getAttribute("data-outcome")).toBe("lost");
  });
  it("surfaces a stalled reveal in the scene status pill with an alert tone", () => {
    const { container } = render(<PlayArea t={t} state={state({ revealFailed: true, hasPendingBet: true, canBet: false })} dispatch={vi.fn()} />);
    const pill = container.querySelector(".fogplay-scene__status") as HTMLElement;
    expect(pill.getAttribute("data-tone")).toBe("alert");
    expect(pill.textContent).toContain("revealStalled");
  });
  it("shows the first-round onboarding prompt for a brand-new player", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const pill = container.querySelector(".fogplay-scene__status") as HTMLElement;
    expect(pill.textContent).toContain("firstRoundPrompt");
    expect(container.querySelector(".fogplay-scene__status-sub")).toBeTruthy();
  });
  it("has reduced-motion", () => {
    const s = readFileSync(path.join(appsRoot(), "fogplay/src/PlayArea.scss"), "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/0\.001ms/);
  });
  it("keeps the coin game clean and resource-led instead of form-led", () => {
    const s = readFileSync(path.join(appsRoot(), "fogplay/src/PlayArea.scss"), "utf8");
    const coinStyles = readFileSync(path.join(appsRoot(), "fogplay/src/components/ThreeDCoin.scss"), "utf8");
    const source = readFileSync(path.join(appsRoot(), "fogplay/src/PlayArea.tsx"), "utf8");

    expect(s).toMatch(/\.fogplay-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(s).toMatch(/fogplay-scene__arena[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/fogplay-scene__orbit[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/fogplay-scene__orbit[\s\S]*opacity:\s*0;/);
    expect(s).toMatch(/fogplay-scene\[data-state="flipping"\] \.fogplay-scene__orbit[\s\S]*opacity:\s*0\.26/);
    expect(s).toMatch(/\.fogplay-scene__coin \.coin-scene\s*\{[\s\S]*--coin-size:\s*188px/);
    expect(s).not.toMatch(/__backdrop|fogplay-scene-art/);
    expect(s).not.toMatch(/radial-gradient/);
    expect(s).not.toMatch(/backdrop-filter/);
    expect(s).not.toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.[0-8]/);
    expect(s).toMatch(/\.fogplay-choice-card \{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.fogplay-choice-card__coin img\s*\{[\s\S]*width:\s*100%/);
    expect(s).toMatch(/\.fogplay-choice-card__coin img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.fogplay-choice-card--tails \.fogplay-choice-card__coin img\s*\{[\s\S]*width:\s*100%/);
    expect(s).toMatch(/\.fogplay-scene__status \{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.fogplay-controls__header \{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.fogplay-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(s).not.toMatch(/\.fogplay-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
    expect(coinStyles).toMatch(/\.coin-face\s*\{[\s\S]*background:\s*transparent/);
    expect(coinStyles).toMatch(/\.coin-face\s*\{[\s\S]*box-shadow:\s*none/);
    expect(coinStyles).toMatch(/\.coin-rim\s*\{[\s\S]*background:\s*transparent/);
    expect(coinStyles).toMatch(/\.coin-face__image\s*\{[\s\S]*width:\s*100%/);
    expect(coinStyles).toMatch(/\.coin-face__image\s*\{[\s\S]*object-fit:\s*contain/);
    expect(coinStyles).toMatch(/\.coin-face--tails \.coin-face__image\s*\{[\s\S]*width:\s*100%/);
    expect(coinStyles).not.toMatch(/width:\s*1(?:26|58|66)%/);
    expect(coinStyles).not.toMatch(/height:\s*1(?:26|58|66)%/);
    expect(source).not.toMatch(/<form\b|<input\b|<textarea\b|<select\b/);
    expect(source).not.toMatch(/fogplay-scene__backdrop|fogplay-scene-art/);
    expect(source).toContain("ThreeDCoin");
    expect(source).toContain("fogplay-choice-card");
    expect(source).toContain("fogplay-bet-chip");
  });
});
