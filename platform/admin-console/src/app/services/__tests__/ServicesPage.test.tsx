import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import ServicesPage from "../page";

const servicesHookMocks = vi.hoisted(() => ({
  useServicesHealth: vi.fn(),
}));

vi.mock("@/lib/hooks/useServices", () => ({
  useServicesHealth: servicesHookMocks.useServicesHealth,
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

const services = [
  {
    name: "morpheus-relayer",
    status: "healthy",
    url: "https://relayer.example",
    version: "2.4.0",
    lastCheck: "2026-05-26T05:50:00Z",
  },
  {
    name: "morpheus-relayer-feed",
    status: "healthy",
    url: "https://relayer-feed.example",
    version: "2.4.1",
    lastCheck: "2026-05-26T05:51:00Z",
  },
  {
    name: "catalog-sync",
    status: "unhealthy",
    url: "https://catalog.example",
    lastCheck: "2026-05-26T05:20:00Z",
    error: "Heartbeat overdue",
  },
];

function mockServices(overrides = {}) {
  servicesHookMocks.useServicesHealth.mockReturnValue({
    data: services,
    isLoading: false,
    error: null,
    ...overrides,
  });
}

describe("ServicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServices();
  });

  it("renders a light services operations page with compact health summary", () => {
    const { container } = render(<ServicesPage />);

    expect(
      screen.getByRole("heading", { name: "Services" }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("Services operations summary");
    expect(summary).toHaveClass("services-summary-grid");
    expect(summary).toHaveTextContent("Healthy Services");
    expect(summary).toHaveTextContent("2/3");
    expect(summary).toHaveTextContent("Unhealthy");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("Unknown");
    expect(summary).toHaveTextContent("0");
    expect(summary).toHaveTextContent("Polling");
    expect(summary).toHaveTextContent("30s");

    const panel = screen.getByLabelText("Services health panel");
    expect(panel).toHaveClass("services-health-card");
    expect(panel).toHaveTextContent("Service Health Status");
    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|drop-shadow/,
    );
  });

  it("keeps desktop rows and mobile service cards wired to real configuration links", () => {
    const { container } = render(<ServicesPage />);

    const tableWrap = container.querySelector(".services-desktop-table");
    expect(tableWrap).toHaveClass("hidden", "md:block");
    const table = screen.getByRole("table", { name: "Services status" });
    expect(table).toHaveClass("services-status-table", "table-fixed");
    expect(table).toHaveTextContent("morpheus-relayer-feed");

    const mobileList = screen.getByLabelText("Mobile services list");
    expect(mobileList).toHaveClass("services-mobile-list", "md:hidden");
    expect(mobileList).toHaveTextContent("catalog-sync");
    expect(mobileList).toHaveTextContent("Heartbeat overdue");

    const configureLink = screen.getByRole("link", {
      name: "Configure morpheus-relayer-feed",
    });
    // jest-dom matchers return void, so each assertion gets its own expect —
    // the previous chained form only typechecked by accident.
    expect(configureLink).toHaveAttribute(
      "href",
      "/services/morpheus-relayer-feed",
    );
    expect(configureLink).toHaveClass("w-full");
  });

  it("keeps data failures friendly and does not render stale service rows", () => {
    mockServices({
      data: undefined,
      isLoading: false,
      error: new Error("Unauthorized"),
    });

    render(<ServicesPage />);

    const summary = screen.getByLabelText("Services operations summary");
    expect(summary).toHaveTextContent("Unavailable");
    expect(summary).toHaveTextContent("Fresh health check failed");
    expect(
      screen.getByRole("alert", {
        name: "Services health could not be loaded",
      }),
    ).toHaveTextContent("Services health could not be loaded");
    expect(screen.queryByText("morpheus-relayer")).not.toBeInTheDocument();
  });

  it("keeps the source file free of deprecated dark/glow services tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo|drop-shadow-\[/,
    );
  });
});
