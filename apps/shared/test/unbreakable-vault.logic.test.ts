import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { ChainService, ContractArg, TxResult } from "../services";
import { useVaultBreaker } from "../../unbreakable-vault/src/composables/useVaultBreaker";
import { useVaultCreator } from "../../unbreakable-vault/src/composables/useVaultCreator";
import { addressToScriptHash } from "../utils/neo";

/**
 * Drives the unbreakable-vault composables against a fake ChainService that
 * mirrors the deployed MiniAppUnbreakableVault read model. Focuses on the
 * behaviour the UX fixes change:
 *   - attemptBreak must NOT report a wrong-secret failure when the AttemptMade
 *     event wait times out (event=null) — it re-checks the winner and otherwise
 *     surfaces a "confirming" state.
 *   - increaseBounty deposits then calls increaseBounty(vaultId, amount).
 *   - loadMyVaults scans deeper than the 12-newest public catalog.
 */

const ME = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OTHER = "NfgHwwTi3wHAS8aFAN243C5vGbkYDpqLHP";
const ME_HASH = addressToScriptHash(ME);

interface ChainVault {
  id: string;
  creator: string;
  bounty: number;
  attemptCount: number;
  difficulty: number;
  difficultyName: string;
  attemptFee: number;
  createdTime: number;
  expiryTime: number;
  hintsRevealed: number;
  broken: boolean;
  expired: boolean;
  winner: string;
  title: string;
  description: string;
  status: string;
}

function vault(partial: Partial<ChainVault> & { id: string }): ChainVault {
  return {
    creator: ME_HASH,
    bounty: 500000000,
    attemptCount: 0,
    difficulty: 1,
    difficultyName: "Easy",
    attemptFee: 10000000,
    createdTime: Number(partial.id),
    expiryTime: Date.now() + 7 * 86_400_000,
    hintsRevealed: 0,
    broken: false,
    expired: false,
    winner: "",
    title: `Vault ${partial.id}`,
    description: "",
    status: "active",
    ...partial,
  };
}

interface InvokeCall {
  operation: string;
  args: ContractArg[];
  options?: { waitForEvent?: string };
}

function setup(
  vaults: ChainVault[],
  opts?: { wallet?: string | null; attemptEvent?: unknown },
) {
  const store = new Map<string, ChainVault>();
  for (const v of vaults) store.set(v.id, v);
  const invokes: InvokeCall[] = [];
  const events: Array<{ event: string; payload?: unknown }> = [];

  const address = createObservable<string | null>(
    opts && "wallet" in opts ? opts.wallet ?? null : ME,
  );

  const read = vi.fn(async (operation: string, args?: ContractArg[]) => {
    if (operation === "totalVaults") return store.size;
    if (operation === "getVaultDetails") {
      const id = String(args?.[0]?.value ?? "");
      return store.get(id) ?? {};
    }
    throw new Error(`unexpected read: ${operation}`);
  });

  const invokeWithPayment = vi.fn(
    async (
      _amount: string,
      _memo: string,
      operation: string,
      args: ContractArg[],
      options?: { waitForEvent?: string },
    ): Promise<TxResult> => {
      invokes.push({ operation, args, options });
      if (operation === "attemptBreak") {
        return { txid: "0xattempt", success: true, event: opts?.attemptEvent ?? null };
      }
      if (operation === "increaseBounty") {
        const id = String(args[0]?.value ?? "");
        const v = store.get(id);
        if (v) store.set(id, { ...v, bounty: v.bounty + Number(args[1]?.value ?? 0) });
        return { txid: "0xtopup", success: true, event: { state: [{ value: id }] } };
      }
      if (operation === "createVault") {
        return { txid: "0xcreate", success: true, event: { state: [{ value: "99" }] } };
      }
      return { txid: "0x", success: true };
    },
  );

  const invoke = vi.fn(async (): Promise<TxResult> => ({ txid: "0x", success: true }));

  const chain = {
    address,
    contractAddress: createObservable<string | null>("0xcontract"),
    ensureWallet: vi.fn(async () => address.get() ?? ME),
    read,
    readArray: vi.fn(),
    invoke,
    invokeWithPayment,
  } as unknown as ChainService;

  const eventBus = {
    emit: (event: string, payload?: unknown) => {
      events.push({ event, payload });
    },
  };

  const t = (key: string) => key;
  const breaker = useVaultBreaker({ chainService: chain, eventBus, t });
  const creator = useVaultCreator({ chainService: chain, eventBus, t });
  return { breaker, creator, chain, invokes, events, store, address };
}

describe("useVaultBreaker.attemptBreak (event-timeout handling)", () => {
  it("does NOT report a failed attempt when AttemptMade times out and the wallet did not win", async () => {
    // event=null mirrors an indexer-lag timeout on a HALTed tx.
    const { breaker, events } = setup([vault({ id: "1", status: "active" })], {
      attemptEvent: null,
    });
    await breaker.selectVault("1");
    breaker.attemptSecret.set("guess");

    const result = await breaker.attemptBreak();

    expect(result).toEqual({ success: false, confirming: true });
    // It must NOT emit the wrong-secret "attempt_failed" — that would lie to a
    // user whose tx may have HALTed (and even won).
    expect(events.some((e) => e.event === "vault:attempt_failed")).toBe(false);
    expect(events.some((e) => e.event === "vault:attempt_confirming")).toBe(true);
  });

  it("declares a win when the re-read shows this wallet as the winner after a timeout", async () => {
    const { breaker, store, events } = setup([vault({ id: "1", status: "active" })], {
      attemptEvent: null,
    });
    await breaker.selectVault("1");
    breaker.attemptSecret.set("correct");
    // The break landed on-chain even though the event wait timed out.
    store.set("1", { ...store.get("1")!, status: "broken", broken: true, winner: ME_HASH });

    const result = await breaker.attemptBreak();

    expect(result).toEqual({ success: true });
    expect(events.some((e) => e.event === "vault:broken")).toBe(true);
  });

  it("reports the explicit failure when AttemptMade fires with success=false", async () => {
    const { breaker, events } = setup([vault({ id: "1", status: "active" })], {
      attemptEvent: { state: [{ value: "1" }, { value: ME_HASH }, { value: false }] },
    });
    await breaker.selectVault("1");
    breaker.attemptSecret.set("wrong");

    const result = await breaker.attemptBreak();

    expect(result).toEqual({ success: false });
    expect(events.some((e) => e.event === "vault:attempt_failed")).toBe(true);
  });
});

describe("useVaultCreator.increaseBounty", () => {
  it("deposits then calls increaseBounty(vaultId, amount) with the create memo", async () => {
    const { creator, invokes } = setup([vault({ id: "5", status: "active" })]);

    const { vaultId, amountGas } = await creator.increaseBounty("5", "2");

    expect(vaultId).toBe("5");
    expect(amountGas).toBe("2");
    const call = invokes.find((c) => c.operation === "increaseBounty");
    expect(call).toBeTruthy();
    expect(call?.args[0]?.value).toBe("5"); // vaultId
    expect(call?.args[1]?.value).toBe("200000000"); // 2 GAS base units
    expect(call?.options?.waitForEvent).toBe("BountyIncreased");
  });

  it("rejects a non-positive top-up amount before prompting the wallet", async () => {
    const { creator, invokes } = setup([vault({ id: "5", status: "active" })]);
    await expect(creator.increaseBounty("5", "0")).rejects.toThrow();
    expect(invokes.some((c) => c.operation === "increaseBounty")).toBe(false);
  });

  it("rejects over-precision top-up amounts before prompting the wallet", async () => {
    const { creator, invokes, chain } = setup([vault({ id: "5", status: "active" })]);
    await expect(creator.increaseBounty("5", "1.000000001")).rejects.toThrow(
      "increaseBountyInvalidAmount",
    );
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invokes.some((c) => c.operation === "increaseBounty")).toBe(false);
  });
});

describe("useVaultCreator.createVault", () => {
  it("rejects over-precision bounty amounts before prompting the wallet", async () => {
    const { creator, invokes, chain } = setup([]);
    await expect(
      creator.createVault(
        {
          bounty: "1.000000001",
          title: "Puzzle",
          description: "",
          difficulty: 1,
          secret: "secret",
          secretHash: "",
        },
        vi.fn(),
        vi.fn(async () => undefined),
      ),
    ).rejects.toThrow("minBountyNote");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invokes.some((c) => c.operation === "createVault")).toBe(false);
  });
});

describe("useVaultCreator.loadMyVaults (deep creator scan)", () => {
  it("finds the wallet's older vaults past the newest 12 so reclaim stays discoverable", async () => {
    // 20 vaults: the wallet's oldest (id 1) is well outside the newest-12 window.
    const vaults: ChainVault[] = [];
    for (let id = 1; id <= 20; id += 1) {
      vaults.push(vault({ id: String(id), creator: id === 1 ? ME_HASH : addressToScriptHash(OTHER) }));
    }
    const { creator } = setup(vaults, { wallet: ME });

    await creator.loadMyVaults();

    const mine = creator.myVaults.get().map((v) => v.id);
    expect(mine).toContain("1");
  });
});
