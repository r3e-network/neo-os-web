import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import ProfitAnchorPlayArea from "../../profitanchor/src/PlayArea";
import TrustAnchorPlayArea from "../../trustanchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    actionHistory: "Recent actions",
    actionHistoryEmpty: "No wallet action submitted yet.",
    amountNeedsWholeNeo: "Whole NEO required",
    amountPlan: "Amount",
    amountPlanBlocked: "NEO cannot be fractional. Use a positive whole number.",
    amountPlanReady: "Whole NEO amount is ready for stake or redeem.",
    actionPanelBody: "Enter a whole NEO amount and send the wallet transaction.",
    actionPanelLabel: "Wallet actions",
    actionPanelTitle: "Stake, redeem, or claim",
    appName: "Anchor",
    blocked: "Blocked",
    claimPlan: "Claim plan",
    claimPlanEmpty: "No claimable GAS",
    claimPlanEmptyCopy: "Rewards unlock after stake accounting updates.",
    claimPlanReady: "GAS ready to claim",
    claimPlanReadyCopy: "Claim calls PlatformAnchor and records the reward transaction.",
    currentRoute: "Current route",
    heroDescription: "Stake NEO, redeem NEO, and claim GAS rewards.",
    heroTitle: "Stake. Redeem. Claim.",
    invalidAmount: "NEO is indivisible - enter a whole number",
    lastTxid: "Last tx",
    myStake: "My stake",
    neoAmount: "NEO amount",
    pendingRewards: "Claimable GAS",
    operatorRouteCopy: "Operators move NEO between candidate agents and update vote targets when the council set changes.",
    preflightAmount: "Whole NEO",
    preflightBody: "Confirm the amount, route, stake memo, and claim state before the wallet prompt opens.",
    preflightChecklist: "Wallet readiness checklist",
    preflightClaim: "Claimable GAS",
    preflightEyebrow: "Preflight",
    preflightRoute: "AA route",
    preflightStake: "Stake balance",
    preflightTitle: "Review the wallet effect",
    refreshStatus: "Refresh status",
    registeredAgentsCopy: "{count}/21 AA agents registered for ProfitAnchor.",
    rewardReserve: "Reward Reserve",
    routeAgents: "Agents",
    routeAwaiting: "Awaiting route",
    routeRewardPool: "Reward pool",
    routeSelected: "Route selected",
    routeState: "Route state",
    routeStatus: "Status",
    routingProtectionTitle: "How routing is protected",
    routeStateLabel: "Route state",
    statusLabel: "Status",
    agentsLabel: "Agents",
    rewardPoolLabel: "Reward pool",
    awaitingRoute: "Awaiting route",
    noneFallback: "None",
    routeModelHeading: "How routing is protected",
    agentsHint: "{count}/21 agents",
    currentRouteLine: "Current route: {agent}.",
    agentsRegisteredLine: "{count}/21 AA agents registered for TrustAnchor.",
    operatorsNote:
      "Operators move NEO between candidate agents and update vote targets when the council set changes.",
    agentCandidateLabel: "candidate {id}",
    rewardPerNeo: "Reward / NEO",
    submitClaim: "Claim GAS",
    submitStake: "Stake NEO",
    submitWithdraw: "Redeem NEO",
    stakePath: "Stake path",
    stakePathCopy: "Stake submits a NEO transfer with memo",
    stakePathTitle: "NEO transfer to PlatformAnchor",
    totalNeoTracked: "Tracked NEO",
    workflowFailed: "Action failed",
    workflowReady: "Ready for wallet action",
    workflowSubmitting: "Submitting...",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    stats: {
      totalStaked: 12,
      rewardReserve: 3.5,
      agentCount: 21,
      rps: "0",
      selectedAgentId: 4,
    },
    agentAccounts: [],
    agentCount: 21,
    myStake: 2,
    pendingRewards: 0.4,
    myStakeDisplay: "2.00 NEO",
    pendingRewardsDisplay: "0.40 GAS",
    rewardReserveDisplay: "3.50 GAS",
    totalNeoDisplay: "12.00 NEO",
    workflowStatus: "Ready for wallet action",
    lastTxid: "",
    lastError: "",
    actionHistory: [],
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Anchor user PlayAreas", () => {
  it("lets ProfitAnchor users stake, redeem, claim, and refresh from the play area", async () => {
    const dispatch = vi.fn(async () => undefined);

    const { container } = render(<ProfitAnchorPlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(screen.getByRole("region", { name: "Review the wallet effect" })).toBeTruthy();
    expect(container.querySelector(".anchor-capital-flow.is-ready.has-claim")).toBeTruthy();
    expect(container.querySelector('.anchor-capital-flow__token img[src="./logo.jpg"]')).toBeTruthy();
    expect(container.querySelectorAll(".anchor-capital-flow__node").length).toBe(3);
    expect(screen.getByText("NEO transfer to PlatformAnchor")).toBeTruthy();
    expect(screen.getByText("stake:miniapp-profitanchor")).toBeTruthy();
    expect(screen.getByText("GAS ready to claim")).toBeTruthy();
    expect(screen.getByText("Route selected")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("NEO amount"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stake NEO" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stakeNeo", { amount: "3" });
    });

    fireEvent.click(screen.getByRole("button", { name: "Redeem NEO" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdrawNeo", { amount: "3" });
    });

    fireEvent.click(screen.getByRole("button", { name: "Claim GAS" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("claimRewards");
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("refreshAnchor");
    });
  });

  it("blocks fractional NEO on TrustAnchor before dispatch", () => {
    const dispatch = vi.fn(async () => undefined);

    render(<TrustAnchorPlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText("NEO amount"), {
      target: { value: "1.5" },
    });

    const stakeButton = screen.getByRole("button", { name: "Stake NEO" }) as HTMLButtonElement;
    const withdrawButton = screen.getByRole("button", { name: "Redeem NEO" }) as HTMLButtonElement;
    expect(stakeButton.disabled).toBe(true);
    expect(withdrawButton.disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders the TrustAnchor route-state card through the translator", () => {
    render(<TrustAnchorPlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} />);

    // Route-state aside is no longer hardcoded English: every label resolves via t().
    const routeCard = screen.getByLabelText("Route state");
    expect(routeCard).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getAllByText("Agents").length).toBeGreaterThan(0);
    expect(screen.getByText("Reward pool")).toBeTruthy();
    // selectedAgentId: 4 -> "Route selected" via t("routeSelected"), not a literal.
    expect(screen.getAllByText("Route selected").length).toBeGreaterThan(0);
  });

  it("turns TrustAnchor wallet actions into a visible governance capital flow", async () => {
    const dispatch = vi.fn(async () => undefined);

    const { container } = render(
      <TrustAnchorPlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    const flow = screen.getByLabelText("Stake path");
    expect(flow).toBeTruthy();
    expect(container.querySelector(".anchor-capital-flow.is-ready.has-claim.has-route")).toBeTruthy();
    expect(container.querySelector('.anchor-capital-flow__token img[src="./logo.jpg"]')).toBeTruthy();
    expect(container.querySelectorAll(".anchor-capital-flow__node").length).toBe(3);
    expect(screen.getByText("Whole NEO")).toBeTruthy();
    expect(screen.getByText("AA route")).toBeTruthy();
    expect(screen.getByText("Claim plan")).toBeTruthy();
    expect(screen.getAllByText("#4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.40 GAS").length).toBeGreaterThan(0);
    expect(screen.getByText("Whole NEO amount is ready for stake or redeem.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("NEO amount"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stake NEO" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stakeNeo", { amount: "4" });
    });
  });

  it("shows an em-dash agent count for TrustAnchor when no chain stats exist", () => {
    render(
      <TrustAnchorPlayArea
        t={t}
        state={state({
          stats: null,
          agentCount: 0,
          agentAccounts: [],
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    // Low-severity fix: empty contract must not overstate "21/21" agents.
    expect(screen.getByText("—/21")).toBeTruthy();
    expect(screen.getAllByText("Awaiting route").length).toBeGreaterThan(0);
  });

  it("renders submitted anchor action history with the latest tx", () => {
    render(
      <ProfitAnchorPlayArea
        t={t}
        state={state({
          lastTxid: "0xabcdef0000000000000000000000000000000000000000000000000000000001",
          workflowStatus: "Stake transaction submitted",
          actionHistory: [
            {
              action: "Stake NEO",
              amount: "3",
              status: "Stake transaction submitted",
              txid: "0xabcdef0000000000000000000000000000000000000000000000000000000001",
              at: "2026-06-01T00:00:00.000Z",
            },
          ],
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByText("Stake NEO").length).toBeGreaterThan(0);
    expect(screen.getByText("3 NEO")).toBeTruthy();
    expect(screen.getAllByText(/0xabcdef00/).length).toBeGreaterThan(0);
  });

  it("keeps ProfitAnchor capital-flow motion accessible", () => {
    const css = fs.readFileSync(
      `${process.cwd()}/../profitanchor/src/PlayArea.scss`,
      "utf8",
    );

    expect(css).toContain("@keyframes anchor-capital-rail-flow");
    expect(css).toContain("@keyframes anchor-capital-token-route");
    expect(css).toContain("@keyframes anchor-capital-token-route-mobile");
    expect(css).toContain("@keyframes anchor-stage-drift");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".anchor-capital-flow__token");
  });

  it("keeps TrustAnchor governance capital-flow motion accessible", () => {
    const css = fs.readFileSync(
      `${process.cwd()}/../trustanchor/src/PlayArea.scss`,
      "utf8",
    );

    expect(css).toContain("@keyframes trustanchor-stage-drift");
    expect(css).toContain("@keyframes trustanchor-capital-rail-flow");
    expect(css).toContain("@keyframes trustanchor-capital-token-route");
    expect(css).toContain("@keyframes trustanchor-capital-token-route-mobile");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".anchor-capital-flow__token");
    expect(css).toContain("animation: none !important");
  });
});
