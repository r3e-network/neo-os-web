import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-multisig/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
const SIGNER_A = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const SIGNER_B = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";
function t(k: string, params?: Record<string, string | number>) {
  const m: Record<string,string> = {
    appTitle:"Multisig", appSubtitle:"Vaults", docDescription:"Manage",
    multisigHeroEyebrow:"Custody", multisigHeroSubtitle:"Deposit and approve",
    buttonCreateVault:"Create", buttonApprove:"Approve", buttonApproving:"Approving...",
    buttonPropose:"Propose", buttonCancel:"Cancel", buttonCancelling:"Cancelling...",
    buttonDeposit:"Deposit", approvalProgress:"Approval", amountPlaceholder:"Amount",
    multisigVaultTitle:"Vault", multisigVaultBadge:"Vault", multisigSignerCopy:"Signer copy",
    multisigSignerList:"Signers", multisigNeedSigners:"Need signers", multisigQuorumTitle:"Threshold",
    multisigCreateReady:"Ready", multisigProposalPreview:"Proposal", multisigApprovalBoard:"Board",
    multisigRouteCreate:"Create", multisigRouteSign:"Propose", multisigRouteBroadcast:"Approve",
    multisigLoadTitle:"Tools", multisigLoadCopy:"Load", loadVaultTitle:"Load vault",
    loadVaultPlaceholder:"Vault ID", loadRequestTitle:"Load request", loadRequestPlaceholder:"Request ID",
    loadButton:"Load", multisigVaultIdLabel:"Vault ID", signerLabel:"Signer", signerPlaceholder:"Address",
    thresholdLabel:"Threshold", assetLabel:"Asset", amountLabel:"Amount", toAddressLabel:"Recipient",
    toAddressPlaceholder:"N3 address", memoLabel:"Memo", memoPlaceholder:"Memo", multisigVaultCopy:"Create copy",
    multisigAddSigner:"+ Add signer", multisigRemoveSigner:"Remove signer", multisigGasAssetHint:"Gas",
    multisigNeoAssetHint:"Neo", multisigDepositVaultTarget:"Deposit target", multisigRecipientTicket:"Recipient",
    multisigDepositAmountControl:"Deposit amount", multisigSpendAmountControl:"Spend amount",
    multisigDecreaseAmount:"Decrease amount", multisigIncreaseAmount:"Increase amount",
    multisigQuickAmount:"Quick amounts", multisigUseVaultBalance:"Max",
    multisigDepositAmountHint:"Paid from wallet", multisigSpendAmountHint:"{balance} {asset} available",
    multisigSignerRoster:"Roster", multisigConnectedAs:"Connected",
    multisigNotConnected:"Connect", multisigBalanceTitle:"Balance", multisigAmountPreview:"Amount",
    multisigRecipientPreview:"Recipient", multisigPooledBalanceNote:"Pooled", multisigShareRequestId:"Share",
    recentTitle:"Recent", recentEmpty:"Empty", sidebarTotalTxs:"Vaults", statPending:"Pending",
    statCompleted:"Done", statusPending:"Pending", multisigInvalidSignerAddress:"Invalid signer",
    multisigDuplicateSigners:"Duplicate", multisigTooManySigners:"Too many", multisigThresholdBlocked:"Blocked",
    toastInvalidAmount:"Invalid amount", toastInvalidAddress:"Invalid address", multisigNotSignerHint:"Not signer",
    multisigAlreadyApprovedHint:"Approved",
  };
  let value = m[k] ?? k;
  if (params) for (const [name, paramValue] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(paramValue));
  return value;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { connectedAddress:"", connectedIsSigner:false, connectedHasApproved:false, activeVault:null, activeRequest:null, signerApprovals:[], unfundedNotice:"", vaultSource:"none", requestSource:"none", approvalSource:"none", historySource:"none", pendingOperation:null, transactionNotice:"", contractHash:"", isRecovering:false, isCreatingVault:false, isDepositing:false, isProposing:false, isApproving:false, isCancelling:false, isLoading:false, history:[], ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("neo-multisig integration: dispatch params", () => {
  it("dispatches createVault with signer and threshold payload", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const signerInputs = container.querySelectorAll(".multisig-signer-input input");
    fireEvent.change(signerInputs[0], { target: { value: SIGNER_A } });
    fireEvent.change(signerInputs[1], { target: { value: SIGNER_B } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(d).toHaveBeenCalledWith("createVault", { signers: [SIGNER_A, SIGNER_B], threshold: 2 });
  });
  it("dispatches approveRequest with request id when signer + pending request", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const req = { id:1, status:"pending" };
    const { container } = render(<PlayArea t={t} state={state({ activeRequest: req, connectedIsSigner:true, connectedHasApproved:false, approvalSource:"chain" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(d).toHaveBeenCalledWith("approveRequest", 1);
  });
  it("shows approval bar when request is active", () => {
    const { container } = render(<PlayArea t={t} state={state({ activeRequest:{id:"r1"}, connectedIsSigner:true })} dispatch={vi.fn()} />);
    expect(container.querySelector(".multisig-approval-meter")).toBeTruthy();
    expect(container.textContent).toContain("Approval");
  });
});
