import { getMiniAppContractHash } from "@/lib/rpc-helpers";

describe("flashloan rpc helpers", () => {
  it("keeps flashloan contract hashes aligned by network", () => {
    expect(getMiniAppContractHash("miniapp-flashloan", "mainnet")).toBe(
      "0xb5d8fb0dc2319edc4be3104304b4136b925df6e4",
    );
    expect(getMiniAppContractHash("miniapp-flashloan", "testnet")).toBe(
      "0xde8e595d8d3c293731db499367ee2a768e1e458b",
    );
  });
});
