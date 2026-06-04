import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../quadratic-funding/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

// Minimal identity translator: the PlayArea only needs stable, distinct strings
// per key, so returning the key itself is sufficient for label/role queries.
function t(key: string) {
  const overrides: Record<string, string> = {
    registerProject: "Register Project",
    registeringProject: "Registering...",
    projectName: "Project name",
    projectDescription: "Project description",
    projectLink: "Project link",
    contribute: "Contribute",
    contributing: "Contributing...",
    contributionProjectId: "Project ID",
    contributionAmount: "Amount",
    contributionMemo: "Memo (optional)",
    tabRounds: "Rounds",
    tabProjects: "Projects",
    tabContribute: "Contribute",
    finalizeRound: "Finalize",
    finalizeProjectsJson: "Project IDs (JSON)",
    finalizeMatchesJson: "Matched amounts (JSON)",
    finalizeKnownProjects: "Projects in this round",
    finalizePrefill: "Use these",
    addMatching: "Add matching",
    claimUnused: "Claim unused",
    adminTools: "Round Ops",
  };
  return overrides[key] ?? key;
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const round = {
    id: "1",
    title: "Public Goods",
    creator: "0xcreator",
    status: "active",
    matchingPool: "5000000000",
    assetSymbol: "GAS",
  };
  const values: Record<string, unknown> = {
    address: "0xcreator",
    rounds: [round],
    selectedRoundId: "1",
    selectedRound: round,
    isRefreshingRounds: false,
    isCreatingRound: false,
    isRegisteringProject: false,
    isContributing: false,
    isAddingMatching: false,
    isFinalizing: false,
    isClaimingUnused: false,
    canManageSelectedRound: true,
    canFinalizeSelectedRound: true,
    canClaimUnused: false,
    roundsStatus: null,
    projects: [
      { id: "7", name: "Alpha", active: true },
      { id: "9", name: "Beta", active: true },
    ],
    isRefreshingProjects: false,
    claimingProjectId: "",
    claimableProjectIds: [],
    activeTab: "projects",
    roundCount: 1,
    activeRoundCount: 1,
    projectCount: 2,
    selectedRoundDisplay: "Public Goods",
    matchingPoolDisplay: "50 GAS",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Quadratic Funding PlayArea", () => {
  it("clears project inputs after a successful registerProject dispatch", async () => {
    // dispatch resolves truthy → success → fields should clear.
    const dispatch = vi.fn(async () => true as unknown as void);
    render(<PlayArea t={t} state={baseState()} dispatch={dispatch} />);

    const nameInput = screen.getByLabelText("Project name") as HTMLInputElement;
    const descInput = screen.getByLabelText("Project description") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "My Project" } });
    fireEvent.change(descInput, { target: { value: "Does good" } });
    expect(nameInput.value).toBe("My Project");

    fireEvent.click(screen.getByRole("button", { name: "Register Project" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("registerProject", {
        name: "My Project",
        description: "Does good",
        link: "",
      });
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Project description") as HTMLInputElement).value).toBe("");
    });
  });

  it("keeps project inputs when registerProject dispatch reports failure", async () => {
    const dispatch = vi.fn(async () => false as unknown as void);
    render(<PlayArea t={t} state={baseState()} dispatch={dispatch} />);

    const nameInput = screen.getByLabelText("Project name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Sticky" } });
    fireEvent.click(screen.getByRole("button", { name: "Register Project" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    // No success → input must retain the value so the user can retry/edit.
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("Sticky");
  });

  it("clears contribute inputs after a successful contribute dispatch", async () => {
    const dispatch = vi.fn(async () => true as unknown as void);
    render(<PlayArea t={t} state={baseState({ activeTab: "contribute" })} dispatch={dispatch} />);

    const idInput = screen.getByLabelText("Project ID") as HTMLInputElement;
    const amountInput = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: "7" } });
    fireEvent.change(amountInput, { target: { value: "2" } });

    // "Contribute" also names the tab button; the submit CTA is the last match.
    const contributeButtons = screen.getAllByRole("button", { name: "Contribute" });
    fireEvent.click(contributeButtons[contributeButtons.length - 1]);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("contribute", {
        projectId: "7",
        amount: "2",
        memo: "",
      });
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Project ID") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("");
    });
  });

  it("renders the status banner from the status msg field", () => {
    const state = baseState({
      activeTab: "rounds",
      roundsStatus: { msg: "Round created", type: "success" },
    });
    render(<PlayArea t={t} state={state} dispatch={vi.fn(async () => undefined)} />);
    expect(screen.getByText("Round created")).toBeTruthy();
  });

  it("shows the round's known project IDs and prefills them into finalize", () => {
    render(<PlayArea t={t} state={baseState({ activeTab: "rounds" })} dispatch={vi.fn(async () => undefined)} />);

    // Known IDs surfaced as guidance for the admin.
    expect(screen.getByText("7, 9")).toBeTruthy();

    const projectIdsInput = screen.getByLabelText("Project IDs (JSON)") as HTMLInputElement;
    expect(projectIdsInput.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Use these" }));
    expect((screen.getByLabelText("Project IDs (JSON)") as HTMLInputElement).value).toBe("[7,9]");
  });
});
