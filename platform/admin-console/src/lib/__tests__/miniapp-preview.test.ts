// =============================================================================
// Tests for MiniApp preview URL helpers
// =============================================================================

import { afterEach, describe, expect, it } from "vitest";
import { buildPreviewUrl } from "@/lib/miniapp-preview";

const originalHost = process.env.NEXT_PUBLIC_HOST_APP_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_HOST_APP_URL = originalHost;
});

describe("buildPreviewUrl", () => {
  it("adds layout=web to absolute urls", () => {
    const url = buildPreviewUrl("https://example.com/app", "en", "dark");
    expect(url).toBe("https://example.com/app?lang=en&theme=dark&embedded=1&layout=web");
  });

  it("appends params after existing queries", () => {
    const url = buildPreviewUrl("https://example.com/app?ref=1", "en", "dark");
    expect(url).toBe("https://example.com/app?ref=1&lang=en&theme=dark&embedded=1&layout=web");
  });

  it("resolves relative urls using the host app base", () => {
    process.env.NEXT_PUBLIC_HOST_APP_URL = "https://host.example";
    const url = buildPreviewUrl("/miniapps/test", "en", "dark");
    expect(url).toBe("https://host.example/miniapps/test?lang=en&theme=dark&embedded=1&layout=web");
  });

  it("falls back to window origin for relative urls when no host base", () => {
    process.env.NEXT_PUBLIC_HOST_APP_URL = "";
    const url = buildPreviewUrl("/miniapps/test", "en", "dark");
    expect(url).toBe(`${window.location.origin}/miniapps/test?lang=en&theme=dark&embedded=1&layout=web`);
  });

  it("returns empty for unsupported or empty urls", () => {
    expect(buildPreviewUrl("mf://remote/app", "en", "dark")).toBe("");
    expect(buildPreviewUrl("", "en", "dark")).toBe("");
  });
});
