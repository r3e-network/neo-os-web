import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppStatsCard } from "../../components/AppStatsCard";

describe("AppStatsCard", () => {
  it("renders basic card with title and value", () => {
    render(<AppStatsCard title="Total Users" value={1000} icon="👥" />);

    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(screen.getByText("👥")).toBeInTheDocument();
  });

  it("renders with string value", () => {
    render(<AppStatsCard title="GAS Burned" value="123.45" icon="🔥" />);

    expect(screen.getByText("123.45")).toBeInTheDocument();
  });

  it("renders trend indicator with up trend", () => {
    render(<AppStatsCard title="Daily Active" value={500} icon="📈" trend="up" trendValue="+15%" />);

    expect(screen.getByText(/\+15%/)).toBeInTheDocument();
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it("renders trend indicator with down trend", () => {
    render(<AppStatsCard title="Revenue" value={200} icon="💰" trend="down" trendValue="-5%" />);

    expect(screen.getByText(/-5%/)).toBeInTheDocument();
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it("renders trend indicator with neutral trend", () => {
    render(<AppStatsCard title="Volume" value={1000} icon="📊" trend="neutral" trendValue="0%" />);

    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it("does not render trend when not provided", () => {
    render(<AppStatsCard title="Total TXs" value={100} icon="📊" />);

    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
    expect(screen.queryByText(/↓/)).not.toBeInTheDocument();
  });

  it("displays title text correctly", () => {
    render(<AppStatsCard title="weekly active users" value={50} icon="👥" />);

    expect(screen.getByText("weekly active users")).toBeInTheDocument();
  });

  it("handles large numbers", () => {
    render(<AppStatsCard title="Total" value={1000000} icon="🔢" />);

    expect(screen.getByText("1000000")).toBeInTheDocument();
  });

  it("handles decimal values", () => {
    render(<AppStatsCard title="Average" value="45.678" icon="📊" />);

    expect(screen.getByText("45.678")).toBeInTheDocument();
  });

  it("handles trend without trendValue", () => {
    render(<AppStatsCard title="Status" value={100} icon="📊" trend="up" />);

    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
  });

  it("renders with no trend parameter", () => {
    render(<AppStatsCard title="Total" value={500} icon="💯" trendValue="+10%" />);

    // Should render trendValue but with muted color since no trend
    expect(screen.getByText(/\+10%/)).toBeInTheDocument();
  });
});
