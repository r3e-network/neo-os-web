import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppDetailHeader } from "../../components/AppDetailHeader";
import { MiniAppInfo } from "../../components/types";

const mockApp: MiniAppInfo = {
  app_id: "test-app",
  name: "Test App",
  description: "Test Description",
  icon: "🎮",
  category: "gaming",
  entry_url: "/test",
  permissions: { payments: true },
};

describe("AppDetailHeader", () => {
  it("renders app information correctly", () => {
    const onBack = jest.fn();
    render(<AppDetailHeader app={mockApp} onBack={onBack} />);

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

  it("displays unavailable status when app status is not provided", () => {
    const onBack = jest.fn();
    render(<AppDetailHeader app={mockApp} onBack={onBack} />);

    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("renders without stats", () => {
    const onBack = jest.fn();
    render(<AppDetailHeader app={mockApp} onBack={onBack} />);

    expect(screen.getByText("Test App")).toBeInTheDocument();
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("renders category badge with correct text", () => {
    const onBack = jest.fn();
    const defiApp = { ...mockApp, category: "defi" as const };
    render(<AppDetailHeader app={defiApp} onBack={onBack} />);

    expect(screen.getByText("defi")).toBeInTheDocument();
  });

  it("displays Online status when app status is active", () => {
    const onBack = jest.fn();
    const activeApp = { ...mockApp, status: "active" as const };
    render(<AppDetailHeader app={activeApp} onBack={onBack} />);

    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });

  it("displays Maintenance status when app status is disabled", () => {
    const onBack = jest.fn();
    const disabledApp = { ...mockApp, status: "disabled" as const };
    render(<AppDetailHeader app={disabledApp} onBack={onBack} />);

    expect(screen.getByText(/maintenance/i)).toBeInTheDocument();
  });

  it("displays Pending status when app status is pending", () => {
    const onBack = jest.fn();
    const pendingApp = { ...mockApp, status: "pending" as const };
    render(<AppDetailHeader app={pendingApp} onBack={onBack} />);

    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });
});
