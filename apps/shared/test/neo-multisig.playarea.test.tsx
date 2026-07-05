import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-multisig/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string, params?: Record<string, string | number>) {
  const m: Record<string,string> = {
    appTitle:"Multisig",
    appSubtitle:"Multi-signature vaults",
    docDescription:"Manage multisig vaults.",
    buttonCreateVault:"Create Vault",
    buttonApprove:"Approve",
    buttonApproving:"Approving...",
    buttonPropose:"Propose",
    buttonCancel:"Cancel",
    buttonDeposit:"Deposit",
    approvalProgress:"{count} / {total} approvals",
    amountPlaceholder:"Amount",
    docFeature1Name:"Feature",
    docFeature1Desc:"Description",
    multisigVaultTitle:"Custody vault",
    multisigVaultBadge:"Vault",
    multisigSignerCopy:"Only listed signer addresses can approve a spend.",
    multisigSignerList:"Signers",
    multisigNeedSigners:"Add at least two signer addresses",
    multisigQuorumTitle:"Threshold",
    multisigCreateReady:"Ready to deploy",
    multisigProposalPreview:"Proposal docket",
    multisigApprovalBoard:"Approval board",
    multisigRouteCreate:"Create vault",
    multisigRouteSign:"Propose spend",
    multisigRouteBroadcast:"Approve & release",
    multisigLoadTitle:"Load vault or request",
    loadVaultTitle:"Load vault",
    loadVaultPlaceholder:"Vault ID",
    loadButton:"Load",
    statusPending:"Pending",
  };
  let value = m[k] ?? k;
  if (params) for (const [name, paramValue] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(paramValue));
  return value;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { vaultCount:0, pendingCount:0, completedCount:0, connectedAddress:"", connectedIsSigner:false, connectedHasApproved:false, activeVault:null, activeRequest:null, unfundedNotice:"", isCreatingVault:false, isDepositing:false, isProposing:false, isApproving:false, isCancelling:false, isLoading:false, history:[], ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("Neo Multisig PlayArea (v2)", () => {
  it("renders the vault signing room instead of a form placeholder", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".multisig-workbench")).toBeTruthy();
    expect(container.querySelector(".multisig-vault-card")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".multisig-vault-card__image")?.getAttribute("src")).toContain("multisig-vault-stage.webp");
    expect(container.querySelector(".multisig-approval-card")).toBeTruthy();
    expect(container.querySelector(".multisig-load-panel")).toBeTruthy();
    expect(container.querySelector(".multisig-scene__backdrop")).toBeFalsy();
  });
  it("dispatchs createVault when no active request", () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />); fireEvent.click(container.querySelector(".mx2-btn--primary") as Element); expect(d).toHaveBeenCalledWith("createVault", {}); });
  it("shows approval progress when request is active", () => {
    const { container } = render(<PlayArea t={t} state={state({ activeVault:{ id:2, threshold:2, signers:["a","b","c"] }, activeRequest:{ id:"1", approvalCount:1, status:"pending" }, connectedIsSigner:true, connectedHasApproved:false })} dispatch={vi.fn()} />);
    expect(container.querySelector(".multisig-approval-meter")).toBeTruthy();
    expect(container.textContent).toContain("1 / 2 approvals");
    expect(container.textContent).toContain("Request #1");
  });
  it("dispatches loadVault from the compact lookup", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    const input = container.querySelector(".multisig-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.click(container.querySelector(".multisig-load-panel__button") as Element);
    expect(d).toHaveBeenCalledWith("loadVault", "42");
  });
  it("shows history in drawer", () => { const { container } = render(<PlayArea t={t} state={state({ history: [{ kind:"vault", id:"1", status:"active" }] })} dispatch={vi.fn()} />); fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element); expect(container.textContent).toContain("vault"); });
  it("keeps the multisig surface clean and resource-led", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-multisig/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/0\.001ms/);
    expect(s).toMatch(/\.neo-multisig-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-workbench\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-vault-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-vault-card::before\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.multisig-vault-card__art\s*\{[\s\S]*grid-template-rows:\s*minmax\(172px,\s*1fr\) auto/);
    expect(s).toMatch(/\.multisig-vault-card__art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-vault-card__art::after\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.multisig-keyring\s*\{[\s\S]*position:\s*relative/);
    expect(s).not.toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*opacity:\s*0\.44/);
    expect(s).not.toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*filter:\s*saturate/);
    expect(s).toMatch(/\.multisig-input\s*\{[\s\S]*border-bottom:\s*2px solid var\(--mx2-brand-subtle\)/);
    expect(s).toMatch(/\.neo-multisig-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 190px/);
    expect(s).not.toMatch(/AI-generated scene backdrop|swap-scene|multisig-scene__backdrop|background-image:\s*none !important/);
  });
});
