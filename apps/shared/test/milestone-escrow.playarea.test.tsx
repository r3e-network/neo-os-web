import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../milestone-escrow/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Milestone Escrow",
    createEscrow: "Create Escrow",
    connectWallet: "Connect Wallet",
    noFeeNotice: "No platform fee.",
    statusActive: "Active",
    statusCompleted: "Completed",
    totalAmount: "Total",
    assetType: "Asset",
    assetNeoHint: "Whole NEO releases",
    assetGasHint: "Precise GAS tranches",
    beneficiary: "Beneficiary",
    beneficiaryPlaceholder: "Beneficiary address",
    milestoneAmountPlaceholder: "Amount",
    milestoneNumber: "M{n}",
    milestonesLabel: "Milestones",
    addMilestone: "Add milestone",
    removeMilestone: "Remove milestone {index}",
    twoStepSignBadge: "Signing...",
    releaseDeskTitle: "Ready to create",
    releaseDeskCopy: "Build a staged payout plan.",
    releaseWorkbench: "Escrow workbench",
    escrowStation: "Escrow Station",
    stationTabs: "Escrow station modes",
    stationSetupTab: "Setup",
    stationSetupMeta: "Asset + route",
    stationPreviewTab: "Preview",
    stationPreviewMeta: "Release path",
    stationSafetyTab: "Safety",
    stationSafetyMeta: "Before signing",
    stationSetupTitle: "Build the funded route",
    stationPreviewTitle: "Review the release path",
    stationSafetyTitle: "Know what signs",
    setupPlan: "Setup plan",
    setupAndEscrows: "Setup & escrows",
    needsSetup: "Needs setup",
    readyToSign: "Ready to sign",
    previewPending: "Draft route",
    recipientReady: "Recipient set",
    previewTicketCopy: "{count} release gates will fund in {asset}.",
    releaseRouteTitle: "Release route",
    fundingAsset: "Funding asset",
    releaseTranches: "Release tranches",
    trancheCount: "{done}/{count} funded",
    recipientPending: "Recipient pending",
    fundedGate: "Funded",
    draftGate: "Draft",
    totalHint: "Sum of milestone amounts",
    dealControlsHint: "Fill in details",
    dealControls: "Deal controls",
    twoStepSignNotice: "Two signatures for {asset}",
    connectToStart: "Connect to start",
    introLede: "Lock funds and release by milestone.",
    deploymentPendingTitle: "Not available",
    deploymentPendingDesc: "Contract is not configured.",
    escrowsTab: "Escrows",
    createdByYou: "Created by you",
    forYou: "For you",
    emptyEscrows: "No escrows.",
    approve: "Approve",
    approving: "Approving...",
    claim: "Claim",
    claiming: "Claiming...",
    cancel: "Cancel",
    cancelling: "Cancelling...",
    confirmCancelRefund: "Cancel and refund {amount}?",
    howItWorks: "How it works",
    step1: "Define milestones.",
    step2: "Deposit + create.",
    step3: "Approve + claim.",
    beneficiaryApprovalNote: "Funds release only after approval.",
    escrowName: "Escrow name",
    escrowNamePlaceholder: "Website delivery escrow",
    notes: "Notes",
    notesPlaceholder: "Describe delivery criteria",
    idPrefix: "#",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    contractReady: true,
    isRefreshing: false,
    isCreating: false,
    approvingId: null,
    claimingId: null,
    cancellingId: null,
    activeCount: 1,
    completedCount: 0,
    creatorEscrows: [],
    beneficiaryEscrows: [],
    statusLabelFunc: (s: string) => s,
    formatAmountFunc: (sym: string, amt: bigint) => `${amt} ${sym}`,
    formatAddressFunc: (a: string) => a,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

describe("Milestone Escrow PlayArea (v2 scene-driven)", () => {
  it("renders the clean foreground escrow workbench", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".escrow-workbench")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".escrow-vault-card__image")?.getAttribute("src")).toContain("milestone-escrow-stage.webp");
    expect(container.querySelector(".escrow-vault-card")).toBeTruthy();
    expect(container.querySelector(".escrow-station")).toBeTruthy();
    expect(container.querySelector(".escrow-station__head")?.textContent).toContain("Escrow Station");
    expect(container.querySelectorAll(".escrow-station-tabs button")).toHaveLength(3);
    expect(container.querySelector(".escrow-swap-stack")).toBeTruthy();
    expect(container.querySelector(".escrow-token-row--asset")).toBeTruthy();
    expect(container.querySelector(".escrow-token-row--beneficiary")).toBeTruthy();
    expect(container.querySelector(".escrow-asset-dock")).toBeTruthy();
    expect(container.querySelector(".escrow-release-editor--station")).toBeTruthy();
    expect(container.querySelector(".escrow-workbench__wash")).toBeNull();
    expect(container.querySelector(".escrow-vault__amount strong")?.textContent).toBe("0 GAS");
    expect(container.querySelector(".escrow-gate")).toBeTruthy();
    expect(container.querySelector(".escrow-plan")).toBeNull();
    expect(container.querySelector(".escrow-counterparty")).toBeNull();
  });

  it("dispatches createEscrow with trimmed beneficiary and milestones", async () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.change(container.querySelector(".escrow-recipient-input") as Element, { target: { value: "  NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq  " } });
    fireEvent.change(container.querySelector(".escrow-gate__input") as Element, { target: { value: " 2 " } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createEscrow", expect.objectContaining({ beneficiary: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", milestones: [{ amount: "2" }] })));
  });

  it("keeps the release route interactive when switching asset and adding tranches", async () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(Array.from(container.querySelectorAll(".escrow-asset-card")).find((button) => button.textContent?.includes("NEO")) as Element);
    expect(container.querySelector(".escrow-release-editor__head")?.textContent).toContain("Whole NEO");

    fireEvent.click(container.querySelector(".escrow-gate--add") as Element);
    const amountInputs = container.querySelectorAll(".escrow-gate__input");
    expect(amountInputs.length).toBe(2);
    expect((amountInputs[0] as HTMLInputElement).inputMode).toBe("numeric");
    fireEvent.change(container.querySelector(".escrow-recipient-input") as Element, { target: { value: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq" } });
    fireEvent.change(amountInputs[0], { target: { value: "1.5" } });
    expect((amountInputs[0] as HTMLInputElement).value).toBe("1");
    fireEvent.change(amountInputs[1], { target: { value: "2" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        "createEscrow",
        expect.objectContaining({
          asset: "NEO",
          milestones: [{ amount: "1" }, { amount: "2" }],
        }),
      ),
    );
  });

  it("disables submit until beneficiary + amount are filled", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const btn = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("uses the primary action to connect when no wallet is present", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ address: "" })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connectWallet"));
  });

  it("blocks creation when the escrow contract is not configured", () => {
    const { container } = render(<PlayArea t={t} state={state({ contractReady: false })} dispatch={vi.fn()} />);
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector(".escrow-gate__input") as HTMLInputElement).disabled).toBe(true);
  });

  it("shows created escrows with approve/cancel in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ creatorEscrows: [{ id: "e1", status: "active", title: "Project X", assetSymbol: "GAS", totalAmount: 200000000n, milestoneApproved: [true, false], milestoneClaimed: [false, false] }] })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(Array.from(container.querySelectorAll(".escrow-drawer-tabs button")).find((button) => button.textContent?.includes("Created by you")) as Element);
    expect(container.textContent).toContain("Project X");
    const approveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Approve");
    expect(approveBtn).toBeTruthy();
  });

  it("uses designed Open UI panels and deal cards in the drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          creatorEscrows: [{ id: "e1", status: "active", title: "Project X", assetSymbol: "GAS", totalAmount: 200000000n, milestoneAmounts: [100000000n, 100000000n], milestoneApproved: [true, false], milestoneClaimed: [false, false] }],
          beneficiaryEscrows: [{ id: "e2", status: "active", title: "For me", assetSymbol: "NEO", totalAmount: 2n, milestoneAmounts: [1n, 1n], milestoneApproved: [true, true], milestoneClaimed: [true, false] }],
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelectorAll(".escrow-drawer-tabs button")).toHaveLength(3);
    expect(container.querySelectorAll(".escrow-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".escrow-drawer__panel--details")).toBeTruthy();
    expect(container.querySelector(".escrow-detail-field--asset .mx2-open-segmented")).toBeTruthy();
    expect(container.querySelector(".escrow-detail-field.mx2-open-field .mx2-open-field__control input.semi-input")).toBeTruthy();
    expect(container.querySelector(".escrow-detail-field.mx2-open-field .mx2-open-field__control--textarea textarea.semi-input-textarea")).toBeTruthy();
    expect(container.querySelector(".escrow-release-editor--drawer")).toBeTruthy();

    fireEvent.click(Array.from(container.querySelectorAll(".escrow-drawer-tabs button")).find((button) => button.textContent?.includes("Created by you")) as Element);
    expect(container.querySelectorAll(".escrow-ledger__item")).toHaveLength(1);
    expect(container.querySelectorAll(".escrow-ledger__progress")).toHaveLength(1);
    expect(container.querySelectorAll(".escrow-ledger__coin .mx2-coin")).toHaveLength(1);
    fireEvent.click(Array.from(container.querySelectorAll(".escrow-drawer-tabs button")).find((button) => button.textContent?.includes("For you")) as Element);
    expect(container.querySelectorAll(".escrow-ledger__item")).toHaveLength(1);
    expect(container.querySelector(".escrow-drawer__notice.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".escrow-drawer__panel h4")).toBeNull();
    expect(container.querySelector("section.escrow-drawer__panel")).toBeNull();
  });

  it("confirms cancel with the refund amount", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ creatorEscrows: [{ id: "e1", status: "active", title: "Project X", assetSymbol: "GAS", totalAmount: 200000000n, milestoneApproved: [false], milestoneClaimed: [false] }] })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(Array.from(container.querySelectorAll(".escrow-drawer-tabs button")).find((button) => button.textContent?.includes("Created by you")) as Element);
    const cancelBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Cancel") as HTMLButtonElement;
    fireEvent.click(cancelBtn);
    expect(confirmSpy).toHaveBeenCalledWith("Cancel and refund 2 GAS?");
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("cancelEscrow", expect.objectContaining({ id: "e1" })));
    confirmSpy.mockRestore();
  });

  it("shows beneficiary escrows with claim in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ beneficiaryEscrows: [{ id: "e2", status: "active", title: "For me", assetSymbol: "GAS", totalAmount: 100000000n, milestoneApproved: [true], milestoneClaimed: [false] }] })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(Array.from(container.querySelectorAll(".escrow-drawer-tabs button")).find((button) => button.textContent?.includes("For you")) as Element);
    expect(container.textContent).toContain("For me");
    const claimBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Claim");
    expect(claimBtn).toBeTruthy();
  });

  it("keeps motion and clean escrow foreground hierarchy backed by tests", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const stylePath = [
      path.resolve(process.cwd(), "apps/milestone-escrow/src/PlayArea.scss"),
      path.resolve(process.cwd(), "../milestone-escrow/src/PlayArea.scss"),
    ].find((candidate) => fs.existsSync(candidate));
    expect(stylePath).toBeTruthy();
    const styles = fs.readFileSync(stylePath, "utf8");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toMatch(/\.milestone-escrow-play-area \.mx2-cat-defi\s*\{[\s\S]*--mx2-accent:\s*#059669/);
    expect(styles).toMatch(/\.milestone-escrow-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 188px/);
    expect(styles).toMatch(/\.escrow-workbench\s*\{[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/\.escrow-workbench\s*\{[\s\S]*border:\s*0/);
    expect(styles).toMatch(/\.escrow-vault-card__image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.escrow-station\s*\{[\s\S]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.escrow-station-tabs\s*,[\s\S]*\.escrow-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.escrow-token-row\s*\{[\s\S]*grid-template-areas:/);
    expect(styles).toMatch(/\.escrow-recipient-input\s*\{[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/\.escrow-route-meter\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.escrow-asset-dock\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-pill\)/);
    expect(styles).toMatch(/\.escrow-asset-card\s*\{[\s\S]*display:\s*inline-flex/);
    expect(styles).toMatch(/\.escrow-release-editor\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.escrow-gate__input-wrap\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/\.escrow-drawer\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.escrow-drawer-tabs button\s*\{[\s\S]*min-height:\s*54px/);
    expect(styles).toMatch(/\.escrow-drawer__panel\.mx2-open-panel\.semi-card\s*\{/);
    expect(styles).toMatch(/\.escrow-drawer__panel--details\s*\{[\s\S]*grid-row:\s*auto/);
    expect(styles).toMatch(/\.escrow-drawer__form-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.escrow-ledger__item\s*\{[\s\S]*border-radius:\s*17px/);
    expect(styles).toMatch(/\.escrow-ledger__body\s*\{[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/\.escrow-ledger__progress\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).not.toMatch(/escrow-workbench__media|escrow-workbench__wash|var\(--mx2-scene-art-opacity|background-image:\s*url/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).not.toMatch(/radial-gradient/);
    expect(styles).not.toMatch(/linear-gradient/);
    expect(styles).not.toMatch(/\.escrow-asset-card small/);
    expect(styles).not.toMatch(/\.escrow-plan|\.escrow-counterparty|\.escrow-release-rail|\.escrow-setup__notice/);
    expect(styles).not.toMatch(/\.escrow-drawer__panel h4|\.escrow-detail-field textarea\s*\{[\s\S]*resize:\s*vertical/);
    expect(styles).not.toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.[0-8]/);
    expect(styles).toMatch(/escrow-vault[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/escrow-gate[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/escrow-token-row[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.milestone-escrow-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.escrow-vault-card\s*\{[\s\S]*grid-template-rows:\s*86px auto/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.escrow-station-tabs button\s*,[\s\S]*\.escrow-drawer-tabs button\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.escrow-route-meter\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.escrow-gate\s*\{[\s\S]*min-height:\s*70px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.escrow-drawer__form-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(styles).not.toContain("AI-generated scene backdrop");
    expect(styles).not.toContain(".tool-scene__backdrop");
  });
});
