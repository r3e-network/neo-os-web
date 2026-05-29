import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import DashboardPage from "../page";

const dashboardHookMocks = vi.hoisted(() => ({
  useServicesHealth: vi.fn(),
  useMiniApps: vi.fn(),
  useUsers: vi.fn(),
}));

vi.mock("@/lib/hooks/useServices", () => ({
  useServicesHealth: dashboardHookMocks.useServicesHealth,
}));

vi.mock("@/lib/hooks/useMiniApps", () => ({
  useMiniApps: dashboardHookMocks.useMiniApps,
}));

vi.mock("@/lib/hooks/useUsers", () => ({
  useUsers: dashboardHookMocks.useUsers,
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

const services = [
  {
    name: "morpheus-relayer",
    status: "healthy",
    lastCheck: "2026-05-26T05:50:00Z",
  },
  {
    name: "morpheus-relayer-feed",
    status: "healthy",
    lastCheck: "2026-05-26T05:51:00Z",
  },
  {
    name: "catalog-sync",
    status: "unhealthy",
    lastCheck: "2026-05-26T05:20:00Z",
  },
];

const miniapps = [
  {
    app_id: "oracle-price-console",
    status: "active",
    created_at: "2026-05-21T08:00:00Z",
  },
  {
    app_id: "aa-session-key-lab",
    status: "active",
    created_at: "2026-05-22T08:00:00Z",
  },
  {
    app_id: "trustanchor",
    status: "pending",
    created_at: "2026-05-23T08:00:00Z",
  },
];

const users = [
  { id: "user-1" },
  { id: "user-2" },
  { id: "user-3" },
];

function mockDashboard(overrides = {}) {
  dashboardHookMocks.useServicesHealth.mockReturnValue({
    data: services,
    isLoading: false,
    error: null,
    ...overrides,
  });
  dashboardHookMocks.useMiniApps.mockReturnValue({
    data: miniapps,
    isLoading: false,
    error: null,
    ...overrides,
  });
  dashboardHookMocks.useUsers.mockReturnValue({
    data: users,
    isLoading: false,
    error: null,
    ...overrides,
  });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboard();
  });

  it("renders a light platform operations dashboard with compact summary cards", () => {
    const { container } = render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: "System Dashboard" }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("Platform operations summary");
    expect(summary).toHaveClass("dashboard-summary-grid");
    expect(summary).toHaveTextContent("Services Health");
    expect(summary).toHaveTextContent("2/3");
    expect(summary).toHaveTextContent("Active MiniApps");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("Total Users");
    expect(summary).toHaveTextContent("3");
    expect(summary).toHaveTextContent("Platform Status");
    expect(summary).toHaveTextContent("Needs Review");

    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|shadow-\[|drop-shadow/,
    );
  });

  it("shows service and miniapp activity as readable operator rows", () => {
    const { container } = render(<DashboardPage />);

    const servicePanel = screen.getByLabelText("Service health panel");
    expect(servicePanel).toHaveClass("dashboard-service-card");
    expect(servicePanel).toHaveTextContent("morpheus-relayer");
    expect(servicePanel).toHaveTextContent("catalog-sync");
    expect(servicePanel).toHaveTextContent("unhealthy");

    const miniappPanel = screen.getByLabelText("Recent MiniApps panel");
    expect(miniappPanel).toHaveClass("dashboard-miniapps-card");
    expect(miniappPanel).toHaveTextContent("oracle-price-console");
    expect(miniappPanel).toHaveTextContent("aa-session-key-lab");
    expect(miniappPanel).toHaveTextContent("pending");
    expect(container.querySelectorAll(".dashboard-row")).toHaveLength(6);
  });

  it("keeps data failures friendly and does not render stale rows", () => {
    dashboardHookMocks.useServicesHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Unauthorized"),
    });
    dashboardHookMocks.useMiniApps.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Unauthorized"),
    });
    dashboardHookMocks.useUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Unauthorized"),
    });

    render(<DashboardPage />);

    expect(
      screen.getByRole("alert", {
        name: "Dashboard overview could not be loaded",
      }),
    ).toHaveTextContent("Dashboard overview could not be loaded");
    expect(
      screen.getByRole("alert", {
        name: "Service health could not be loaded",
      }),
    ).toHaveTextContent("Service health could not be loaded");
    expect(
      screen.getByRole("alert", {
        name: "Recent MiniApps could not be loaded",
      }),
    ).toHaveTextContent("Recent MiniApps could not be loaded");
    expect(screen.queryByText("morpheus-relayer")).not.toBeInTheDocument();
    expect(screen.queryByText("oracle-price-console")).not.toBeInTheDocument();
  });

  it("keeps the source free of deprecated dark/glow dashboard tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo|drop-shadow-\[/,
    );
  });
});
