import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-multisig/src/PlayArea";
import type { RequestView, VaultView } from "../../neo-multisig/src/utils/vault";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const SIGNER_A = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const SIGNER_B = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";
const RECIPIENT = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    amountLabel: "Amount",
    amountPlaceholder: "0.00",
    approvalProgress: "Approvals collected",
    ariaSigners: "Signers",
    assetGas: "GAS",
    assetLabel: "Asset",
    assetNeo: "NEO",
    buttonApprove: "Approve",
    buttonApproving: "Approving...",
    buttonCancel: "Cancel",
    buttonCancelling: "Cancelling...",
    buttonCreateVault: "Create Vault",
    buttonDeposit: "Deposit",
    buttonPropose: "Propose Spend",
    loadButton: "Load",
    loadRequestPlaceholder: "Request ID",
    loadRequestTitle: "Load request",
    loadVaultPlaceholder: "Vault ID",
    loadVaultTitle: "Load vault",
    memoLabel: "Memo",
    memoPlaceholder: "Short note for signers",
    multisigBalanceTitle: "Vault balance",
    multisigCreateReady: "Ready to deploy an on-chain custody vault.",
    multisigDepositCopy: "Send GAS or NEO into the vault.",
    multisigDepositTitle: "Deposit funds",
    multisigDraftState: "—",
    multisigDuplicateSigners: "Signer addresses must be distinct.",
    multisigHeroEyebrow: "On-chain custody",
    multisigHeroSnapshot: "Vault snapshot",
    multisigHeroSubtitle: "Deposit GAS or NEO into a shared vault.",
    multisigHeroTitle: "Multisig Custody Vault",
    multisigInsufficientBalance:
      "Amount exceeds the vault balance ({balance} {asset} available).",
    multisigInvalidSignerAddress: "Each signer must be a valid Neo N3 address.",
    multisigNeedSigners: "Add at least two signer addresses before creating a vault.",
    multisigNetworkValue: "Neo N3",
    multisigProposeCopy: "Create a spend request from the vault.",
    multisigProposeTitle: "Propose a spend",
    multisigProposalPreview: "Proposal docket",
    multisigQuorumTitle: "Threshold",
    multisigRequestStatusTitle: "Request",
    multisigRouteBroadcast: "Approve & release",
    multisigRouteCopy: "Create, deposit, propose, approve.",
    multisigRouteCreate: "Create vault",
    multisigRouteSign: "Propose spend",
    multisigRouteTitle: "Execution route",
    multisigSignerCopy: "Only listed signer addresses can approve.",
    multisigSignerApproved: "Approved",
    multisigSignerDraft: "Ready",
    multisigSignerList: "Signers",
    multisigSignerWaiting: "Waiting",
    multisigSignerTitle: "Vault overview",
    multisigApprovalBoard: "Approval board",
    multisigAmountPreview: "Amount to release",
    multisigRecipientPreview: "Recipient pending",
    multisigBoardTitle: "Signer board",
    multisigStepCreate: "Step 1",
    multisigStepDeposit: "Step 2",
    multisigStepPropose: "Step 3",
    multisigThresholdBlocked: "Threshold cannot be greater than the number of signers.",
    multisigTooManySigners: "A vault supports at most 16 signer addresses.",
    multisigUnfundedNotice:
      "Auto-cancelled at threshold: the vault was underfunded (needed {required} {asset}, held {available}). Deposit again, then propose a new request.",
    multisigVaultBadge: "Vault",
    multisigVaultCopy: "Enter signer addresses and a threshold.",
    multisigVaultIdLabel: "Vault ID",
    multisigVaultReceiptCopy: "Share this vault ID with signers.",
    multisigVaultTitle: "Custody vault",
    recentEmpty: "No vaults or requests yet.",
    recentTitle: "Recent Activity",
    reviewAmount: "Amount",
    reviewSigners: "Signers",
    reviewTo: "To",
    signerLabel: "Signer Address",
    signerPlaceholder: "Neo N3 address (N...)",
    statusCancelled: "Cancelled",
    statusExecuted: "Executed",
    statusLabel: "Status",
    statusPending: "Pending",
    statusUnknown: "Unknown",
    thresholdLabel: "Approval Threshold",
    toAddressLabel: "Recipient Address",
    toAddressPlaceholder: "N3 address",
  };
  const template = messages[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

function baseState(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    activeRequest: null,
    activeVault: null,
    completedCount: 0,
    connectedAddress: "",
    history: [],
    unfundedNotice: null,
    isApproving: false,
    isCancelling: false,
    isCreatingVault: false,
    isDepositing: false,
    isLoading: false,
    isProposing: false,
    pendingCount: 0,
    totalActions: 0,
    vaultCount: 0,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function vault(overrides: Partial<VaultView> = {}): VaultView {
  return {
    id: 7,
    creator: "0xaaaa11112222333344445555666677778888aaaa",
    threshold: 2,
    signers: [
      "0xaaaa11112222333344445555666677778888aaaa",
      "0xb89f8dd1ebc0e29561c4c3e9ad60ec307b9a473e",
    ],
    createdTime: 1700000000000,
    neoBalance: 0,
    gasBalance: 100000000,
    ...overrides,
  };
}

function request(overrides: Partial<RequestView> = {}): RequestView {
  return {
    id: 4,
    vaultId: 7,
    creator: "0xaaaa11112222333344445555666677778888aaaa",
    recipient: "0xc89f8dd1ebc0e29561c4c3e9ad60ec307b9a473e",
    asset: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    assetSymbol: "GAS",
    amount: 50000000,
    approvalCount: 1,
    status: "pending",
    createdTime: 1700000000000,
    memo: "rent",
    ...overrides,
  };
}

describe("Neo Multisig PlayArea", () => {
  it("dispatches a createVault payload with signer addresses + threshold", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={baseState()} dispatch={dispatch} />);

    // Below the 2-signer minimum, creation is blocked.
    expect(
      screen.getByText("Add at least two signer addresses before creating a vault."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Create Vault" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    const signerFields = screen.getAllByLabelText(/Signer Address/);
    fireEvent.change(signerFields[0], { target: { value: SIGNER_A } });
    fireEvent.change(signerFields[1], { target: { value: SIGNER_B } });

    expect(
      screen.getByText("Ready to deploy an on-chain custody vault."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create Vault" }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createVault", {
        signers: [SIGNER_A, SIGNER_B],
        threshold: 2,
      }),
    );
  });

  it("rejects invalid signer addresses in the create form", () => {
    const dispatch = vi.fn();
    render(<PlayArea t={t} state={baseState()} dispatch={dispatch} />);

    const signerFields = screen.getAllByLabelText(/Signer Address/);
    fireEvent.change(signerFields[0], { target: { value: "not-an-address" } });
    fireEvent.change(signerFields[1], { target: { value: SIGNER_B } });

    expect(
      screen.getByText("Each signer must be a valid Neo N3 address."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Create Vault" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows vault balance and enables deposit + propose once a vault is active", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({ activeVault: vault(), vaultCount: 1 })}
        dispatch={dispatch}
      />,
    );

    // Vault id receipt + GAS balance (1e8 base units => "1") are rendered.
    expect(document.body.textContent).toContain("#7");
    expect(
      document.querySelector(".multisig-signer-panel")?.textContent,
    ).toContain("1");

    // Deposit
    fireEvent.change(
      screen.getAllByLabelText("Amount")[0],
      { target: { value: "2" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("deposit", {
        vaultId: 7,
        asset: "GAS",
        amount: "2",
      }),
    );

    // Propose a spend
    fireEvent.change(screen.getByLabelText("Recipient Address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getAllByLabelText("Amount")[1], {
      target: { value: "0.5" },
    });
    fireEvent.change(screen.getByLabelText("Memo"), {
      target: { value: "rent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Propose Spend" }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("proposeRequest", {
        vaultId: 7,
        asset: "GAS",
        recipient: RECIPIENT,
        amount: "0.5",
        memo: "rent",
      }),
    );
  });

  it("blocks a proposal that exceeds the vault balance with an inline hint", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    // Vault holds 1 GAS (gasBalance 1e8). A spend of 2 GAS must be blocked
    // up front (button disabled + insufficient-balance hint), not via a toast.
    render(
      <PlayArea
        t={t}
        state={baseState({ activeVault: vault(), vaultCount: 1 })}
        dispatch={dispatch}
      />,
    );

    fireEvent.change(screen.getByLabelText("Recipient Address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getAllByLabelText("Amount")[1], {
      target: { value: "2" },
    });

    expect(
      screen.getByText(
        "Amount exceeds the vault balance (1 GAS available).",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Propose Spend" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    // Lowering the amount within balance clears the block and re-enables propose.
    fireEvent.change(screen.getAllByLabelText("Amount")[1], {
      target: { value: "0.5" },
    });
    expect(
      screen.queryByText(
        "Amount exceeds the vault balance (1 GAS available).",
      ),
    ).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Propose Spend" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("renders request status + approval progress and approves", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    // v2 gates Approve on signer membership: the connected wallet must be a
    // vault signer who has not yet approved (both read back on-chain) — a
    // non-signer / already-approved approve would otherwise revert.
    render(
      <PlayArea
        t={t}
        state={baseState({
          activeVault: vault(),
          activeRequest: request({ approvalCount: 1 }),
          connectedAddress: SIGNER_B,
          connectedIsSigner: true,
          connectedHasApproved: false,
        })}
        dispatch={dispatch}
      />,
    );

    // Status label + amount + approvals 1/2 are reflected from the request.
    expect(
      document.querySelector(".multisig-request-details")?.textContent,
    ).toContain("Pending");
    expect(
      document.querySelector(".multisig-request-details")?.textContent,
    ).toContain("0.5 GAS");
    expect(
      document.querySelector(".multisig-request-details")?.textContent,
    ).toContain("1 / 2");

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("approveRequest", 4),
    );
  });

  it("disables approve/cancel once a request is executed", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          activeVault: vault(),
          activeRequest: request({ status: "executed", approvalCount: 2 }),
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      document.querySelector(".multisig-request-details")?.textContent,
    ).toContain("Executed");
    expect(
      (screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("offers cancel to ANY connected signer on a pending request (v2 — not creator-only)", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    // The connected wallet is a co-signer, NOT the request creator. v2 lets any
    // vault signer cancel, so the affordance must stay enabled and dispatch.
    // Cancel is membership-gated (any signer, not creator-only): the connected
    // wallet is flagged as a vault signer (read back on-chain as connectedIsSigner).
    render(
      <PlayArea
        t={t}
        state={baseState({
          activeVault: vault(),
          activeRequest: request({ approvalCount: 1 }),
          connectedAddress: SIGNER_B,
          connectedIsSigner: true,
        })}
        dispatch={dispatch}
      />,
    );

    const cancelButton = screen.getByRole("button", {
      name: "Cancel",
    }) as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(false);

    fireEvent.click(cancelButton);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("cancelRequest", 4),
    );
  });

  it("explains a RequestUnfunded auto-cancel instead of a bare cancelled status (v2)", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          activeVault: vault(),
          activeRequest: request({ status: "cancelled", approvalCount: 2 }),
          unfundedNotice: {
            requestId: 4,
            required: "0.5",
            available: "0.1",
            asset: "GAS",
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      document.querySelector(".multisig-request-details")?.textContent,
    ).toContain("Cancelled");
    expect(
      screen.getByText(
        "Auto-cancelled at threshold: the vault was underfunded (needed 0.5 GAS, held 0.1). Deposit again, then propose a new request.",
      ),
    ).toBeTruthy();
    // The auto-cancelled request offers no further approve/cancel actions.
    expect(
      (screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("does not show the unfunded notice for a different request id", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          activeVault: vault(),
          activeRequest: request({ status: "cancelled" }),
          unfundedNotice: {
            requestId: 99,
            required: "0.5",
            available: "0.1",
            asset: "GAS",
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Auto-cancelled at threshold/)).toBeNull();
  });
});
