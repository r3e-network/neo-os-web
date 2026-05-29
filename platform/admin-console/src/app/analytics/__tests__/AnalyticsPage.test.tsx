import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import AnalyticsPage from "../page";

const analyticsHookMocks = vi.hoisted(() => ({
  useAnalytics: vi.fn(),
  useMiniAppUsage: vi.fn(),
}));

vi.mock("@/lib/hooks/useAnalytics", () => ({
  useAnalytics: analyticsHookMocks.useAnalytics,
  useMiniAppUsage: analyticsHookMocks.useMiniAppUsage,
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

const analyticsData = {
  totalUsers: 1250,
  totalMiniApps: 60,
  totalTransactions: 18420,
  gasUsageToday: 932,
  usageByApp: [
    {
      app_id: "oracle-price-console",
      total_gas: 5200,
      total_governance: 180,
      user_count: 88,
    },
    {
      app_id: "aa-market-hub",
      total_gas: 3400,
      total_governance: 95,
      user_count: 64,
    },
  ],
  usageOverTime: [],
};

const usageData = [
  {
    id: "usage-1",
    user_id: "user-1",
    app_id: "oracle-price-console",
    usage_date: "2026-05-20",
    gas_used: 120,
    governance_used: 10,
    created_at: "2026-05-20T00:00:00Z",
    updated_at: "2026-05-20T00:00:00Z",
  },
  {
    id: "usage-2",
    user_id: "user-2",
    app_id: "aa-market-hub",
    usage_date: "2026-05-21",
    gas_used: 260,
    governance_used: 20,
    created_at: "2026-05-21T00:00:00Z",
    updated_at: "2026-05-21T00:00:00Z",
  },
];

function mockAnalytics(overrides = {}) {
  analyticsHookMocks.useAnalytics.mockReturnValue({
    data: analyticsData,
    isLoading: false,
    isError: false,
    ...overrides,
  });
}

function mockUsage(overrides = {}) {
  analyticsHookMocks.useMiniAppUsage.mockReturnValue({
    data: usageData,
    isLoading: false,
    isError: false,
    ...overrides,
  });
}

describe("AnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalytics();
    mockUsage();
  });

  it("renders a light analytics dashboard with compact KPI cards", () => {
    const { container } = render(<AnalyticsPage />);

    expect(
      screen.getByRole("heading", { name: "Analytics" }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("Analytics KPI summary");
    expect(summary).toHaveClass("analytics-summary-grid");
    expect(summary).toHaveTextContent("Total Users");
    expect(summary).toHaveTextContent("1,250");
    expect(summary).toHaveTextContent("Total MiniApps");
    expect(summary).toHaveTextContent("60");
    expect(summary).toHaveTextContent("Transactions");
    expect(summary).toHaveTextContent("18,420");
    expect(summary).toHaveTextContent("GAS Today");
    expect(summary).toHaveTextContent("932");

    const chartCard = screen.getByLabelText("Gas usage trend");
    expect(chartCard).toHaveClass("analytics-chart-card");
    expect(chartCard).toHaveTextContent("Usage Over Time");
    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|shadow-\[/,
    );
  });

  it("shows top MiniApps as readable operator rows", () => {
    render(<AnalyticsPage />);

    const appPanel = screen.getByLabelText("Usage by MiniApp");
    expect(appPanel).toHaveClass("analytics-apps-card");
    expect(appPanel).toHaveTextContent("oracle-price-console");
    expect(appPanel).toHaveTextContent("88 users");
    expect(appPanel).toHaveTextContent("GAS 5,200");
    expect(appPanel).toHaveTextContent("GOV 180");
    expect(appPanel).toHaveTextContent("aa-market-hub");
  });

  it("keeps error states friendly and scoped to the failed data source", () => {
    mockAnalytics({ isError: true, data: undefined });
    mockUsage({ isError: true, data: undefined });

    render(<AnalyticsPage />);

    expect(
      screen.getByRole("alert", {
        name: "Analytics overview could not be loaded",
      }),
    ).toHaveTextContent("Analytics overview could not be loaded");
    expect(
      screen.getByRole("alert", { name: "Usage history could not be loaded" }),
    ).toHaveTextContent("Usage history could not be loaded");
    expect(screen.queryByText("Usage Over Time")).not.toBeInTheDocument();
  });

  it("keeps the source free of deprecated dark/glow analytics tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo|drop-shadow-\[/,
    );
  });
});
