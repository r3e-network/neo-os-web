import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gov-merc/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const copy: Record<string, string> = {
    valueUnavailable: "Unavailable",
    dataUnavailableShort: "Data unavailable",
    connectAction: "Connect wallet",
    connectTitle: "Connect to participate",
    connectCompactCopy: "Network and contract are verified before writes.",
    walletStatusIdle: "Wallet not connected",
    chooseRole: "Choose how to participate",
    yourNextMove: "Your next move",
    bidRole: "Bid GAS",
    stakeRole: "Stake NEO",
    placeBid: "Place bid",
    depositNeo: "Stake NEO",
    bidAmount: "Bid amount",
    depositAmount: "Stake amount",
    amountPlaceholderGas: "Amount in GAS",
    amountPlaceholderNeo: "Whole NEO only",
    suggestedAmounts: "Suggested amounts",
    actionBidCompact: "First bid at least {min} GAS.",
    actionStakeCompact: "Whole NEO only.",
    marketPlateTopBid: "Top bid: {amount} {tokenGas}",
    marketPlateEpoch: "Epoch #{epoch}",
    bidWindowUnopened: "First bid opens {minutes} minutes",
    bidWindowCountdown: "Closes in {time}",
    bidWindowClosed: "Ready to settle",
    currentTopBid: "Current top bid",
    totalPool: "Total pool",
    yourDeposits: "Your deposits",
    bidLeaderboard: "Leaderboard",
    marketArtAlt: "Gov Merc market stage",
    marketSignalTitle: "Governance desk",
    govHeroTitle: "Governance Influence Auction",
    govHeroSubtitle: "Stake NEO or bid GAS.",
    details: "Market details",
    reviewBidHint: "Review bid",
    reviewStakeHint: "Review stake",
    transactionPending: "Transaction awaiting confirmation",
    transactionPendingCopy: "Saved as {txid}.",
    checkTransaction: "Check saved transaction",
    recoveryDoesNotResubmit: "Read-only check.",
    pendingShort: "Pending",
    clearShort: "Clear",
    marketDrawer: "Market",
    walletDrawer: "Wallet",
    recoveryDrawer: "Recovery",
    flowTitle: "Flow",
    threeSteps: "3 steps",
  };
  let value = copy[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    totalPool: 100,
    currentEpoch: 4,
    bids: [{ address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs", amount: 2 }],
    address: "",
    userDeposits: 10,
    depositAmount: "",
    withdrawAmount: "",
    bidAmount: "",
    bidCount: 1,
    canSettle: false,
    epochDeadline: 0,
    epochDurationMs: 300_000,
    pendingRewards: 1,
    gasCredit: 0,
    reclaimableBids: [],
    highestBid: 2,
    lastDistributed: 1,
    pendingOperation: null,
    pendingTxid: "",
    transactionStatus: "idle",
    activeAction: "",
    readError: "",
    isBusy: false,
    isRecovering: false,
    marketAvailable: true,
    windowAvailable: true,
    highestBidAvailable: true,
    walletAvailable: true,
    bidsAvailable: true,
    settlementAvailable: true,
    reclaimableAvailable: true,
    storageHealthy: true,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)]));
}

describe("Gov Merc PlayArea production hierarchy", () => {
  it("leads with the real market resource and one connect action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    expect(container.querySelector<HTMLImageElement>(".merc-market-visual > img")?.getAttribute("src"))
      .toBe("gov-merc-market-stage.webp");
    expect(container.querySelectorAll(".mx2-btn--primary")).toHaveLength(1);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("dispatches the selected bid through the single primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const appState = state({ address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs", bidAmount: "2" });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("placeBid"));
  });

  it("preserves fractional NEO input so it is visibly rejected, never truncated", () => {
    const appState = state({ address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector('input[type="radio"][value="stake"]') as Element);
    const amount = container.querySelector<HTMLInputElement>(".merc-ticket input");
    fireEvent.change(amount!, { target: { value: "1.5" } });
    expect(amount?.value).toBe("1.5");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
  });

  it("turns a durable pending record into a read-only recovery primary action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const txid = `0x${"a".repeat(64)}`;
    const pending = {
      version: 1,
      kind: "bid",
      stage: "action",
      eventName: "BidPlaced",
      network: "mainnet",
      contractHash: "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46",
      actorHash: "0xa5de523ae9d99be784a536e9412b7a3cbe049e1a",
      txid,
      createdAt: Date.now(),
      epoch: 4,
      amountRaw: "200000000",
      fundingAmountRaw: "200000000",
      beforeStakeRaw: "0",
      beforeBidRaw: "0",
      beforeEpoch: 4,
      beforeRewardsRaw: "0",
      beforeCreditRaw: "0",
    };
    const { container } = render(<PlayArea t={t} state={state({ pendingOperation: pending, pendingTxid: txid })} dispatch={dispatch} />);
    expect(container.querySelector(".merc-ticket")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("recoverPendingOperation");
  });

  // An unresolved read must never be drawn as a real zero. How it *looks*
  // depends on the phase: a skeleton while the read is in flight, honest
  // zero-state copy once it settles. Neither is an error and neither is a void.
  it("shows skeletons rather than zero market values while reads are in flight", () => {
    const { container } = render(<PlayArea t={t} state={state({
      dataLoading: true,
      loaded: false,
      marketAvailable: false,
      windowAvailable: false,
      highestBidAvailable: false,
      walletAvailable: false,
      bidsAvailable: false,
    })} dispatch={vi.fn()} />);
    expect(container.querySelectorAll(".mx2-skeleton").length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("0 NEO");
    expect(container.textContent).not.toContain("0 GAS");
    expect(container.textContent).not.toContain("—");
  });

  it("gives settled empty reads honest zero-state copy, not an error or a void", () => {
    const { container } = render(<PlayArea t={t} state={state({
      dataLoading: false,
      loaded: true,
      marketAvailable: false,
      windowAvailable: false,
      highestBidAvailable: false,
      walletAvailable: false,
      bidsAvailable: false,
    })} dispatch={vi.fn()} />);
    expect(container.querySelectorAll(".mx2-phase-idle").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".mx2-skeleton").length).toBe(0);
    expect(container.textContent).not.toContain("0 NEO");
    expect(container.textContent).not.toContain("0 GAS");
    expect(container.textContent).not.toContain("—");
    // The disconnected visitor is invited to connect, never told data failed.
    expect(container.textContent).toContain("valueConnectWallet");
    expect(container.textContent).not.toContain("loadFailed");
  });

  it("keeps every wallet write disabled when recovery storage is unavailable", () => {
    const { container } = render(<PlayArea t={t} state={state({
      address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      storageHealthy: false,
      withdrawAmount: "1",
      pendingRewards: 1,
      gasCredit: 1,
      reclaimableBids: [{ epoch: 2, amount: 1 }],
    })} dispatch={vi.fn()} />);

    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(container.querySelectorAll(".merc-drawer-tabs button")[1] as Element);

    expect(container.querySelector<HTMLInputElement>(".merc-secondary-action input")?.disabled).toBe(true);
    for (const button of container.querySelectorAll<HTMLButtonElement>(
      ".merc-secondary-action button, .merc-compact-actions button, .merc-reclaims button",
    )) {
      expect(button.disabled).toBe(true);
    }
  });
});
