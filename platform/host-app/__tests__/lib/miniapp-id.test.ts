import { canonicalizeMiniAppId } from "@/lib/miniapp-id";

describe("miniapp-id canonicalization", () => {
  it("maps known alias ids to canonical ids", () => {
    expect(canonicalizeMiniAppId("miniapp-dice-game")).toBe("miniapp-dicegame");
    expect(canonicalizeMiniAppId("dice-game")).toBe("miniapp-dicegame");
  });

  it("can coerce plain ids to miniapp prefix", () => {
    expect(canonicalizeMiniAppId("my-app", { coerceMiniappPrefix: true })).toBe("miniapp-my-app");
  });

  it("uses fallback slug when input is empty", () => {
    expect(canonicalizeMiniAppId("", { fallbackSlug: "coin-flip", coerceMiniappPrefix: true })).toBe("miniapp-coin-flip");
  });
});
