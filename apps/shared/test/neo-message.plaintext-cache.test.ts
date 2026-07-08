import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import {
  PLAINTEXT_STORE_KEY,
  cachePlaintext,
  overlayCachedPlaintext,
  plaintextCacheKey,
  readPlaintextCache,
} from "../../neo-message/src/plaintext-cache";
import { MESSAGE_EVM_ADDRESS, type MessageView } from "../../neo-message/src/message-logic";

/**
 * The device plaintext cache migrated from raw safe-storage helpers onto
 * app.storage.local. The user-visible invariant: plaintext decrypted BEFORE
 * the migration must still overlay after it — the localStorage key composed
 * from the app's pinned storagePrefix + {@link PLAINTEXT_STORE_KEY} has to be
 * byte-identical to the legacy "<contract-address>:plaintext:v1" key.
 */

// Mirrors main.tsx: app.storage.local pinned to the legacy namespace.
const STORAGE_PREFIX = `${MESSAGE_EVM_ADDRESS.toLowerCase()}:`;
const LEGACY_KEY = `${MESSAGE_EVM_ADDRESS.toLowerCase()}:plaintext:v1`;

const RECIPIENT = "0x622ae03BDB6d7E2A29BE853c75d625bB25c0139C";

function makeLocal() {
  const chain = {
    address: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => ""),
    read: vi.fn(async () => null),
    invoke: vi.fn(),
    invokeWithPayment: vi.fn(),
  };
  const app = createMiniAppFramework(
    { services: { chain }, t: (key: string) => key } as never,
    { appId: "miniapp-neo-message", storagePrefix: STORAGE_PREFIX },
  );
  return app.storage.local;
}

function row(partial: Partial<MessageView> & { id: string }): MessageView {
  return {
    sender: "0x1111111111111111111111111111111111111111",
    recipient: RECIPIENT,
    unlockTime: 0,
    sentAt: 0,
    revealed: false,
    plaintext: "",
    timeLocked: false,
    ...partial,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe("neo-message plaintext cache (app.storage.local)", () => {
  it("composes the pinned storagePrefix + store key into the legacy key byte-for-byte", () => {
    expect(`${STORAGE_PREFIX}${PLAINTEXT_STORE_KEY}`).toBe(LEGACY_KEY);
  });

  it("reads a cache written before the framework migration (legacy key, byte-for-byte)", () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ [plaintextCacheKey("7", RECIPIENT)]: "hello from before" }),
    );

    const cache = readPlaintextCache(makeLocal());

    expect(cache[plaintextCacheKey("7", RECIPIENT)]).toBe("hello from before");
  });

  it("writes through app.storage.local to the exact legacy key", () => {
    cachePlaintext(makeLocal(), "9", RECIPIENT, "sealed note");

    const raw = localStorage.getItem(LEGACY_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      [plaintextCacheKey("9", RECIPIENT)]: "sealed note",
    });
  });

  it("lowercases the recipient in cache keys so checksum casing never misses", () => {
    const local = makeLocal();
    cachePlaintext(local, "3", RECIPIENT.toUpperCase().replace("0X", "0x"), "case note");

    const overlaid = overlayCachedPlaintext(local, [row({ id: "3" })], RECIPIENT.toLowerCase());

    expect(overlaid[0].plaintext).toBe("case note");
    expect(overlaid[0].revealed).toBe(true);
  });

  it("overlays cached plaintext only onto unrevealed rows addressed to the connected wallet", () => {
    const local = makeLocal();
    cachePlaintext(local, "1", RECIPIENT, "for me");
    cachePlaintext(local, "2", RECIPIENT, "already shown");
    const rows = [
      row({ id: "1" }),
      row({ id: "2", plaintext: "already shown", revealed: true }),
      row({ id: "3" }),
      row({ id: "4", recipient: "0x9999999999999999999999999999999999999999" }),
    ];

    const overlaid = overlayCachedPlaintext(local, rows, RECIPIENT);

    expect(overlaid[0]).toEqual({ ...rows[0], plaintext: "for me", revealed: true });
    // Already revealed rows, rows without a cache entry, and rows addressed to
    // someone else pass through untouched (same object, no synthetic reveal).
    expect(overlaid[1]).toBe(rows[1]);
    expect(overlaid[2]).toBe(rows[2]);
    expect(overlaid[3]).toBe(rows[3]);
  });

  it("returns an empty cache on missing or corrupt storage", () => {
    expect(readPlaintextCache(makeLocal())).toEqual({});

    localStorage.setItem(LEGACY_KEY, "{not json");
    expect(readPlaintextCache(makeLocal())).toEqual({});
  });

  it("swallows storage write failures so a reveal never fails on a full device cache", () => {
    const store = {
      get: () => null,
      set: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(() => cachePlaintext(store, "1", RECIPIENT, "plain")).not.toThrow();
  });
});
