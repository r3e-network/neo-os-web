import { canonicalizeMiniAppId } from "@/lib/miniapp-id";

describe("miniapp-id canonicalization", () => {
  it("maps known alias ids to canonical ids", () => {
    expect(canonicalizeMiniAppId("miniapp-dice-game")).toBe("miniapp-dicegame");
    expect(canonicalizeMiniAppId("dice-game")).toBe("miniapp-dicegame");
  });

  it("maps legacy marketing aliases to the current flagship app ids", () => {
    expect(canonicalizeMiniAppId("miniapp-doomsday-clock")).toBe("miniapp-last-survivor");
    expect(canonicalizeMiniAppId("doomsday-clock")).toBe("miniapp-last-survivor");
    expect(canonicalizeMiniAppId("miniapp-neo-gacha")).toBe("miniapp-gasbox");
    expect(canonicalizeMiniAppId("miniapp-coinflip")).toBe("miniapp-fogplay");
    expect(canonicalizeMiniAppId("miniapp-stream-vault")).toBe("miniapp-neo-pay");
    expect(canonicalizeMiniAppId("miniapp-on-chain-tarot")).toBe("miniapp-onchaintarot");
    expect(canonicalizeMiniAppId("breakup-contract")).toBe("miniapp-breakupcontract");
    expect(canonicalizeMiniAppId("unbreakable-vault")).toBe("miniapp-unbreakablevault");
  });

  it("can coerce plain ids to miniapp prefix", () => {
    expect(canonicalizeMiniAppId("my-app", { coerceMiniappPrefix: true })).toBe("miniapp-my-app");
  });

  it("uses fallback slug when input is empty", () => {
    expect(canonicalizeMiniAppId("", { fallbackSlug: "fogplay", coerceMiniappPrefix: true })).toBe("miniapp-fogplay");
  });
});
