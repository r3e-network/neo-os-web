import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-multisig/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const SIGNER_A = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const SIGNER_B = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";
const SIGNER_C = "NfgHwwTi3wHAS8aFAN243C5vGbkYDpqLHP";
const RECIPIENT = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";

function t(k: string, params?: Record<string, string | number>) {
  const m: Record<string, string> = {
    appTitle: "Multisig",
    appSubtitle: "Multi-signature vaults",
    docDescription: "Manage multisig vaults.",
    multisigHeroEyebrow: "On-chain custody",
    multisigHeroSubtitle: "Deposit and approve.",
    buttonCreateVault: "Create Vault",
    buttonApprove: "Approve",
    buttonApproving: "Approving...",
    buttonPropose: "Propose",
    buttonCancel: "Cancel",
    buttonCancelling: "Cancelling...",
    buttonDeposit: "Deposit",
    approvalProgress: "{count} / {total} approvals",
    amountPlaceholder: "Amount",
    multisigVaultTitle: "Custody vault",
    multisigVaultBadge: "Vault",
    multisigSignerCopy: "Only listed signer addresses can approve a spend.",
    multisigSignerList: "Signers",
    multisigNeedSigners: "Add at least two signer addresses",
    multisigQuorumTitle: "Threshold",
    multisigCreateReady: "Ready to deploy",
    multisigProposalPreview: "Proposal docket",
    multisigApprovalBoard: "Approval board",
    multisigRouteCreate: "Create vault",
    multisigRouteSign: "Propose spend",
    multisigRouteBroadcast: "Approve & release",
    multisigLoadTitle: "Load vault or request",
    multisigLoadCopy: "Load a vault or request to continue.",
    loadVaultTitle: "Load vault",
    loadVaultPlaceholder: "Vault ID",
    loadRequestTitle: "Load request",
    loadRequestPlaceholder: "Request ID",
    loadButton: "Load",
    multisigVaultIdLabel: "Vault ID",
    signerLabel: "Signer Address",
    signerPlaceholder: "Neo N3 address",
    thresholdLabel: "Approval Threshold",
    assetLabel: "Asset",
    amountLabel: "Amount",
    toAddressLabel: "Recipient Address",
    toAddressPlaceholder: "N3 address",
    memoLabel: "Memo",
    memoPlaceholder: "Short note",
    multisigVaultCopy: "Enter signers.",
    multisigAddSigner: "+ Add signer",
    multisigRemoveSigner: "Remove signer",
    multisigGasAssetHint: "Fee token, 8 decimals",
    multisigNeoAssetHint: "Whole-token custody",
    multisigDepositVaultTarget: "Deposit target",
    multisigRecipientTicket: "Recipient",
    multisigDepositAmountControl: "Deposit amount",
    multisigSpendAmountControl: "Spend amount",
    multisigDecreaseAmount: "Decrease amount",
    multisigIncreaseAmount: "Increase amount",
    multisigQuickAmount: "Quick amounts",
    multisigUseVaultBalance: "Max",
    multisigDepositAmountHint: "Paid from the connected wallet into this vault.",
    multisigSpendAmountHint: "{balance} {asset} in this vault before pending requests.",
    multisigSignerRoster: "Signer roster",
    multisigConnectedAs: "Connected as",
    multisigNotConnected: "Connect a wallet",
    multisigBalanceTitle: "Vault balance",
    multisigAmountPreview: "Amount to release",
    multisigRecipientPreview: "Recipient pending",
    multisigPooledBalanceNote: "Vault balance is shared.",
    multisigShareRequestId: "Share this request ID.",
    recentTitle: "Recent Activity",
    recentEmpty: "No vaults or requests yet.",
    sidebarTotalTxs: "Vaults",
    statPending: "Pending",
    statCompleted: "Executed",
    statusPending: "Pending",
    statusExecuted: "Executed",
    statusCancelled: "Cancelled",
    multisigInvalidSignerAddress: "Each signer must be a valid Neo N3 address.",
    multisigDuplicateSigners: "Signer addresses must be distinct.",
    multisigTooManySigners: "Too many signers.",
    multisigThresholdBlocked: "Threshold cannot be greater than signers.",
    toastInvalidAmount: "Invalid amount.",
    toastInvalidAddress: "Invalid address.",
    multisigNotSignerHint: "Only signers can approve or cancel.",
    multisigAlreadyApprovedHint: "Already approved.",
  };
  let value = m[k] ?? k;
  if (params) {
    for (const [name, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(paramValue));
    }
  }
  return value;
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = {
    vaultCount: 0,
    pendingCount: 0,
    completedCount: 0,
    connectedAddress: "",
    connectedIsSigner: false,
    connectedHasApproved: false,
    activeVault: null,
    activeRequest: null,
    unfundedNotice: "",
    isCreatingVault: false,
    isDepositing: false,
    isProposing: false,
    isApproving: false,
    isCancelling: false,
    isLoading: false,
    history: [],
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}

describe("Neo Multisig PlayArea (v3)", () => {
  it("renders the vault signing room instead of a form placeholder", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".multisig-workbench")).toBeTruthy();
    expect(container.querySelector(".multisig-vault-card")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".multisig-vault-card__image")?.getAttribute("src")).toContain("multisig-vault-stage.webp");
    expect(container.querySelector(".multisig-approval-card")).toBeTruthy();
    expect(container.querySelector(".multisig-load-panel")).toBeTruthy();
    expect(container.querySelector(".multisig-signer-board")).toBeTruthy();
    expect(container.querySelector(".multisig-workbench input")).toBeNull();
    expect(container.querySelector(".multisig-scene__backdrop")).toBeFalsy();
  });

  it("dispatches createVault with the edited signer payload", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    const signerInputs = container.querySelectorAll(".multisig-signer-input input");
    fireEvent.change(signerInputs[0], { target: { value: SIGNER_A } });
    fireEvent.change(signerInputs[1], { target: { value: SIGNER_B } });
    fireEvent.change(container.querySelector(".multisig-threshold-input input") as Element, { target: { value: "2" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    expect(d).toHaveBeenCalledWith("createVault", { signers: [SIGNER_A, SIGNER_B], threshold: 2 });
  });

  it("shows approval progress when request is active", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          activeVault: { id: 2, threshold: 2, signers: [SIGNER_A, SIGNER_B, SIGNER_C] },
          activeRequest: { id: 1, approvalCount: 1, status: "pending", amount: 500000000, assetSymbol: "GAS", recipient: RECIPIENT },
          connectedIsSigner: true,
          connectedHasApproved: false,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".multisig-approval-meter")).toBeTruthy();
    expect(container.textContent).toContain("1 / 2 approvals");
    expect(container.textContent).toContain("Request #1");
    expect(container.textContent).toContain("5 GAS");
  });

  it("dispatches loadVault and loadRequest from the drawer tools", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(container.querySelectorAll(".multisig-drawer-tabs__group .semi-radio")[3]);

    fireEvent.change(container.querySelector(".multisig-load-vault-input input") as Element, { target: { value: "42" } });
    fireEvent.click(container.querySelectorAll(".multisig-drawer-action")[0]);
    expect(d).toHaveBeenCalledWith("loadVault", "42");

    fireEvent.change(container.querySelector(".multisig-load-request-input input") as Element, { target: { value: "9" } });
    fireEvent.click(container.querySelectorAll(".multisig-drawer-action")[1]);
    expect(d).toHaveBeenCalledWith("loadRequest", "9");
  });

  it("dispatches deposit and propose with drawer draft payloads", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ activeVault: { id: 7, threshold: 2, signers: [SIGNER_A, SIGNER_B], gasBalance: 0, neoBalance: 0 } })}
        dispatch={d}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    fireEvent.click(container.querySelectorAll(".multisig-drawer-tabs__group .semi-radio")[1]);
    expect(container.querySelector(".multisig-target-card")).toBeTruthy();
    expect(container.querySelector(".multisig-deposit-amount")).toBeTruthy();
    fireEvent.change(container.querySelector(".multisig-deposit-amount input") as Element, { target: { value: "1.25" } });
    fireEvent.click(container.querySelector(".multisig-drawer-action") as Element);
    expect(d).toHaveBeenCalledWith("deposit", { vaultId: 7, asset: "GAS", amount: "1.25" });

    fireEvent.click(container.querySelectorAll(".multisig-drawer-tabs__group .semi-radio")[2]);
    expect(container.querySelector(".multisig-spend-ticket")).toBeTruthy();
    expect(container.querySelector(".multisig-recipient-card")).toBeTruthy();
    expect(container.querySelector(".multisig-spend-amount")).toBeTruthy();
    fireEvent.change(container.querySelector(".multisig-recipient-card input") as Element, { target: { value: RECIPIENT } });
    expect(container.querySelector(".multisig-recipient-card")?.getAttribute("data-valid")).toBe("true");
    fireEvent.change(container.querySelector(".multisig-spend-amount input") as Element, { target: { value: "2" } });
    fireEvent.change(container.querySelector(".multisig-memo-ticket textarea") as Element, { target: { value: "Ops payout" } });
    fireEvent.click(container.querySelector(".multisig-drawer-action") as Element);
    expect(d).toHaveBeenCalledWith("proposeRequest", { vaultId: 7, asset: "GAS", recipient: RECIPIENT, amount: "2", memo: "Ops payout" });
  });

  it("shows history in drawer without document headings", () => {
    const { container } = render(<PlayArea t={t} state={state({ history: [{ kind: "vault", id: "1", status: "active" }] })} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(container.querySelectorAll(".multisig-drawer-tabs__group .semi-radio")[4]);
    expect(container.textContent).toContain("vault");
    expect(container.querySelector(".multisig-drawer h4")).toBeNull();
  });

  it("keeps the multisig surface clean and resource-led", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-multisig/src/PlayArea.scss`, "utf8");
    const tsx = fs.readFileSync(`${process.cwd()}/../neo-multisig/src/PlayArea.tsx`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/0\.001ms/);
    expect(s).toMatch(/\.neo-multisig-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(s).toMatch(/\.neo-multisig-play-area \.mx2-action-rail,[\s\S]*\.neo-multisig-play-area \.mx2-drawer\s*\{[\s\S]*width:\s*min\(100%,\s*820px\)/);
    expect(s).toMatch(/\.multisig-workbench\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-vault-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-vault-card::before\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.multisig-signer-board\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.multisig-vault-card__art\s*\{[\s\S]*grid-template-rows:\s*minmax\(172px,\s*1fr\) auto/);
    expect(s).toMatch(/\.multisig-vault-card__art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-vault-card__art::after\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*object-position:\s*62% center/);
    expect(s).toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.multisig-keyring\s*\{[\s\S]*position:\s*relative/);
    expect(s).not.toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*opacity:\s*0\.44/);
    expect(s).not.toMatch(/\.multisig-vault-card__image\s*\{[\s\S]*filter:\s*saturate/);
    expect(s).toMatch(/\.multisig-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.multisig-drawer-flow--split\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px,\s*0\.78fr\) minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.multisig-target-card\s*,[\s\S]*\.multisig-recipient-card\s*,[\s\S]*\.multisig-amount-console\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.multisig-amount-console__stepper\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) 38px/);
    expect(s).toMatch(/\.multisig-amount-console__quick\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.multisig-ticket-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.neo-multisig-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 190px/);
    expect(tsx).toContain('import { CoinArt } from "@shared/art";');
    expect(tsx).toContain('dispatch("approveRequest", requestId)');
    expect(tsx).toContain('dispatch("createVault", createPayload)');
    expect(tsx).not.toContain('dispatch("createVault", {})');
    expect(tsx).not.toContain('dispatch("approveRequest", activeRequest)');
    expect(s).not.toMatch(/AI-generated scene backdrop|swap-scene|multisig-scene__backdrop|background-image:\s*none !important/);
  });
});
