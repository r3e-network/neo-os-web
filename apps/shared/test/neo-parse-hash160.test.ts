import { describe, expect, it } from "vitest";
import { addressToScriptHash, parseHash160, parseStackItem } from "../utils/neo";

/**
 * Real-node fixture (captured 2026-06-12 from api.n3index.dev/testnet):
 *
 *   invokefunction 0x87f94598c78cb954ca8200d3964ded9b584d7250 getOwner []
 *   -> stack: [{ "type": "ByteString", "value": "ODf0EwY4dOXBDMmxnUaR3fZWBm0=" }]
 *
 * The owner is NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32, whose display script hash
 * (the form explorers and invokefunction params use) is
 * 0x6d0656f6dd91469db1c90cc1e574380613f43738 — the byte-reversed form of the
 * raw ByteString payload.
 */
const OWNER_BASE64 = "ODf0EwY4dOXBDMmxnUaR3fZWBm0=";
const OWNER_DISPLAY_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const OWNER_CHAIN_ORDER_HEX = "0x3837f413063874e5c10cc9b19d4691ddf656066d";
const OWNER_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";

describe("parseHash160 — chain-order Hash160 to display hex", () => {
  it("converts the real-node base64 ByteString to the display hash", () => {
    expect(parseHash160(OWNER_BASE64)).toBe(OWNER_DISPLAY_HASH);
  });

  it("accepts the raw stack item object", () => {
    expect(parseHash160({ type: "ByteString", value: OWNER_BASE64 })).toBe(
      OWNER_DISPLAY_HASH,
    );
    expect(parseHash160({ type: "Buffer", value: OWNER_BASE64 })).toBe(
      OWNER_DISPLAY_HASH,
    );
  });

  it("agrees with addressToScriptHash for the same identity", () => {
    // This is the comparison apps make: chain read value vs connected wallet.
    expect(parseHash160(OWNER_BASE64)).toBe(addressToScriptHash(OWNER_ADDRESS));
  });

  it("reverses parseStackItem's chain-order hex output", () => {
    const parsed = parseStackItem({ type: "ByteString", value: OWNER_BASE64 });
    // parseByteLike renders this fixture as chain-order hex (non-printable bytes).
    expect(parsed).toBe(OWNER_CHAIN_ORDER_HEX);
    expect(parseHash160(parsed)).toBe(OWNER_DISPLAY_HASH);
    expect(parseHash160(OWNER_CHAIN_ORDER_HEX.slice(2))).toBe(OWNER_DISPLAY_HASH);
  });

  it("recovers hashes that parseStackItem rendered as printable text", () => {
    // All 20 bytes printable ASCII -> parseByteLike returns the text form.
    const printableBytes = new Uint8Array(20);
    for (let i = 0; i < 20; i += 1) printableBytes[i] = 0x41 + i; // 'A'..'T'
    const base64 = btoa(String.fromCharCode(...printableBytes));

    const parsed = parseStackItem({ type: "ByteString", value: base64 });
    expect(parsed).toBe("ABCDEFGHIJKLMNOPQRST");

    const expected = `0x${Array.from(printableBytes)
      .reverse()
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;
    expect(parseHash160(parsed)).toBe(expected);
    expect(parseHash160(base64)).toBe(expected);
  });

  it("accepts a 20-byte Uint8Array", () => {
    const bytes = Uint8Array.from(atob(OWNER_BASE64), (c) => c.charCodeAt(0));
    expect(parseHash160(bytes)).toBe(OWNER_DISPLAY_HASH);
    // Input must not be mutated by the internal reverse.
    expect(bytes[0]).toBe(0x38);
  });

  it("returns '' for non-hash inputs", () => {
    expect(parseHash160(null)).toBe("");
    expect(parseHash160(undefined)).toBe("");
    expect(parseHash160("")).toBe("");
    expect(parseHash160(123)).toBe("");
    expect(parseHash160("not-a-hash")).toBe("");
    // 32-byte value (a Hash256) must not pass.
    expect(parseHash160(`0x${"ab".repeat(32)}`)).toBe("");
    expect(parseHash160(new Uint8Array(19))).toBe("");
    expect(parseHash160({ type: "Integer", value: "7" })).toBe("");
    // 20-char string with a >1-byte char cannot be a byte-string round-trip.
    expect(parseHash160("ABCDEFGHIJKLMNOPQRS中")).toBe("");
  });

  it("does not change parseStackItem's default behavior", () => {
    // Callers depend on the legacy shapes; parseHash160 is opt-in only.
    expect(parseStackItem({ type: "ByteString", value: OWNER_BASE64 })).toBe(
      OWNER_CHAIN_ORDER_HEX,
    );
    expect(parseStackItem({ type: "Integer", value: "42" })).toBe(42);
  });
});
