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

// =============================================================================
// Re-pinned 2026-07-15 to the committed Neo v3 dashboard (488fa04ec): the page
// moved to the shared light token system (`card-v3`, `ink`/`canvas`/`neo`) with
// Simplified Chinese operator copy, one consolidated failure banner, and
// aria-labelled section landmarks. Each guard's intent is unchanged:
//   1. light compact summary cards computed from live data, no dark/glow chrome
//   2. readable per-row service and miniapp activity
//   3. friendly failure state that never shows stale rows
//   4. source stays free of the deprecated dark-theme token vocabulary
// `text-white` (white-on-brand buttons), `shadow-[` (brand focus ring), and
// `border-neo` (flat tone chips) left the ban lists — in the light theme they
// are deliberate brand accents, not dark/glow styling.
// =============================================================================
describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboard();
  });

  it("renders a light platform operations dashboard with compact summary cards", () => {
    const { container } = render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: "仪表盘" }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("平台运营概览");
    expect(summary.querySelectorAll(".card-v3")).toHaveLength(4);
    expect(summary).toHaveTextContent("服务健康");
    expect(summary).toHaveTextContent("2/3");
    expect(summary).toHaveTextContent("活跃小程序");
    expect(summary).toHaveTextContent("共 3 个");
    expect(summary).toHaveTextContent("平台用户");
    expect(summary).toHaveTextContent("已注册用户");
    expect(summary).toHaveTextContent("平台状态");
    expect(summary).toHaveTextContent("需要关注");

    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-gray-300|bg-gradient|drop-shadow/,
    );
  });

  it("shows service and miniapp activity as readable operator rows", () => {
    render(<DashboardPage />);

    const servicePanel = screen.getByLabelText("服务健康面板");
    expect(servicePanel).toHaveTextContent("morpheus-relayer");
    expect(servicePanel).toHaveTextContent("catalog-sync");
    expect(servicePanel).toHaveTextContent("unhealthy");
    expect(servicePanel.querySelectorAll("li")).toHaveLength(3);

    const miniappPanel = screen.getByLabelText("最近更新面板");
    expect(miniappPanel).toHaveTextContent("oracle-price-console");
    expect(miniappPanel).toHaveTextContent("aa-session-key-lab");
    expect(miniappPanel).toHaveTextContent("pending");
    expect(miniappPanel.querySelectorAll("li")).toHaveLength(3);
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

    // Neo v3 consolidates the three per-panel alerts into one shell banner;
    // the guard's intent — a friendly failure notice plus hidden stale rows
    // and honest empty states — is unchanged.
    expect(screen.getByRole("alert")).toHaveTextContent("部分数据加载失败");
    expect(screen.queryByText("morpheus-relayer")).not.toBeInTheDocument();
    expect(screen.queryByText("oracle-price-console")).not.toBeInTheDocument();
    expect(screen.getByText("暂无服务数据")).toBeInTheDocument();
    expect(screen.getAllByText("暂无小程序数据").length).toBeGreaterThan(0);
  });

  it("keeps the source free of deprecated dark/glow dashboard tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-gray-300|text-gray-400|bg-gradient-to-|drop-shadow/,
    );
  });
});
