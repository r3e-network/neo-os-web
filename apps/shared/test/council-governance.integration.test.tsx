import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../council-governance/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) {
  const m: Record<string,string> = {
    activeProposals: "Active",
    castYourVote: "Cast Your Vote",
    duration7Days: "7 Days",
    proposalDescription: "Description",
    proposalDossier: "Proposal dossier",
    proposalTabs: "Proposal sections",
    proposalTitle: "Title",
    submitProposal: "Submit Proposal",
    textType: "Text",
    voteFor: "Vote For",
    votingPower: "Power",
  };
  return m[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = {
    proposals: [],
    activeProposals: [],
    historyProposals: [],
    activeCount: 0,
    historyCount: 0,
    selectedProposal: null,
    isLoading: false,
    isVoting: false,
    isCreating: false,
    votingPower: "100",
    governanceOverview: {
      loaded: true,
      network: "mainnet",
      contract: "0xc7e50e67589df63302cbea1a6b00beb649ee74d8",
      paused: false,
      committeeSize: 21,
      quorumPercent: 30,
      thresholdPercent: 50,
      minDurationMs: 86_400,
      maxDurationMs: 2_592_000,
      totalProposals: 0,
      totalVotes: 0,
      passedProposals: 0,
      totalMembers: 0,
    },
    currentNetwork: "mainnet",
    councilCandidates: [],
    councilRosterLoaded: true,
    address: "NconnectedCouncilMember",
    isCandidate: true,
    candidateLoaded: true,
    hasVotedMap: {},
    hasVotedKnownMap: {},
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("council-governance integration: dispatch params", () => {
  it("dispatches createProposal after the visible draft is completed", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(screen.getByPlaceholderText("proposalTitlePlaceholder"), { target: { value: "Treasury review" } });
    fireEvent.change(screen.getByPlaceholderText("proposalDescPlaceholder"), { target: { value: "Open the council review window." } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createProposal", expect.objectContaining({
      title: "Treasury review",
      description: "Open the council review window.",
      type: 0,
    })));
  });
  it("keeps policy proposal controls in the drawer and preserves the create payload", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(screen.getByPlaceholderText("proposalTitlePlaceholder"), { target: { value: "Tune policy" } });
    fireEvent.change(screen.getByPlaceholderText("proposalDescPlaceholder"), { target: { value: "Update one council policy parameter." } });
    fireEvent.click(screen.getByRole("button", { name: /policyType/ }));
    fireEvent.change(container.querySelector(".council-policy-value input[placeholder='policyValuePlaceholder']") as Element, {
      target: { value: "42" },
    });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createProposal", expect.objectContaining({
      title: "Tune policy",
      description: "Update one council policy parameter.",
      type: 1,
      policyMethod: "setFeePerByte",
      policyValue: "42",
    })));
  });
  it("dispatches selectProposal from the proposal list", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const proposals = [{ id: 1, title: "Proposal A", statusKey: "active", yesVotes: 0, noVotes: 0 }];
    render(<PlayArea t={t} state={state({ activeProposals: proposals, activeCount: 1 })} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: /Proposal A/ }));
    expect(dispatch).toHaveBeenCalledWith("selectProposal", proposals[0]);
  });
  it("dispatches vote with proposal id and choice", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const proposal = { id: 1, title: "Test", statusKey: "active", yesVotes: 0, noVotes: 0 };
    const { container } = render(<PlayArea t={t} state={state({
      selectedProposal: proposal,
      activeCount: 1,
      address: "Nabc",
      isCandidate: true,
      candidateLoaded: true,
      hasVotedKnownMap: { 1: true },
    })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("vote", {
      proposalId: 1,
      vote: "for",
    }));
  });
});
