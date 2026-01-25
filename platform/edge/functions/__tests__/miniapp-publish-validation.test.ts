import { describe, it, expect } from "vitest";
import { validatePublishPayload } from "../_shared/miniapps/publish-validation";

const base = "https://cdn.example.com";

describe("publish validation", () => {
  it("accepts https entry_url", () => {
    const result = validatePublishPayload({
      entryUrl: "https://cdn.example.com/app/index.html",
      cdnBaseUrl: base,
      assets: { icon: "https://cdn.example.com/app/icon.png" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects non-https urls", () => {
    const result = validatePublishPayload({
      entryUrl: "http://cdn.example.com/app/index.html",
      cdnBaseUrl: base,
      assets: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects urls outside cdn base", () => {
    const result = validatePublishPayload({
      entryUrl: "https://evil.com/app/index.html",
      cdnBaseUrl: base,
      assets: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects entry_url that only shares a prefix with base path", () => {
    const result = validatePublishPayload({
      entryUrl: "https://cdn.example.com/miniapps-v2/app/index.html",
      cdnBaseUrl: "https://cdn.example.com/miniapps",
      assets: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects cdn_base_url outside CDN_BASE_URL when provided", () => {
    const result = validatePublishPayload({
      entryUrl: "https://evil.com/miniapps/app/index.html",
      cdnBaseUrl: "https://evil.com/miniapps/app",
      cdnRootUrl: "https://cdn.example.com",
      assets: {},
    });
    expect(result.valid).toBe(false);
  });

  it("allows asset urls under the same CDN origin", () => {
    const result = validatePublishPayload({
      entryUrl: "https://cdn.example.com/miniapps/app-id/v1/index.html",
      cdnBaseUrl: "https://cdn.example.com/miniapps/app-id/v1",
      assets: { icon: "https://cdn.example.com/miniapps/app-id/assets/icon.png" },
    });
    expect(result.valid).toBe(true);
  });

  it("reports asset origin mismatch clearly", () => {
    const result = validatePublishPayload({
      entryUrl: "https://cdn.example.com/miniapps/app-id/v1/index.html",
      cdnBaseUrl: "https://cdn.example.com/miniapps/app-id/v1",
      assets: { icon: "https://other.example.com/miniapps/app-id/assets/icon.png" },
    });
    expect(result.errors).toContain("assets_selected must be on CDN_BASE_URL origin");
  });
});
