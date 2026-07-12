import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../profitanchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

const t = (key: string, params?: Record<string, string | number>) =>
  params ? Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), key) : key;

function state(overrides: Record<string, unknown> = {}): ObservableState {
  const values = {
    network: "testnet",
    contract: "0xab079b4f9a0a2471d136392e25eb8e99898dcad0",
    readStatus: "ready",
    stats: {
      mode: "2", totalStaked: "40", totalStakers: "3", rewardPerNeo: "0",
      rewardReserve: "250000000", agentCount: "21", selectedAgentId: "1", paused: false,
    },
    user: { walletHash: `0x${"22".repeat(20)}`, stake: "8", pendingRewards: "150000000", neoCredit: "0" },
    pendingTransaction: null,
    history: [],
    actionStatus: "transactionIdle",
    actionError: "",
    readError: "",
    diagnosticError: "",
    storageHealthy: true,
    submitting: false,
    confirmationChecking: false,
    walletAddress: `0x${"22".repeat(20)}`,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

describe("profitanchor production PlayArea integration", () => {
  it("sends the selected whole-NEO plan through the single primary stake action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const preset = Array.from(container.querySelectorAll<HTMLButtonElement>(".profit-amount-deck button"))
      .find((button) => button.textContent?.includes("5"));
    fireEvent.click(preset as HTMLButtonElement);
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(container.querySelectorAll(".mx2-btn--primary")).toHaveLength(1);
    fireEvent.click(primary as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("stakeNeo", { amount: "5" });
  });

  it("keeps redeem and claim in the secondary drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    fireEvent.click(container.querySelector(".profit-secondary-action") as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("withdrawNeo", { amount: "1" });
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>(".profit-drawer__nav button")[1]);
    fireEvent.click(container.querySelector(".profit-secondary-action") as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("claimRewards");
  });
});
