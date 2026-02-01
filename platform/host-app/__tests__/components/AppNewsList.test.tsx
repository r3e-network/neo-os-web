import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppNewsList } from "../../components/AppNewsList";
import type { MiniAppNotification } from "../../components/types";

const mockNotifications: MiniAppNotification[] = [
  {
    id: "1",
    app_id: "test-app",
    chain_id: "neo-n3-mainnet",
    title: "New Achievement",
    content: "You've reached level 10!",
    notification_type: "achievement",
    source: "system",
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
  },
  {
    id: "2",
    app_id: "test-app",
    chain_id: "neo-n3-mainnet",
    title: "System Update",
    content: "New features available",
    notification_type: "update",
    source: "admin",
    tx_hash: "0x123abc",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
];

describe("AppNewsList", () => {
  it("renders loading state", () => {
    render(<AppNewsList notifications={[]} loading={true} />);

    expect(screen.getByText("Loading updates...")).toBeInTheDocument();
  });

  it("renders empty state when no notifications", () => {
    render(<AppNewsList notifications={[]} />);

    expect(screen.getByText("No recent updates")).toBeInTheDocument();
  });

  it("renders list of notifications", () => {
    render(<AppNewsList notifications={mockNotifications} />);

    expect(screen.getByText("New Achievement")).toBeInTheDocument();
    expect(screen.getByText("You've reached level 10!")).toBeInTheDocument();
    expect(screen.getByText("System Update")).toBeInTheDocument();
    expect(screen.getByText("New features available")).toBeInTheDocument();
  });

  it("displays correct icon for achievement type", () => {
    const achievementNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Achievement",
        content: "Test",
        notification_type: "achievement",
        source: "system",
        created_at: new Date().toISOString(),
      },
    ];
    render(<AppNewsList notifications={achievementNotif} />);

    expect(screen.getByText("🏆")).toBeInTheDocument();
  });

  it("displays correct icon for update type", () => {
    const updateNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Update",
        content: "Test",
        notification_type: "update",
        source: "system",
        created_at: new Date().toISOString(),
      },
    ];
    render(<AppNewsList notifications={updateNotif} />);

    expect(screen.getByText("🔔")).toBeInTheDocument();
  });

  it("displays correct icon for warning type", () => {
    const warningNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Warning",
        content: "Test",
        notification_type: "warning",
        source: "system",
        created_at: new Date().toISOString(),
      },
    ];
    render(<AppNewsList notifications={warningNotif} />);

    expect(screen.getByText("⚠️")).toBeInTheDocument();
  });

  it("renders transaction link when tx_hash is provided", () => {
    render(<AppNewsList notifications={mockNotifications} />);

    const txLink = screen.getByText("Proof →");
    expect(txLink).toBeInTheDocument();
    expect(txLink).toHaveAttribute("href", "https://dora.coz.io/transaction/neo3/0x123abc");
    expect(txLink).toHaveAttribute("target", "_blank");
  });

  it("does not render transaction link when tx_hash is missing", () => {
    const noTxNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Test",
        content: "No TX",
        notification_type: "info",
        source: "system",
        created_at: new Date().toISOString(),
      },
    ];
    render(<AppNewsList notifications={noTxNotif} />);

    expect(screen.queryByText("View Transaction →")).not.toBeInTheDocument();
  });

  it("displays time ago correctly for recent notifications", () => {
    const recentNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Recent",
        content: "Test",
        notification_type: "info",
        source: "system",
        created_at: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
      },
    ];
    render(<AppNewsList notifications={recentNotif} />);

    expect(screen.getByText("0m")).toBeInTheDocument();
  });

  it("displays time ago in minutes", () => {
    const minutesAgoNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Test",
        content: "Test",
        notification_type: "info",
        source: "system",
        created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
      },
    ];
    render(<AppNewsList notifications={minutesAgoNotif} />);

    expect(screen.getByText("15m")).toBeInTheDocument();
  });

  it("displays time ago in hours", () => {
    const hoursAgoNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Test",
        content: "Test",
        notification_type: "info",
        source: "system",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      },
    ];
    render(<AppNewsList notifications={hoursAgoNotif} />);

    expect(screen.getByText("3h")).toBeInTheDocument();
  });

  it("displays time ago in days", () => {
    const daysAgoNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Test",
        content: "Test",
        notification_type: "info",
        source: "system",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      },
    ];
    render(<AppNewsList notifications={daysAgoNotif} />);

    expect(screen.getByText("2d")).toBeInTheDocument();
  });

  it("handles multiple notifications correctly", () => {
    render(<AppNewsList notifications={mockNotifications} />);

    const notifications = screen.getAllByRole("heading", { level: 4 });
    expect(notifications).toHaveLength(2);
  });

  it("uses default icon for unknown notification type", () => {
    const unknownTypeNotif: MiniAppNotification[] = [
      {
        id: "1",
        app_id: "test",
        chain_id: "neo-n3-mainnet",
        title: "Unknown",
        content: "Test",
        notification_type: "unknown",
        source: "system",
        created_at: new Date().toISOString(),
      },
    ];
    render(<AppNewsList notifications={unknownTypeNotif} />);

    expect(screen.getByText("📢")).toBeInTheDocument();
  });
});
