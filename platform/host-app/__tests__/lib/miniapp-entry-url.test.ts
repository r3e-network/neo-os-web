import {
  isManifestMiniAppEntryUrl,
  normalizeMiniAppDappUrl,
  normalizeMiniAppEntryUrl,
  resolveMiniAppEntryUrlOrManifest,
} from "@/lib/miniapp-entry-url";

describe("miniapp-entry-url", () => {
  it("keeps manifest entry urls unchanged", () => {
    expect(normalizeMiniAppEntryUrl("mf://manifest?app=miniapp-demo")).toBe("mf://manifest?app=miniapp-demo");
    expect(isManifestMiniAppEntryUrl("mf://manifest?app=miniapp-demo")).toBe(true);
  });

  it("normalizes bare .matrix and .neo hostnames to https", () => {
    expect(normalizeMiniAppEntryUrl("wallet.matrix/apps/swap")).toBe("https://wallet.matrix/apps/swap");
    expect(normalizeMiniAppEntryUrl("smartwallet.neo/console")).toBe("https://smartwallet.neo/console");
  });

  it("normalizes localhost to http", () => {
    expect(normalizeMiniAppEntryUrl("localhost:3000/app")).toBe("http://localhost:3000/app");
  });

  it("falls back to manifest entry when url is invalid", () => {
    expect(resolveMiniAppEntryUrlOrManifest("not a url", "miniapp-demo")).toBe("mf://manifest?app=miniapp-demo");
  });

  it("normalizes standalone dapp urls while rejecting manifest runtime entries", () => {
    expect(normalizeMiniAppDappUrl("/miniapps/demo/index.html")).toBe("/miniapps/demo/index.html");
    expect(normalizeMiniAppDappUrl("wallet.matrix/apps/demo")).toBe("https://wallet.matrix/apps/demo");
    expect(normalizeMiniAppDappUrl("mf://manifest?app=miniapp-demo")).toBeNull();
  });
});
