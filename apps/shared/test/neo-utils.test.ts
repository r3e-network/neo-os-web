import { describe, expect, it } from "vitest";
import {
  addressToScriptHash,
  ownerMatchesAddress,
  parseStackItem,
} from "../utils/neo";

// Reference vectors produced with the canonical Base58Check decode
// (double-SHA256 checksum verified): address -> little-endian script hash.
const VALID_ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const VALID_HASH = "0xa5de523ae9d99be784a536e9412b7a3cbe049e1a";
const DEPLOYER_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const DEPLOYER_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";

describe("addressToScriptHash — Base58Check validation", () => {
  it("converts checksum-valid Neo N3 addresses to little-endian script hashes", () => {
    expect(addressToScriptHash(VALID_ADDRESS)).toBe(VALID_HASH);
    expect(addressToScriptHash(DEPLOYER_ADDRESS)).toBe(DEPLOYER_HASH);
  });

  it("rejects a single-character mid-address typo", () => {
    // index 10: 't' -> 'u'
    expect(addressToScriptHash("NNLi44dJNXuDNSBkofB48aTVYtb1zZrNEs")).toBe("");
  });

  it("rejects a transposition of two adjacent characters", () => {
    // indexes 12/13: 'NS' -> 'SN'
    expect(addressToScriptHash("NNLi44dJNXtDSNBkofB48aTVYtb1zZrNEs")).toBe("");
  });

  it("rejects a truncated address", () => {
    expect(addressToScriptHash(VALID_ADDRESS.slice(0, -1))).toBe("");
    expect(addressToScriptHash(VALID_ADDRESS.slice(0, 20))).toBe("");
  });

  it("rejects a trailing-character typo (checksum region)", () => {
    // Trailing typos land in the 4-byte checksum and previously slipped
    // through because the checksum was never verified.
    expect(addressToScriptHash("NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEr")).toBe("");
  });

  it("rejects a wrong-version address even with a valid checksum", () => {
    // Same 20-byte hash re-encoded under version 0x17 (Neo Legacy) with a
    // correct double-SHA256 checksum — only version 0x35 is acceptable.
    expect(addressToScriptHash("AJCcWogf57yvqS1A55BVapHtfkridh5HZK")).toBe("");
  });

  it("rejects short or non-base58 input", () => {
    expect(addressToScriptHash("")).toBe("");
    expect(addressToScriptHash("NTestAddress")).toBe("");
    expect(addressToScriptHash("NTestAddress0")).toBe(""); // '0' not in base58
    expect(addressToScriptHash("not-an-address")).toBe("");
  });

  it("keeps the 0x-prefixed script hash passthrough (byte reversal)", () => {
    expect(
      addressToScriptHash("0x1a9e04be3c7a2b41e936a584e79bd9e93a52dea5"),
    ).toBe(VALID_HASH);
  });

  it("ownerMatchesAddress still matches hash-form owners against addresses", () => {
    expect(ownerMatchesAddress(VALID_HASH, VALID_ADDRESS)).toBe(true);
    expect(ownerMatchesAddress(VALID_HASH, DEPLOYER_ADDRESS)).toBe(false);
    expect(ownerMatchesAddress(VALID_ADDRESS, VALID_ADDRESS)).toBe(true);
  });
});

describe("parseStackItem — BigInt-safe Integer parsing", () => {
  const int = (value: unknown) => parseStackItem({ type: "Integer", value });

  it("returns numbers for values within Number.MAX_SAFE_INTEGER", () => {
    expect(int("123")).toBe(123);
    expect(int("-42")).toBe(-42);
    expect(int("0")).toBe(0);
    expect(int(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(int(String(Number.MIN_SAFE_INTEGER))).toBe(Number.MIN_SAFE_INTEGER);
    expect(int(7)).toBe(7);
  });

  it("returns exact decimal strings beyond 2^53 instead of truncating", () => {
    expect(int("9007199254740993")).toBe("9007199254740993"); // 2^53 + 1
    expect(int("-9007199254740993")).toBe("-9007199254740993");
    // fixed8 product / 1e12-scaled accumulator magnitudes
    expect(int("123456789012345678901234567890")).toBe(
      "123456789012345678901234567890",
    );
  });

  it("applies the same rule to hex-encoded integers", () => {
    expect(int("0xff")).toBe(255);
    // 500e18 — previously corrupted by float parseInt before BigInt
    expect(int("0x1b1ae4d6e2ef500000")).toBe("500000000000000000000");
  });

  it("returns 0 for unparseable input", () => {
    expect(int("abc")).toBe(0);
    expect(int(Number.NaN)).toBe(0);
    expect(int(Number.POSITIVE_INFINITY)).toBe(0);
    expect(int({})).toBe(0);
  });

  it("applies the rule inside nested Array/Struct items", () => {
    const parsed = parseStackItem({
      type: "Array",
      value: [
        { type: "Integer", value: "5" },
        { type: "Integer", value: "9007199254740993" },
      ],
    });
    expect(parsed).toEqual([5, "9007199254740993"]);
  });

  it("keeps non-printable 20-byte ByteStrings as 0x hex", () => {
    // 20 bytes of 0x00/0x01 — not printable text, so hex form is returned
    const bytes = new Uint8Array(20);
    bytes[0] = 1;
    const base64 = btoa(String.fromCharCode(...bytes));
    const parsed = parseStackItem({ type: "ByteString", value: base64 });
    expect(parsed).toBe(`0x01${"00".repeat(19)}`);
  });
});

describe("parseStackItem — Boolean wire-format (string vs native)", () => {
  const b = (value: unknown) => parseStackItem({ type: "Boolean", value });
  it("decodes the string wire form the Neo RPC actually returns", () => {
    // Neo RpcServer serializes a Boolean StackItem's value as a JSON STRING.
    // A bare Boolean("false") is truthy, which would corrupt false -> true.
    expect(b("false")).toBe(false);
    expect(b("true")).toBe(true);
    expect(b("0")).toBe(false);
    expect(b("1")).toBe(true);
    expect(b("FALSE")).toBe(false);
  });
  it("still decodes native boolean / numeric wire forms", () => {
    expect(b(false)).toBe(false);
    expect(b(true)).toBe(true);
    expect(b(0)).toBe(false);
    expect(b(1)).toBe(true);
  });
});

describe("addressToScriptHash — 0x hex normalization", () => {
  it("accepts an uppercase 0X prefix and lowercases the hex", () => {
    const lower = "0x1A9E04BE3C7A2B41E936A584E79BD9E93A52DEA5";
    const upperPrefix = lower.replace(/^0x/, "0X");
    // 0X must behave identically to 0x, and the output is lowercased so a direct
    // compare against a normalized (lowercase) hash does not falsely mismatch.
    const out = addressToScriptHash(lower);
    expect(out).toMatch(/^0x[0-9a-f]{40}$/);
    expect(addressToScriptHash(upperPrefix)).toBe(out);
  });
});
