import { readFileSync } from "node:fs";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../trustanchor-admin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appName: "TrustAnchor Admin",
    adminHeroTitle: "Move. Target. Vote.",
    adminHeroSubtitle: "Manual NEO routing only.",
    adminCommandCenter: "Operator command center",
    adminScope: "Admin scope",
    statsAwaitConnect: "Live trust routes load once an operator connects.",
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
    operatorRuleDesc: "Manual trust route changes and explicit vote sync.",
    operatorRequiredBody: "Connect operator wallet {address}.",
    operatorRequiredBodyNoAddress: "Connect operator wallet.",
    routeMapTitle: "Live route map",
    trackedNeo: "Tracked NEO",
    reserve: "Reserve",
    selectedRoute: "Selected route",
    agentCount: "Agents",
    agentDirectoryEmpty: "No agents.",
    noneFallback: "None",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    agentAccounts: [
      { agentId: 1, label: "Trust Agent 01", accountAddress: "Ntrust111111111", candidateTarget: "02aaa", neoBalance: 12, active: true },
      { agentId: 2, label: "Trust Agent 02", accountAddress: "Ntrust222222222", candidateTarget: "02bbb", neoBalance: 4, active: true },
      { agentId: 3, label: "Trust Agent 03", accountAddress: "Ntrust333333333", candidateTarget: "02ccc", neoBalance: 0, active: false },
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

describe("trustanchor-admin PlayArea", () => {
  it("renders a professional trust-routing workspace instead of an empty backdrop scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".admin-scene")).toBeTruthy();
    expect(container.querySelector(".admin-command")).toBeTruthy();
    expect(container.querySelector(".admin-ledger")).toBeTruthy();
    expect(container.querySelector(".admin-amount-console")).toBeTruthy();
    expect(container.querySelector(".admin-amount-console__stepper")).toBeTruthy();
    expect(container.querySelector(".admin-scene__backdrop")).toBeFalsy();
    expect(container.textContent).toContain("Move. Target. Vote.");
    expect(container.textContent).toContain("Trust Agent 01");
    expect(container.textContent).toContain("12 NEO");
  });

  it("keeps the admin surface foreground-led and free of global backdrop patches", () => {
    const styles = readFileSync(`${process.cwd()}/../trustanchor-admin/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../trustanchor-admin/src/PlayArea.tsx`, "utf8");

    expect(styles).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(styles).toMatch(/\.admin-workspace\s*\{[\s\S]*background:\s*#ffffff;/);
    expect(styles).toMatch(/\.admin-workspace\s*\{[\s\S]*box-shadow:\s*none;/);
    expect(styles).toMatch(/\.admin-operation-ticket\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.74fr\) minmax\(260px,\s*1fr\)/);
    expect(styles).toMatch(/\.admin-amount-console\s*,[\s\S]*\.admin-candidate-console\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.admin-amount-console__stepper\s*\{[\s\S]*grid-template-columns:\s*34px minmax\(0,\s*1fr\) 34px/);
    expect(styles).toMatch(/\.admin-amount-console__quick\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.admin-candidate-console__preview strong\s*\{[\s\S]*font-family:\s*ui-monospace/);
    expect(styles).not.toMatch(/AI-generated scene backdrop|admin-scene__backdrop|backdrop-filter|radial-gradient/);
    expect(source).not.toContain("admin-scene__backdrop");
  });

  it("has reduced-motion guards for the route workspace", () => {
    const styles = readFileSync(`${process.cwd()}/../trustanchor-admin/src/PlayArea.scss`, "utf8");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
  });
});
