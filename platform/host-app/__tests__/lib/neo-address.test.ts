import { isValidNeoAddress } from "@/lib/neo-address";

describe("isValidNeoAddress", () => {
  it("accepts a valid Neo N3 address", () => {
    // Standard Neo N3 testnet/mainnet address
    expect(isValidNeoAddress("NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs")).toBe(true);
  });

  it("rejects N-prefix strings with invalid checksum", () => {
    expect(isValidNeoAddress("NZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidNeoAddress("")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValidNeoAddress("N123")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidNeoAddress(null as unknown as string)).toBe(false);
    expect(isValidNeoAddress(undefined as unknown as string)).toBe(false);
    expect(isValidNeoAddress(42 as unknown as string)).toBe(false);
  });

  it("rejects addresses that don't start with N", () => {
    expect(isValidNeoAddress("AZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(false);
  });

  it("rejects addresses with invalid base58 characters", () => {
    // 0, O, I, l are not in Base58
    expect(isValidNeoAddress("N0ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(false);
  });
});
