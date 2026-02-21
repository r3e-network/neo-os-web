import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppDetailHeader } from "../../components/AppDetailHeader";
import { MiniAppInfo, MiniAppStats } from "../../components/types";

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
    const onBack = jest.fn();
    render(<AppDetailHeader app={mockApp} stats={mockStats} onBack={onBack} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText("🎮")).toBeInTheDocument();
    expect(screen.getByText("gaming")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = jest.fn();
    render(<AppDetailHeader app={mockApp} onBack={onBack} />);

    const backButton = screen.getByRole("button", { name: /go back/i });
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("displays active status when stats have last_activity_at", () => {
    const onBack = jest.fn();
    render(<AppDetailHeader app={mockApp} stats={mockStats} onBack={onBack} />);

    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("displays inactive status when stats have no last_activity_at", () => {
    const onBack = jest.fn();
    const inactiveStats = { ...mockStats, last_activity_at: null };
    render(<AppDetailHeader app={mockApp} stats={inactiveStats} onBack={onBack} />);

    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it("renders without stats", () => {
    const onBack = jest.fn();
    render(<AppDetailHeader app={mockApp} onBack={onBack} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it("renders category badge with correct text", () => {
    const onBack = jest.fn();
    const defiApp = { ...mockApp, category: "defi" as const };
    render(<AppDetailHeader app={defiApp} onBack={onBack} />);

    expect(screen.getByText("defi")).toBeInTheDocument();
  });
});
