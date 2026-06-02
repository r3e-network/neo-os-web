import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../custom-anchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    actionPanelBody: "Enter the custom anchor id and submit wallet transactions.",
    actionPanelLabel: "Wallet actions",
    actionPanelTitle: "Stake, redeem, or claim",
    adminRoute: "Admin route",
    adminRouteBody: "Agent movement stays outside the user flow.",
    agentCount: "Agents",
    agentModelBody: "Every custom anchor owns 21 deterministic AA agents.",
    anchorAppId: "Anchor appId",
    anchorAwaitingLaunch: "Open a OneGate anchor link",
    anchorFlowAction: "Choose action",
    anchorFlowOpen: "Open anchor",
    anchorFlowSign: "Sign wallet tx",
    anchorFlowTitle: "Anchor transaction flow",
    anchorLinked: "Anchor linked",
    anchorMissing: "Waiting for anchor",
    anchorStatus: "Anchor status",
    anchorWorkspaceBody: "User actions stay scoped to the anchor appId.",
    anchorWorkspaceLabel: "Transaction route",
    anchorWorkspaceTitle: "Anchor routing workspace",
    claimAction: "Claim GAS",
    invalidAmount: "NEO is indivisible. Enter a positive whole number.",
    invalidAnchorId: "Anchor appId must look like custom-anchor:slug:nonce.",
    lastTxid: "Last tx",
    launchSource: "Launch source",
    neoAmount: "NEO amount",
    noAnchorBody: "Scan a link or enter the anchor appId.",
    noAnchorTitle: "Open an anchor link",
    notAvailable: "Not available",
    pendingRewards: "Claimable GAS",
    readyForAnchor: "Ready for",
    refreshStatus: "Refresh status",
    rewardReserve: "Reward reserve",
    routingDetails: "Routing details",
    safetyRail: "Safety rail",
    safetyRailBody: "Funds remain scoped by anchor appId.",
    stakeAction: "Stake NEO",
    title: "Custom Anchor",
    totalStaked: "Total staked",
    userRoute: "User route",
    userRouteBody: "Stake, redeem, or claim from the same anchor.",
    userStake: "Your stake",
    withdrawAction: "Redeem NEO",
    workflowReady: "Ready",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    anchorAppId: "custom-anchor:team:nonce",
    totalStaked: "12",
    rewardReserve: "3.5",
    userStake: "2",
    pendingRewards: "0.1",
    agentCount: 21,
    lastTxid: "0xabc",
    workflowStatus: "Ready",
    lastError: "",
    isLoading: false,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Custom Anchor PlayArea", () => {
  it("renders the wallet action workflow instead of a read-only explanation", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    expect(screen.getByRole("region", { name: "Stake, redeem, or claim" })).toBeTruthy();
    expect(screen.getByLabelText("Anchor appId")).toBeTruthy();
    expect(screen.getByLabelText("NEO amount")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stake NEO" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Redeem NEO" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Claim GAS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh status" })).toBeTruthy();
  });

  it("dispatches stake, redeem, claim, and refresh with the selected anchor", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    fireEvent.change(screen.getByLabelText("Anchor appId"), {
      target: { value: "custom-anchor:dao:round1" },
    });
    fireEvent.change(screen.getByLabelText("NEO amount"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Stake NEO" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stake", {
        anchorAppId: "custom-anchor:dao:round1",
        amount: "5",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Redeem NEO" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdraw", {
        anchorAppId: "custom-anchor:dao:round1",
        amount: "5",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Claim GAS" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("claimRewards", {
        anchorAppId: "custom-anchor:dao:round1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("refreshAnchor", {
        anchorAppId: "custom-anchor:dao:round1",
      });
    });
  });
});
