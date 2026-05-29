import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import ServiceConfigPage from "../page";
import { ADMIN_API_KEY_STORAGE_KEY } from "@/lib/admin-client";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: "morpheus-relayer-feed" }),
}));

const pagePath = path.resolve(__dirname, "../page.tsx");

const sampleConfig = {
  routing: {
    enabled: true,
    max_concurrent_requests: 12,
    timeout_ms: 10000,
  },
  security: {
    require_signature: true,
    allowlist_only: true,
  },
  resources: {
    memory_limit_mb: 1024,
    cpu_shares: 2,
  },
  logging: {
    level: "info",
    audit_events: true,
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
      <ServiceConfigPage />
    </Suspense>,
  );
}

describe("ServiceConfigPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    window.sessionStorage.clear();
  });

  it("renders a light service configuration console with operational summary", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "services-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(sampleConfig));

    const { container } = renderPage();

    expect(
      await screen.findByRole("heading", { name: "Service Configuration" }),
    ).toBeInTheDocument();

    const overview = screen.getByLabelText("Service configuration overview");
    expect(overview).toHaveClass("service-config-overview");
    expect(overview).toHaveTextContent("Service ID");
    expect(overview).toHaveTextContent("morpheus-relayer-feed");
    expect(overview).toHaveTextContent("Routing");
    expect(overview).toHaveTextContent("Enabled");
    expect(overview).toHaveTextContent("Timeout");
    expect(overview).toHaveTextContent("10,000 ms");
    expect(overview).toHaveTextContent("Security Gates");
    expect(overview).toHaveTextContent("2");

    const controls = screen.getByLabelText("Service configuration controls");
    expect(controls).toHaveClass("service-config-controls");
    expect(controls).toHaveTextContent("Routing & Networking");
    expect(controls).toHaveTextContent("Security & Compliance");

    expect(container.innerHTML).not.toMatch(
      /glass-card|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|shadow-\[|drop-shadow/,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/services/morpheus-relayer-feed/config",
      expect.objectContaining({
        credentials: "include",
        headers: { "X-Admin-Key": "services-key" },
      }),
    );
  });

  it("saves edited config with admin auth and inline success feedback", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "services-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(sampleConfig))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          config: {
            ...sampleConfig,
            routing: {
              enabled: true,
              max_concurrent_requests: 25,
              timeout_ms: 8000,
            },
            security: {
              require_signature: false,
              allowlist_only: true,
            },
          },
        }),
      );
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();

    renderPage();

    await screen.findByLabelText("Max Concurrent Requests");
    await user.clear(screen.getByLabelText("Max Concurrent Requests"));
    await user.type(screen.getByLabelText("Max Concurrent Requests"), "25");
    await user.clear(screen.getByLabelText("Timeout (ms)"));
    await user.type(screen.getByLabelText("Timeout (ms)"), "8000");
    await user.click(
      screen.getByLabelText("Require AWS Nitro Attestation Signature"),
    );
    await user.click(
      screen.getByRole("button", { name: "Save Configuration" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/services/morpheus-relayer-feed/config",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Admin-Key": "services-key",
          }),
          body: expect.stringContaining('"max_concurrent_requests":25'),
        }),
      );
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/services/morpheus-relayer-feed/config",
      expect.objectContaining({
        body: expect.stringContaining('"timeout_ms":8000'),
      }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/services/morpheus-relayer-feed/config",
      expect.objectContaining({
        body: expect.stringContaining('"require_signature":false'),
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
        name: "Service configuration could not be loaded",
      }),
    ).toHaveTextContent("Service configuration could not be loaded");
    expect(screen.queryByText("Routing & Networking")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(pushMock).toHaveBeenCalledWith("/services");
  });

  it("keeps source free of deprecated dark/glow service config tokens", () => {
    const source = fs.readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(
      /variant="glass"|dark:|bg-black\/20|bg-white\/5|border-white\/10|text-white|text-gray-300|text-gray-400|shadow-\[|border-neo|drop-shadow-\[/,
    );
  });
});
