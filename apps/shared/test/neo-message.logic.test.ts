import { describe, expect, it } from "vitest";

import {
  isEvmAddress,
  isMessageRecipient,
  isSupportedMessageNetwork,
  addressesEqual,
  buildRevealStatement,
  validateCompose,
  messageStatus,
  formatUnlock,
  shortAddress,
  MESSAGE_EVM_ADDRESS,
  NEO_X_CHAIN_ID,
} from "../../neo-message/src/message-logic";

const RECIPIENT = "0x622ae03BDB6d7E2A29BE853c75d625bB25c0139C";

describe("neo-message logic", () => {
  it("isEvmAddress validates 0x + 40 hex", () => {
    expect(isEvmAddress(RECIPIENT)).toBe(true);
    expect(isEvmAddress("0x123")).toBe(false);
    expect(isEvmAddress("NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq")).toBe(false);
    expect(isEvmAddress(undefined)).toBe(false);
  });

  it("requires a non-zero recipient and the exact deployed mainnet", () => {
    expect(isMessageRecipient(RECIPIENT)).toBe(true);
    expect(isMessageRecipient("0x0000000000000000000000000000000000000000")).toBe(false);
    expect(isSupportedMessageNetwork("neo-x-mainnet")).toBe(true);
    expect(isSupportedMessageNetwork("neo-x-testnet")).toBe(false);
  });

  it("addressesEqual is checksum-insensitive", () => {
    expect(addressesEqual(RECIPIENT, RECIPIENT.toLowerCase())).toBe(true);
    expect(addressesEqual(RECIPIENT, "0x0000000000000000000000000000000000000000")).toBe(false);
    expect(addressesEqual("", RECIPIENT)).toBe(false);
  });

  it("buildRevealStatement matches the worker's byte-identical format", () => {
    const stmt = buildRevealStatement(NEO_X_CHAIN_ID, MESSAGE_EVM_ADDRESS, "5", 1700000000);
    expect(stmt).toBe(
      [
        "Morpheus Neo Message",
        "Recipient reveal request",
        "chain: 47763",
        `contract: ${MESSAGE_EVM_ADDRESS.toLowerCase()}`,
        "message: 5",
        "issued: 1700000000",
      ].join("\n"),
    );
  });

  it("validateCompose rejects bad recipient / body", () => {
    expect(validateCompose({ recipient: "nope", body: "hi" }).error).toBe("invalidRecipient");
    expect(validateCompose({ recipient: RECIPIENT, body: "  " }).error).toBe("emptyBody");
    expect(validateCompose({ recipient: RECIPIENT, body: "x".repeat(5000) }).error).toBe("bodyTooLong");
  });

  it("validateCompose computes unlockTime 0 for recipient-only", () => {
    const r = validateCompose({ recipient: RECIPIENT, body: "hello", lockMode: "recipient" });
    expect(r.ok).toBe(true);
    expect(r.unlockTime).toBe(0);
  });

  it("validateCompose computes a future unlockTime for timed mode", () => {
    const now = Date.parse("2026-06-08T00:00:00Z");
    const ok = validateCompose(
      { recipient: RECIPIENT, body: "hello", lockMode: "timed", revealDate: "2026-06-09T00:00:00Z" },
      now,
    );
    expect(ok.ok).toBe(true);
    expect(ok.unlockTime).toBe(Math.floor(Date.parse("2026-06-09T00:00:00Z") / 1000));

    const past = validateCompose(
      { recipient: RECIPIENT, body: "hello", lockMode: "timed", revealDate: "2026-06-07T00:00:00Z" },
      now,
    );
    expect(past.error).toBe("revealDateInPast");

    const bad = validateCompose(
      { recipient: RECIPIENT, body: "hello", lockMode: "timed", revealDate: "not-a-date" },
      now,
    );
    expect(bad.error).toBe("invalidRevealDate");
  });

  it("messageStatus reflects lifecycle", () => {
    const now = 1700000000;
    expect(messageStatus({ unlockTime: 0, revealed: true }, now)).toBe("revealed");
    expect(messageStatus({ unlockTime: 0, revealed: false }, now)).toBe("recipient");
    expect(messageStatus({ unlockTime: now - 10, revealed: false }, now)).toBe("unlockable");
    expect(messageStatus({ unlockTime: now + 10_000, revealed: false }, now)).toBe("locked");
  });

  it("formatUnlock returns empty for recipient-only", () => {
    expect(formatUnlock(0)).toBe("");
    expect(formatUnlock(1700000000)).not.toBe("");
  });

  it("shortAddress truncates", () => {
    expect(shortAddress(RECIPIENT)).toBe("0x622a…139C");
    expect(shortAddress("0x1234")).toBe("0x1234");
  });
});
