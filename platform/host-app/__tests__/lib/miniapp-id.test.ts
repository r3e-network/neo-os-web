import { canonicalizeMiniAppId } from "@/lib/miniapp-id";
import { isArchivedMiniAppId } from "@/lib/archived-miniapps";

describe("miniapp-id canonicalization", () => {
  it("maps known alias ids to canonical ids", () => {
    expect(canonicalizeMiniAppId("miniapp-red-envelope")).toBe("miniapp-redenvelope");
    expect(canonicalizeMiniAppId("red-envelope")).toBe("miniapp-redenvelope");
  });

  it("maps legacy marketing aliases to the current flagship app ids", () => {
    expect(canonicalizeMiniAppId("miniapp-doomsday-clock")).toBe("miniapp-last-survivor");
    expect(canonicalizeMiniAppId("doomsday-clock")).toBe("miniapp-last-survivor");
    expect(canonicalizeMiniAppId("miniapp-neo-gacha")).toBe("miniapp-gasbox");
    expect(canonicalizeMiniAppId("miniapp-coinflip")).toBe("miniapp-fogplay");
    expect(canonicalizeMiniAppId("miniapp-dicegame")).toBe("miniapp-dice-game");
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

  it("recognizes stale remote-only miniapp ids as archived", () => {
    expect(isArchivedMiniAppId("miniapp-secretvote")).toBe(true);
    expect(isArchivedMiniAppId("secret-vote")).toBe(true);
  });
});
