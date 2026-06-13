import { describe, expect, it } from "vitest";

import {
  validateAddress,
  addressToScriptHash,
  generateAccount,
  convertPublicKeyToAddress,
} from "../../neo-convert/src/services/neo";

/**
 * neo-convert finding: the input placeholder advertises "Enter WIF, hex, or
 * address…" but the converter had no address branch — a pasted N3 address fell
 * through every validator and errored "Unknown format". The address detection
 * must validate the Neo N3 version byte (0x35) and emit the script hash in both
 * the big-endian (0x… display) and little-endian (in-script) byte orders.
 */
describe("neo-convert address → script hash", () => {
  it("validates a real Neo N3 address and rejects non-addresses", () => {
    const { address } = generateAccount();
    expect(address.startsWith("N")).toBe(true);
    expect(validateAddress(address)).toBe(true);

    // A bare WIF, hex, and a Neo Legacy-shaped string are not N3 addresses.
    expect(validateAddress("not-an-address")).toBe(false);
    expect(validateAddress("")).toBe(false);
    // Valid base58check but wrong version byte (Legacy 0x17) must be rejected.
    expect(validateAddress("AK2nJJpJr6o664CWJKi1QRXjqeic2zRp8y")).toBe(false);
  });

  it("decodes the script hash with big-endian as the byte-reverse of little-endian", () => {
    const { address } = generateAccount();
    const { bigEndian, littleEndian } = addressToScriptHash(address);

    // 20-byte hashes: 40 hex chars; big-endian carries the 0x prefix.
    expect(bigEndian).toMatch(/^0x[0-9a-f]{40}$/);
    expect(littleEndian).toMatch(/^[0-9a-f]{40}$/);

    // The display (big-endian) form is the little-endian payload reversed.
    const reversedLE = (littleEndian.match(/.{2}/g) ?? []).reverse().join("");
    expect(bigEndian).toBe(`0x${reversedLE}`);
  });

  it("derives a script hash consistent with the address re-derived from its public key", () => {
    // generateAccount returns address+publicKey from the same key; converting the
    // public key back to an address must reproduce the address, and that address
    // must decode to a stable 20-byte script hash.
    const account = generateAccount();
    expect(convertPublicKeyToAddress(account.publicKey)).toBe(account.address);

    const { littleEndian } = addressToScriptHash(account.address);
    // Deterministic for a given address: decoding twice yields the same hash.
    expect(addressToScriptHash(account.address).littleEndian).toBe(littleEndian);
  });

  it("throws on an invalid address passed to addressToScriptHash", () => {
    expect(() => addressToScriptHash("not-an-address")).toThrow();
  });
});
