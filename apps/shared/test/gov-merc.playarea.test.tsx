import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gov-merc/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    actionsTitle: "Your actions",
    activeBids: "Active bids",
    bidAmount: "Bid amount",
    bidLaneCopy: "Bid GAS for the influence title.",
    bidLaneTitle: "Compete with GAS",
    bidLeaderboard: "Bid Leaderboard",
    bidWindowTitle: "Bidding window",
    bidWindowUnopened: `First bid opens a ${params?.minutes ?? 5}-minute window`,
    connectAction: "Connect wallet",
    connectCopy: "Connect a wallet to take part.",
    connectTitle: "Connect your Neo wallet",
    currentEpoch: "Current epoch",
    depositAmount: "Stake amount",
    depositNeo: "Stake NEO",
    earnLaneCopy: "Stake NEO for yield.",
    earnLaneTitle: "Earn with NEO",
    emptyBidCopy: "The first GAS bid becomes the market signal.",
    emptyBidTitle: "No active bids yet",
    executionPath: "Execution path",
    executionPathCopy: "On-chain contract",
    flowBid: "Run GAS auction",
    flowBidCopy: "Mercenaries bid GAS for influence.",
    flowDeposit: "Stake NEO for yield",
    flowDepositCopy: "Stakers share the auction revenue.",
    flowInfluence: "Settle and pay stakers",
    flowInfluenceCopy: "Settlement records the winner.",
    flowTitle: "Epoch flow",
    govHeroGrant: "Winning records an influence holder on-chain.",
    govHeroSubtitle: "Stake NEO and bid GAS in each epoch.",
    govHeroTitle: "Governance Influence Auction",
    influenceUseCopy: "The contract records the title and pays stakers.",
    influenceUseTitle: "How influence is used",
    lastDistributed: "Last GAS to stakers",
    marketPlateEpoch: `Epoch #${params?.epoch ?? 0}`,
    marketPlateLabel: "Live influence round",
    marketPlateTopBid: `Top bid: ${params?.amount ?? "0"} ${params?.tokenGas ?? "GAS"}`,
    marketRouting: "Routing transaction",
    marketReady: "Ready",
    marketSignalTitle: "Neo N3 governance desk",
    minBidLabel: "Minimum first bid",
    noBids: "No bids yet",
    placingBid: "Routing GAS bid...",
    placeBid: "Place Bid",
    reclaimCopy: "Reclaim losing bids.",
    reclaimEmpty: "No losing bids to reclaim",
    reclaimTitle: "Reclaim bids",
    rewardsCopy: "NEO stakers earn GAS auction revenue.",
    rewardsEmptyHint: "Stake NEO to start earning rewards.",
    rewardsTitle: "Staker rewards",
    riskNoteCopy: "Review epoch and amount before submitting.",
    riskNoteTitle: "Operator readiness",
    riskNoteToggle: "Contract and settlement details",
    settleAction: "Settle epoch",
    settleCopy: "Settle the live epoch.",
    settleLastLabel: "Last settled",
    settleNoBidsHint: "Place at least one GAS bid.",
    settleNone: "No epoch settled yet",
    settlingEpoch: "Settling epoch...",
    settleTitle: "Settle epoch",
    settlementWindow: "Settlement window",
    stakedBalanceLabel: "Your staked balance",
    tokenGas: "GAS",
    tokenLegendGas: "GAS - bid for title",
    tokenLegendNeo: "NEO - stake for yield",
    tokenLegendTitle: "Two tokens, two roles",
    tokenNeo: "NEO",
    tokenTagBid: "Paid in GAS",
    tokenTagStake: "Staked in NEO",
    totalPool: "Total Pool",
    walletStatusIdle: "Wallet not connected",
    withdrawCredit: "Withdraw unused credit",
    withdrawDrawerTitle: "Unstake or adjust NEO",
    withdrawNeo: "Unstake NEO",
    stakingNeo: "Staking NEO...",
    unstakingNeo: "Unstaking NEO...",
    connectingWallet: "Connecting wallet...",
    yourDeposits: "Your Deposits",
  };
  let message = messages[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.replace(`{${name}}`, String(value));
    }
  }
  return message;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    address: "",
    bidAmount: "",
    bidCount: 0,
    bids: [],
    canSettle: false,
    currentEpoch: 7,
    dataLoading: false,
    depositAmount: "",
    epochDeadline: 0,
    epochDurationMs: 300000,
    gasCredit: 0,
    highestBid: 2.5,
    isBusy: false,
    lastDistributed: 8,
    lastSettlementDisplay: "",
    pendingRewards: 0,
    reclaimableBids: [],
    totalPool: 420,
    userDeposits: 12,
    userDepositsDisplay: "12 NEO",
    withdrawAmount: "",
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Gov Merc PlayArea", () => {
  it("uses a real governance market stage asset instead of the logo as the hero plate", async () => {
    const dispatch = vi.fn(async () => undefined);

    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    expect(
      existsSync(`${process.cwd()}/../gov-merc/public/gov-merc-market-stage.jpg`),
    ).toBe(true);
    expect(container.querySelector(".gov-merc-market-stage")).toBeTruthy();
    expect(
      container.querySelector(
        '.gov-merc-market-stage img[src="./gov-merc-market-stage.jpg"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector('.gov-merc-market-stage img[src="./logo.svg"]'),
    ).toBeFalsy();
    expect(
      container.querySelector(".gov-merc-market-stage__lanes span:first-child")
        ?.textContent,
    ).toBe("NEO");
    expect(
      container.querySelector(".gov-merc-market-stage__lanes span:last-child")
        ?.textContent,
    ).toBe("GAS");
    expect(screen.getByText("Epoch #7")).toBeTruthy();
    expect(screen.getByText("Top bid: 2.50 GAS")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connectWallet"));
    expect(screen.getByRole("button", { name: "Connecting wallet..." })).toBeTruthy();
  });

  it("shows immediate market motion when routing a GAS bid", async () => {
    const dispatch = vi.fn(async () => undefined);

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTestAddressForGovMerc1111111111111",
          bidAmount: "3",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Place Bid" }));

    expect(container.querySelector(".gov-merc-market-stage.is-bidding")).toBeTruthy();
    expect(container.querySelector(".gov-merc-action-card--bid.is-routing")).toBeTruthy();
    expect(container.querySelector(".gov-merc-action-status")?.textContent).toBe(
      "Routing GAS bid...",
    );
    expect(screen.getByRole("button", { name: "Routing GAS bid..." })).toBeTruthy();
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("placeBid"));
  });

  it("keeps the stage responsive and motion-safe", () => {
    const styles = readFileSync(
      `${process.cwd()}/../gov-merc/src/PlayArea.scss`,
      "utf8",
    );
    const actionStyles = readFileSync(
      `${process.cwd()}/../gov-merc/src/components/MercActionCards.scss`,
      "utf8",
    );

    expect(styles).toContain(".gov-merc-market-stage");
    expect(styles).toContain(".gov-merc-market-stage__action");
    expect(styles).toContain("@keyframes gov-merc-stage-drift");
    expect(styles).toContain("@keyframes gov-merc-stage-signal");
    expect(styles).toContain("@keyframes gov-merc-market-route");
    expect(styles).toContain("@keyframes gov-merc-settle-plate");
    expect(styles).toContain("@keyframes gov-merc-action-status");
    expect(actionStyles).toContain("@keyframes gov-merc-card-action-status");
    expect(actionStyles).not.toMatch(/transform:\s*translateY\(-1px\)/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.gov-merc-market-stage[\s\S]*min-height:\s*184px/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.gov-merc-market-stage img[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.gov-merc-market-stage__action[\s\S]*transition:\s*none/,
    );
    expect(actionStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.gov-merc-action-status[\s\S]*animation:\s*none/,
    );
  });
});
