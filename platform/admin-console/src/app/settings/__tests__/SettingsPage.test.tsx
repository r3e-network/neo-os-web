import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import SettingsPage from "../page";
import { ADMIN_API_KEY_STORAGE_KEY } from "@/lib/admin-client";

const pagePath = path.resolve(__dirname, "../page.tsx");

const sampleConfig = {
  maintenanceMode: false,
  approvalGateRequired: true,
  maxMiniappSizeMb: 50,
  pricefeedIntervalMs: 60000,
  logLevel: "info",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("renders a light platform settings dashboard with compact operational summary", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(sampleConfig));

    const { container } = render(<SettingsPage />);

    expect(
      await screen.findByRole("heading", { name: "Platform Settings" }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("Platform settings summary");
    expect(summary).toHaveClass("settings-summary-grid");
    expect(summary).toHaveTextContent("Runtime Mode");
    expect(summary).toHaveTextContent("Operational");
    expect(summary).toHaveTextContent("Approval Review");
    expect(summary).toHaveTextContent("Required");
    expect(summary).toHaveTextContent("PriceFeed Refresh");
    expect(summary).toHaveTextContent("60s");
    expect(summary).toHaveTextContent("Bundle Limit");
    expect(summary).toHaveTextContent("50 MB");

    const controls = screen.getByLabelText("Platform settings controls");
    expect(controls).toHaveClass("settings-controls-grid");
    expect(controls).toHaveTextContent("System Controls");
    expect(controls).toHaveTextContent("Runtime Parameters");
    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|shadow-\[/,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        credentials: "include",
        headers: { "X-Admin-Key": "ui-admin-key" },
      }),
    );
  });

  it("saves edited configuration with admin auth and inline success feedback", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(sampleConfig))
      .mockResolvedValueOnce(
        jsonResponse({ ...sampleConfig, maintenanceMode: true }),
      );
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<SettingsPage />);

    await screen.findByLabelText("Maintenance Mode");
    await user.click(screen.getByLabelText("Maintenance Mode"));
    await user.clear(screen.getByLabelText("Max MiniApp Bundle Size (MB)"));
    await user.type(screen.getByLabelText("Max MiniApp Bundle Size (MB)"), "75");
    await user.click(
      screen.getByRole("button", { name: "Save Configuration" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Admin-Key": "ui-admin-key",
          }),
          body: expect.stringContaining('"maintenanceMode":true'),
        }),
      );
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/settings",
      expect.objectContaining({
        body: expect.stringContaining('"maxMiniappSizeMb":75'),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Settings saved",
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("uses polished switch controls and full-height parameter fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(sampleConfig));

    const { container } = render(<SettingsPage />);

    await screen.findByLabelText("Maintenance Mode");

    expect(container.querySelectorAll(".settings-switch-track")).toHaveLength(2);
    expect(container.querySelector(".settings-switch-track")).toHaveClass(
      "pointer-events-none",
    );
    expect(screen.getByLabelText("Maintenance Mode")).toHaveClass(
      "settings-switch-input",
    );
    expect(screen.getByLabelText("Maintenance Mode")).toHaveClass("opacity-0");
    expect(screen.getByLabelText("Maintenance Mode")).toHaveClass("h-full");
    expect(screen.getByLabelText("MiniApp Approval Gate")).toHaveClass(
      "settings-switch-input",
    );
    expect(screen.getByLabelText("Max MiniApp Bundle Size (MB)")).toHaveClass(
      "h-11",
    );
    expect(screen.getByLabelText("PriceFeed Refresh Interval (ms)")).toHaveClass(
      "h-11",
    );
  });

  it("shows a friendly load error without rendering stale controls", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Unauthorized" }, 401),
    );

    render(<SettingsPage />);

    expect(
      await screen.findByRole("alert", {
        name: "Platform settings could not be loaded",
      }),
    ).toHaveTextContent("Platform settings could not be loaded");
    expect(screen.queryByText("System Controls")).not.toBeInTheDocument();
  });

  it("keeps source free of deprecated dark/glow settings tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo|drop-shadow-\[/,
    );
  });
});
