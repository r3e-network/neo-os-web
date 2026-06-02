import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../milestone-escrow/src/PlayArea";
import type { EscrowItem } from "../../milestone-escrow/src/pages/index/components/EscrowList";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function t(key: string) {
  const messages: Record<string, string> = {
    addMilestone: "Add milestone",
    approved: "Approved",
    approve: "Approve",
    assetGas: "GAS",
    assetNeo: "NEO",
    assetType: "Asset",
    beneficiary: "Beneficiary address",
    beneficiaryPlaceholder: "Enter Neo N3 address",
    cancelEscrow: "Cancel escrow",
    claim: "Claim",
    claimed: "Claimed",
    connectWallet: "Connect wallet",
    createEscrow: "Create Escrow",
    createdByYou: "Created by you",
    creator: "Creator",
    docSubtitle: "Approve milestones and release funds in stages",
    emptyEscrows: "No escrows yet",
    escrowName: "Escrow name",
    escrowNamePlaceholder: "Website delivery escrow",
    escrowStats: "Escrow stats",
    escrowsTab: "Escrows",
    evidence: "Request and result evidence",
    forYou: "For you",
    idPrefix: "#",
    latestRequest: "Latest request",
    latestResult: "Latest result",
    milestone: "Milestone",
    milestoneAmount: "Milestone amount",
    milestoneAmountPlaceholder: "1.5",
    milestoneName: "Milestone name",
    milestoneProgress: "Milestone progress",
    milestones: "Milestones",
    notes: "Notes",
    notesPlaceholder: "Describe delivery criteria",
    pending: "Pending",
    refresh: "Refresh",
    releasedAmount: "Released",
    remove: "Remove",
    requestEmpty: "No request submitted yet",
    resultEmpty: "Response appears here",
    statusActive: "Active",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
    title: "Milestone Escrow",
    totalAmount: "Total amount",
    workflowReady: "Ready",
  };
  return messages[key] ?? key;
}

function escrow(overrides: Partial<EscrowItem> = {}): EscrowItem {
  return {
    id: "esc-1",
    creator: OWNER,
    beneficiary: OWNER,
    assetSymbol: "GAS",
    totalAmount: 10_000_000n,
    releasedAmount: 0n,
    status: "active",
    milestoneAmounts: [5_000_000n, 5_000_000n],
    milestoneApproved: [false, true],
    milestoneClaimed: [false, false],
    milestoneNames: ["Design", "Build"],
    title: "Website delivery",
    notes: "Acceptance criteria",
    active: true,
    ...overrides,
  };
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    address: OWNER,
    contractReady: true,
    creatorEscrowCount: 1,
    beneficiaryEscrowCount: 1,
    activeCount: 1,
    completedCount: 0,
    creatorEscrows: [escrow()],
    beneficiaryEscrows: [escrow()],
    isRefreshing: false,
    isCreating: false,
    approvingId: null,
    claimingId: null,
    cancellingId: null,
    workflowStatus: "Ready",
    lastError: "",
    latestRequest: null,
    latestResult: null,
    statusLabelFunc: (status: string) => status === "active" ? "Active" : status,
    formatAmountFunc: (_symbol: "NEO" | "GAS", amount: bigint) => `${amount.toString()} GAS`,
    formatAddressFunc: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Milestone Escrow PlayArea", () => {
  it("renders a complete create, ledger, action, and evidence workflow", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} />);

    expect(screen.getByLabelText("Escrow name")).toBeTruthy();
    expect(screen.getByLabelText("Beneficiary address")).toBeTruthy();
    expect(screen.getAllByLabelText("Milestone name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Website delivery").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Approve Design" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Claim Build" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Request and result evidence" })).toBeTruthy();
  });

  it("dispatches create and milestone actions from visible controls", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    expect(dispatch).toHaveBeenCalledWith("createEscrow", expect.objectContaining({
      name: "Website delivery escrow",
      asset: "GAS",
      milestones: expect.arrayContaining([
        expect.objectContaining({ name: "Design approval", amount: "0.05" }),
      ]),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Approve Design" }));
    expect(dispatch).toHaveBeenCalledWith("approveMilestone", expect.objectContaining({ id: "esc-1" }), 0);

    fireEvent.click(screen.getByRole("button", { name: "Claim Build" }));
    expect(dispatch).toHaveBeenCalledWith("claimMilestone", expect.objectContaining({ id: "esc-1" }), 1);

    fireEvent.click(screen.getAllByRole("button", { name: /Cancel escrow Website delivery/i })[0]);
    expect(dispatch).toHaveBeenCalledWith("cancelEscrow", expect.objectContaining({ id: "esc-1" }));
  });

  it("caps draft milestones at the business limit before submit", async () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} />);
    let now = 1_000;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      now += 301;
      return now;
    });

    try {
      for (let i = 0; i < 20; i += 1) {
        const currentCount = screen.getAllByLabelText("Milestone name").length;
        const currentAddButton = screen.getByRole("button", {
          name: "Add milestone",
        }) as HTMLButtonElement;
        if (currentAddButton.disabled) break;
        fireEvent.click(currentAddButton);
        await waitFor(() => {
          expect(screen.getAllByLabelText("Milestone name")).toHaveLength(
            Math.min(currentCount + 1, 12),
          );
        });
      }
    } finally {
      nowSpy.mockRestore();
    }

    const addButton = screen.getByRole("button", { name: "Add milestone" }) as HTMLButtonElement;
    expect(screen.getAllByLabelText("Milestone name")).toHaveLength(12);
    expect(screen.getByText("12/12")).toBeTruthy();
    expect(addButton.disabled).toBe(true);
  });
});
