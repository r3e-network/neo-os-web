import React from "react";
import fs from "node:fs";
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
    finalizeSuggested: "Finalize with suggested matches",
    finalizeProjectsJson: "Project IDs (JSON)",
    finalizeMatchesJson: "Matched amounts (JSON)",
    finalizeKnownProjects: "Projects in this round",
    finalizePrefill: "Use these",
    addMatching: "Add matching",
    claimUnused: "Claim unused",
    adminTools: "Round Ops",
    matchTableDonors: "Donors",
    matchTableSuggested: "Suggested match",
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
    const linkInput = screen.getByLabelText("Project link") as HTMLInputElement;
    expect(document.querySelector(".qf-project-launch-stage")).toBeTruthy();
    expect(
      document.querySelector('.qf-project-launch-stage__image[src="./funding-desk.jpg"]'),
    ).toBeTruthy();

    fireEvent.change(nameInput, { target: { value: "My Project" } });
    fireEvent.change(descInput, { target: { value: "Does good" } });
    fireEvent.change(linkInput, { target: { value: "https://example.com" } });
    expect(nameInput.value).toBe("My Project");

    await waitFor(() => {
      expect(document.querySelector(".qf-project-launch-stage")?.className).toContain(
        "is-ready",
      );
      expect(document.querySelector(".qf-project-field--name")?.className).toContain(
        "is-active",
      );
      expect(
        document.querySelector(".qf-project-field--description")?.className,
      ).toContain("is-active");
      expect(document.querySelector(".qf-project-field--link")?.className).toContain(
        "is-active",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Register Project" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("registerProject", {
        name: "My Project",
        description: "Does good",
        link: "https://example.com",
      });
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Project description") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Project link") as HTMLInputElement).value).toBe("");
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

    expect(document.querySelector(".qf-flow-stage")).toBeTruthy();
    expect(
      document.querySelector('.qf-flow-stage__image[src="./funding-desk.jpg"]'),
    ).toBeTruthy();
    expect(document.querySelectorAll(".qf-flow-node")).toHaveLength(3);

    const idInput = screen.getByLabelText("Project ID") as HTMLInputElement;
    const amountInput = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: "7" } });
    fireEvent.change(amountInput, { target: { value: "2" } });

    await waitFor(() => {
      expect(document.querySelector(".qf-flow-stage")?.className).toContain(
        "is-project-selected",
      );
      expect(document.querySelector(".qf-flow-stage")?.className).toContain(
        "is-funded",
      );
      expect(screen.getAllByText("2 GAS").length).toBeGreaterThanOrEqual(1);
    });

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

  it("keeps the funding-flow stage animated with reduced-motion support", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../quadratic-funding/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain(".qf-flow-stage");
    expect(styles).toContain(".qf-project-launch-stage");
    expect(styles).toContain("@keyframes qf-flow-river");
    expect(styles).toContain("@keyframes qf-flow-node-ready");
    expect(styles).toContain("@keyframes qf-project-launch-scan");
    expect(styles).toContain("@keyframes qf-project-field-ready");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*\.qf-flow-stage__nodes[\s\S]*grid-template-columns:\s*1fr/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.qf-project-launch-stage\.is-ready::after[\s\S]*animation:\s*none/,
    );
  });

  it("shows the round's known project IDs and prefills them into the advanced finalize inputs", () => {
    render(<PlayArea t={t} state={baseState({ activeTab: "rounds" })} dispatch={vi.fn(async () => undefined)} />);

    // The hand-typed JSON path is now an advanced fallback behind a toggle.
    expect(screen.queryByLabelText("Project IDs (JSON)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "finalizeShowAdvanced" }));

    // Known IDs surfaced as guidance for the admin once advanced is open.
    expect(screen.getByText("7, 9")).toBeTruthy();

    const projectIdsInput = screen.getByLabelText("Project IDs (JSON)") as HTMLInputElement;
    expect(projectIdsInput.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Use these" }));
    expect((screen.getByLabelText("Project IDs (JSON)") as HTMLInputElement).value).toBe("[7,9]");
  });

  it("renders round ops as an app-like control room instead of flat admin form groups", async () => {
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          activeTab: "rounds",
          isAdmin: true,
          canFinalizeSelectedRound: true,
          canClaimUnused: true,
          suggestedMatches: [
            {
              id: "7",
              name: "Alpha",
              contributedDisplay: "12 GAS",
              donors: "4",
              matchDisplay: "8 GAS",
              matchBaseUnits: "800000000",
            },
            {
              id: "9",
              name: "Beta",
              contributedDisplay: "3 GAS",
              donors: "2",
              matchDisplay: "2 GAS",
              matchBaseUnits: "200000000",
            },
          ],
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".qf-admin-console")).toBeTruthy();
    expect(container.querySelector(".qf-ops-module--reserve")).toBeTruthy();
    expect(container.querySelector(".qf-ops-module--finalize")).toBeTruthy();
    expect(container.querySelectorAll(".qf-match-card")).toHaveLength(2);
    expect(container.querySelector(".qf-ops-secondary-grid")).toBeTruthy();
    expect(container.querySelector(".qf-admin-group")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "10 GAS" }));
    expect(
      (container.querySelector(".qf-reserve-input input") as HTMLInputElement)
        .value,
    ).toBe("10");

    fireEvent.click(screen.getByRole("button", { name: "Add matching" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("addMatching", "10");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Finalize with suggested matches" }),
    );
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("finalizeSuggested");
    });
  });
});
