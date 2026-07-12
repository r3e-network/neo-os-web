import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import type { ContractArg, TxResult } from "../services";
import { useVaultBreaker } from "../../unbreakable-vault/src/composables/useVaultBreaker";
import { useVaultCreator } from "../../unbreakable-vault/src/composables/useVaultCreator";
import { createVaultSafety } from "../../unbreakable-vault/src/composables/vaultSafety";
import {
  parseVaultDetails,
  readRecentVaultDetails,
} from "../../unbreakable-vault/src/composables/vaultChain";
import { addressToScriptHash } from "../utils/neo";

/**
 * Drives the unbreakable-vault composables against a fake chain wrapped in the
 * MiniApp framework SDK (mirroring how main.tsx hands ctx.framework to them);
 * the framework arg builders and raw passthroughs are behavior-preserving, so
 * every recorded chain call matches the pre-migration shapes. Focuses on the
 * behaviour the UX fixes change:
 *   - attemptBreak must NOT report a wrong-secret failure when the AttemptMade
 *     event wait times out (event=null) — it re-checks the winner and otherwise
 *     surfaces a "confirming" state via its return value.
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
  options?: {
    waitForEvent?: string;
    onPaymentSent?: (txid: string) => void;
    onTransactionSent?: (txid: string) => void;
    scriptHash?: string;
  };
}

function setup(
  vaults: ChainVault[],
  opts?: { wallet?: string | null; attemptEvent?: unknown },
) {
  const store = new Map<string, ChainVault>();
  for (const v of vaults) store.set(v.id, v);
  const invokes: InvokeCall[] = [];
  const directInvokes: InvokeCall[] = [];

  const address = createObservable<string | null>(
    opts && "wallet" in opts ? opts.wallet ?? null : ME,
  );

  const read = vi.fn(async (operation: string, args?: ContractArg[]) => {
    if (operation === "isPaused") return false;
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
      options?: InvokeCall["options"],
    ): Promise<TxResult> => {
      invokes.push({ operation, args, options });
      options?.onPaymentSent?.(`0x${"a".repeat(64)}`);
      options?.onTransactionSent?.(`0x${"b".repeat(64)}`);
      if (operation === "attemptBreak") {
        const id = String(args[0]?.value ?? "");
        const current = store.get(id);
        const event = opts?.attemptEvent ?? null;
        if (current && event) {
          const success = Boolean((event as { state?: Array<{ value?: unknown }> }).state?.[2]?.value);
          store.set(id, {
            ...current,
            attemptCount: current.attemptCount + 1,
            bounty: success ? current.bounty : current.bounty + current.attemptFee,
            broken: success,
            status: success ? "broken" : "active",
            winner: success ? ME_HASH : "",
          });
        }
        return {
          txid: `0x${"b".repeat(64)}`,
          success: true,
          verified: Boolean(event),
          event,
        };
      }
      if (operation === "increaseBounty") {
        const id = String(args[0]?.value ?? "");
        const v = store.get(id);
        const amount = Number(args[1]?.value ?? 0);
        if (v) store.set(id, { ...v, bounty: v.bounty + amount });
        const event = { state: [{ value: id }, { value: String(amount) }, { value: String((v?.bounty ?? 0) + amount) }] };
        return { txid: `0x${"b".repeat(64)}`, success: true, verified: true, event };
      }
      if (operation === "createVault") {
        const created = vault({
          id: "99",
          creator: ME_HASH,
          bounty: Number(args[2]?.value ?? 0),
          difficulty: Number(args[3]?.value ?? 0),
          title: String(args[4]?.value ?? ""),
          description: String(args[5]?.value ?? ""),
        });
        store.set("99", created);
        const event = { state: [
          { value: "99" },
          { value: ME_HASH },
          { value: String(created.bounty) },
          { value: String(created.difficulty) },
        ] };
        return { txid: `0x${"b".repeat(64)}`, success: true, verified: true, event };
      }
      return { txid: `0x${"b".repeat(64)}`, success: true, verified: true };
    },
  );

  const invoke = vi.fn(async (
    operation: string,
    args: ContractArg[],
    options?: InvokeCall["options"],
  ): Promise<TxResult> => {
    directInvokes.push({ operation, args, options });
    options?.onTransactionSent?.(`0x${"c".repeat(64)}`);
    if (operation === "claimExpiredVault") {
      const id = String(args[0]?.value ?? "");
      const current = store.get(id)!;
      store.set(id, { ...current, status: "expired", expired: true });
      return {
        txid: `0x${"c".repeat(64)}`,
        success: true,
        verified: true,
        event: { state: [
          { value: id },
          { value: current.creator },
          { value: String(Math.trunc(current.bounty * 0.98)) },
        ] },
      };
    }
    return { txid: `0x${"c".repeat(64)}`, success: true, verified: true };
  });

  const chain = {
    address,
    contractAddress: createObservable<string | null>("0x78fbd57ccfae14fff4b043a82eb491de542d8eb0"),
    ensureWallet: vi.fn(async () => address.get() ?? ME),
    detectNetwork: vi.fn(async () => "testnet"),
    read,
    readArray: vi.fn(),
    invoke,
    invokeWithPayment,
  };

  const t = (key: string) => key;
  const app = createMiniAppFramework(
    {
      services: { chain },
      t,
      launchContext: { appId: "miniapp-unbreakablevault", network: "testnet" },
    } as never,
    {
      appId: "miniapp-unbreakablevault",
      storagePrefix: `test:unbreakable:${Math.random()}:`,
    },
  );
  const safety = createVaultSafety(app, t);
  const breaker = useVaultBreaker({ app, t, safety });
  const creator = useVaultCreator({ app, t, safety });
  return { app, breaker, creator, safety, chain, invokes, directInvokes, store, address };
}

describe("Unbreakable Vault fixed8 read model", () => {
  it("keeps bounty and attempt fee exact beyond Number precision", () => {
    const parsed = parseVaultDetails("1", {
      id: "1",
      creator: ME_HASH,
      bounty: "900719925474099312345678",
      attemptCount: "2",
      difficulty: "3",
      difficultyName: "Hard",
      attemptFee: "100000000000000001",
      createdTime: "1",
      expiryTime: "2",
      hintsRevealed: "0",
      broken: false,
      expired: false,
      winner: "",
      title: "Exact vault",
      description: "",
      status: "active",
    });

    expect(parsed?.bounty).toBe("900719925474099312345678");
    expect(parsed?.attemptFee).toBe("100000000000000001");
  });

  it("does not turn string false or malformed asset data into a believable vault", () => {
    const base = {
      id: "1",
      creator: ME_HASH,
      bounty: "100000000",
      attemptCount: "0",
      difficulty: "1",
      difficultyName: "Easy",
      attemptFee: "10000000",
      createdTime: "1",
      expiryTime: "2",
      hintsRevealed: "0",
      broken: "false",
      expired: "false",
      winner: "",
      title: "Exact vault",
      description: "",
      status: "active",
    };

    expect(parseVaultDetails("1", base)).toMatchObject({ broken: false, expired: false });
    expect(parseVaultDetails("1", { ...base, bounty: "not-an-amount" })).toBeNull();
    expect(parseVaultDetails("1", { ...base, id: "2" })).toBeNull();
    expect(parseVaultDetails("1", { ...base, broken: "unknown" })).toBeNull();
    expect(parseVaultDetails("1", { ...base, difficulty: "4" })).toBeNull();
    expect(parseVaultDetails("1", { ...base, createdTime: "later" })).toBeNull();
    expect(parseVaultDetails("1", { ...base, status: "mystery" })).toBeNull();
  });

  it("rejects a malformed catalog total instead of publishing a verified empty list", async () => {
    const { app, chain } = setup([]);
    chain.read.mockResolvedValueOnce("not-a-count");

    await expect(readRecentVaultDetails(app, 12)).rejects.toThrow(
      "Vault catalog total is malformed",
    );
  });

  it("enumerates large vault IDs without Number rounding", async () => {
    const { app, chain } = setup([]);
    const ids: string[] = [];
    chain.read.mockImplementation(async (operation: string, args?: ContractArg[]) => {
      if (operation === "totalVaults") return "9007199254740993";
      if (operation === "getVaultDetails") {
        const id = String(args?.[0]?.value ?? "");
        ids.push(id);
        return vault({ id, createdTime: 1, expiryTime: 2 });
      }
      if (operation === "isPaused") return false;
      throw new Error(`unexpected read: ${operation}`);
    });

    const recent = await readRecentVaultDetails(app, 2);

    expect(ids).toEqual(["9007199254740993", "9007199254740992"]);
    expect(recent.map((item) => item.id)).toEqual(ids);
  });
});

describe("useVaultBreaker.attemptBreak (event-timeout handling)", () => {
  it("does NOT report a failed attempt when AttemptMade times out and the wallet did not win", async () => {
    // event=null mirrors an indexer-lag timeout on a HALTed tx.
    const { breaker } = setup([vault({ id: "1", status: "active" })], {
      attemptEvent: null,
    });
    await breaker.selectVault("1");
    breaker.attemptSecret.set("guess");

    const result = await breaker.attemptBreak();

    // It must NOT report the wrong-secret failure shape ({success:false} with
    // no confirming flag) — that would lie to a user whose tx may have HALTed
    // (and even won). The host action surfaces this "confirming" outcome.
    expect(result).toMatchObject({ status: "pending" });
  });

  it("does not infer a win from a readback when the exact event is unavailable", async () => {
    const { breaker } = setup([vault({ id: "1", status: "active" })], {
      attemptEvent: null,
    });
    await breaker.selectVault("1");
    breaker.attemptSecret.set("correct");

    const result = await breaker.attemptBreak();

    // A readback alone is not enough: without the exact AttemptMade event the
    // signer/attempt/result tuple is still unproven.
    expect(result).toMatchObject({ status: "pending" });
  });

  it("reports the explicit failure when AttemptMade fires with success=false", async () => {
    const { breaker, invokes } = setup([vault({ id: "1", status: "active" })], {
      attemptEvent: {
        state: [
          { value: "1" },
          { value: ME_HASH },
          { value: false },
          { value: "1" },
        ],
      },
    });
    await breaker.selectVault("1");
    breaker.attemptSecret.set("wrong");

    const result = await breaker.attemptBreak();

    // The definitive wrong-secret failure has NO confirming flag.
    expect(result).toMatchObject({ status: "confirmed", broken: false });
    expect(invokes.find((call) => call.operation === "attemptBreak")?.args[1]?.value)
      .toBe(ME_HASH);
  });

  it("aborts before payment when the selected target changes during wallet connection", async () => {
    const { breaker, chain, invokes } = setup([
      vault({ id: "1", status: "active" }),
      vault({ id: "2", status: "active" }),
    ]);
    await breaker.selectVault("1");
    breaker.attemptSecret.set("guess");
    chain.ensureWallet.mockImplementationOnce(async () => {
      breaker.vaultIdInput.set("2");
      return ME;
    });

    await expect(breaker.attemptBreak()).rejects.toThrow("operationContextChanged");
    expect(invokes).toHaveLength(0);
  });
});

describe("useVaultCreator.createVault", () => {
  it("rejects a non-SHA-256 supplied digest before opening the wallet", async () => {
    const { creator, chain } = setup([]);

    await expect(creator.createVault({
      bounty: "1",
      title: "Cipher",
      description: "Hint",
      difficulty: 1,
      secret: "",
      secretHash: "abcd",
    }, () => {}, async () => {})).rejects.toThrow("invalidSecretHash");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
  });

  it("normalizes the wallet address to the contract Hash160 argument", async () => {
    const { creator, invokes } = setup([]);

    await creator.createVault({
      bounty: "1",
      title: "Cipher",
      description: "Hint",
      difficulty: 1,
      secret: "open sesame",
      secretHash: "",
    }, vi.fn(), vi.fn(async () => undefined));

    expect(invokes.find((call) => call.operation === "createVault")?.args[0]?.value)
      .toBe(ME_HASH);
  });

  it("rejects malformed pause or catalog state before requesting a transaction", async () => {
    const create = {
      bounty: "1",
      title: "Cipher",
      description: "Hint",
      difficulty: 1,
      secret: "open sesame",
      secretHash: "",
    };
    const pausedSetup = setup([]);
    pausedSetup.chain.read.mockResolvedValueOnce("unknown");
    await expect(pausedSetup.creator.createVault(
      create,
      vi.fn(),
      vi.fn(async () => undefined),
    )).rejects.toThrow("chainContextMismatch");
    expect(pausedSetup.invokes).toHaveLength(0);

    const totalSetup = setup([]);
    totalSetup.chain.read
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce("not-a-count");
    await expect(totalSetup.creator.createVault(
      create,
      vi.fn(),
      vi.fn(async () => undefined),
    )).rejects.toThrow("catalogReadFailed");
    expect(totalSetup.invokes).toHaveLength(0);
  });
});

describe("useVaultCreator.increaseBounty", () => {
  it("deposits then calls increaseBounty(vaultId, amount) with the create memo", async () => {
    const { creator, invokes } = setup([vault({ id: "5", status: "active" })]);

    const result = await creator.increaseBounty("5", "2");

    expect(result).toMatchObject({ status: "confirmed", finalization: { vaultId: "5" } });
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

describe("useVaultBreaker.settleVault", () => {
  it("confirms reclaim only from the exact VaultExpired event and owner-bound readback", async () => {
    const { breaker, directInvokes } = setup([
      vault({ id: "9", status: "claimable", bounty: 500_000_000 }),
    ]);
    await breaker.selectVault("9");

    const result = await breaker.settleVault();

    expect(result).toMatchObject({
      status: "confirmed",
      finalization: { vaultId: "9" },
    });
    expect(directInvokes).toHaveLength(1);
    expect(directInvokes[0]).toMatchObject({
      operation: "claimExpiredVault",
      args: [{ type: "Integer", value: "9" }],
      options: {
        scriptHash: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
        waitForEvent: "VaultExpired",
      },
    });
  });
});
