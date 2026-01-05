import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppDetailHeader } from "../../components/AppDetailHeader";
import { MiniAppInfo, MiniAppStats } from "../../components/types";

// Mock ThemeProvider to avoid "useTheme must be used within ThemeProvider" error
jest.mock("../../components/providers/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ theme: "dark", setTheme: jest.fn() }),
}));

const mockApp: MiniAppInfo = {
  app_id: "test-app",
  name: "Test App",
  description: "Test Description",
  icon: "🎮",
  category: "gaming",
  entry_url: "/test",
  permissions: { payments: true },
};

const mockStats: MiniAppStats = {
  app_id: "test-app",
  total_transactions: 100,
  total_users: 50,
  total_gas_used: "10.5",
  daily_active_users: 20,
  weekly_active_users: 35,
  last_activity_at: "2025-12-26T10:00:00Z",
};

describe("AppDetailHeader", () => {
  it("renders app information correctly", () => {
    render(<AppDetailHeader app={mockApp} stats={mockStats} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText("🎮")).toBeInTheDocument();
    expect(screen.getByText("gaming")).toBeInTheDocument();
  });

  it("displays active status when stats have last_activity_at", () => {
    render(<AppDetailHeader app={mockApp} stats={mockStats} />);

    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("displays inactive status when stats have no last_activity_at", () => {
    const inactiveStats = { ...mockStats, last_activity_at: null };
    render(<AppDetailHeader app={mockApp} stats={inactiveStats} />);

    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it("renders without stats", () => {
    render(<AppDetailHeader app={mockApp} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it("renders category badge with correct text", () => {
    const defiApp = { ...mockApp, category: "defi" as const };
    render(<AppDetailHeader app={defiApp} />);

    expect(screen.getByText("defi")).toBeInTheDocument();
  });
});
