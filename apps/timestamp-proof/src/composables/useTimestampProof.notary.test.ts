import { describe, expect, it } from "vitest";
import { addressToScriptHash } from "@shared/utils/neo";
import { isValidPlatformNotarization } from "./useTimestampProof";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ACCOUNT = addressToScriptHash(ADDRESS);

describe("Timestamp Proof PlatformSocial Notary binding", () => {
  it("matches the returned submitter hash to the reserved wallet address", () => {
    expect(isValidPlatformNotarization(ADDRESS, ACCOUNT, 1_700_000_000_000n)).toBe(true);
    expect(isValidPlatformNotarization(ADDRESS, `0x${"11".repeat(20)}`, 1_700_000_000_000n)).toBe(false);
  });

  it("rejects missing and unsafe chain timestamps", () => {
    expect(isValidPlatformNotarization(ADDRESS, ACCOUNT, 0n)).toBe(false);
    expect(isValidPlatformNotarization(ADDRESS, ACCOUNT, BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBe(false);
  });
});
