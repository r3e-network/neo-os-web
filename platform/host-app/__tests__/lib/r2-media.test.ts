import {
  createMiniAppMediaUploadUrl,
  isMiniAppMediaUploadConfigured,
} from "@/lib/r2-media";

describe("r2-media", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.MINIAPP_R2_ACCOUNT_ID = "test-account";
    process.env.MINIAPP_R2_ACCESS_KEY_ID = "test-access-key";
    process.env.MINIAPP_R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.MINIAPP_R2_BUCKET = "miniapps";
    process.env.MINIAPP_MEDIA_PUBLIC_BASE_URL = "https://meshmini.app";
    process.env.MINIAPP_R2_SIGNED_URL_EXPIRES_SECONDS = "900";
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("reports configured when required R2 env vars are present", () => {
    expect(isMiniAppMediaUploadConfigured()).toBe(true);
  });

  it("creates a SigV4 presigned upload URL with stable media metadata", async () => {
    const result = await createMiniAppMediaUploadUrl({
      app_id: "miniapp-demo",
      asset_type: "logo",
      content_type: "image/png",
      file_name: "logo.png",
      variant: { theme: "dark", density: "2x" },
    });

    expect(result.key).toBe("miniapp-assets/miniapp-demo/logo.dark.2x.png");
    expect(result.public_url).toBe("https://meshmini.app/miniapp-assets/miniapp-demo/logo.dark.2x.png");
    expect(result.expires_in).toBe(900);
    expect(result.headers).toEqual({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    });

    const url = new URL(result.upload_url);
    expect(url.origin).toBe("https://test-account.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/miniapps/miniapp-assets/miniapp-demo/logo.dark.2x.png");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("test-access-key/");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("cache-control;content-type;host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
