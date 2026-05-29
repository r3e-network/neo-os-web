import { render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import ContractsPage from "../page";
import { ADMIN_API_KEY_STORAGE_KEY } from "@/lib/admin-client";

const pagePath = path.resolve(__dirname, "../page.tsx");

const sampleContracts = [
  {
    id: "AppRegistry",
    name: "AppRegistry",
    hash: "0x1111111111111111111111111111111111111111",
    deployed: true,
  },
  {
    id: "PriceFeed",
    name: "PriceFeed",
    hash: "0x4444444444444444444444444444444444444444",
    deployed: false,
  },
];

async function waitForContractsToLoad() {
  await waitFor(() => {
    expect(screen.getAllByText("AppRegistry").length).toBeGreaterThan(0);
  });
}

describe("ContractsPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(sampleContracts), { status: 200 }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a light contract registry dashboard with compact status cards", async () => {
    const { container } = render(<ContractsPage />);

    await screen.findByRole("heading", { name: "Smart Contracts" });
    await waitForContractsToLoad();

    const summary = screen.getByLabelText("Contract registry summary");
    expect(summary).toHaveClass("contracts-summary-grid");
    expect(summary).toHaveTextContent("Tracked Contracts");
    expect(summary).toHaveTextContent("2");
    expect(summary).toHaveTextContent("Deployed");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("Pending");
    expect(summary).toHaveTextContent("1");

    const tableCard = container.querySelector(".contracts-table-card");
    expect(tableCard?.className).toContain("rounded-xl");
    expect(tableCard?.innerHTML).toContain("Contract Registry");
    expect(container.innerHTML).not.toMatch(
      /dark:|bg-black\/20|bg-white\/5|text-gray-300|shadow-\[/,
    );
  });

  it("provides compact contract cards for mobile operators", async () => {
    const { container } = render(<ContractsPage />);

    await waitForContractsToLoad();

    const mobileList = screen.getByLabelText("Mobile tracked smart contracts");
    expect(mobileList).toHaveClass("contracts-mobile-list");
    expect(mobileList).toHaveClass("md:hidden");
    expect(mobileList).toHaveTextContent("AppRegistry");
    expect(mobileList).toHaveTextContent("PriceFeed");
    expect(mobileList).toHaveTextContent("Tracked");
    expect(mobileList).toHaveTextContent("Pending");

    const appRegistryCard = within(mobileList).getByLabelText(
      "Contract AppRegistry",
    );
    expect(appRegistryCard).toHaveTextContent(
      "0x1111111111111111111111111111111111111111",
    );
    expect(
      within(appRegistryCard).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
    expect(
      within(appRegistryCard).getByRole("button", { name: "Remove" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".contracts-desktop-table")).toHaveClass(
      "hidden",
      "md:block",
    );
  });

  it("attaches the saved admin key when loading protected contract metadata", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");

    render(<ContractsPage />);

    await waitForContractsToLoad();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/contracts",
      expect.objectContaining({
        headers: { "X-Admin-Key": "ui-admin-key" },
      }),
    );
  });

  it("keeps the editor open and sends admin auth when saving a contract", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        return new Response(JSON.stringify(sampleContracts), { status: 200 });
      });
    const user = userEvent.setup();

    render(<ContractsPage />);

    await waitForContractsToLoad();
    await user.click(
      screen.getByRole("button", { name: "Track New Contract" }),
    );

    const editor = screen.getByLabelText("Contract tracker editor");
    expect(editor).toHaveClass("contracts-editor-card");
    await user.type(screen.getByLabelText("Contract Name"), "OracleRouter");
    await user.type(
      screen.getByLabelText("Contract Hash"),
      "0x2222222222222222222222222222222222222222",
    );
    await user.click(screen.getByRole("button", { name: "Save Contract" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/contracts",
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

  it("shows a friendly load error instead of rendering invalid contract data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    render(<ContractsPage />);

    expect(
      await screen.findByText("Failed to load contracts: Unauthorized"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Contract Registry")).not.toBeInTheDocument();
  });

  it("keeps the source free of deprecated dark/glow contract-management tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo/,
    );
  });
});
