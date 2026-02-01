import { scriptHashToAddress } from "../../../../packages/@neo/shared-core/src/utils/index";

describe("scriptHashToAddress", () => {
  it("converts GAS script hash to Neo N3 address", () => {
    expect(scriptHashToAddress("0xd2a4cff31913016155e38e474a2c06d08be276cf")).toBe(
      "NepwUjd9GhqgNkrfXaxj9mmsFhFzGoFuWM",
    );
  });

  it("converts NEO script hash to Neo N3 address", () => {
    expect(scriptHashToAddress("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5")).toBe(
      "NiHURyS83nX2mpxtA7xq84cGxVbHojj5Wc",
    );
  });

  it("returns input for invalid hex", () => {
    const badHash = `0x${"g".repeat(40)}`;
    expect(scriptHashToAddress(badHash)).toBe(badHash);
  });
});
