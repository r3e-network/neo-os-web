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

vi.mock("@framework/phaser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@framework/phaser")>();
  return {
    ...actual,
    PhaserGameComponent: (props: unknown) => {
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
    needsSettle: false,
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
      state: Record<string, unknown>;
    };

    expect(props.state.seasonPhase).toBe("active");
    expect(props.state.prizePoolDisplay).toBe("12.50 GAS");
    expect(props.state.userBurnedDisplay).toBe("5.00 GAS");
    expect(props.state.formattedRank).toBe("2");
    expect(props.state.countdown).toBe("00:01:30");
    expect(props.state.burnAmount).toBe("5");
    expect(props.state.needsSettle).toBe(false);
    expect(props.state.formattedSeason).toBe("#7");
    expect(props.state.seasonDurationLabel).toBe("2 min");
    expect(props.state.leaderLabel).toBe("Ntop1111111111111111111111111111111");
    expect(props.state.topBurnedDisplay).toBe("9.50 GAS");
    expect(props.state.prepaidCreditDisplay).toBe("0.00 GAS");
    expect(props.state.minBurnGas).toBe(1);
    expect(props.state.maxBurnGas).toBe(1000);
    expect(props.state.leaderboardPreview).toEqual([
      { address: "Ntop1111111111111111111111111111111", burned: 9.5, rank: 1, isUser: false },
      { address: "Nme22222222222222222222222222222222", burned: 5, rank: 2, isUser: true },
    ]);
  });

  it("exposes settle and withdraw actions outside the Phaser canvas only when relevant", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ needsSettle: true, prepaidCredit: 2.5 })}
        dispatch={dispatch}
      />,
    );

    Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Settle season"))
      ?.click();
    getByText("Withdraw credit").click();

    expect(dispatch).toHaveBeenCalledWith("settle");
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
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

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelector(".burn-drawer__summary")?.textContent).toContain("Season #7");
    expect(container.querySelector(".burn-drawer__summary")?.textContent).toContain("Prize pool");
    expect(container.querySelector(".burn-drawer__leaderboard")?.textContent).toContain("9.50 GAS");
    expect(container.querySelector(".burn-drawer__leaderboard")?.textContent).toContain("You burned");
    expect(container.querySelector(".burn-drawer__steps")?.textContent).toContain("Pick a fuel capsule");
    expect(container.querySelector(".burn-drawer__credit")?.textContent).toContain("2.50 GAS");

    const drawerWithdraw = container.querySelector(".burn-drawer__credit button") as HTMLButtonElement;
    fireEvent.click(drawerWithdraw);
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
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

    expect(source).toContain("burn-drawer__leaderboard");
    expect(source).toContain("burn-drawer__steps");
    expect(source).toContain("lastSettleResult");
    expect(source).not.toContain("drawer={{ children: <p>{t(\"howItWorks\")}</p> }}");
  });
});
