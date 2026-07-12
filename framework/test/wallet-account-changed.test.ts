/**
 * wallet.onAccountChanged (RFC P0-5) — identity-diff account-change hook.
 *
 * Locks: fires ONLY on a normalized identity change (never for repeated
 * emissions of the same address), delivers { previous, current }, isolates
 * handler errors from the subscription, supports immediate delivery, and
 * returns a working unsubscribe.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable } from "../reactive";
import { createWalletSurface } from "../wallet";
import type { FrameworkAccountChange } from "../wallet";

const A = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const B = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";

function makeWallet(initial: string | null = null) {
  const address = createObservable<string | null>(initial);
  const wallet = createWalletSurface({
    chain: {
      address,
      ensureWallet: async () => address.get() ?? A,
      read: async () => "0",
    },
  });
  return { address, wallet };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wallet.onAccountChanged", () => {
  it("fires only when the identity actually changes, with previous/current", () => {
    const { address, wallet } = makeWallet(null);
    const changes: FrameworkAccountChange[] = [];
    wallet.onAccountChanged((change) => {
      changes.push(change);
    });

    address.set(A); // connect
    address.set(A); // same value — Observable dedupes, no fire
    address.set(B); // switch accounts
    address.set(null); // disconnect

    expect(changes).toEqual([
      { previous: null, current: A },
      { previous: A, current: B },
      { previous: B, current: null },
    ]);
  });

  it("normalizes whitespace/empty forms in the identity diff", () => {
    const { address, wallet } = makeWallet(A);
    const changes: FrameworkAccountChange[] = [];
    wallet.onAccountChanged((change) => {
      changes.push(change);
    });

    address.set(`  ${A}  `); // same identity after trim — no fire
    expect(changes).toEqual([]);
    address.set(""); // empty string normalizes to null — a disconnect
    expect(changes).toEqual([{ previous: A, current: null }]);
  });

  it("immediate: true fires once at subscription time with previous null", () => {
    const { wallet } = makeWallet(A);
    const changes: FrameworkAccountChange[] = [];
    wallet.onAccountChanged(
      (change) => {
        changes.push(change);
      },
      { immediate: true },
    );
    expect(changes).toEqual([{ previous: null, current: A }]);
  });

  it("isolates handler errors (sync throw and async rejection) from the subscription", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { address, wallet } = makeWallet(null);
    const seen: Array<string | null> = [];
    wallet.onAccountChanged(({ current }) => {
      seen.push(current);
      if (current === A) throw new Error("sync handler bug");
      if (current === B) return Promise.reject(new Error("async handler bug"));
      return undefined;
    });

    expect(() => address.set(A)).not.toThrow();
    expect(() => address.set(B)).not.toThrow();
    address.set(null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Every change was still delivered despite the failing handler runs.
    expect(seen).toEqual([A, B, null]);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("unsubscribe stops delivery", () => {
    const { address, wallet } = makeWallet(null);
    const handler = vi.fn();
    const stop = wallet.onAccountChanged(handler);
    address.set(A);
    stop();
    address.set(B);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
