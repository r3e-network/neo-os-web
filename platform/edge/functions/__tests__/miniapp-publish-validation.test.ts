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
});
