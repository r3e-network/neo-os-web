import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../quadratic-funding/src/PlayArea";
import { manifest } from "../../quadratic-funding/src/manifest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    qfHeroTitle: "Quadratic Funding",
    qfHeroSubtitle: "Crowd-funded matching pool.",
    qfDonorDeskTitle: "Donor desk",
    qfGasPoolLabel: "Matching pool",
    qfMatchingAvailable: "Available match",
    qfPickProject: "Project",
    qfNoProjectDescription: "No mission details yet.",
    qfVisitProject: "Visit {name}",
    qfDonationTicket: "Donation ticket",
    qfDonationDeskReady: "Ready to contribute",
    qfDonationDeskWaiting: "Waiting...",
    qfExploreAndManage: "Explore & manage",
    qfRefreshFundingData: "Refresh funding data",
    qfRefreshingFundingData: "Refreshing funding data...",
    qfNoProjectsTitle: "No projects yet",
    qfFundingGateEyebrow: "Funding launchpad",
    qfFundingNeedsRoundTitle: "Load or create a round before donation",
    qfFundingNeedsRoundBody: "A contribution needs an active round.",
    qfFundingNeedsProjectsTitle: "Projects needed",
    qfFundingNeedsProjectsBody: "Register a project to start funding.",
    qfSetupStatus: "Desk status",
    qfSetupLaneLabel: "Funding setup path",
    qfAmplifyCopy: "Many small donations are amplified.",
    qfAmplifyTitle: "Small gifts become a matched grant",
    selectRoundFirst: "Select a round first",
    contributing: "Contributing...",
    quickContribute: "Contribute",
    matchingRemaining: "Matching pool",
    projectCount: "Projects",
    qfSelectedRound: "Round",
    tabRounds: "Rounds",
    qfAmountPresets: "Contribution amount",
    contributionAmount: "Contribution amount",
    contributionAmountPlaceholder: "Amount",
    contributionMemo: "Memo",
    contributionMemoPlaceholder: "Optional memo",
    qfProjectMatchHint: "Raised",
    tabProjects: "Projects",
    qfDonationDetails: "Donation details",
    qfDonationDetailsHint: "Advanced project id and memo controls.",
    registerProject: "Register project",
    qfRegisterProjectHint: "Project intake for this round.",
    registeringProject: "Registering...",
    projectNamePlaceholder: "Name",
    projectDescriptionPlaceholder: "Description",
    projectLinkPlaceholder: "Link",
    projectsList: "Projects",
    emptyProjects: "No projects.",
    claimProject: "Claim",
    finalizeSuggested: "Finalize suggested",
    adminTools: "Admin tools",
    claimUnused: "Claim unused",
    cancelRound: "Cancel round",
    refresh: "Refresh",
    contributionRoundId: "Round",
    fundingSafetyChecking: "Checking contract",
    fundingSafetyReady: "Recovery verified",
    fundingSafetyLegacy: "Browse only",
    fundingBrowseOnlyAction: "Browse only",
    fundingReadyShort: "Funding ready",
    fundingCheckingShort: "Checking funding",
    fundingBrowseShort: "Explore mode",
    fundingPausedShort: "Funding paused",
    fundingUnavailableShort: "Funding unavailable",
    qfBrowseModeTitle: "Explore projects without signing",
    qfBrowseModeBody: "Live rounds and projects remain available.",
    qfSybilDisclosure: "Wallet count is not verified identity.",
    qfFundingDeskAlt: "Funding desk",
    pendingReviewTitle: "Review pending transaction",
    pendingStillWaiting: "Transaction {txid} is awaiting confirmation.",
    pendingRefreshAction: "Check chain state",
    pendingClearAction: "Forget local lock",
    pendingClearHint: "This does not cancel the transaction.",
    pendingRecoveryRequiredAction: "Recover prepaid credit first",
    pendingDepositMustRecover: "Recover credit before clearing.",
    pendingDepositRecovery: "Deposit {txid} needs recovery.",
    pendingIntentUncertain: "Wallet request interrupted.",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    rounds: [],
    selectedRound: null,
    selectedRoundId: "",
    isRefreshingRounds: false,
    isCreatingRound: false,
    isRegisteringProject: false,
    isContributing: false,
    isAddingMatching: false,
    isFinalizing: false,
    isClaimingUnused: false,
    isCancelling: false,
    isAdmin: false,
    canManageSelectedRound: false,
    canFinalizeSelectedRound: false,
    canClaimUnused: false,
    canCancelSelectedRound: false,
    suggestedMatches: [],
    projects: [],
    projectsComplete: true,
    claimableProjectIds: [],
    claimingProjectId: "",
    activeTab: "contribute",
    matchingPoolDisplay: "100 GAS",
    matchingRemainingDisplay: "100 GAS",
    matchPreviewMode: "estimate",
    selectedRoundDisplay: "Round #1",
    roundCount: 1,
    projectCount: 0,
    roundsStatus: null,
    deploymentStatus: "ready",
    deploymentMessage: "Recovery verified",
    fundingWritesEnabled: true,
    isCheckingDeployment: false,
    hasPendingOperation: false,
    pendingTxid: "",
    pendingPhase: "",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

describe("Quadratic Funding PlayArea (v2 scene-driven)", () => {
  it("renders the amplification flow scene", () => {
    const { container } = render(<PlayArea t={t} state={state({ selectedRound: { id: 1, title: "R1" }, projects: [{ id: "p1", name: "Proj" }] })} dispatch={vi.fn()} />);
    expect(container.querySelector(".qf-scene")).toBeTruthy();
    expect((container.querySelector(".qf-scene__art") as HTMLImageElement)?.src).toContain("funding-desk.webp");
    expect(container.querySelector(".qf-scene__round-snapshot")).toBeTruthy();
    expect(container.querySelectorAll(".qf-scene__node").length).toBe(2);
    expect(container.querySelector(".qf-scene__pool")).toBeTruthy();
  });

  it("shows a funding setup card instead of donation controls before the desk is ready", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(container.querySelector(".qf-setup-card")).toBeTruthy();
    expect(container.querySelector(".qf-scene--setup")).toBeTruthy();
    expect((container.querySelector(".qf-setup-card img") as HTMLImageElement)?.src).toContain("funding-desk.webp");
    expect(container.querySelector(".qf-setup-card__lane")).toBeTruthy();
    expect(container.querySelectorAll(".qf-setup-card__step")).toHaveLength(3);
    expect(container.querySelector(".qf-scene__desk")).toBeNull();
    expect(container.querySelector(".qf-scene__pool")).toBeNull();
    expect(container.querySelector(".qf-project-board")).toBeNull();
    expect(container.querySelector(".qf-pledge")).toBeNull();
    expect(container.textContent).toContain("Load or create a round before donation");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("refreshRounds");
  });

  it("dispatches contribute with selected project + custom amount", async () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ selectedRound: { id: 1 }, projects: [{ id: "p1", name: "Proj" }] })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(container.querySelector(".qf-project-card") as Element);
    const amountInput = container.querySelector(".qf-pledge-stepper__amount input") as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: ".5" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("contribute", expect.objectContaining({ projectId: "p1", amount: ".5" })));
  });

  it("keeps NEO round contributions as whole-number inputs", async () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ selectedRound: { id: 1, assetSymbol: "NEO" }, projects: [{ id: "p1", name: "Proj" }], matchingPoolDisplay: "100 NEO" })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".qf-project-card") as Element);
    const amountInput = container.querySelector(".qf-pledge-stepper__amount input") as HTMLInputElement;
    expect(amountInput.inputMode).toBe("numeric");
    fireEvent.change(amountInput, { target: { value: "3.75" } });
    expect(amountInput.value).toBe("3");
    expect(container.textContent).toContain("3 NEO");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("contribute", expect.objectContaining({ projectId: "p1", amount: "3" })));
  });

  it("reselects a valid project when the project list changes", async () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const appState = state({ selectedRound: { id: 1 }, projects: [{ id: "p1", name: "Proj" }] });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    await waitFor(() => expect(container.textContent).toContain("Proj"));
    act(() => {
      appState.projects.set([{ id: "p2", name: "New project" }]);
    });

    await waitFor(() => expect(container.textContent).toContain("New project"));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("contribute", expect.objectContaining({ projectId: "p2" })));
  });

  it("dispatches registerProject from the drawer", async () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <PlayArea t={t} state={state({ selectedRound: { id: 1 } })} dispatch={dispatch} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".qf-drawer-shell")).toBeTruthy();
    expect(container.querySelector(".qf-drawer-panel--register")).toBeTruthy();
    expect(container.querySelectorAll(".qf-drawer-panel.mx2-open-panel.semi-card").length).toBe(4);
    expect(container.querySelectorAll(".qf-drawer-panel h4")).toHaveLength(0);
    expect(container.querySelector(".qf-drawer__input")).toBeNull();
    expect(container.querySelector(".qf-drawer-panel__head")).toBeNull();
    expect(container.querySelectorAll(".qf-project-form .qf-drawer-field.mx2-open-field")).toHaveLength(3);
    expect(container.querySelector(".qf-project-form textarea.semi-input-textarea")).toBeTruthy();
    const inputs = container.querySelectorAll(".qf-project-form input.semi-input");
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[0], { target: { value: "MyProject" } });
    const regBtn = Array.from(container.querySelectorAll(".mx2-drawer button")).find((b) => b.textContent?.includes("Register project"));
    fireEvent.click(regBtn as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("registerProject", expect.objectContaining({ name: "MyProject" })));
  });

  it("shows the match table + finalize for admin in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          isAdmin: true,
          canFinalizeSelectedRound: true,
          selectedRound: { id: 1 },
          suggestedMatches: [{ id: "p1", name: "Proj", contributedDisplay: "10", donors: "3", matchDisplay: "5 GAS" }],
        })}
        dispatch={dispatch}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".qf-drawer-panel--admin")).toBeTruthy();
    expect(container.querySelector(".qf-drawer-list")).toBeTruthy();
    expect(container.textContent).toContain("Proj");
    expect(container.textContent).toContain("5 GAS");
  });

  it("renders every allocation the admin will submit, including entries after six", () => {
    const suggestedMatches = Array.from({ length: 7 }, (_, index) => ({
      id: String(index + 1),
      name: `Project ${index + 1}`,
      contributedDisplay: `${index + 1} GAS`,
      donors: "2",
      matchDisplay: `${index + 2} GAS`,
    }));
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          isAdmin: true,
          canFinalizeSelectedRound: true,
          selectedRound: { id: 1 },
          suggestedMatches,
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const allocationRows = container.querySelectorAll(".qf-drawer-panel--admin .qf-drawer-list__item");
    expect(allocationRows).toHaveLength(7);
    expect(container.textContent).toContain("Project 7");
  });

  it("keeps later rounds selectable and later project claims reachable", () => {
    const rounds = Array.from({ length: 6 }, (_, index) => ({
      id: String(index + 1),
      title: `Round ${index + 1}`,
      status: "active",
    }));
    const projects = Array.from({ length: 9 }, (_, index) => ({
      id: String(index + 1),
      name: `Project ${index + 1}`,
      active: true,
      totalContributed: "100000000",
      contributorCount: "2",
    }));
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          rounds,
          selectedRound: rounds[0],
          projects,
          claimableProjectIds: ["9"],
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".qf-round-chip")).toHaveLength(6);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelectorAll(".qf-drawer-panel--ledger .qf-drawer-list__item")).toHaveLength(9);
    expect(container.querySelector(".qf-drawer-panel--ledger")?.textContent).toContain("Project 9");
    expect(container.querySelector(".qf-drawer-panel--ledger")?.textContent).toContain("Claim");
  });

  it("renders a status banner when roundsStatus is set", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ selectedRound: { id: 1 }, roundsStatus: { msg: "Round ended", type: "info" } })} dispatch={vi.fn()} />,
    );
    expect(container.textContent).toContain("Round ended");
    expect(container.querySelector(".qf-setup-card__notice")?.textContent).toContain("Round ended");
  });

  it("keeps legacy deployments useful for discovery without exposing write forms", () => {
    const dispatch = vi.fn();
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          selectedRound: { id: 1, status: "active" },
          projects: [{ id: "p1", name: "Proj" }],
          deploymentStatus: "legacy",
          deploymentMessage: "Browse only",
          fundingWritesEnabled: false,
        })}
        dispatch={dispatch}
      />,
    );

    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.disabled).toBe(false);
    expect(primary.textContent).toContain("Refresh funding data");
    expect(container.querySelector('.qf-deployment-note[data-status="legacy"]')?.textContent).toContain("Explore mode");
    fireEvent.click(primary);
    expect(dispatch).toHaveBeenCalledWith("refreshRounds");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".qf-drawer-panel--availability")).toBeTruthy();
    expect(container.querySelector(".qf-drawer-panel--round-builder")).toBeNull();
    expect(container.querySelector(".qf-drawer-panel--donation")).toBeNull();
    expect(container.querySelector(".qf-drawer-panel--register")).toBeNull();
  });

  it("never lets a prepaid-deposit journal be discarded as a local-only lock", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const txid = `0x${"d".repeat(64)}`;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          selectedRound: { id: 1, status: "active" },
          projects: [{ id: "p1", name: "Proj" }],
          hasPendingOperation: true,
          pendingTxid: txid,
          pendingPhase: "deposit",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const clear = Array.from(container.querySelectorAll(".qf-drawer-panel--pending button"))
      .find((button) => button.textContent?.includes("Recover prepaid credit first")) as HTMLButtonElement;
    expect(clear).toBeTruthy();
    expect(clear.disabled).toBe(true);
    fireEvent.click(clear);
    expect(dispatch).not.toHaveBeenCalledWith("clearPending");
  });

  it("keeps public discovery wallet-optional", () => {
    expect(manifest.features?.walletRequired).toBe(false);
  });

  it("blocks duplicate writes and keeps pending recovery controls secondary", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const txid = `0x${"a".repeat(64)}`;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          selectedRound: { id: 1, status: "active" },
          projects: [{ id: "p1", name: "Proj" }],
          hasPendingOperation: true,
          pendingTxid: txid,
        })}
        dispatch={dispatch}
      />,
    );

    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    expect(primary.textContent).toContain("Review pending transaction");
    expect(container.querySelector(".qf-pending-note")?.textContent).toContain("awaiting confirmation");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".qf-drawer-panel--pending")).toBeTruthy();
    const clear = Array.from(container.querySelectorAll(".qf-drawer-panel--pending button"))
      .find((button) => button.textContent?.includes("Forget local lock"));
    fireEvent.click(clear as Element);
    expect(dispatch).toHaveBeenCalledWith("clearPending");
  });

  it("keeps motion and clean funding hierarchy backed by tests", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(path.join(appsRoot, "quadratic-funding/src/PlayArea.scss"), "utf8");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(/\.qf-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 168px/);
    expect(styles).toMatch(/\.qf-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.qf-scene\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).toMatch(/\.qf-scene--setup\s*\{[\s\S]*grid-template-rows:\s*1fr/);
    expect(styles).toMatch(/\.qf-scene__artboard\s*\{[\s\S]*height:\s*216px/);
    expect(styles).toMatch(/\.qf-scene__art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/var\(--mx2-scene-art-opacity|background-image:\s*url/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).toMatch(/\.qf-setup-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.qf-setup-card\s*\{[\s\S]*box-shadow:\s*0 2px 8px rgba\(31,\s*41,\s*55,\s*0\.035\)/);
    expect(styles).toMatch(/\.qf-setup-card img\s*\{[\s\S]*height:\s*clamp\(132px,\s*18vw,\s*168px\)/);
    expect(styles).toMatch(/\.qf-setup-card img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.qf-setup-card img\s*\{[\s\S]*object-position:\s*center/);
    expect(styles).toMatch(/\.qf-setup-card img\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.qf-setup-card img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.qf-setup-card img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).not.toMatch(/\.qf-setup-card img\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.qf-setup-card__notice[\s\S]*background:\s*#fff7ed/);
    expect(styles).toMatch(/\.qf-setup-card__lane[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.qf-setup-card__step--ready[\s\S]*background:\s*#ecfdf5/);
    expect(styles).toMatch(/\.qf-pledge[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.qf-drawer-shell\s*\{[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.qf-drawer-panel--donation\s*\{[\s\S]*grid-column:\s*span 5/);
    expect(styles).toMatch(/\.qf-drawer-panel--register\s*\{[\s\S]*grid-column:\s*span 7/);
    expect(styles).not.toContain("qf-drawer-panel__head");
    expect(styles).not.toContain("qf-drawer__input");
    expect(styles).toMatch(/\.qf-drawer-field \.mx2-open-field__control\s*\{[\s\S]*min-height:\s*40px/);
    expect(styles).toMatch(/\.qf-drawer-field\.mx2-open-field--textarea \.mx2-open-field__control--textarea\s*\{[\s\S]*min-height:\s*70px/);
    expect(styles).toMatch(/\.qf-drawer-list__item\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto auto/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-scene__artboard\s*\{[\s\S]*height:\s*142px/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-scene__desk\s*\{[\s\S]*grid-template-columns:\s*minmax\(70px,\s*0\.9fr\) 18px minmax\(82px,\s*1\.1fr\) 18px minmax\(70px,\s*0\.9fr\)/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-setup-card\s*\{[\s\S]*grid-template-columns:\s*104px minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-setup-card img\s*\{[\s\S]*height:\s*98px/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-project-board\s*\{[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-project-card\s*\{[\s\S]*flex:\s*0 0 154px/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-pledge__tiles\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*min-height:\s*48px/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.qf-drawer-shell\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/\.qf-round-builder\s*\{[\s\S]*grid-template-columns:/);
  });
});
