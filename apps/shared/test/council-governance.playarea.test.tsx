import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../council-governance/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    address: "NconnectedCouncilMember",
    isCandidate: true,
    candidateLoaded: true,
    hasVotedMap: {},
    hasVotedKnownMap: {},
    governanceOverview: {
      loaded: true,
      network: "mainnet",
      contract: "0xc7e50e67589df63302cbea1a6b00beb649ee74d8",
      paused: false,
      committeeSize: 21,
      quorumPercent: 30,
      thresholdPercent: 50,
      minDurationMs: 86_400,
      maxDurationMs: 2_592_000,
      totalProposals: 0,
      totalVotes: 0,
      passedProposals: 0,
      totalMembers: 0,
    },
    currentNetwork: "mainnet",
    councilCandidates: [],
    councilRosterLoaded: true,
    ...o,
  };
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
function playAreaStyles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "council-governance/src/PlayArea.scss"), "utf8");
}
describe("council-governance PlayArea (v2)", () => {
  it("renders the business-specific scene", () => { const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />); expect(container.children.length).toBeGreaterThan(0); });
  it("presents proposal drafting as a motion dossier instead of a raw form", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".council-draft--stage")).toBeTruthy();
    expect(container.querySelector(".council-draft__art")).toBeNull();
    expect(container.querySelector(".council-motion-paper")).toBeTruthy();
    expect(container.querySelector(".council-motion-paper__title")).toBeTruthy();
    expect(container.querySelector(".council-motion-paper__brief")).toBeTruthy();
    expect(container.querySelector(".council-motion-paper__summary-grid")).toBeTruthy();
    expect(container.querySelectorAll(".council-motion-paper__summary-card")).toHaveLength(3);
    expect(container.querySelector(".council-motion-paper__seal")).toBeTruthy();
    expect(container.querySelector(".council-window-rail")).toBeNull();
    expect(container.querySelector(".mx2-stage__scene .council-motion-paper--stage")).toBeTruthy();
    expect(container.querySelector(".mx2-stage__scene .council-draft-type")).toBeNull();
    expect(container.querySelectorAll(".mx2-stage__scene .council-motion-paper input")).toHaveLength(0);
    expect(container.querySelectorAll(".mx2-stage__scene .council-motion-paper textarea")).toHaveLength(0);
    expect(container.querySelector(".mx2-stage__scene .council-duration-grid")).toBeNull();
    expect(container.querySelector(".mx2-stage__scene .council-field")).toBeNull();
    expect(container.querySelector(".council-chamber-card")).toBeNull();
    expect(container.querySelector(".council-workbench[data-mode='draft']")).toBeTruthy();
    expect(container.querySelector(".council-floor-tabs")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".council-chamber-visual img")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /councilDetails/ }));

    const drawer = container.querySelector(".council-drawer");
    expect(drawer?.querySelector(".council-drawer-tabs")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-drawer-tabs [role='tab']")).toHaveLength(4);
    expect(drawer?.querySelectorAll(".council-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(drawer?.querySelector(".council-drawer__panel--draft")).toBeTruthy();
    expect(drawer?.querySelector(".council-draft--drawer .council-draft-type")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-draft--drawer .council-draft-type button > em").length).toBe(2);
    expect(drawer?.querySelector(".council-drawer-fields")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-drawer__field.mx2-open-field")).toHaveLength(2);
    expect(drawer?.querySelector(".council-window-rail")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-duration-grid button")).toHaveLength(3);
    expect(drawer?.querySelector(".council-field")).toBeNull();
    expect(drawer?.querySelector("select")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /policyType/ }));

    expect(drawer?.querySelector(".council-policy-fields")).toBeTruthy();
    expect(drawer?.querySelector(".council-policy-fields .semi-radioGroup.mx2-open-segmented")).toBeTruthy();
    expect(drawer?.querySelector(".council-policy-value .mx2-open-field__control input.semi-input")).toBeTruthy();
    expect(drawer?.querySelector(".council-policy-fields select")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /activeProposals/ }));
    expect(drawer?.querySelector(".council-draft--drawer")).toBeNull();
    expect(drawer?.querySelectorAll(".council-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);

    fireEvent.click(screen.getByRole("tab", { name: /council/ }));
    expect(drawer?.querySelector(".council-drawer__panel--council")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-wallet__balances .mx2-coin img")).toHaveLength(2);
  });
  it("keeps createProposal payload unchanged from the redesigned motion dossier", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /councilDetails/ }));

    fireEvent.change(screen.getByPlaceholderText("proposalTitlePlaceholder"), {
      target: { value: "Lower storage fee" },
    });
    fireEvent.change(screen.getByPlaceholderText("proposalDescPlaceholder"), {
      target: { value: "Reduce storage price for small apps." },
    });
    fireEvent.click(screen.getByRole("button", { name: "duration30Minutes" }));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createProposal", {
        type: 0,
        title: "Lower storage fee",
        description: "Reduce storage price for small apps.",
        policyMethod: undefined,
        policyValue: undefined,
        duration: 1_800_000,
      }),
    );
  });
  it("has reduced-motion", () => {
    const s = playAreaStyles();
    expect(s).toMatch(/prefers-reduced-motion/);
  });
  it("keeps the council floor clean enough that foreground controls read first", () => {
    const s = playAreaStyles();
    const proposal = {
      id: 1,
      source: "contract",
      type: 0,
      title: "Treasury motion",
      description: "Review the active proposal.",
      creator: "0x1",
      creatorDisplay: "0x1",
      yesVotes: 4,
      noVotes: 1,
      totalVotes: 5,
      quorumRequired: 6,
      quorumReached: false,
      createTime: Date.now() - 1_000,
      expiryTime: Date.now() + 120_000,
      status: 1,
      statusKey: "active",
    } as const;
    const { container } = render(<PlayArea t={t} state={state({
      selectedProposal: proposal,
      activeProposals: [proposal],
      activeCount: 1,
      hasVotedKnownMap: { 1: true },
    })} dispatch={vi.fn()} />);

    expect(container.querySelector(".council-chamber-visual img")?.getAttribute("src")).toBe("./council-chamber.webp");
    expect(container.querySelector(".council-chamber-visual__identity .mx2-coin img")).toBeTruthy();
    expect(container.querySelector(".council-quorum__progress[role='progressbar']")).toBeTruthy();
    expect(container.querySelector(".council-quorum__ring")).toBeNull();
    expect(container.querySelector(".council-quorum__seat")).toBeNull();
    expect(s).toMatch(/\.council-gov-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*var\(--mx2-stage-floor\)/);
    expect(s).toMatch(/\.council-gov-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 220px/);
    expect(s).toMatch(/\.council-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.council-wallet__balances\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.council-roster ol\s*\{[\s\S]*max-height:\s*340px/);
    expect(s).not.toMatch(/conic-gradient/);
    expect(s).not.toMatch(/\.council-quorum__ring/);
    expect(s).not.toMatch(/\.council-quorum__seat/);
    expect(s).not.toMatch(/background-image:\s*url/);
    expect(s).not.toMatch(/backdrop-filter/);
    expect(s).toMatch(/prefers-reduced-motion/);
  });

  // The council rules are contract config, so their read starts for every
  // visitor — wallet or not — and the council panel paints whatever the
  // unresolved state renders. A single `loaded` flag could not tell "still
  // asking" from "asked, got nothing", so both printed an em-dash: an in-flight
  // rule read looked like a rule that is genuinely blank. These pin the three
  // honest phases apart. The em-dash assertions are occurrence counts, not
  // value checks — a real rule value must never be replaced by a glyph, and a
  // glyph must never stand in for a value the app has not read yet.
  const openCouncilPanel = () => {
    fireEvent.click(screen.getByRole("button", { name: /councilDetails/ }));
    fireEvent.click(screen.getByRole("tab", { name: /council/ }));
  };
  const unreadOverview = { loaded: false, network: "mainnet", contract: "", paused: null, committeeSize: 0, quorumPercent: 0, thresholdPercent: 0, minDurationMs: 0, maxDurationMs: 0, totalProposals: 0, totalVotes: 0, passedProposals: 0, totalMembers: 0 };

  it("shimmers the governance rules while their read is in flight, never a glyph", () => {
    const { container } = render(<PlayArea t={t} state={state({
      governanceOverview: unreadOverview,
      governanceOverviewSettled: false,
      governanceOverviewError: "",
      address: "",
      balancesSettled: false,
      balancesLoaded: false,
      neoBalance: "",
      gasBalance: "",
    })} dispatch={vi.fn()} />);
    openCouncilPanel();

    const rules = container.querySelector(".council-rules");
    expect(rules?.querySelectorAll(".mx2-skeleton")).toHaveLength(4);
    expect(rules?.textContent ?? "").not.toContain("—");
    // No zero-state copy either: the app has not finished asking, so promising
    // an answer it does not have would be as dishonest as the em-dash was.
    expect(rules?.textContent ?? "").not.toContain("rulesUnread");
  });

  it("states plainly that the rules are unread once the read settles empty", () => {
    const { container } = render(<PlayArea t={t} state={state({
      governanceOverview: unreadOverview,
      governanceOverviewSettled: true,
      governanceOverviewError: "governanceRulesUnavailable",
      address: "",
      balancesSettled: true,
      balancesLoaded: false,
      neoBalance: "",
      gasBalance: "",
    })} dispatch={vi.fn()} />);
    openCouncilPanel();

    const rules = container.querySelector(".council-rules");
    expect(rules?.querySelector(".mx2-skeleton")).toBeNull();
    expect(rules?.querySelectorAll("[data-phase='unavailable']")).toHaveLength(4);
    expect(rules?.textContent ?? "").not.toContain("—");
    // A settled-empty rule must not be dressed up as a real committee of zero.
    expect(rules?.textContent ?? "").not.toMatch(/\b0%/);

    // A disconnected visitor is told to connect rather than shown a void; the
    // balance is genuinely unknowable until a wallet arrives.
    const balances = container.querySelector(".council-wallet__balances");
    expect(balances?.textContent ?? "").not.toContain("—");
    expect(balances?.textContent ?? "").toContain("balanceConnect");
  });

  it("shimmers a connected visitor's balances instead of voiding them mid-read", () => {
    const { container } = render(<PlayArea t={t} state={state({
      address: "NconnectedCouncilMember",
      balancesSettled: false,
      balancesLoaded: false,
      neoBalance: "",
      gasBalance: "",
    })} dispatch={vi.fn()} />);
    openCouncilPanel();

    const balances = container.querySelector(".council-wallet__balances");
    // Two shimmering coin balances; the council-vote tile is a real count.
    expect(balances?.querySelectorAll(".mx2-skeleton")).toHaveLength(2);
    expect(balances?.textContent ?? "").not.toContain("—");
  });

  it("renders resolved rules and balances as themselves", () => {
    const { container } = render(<PlayArea t={t} state={state({
      governanceOverviewSettled: true,
      address: "NconnectedCouncilMember",
      balancesSettled: true,
      balancesLoaded: true,
      neoBalance: "42",
      gasBalance: "13.5",
    })} dispatch={vi.fn()} />);
    openCouncilPanel();

    const rules = container.querySelector(".council-rules");
    expect(rules?.querySelector(".mx2-skeleton")).toBeNull();
    expect(rules?.textContent).toContain("21");
    expect(rules?.textContent).toContain("30%");
    const balances = container.querySelector(".council-wallet__balances");
    expect(balances?.textContent).toContain("42");
    expect(balances?.textContent).toContain("13.5");
    expect(balances?.querySelector(".mx2-skeleton")).toBeNull();
  });
});
