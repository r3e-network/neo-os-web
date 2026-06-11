import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import PriceFeedsPage from "../page";
import { ADMIN_API_KEY_STORAGE_KEY } from "@/lib/admin-client";

const pagePath = path.resolve(__dirname, "../page.tsx");

const sampleFeeds = [
  {
    id: "TWELVEDATA:BTC-USD",
    symbol: "BTC",
    pair: "BTC/USD",
    source: "twelvedata",
    enabled: true,
  },
  {
    id: "BINANCE:ETH-USDT",
    symbol: "ETH",
    pair: "ETH/USDT",
    source: "binance",
    enabled: false,
  },
];

describe("PriceFeedsPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(sampleFeeds), { status: 200 }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the demo-data banner when the pricefeeds API flags X-Mock-Data", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(sampleFeeds), {
          status: 200,
          headers: { "X-Mock-Data": "true" },
        }),
    );

    render(<PriceFeedsPage />);

    expect(await screen.findByTestId("demo-data-banner")).toHaveTextContent(
      "Demo data",
    );
  });

  it("hides the demo-data banner when the pricefeeds API serves real data", async () => {
    render(<PriceFeedsPage />);

    await screen.findByText("TWELVEDATA:BTC-USD");
    expect(screen.queryByTestId("demo-data-banner")).not.toBeInTheDocument();
  });

  it("presents oracle feed inventory with compact summary cards", async () => {
    const { container } = render(<PriceFeedsPage />);

    await screen.findByRole("heading", { name: "PriceFeed Tokens" });
    await screen.findByText("TWELVEDATA:BTC-USD");

    const summary = screen.getByLabelText("PriceFeed inventory summary");
    expect(summary).toHaveClass("pricefeeds-summary-grid");
    expect(summary).toHaveTextContent("Configured Feeds");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("Active Feeds");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("Disabled");
    expect(summary).toHaveTextContent("1");

    const tableCard = container.querySelector(".pricefeeds-table-card");
    expect(tableCard?.className).toContain("rounded-xl");
    expect(tableCard?.innerHTML).toContain("Oracle Feed Registry");
    expect(container.innerHTML).not.toMatch(
      /dark:|bg-black\/20|bg-white\/5|text-gray-300|shadow-\[/,
    );
  });

  it("attaches the saved admin key when loading protected feed config", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");

    render(<PriceFeedsPage />);

    await screen.findByText("TWELVEDATA:BTC-USD");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/pricefeeds",
      expect.objectContaining({
        headers: { "X-Admin-Key": "ui-admin-key" },
      }),
    );
  });

  it("keeps the editor open and sends admin auth when saving a token", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        return new Response(JSON.stringify(sampleFeeds), { status: 200 });
      });
    const user = userEvent.setup();

    render(<PriceFeedsPage />);

    await screen.findByText("TWELVEDATA:BTC-USD");
    await user.click(screen.getByRole("button", { name: "Add Token" }));
    await user.type(screen.getByLabelText("Feed ID"), "TWELVEDATA:NEO-USD");
    await user.type(screen.getByLabelText("Symbol"), "NEO");
    await user.type(screen.getByLabelText("Pair"), "NEO/USD");
    await user.click(screen.getByRole("button", { name: "Save Token" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pricefeeds",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Admin-Key": "ui-admin-key",
          }),
        }),
      );
    });
  });

  it("shows a friendly load error instead of rendering invalid feed data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    render(<PriceFeedsPage />);

    expect(
      await screen.findByText("Failed to load pricefeeds: Unauthorized"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Oracle Feed Registry")).not.toBeInTheDocument();
  });

  it("opens an accessible light editor instead of the legacy dark form", async () => {
    const user = userEvent.setup();
    const { container } = render(<PriceFeedsPage />);

    await screen.findByText("TWELVEDATA:BTC-USD");
    await user.click(screen.getByRole("button", { name: "Add Token" }));

    const editor = screen.getByLabelText("PriceFeed token editor");
    expect(editor).toHaveClass("pricefeeds-editor-card");
    expect(screen.getByLabelText("Feed ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
    expect(screen.getByLabelText("Pair")).toBeInTheDocument();
    expect(screen.getByLabelText("Data Source")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Enable feed for runtime use"),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Save Token" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(container.innerHTML).not.toMatch(
        /bg-black\/20|border-white\/10|shadow-\[/,
      );
    });
  });

  it("keeps the source file free of deprecated dark/glow styling tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo/,
    );
  });
});
