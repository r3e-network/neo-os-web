import { describe, expect, it } from "vitest";

import {
  MAX_BODY_LENGTH,
  MAX_MAILBOX_IDS,
  decodeMessageIds,
  isMessageRecipient,
  isSupportedMessageNetwork,
  needsPublicRevealAck,
  validateCompose,
  type ComposeForm,
} from "./message-logic";

/**
 * Time-locked messages post their plaintext publicly on-chain, so the Send
 * action must wait for an explicit acknowledgement. Recipient-only messages
 * never become public and require no acknowledgement.
 */
describe("needsPublicRevealAck", () => {
  it("blocks sending a time-locked message until it is acknowledged", () => {
    expect(needsPublicRevealAck("timed", false)).toBe(true);
  });

  it("allows sending a time-locked message once acknowledged", () => {
    expect(needsPublicRevealAck("timed", true)).toBe(false);
  });

  it("never blocks recipient-only messages, acknowledged or not", () => {
    expect(needsPublicRevealAck("recipient", false)).toBe(false);
    expect(needsPublicRevealAck("recipient", true)).toBe(false);
  });

  it("treats an undefined mode (defaults to recipient-only) as not requiring acknowledgement", () => {
    expect(needsPublicRevealAck(undefined, false)).toBe(false);
  });
});

/**
 * Sanity guard so the acknowledgement gate is layered on top of an otherwise
 * valid compose — a timed message still computes a future unlockTime.
 */
describe("validateCompose (timed reveal)", () => {
  const future = "2099-01-01T00:00";
  const recipient = "0x1234567890123456789012345678901234567890";

  it("computes a positive unlockTime for a future timed reveal", () => {
    const form: ComposeForm = { recipient, body: "hi", lockMode: "timed", revealDate: future };
    const result = validateCompose(form, Date.parse("2026-01-01T00:00:00Z"));
    expect(result.ok).toBe(true);
    expect(result.unlockTime).toBeGreaterThan(0);
  });

  it("rejects the zero address because it can never open a private note", () => {
    const zero = "0x0000000000000000000000000000000000000000";
    expect(isMessageRecipient(zero)).toBe(false);
    expect(validateCompose({ recipient: zero, body: "lost note" }).error).toBe("invalidRecipient");
  });

  it("bounds the raw draft so whitespace cannot bypass the durable compose limit", () => {
    const form: ComposeForm = {
      recipient,
      body: `sealed${" ".repeat(MAX_BODY_LENGTH)}`,
      lockMode: "recipient",
    };
    expect(validateCompose(form)).toEqual({ ok: false, error: "bodyTooLong" });
  });
});

describe("Neo Message network boundary", () => {
  it("accepts only the deployed Neo X mainnet, not Neo X testnet", () => {
    expect(isSupportedMessageNetwork("neo-x-mainnet")).toBe(true);
    expect(isSupportedMessageNetwork("neo-x-testnet")).toBe(false);
    expect(isSupportedMessageNetwork("neo-n3-mainnet")).toBe(false);
  });
});

describe("decodeMessageIds", () => {
  const word = (value: bigint) => value.toString(16).padStart(64, "0");

  it("decodes a canonical dynamic uint array without Number coercion", () => {
    const large = 9_007_199_254_740_993n;
    expect(decodeMessageIds(`0x${word(32n)}${word(2n)}${word(7n)}${word(large)}`)).toEqual([7n, large]);
  });

  it.each([
    "0x",
    `0x${word(0n)}${word(0n)}`,
    `0x${word(32n)}${word(1n)}`,
  ])("rejects missing or malformed ABI data instead of inventing an empty mailbox", (raw) => {
    expect(() => decodeMessageIds(raw)).toThrow();
  });

  it("accepts a canonical empty array", () => {
    expect(decodeMessageIds(`0x${word(32n)}${word(0n)}`)).toEqual([]);
  });

  it("rejects trailing words and mailbox lengths beyond the bounded UI contract", () => {
    expect(() => decodeMessageIds(`0x${word(32n)}${word(0n)}${word(7n)}`)).toThrow(/non-canonical/);
    expect(() => decodeMessageIds(`0x${word(32n)}${word(BigInt(MAX_MAILBOX_IDS + 1))}`)).toThrow(/too large/);
  });
});
