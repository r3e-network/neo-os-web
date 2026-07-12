import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gas-sponsor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string) { return key; }
function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

const LIVE_POOL = {
  id: "42",
  sponsor: "0x1111111111111111111111111111111111111111",
  poolType: 1,
  initialAmountRaw: "100000000",
  remainingAmountRaw: "75000000",
  maxClaimPerUserRaw: "10000000",
  totalClaimedRaw: "25000000",
  claimCount: 5,
  createTimeMs: Date.now() - 60_000,
  expiryTimeMs: Date.now() + 3_600_000,
  active: true,
  description: "Public community refill",
  status: "active",
  isMine: false,
};

function liveState(extra: Partial<Record<string, unknown>> = {}) {
  return state({
    mode: "browse",
    network: "testnet",
    contractHash: "0x31888679572bf2de61462ff9934b6265d60284f2",
    platformStats: {
      totalPools: 42,
      activePools: 1,
      totalSponsoredRaw: "3600000000",
      totalClaimedRaw: "180000000",
      totalBeneficiaries: 5,
      defaultExpiryMs: "2592000",
    },
    pools: [LIVE_POOL],
    selectedPoolId: "42",
    selectedPool: LIVE_POOL,
    walletAddress: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    walletGasBalanceFixed8: "200000000",
    walletGasBalanceKnown: true,
    userClaimedFixed8: "0",
    userClaimedKnown: true,
    selectedPoolClaimAvailableRaw: "10000000",
    selectedPoolIsMine: false,
    claimAmount: "0.05",
    createAmount: "1",
    createMaxClaim: "0.05",
    createDescription: "Community GAS refill",
    topUpAmount: "0.5",
    extendDurationMs: String(86_400_000),
    canClaim: true,
    canCreate: true,
    canTopUp: false,
    canWithdraw: false,
    canExtend: false,
    hasMorePools: false,
    poolsLoading: false,
    selectedPoolLoading: false,
    actionBusy: false,
    pendingOperation: null,
    outcome: { status: "idle" },
    ...extra,
  });
}

describe("gas-sponsor on-chain station PlayArea", () => {
  it("makes the real pool and refill-station asset the primary surface", () => {
    const { container } = render(<PlayArea t={t} state={liveState()} dispatch={vi.fn()} />);

    expect(container.querySelector(".mx2-cat-defi")).toBeTruthy();
    expect(container.querySelector(".sponsor-hero")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".sponsor-hero__art")?.src).toContain("gas-sponsor-refill-station.webp");
    expect(container.querySelector(".sponsor-hero__amount")?.textContent).toContain("0.75");
    expect(container.querySelector(".sponsor-fuel-progress")?.getAttribute("value")).toBe("75");
    expect(container.querySelector(".sponsor-pool-chip[data-selected='true']")).toBeTruthy();
    expect(container.querySelector(".sponsor-hero input")).toBeNull();
    expect(container.textContent).not.toMatch(/⛽|🛢️|🎁/);
  });

  it("dispatches pool selection and the single primary claim action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={liveState()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".sponsor-pool-chip") as Element);
    fireEvent.click(screen.getByText("claimGas"));

    expect(dispatch).toHaveBeenCalledWith("selectPool", "42");
    expect(dispatch).toHaveBeenCalledWith("claimPool");
  });

  it("keeps exact values in the secondary drawer", () => {
    const appState = liveState();
    const { container } = render(<PlayArea t={t} state={appState} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByText("details"));
    fireEvent.click(screen.getByText("drawerTune"));

    const input = container.querySelector(".sponsor-tune-grid input") as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: "0.025" } });
    expect(appState.claimAmount?.get()).toBe("0.025");
  });

  it("uses a visual sponsor plan instead of a create-pool parameter wall", () => {
    const appState = liveState({ mode: "create" });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={vi.fn()} />);

    expect(container.querySelector(".sponsor-create-scene__art")).toBeTruthy();
    expect(container.querySelectorAll(".sponsor-plan-field")).toHaveLength(2);
    expect(container.querySelectorAll(".sponsor-plan-field__group .semi-radio")).toHaveLength(6);
    expect(container.querySelector(".sponsor-create-scene input:not([type='radio'])")).toBeNull();
    expect(screen.getByText("openPool")).toBeTruthy();
  });

  it("browses pools before wallet connection and asks for wallet only at action time", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={liveState({ walletAddress: "" })} dispatch={dispatch} />);

    expect(container.querySelector(".sponsor-pool-chip")).toBeTruthy();
    fireEvent.click(screen.getByText("connectWallet"));
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("turns an empty live station into one clear sponsor journey", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={liveState({ pools: [], selectedPool: null, selectedPoolId: "", platformStats: { totalPools: 0, activePools: 0 } })} dispatch={dispatch} />);

    expect(screen.getByText("noActivePools")).toBeTruthy();
    fireEvent.click(screen.getByText("startSponsorPool"));
    expect(dispatch).toHaveBeenCalledWith("setMode", "create");
  });

  it("keeps sponsor-only lifecycle controls behind the details drawer", () => {
    const mine = { ...LIVE_POOL, isMine: true };
    const { container } = render(<PlayArea t={t} state={liveState({ mode: "manage", selectedPool: mine, selectedPoolIsMine: true, canTopUp: true, canWithdraw: true, canExtend: true })} dispatch={vi.fn()} />);

    expect(container.querySelector(".sponsor-manage-controls")).toBeNull();
    fireEvent.click(screen.getByText("details"));
    fireEvent.click(screen.getByText("drawerManage"));
    expect(container.querySelector(".sponsor-manage-controls")).toBeTruthy();
    expect(screen.getByText("reviewWithdraw")).toBeTruthy();
  });

  it("uses lightweight semantic controls and responsive/reduced-motion styles", () => {
    const fs = require("node:fs");
    const source = fs.readFileSync(`${process.cwd()}/../gas-sponsor/src/PlayArea.tsx`, "utf8");
    const styles = fs.readFileSync(`${process.cwd()}/../gas-sponsor/src/PlayArea.scss`, "utf8");

    expect(source).toContain("OpenUiLiteSegmented");
    expect(source).toContain("OpenUiLiteTextField");
    expect(source).toContain("gas-sponsor-refill-station.webp");
    expect(source).toContain("<progress");
    expect(source).not.toContain("OpenUiProvider");
    expect(source).not.toContain("<svg");
    expect(styles).toMatch(/@media \(max-width:\s*640px\)/);
    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).toMatch(/\.sponsor-hero__card[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.96\)/);
    expect(styles).toMatch(/\.gas-sponsor-play-area \.mx2-action-rail__row \.mx2-btn--primary[\s\S]*max-width:\s*210px/);
  });
});
