import { describe, expect, it } from "vitest";

import { needsPublicRevealAck, validateCompose, type ComposeForm } from "./message-logic";

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
});
