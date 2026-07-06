import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../burn-league/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    burnNow: "Burn Now",
    burnTokens: "Burn Tokens",
    burnPresets: "Fuel capsules",
    burning: "Burning...",
    burnRange: `Burn range: ${params?.min ?? 1}-${params?.max ?? 1000} GAS`,
    decreaseBurn: "Decrease burn amount",
    increaseBurn: "Increase burn amount",
    leaderboard: "Leaderboard",
    liveLeague: "Live league",
    prizePool: "Prize pool",
    projectedTotal: "Projected total",
    fuelConsole: "Fuel rack",
    fuelCore: "Fuel core",
    fuelDialLabel: "Fuel tuner",
    fuelLoadHint: "Capsules tune the next ignition",
    readyToBurn: "Core armed",
    seasonLabel: "Season",
    seasonStatus: "Season status",
    seasonDormantHint: "No active season yet — the first burn starts a fresh season.",
    seasonEndedHint: "The season has ended. Settle to award the pool to the top burner.",
    seasonEndsIn: "Ends in",
    seasonLengthLabel: "Season length",
    currentLeader: "Current leader",
    settleSeason: "Settle season",
    settleSuccess: "Season settled",
    subtitle: "Burn tokens, earn rewards",
    title: "Burn League",
    youLeadBadge: "You lead",
    youBurned: "You burned",
    yourRank: "Your rank",
    noEntries: "No leaderboard entries yet",
    howItWorks: "How it works",
    howStepPick: "Pick an amount.",
    howStepBurn: "Burn GAS.",
    howStepClimb: "Climb the leaderboard.",
    howStepWin: "Win the pool.",
    prepaidCreditLabel: "Prepaid credit",
    prepaidCreditHint: "Withdrawable.",
    withdrawCredit: "Withdraw credit",
    celebrationDismiss: "Done",
    settleWinTitle: "You won!",
    settleWinBody: "The pool is yours.",
    settleDoneTitle: "Season settled",
    settleDoneBody: "The pool was awarded.",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    actionNotice: "",
    burnAmount: "1",
    burnValidationError: null,
    countdown: "00:01:30",
    formattedRank: "--",
    formattedSeason: "#1",
    isBurning: false,
    isLoading: false,
    isSettling: false,
    lastSubmittedAmount: "",
    leaderboardPreview: [],
    leaderboardSize: 0,
    leaderLabel: "--",
    leagueDataAvailable: false,
    needsSettle: false,
    prizePoolDisplay: "0.00 GAS",
    projectedTotalBurnedDisplay: "1.00 GAS",
    seasonPhase: "active",
    seasonStatusLabel: "Live now",
    seasonDurationLabel: "2 min",
    serviceNotice: "",
    totalBurnedDisplay: "0.00 GAS",
    userBurned: 0,
    userBurnedDisplay: "0.00 GAS",
    userIsLeader: false,
    prepaidCredit: 0,
    prepaidCreditDisplay: "0.00 GAS",
    minBurnGas: 1,
    maxBurnGas: 1000,
    lastSettleResult: null,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([k, v]) => [k, createObservable(v)]),
  );
}

function appsRoot(): string {
  const path = require("node:path");
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

describe("Burn League PlayArea (v2 scene-driven)", () => {
  it("renders the resource-led burn arena with the burn action", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".burn-scene")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".burn-scene__arena-image")?.getAttribute("src")).toContain("burn-league-arena.webp");
    expect(container.querySelector(".burn-scene__shade")).toBeTruthy();
    expect(container.querySelector(".burn-scene__brazier-art")).toBeNull();
    expect(container.querySelector(".burn-scene__torch-medal .mx2-coin")).toBeTruthy();
    expect(container.querySelector(".burn-scene__brazier")).toBeTruthy();
    expect(container.querySelector(".burn-scene__token-trail")).toBeNull();
    expect(container.querySelector(".burn-scene__meter")).toBeTruthy();
    // Primary burn action lives in the arena target.
    expect(container.querySelector(".mx2-btn--primary")).toBeTruthy();
  });

  it("uses compact fuel controls instead of a raw form input", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".burn-controls__dock")).toBeTruthy();
    // The dock header carries the outcome readout; the brazier scrim is the
    // single "Fuel core" voice.
    expect(container.querySelector(".burn-controls__header")?.textContent).toContain("Projected total");
    expect(container.querySelector(".burn-controls__header")?.textContent).toContain("1.00 GAS");
    expect(container.querySelector(".burn-scene__brazier-copy")?.textContent).toContain("Fuel core");
    expect(container.querySelector(".burn-stepper__output")?.textContent).toContain("1");
    expect(container.querySelector(".burn-stepper__input")).toBeNull();
    expect(container.querySelector(".burn-controls__presets")?.getAttribute("aria-label")).toBe("Fuel capsules");
    expect(container.querySelector(".burn-preset")?.getAttribute("aria-label")).toBe("1 GAS");
    expect(container.querySelector(".burn-preset strong")?.textContent).toBe("1");
    expect(container.textContent).not.toContain("Choose fuel");
  });

  it("shows the service notice once in the scene when present", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ serviceNotice: "Stats unavailable right now." })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".burn-scene__status")?.textContent).toContain("Stats unavailable right now.");
    expect(container.querySelector(".burn-controls__notice[role='alert']")).toBeNull();
  });

  it("dispatches a burn for a preset amount and shows burning motion", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    // Select a preset.
    const preset5 = container.querySelectorAll(".burn-preset")[1]; // "5"
    fireEvent.click(preset5);

    // Fire the in-scene burn action, not a duplicated rail button.
    fireEvent.click(container.querySelector(".burn-scene__brazier") as Element);

    await waitFor(() => {
      expect(container.querySelector('.burn-scene[data-state="burning"]')).toBeTruthy();
      expect(container.querySelector(".burn-scene__token-trail")).toBeTruthy();
      expect(container.querySelector(".burn-scene__coin-burst")).toBeTruthy();
    });
    expect(dispatch).toHaveBeenCalledWith("burn", "5");
  });

  it("locks repeat burns while a burn is in flight", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ isBurning: true })} dispatch={dispatch} />);

    const primary = container.querySelector(".burn-scene__brazier") as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
  });

  it("exposes a settle action when the season needs settling", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ needsSettle: true, seasonPhase: "ended" })} dispatch={dispatch} />,
    );

    const settleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Settle season"),
    );
    expect(settleBtn).toBeTruthy();
    fireEvent.click(settleBtn!);
    expect(dispatch).toHaveBeenCalledWith("settle");
  });

  it("renders the leaderboard inside the drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          leaderboardPreview: [
            { address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa", burned: 12, rank: 1, isUser: true },
            { address: "NOtherAddr0123456789", burned: 5, rank: 2 },
          ],
        })}
        dispatch={vi.fn()}
      />,
    );

    // Open the drawer.
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.textContent).toContain("12.00 GAS");
  });

  it("shows prepaid-credit withdrawal inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ prepaidCredit: 2.5 })} dispatch={dispatch} />,
    );

    // Withdraw is a secondary action (visible in the rail).
    const withdrawBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Withdraw credit"),
    );
    expect(withdrawBtn).toBeTruthy();
    fireEvent.click(withdrawBtn!);
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("celebrates a win when lastSettleResult arrives", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ lastSettleResult: { won: true, amount: "15.00 GAS", token: 12345 } })}
        dispatch={vi.fn()}
      />,
    );

    const modal = container.querySelector(".burn-celebrate");
    expect(modal).toBeTruthy();
    expect(container.querySelector(".burn-celebrate__medal img")).toBeTruthy();
    expect(container.querySelector(".burn-celebrate__icon")).toBeNull();
    expect(container.textContent).toContain("You won!");
    expect(container.textContent).toContain("15.00 GAS");
    expect(container.textContent).not.toContain("🔥");
  });

  it("keeps motion backed by reduced-motion fallbacks", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const styles = fs.readFileSync(
      path.join(appsRoot(), "burn-league/src/PlayArea.scss"),
      "utf8",
    );
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
  });

  it("does not regress to CSS-drawn flame/cauldron art", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const styles = fs.readFileSync(
      path.join(appsRoot(), "burn-league/src/PlayArea.scss"),
      "utf8",
    );
    expect(styles).not.toContain(".burn-scene__flame");
    expect(styles).not.toContain(".burn-scene__cauldron");
    expect(styles).not.toContain(".burn-scene__ember");
  });

  it("keeps the arena background clean so controls and burn target own the foreground", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const styles = fs.readFileSync(
      path.join(appsRoot(), "burn-league/src/PlayArea.scss"),
      "utf8",
    );
    const tokens = fs.readFileSync(
      path.join(appsRoot(), "shared/styles/v2/_tokens.scss"),
      "utf8",
    );

    expect(tokens).toMatch(/--mx2-scene-bg:\s*#ffffff/);
    expect(styles).toMatch(/burn-scene\s*\{[\s\S]*background:\s*#fff8ed/);
    expect(styles).toMatch(/burn-scene__arena-image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/burn-league-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/burn-scene__arena-image\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/burn-scene__shade\s*\{[\s\S]*linear-gradient/);
    expect(styles).not.toMatch(/burn-scene__wash|var\(--mx2-scene-art-opacity/);
    expect(styles).toMatch(/burn-scene__readout[\s\S]*display:\s*none/);
    expect(styles).toMatch(/burn-scene__brazier\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/burn-scene__brazier\s*\{[\s\S]*min-height:\s*286px/);
    expect(styles).not.toMatch(/burn-scene__brazier-art\s*\{/);
    expect(styles).toMatch(/burn-scene__brazier-scrim[\s\S]*display:\s*block/);
    expect(styles).toMatch(/burn-scene__torch-medal[\s\S]*width:\s*64px/);
    expect(styles).toMatch(/burn-celebrate__medal\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/burn-celebrate__medal img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/burn-celebrate__medal img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/burn-celebrate__medal img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/burn-celebrate__medal::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).not.toMatch(/burn-celebrate__medal img\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/burn-celebrate__medal img\s*\{[^}]*filter:\s*saturate/);
    expect(styles).not.toMatch(/burn-celebrate__medal::after\s*\{[^}]*rgba\(17,\s*24,\s*39/);
    expect(styles).toMatch(/burn-scene__meter[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/burn-controls__dock[\s\S]*grid-template-columns:\s*minmax\(148px,\s*0\.58fr\)/);
    expect(styles).toMatch(/burn-preset[\s\S]*min-height:\s*66px/);
    expect(styles).not.toMatch(/burn-preset[\s\S]*min-height:\s*62px/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).toMatch(/burn-scene__stat,[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/);
    expect(styles).toMatch(/burn-controls__stepper[\s\S]*background:\s*#fff8ed/);
    expect(styles).toMatch(/burn-league-play-area\.mx2\.mx2-cat-game[\s\S]*burn-scene__brazier-copy > span[\s\S]*color:\s*#b45309/);
    expect(styles).toMatch(/burn-scene__brazier-scrim\s*\{[\s\S]*bottom:\s*20px/);
    expect(styles).toMatch(/burn-scene__brazier-scrim\s*\{[\s\S]*height:\s*126px/);
    expect(styles).toMatch(/burn-league-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/burn-league-play-area \.mx2-action-rail__row\s*\{[\s\S]*justify-content:\s*center/);
    expect(styles).toMatch(/burn-league-play-area \.mx2-action-rail__drawer-toggle\s*\{[\s\S]*min-width:\s*176px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*burn-scene\s*\{[\s\S]*min-height:\s*540px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*burn-scene__hud\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*burn-scene__brazier\s*\{[\s\S]*min-height:\s*236px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*burn-scene__status\s*\{[\s\S]*-webkit-line-clamp:\s*2/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*burn-controls__presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*burn-league-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*display:\s*none/);
  });
});
