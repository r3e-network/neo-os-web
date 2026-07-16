import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { createObservable, type ObservableState } from "../react/context";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => {
  return {
    LazyPhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="burn-league-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../burn-league/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string) {
  const messages: Record<string, string> = {
    arenaAlt: "Golden Burn League arena",
    burnArenaLoading: "Opening Burn League arena",
    burnConnectAction: "Connect wallet",
    burnConnectingAction: "Connecting...",
    burnIgniteAction: "Review burn",
    burnConfirmAction: "Confirm burn",
    burnRecheckAction: "Check transaction",
    burnCheckingAction: "Checking...",
    burnCheckingTitle: "Verifying chain result",
    burnConfirmTitle: "Confirm irreversible burn",
    burnInsufficientHint: "Insufficient GAS",
    burnPresets: "Fuel capsules",
    closeDrawer: "Close league drawer",
    burned: "Burned",
    burning: "Burning...",
    celebrationDismiss: "Done",
    currentLeader: "Current leader",
    howItWorks: "Burn GAS into the live season. Highest burner wins the pool.",
    howStepBurn: "Burn GAS into the on-chain season.",
    howStepClimb: "Climb the leaderboard before the timer ends.",
    howStepPick: "Pick a fuel capsule inside the arena.",
    howStepWin: "The top burner wins the pool.",
    leaderboard: "Leaderboard",
    liveLeague: "Live league",
    noEntries: "No leaderboard entries yet.",
    noLeaderYet: "No burns yet",
    prepaidCreditHint: "Unused GAS can be reused or withdrawn.",
    prepaidCreditLabel: "Prepaid credit",
    prizePool: "Prize pool",
    projectedTotal: "Projected total",
    readyToBurn: "Core armed",
    seasonDormantHint: "No active season yet.",
    seasonDormantHintWithLength: "No active season yet.",
    seasonEndedHint: "Settle to award the pool.",
    seasonEndsIn: "Ends in",
    seasonLabel: "Season",
    seasonLengthLabel: "Season length",
    seasonStatus: "Season status",
    settleSeason: "Settle season",
    settleDoneBody: "The pool was awarded.",
    settleDoneTitle: "Season settled",
    settleSuccess: "Season settled.",
    settleWinBody: "The pool is yours.",
    settleWinTitle: "You won!",
    subtitle: "Ignite the arena and climb the pool.",
    withdrawCredit: "Withdraw credit",
    youBurned: "You burned",
    youLeadBadge: "You lead",
    yourRank: "Your rank",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    seasonPhase: "active",
    prizePoolDisplay: "12.50 GAS",
    userBurnedDisplay: "5.00 GAS",
    formattedRank: "2",
    countdown: "00:01:30",
    burnAmount: "5",
    isBurning: false,
    isSettling: false,
    isLoading: false,
    isConnectingWallet: false,
    needsSettle: false,
    leagueDataAvailable: true,
    walletConnected: true,
    walletGasBalance: "100",
    burnConfirmArmed: false,
    burnConfirmAmount: "",
    burnTransactionState: "idle",
    hasUnknownBurn: false,
    formattedSeason: "#7",
    leaderboardPreview: [
      { address: "Ntop1111111111111111111111111111111", burned: 9.5, rank: 1, isUser: false },
      { address: "Nme22222222222222222222222222222222", burned: 5, rank: 2, isUser: true },
    ],
    serviceNotice: "",
    actionNotice: "",
    burnValidationError: "",
    seasonStatusLabel: "Live now",
    seasonDurationLabel: "2 min",
    leaderLabel: "Ntop1111111111111111111111111111111",
    topBurnedDisplay: "9.50 GAS",
    projectedTotalBurnedDisplay: "10.00 GAS",
    minBurnGas: 1,
    maxBurnGas: 1000,
    prepaidCredit: 0,
    prepaidCreditDisplay: "0.00 GAS",
    userIsLeader: false,
    lastSettleResult: null,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

describe("burn-league Phaser playarea", () => {
  it("passes live contest state into the production Phaser arena bridge", () => {
    render(<PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("burn-phaser-canvas");
    expect(props.ariaLabel).toBe("Golden Burn League arena");
    expect(props.loadingLabel).toBe("Opening Burn League arena");
    expect(props.state.seasonPhase).toBe("active");
    expect(props.state.prizePoolDisplay).toBe("12.50 GAS");
    expect(props.state.userBurnedDisplay).toBe("5.00 GAS");
    expect(props.state.formattedRank).toBe("2");
    expect(props.state.countdown).toBe("00:01:30");
    expect(props.state.burnAmount).toBe("5");
    expect(props.state.needsSettle).toBe(false);
    expect(props.state.leagueDataAvailable).toBe(true);
    expect(props.state.formattedSeason).toBe("#7");
    expect(props.state.seasonDurationLabel).toBe("2 min");
    expect(props.state.leaderLabel).toBe("Ntop1111111111111111111111111111111");
    expect(props.state.topBurnedDisplay).toBe("9.50 GAS");
    expect(props.state.prepaidCreditDisplay).toBe("0.00 GAS");
    expect(props.state.walletConnected).toBe(true);
    expect(props.state.walletGasBalance).toBe("100");
    expect(props.state.burnConfirmArmed).toBe(false);
    expect(props.state.hasUnknownBurn).toBe(false);
    expect(props.state.minBurnGas).toBe(1);
    expect(props.state.maxBurnGas).toBe(1000);
    expect(props.state.leaderboardPreview).toEqual([
      { address: "Ntop1111111111111111111111111111111", burned: 9.5, rank: 1, isUser: false },
      { address: "Nme22222222222222222222222222222222", burned: 5, rank: 2, isUser: true },
    ]);
  });

  it("mirrors the in-arena settle action for keyboard users while withdraw stays in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({ needsSettle: true, prepaidCredit: 2.5 })}
        dispatch={dispatch}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.needsSettle).toBe(true);
    expect(props.state.settleAction).toBe("Settle season");
    const semanticSettle = container.querySelector(".burn-a11y-primary") as HTMLButtonElement;
    expect(semanticSettle.textContent).toContain("Settle season");
    expect(semanticSettle.disabled).toBe(false);
    fireEvent.click(semanticSettle);
    expect(dispatch).toHaveBeenCalledWith("settle");

    fireEvent.click(container.querySelector(".burn-stage-hud__drawer") as Element);
    const drawerWithdraw = container.querySelector(".burn-drawer__credit button") as HTMLButtonElement;
    fireEvent.click(drawerWithdraw);

    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("exposes fuel and burn as semantic canvas twins without a form UI", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    const presets = getByRole("radiogroup", { name: "Fuel capsules" });
    const selected = presets.querySelector('[role="radio"][aria-checked="true"]') as HTMLButtonElement;
    expect(selected.getAttribute("aria-label")).toBe("Fuel capsules: 5");
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    expect(dispatch).toHaveBeenCalledWith("setBurnAmount", "10");

    const primary = container.querySelector(".burn-a11y-primary") as HTMLButtonElement;
    expect(primary.disabled).toBe(false);
    fireEvent.click(primary);
    expect(dispatch).toHaveBeenCalledWith("burn", "5");
    expect(container.querySelector("form,input,textarea,select")).toBeNull();
  });

  it("closes the in-game drawer with Escape and restores trigger focus", () => {
    const { container } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn().mockResolvedValue(undefined)} />,
    );
    const trigger = container.querySelector(".burn-stage-hud__drawer") as HTMLButtonElement;
    fireEvent.click(trigger);
    expect(container.querySelector(".burn-ingame-drawer")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".burn-ingame-drawer")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the production shell game-led with score hierarchy instead of a bare instruction panel", () => {
    const { container } = render(
      <PhaserPlayArea t={t} state={state({ userIsLeader: true })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector('[data-testid="burn-league-phaser-host"]')).toBeTruthy();
    expect(container.textContent).toContain("Prize pool");
    expect(container.textContent).toContain("12.50 GAS");
    expect(container.textContent).toContain("You burned");
    expect(container.textContent).toContain("Current leader");
    expect(container.textContent).toContain("You lead");
    expect(container.querySelector(".burn-stage-shell")).toBeTruthy();
    expect(container.querySelector(".burn-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail__drawer-toggle")).toBeNull();
    expect(container.querySelector(".burn-drawer")).toBeNull();
  });

  it("renders leaderboard, rules, and prepaid-credit recovery inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({ prepaidCredit: 2.5, prepaidCreditDisplay: "2.50 GAS" })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".burn-stage-hud__drawer") as Element);

    expect(container.querySelector(".burn-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".burn-drawer__summary")?.textContent).toContain("Season #7");
    expect(container.querySelector(".burn-drawer__summary")?.textContent).toContain("Prize pool");
    expect(container.querySelector(".burn-drawer__leaderboard")?.textContent).toContain("9.50 GAS");
    expect(container.querySelector(".burn-drawer__leaderboard")?.textContent).toContain("You burned");
    expect(container.querySelector(".burn-drawer__steps")?.textContent).toContain("Pick a fuel capsule");
    expect(container.querySelector(".burn-drawer__credit")?.textContent).toContain("2.50 GAS");

    const drawerWithdraw = container.querySelector(".burn-drawer__credit button") as HTMLButtonElement;
    fireEvent.click(drawerWithdraw);
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");

    fireEvent.click(
      container.querySelector('[aria-label="Close league drawer"]') as HTMLButtonElement,
    );
    expect(container.querySelector(".burn-ingame-drawer")).toBeNull();
  });

  it("surfaces settle completion with a dismissible production feedback state", () => {
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({ lastSettleResult: { won: true, amount: "12.50 GAS", token: 101 } })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".burn-celebrate")).toBeTruthy();
    expect(container.textContent).toContain("You won!");
    expect(container.textContent).toContain("12.50 GAS");
    fireEvent.click(
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Done"))!,
    );
    expect(container.querySelector(".burn-celebrate")).toBeNull();
  });

  it("keeps the production Phaser wrapper from regressing to a one-line drawer", () => {
    const source = fs.readFileSync(path.join(appsRoot(), "burn-league/src/PhaserPlayArea.tsx"), "utf8");
    const styles = fs.readFileSync(path.join(appsRoot(), "burn-league/src/PlayArea.scss"), "utf8");

    expect(source).toContain("burn-drawer__leaderboard");
    expect(source).toContain("burn-drawer__steps");
    expect(source).toContain("burn-stage-shell");
    expect(source).toContain("burn-stage-hud");
    expect(source).toContain("burn-ingame-drawer");
    expect(source).toContain("lastSettleResult");
    expect(source).toContain("actions={{}}");
    expect(source).toContain("burn-a11y-layer");
    expect(source).toContain("leagueDataAvailable");
    expect(source).toContain("MiniAppRoot already displayed the action failure");
    expect(source).toContain("settleAction: t(\"settleSeason\")");
    expect(source).not.toContain("score={");
    expect(source).not.toContain("drawerToggleLabel=");
    expect(source).not.toContain("drawer={{");
    expect(source).not.toContain("drawer={{ children: <p>{t(\"howItWorks\")}</p> }}");
    expect(source).not.toContain("secondary: [");
    expect(source).not.toContain("dispatch(\"settle\")");
    expect(styles).toContain("width: min(100%, 420px);");
  });

  // Migrated from the deleted burn-league.playarea.test.tsx, which asserted this
  // same reduced-motion contract against the unmounted DOM PlayArea.tsx. The
  // stylesheet is live (PhaserPlayArea imports it), so the contract is real —
  // only the classes it must cover changed. The dead `.burn-scene__*` /
  // `.burn-controls__*` rules went with the component; the fallback now has to
  // name the classes the production wrapper actually paints, otherwise the
  // guard would pass over CSS no user can reach.
  it("keeps motion backed by reduced-motion fallbacks on the live wrapper's classes", () => {
    const styles = fs.readFileSync(path.join(appsRoot(), "burn-league/src/PlayArea.scss"), "utf8");

    expect(styles).toContain('@use "@shared/styles/v2/motion"');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/,
    );
    const reduced = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const live of [".burn-ingame-drawer", ".burn-stage-hud__drawer", ".burn-celebrate__medal"]) {
      expect(reduced, `${live} must keep a reduced-motion fallback`).toContain(live);
    }
  });

  // Pins the deletion: main.tsx mounts PhaserPlayArea, so a reintroduced DOM
  // PlayArea.tsx would be unreachable code that only tests could "cover".
  it("keeps the legacy unmounted DOM play area deleted", () => {
    expect(fs.existsSync(path.join(appsRoot(), "burn-league/src/PlayArea.tsx"))).toBe(false);
    const styles = fs.readFileSync(path.join(appsRoot(), "burn-league/src/PlayArea.scss"), "utf8");
    expect(styles).not.toMatch(/\.burn-scene|\.burn-controls|\.burn-stepper|\.burn-preset/);
  });

  it("keeps Burn League settlement wired to the in-canvas primary action", () => {
    const scene = fs.readFileSync(path.join(appsRoot(), "burn-league/src/scenes/BurnLeagueScene.ts"), "utf8");

    expect(scene).toContain(
      'private primaryAction: "connect" | "burn" | "settle" | "recheck"',
    );
    expect(scene).toContain("enabled: () => this.canPrimaryAction()");
    expect(scene).toContain('this.dispatch("connectWallet")');
    expect(scene).toContain('this.dispatch("recheckBurn")');
    expect(scene).toContain('this.dispatch("settle")');
    expect(scene).toContain("private canPrimaryAction()");
    expect(scene).toContain("protected onReducedMotionChange");
    expect(scene).toContain("this.boardRowWidth");
    expect(scene).toContain("The first GameFi press only arms");
  });
});
