import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gov-merc/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    marketSignalTitle: "Governance market",
    govHeroTitle: "Gov Merc",
    govHeroSubtitle: "Stake NEO, bid GAS for influence.",
    currentEpoch: "Epoch",
    totalPool: "Total staked",
    activeBids: "Bids",
    yourDeposits: "Your stake",
    earnLaneTitle: "Stake NEO",
    bidLaneTitle: "Bid GAS",
    tokenLegendNeo: "NEO stake weight",
    minBidLabel: "Minimum bid",
    bidWindowUnopened: "Window opens on first bid",
    bidWindowCountdown: "Closes in {time}",
    bidWindowClosed: "Bidding closed",
    bidWindowTitle: "Bidding window",
    biddingClosedHint: "Settle before the next bid.",
    connectTitle: "Connect wallet to enter",
    connectCopy: "Connect your wallet to participate.",
    connectAction: "Connect wallet",
    connectingWallet: "Connecting...",
    placeBid: "Place Bid",
    placingBid: "Routing bid...",
    depositNeo: "Stake NEO",
    stakingNeo: "Staking...",
    depositAmount: "NEO amount",
    bidAmount: "GAS amount",
    minBid: "Min bid",
    currentTopBid: "Top bid",
    marketPlateEpoch: "Epoch #{epoch}",
    marketPlateTopBid: "Top bid: {amount} {tokenGas}",
    settleAction: "Settle epoch",
    settleCopy: "Permissionless settlement.",
    bidLeaderboard: "Leaderboard",
    noBids: "No bids yet.",
    rewardsTitle: "Staker rewards",
    pendingRewards: "Pending",
    claimRewards: "Claim rewards",
    reclaimTitle: "Reclaimable bids",
    reclaimBidAmount: "{amount} {tokenGas} from epoch {epoch}",
    reclaimBidLabel: "Reclaim",
    unusedCredit: "Unused credit",
    withdrawCredit: "Withdraw credit",
    withdrawAmount: "NEO to unstake",
    withdrawNeo: "Unstake NEO",
    withdrawDrawerTitle: "Adjust NEO stake",
    riskNoteTitle: "Risk",
    riskNoteCopy: "Bids are non-refundable if you win.",
    flowTitle: "How it works",
    flowDeposit: "Stake NEO",
    flowDepositCopy: "Stake NEO for governance power.",
    flowBid: "Bid GAS",
    flowBidCopy: "Bid GAS for the influence title.",
    flowInfluence: "Distribute yield",
    flowInfluenceCopy: "Settle distributes the bid to stakers.",
    actionBidHint: "Commit at least {min} {tokenGas}.",
    actionDepositHint: "Stake NEO for reward weight.",
    tokenGas: "GAS",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    totalPool: 100,
    currentEpoch: 7,
    bids: [{ address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa", amount: 2.5 }],
    isBusy: false,
    dataLoading: false,
    address: "",
    userDeposits: 0,
    userDepositsDisplay: "0 NEO",
    depositAmount: "",
    withdrawAmount: "",
    bidAmount: "",
    bidCount: 1,
    canSettle: false,
    epochDeadline: 0,
    epochDurationMs: 300000,
    pendingRewards: 0,
    gasCredit: 0,
    reclaimableBids: [],
    highestBid: 2.5,
    lastDistributed: 0,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

describe("Gov Merc PlayArea (v2 scene-driven)", () => {
  it("renders the two-lane market scene with epoch + pool badges", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".merc-scene")).toBeTruthy();
    expect(container.querySelectorAll(".merc-lane").length).toBe(2);
    expect(container.querySelector(".merc-stage-art")).toBeTruthy();
    expect(container.querySelector(".merc-stage-art img")?.getAttribute("src")).toContain("gov-merc-market-stage.webp");
    expect(container.querySelector(".merc-scene__image")).toBeNull();
    expect(container.querySelector(".merc-scene__wash")).toBeNull();
    expect(container.querySelector(".merc-core")).toBeTruthy();
    expect(container.querySelector(".merc-route")).toBeTruthy();
    expect(container.textContent).toContain("#7");
    expect(container.textContent).toContain("100 NEO");
  });

  it("dispatches connectWallet when disconnected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connectWallet"));
  });

  it("dispatches placeBid with bid motion", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ address: "NTestAddr111111111111111111111", bidAmount: "3" })} dispatch={dispatch} />,
    );
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => {
      expect(container.querySelector('.merc-scene[data-state="bid"]')).toBeTruthy();
    });
    expect(dispatch).toHaveBeenCalledWith("placeBid");
  });

  it("lets preset chips fill the bid amount before routing the primary bid", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const appState = state({ address: "NTestAddr111111111111111111111", highestBid: 2.5 });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".merc-deal-card--bid .merc-preset") as Element);
    expect(appState.bidAmount.get()).toBe("2.5");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("placeBid"));
  });

  it("dispatches depositNeo from the controls", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ address: "NTestAddr111111111111111111111", depositAmount: "5" })} dispatch={dispatch} />,
    );
    const depositBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Stake NEO");
    fireEvent.click(depositBtn as Element);
    expect(dispatch).toHaveBeenCalledWith("depositNeo");
  });

  it("keeps NEO stake input whole-number only", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const appState = state({ address: "NTestAddr111111111111111111111" });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);
    const depositInput = container.querySelector(".merc-deal-card--stake input") as HTMLInputElement;

    expect(depositInput.inputMode).toBe("numeric");
    fireEvent.change(depositInput, { target: { value: "7.5" } });
    expect(appState.depositAmount.get()).toBe("7");
    const depositBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Stake NEO");
    fireEvent.click(depositBtn as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("depositNeo"));
  });

  it("dispatches withdrawNeo from the drawer adjustment control", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ address: "NTestAddr111111111111111111111", withdrawAmount: "2" })} dispatch={dispatch} />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(Array.from(container.querySelectorAll(".merc-drawer-tabs button")).find((b) => b.textContent?.includes("Adjust NEO stake")) as Element);
    const withdrawBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Unstake NEO");
    fireEvent.click(withdrawBtn as Element);
    expect(dispatch).toHaveBeenCalledWith("withdrawNeo");
  });

  it("keeps NEO withdraw input whole-number only", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const appState = state({ address: "NTestAddr111111111111111111111" });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(Array.from(container.querySelectorAll(".merc-drawer-tabs button")).find((b) => b.textContent?.includes("Adjust NEO stake")) as Element);
    const withdrawInput = container.querySelector(".merc-amount-field--drawer input") as HTMLInputElement;
    expect(withdrawInput.inputMode).toBe("numeric");
    fireEvent.change(withdrawInput, { target: { value: "3.25" } });

    expect(appState.withdrawAmount.get()).toBe("3");
  });

  it("shows the leaderboard + rewards in the drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          pendingRewards: 1.5,
          lastDistributed: 0.75,
          gasCredit: 0.25,
          reclaimableBids: [{ epoch: 4, amount: 0.5 }],
          address: "NTestAddr111111111111111111111",
        })}
        dispatch={vi.fn()}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelectorAll(".merc-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".merc-drawer h4")).toBeNull();
    expect(container.querySelector(".merc-drawer p")).toBeNull();
    expect(container.querySelector(".merc-drawer__panel-body")?.getAttribute("data-mode")).toBe("bids");
    expect(container.textContent).toContain("2.50 GAS");
    expect(container.textContent).not.toContain("1.5000 GAS");

    fireEvent.click(Array.from(container.querySelectorAll(".merc-drawer-tabs button")).find((b) => b.textContent?.includes("Staker rewards")) as Element);
    expect(container.querySelector(".merc-drawer__panel-body")?.getAttribute("data-mode")).toBe("rewards");
    expect(container.textContent).toContain("1.5000 GAS");
    expect(container.textContent).toContain("0.7500 GAS");
    expect(container.textContent).toContain("0.50 GAS from epoch 4");

    fireEvent.click(Array.from(container.querySelectorAll(".merc-drawer-tabs button")).find((b) => b.textContent?.includes("How it works")) as Element);
    expect(container.querySelector(".merc-drawer__panel-body")?.getAttribute("data-mode")).toBe("guide");
    expect(container.textContent).toContain("Bids are non-refundable if you win.");
  });

  it("exposes settle as a secondary action when the window is closed", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ canSettle: true, epochDeadline: Date.now() - 1000, address: "NTestAddr111111111111111111111" })} dispatch={dispatch} />,
    );
    const settleBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Settle epoch");
    expect(settleBtn).toBeTruthy();
    fireEvent.click(settleBtn as Element);
    expect(dispatch).toHaveBeenCalledWith("settleEpoch");
  });

  it("keeps motion backed by reduced-motion fallbacks", () => {
    const styles = playAreaStyles("gov-merc");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
  });

  it("keeps the governance room as low-noise background behind solid controls", () => {
    const styles = playAreaStyles("gov-merc");

    expect(styles).toMatch(/\.merc-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.merc-stage-art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.merc-stage-art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.merc-stage-art img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.merc-stage-art img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.merc-stage-art::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.merc-core\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).not.toMatch(/merc-scene__image|merc-scene__wash|var\(--mx2-scene-art-opacity|background-image:\s*url/);
    expect(styles).not.toContain("backdrop-filter");
    expect(styles).toMatch(/merc-route[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/merc-deal-card[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.merc-drawer-tabs\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.merc-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.merc-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*18px/);
    expect(styles).toMatch(/\.merc-drawer__panel-body\s*\{[\s\S]*display:\s*grid/);
    expect(styles).not.toContain(".merc-drawer h4");
    expect(styles).not.toContain(".merc-drawer p");
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.merc-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.merc-drawer-tabs strong\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/gov-merc-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 180px/);
  });
});
