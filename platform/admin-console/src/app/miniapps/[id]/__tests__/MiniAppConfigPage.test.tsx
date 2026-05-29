import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import MiniAppConfigPage from "../page";
import { ADMIN_API_KEY_STORAGE_KEY } from "@/lib/admin-client";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: "miniapp-aa-session-key-lab" }),
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

const sampleConfig = {
  permissions: {
    can_access_oracle: false,
    can_access_compute: true,
    max_gas_per_tx: 10,
  },
  tokens: {
    allowed_assets: ["GAS", "NEO"],
    withdrawal_limit_24h: 100,
  },
  actions: {
    suspend_app: false,
    maintenance_mode: false,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderPage() {
  return render(
    <Suspense fallback={<div>Loading route...</div>}>
      <MiniAppConfigPage />
    </Suspense>,
  );
}

describe("MiniAppConfigPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    window.sessionStorage.clear();
  });

  it("renders a light MiniApp configuration console with operational summary", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(sampleConfig));

    const { container } = renderPage();

    expect(
      await screen.findByRole("heading", { name: "MiniApp Configuration" }),
    ).toBeInTheDocument();

    const overview = screen.getByLabelText("MiniApp configuration overview");
    expect(overview).toHaveClass("miniapp-config-overview");
    expect(overview).toHaveTextContent("MiniApp ID");
    expect(overview).toHaveTextContent("miniapp-aa-session-key-lab");
    expect(overview).toHaveTextContent("TEE Gates");
    expect(overview).toHaveTextContent("3");
    expect(overview).toHaveTextContent("Allowed Assets");
    expect(overview).toHaveTextContent("2");

    const controls = screen.getByLabelText("MiniApp configuration controls");
    expect(controls).toHaveClass("miniapp-config-controls");
    expect(controls).toHaveTextContent("TEE Permissions");
    expect(controls).toHaveTextContent("Tokens & Assets");
    expect(controls).toHaveTextContent("Lifecycle Actions");

    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|drop-shadow|shadow-\[/,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/miniapps/miniapp-aa-session-key-lab/config",
      expect.objectContaining({
        credentials: "include",
        headers: { "X-Admin-Key": "ui-admin-key" },
      }),
    );
  });

  it("saves edited config with admin auth and inline success feedback", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(sampleConfig))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          config: {
            ...sampleConfig,
            permissions: {
              ...sampleConfig.permissions,
              can_access_oracle: true,
              max_gas_per_tx: 18,
            },
          },
        }),
      );
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();

    renderPage();

    await screen.findByLabelText("can access oracle");
    await user.click(screen.getByLabelText("can access oracle"));
    await user.clear(screen.getByLabelText("max gas per tx value"));
    await user.type(screen.getByLabelText("max gas per tx value"), "18");
    await user.clear(screen.getByLabelText("Allowed Assets (Comma separated)"));
    await user.type(
      screen.getByLabelText("Allowed Assets (Comma separated)"),
      "GAS, NEO, bNEO",
    );
    await user.click(
      screen.getByRole("button", { name: "Save Configuration" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/miniapps/miniapp-aa-session-key-lab/config",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Admin-Key": "ui-admin-key",
          }),
          body: expect.stringContaining('"can_access_oracle":true'),
        }),
      );
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/miniapps/miniapp-aa-session-key-lab/config",
      expect.objectContaining({
        body: expect.stringContaining('"max_gas_per_tx":18'),
      }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/miniapps/miniapp-aa-session-key-lab/config",
      expect.objectContaining({
        body: expect.stringContaining('"allowed_assets":["GAS","NEO","bNEO"]'),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Configuration saved",
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("shows a friendly load error without rendering stale controls", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Unauthorized" }, 401),
    );

    renderPage();

    expect(
      await screen.findByRole("alert", {
        name: "MiniApp configuration could not be loaded",
      }),
    ).toHaveTextContent("MiniApp configuration could not be loaded");
    expect(screen.queryByText("TEE Permissions")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(pushMock).toHaveBeenCalledWith("/miniapps");
  });

  it("keeps source free of deprecated dark/glow config tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|drop-shadow|shadow-\[/,
    );
  });
});
