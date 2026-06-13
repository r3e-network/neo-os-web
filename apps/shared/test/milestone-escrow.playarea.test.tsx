import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../milestone-escrow/src/PlayArea";
import type { EscrowItem } from "../../milestone-escrow/src/pages/index/components/EscrowList";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BENEFICIARY = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    addMilestone: "Add milestone",
    amount: "Amount",
    amountPlaceholder: "1.5",
    approve: "Approve",
    approveMilestone: "Approve M{n} — {amount}",
    approving: "Approving...",
    assetType: "Asset",
    assetGas: "GAS",
    assetNeo: "NEO",
    beneficiaryAddress: "Beneficiary",
    beneficiaryPlaceholder: "N-address...",
    cancel: "Cancel",
    cancelling: "Cancelling...",
    claim: "Claim",
    claimMilestone: "Claim M{n} — {amount}",
    claiming: "Claiming...",
    confirmCancelRefund: "Confirm cancel — refunds {amount}",
    createdByYou: "Created by you",
    createEscrow: "Create Escrow",
    description: "Description",
    descriptionPlaceholder: "Milestone description...",
    emptyEscrows: "No escrows yet",
    escrowsTab: "Escrows",
    forYou: "For you",
    milestones: "Milestones",
    milestoneLabel: "Milestone {index}",
    milestoneAmountPlaceholder: "1.5",
    milestoneProgress: "{done} / {count} milestones",
    noMilestoneToApprove: "All milestones approved",
    noMilestoneToClaim: "No approved milestone to claim",
    refresh: "Refresh",
    released: "Released",
    releasedOfTotal: "{released} / {total} released",
    remove: "Remove",
    removeMilestone: "Remove milestone {index}",
    statusActive: "Active",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
    submit: "Submit",
    title: "Milestone Escrow",
    totalAmount: "Total amount",
  };
  const template = messages[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
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
    // Mirrors the real composable's formatAmount: returns the bare formatted
    // number (no asset suffix) — the card appends the asset symbol itself.
    formatAmountFunc: (_symbol: "NEO" | "GAS", amount: bigint) => amount.toString(),
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
    // A single milestone row is present by default.
    expect(screen.getByLabelText("Milestone 1")).toBeTruthy();
  });

  it("dispatches createEscrow with a single-milestone array and GAS by default", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "1.5" } });
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

  it("adds milestones and dispatches the full per-milestone amount array", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "1.5" } });

    // Add two more milestone rows (3 total).
    fireEvent.click(screen.getByRole("button", { name: /Add milestone/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add milestone/i }));
    fireEvent.change(screen.getByLabelText("Milestone 2"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Milestone 3"), { target: { value: "0.5" } });

    // Live total reflects the sum of all milestone amounts.
    expect(screen.getByText("4 GAS")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(dispatch).toHaveBeenCalledWith(
      "createEscrow",
      expect.objectContaining({
        beneficiary: BENEFICIARY,
        asset: "GAS",
        milestones: [{ amount: "1.5" }, { amount: "2" }, { amount: "0.5" }],
      }),
    );
  });

  it("removes an added milestone and keeps the remaining amounts", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Add milestone/i }));
    fireEvent.change(screen.getByLabelText("Milestone 2"), { target: { value: "2" } });

    // Remove the first milestone; the second shifts up to "Milestone 1".
    fireEvent.click(screen.getByRole("button", { name: "Remove milestone 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(dispatch).toHaveBeenCalledWith(
      "createEscrow",
      expect.objectContaining({ milestones: [{ amount: "2" }] }),
    );
  });

  it("disables Submit until a beneficiary and positive amount are entered", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    const submit = screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    // Clicking the disabled submit does not dispatch.
    fireEvent.click(submit);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "1" } });
    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("switches to NEO and dispatches createEscrow with the NEO asset", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.click(screen.getByRole("radio", { name: "NEO" }));

    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "5" } });
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

  it("keeps the form open and intact when createEscrow fails (dispatch resolves false)", async () => {
    // notify.guard swallows the failure into an error toast and the action
    // resolves false — the form must keep the user's input for retry.
    const dispatchMock = vi.fn(async () => false);
    render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={dispatchMock as unknown as (name: string, ...args: unknown[]) => Promise<void>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(dispatchMock).toHaveBeenCalled());
    expect((screen.getByLabelText("Beneficiary") as HTMLInputElement).value).toBe(BENEFICIARY);
  });

  it("closes and resets the form only on a real createEscrow success", async () => {
    const dispatchMock = vi.fn(async () => true);
    render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={dispatchMock as unknown as (name: string, ...args: unknown[]) => Promise<void>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Create Escrow$/i }));
    fireEvent.change(screen.getByLabelText("Beneficiary"), { target: { value: BENEFICIARY } });
    fireEvent.change(screen.getByLabelText("Milestone 1"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.queryByLabelText("Beneficiary")).toBeNull());
  });

  it("dispatches approve, cancel, and claim actions from the ledger", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    // Action buttons are now labelled with the specific milestone they release
    // (the next approvable / claimable one) and its amount, not a bare verb.
    // Creator escrow has milestoneApproved [false, true] -> M1 is next approvable.
    fireEvent.click(screen.getByRole("button", { name: /^Approve M1 —/ }));
    expect(dispatch).toHaveBeenCalledWith("approveMilestone", expect.objectContaining({ id: "esc-1" }));

    // Cancel is now a two-step confirm (it refunds remaining funds): the first
    // click only arms the confirm; the second confirm click dispatches.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dispatch).not.toHaveBeenCalledWith("cancelEscrow", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: /^Confirm cancel —/ }));
    expect(dispatch).toHaveBeenCalledWith("cancelEscrow", expect.objectContaining({ id: "esc-1" }));

    // Beneficiary escrow has milestoneApproved [false, true] -> M2 is claimable.
    fireEvent.click(screen.getByRole("button", { name: /^Claim M2 —/ }));
    expect(dispatch).toHaveBeenCalledWith("claimMilestone", expect.objectContaining({ id: "esc-1" }));
  });

  it("shows the escrow amount, asset, and milestone progress on each card", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} />);

    // formatAmountFunc renders "<base units> GAS"; total appears on the card.
    expect(screen.getAllByText("10000000 GAS").length).toBeGreaterThan(0);
    // Milestone progress: 0 of 2 claimed.
    expect(screen.getAllByText("0 / 2 milestones").length).toBeGreaterThan(0);
  });

  it("disables Approve when every milestone is already approved", () => {
    const allApproved = escrow({ milestoneApproved: [true, true], milestoneClaimed: [false, false] });
    render(
      <PlayArea
        t={t}
        state={state({ creatorEscrows: [allApproved], beneficiaryEscrows: [] })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    const approve = screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
  });

  it("disables Claim when no milestone is approved-and-unclaimed", () => {
    // Beneficiary escrow with nothing approved yet -> nothing claimable.
    const noneApproved = escrow({
      creator: BENEFICIARY,
      beneficiary: OWNER,
      milestoneApproved: [false, false],
      milestoneClaimed: [false, false],
    });
    render(
      <PlayArea
        t={t}
        state={state({ creatorEscrows: [], beneficiaryEscrows: [noneApproved] })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    const claim = screen.getByRole("button", { name: "Claim" }) as HTMLButtonElement;
    expect(claim.disabled).toBe(true);
  });
});
