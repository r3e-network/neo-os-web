import { describe, expect, it } from "vitest";

import {
  isAccountLocator,
  isHash160,
  isNeoAddress,
  isOptionalHash160,
  isRecoveryExpiryMinutes,
  parseRecoveryExpiryMinutes,
  MAX_RECOVERY_EXPIRY_MINUTES,
  MIN_RECOVERY_EXPIRY_MINUTES,
} from "../../recovery-guardian/src/utils/validation";

const NEO_ADDRESS = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";
const HASH160 = "0x1111111111111111111111111111111111111111";

describe("Recovery Guardian validation logic", () => {
  it("accepts a 0x-prefixed and bare Hash160 as an account locator", () => {
    expect(isHash160(HASH160)).toBe(true);
    expect(isHash160(HASH160.slice(2))).toBe(true);
    expect(isAccountLocator(HASH160)).toBe(true);
  });

  it("accepts a Neo address as an account locator", () => {
    expect(isNeoAddress(NEO_ADDRESS)).toBe(true);
    expect(isAccountLocator(NEO_ADDRESS)).toBe(true);
  });

  it("rejects malformed account locators", () => {
    expect(isAccountLocator("")).toBe(false);
    expect(isAccountLocator("0x1234")).toBe(false);
    expect(isAccountLocator("not-an-address")).toBe(false);
    expect(isAccountLocator(`${HASH160}ff`)).toBe(false);
  });

  it("treats the verifier override as optional but Hash160-shaped when present", () => {
    expect(isOptionalHash160("")).toBe(true);
    expect(isOptionalHash160("   ")).toBe(true);
    expect(isOptionalHash160(HASH160)).toBe(true);
    expect(isOptionalHash160("0xbad")).toBe(false);
  });

  it("parses recovery expiry minutes only within the inclusive 5..1440 window", () => {
    expect(parseRecoveryExpiryMinutes("30")).toBe(30);
    expect(parseRecoveryExpiryMinutes(String(MIN_RECOVERY_EXPIRY_MINUTES))).toBe(
      MIN_RECOVERY_EXPIRY_MINUTES,
    );
    expect(parseRecoveryExpiryMinutes(String(MAX_RECOVERY_EXPIRY_MINUTES))).toBe(
      MAX_RECOVERY_EXPIRY_MINUTES,
    );

    expect(parseRecoveryExpiryMinutes("4")).toBeNull();
    expect(parseRecoveryExpiryMinutes("1441")).toBeNull();
    expect(parseRecoveryExpiryMinutes("0")).toBeNull();
    expect(parseRecoveryExpiryMinutes("")).toBeNull();
    expect(parseRecoveryExpiryMinutes("30.5")).toBeNull();
    expect(parseRecoveryExpiryMinutes("-30")).toBeNull();
    expect(parseRecoveryExpiryMinutes("abc")).toBeNull();
  });

  it("mirrors parse results through the boolean expiry guard", () => {
    expect(isRecoveryExpiryMinutes("30")).toBe(true);
    expect(isRecoveryExpiryMinutes("4")).toBe(false);
    expect(isRecoveryExpiryMinutes("1441")).toBe(false);
  });
});
