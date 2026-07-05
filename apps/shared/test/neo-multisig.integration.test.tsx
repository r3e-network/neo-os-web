import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-multisig/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { const m: Record<string,string> = { appTitle:"Multisig", appSubtitle:"Vaults", docDescription:"Manage", buttonCreateVault:"Create", buttonApprove:"Approve", buttonApproving:"Approving...", buttonPropose:"Propose", buttonCancel:"Cancel", buttonDeposit:"Deposit", approvalProgress:"Approval", amountPlaceholder:"Amount", docFeature1Name:"F", docFeature1Desc:"D" }; return m[k] ?? k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { vaultCount:0, pendingCount:0, completedCount:0, connectedAddress:"", connectedIsSigner:false, connectedHasApproved:false, activeVault:null, activeRequest:null, unfundedNotice:"", isCreatingVault:false, isDepositing:false, isProposing:false, isApproving:false, isCancelling:false, isLoading:false, history:[], ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("neo-multisig integration: dispatch params", () => {
  it("dispatchs createVault when no active request", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(d).toHaveBeenCalledWith("createVault", {});
  });
  it("dispatchs approveRequest when signer + pending request", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const req = { id:"r1" };
    const { container } = render(<PlayArea t={t} state={state({ activeRequest: req, connectedIsSigner:true, connectedHasApproved:false })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(d).toHaveBeenCalledWith("approveRequest", req);
  });
  it("shows approval bar when request is active", () => {
    const { container } = render(<PlayArea t={t} state={state({ activeRequest:{id:"r1"}, connectedIsSigner:true })} dispatch={vi.fn()} />);
    expect(container.querySelector(".multisig-approval-meter")).toBeTruthy();
    expect(container.textContent).toContain("Approval");
  });
});
