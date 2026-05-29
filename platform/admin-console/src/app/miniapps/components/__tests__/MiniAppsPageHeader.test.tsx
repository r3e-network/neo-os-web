import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MiniAppsPageHeader } from "../MiniAppsPageHeader";

function renderHeader(overrides = {}) {
  const props = {
    adminReady: false,
    importError: "",
    publishInfo: "",
    templateInstallInfo: "",
    importResultText: "",
    batchImportError: "",
    batchImportInfo: "",
    rollbackPlanCount: 0,
    onBatchFilesSelected: vi.fn(),
    onValidateBatch: vi.fn(),
    onImportBatch: vi.fn(),
    onRollbackBatch: vi.fn(),
    onValidateDefinitions: vi.fn(),
    onImportDefinitions: vi.fn(),
    onCreateMiniApp: vi.fn(),
    importBatchPending: false,
    batchFilesCount: 1,
    rollbackBatchPending: false,
    canRollbackBatch: true,
    importDefinitionsPending: false,
    ...overrides,
  };

  const result = render(<MiniAppsPageHeader {...props} />);
  return { props, ...result };
}

describe("MiniAppsPageHeader", () => {
  it("uses compact operator-console chrome instead of marketing hero styling", () => {
    const { container } = renderHeader({ adminReady: true });
    const shell = container.querySelector(".miniapps-command-center");
    const heading = screen.getByRole("heading", { level: 1 });
    const headingAccent = heading.querySelector("span");
    const opsPanel = container.querySelector(".miniapps-ops-panel");
    const statusGrid = container.querySelector(".miniapps-status-grid");

    expect(shell?.className).toContain("rounded-xl");
    expect(shell?.className).not.toContain("rounded-2xl");
    expect(shell?.className).not.toContain("bg-white/90");
    expect(container.innerHTML).not.toContain("drop-shadow");
    expect(shell?.className).not.toContain("dark:");
    expect(opsPanel?.innerHTML).not.toContain("dark:");
    expect(statusGrid?.innerHTML).not.toContain("dark:");
    expect(heading.className).toContain("text-xl");
    expect(heading.className).not.toContain("text-3xl");
    expect(headingAccent?.className || "").not.toContain("drop-shadow");
  });

  it("groups command actions into a locked command center", () => {
    renderHeader();

    expect(screen.getByText("Command Center")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload Batch" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Validate Batch" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Import Batch" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Rollback Batch" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Validate Definitions" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Import Definitions" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create MiniApp" }),
    ).toBeDisabled();
  });

  it("enables safe actions when the admin key is ready", () => {
    renderHeader({ adminReady: true });

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload Batch" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Validate Batch" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Import Definitions" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Create MiniApp" }),
    ).toBeEnabled();
  });
});
