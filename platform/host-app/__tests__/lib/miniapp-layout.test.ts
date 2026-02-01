import { parseLayoutParam, resolveMiniAppLayout } from "../../lib/miniapp-layout";

describe("miniapp layout", () => {
  it("parses explicit layout overrides", () => {
    expect(parseLayoutParam("web")).toBe("web");
    expect(parseLayoutParam("mobile")).toBe("mobile");
    expect(parseLayoutParam(["mobile"])).toBe("mobile");
    expect(parseLayoutParam("invalid")).toBeNull();
  });

  it("prefers override over environment detection", () => {
    expect(
      resolveMiniAppLayout({
        override: "web",
        isMobileDevice: true,
        hasWalletProvider: true,
      }),
    ).toBe("web");
  });

  it("returns mobile only for mobile device + wallet", () => {
    expect(resolveMiniAppLayout({ isMobileDevice: true, hasWalletProvider: true })).toBe("mobile");
    expect(resolveMiniAppLayout({ isMobileDevice: true, hasWalletProvider: false })).toBe("web");
    expect(resolveMiniAppLayout({ isMobileDevice: false, hasWalletProvider: true })).toBe("web");
  });
});
