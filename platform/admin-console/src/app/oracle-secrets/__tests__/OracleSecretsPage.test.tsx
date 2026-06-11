import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import OracleSecretsPage from "../page";
import { ADMIN_API_KEY_STORAGE_KEY } from "@/lib/admin-client";

const pagePath = path.resolve(__dirname, "../page.tsx");

const sampleSecrets = [
  {
    id: "1",
    name: "binance_api_key",
    description: "Binance API key for market data",
    lastUpdated: "2026-03-01T10:00:00Z",
  },
  {
    id: "2",
    name: "twelvedata_api_key",
    description: "Twelve Data API key",
    lastUpdated: "2026-03-05T12:00:00Z",
  },
];

describe("OracleSecretsPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(sampleSecrets), { status: 200 }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the demo-data banner when the secrets API flags X-Mock-Data", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(sampleSecrets), {
          status: 200,
          headers: { "X-Mock-Data": "true" },
        }),
    );

    render(<OracleSecretsPage />);

    expect(await screen.findByTestId("demo-data-banner")).toHaveTextContent(
      "Demo data",
    );
  });

  it("hides the demo-data banner when the secrets API serves real data", async () => {
    render(<OracleSecretsPage />);

    await screen.findByText("binance_api_key");
    expect(screen.queryByTestId("demo-data-banner")).not.toBeInTheDocument();
  });

  it("renders a light secret inventory dashboard without legacy dark styling", async () => {
    const { container } = render(<OracleSecretsPage />);

    await screen.findByRole("heading", { name: "NeoOracle Secrets" });
    await screen.findByText("binance_api_key");

    const summary = screen.getByLabelText("Oracle secret inventory summary");
    expect(summary).toHaveClass("oracle-secrets-summary-grid");
    expect(summary).toHaveTextContent("Configured Secrets");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("Protected Values");
    expect(summary).toHaveTextContent("Hidden");

    const tableCard = container.querySelector(".oracle-secrets-table-card");
    expect(tableCard?.className).toContain("rounded-xl");
    expect(tableCard?.innerHTML).toContain("Secret Registry");
    expect(container.innerHTML).not.toMatch(
      /dark:|bg-black\/20|bg-black\/30|bg-white\/5|text-gray-300|shadow-\[/,
    );
  });

  it("attaches the saved admin key when loading protected secrets", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");

    render(<OracleSecretsPage />);

    await screen.findByText("binance_api_key");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/oracle-secrets",
      expect.objectContaining({
        headers: { "X-Admin-Key": "ui-admin-key" },
      }),
    );
  });

  it("keeps secret values write-only and sends admin auth on save", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        return new Response(JSON.stringify(sampleSecrets), { status: 200 });
      });
    const user = userEvent.setup();

    render(<OracleSecretsPage />);

    await screen.findByText("binance_api_key");
    await user.click(screen.getByRole("button", { name: "Add Secret" }));

    const editor = screen.getByLabelText("Oracle secret editor");
    expect(editor).toHaveClass("oracle-secrets-editor-card");
    await user.type(screen.getByLabelText("Secret Name"), "neo_market_key");
    await user.type(screen.getByLabelText("Description"), "Neo market API");
    await user.type(screen.getByLabelText("Secret Value"), "super-secret-token");
    await user.click(screen.getByRole("button", { name: "Save Securely" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/oracle-secrets",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Admin-Key": "ui-admin-key",
          }),
        }),
      );
    });
    expect(screen.queryByText("super-secret-token")).not.toBeInTheDocument();
  });

  it("shows a friendly load error instead of rendering invalid secret data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    render(<OracleSecretsPage />);

    expect(
      await screen.findByText("Failed to load oracle secrets: Unauthorized"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Secret Registry")).not.toBeInTheDocument();
  });

  it("keeps the source free of deprecated dark/glow secret-management tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /dark:|bg-black\/20|bg-black\/30|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo/,
    );
  });
});
