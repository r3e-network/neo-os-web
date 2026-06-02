import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-multisig/src/PlayArea";
import type { MultisigRequest } from "../../neo-multisig/src/services/api";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const SIGNER_A = `02${"11".repeat(32)}`;
const SIGNER_B = `03${"22".repeat(32)}`;
const RECIPIENT = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";

function t(key: string) {
  const messages: Record<string, string> = {
    amountLabel: "Amount",
    amountPlaceholder: "0.00",
    ariaSigners: "Signers",
    assetGas: "GAS",
    assetLabel: "Asset",
    assetNeo: "NEO",
    chainLabel: "Network",
    chainMainnet: "Neo N3 MainNet",
    chainTestnet: "Neo N3 TestNet",
    detailId: "Request ID",
    loadButton: "Load",
    loadPlaceholder: "Enter multisig ID",
    loadTitle: "Load Existing Request",
    memoLabel: "Memo",
    memoPlaceholder: "Short note for signers",
    multisigAmountBlocked: "Enter the transfer amount before creating the request.",
    multisigBroadcastTitle: "Broadcast",
    multisigCompletedMetric: "Completed",
    multisigCreateReady: "Ready to prepare an unsigned Neo N3 transfer request.",
    multisigDraftState: "Draft safe",
    multisigHeroEyebrow: "Shared treasury",
    multisigHeroSubtitle: "Prepare a shared Neo transaction.",
    multisigHeroTitle: "Multisig Approval Desk",
    multisigNeedSigners: "Add at least two signer public keys before creating a request.",
    multisigNetworkTitle: "Network",
    multisigPendingMetric: "Pending",
    multisigQuorumTitle: "Quorum",
    multisigReceiptCopy: "Share this request ID with signers.",
    multisigRecipientBlocked: "Enter a recipient address for the transfer.",
    multisigRequestCopy: "Enter signer keys and transfer details.",
    multisigRequestTitle: "Request workspace",
    multisigRouteBroadcast: "Submit tx",
    multisigRouteCopy: "Create, sign, then broadcast.",
    multisigRouteCreate: "Build request",
    multisigRouteSign: "Collect signatures",
    multisigRouteTitle: "Execution route",
    multisigScriptHashLabel: "Script Hash",
    multisigSignerCopy: "Only listed keys can approve.",
    multisigSignerList: "Signer list",
    multisigSignerTitle: "Signer controls",
    multisigThreshold: "2 of 3",
    multisigThresholdBlocked: "Threshold cannot be greater than the number of signer keys.",
    multisigTotalMetric: "Total",
    multisigWalletReviewed: "Wallet reviewed",
    recentEmpty: "No recent requests yet.",
    recentTitle: "Recent Activity",
    reviewFees: "Estimated Fees",
    reviewSigners: "Signers",
    signerLabel: "Signer Public Key",
    signerPlaceholder: "Compressed public key (02/03...)",
    sidebarNoActivity: "No Activity Yet",
    statusBroadcasted: "Broadcasted",
    statusCancelled: "Cancelled",
    statusExpired: "Expired",
    statusLabel: "Status",
    statusPending: "Pending",
    statusReady: "Ready",
    statusUnknown: "Unknown",
    thresholdLabel: "Signature Threshold",
    toAddressLabel: "Recipient Address",
    toAddressPlaceholder: "N3 address",
    buttonCreate: "Create Request",
  };
  return messages[key] ?? key;
}

function baseState(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    completedCount: 0,
    history: [],
    isCreatingRequest: false,
    isLoadingRequest: false,
    lastRequest: null,
    pendingCount: 0,
    selectedRequest: null,
    totalTxs: 0,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function request(overrides: Partial<MultisigRequest> = {}): MultisigRequest {
  return {
    id: "req-neo-multisig-001",
    chain_id: "neo-n3-testnet",
    script_hash: "0x1111111111111111111111111111111111111111",
    threshold: 2,
    signers: [SIGNER_A, SIGNER_B],
    transaction_hex: "00aabb",
    signatures: {},
    status: "pending",
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Neo Multisig PlayArea", () => {
  it("dispatches a real createRequest payload from the primary workspace", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea t={t} state={baseState()} dispatch={dispatch} />,
    );

    expect(screen.getByText("Add at least two signer public keys before creating a request.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Create Request" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    const signerFields = screen.getAllByLabelText(/Signer Public Key/);
    fireEvent.change(signerFields[0], { target: { value: SIGNER_A } });
    fireEvent.change(signerFields[1], { target: { value: SIGNER_B } });
    fireEvent.change(screen.getByLabelText("Recipient Address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "0.03" },
    });
    fireEvent.change(screen.getByLabelText("Memo"), {
      target: { value: "team payout" },
    });

    expect(screen.getByText("Ready to prepare an unsigned Neo N3 transfer request.")).toBeTruthy();
    expect(
      document.querySelector(".multisig-signer-panel")?.textContent,
    ).toContain("Signers2");
    expect(
      document.querySelector(".multisig-signer-panel")?.textContent,
    ).toContain("Signature Threshold2 / 2");
    expect(
      document.querySelector(".multisig-route-panel")?.textContent,
    ).toContain("Neo N3 TestNet");
    fireEvent.click(screen.getByRole("button", { name: "Create Request" }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createRequest", {
        signers: [SIGNER_A, SIGNER_B],
        threshold: 2,
        selectedChain: "neo-n3-testnet",
        asset: "GAS",
        toAddress: RECIPIENT,
        amount: "0.03",
        memo: "team payout",
      }),
    );
  });

  it("renders created or loaded request details and keeps load gated by ID", () => {
    const selectedRequest = request({ signatures: { [SIGNER_A]: "sig" } });

    render(
      <PlayArea
        t={t}
        state={baseState({
          history: [
            {
              id: selectedRequest.id,
              scriptHash: selectedRequest.script_hash,
              status: selectedRequest.status,
              createdAt: selectedRequest.created_at,
            },
          ],
          lastRequest: selectedRequest,
          pendingCount: 1,
          selectedRequest,
          totalTxs: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(document.body.textContent).toContain("req-neo-...ig-001");
    expect(screen.getByText("Share this request ID with signers.")).toBeTruthy();
    expect(document.body.textContent).toContain("1 / 2");
    expect(
      (screen.getByRole("button", { name: "Load" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
