import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/admin/media/upload-url";

jest.mock("@/lib/csrf", () => ({
  withCsrfProtection: (wrapped: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void) => wrapped,
}));

jest.mock("@/lib/admin-auth", () => ({
  requireMiniAppAdmin: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  strictLimit: jest.fn(() => false),
}));

jest.mock("@/lib/r2-media", () => ({
  isMiniAppMediaUploadConfigured: jest.fn(() => true),
  createMiniAppMediaUploadUrl: jest.fn(),
}));

const { requireMiniAppAdmin } = jest.requireMock("@/lib/admin-auth") as {
  requireMiniAppAdmin: jest.Mock;
};

const { isMiniAppMediaUploadConfigured, createMiniAppMediaUploadUrl } = jest.requireMock("@/lib/r2-media") as {
  isMiniAppMediaUploadConfigured: jest.Mock;
  createMiniAppMediaUploadUrl: jest.Mock;
};

describe("/api/miniapps/admin/media/upload-url", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireMiniAppAdmin.mockResolvedValue({ kind: "api_key", value: "api_key" });
    isMiniAppMediaUploadConfigured.mockReturnValue(true);
    createMiniAppMediaUploadUrl.mockResolvedValue({
      upload_url: "https://signed.example.com",
      public_url: "https://meshmini.app/miniapp-assets/miniapp-demo/logo.png",
      key: "miniapp-assets/miniapp-demo/logo.png",
      expires_in: 900,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });

  it("returns 405 for non-POST requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns config error when R2 is not configured", async () => {
    isMiniAppMediaUploadConfigured.mockReturnValue(false);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {},
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        code: "CONFIG_ERROR",
        message: expect.stringContaining("Cloudflare R2"),
      },
    });
  });

  it("validates request body", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        app_id: "INVALID!!!",
        asset_type: "logo",
        content_type: "image/png",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid app_id format",
      },
    });
  });

  it("returns signed upload url for valid requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        app_id: "miniapp-demo",
        asset_type: "logo",
        content_type: "image/png",
        file_name: "logo.png",
        variant: { theme: "dark" },
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(createMiniAppMediaUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        app_id: "miniapp-demo",
        asset_type: "logo",
        content_type: "image/png",
      }),
    );
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        success: true,
        upload_url: "https://signed.example.com",
        public_url: expect.stringContaining("meshmini.app"),
      }),
    );
  });
});
