import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../daily-checkin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const WALLET = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";

afterEach(() => cleanup());

function t(key: string) {
  return key;
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults: Record<string, unknown> = {
    network: "mainnet",
    contractHash: "0x25db219a701a2b23130788723fcf9a2e76857235",
    dataSource: "chain",
    currentStreak: "—",
    highestStreak: "—",
    unclaimedRewards: "—",
    totalClaimed: "—",
    checkInFee: "0.001 GAS",
    rewardPoolBalance: "1.002 GAS",
    weekRewardLabel: "0.01 GAS",
    twoWeekRewardLabel: "0.02 GAS",
    checkinHistory: [],
    pendingOperation: null,
  };
  return Object.fromEntries(
    Object.entries({ ...defaults, ...values }).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function primary(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
  expect(button).not.toBeNull();
  return button!;
}

describe("Daily Check-in primary ritual dispatch", () => {
  it("connects a wallet before exposing user-specific streak actions", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(primary(container).textContent).toContain("connectWallet");
    fireEvent.click(primary(container));
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("uses check-in as the one primary action only after chain eligibility is known", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: WALLET,
          hasLoadedStatus: true,
          hasLoadedPlatform: true,
          canCheckIn: true,
          currentStreak: "6 days",
          highestStreak: "8 days",
          currentStreakRaw: 6,
          nextUtcMidnight: Date.now() + 86_400_000,
        })}
        dispatch={dispatch}
      />,
    );

    expect(primary(container).textContent).toContain("checkInNow");
    fireEvent.click(primary(container));
    expect(dispatch).toHaveBeenCalledWith("doCheckIn");
  });

  it("offers a confirmed reward claim after today's check-in is locked", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: WALLET,
          hasLoadedStatus: true,
          hasLoadedPlatform: true,
          canCheckIn: false,
          hasClaimableRewards: true,
          claimableButUnfunded: false,
          currentStreak: "7 days",
          highestStreak: "7 days",
          currentStreakRaw: 7,
          unclaimedRewards: "0.01 GAS",
          nextUtcMidnight: Date.now() + 3_600_000,
        })}
        dispatch={dispatch}
      />,
    );

    expect(primary(container).textContent).toContain("claimRewards");
    fireEvent.click(primary(container));
    expect(dispatch).toHaveBeenCalledWith("claimRewards");
  });

  it("makes durable transaction recovery the primary action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: WALLET,
          pendingOperation: { kind: "checkin", txid: `0x${"ab".repeat(32)}` },
          transactionNotice: "transactionPending",
        })}
        dispatch={dispatch}
      />,
    );

    expect(primary(container).textContent).toContain("checkConfirmation");
    fireEvent.click(primary(container));
    expect(dispatch).toHaveBeenCalledWith("recoverPending");
  });

  it("requires the original wallet to reconnect before pending recovery", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          pendingOperation: { kind: "claim", txid: `0x${"cd".repeat(32)}` },
          transactionNotice: "pendingWalletCheck",
        })}
        dispatch={dispatch}
      />,
    );

    expect(primary(container).textContent).toContain("reconnectToRecover");
    fireEvent.click(primary(container));
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });
});
