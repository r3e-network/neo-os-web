/**
 * @jest-environment node
 */
import { createMiniAppSDK } from "@/lib/sdk/client.js";

describe("MiniApp SDK client chain config", () => {
  it("rejects EVM chain types", () => {
    expect(() => createMiniAppSDK({ chainType: "unsupported" as string })).toThrow();
  });

  it("rejects non-neo chain IDs", () => {
    expect(() => createMiniAppSDK({ chainId: "unsupported-chain" as string })).toThrow();
  });
});
