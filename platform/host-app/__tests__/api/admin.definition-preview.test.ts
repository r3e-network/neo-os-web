import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/definition-preview";

jest.mock("@/lib/csrf", () => ({
  withCsrfProtection: (wrapped: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void) => wrapped,
}));

jest.mock("@/lib/admin-auth", () => ({
  requireMiniAppAdmin: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  strictLimit: jest.fn(() => false),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

describe("/api/miniapps/admin/definition-preview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 405 for non-POST", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("rejects empty content", async () => {
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST", body: { content: "" } });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
  });

  it("accepts valid yaml content and returns preview", async () => {
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    const yaml = [
      "app_id: miniapp-preview-yaml",
      "name: Preview YAML",
      "template_type: utility",
      "category: utility",
      "entry_url: https://example.com/preview",
      "frontend_spec:",
      "  layout: default",
      "  tabs:",
      "    - id: overview",
      "      label: Overview",
      "      type: content",
      "",
    ].join("\n");

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { content: yaml },
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.preview).toEqual(
      expect.objectContaining({
        app_id: "miniapp-preview-yaml",
        name: "Preview YAML",
      }),
    );
  });
});
