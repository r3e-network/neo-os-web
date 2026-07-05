import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../trustanchor-admin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appName: "TrustAnchor Admin",
    adminHeroTitle: "Move. Target. Vote.",
    adminHeroSubtitle: "Manual NEO routing only.",
    adminCommandCenter: "Operator command center",
    adminScope: "Admin scope",
    statsAwaitConnect: "Live trust routes load once an operator connects.",
    operatorRequiredEyebrow: "Read-only",
    operationMode: "Operation mode",
    moveNeo: "Move NEO",
    moveNeoDesc: "Move whole NEO from one AA agent to another.",
    setCandidate: "Update candidate",
    setCandidateDesc: "Change one agent's council candidate public key.",
    syncVote: "Sync vote",
    syncVoteDesc: "Submit the chosen AA agent vote.",
    fromAgentId: "From agent",
    toAgentId: "To agent",
    agentId: "Agent",
    neoAmount: "NEO amount",
    candidatePublicKey: "Candidate public key",
    agentCandidateLabel: "Candidate",
    agentCandidateNone: "No candidate",
    cardRuleCandidate: "Candidate key is set explicitly",
    voteWitnessTitle: "Needs the agent witness",
    voteWitnessNote: "Syncing this vote requires agent #{agent} ({account}) to co-sign.",
    agentDirectoryTitle: "Agent directory",
    directoryRosterNote: "{count} provisioned routes",
    agentBalancePending: "Balance pending",
    agentActive: "Active",
    agentInactive: "Inactive",
    operatorRule: "Operator rule",
    operatorRuleDesc: "Manual trust route changes and explicit vote sync.",
    operatorRequiredBody: "Connect operator wallet {address}.",
    operatorRequiredBodyNoAddress: "Connect operator wallet.",
    routeMapTitle: "Live route map",
    trackedNeo: "Tracked NEO",
    reserve: "Reserve",
    selectedRoute: "Selected route",
    agentCount: "Agents",
    agentDirectoryEmpty: "No agents.",
    noneFallback: "None",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    agentAccounts: [
      { agentId: 1, label: "Trust Agent 01", accountAddress: "Ntrust111111111", candidateTarget: "02aaa", neoBalance: 12, active: true },
      { agentId: 2, label: "Trust Agent 02", accountAddress: "Ntrust222222222", candidateTarget: "02bbb", neoBalance: 4, active: true },
      { agentId: 3, label: "Trust Agent 03", accountAddress: "Ntrust333333333", candidateTarget: "02ccc", neoBalance: 0, active: false },
    ],
    totalNeoDisplay: "16 NEO",
    reserveDisplay: "9 GAS",
    selectedAgentDisplay: "#1",
    agentCountDisplay: "3 / 21",
    adminState: "admin",
    expectedAdminDisplay: "Noperator",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("trustanchor-admin integration", () => {
  it("dispatches transferAgentNeo with the selected route payload", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByLabelText } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    const amountInput = getByLabelText("NEO amount") as HTMLInputElement;
    expect(amountInput.inputMode).toBe("numeric");
    fireEvent.change(amountInput, { target: { value: "3.5" } });
    expect(amountInput.value).toBe("3");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("transferAgentNeo", {
      fromAgentId: 1,
      toAgentId: 2,
      amount: 3,
    }));
  });

  it("switches to vote mode and dispatches voteAgent", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(getByRole("button", { name: /Sync vote/i }));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("voteAgent", { agentId: 1 }));
  });

  it("switches to candidate mode and dispatches setAgentCandidate", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByLabelText, getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(getByRole("button", { name: /Update candidate/i }));
    fireEvent.change(getByLabelText("Candidate public key"), { target: { value: "02dddd" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("setAgentCandidate", {
      agentId: 1,
      candidate: "02dddd",
    }));
  });
});
