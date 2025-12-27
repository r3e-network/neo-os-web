import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRouter } from "next/router";
import AppDetailPage, { getServerSideProps, AppDetailPageProps } from "../../pages/app/[id]";
import { MiniAppInfo, MiniAppStats, MiniAppNotification } from "../../components/types";

// Mock Next.js router
jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();

beforeEach(() => {
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    back: mockBack,
    pathname: "/app/[id]",
    query: { id: "test-app" },
    asPath: "/app/test-app",
  });
});

const mockApp: MiniAppInfo = {
  app_id: "test-app",
  name: "Test App",
  description: "A test application for gaming",
  icon: "🎮",
  category: "gaming",
  entry_url: "/miniapps/test/index.html",
  permissions: {
    payments: true,
    randomness: true,
  },
  limits: {
    max_gas_per_tx: "10",
    daily_gas_cap_per_user: "100",
  },
};

const mockStats: MiniAppStats = {
  app_id: "test-app",
  total_transactions: 1000,
  total_users: 500,
  total_gas_used: "250.50",
  daily_active_users: 150,
  weekly_active_users: 350,
  last_activity_at: "2025-12-26T10:00:00Z",
};

const mockNotifications: MiniAppNotification[] = [
  {
    id: "1",
    app_id: "test-app",
    title: "Achievement Unlocked",
    content: "You've completed 100 transactions!",
    notification_type: "achievement",
    source: "system",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    app_id: "test-app",
    title: "New Feature",
    content: "Check out our new game mode!",
    notification_type: "update",
    source: "admin",
    tx_hash: "0xabc123",
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

describe("AppDetailPage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders app detail page with all sections", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText("A test application for gaming")).toBeInTheDocument();
    expect(screen.getByText("🎮")).toBeInTheDocument();
  });

  it("displays stats cards correctly", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.getByText("1,000")).toBeInTheDocument(); // Total TXs
    expect(screen.getByText("150")).toBeInTheDocument(); // Daily Active Users
    expect(screen.getByText("250.50")).toBeInTheDocument(); // GAS Burned
    expect(screen.getByText("350")).toBeInTheDocument(); // Weekly Active
  });

  it("renders without stats", () => {
    render(<AppDetailPage app={mockApp} stats={null} notifications={mockNotifications} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.queryByText("1,000")).not.toBeInTheDocument();
  });

  it("respects stats_display when provided", () => {
    const appWithStatsDisplay = { ...mockApp, stats_display: ["total_users"] };
    render(<AppDetailPage app={appWithStatsDisplay} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.queryByText("Total TXs")).not.toBeInTheDocument();
  });

  it("hides stats when stats_display is empty", () => {
    const appWithNoStats = { ...mockApp, stats_display: [] };
    render(<AppDetailPage app={appWithNoStats} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.queryByText("Total TXs")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Users")).not.toBeInTheDocument();
  });

  it("hides news tab when news integration is disabled", () => {
    const appWithoutNews = { ...mockApp, news_integration: false };
    render(<AppDetailPage app={appWithoutNews} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.queryByRole("button", { name: /news/i })).not.toBeInTheDocument();
    expect(screen.getByText("News feed disabled by manifest.")).toBeInTheDocument();
  });

  it("calls router.back when back button is clicked", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    const backButton = screen.getByRole("button", { name: /go back/i });
    fireEvent.click(backButton);

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("navigates to launch page when launch button is clicked", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    const launchButton = screen.getByRole("button", { name: /launch app/i });
    fireEvent.click(launchButton);

    expect(mockPush).toHaveBeenCalledWith("/launch/test-app");
  });

  it("switches between overview and news tabs", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    const overviewTab = screen.getByRole("button", { name: /overview/i });
    const newsTab = screen.getByRole("button", { name: /news/i });

    // Default is overview
    expect(screen.getByText("Permissions")).toBeInTheDocument();

    // Click news tab
    fireEvent.click(newsTab);
    expect(screen.getByText("Achievement Unlocked")).toBeInTheDocument();

    // Click back to overview
    fireEvent.click(overviewTab);
    expect(screen.getByText("Permissions")).toBeInTheDocument();
  });

  it("displays permissions in overview tab", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.getByText("Permissions")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("Randomness")).toBeInTheDocument();
  });

  it("displays limits in overview tab", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.getByText("Limits")).toBeInTheDocument();
    expect(screen.getByText(/Max GAS per transaction: 10/)).toBeInTheDocument();
    expect(screen.getByText(/Daily GAS cap per user: 100/)).toBeInTheDocument();
  });

  it("does not display limits section when limits are not provided", () => {
    const appWithoutLimits = { ...mockApp, limits: undefined };
    render(<AppDetailPage app={appWithoutLimits} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.queryByText("Limits")).not.toBeInTheDocument();
  });

  it("displays contract details in overview tab", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.getByText("Contract Details")).toBeInTheDocument();
    expect(screen.getByText(/App ID:/)).toBeInTheDocument();
    expect(screen.getByText("test-app")).toBeInTheDocument();
    expect(screen.getByText(/Entry URL:/)).toBeInTheDocument();
    expect(screen.getByText("/miniapps/test/index.html")).toBeInTheDocument();
  });

  it("displays notifications count in news tab", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={mockNotifications} />);

    expect(screen.getByText(/News \(2\)/)).toBeInTheDocument();
  });

  it("renders error state when app is null", () => {
    render(<AppDetailPage app={null} stats={null} notifications={[]} error="App not found" />);

    expect(screen.getByText("App Not Found")).toBeInTheDocument();
    expect(screen.getByText("App not found")).toBeInTheDocument();
  });

  it("navigates to home when back button is clicked in error state", () => {
    render(<AppDetailPage app={null} stats={null} notifications={[]} error="App not found" />);

    const backButton = screen.getByRole("button", { name: /back to home/i });
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("displays default error message when error prop is not provided", () => {
    render(<AppDetailPage app={null} stats={null} notifications={[]} />);

    expect(screen.getByText("The requested MiniApp does not exist.")).toBeInTheDocument();
  });

  it("renders news tab with empty notifications", () => {
    render(<AppDetailPage app={mockApp} stats={mockStats} notifications={[]} />);

    const newsTab = screen.getByRole("button", { name: /news \(0\)/i });
    fireEvent.click(newsTab);

    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("formats permission names correctly", () => {
    const appWithMultiWordPermission: MiniAppInfo = {
      ...mockApp,
      permissions: {
        payments: true,
        governance: true,
      },
    };

    render(<AppDetailPage app={appWithMultiWordPermission} stats={mockStats} notifications={[]} />);

    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("Governance")).toBeInTheDocument();
  });
});

describe("getServerSideProps", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("fetches app data and notifications successfully", async () => {
    const mockStatsPayload = { ...mockApp, ...mockStats };
    const mockStatsResponse = {
      stats: [mockStatsPayload],
    };

    const mockNotifResponse = {
      notifications: mockNotifications,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifResponse,
      });

    const context = {
      params: { id: "test-app" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    const result = await getServerSideProps(context);

    expect("props" in result).toBe(true);
    if ("props" in result) {
      const props = result.props as AppDetailPageProps;
      expect(props.app).toMatchObject({
        app_id: "test-app",
        name: "Test App",
        entry_url: "/miniapps/test/index.html",
        category: "gaming",
      });
      expect(props.stats).toMatchObject({
        app_id: "test-app",
        total_transactions: 1000,
      });
      expect(props.notifications).toEqual(mockNotifications);
    }

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/miniapp-stats?app_id=test-app",
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/app/test-app/news?limit=20",
      expect.any(Object),
    );
  });

  it("returns mock data for builtin apps when not found in API", async () => {
    const mockStatsResponse = { stats: [] };
    const mockNotifResponse = { notifications: mockNotifications };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifResponse,
      });

    const context = {
      params: { id: "builtin-lottery" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    const result = await getServerSideProps(context);

    expect("props" in result).toBe(true);
    if ("props" in result) {
      const props = result.props as AppDetailPageProps;
      expect(props.app).toBeTruthy();
      expect(props.app?.app_id).toBe("builtin-lottery");
      expect(props.app?.name).toBe("Neo Lottery");
    }
  });

  it("returns error when app not found and not a builtin app", async () => {
    const mockStatsResponse = { stats: [] };
    const mockNotifResponse = { notifications: [] };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifResponse,
      });

    const context = {
      params: { id: "non-existent-app" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    const result = await getServerSideProps(context);

    expect(result).toEqual({
      props: {
        app: null,
        stats: null,
        notifications: [],
        error: "App not found",
      },
    });
  });

  it("handles fetch errors gracefully", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const context = {
      params: { id: "test-app" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    const result = await getServerSideProps(context);

    expect(result).toEqual({
      props: {
        app: null,
        stats: null,
        notifications: [],
        error: "Failed to load app details",
      },
    });
    consoleErrorSpy.mockRestore();
  });

  it("uses custom API URL from environment", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";

    const mockStatsResponse = { stats: [mockApp] };
    const mockNotifResponse = { notifications: [] };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifResponse,
      });

    const context = {
      params: { id: "test-app" },
    } as any;

    await getServerSideProps(context);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/miniapp-stats?app_id=test-app",
      expect.any(Object),
    );
  });
});
