import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import SimulationsPage from "../page";

const simulationHookMocks = vi.hoisted(() => ({
  useSimulationStatus: vi.fn(),
  useStartSimulation: vi.fn(),
  useStopSimulation: vi.fn(),
  startMutate: vi.fn(),
  stopMutate: vi.fn(),
}));

vi.mock("@/lib/hooks/useSimulation", () => ({
  useSimulationStatus: simulationHookMocks.useSimulationStatus,
  useStartSimulation: simulationHookMocks.useStartSimulation,
  useStopSimulation: simulationHookMocks.useStopSimulation,
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

function mockStatus(overrides = {}) {
  simulationHookMocks.useSimulationStatus.mockReturnValue({
    data: {
      running: false,
      active_miniapps: ["oracle-price-console", "aa-market-hub"],
      workers_per_app: 2,
      uptime_seconds: 124,
      tx_count: 88,
      ...overrides,
    },
    isLoading: false,
    error: null,
  });
  simulationHookMocks.useStartSimulation.mockReturnValue({
    mutate: simulationHookMocks.startMutate,
    isPending: false,
  });
  simulationHookMocks.useStopSimulation.mockReturnValue({
    mutate: simulationHookMocks.stopMutate,
    isPending: false,
  });
}

describe("SimulationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus();
  });

  it("renders a light scenario runner with compact status cards", () => {
    const { container } = render(<SimulationsPage />);

    expect(
      screen.getByRole("heading", { name: "Transaction Simulations" }),
    ).toBeInTheDocument();
    const summary = screen.getByLabelText("Simulation status summary");
    expect(summary).toHaveClass("simulation-summary-grid");
    expect(summary).toHaveTextContent("Mode");
    expect(summary).toHaveTextContent("Stopped");
    expect(summary).toHaveTextContent("Active MiniApps");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("Transactions");
    expect(summary).toHaveTextContent("88");

    const controlCard = screen.getByLabelText("Simulation control panel");
    expect(controlCard).toHaveClass("simulation-control-card");
    expect(controlCard).toHaveTextContent("Scenario Runner");
    expect(controlCard).toHaveTextContent("No deploys, upgrades, or fund transfers are executed here.");
    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-blue-600|bg-red-600|dark:bg-gray/,
    );
  });

  it("shows active miniapps as readable pills instead of raw comma text", () => {
    render(<SimulationsPage />);

    const activePanel = screen.getByLabelText("Active MiniApps");
    expect(activePanel).toHaveClass("simulation-active-apps");
    expect(activePanel).toHaveTextContent("oracle-price-console");
    expect(activePanel).toHaveTextContent("aa-market-hub");
  });

  it("starts a scoped simulation with parsed miniapp targets", async () => {
    const user = userEvent.setup();
    render(<SimulationsPage />);

    await user.clear(screen.getByLabelText("Minimum interval"));
    await user.type(screen.getByLabelText("Minimum interval"), "1500");
    await user.clear(screen.getByLabelText("Maximum interval"));
    await user.type(screen.getByLabelText("Maximum interval"), "7500");
    await user.type(
      screen.getByLabelText("Target MiniApps"),
      "oracle-price-console, aa-market-hub",
    );
    await user.click(screen.getByRole("button", { name: "Start Simulation" }));

    expect(simulationHookMocks.startMutate).toHaveBeenCalledWith({
      min_interval_ms: 1500,
      max_interval_ms: 7500,
      mini_apps: ["oracle-price-console", "aa-market-hub"],
    });
  });

  it("keeps start and stop controls honest while a simulation is running", () => {
    mockStatus({ running: true });

    render(<SimulationsPage />);

    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Start Simulation" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stop Simulation" })).toBeEnabled();
    expect(screen.getByLabelText("Minimum interval")).toBeDisabled();
    expect(screen.getByLabelText("Maximum interval")).toBeDisabled();
    expect(screen.getByLabelText("Target MiniApps")).toBeDisabled();
  });

  it("keeps the source free of deprecated dark/glow simulation controls", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-blue-600|bg-red-600|text-white|dark:bg-gray|px-4 py-2 bg/,
    );
  });
});
