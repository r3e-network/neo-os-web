import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";
import { useProfitAnchor } from "../../profitanchor/src/hooks/useProfitAnchor";
import { useTrustAnchor } from "../../trustanchor/src/hooks/useTrustAnchor";

const OPERATOR = "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX";

/**
 * Build a fake ChainService whose `read` is driven per-method, so a test can
 * stage getAnchorStats / admin / getAppAdmin / getAgentCount / getAgent / getCredit
 * responses independently.
 */
function fakeAnchorDeps(
  reads: Record<string, unknown> = {},
  address = OPERATOR,
) {
  const invoke = vi.fn(async () => ({ txid: "0xanchor", success: true }));
  const read = vi.fn(async (op: string) => reads[op] ?? 0);
  const chain = {
    address: createObservable(address),
    contractAddress: createObservable(
      "0xab079b4f9a0a2471d136392e25eb8e99898dcad0",
    ),
    ensureWallet: vi.fn(async () => address),
    invoke,
    read,
  };
  const eventBus = { emit: vi.fn() };
  // Identity translator: throws surface the key, so we can assert on the key.
  const t = (key: string) => key;
  return { chain, eventBus, t, invoke, read };
}

describe("Anchor hook localizes validation errors through t()", () => {
  for (const [name, useAnchor] of [
    ["TrustAnchor", useTrustAnchor],
    ["ProfitAnchor", useProfitAnchor],
  ] as const) {
    it(`${name}: invalid agent id throws the i18n key, not English text`, async () => {
      const deps = fakeAnchorDeps();
      const anchor = useAnchor(deps as never);
      await expect(anchor.transferAgentNeo(0, 2, 1)).rejects.toThrow(
        "invalidAgentId",
      );
    });

    it(`${name}: same source/target agent throws the sameAgent key`, async () => {
      const deps = fakeAnchorDeps();
      const anchor = useAnchor(deps as never);
      await expect(anchor.transferAgentNeo(3, 3, 1)).rejects.toThrow(
        "sameAgent",
      );
    });

    it(`${name}: fractional NEO throws the invalidAmount key`, async () => {
      const deps = fakeAnchorDeps();
      const anchor = useAnchor(deps as never);
      await expect(anchor.stakeNeo(1.5)).rejects.toThrow("invalidAmount");
    });
  }
});

describe("Anchor hook NEO-credit recovery (withdrawCredit exit path)", () => {
  for (const [name, useAnchor] of [
    ["TrustAnchor", useTrustAnchor],
    ["ProfitAnchor", useProfitAnchor],
  ] as const) {
    it(`${name}: recoverNeoCredit invokes withdrawCredit with the loaded NEO credit`, async () => {
      const deps = fakeAnchorDeps({ getCredit: 7 });
      const anchor = useAnchor(deps as never);
      await anchor.loadAll();
      expect(anchor.pendingWithdraw.get()).toBe(7);
      await anchor.recoverNeoCredit();
      expect(deps.invoke).toHaveBeenCalledWith(
        "withdrawCredit",
        [
          { type: "Hash160", value: OPERATOR },
          { type: "String", value: "NEO" },
          { type: "Integer", value: 7 },
        ],
        expect.any(Object),
      );
    });

    it(`${name}: recoverNeoCredit refuses to invoke when there is no credit`, async () => {
      const deps = fakeAnchorDeps({ getCredit: 0 });
      const anchor = useAnchor(deps as never);
      await anchor.loadAll();
      await expect(anchor.recoverNeoCredit()).rejects.toThrow("invalidAmount");
      expect(deps.invoke).not.toHaveBeenCalled();
    });
  }
});

/** Display-order 0x hash -> chain (reversed) byte-order hex, as RPC returns it. */
function toChainOrderHex(displayHash: string): string {
  const hex = displayHash.replace(/^0x/i, "");
  return hex.match(/.{2}/g)?.reverse().join("") ?? "";
}

describe("Anchor hook resolves admin authority from chain reads", () => {
  it("isAdmin is true when the connected wallet matches getAppAdmin", async () => {
    // getAppAdmin returns a Hash160 in chain (reversed) byte order over RPC.
    const adminChainHex = toChainOrderHex(addressToScriptHash(OPERATOR));
    const deps = fakeAnchorDeps({
      admin: "0000000000000000000000000000000000000000",
      getAppAdmin: adminChainHex,
    });
    const anchor = useTrustAnchor(deps as never);
    // Null until admin info loads.
    expect(anchor.isAdmin()).toBeNull();
    await anchor.loadAll();
    expect(anchor.isAdmin()).toBe(true);
  });

  it("isAdmin is false for a non-operator wallet", async () => {
    const deps = fakeAnchorDeps({
      admin: "0000000000000000000000000000000000000000",
      getAppAdmin: "1111111111111111111111111111111111111111",
    });
    const anchor = useTrustAnchor(deps as never);
    await anchor.loadAll();
    expect(anchor.isAdmin()).toBe(false);
  });
});
