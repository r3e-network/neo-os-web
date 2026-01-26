import { beforeEach, describe, expect, it } from "vitest";
import { resolveLayout } from "../src/bridge";

describe("resolveLayout", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    delete (window as any).ReactNativeWebView;
  });

  it("prefers config.layout", () => {
    expect(resolveLayout({ layout: "mobile" })).toBe("mobile");
  });

  it("falls back to query param", () => {
    window.history.replaceState({}, "", "/?layout=web");
    expect(resolveLayout({})).toBe("web");
  });

  it("defaults to mobile when running inside a webview", () => {
    (window as any).ReactNativeWebView = {};
    expect(resolveLayout({})).toBe("mobile");
  });

  it("defaults to web in the browser", () => {
    expect(resolveLayout({})).toBe("web");
  });
});
