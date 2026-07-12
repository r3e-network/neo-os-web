import { readFileSync } from "node:fs";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../profitanchor-admin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appName: "ProfitAnchor Admin",
    adminHeroTitle: "Move. Target. Vote.",
    adminHeroSubtitle: "Manual NEO routing only.",
    adminCommandCenter: "Operator command center",
    agentTopologyTitle: "21-agent topology",
    agentTopologySubtitle: "Every route visible at once",
    topologyCount: "{count} routes",
    topologyNetworkLabel: "Selectable agent topology",
    topologyLegendLabel: "Topology legend",
    sourceLegend: "Source",
    targetLegend: "Target",
    activeRouteLegend: "Active",
    inactiveRouteLegend: "Inactive",
    anchorHubTitle: "ProfitAnchor capital hub",
    routePlannerTitle: "Route planner",
    operatorVerified: "Operator verified",
    checkingAuthority: "Checking authority",
    agentNodeLabel: "Agent {agent}, {status}, {balance}",
    adminScope: "Admin scope",
    statsAwaitConnect: "Live route loads once an operator connects.",
    operatorRequiredEyebrow: "Read-only",
    operationMode: "Operation mode",
    moveNeo: "Move NEO",
    moveNeoDesc: "Move whole NEO from one AA agent to another.",
    setCandidate: "Update candidate",
    setCandidateDesc: "Change one agent's council candidate public key.",
    syncVote: "Sync vote",
    syncVoteDesc: "Submit the chosen AA agent vote.",
    fromAgentId: "From agent",
    toAgentId: "To agent",
    agentId: "Agent",
    neoAmount: "NEO amount",
    neoAmountControl: "NEO amount control",
    decreaseAmount: "Decrease amount",
    increaseAmount: "Increase amount",
    quickAmount: "Quick NEO amounts",
    maxAmount: "Max",
    candidatePublicKey: "Candidate public key",
    candidateControl: "Candidate public key control",
    agentCandidateLabel: "Candidate",
    agentCandidateNone: "No candidate",
    cardRuleCandidate: "Candidate key is set explicitly",
    voteWitnessTitle: "Needs the agent witness",
    voteWitnessNote: "Syncing this vote requires agent #{agent} ({account}) to co-sign.",
    agentDirectoryTitle: "Agent directory",
    directoryRosterNote: "{count} provisioned routes",
    agentBalancePending: "Balance pending",
    agentActive: "Active",
    agentInactive: "Inactive",
    operatorRule: "Operator rule",
    operatorRuleDesc: "Manual route changes and explicit vote sync.",
    operatorRequiredBody: "Connect operator wallet {address}.",
    operatorRequiredBodyNoAddress: "Connect operator wallet.",
    routeMapTitle: "Live route map",
    trackedNeo: "Tracked NEO",
    reserve: "Reserve",
    selectedRoute: "Selected route",
    agentCount: "Agents",
    agentDirectoryEmpty: "No agents.",
    agentDirectoryEmptyHint: "No routes are available.",
    agentDirectoryLoading: "Verifying agents…",
    noneFallback: "None",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    agentAccounts: [
      { agentId: 1, label: "Agent 01", accountAddress: "Nagent111111111", candidateTarget: "02aaa", neoBalance: 12, active: true },
      { agentId: 2, label: "Agent 02", accountAddress: "Nagent222222222", candidateTarget: "02bbb", neoBalance: 4, active: true },
      { agentId: 3, label: "Agent 03", accountAddress: "Nagent333333333", candidateTarget: "02ccc", neoBalance: 0, active: false },
    ],
    totalNeoDisplay: "16 NEO",
    reserveDisplay: "9 GAS",
    selectedAgentDisplay: "#1",
    agentCountDisplay: "3 / 21",
    adminState: "admin",
    expectedAdminDisplay: "Noperator",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("profitanchor-admin PlayArea", () => {
  it("renders a professional agent command workspace instead of an empty backdrop scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".admin-scene")).toBeTruthy();
    expect(container.querySelector(".admin-command")).toBeTruthy();
    expect(container.querySelector(".admin-ledger")).toBeTruthy();
    expect(container.querySelector(".admin-topology__network")).toBeTruthy();
    expect(container.querySelectorAll(".admin-agent-node")).toHaveLength(3);
    expect(container.querySelector(".admin-amount-console")).toBeTruthy();
    expect(container.querySelector(".admin-amount-console__stepper")).toBeTruthy();
    expect(container.querySelector(".admin-scene__backdrop")).toBeFalsy();
    expect(container.textContent).toContain("Move. Target. Vote.");
    expect(container.textContent).toContain("Agent 01");
    expect(container.textContent).toContain("12 NEO");
  });

  it("renders the complete 21-agent topology instead of truncating the roster", () => {
    const agentAccounts = Array.from({ length: 21 }, (_, index) => ({
      agentId: index + 1,
      label: `Agent ${String(index + 1).padStart(2, "0")}`,
      accountAddress: `Nagent${String(index + 1).padStart(27, "0")}`,
      candidateTarget: `02${"a".repeat(64)}`,
      neoBalance: index + 1,
      active: true,
    }));
    const { container } = render(<PlayArea t={t} state={state({ agentAccounts, agentCountDisplay: "21 / 21" })} dispatch={vi.fn()} />);

    expect(container.querySelectorAll(".admin-agent-node")).toHaveLength(21);
    expect(container.querySelectorAll(".admin-topology__row")).toHaveLength(3);
    expect(container.querySelector('.admin-agent-node strong')?.textContent).toBe("01");
    expect(container.querySelectorAll('.admin-agent-node strong')[20]?.textContent).toBe("21");
  });

  it("keeps the admin surface foreground-led and free of global backdrop patches", () => {
    const styles = readFileSync(`${process.cwd()}/components-react/v2/anchor-admin/_workspace.scss`, "utf8");
    const theme = readFileSync(`${process.cwd()}/../profitanchor-admin/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../profitanchor-admin/src/PlayArea.tsx`, "utf8");

    expect(theme).toContain('@use "@shared/components-react/v2/anchor-admin/workspace" as *;');
    expect(theme).toContain('--admin-canvas: #fffaf3;');
    expect(styles).toMatch(/\.admin-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.28fr\) minmax\(340px,\s*0\.72fr\)/);
    expect(styles).toMatch(/\.admin-topology__row\s*\{[\s\S]*grid-template-columns:\s*repeat\(7,/);
    expect(styles).toContain("@container anchor-admin-surface (max-width: 620px)");
    expect(styles).toMatch(/\.admin-agent-inspector\s*\{/);
    expect(styles).toMatch(/\.admin-amount-console__stepper\s*\{[\s\S]*grid-template-columns:\s*36px minmax\(0,\s*1fr\) 36px/);
    expect(styles).toMatch(/\.admin-amount-console__quick\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.admin-candidate-console__preview strong\s*\{[\s\S]*font-family:\s*ui-monospace/);
    expect(styles).not.toMatch(/AI-generated scene backdrop|admin-scene__backdrop|backdrop-filter|radial-gradient/);
    expect(source).not.toContain("admin-scene__backdrop");
  });

  it("has reduced-motion guards for the route workspace", () => {
    const styles = readFileSync(`${process.cwd()}/components-react/v2/anchor-admin/_workspace.scss`, "utf8");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
  });
});
