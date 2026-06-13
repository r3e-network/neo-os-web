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

    expect(
      screen.getByRole("heading", { level: 1, name: "Test App" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Test App")).toBeInTheDocument();
    // Category renders in the desktop row and inside the mobile overflow chip.
    expect(screen.getAllByText("gaming").length).toBeGreaterThan(0);
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

    expect(
      screen.getByRole("heading", { level: 1, name: "Test App" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("renders category badge with correct text", () => {
    const onBack = jest.fn();
    const defiApp = { ...mockApp, category: "defi" as const };
    render(<AppDetailHeader app={defiApp} onBack={onBack} />);

    expect(screen.getAllByText("defi").length).toBeGreaterThan(0);
  });

  it("keeps the status chip visible at every viewport width", () => {
    const onBack = jest.fn();
    const activeApp = { ...mockApp, status: "active" as const };
    render(<AppDetailHeader app={activeApp} onBack={onBack} />);

    const status = screen.getByTestId("app-header-status");
    expect(status).toHaveTextContent("Online");
    // The trust signal must not be folded behind a responsive `hidden` class:
    // phones need the Online/Maintenance answer in the header too.
    expect(status.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("folds category, flagship, and surface chips into a mobile overflow menu", () => {
    const onBack = jest.fn();
    const contractApp = {
      ...mockApp,
      status: "active" as const,
      contract_hash: "0x442162de9c0d0e30b09590b125c2b1f7e8fa5e3b",
    };
    render(<AppDetailHeader app={contractApp} onBack={onBack} />);

    const overflow = screen.getByTestId("app-header-overflow");
    // Mobile-only fold: hidden from sm upward, visible below.
    expect(overflow.className).toContain("sm:hidden");
    expect(overflow).toHaveTextContent("gaming");
    expect(overflow).toHaveTextContent("Contract");
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

  it("displays Beta status when app status is beta", () => {
    const onBack = jest.fn();
    const betaApp = { ...mockApp, status: "beta" as const };
    render(<AppDetailHeader app={betaApp} onBack={onBack} />);

    expect(screen.getByText(/beta/i)).toBeInTheDocument();
  });
});
