import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../milestone-escrow/src/PlayArea";
import type { EscrowItem } from "../../milestone-escrow/src/pages/index/components/EscrowList";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BENEFICIARY = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

function t(key: string) {
  const messages: Record<string, string> = {
    amount: "Amount",
    amountPlaceholder: "1.5",
    approve: "Approve",
    assetType: "Asset",
    assetGas: "GAS",
    assetNeo: "NEO",
    beneficiaryAddress: "Beneficiary",
    beneficiaryPlaceholder: "N-address...",
    cancel: "Cancel",
    claim: "Claim",
    createdByYou: "Created by you",
    createEscrow: "Create Escrow",
    description: "Description",
    descriptionPlaceholder: "Milestone description...",
    emptyEscrows: "No escrows yet",
    escrowsTab: "Escrows",
    forYou: "For you",
    refresh: "Refresh",
    statusActive: "Active",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
    submit: "Submit",
    title: "Milestone Escrow",
  };
  return messages[key] ?? key;
}

function escrow(overrides: Partial<EscrowItem> = {}): EscrowItem {
  return {
    id: "esc-1",
    creator: OWNER,
    beneficiary: BENEFICIARY,
    assetSymbol: "GAS",
    totalAmount: 10_000_000n,
    releasedAmount: 0n,
    status: "active",
    milestoneAmounts: [5_000_000n, 5_000_000n],
    milestoneApproved: [false, true],
    milestoneClaimed: [false, false],
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
    beneficiaryEscrows: [escrow({ creator: BENEFICIARY, beneficiary: OWNER })],
    isRefreshing: false,
    isCreating: false,
    approvingId: null,
    claimingId: null,
    cancellingId: null,
    statusLabelFunc: (status: string) => (status === "active" ? "Active" : status),
    formatAmountFunc: (_symbol: "NEO" | "GAS", amount: bigint) => `${amount.toString()} GAS`,
    formatAddressFunc: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Milestone Escrow PlayArea", () => {
  it("renders the create toggle and escrow ledger", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} />);

    expect(screen.getByRole("button", { name: /^Create Escrow$/i })).toBeTruthy();
    expect(screen.getAllByText("Website delivery").length).toBeGreaterThan(0);
  });

  it("opens the create form and offers both GAS and NEO (default GAS)", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));

    expect(screen.getByLabelText("Beneficiary")).toBeTruthy();
    // The NEO asset option is back: both radios are present, GAS selected.
    const gasOption = screen.getByRole("radio", { name: "GAS" });
    const neoOption = screen.getByRole("radio", { name: "NEO" });
    expect(gasOption).toBeTruthy();
    expect(neoOption).toBeTruthy();
    expect(gasOption.getAttribute("aria-checked")).toBe("true");
    expect(neoOption.getAttribute("aria-checked")).toBe("false");
    // Amount label reflects the default (GAS) asset.
    expect(screen.getByLabelText("Amount (GAS)")).toBeTruthy();
  });

  it("dispatches createEscrow with the entered amount and GAS asset by default", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.change(screen.getByLabelText("Amount (GAS)"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Phase 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(dispatch).toHaveBeenCalledWith(
      "createEscrow",
      expect.objectContaining({
        beneficiary: BENEFICIARY,
        asset: "GAS",
        notes: "Phase 1",
        milestones: [{ amount: "1.5" }],
      }),
    );
  });

  it("switches to NEO and dispatches createEscrow with the NEO asset", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.click(screen.getByRole("radio", { name: "NEO" }));

    // Amount label now reflects NEO.
    expect(screen.getByLabelText("Amount (NEO)")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Amount (NEO)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(dispatch).toHaveBeenCalledWith(
      "createEscrow",
      expect.objectContaining({
        beneficiary: BENEFICIARY,
        asset: "NEO",
        milestones: [{ amount: "5" }],
      }),
    );
  });

  it("dispatches approve, cancel, and claim actions from the ledger", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(dispatch).toHaveBeenCalledWith("approveMilestone", expect.objectContaining({ id: "esc-1" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dispatch).toHaveBeenCalledWith("cancelEscrow", expect.objectContaining({ id: "esc-1" }));

    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    expect(dispatch).toHaveBeenCalledWith("claimMilestone", expect.objectContaining({ id: "esc-1" }));
  });
});
