import { describe, expect, it, vi } from "vitest";

import { useGasBox } from "../../gasbox/src/composables/useGasBox";
import type { Machine } from "../../gasbox/src/types";
import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { DepositConfirmedActionFailedError } from "../composables/useContractInteraction";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CREATOR = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0xeb635b6e75b01c12cc26794b906d329531f378e9";

const PLAYER_HASH = addressToScriptHash(PLAYER);
const CREATOR_HASH = addressToScriptHash(CREATOR);
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const PLAY_MEMO = "miniapp-gasbox:play";
const POOL_MEMO_PREFIX = "miniapp-gasbox-pool:";

function t(key: string) {
  const messages: Record<string, string> = {
    inventoryUnavailable: "Machine inventory unavailable",
    invalidPlayPrice: "Invalid play price",
    connectWallet: "Connect your wallet to continue.",
    machineNotFound: "Machine not found",
    unknownPrize: "Unknown Prize",
    createNameRequired: "Machine name is required.",
    createNeedsItem: "Add at least one prize item.",
    invalidWeight: "Each item needs a positive whole-number weight.",
    invalidAmount: "Each item needs a positive prize amount.",
    invalidNeoAmount: "NEO prizes must be positive whole numbers.",
    poolCannotCoverMaxPrize: "The prize pool cannot cover the largest prize.",
    publishing: "Publishing...",
    publishSuccess: "Machine created.",
    createPending: "Creation confirmation not available yet",
    playPrepaidNoPull: "Play credit prepaid but the pull didn't settle",
    tokenGas: "GAS",
    none: "None",
    yes: "Yes",
    no: "No",
    error: "Error",
  };
  return messages[key] ?? key;
}

/**
 * Build a `Pulled` event payload: Pulled(playId, machineId, player, itemIndex,
 * prizeAmount). The composable reads itemIndex from slot 3 and prizeAmount from
 * slot 4 (same shape the live contract emits).
 */
function pulledEvent(itemIndex: number, prizeAmount: string) {
  return {
    state: [
      { type: "Integer", value: "1" },
      { type: "Integer", value: "1" },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: String(itemIndex) },
      { type: "Integer", value: prizeAmount },
    ],
  };
}

/** A getMachine map matching the deployed MiniAppGasBox ABI. */
function machineMap(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 1,
    creator: CREATOR_HASH,
    name: "Aurora Capsule",
    prizeAsset: GAS_HASH,
    price: 10_000_000, // 0.1 GAS
    itemCount: 2,
    totalWeight: 100,
    maxPrize: 100_000_000, // 1 GAS
    poolBalance: 1_000_000_000, // 10 GAS — covers max prize
    revenue: 0,
    active: true,
    ...overrides,
  };
}

/** getItem maps for machine 1 (index -> {index,name,weight,amount}). */
function itemMap(index: number): Record<string, unknown> {
  const items: Record<number, Record<string, unknown>> = {
    0: { index: 0, name: "Legend Capsule", weight: 5, amount: 100_000_000 },
    1: { index: 1, name: "GAS Rebate", weight: 95, amount: 10_000_000 },
  };
  return items[index] ?? {};
}

/**
 * Minimal ChainService stand-in. Records invoke/read calls so tests can assert
 * the direct-contract prepay + pull + studio argument shapes. `read` resolves
 * getMachine / getItem / lastMachineId / playCreditOf against the maps above.
 */
function makeChain(
  opts: {
    playCredit?: string;
    pulledItemIndex?: number;
    pulledPrize?: string;
    pullFault?: string;
  } = {},
) {
  const runPull = (options?: { waitForEvent?: string }): TxResult => {
    if (opts.pullFault) throw new Error(opts.pullFault);
    const event =
      options?.waitForEvent === "Pulled"
        ? pulledEvent(opts.pulledItemIndex ?? 0, opts.pulledPrize ?? "100000000")
        : undefined;
    return { txid: "0xtx", event, success: true };
  };

  const invoke = vi.fn(
    async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      let event: unknown;
      if (op === "pull") return runPull(options);
      if (op === "createMachine" && options?.waitForEvent === "MachineCreated") {
        event = { state: [{ type: "Integer", value: "1" }] };
      }
      return { txid: "0xtx", event, success: true };
    },
  );

  // Mirrors ChainService.prepayAndInvoke: record the deposit transfer, then run
  // the follow-up op, wrapping a confirmed-deposit follow-up fault.
  const prepayAndInvoke = vi.fn(
    async (
      gasAmount: string,
      memo: string,
      operation: string,
      args: ContractArg[],
      options?: { waitForEvent?: string },
    ): Promise<TxResult> => {
      await invoke(
        "transfer",
        [
          { type: "Hash160", value: PLAYER_HASH },
          { type: "Hash160", value: CONTRACT },
          { type: "Integer", value: gasAmount },
          { type: "String", value: memo },
        ],
        { scriptHash: GAS_HASH },
      );
      try {
        if (operation === "pull") return runPull(options);
        return await invoke(operation, args, options);
      } catch (e) {
        throw new DepositConfirmedActionFailedError(operation, "0xtx", e);
      }
    },
  );

  const read = vi.fn(
    async (op: string, args?: ContractArg[]): Promise<unknown> => {
      if (op === "lastMachineId") return 1;
      if (op === "playCreditOf") return opts.playCredit ?? "0";
      if (op === "getMachine") return machineMap();
      if (op === "getItem") {
        const index = Number(args?.[1]?.value ?? 0);
        return itemMap(index);
      }
      return {};
    },
  );

  const readArray = vi.fn(async (): Promise<unknown[]> => []);

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    prepayAndInvoke,
    read,
    readArray,
  } as unknown as ChainService & {
    invoke: typeof invoke;
    prepayAndInvoke: typeof prepayAndInvoke;
    read: typeof read;
    readArray: typeof readArray;
  };
  return { chain, invoke, prepayAndInvoke, read };
}

function setup(opts: Parameters<typeof makeChain>[0] = {}) {
  const { chain, invoke, prepayAndInvoke, read } = makeChain(opts);
  const app = useGasBox({ chain, t });
  app.setAddress(PLAYER);
  return { app, chain, invoke, prepayAndInvoke, read };
}

/** Find a recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

function studioMachine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: "1",
    name: "Aurora Capsule",
    description: "",
    category: "",
    tags: "",
    tagsList: [],
    creator: CREATOR,
    creatorHash: CREATOR_HASH,
    owner: CREATOR,
    ownerHash: CREATOR_HASH,
    price: "0.1",
    priceRaw: 10_000_000,
    itemCount: 2,
    totalWeight: 100,
    availableWeight: 100,
    plays: 0,
    revenue: "0",
    revenueRaw: 0,
    sales: 0,
    salesVolume: "0",
    salesVolumeRaw: 0,
    createdAt: 1,
    lastPlayedAt: 0,
    active: true,
    listed: true,
    banned: false,
    locked: false,
    forSale: false,
    salePrice: "0",
    salePriceRaw: 0,
    inventoryReady: true,
    items: [],
    topPrize: "Legend Capsule",
    winRate: 5,
    prizeAsset: "GAS",
    poolBalance: "10",
    poolBalanceRaw: 1_000_000_000,
    maxPrize: "1",
    maxPrizeRaw: 100_000_000,
    poolReady: true,
    ...overrides,
  };
}

describe("useGasBox (direct MiniAppGasBox contract)", () => {
  it("loads the machine catalog from getMachine (1..lastMachineId) and getItem", async () => {
    const { app, read } = setup();

    await app.loadAll();

    const machines = app.machines.get();
    expect(machines).toHaveLength(1);
    expect(machines[0].id).toBe("1");
    expect(machines[0].name).toBe("Aurora Capsule");
    expect(machines[0].prizeAsset).toBe("GAS");
    expect(machines[0].priceRaw).toBe(10_000_000);
    expect(machines[0].active).toBe(true);
    // Pool covers max prize ⇒ inventory ready.
    expect(machines[0].inventoryReady).toBe(true);
    expect(machines[0].items).toHaveLength(2);
    expect(machines[0].items[0].name).toBe("Legend Capsule");

    // The catalog came from getMachine, NOT an os.storage list.
    expect(read.mock.calls.some((c) => c[0] === "lastMachineId")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "getMachine")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "getItem")).toBe(true);
  });

  it("prepays play credit then pulls on-chain (via prepayAndInvoke, deposit confirmed first), reading the won item from the Pulled event", async () => {
    const { app, invoke, prepayAndInvoke } = setup({ playCredit: "0", pulledItemIndex: 0, pulledPrize: "100000000" });

    await app.loadAll();
    app.selectMachine(studioMachine({ items: app.machines.get()[0].items }));

    // A confirmed on-chain pull returns true so callers can advance per-user stats.
    const pulled = await app.playMachine();
    expect(pulled).toBe(true);

    // The deposit→pull happens through prepayAndInvoke, which waits for the
    // deposit to confirm before pull() test-invokes (no more deposit→pull race).
    expect(prepayAndInvoke).toHaveBeenCalledTimes(1);
    const [gasAmount, memo, op, pullArgs, pullOpts] = prepayAndInvoke.mock.calls[0];
    expect(gasAmount).toBe("10000000"); // 0.1 GAS base units
    expect(memo).toBe(PLAY_MEMO);
    expect(op).toBe("pull");
    expect(pullArgs).toEqual([
      { type: "Integer", value: "1" },
      { type: "Hash160", value: PLAYER_HASH },
    ]);
    expect(pullOpts).toMatchObject({ waitForEvent: "Pulled" });

    // The deposit transfer carries the play memo in base units.
    const prepay = callFor(invoke, "transfer");
    expect(prepay).toBeTruthy();
    expect(prepay![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "10000000" },
      { type: "String", value: PLAY_MEMO },
    ]);

    // The won item came from the Pulled event (itemIndex 0) + getItem amount.
    const result = app.resultItem.get();
    expect(result).toBeTruthy();
    expect(result!.name).toBe("Legend Capsule");
    // Displayed payout reflects the on-chain prizeAmount (1 GAS).
    expect(result!.amountDisplay).toContain("1");
    expect(app.showResult.get()).toBe(true);
  });

  it("reuses existing play credit (no prepayAndInvoke) when it already covers the price", async () => {
    const { app, prepayAndInvoke, invoke } = setup({ playCredit: "10000000", pulledItemIndex: 1, pulledPrize: "10000000" });

    await app.loadAll();
    app.selectMachine(studioMachine({ items: app.machines.get()[0].items }));
    await app.playMachine();

    expect(prepayAndInvoke).not.toHaveBeenCalled();
    expect(callFor(invoke, "pull")).toBeTruthy();
  });

  it("notes the prepaid credit as reusable when the pull reverts after a confirmed deposit", async () => {
    const { app, prepayAndInvoke } = setup({ playCredit: "0", pullFault: "insufficient prepaid gas" });

    await app.loadAll();
    app.selectMachine(studioMachine({ items: app.machines.get()[0].items }));

    await expect(app.playMachine()).rejects.toThrow("Play credit prepaid but the pull didn't settle");
    expect(prepayAndInvoke).toHaveBeenCalledTimes(1);
    expect(app.showResult.get()).toBe(false);
  });

  it("skips the prepay transfer when existing play credit already covers the price", async () => {
    const { app, invoke } = setup({ playCredit: "10000000", pulledItemIndex: 1, pulledPrize: "10000000" });

    await app.loadAll();
    app.selectMachine(studioMachine({ items: app.machines.get()[0].items }));

    await app.playMachine();

    // No top-up transfer — credit already covers the 0.1 GAS price.
    expect(callFor(invoke, "transfer")).toBeUndefined();
    // The pull still runs.
    expect(callFor(invoke, "pull")).toBeTruthy();
    expect(app.resultItem.get()?.name).toBe("GAS Rebate");
  });

  it("blocks a pull on an inactive / under-funded machine before any chain call", async () => {
    const { app, invoke } = setup();

    app.selectMachine(studioMachine({ active: false, inventoryReady: false }));

    await expect(app.playMachine()).rejects.toThrow("Machine inventory unavailable");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("publishes a GAS machine via createMachine + addItem + pool fund + setActive", async () => {
    const { app, invoke } = setup();
    const setStatus = vi.fn();

    const ok = await app.publishMachine(
      {
        name: "Aurora Capsule",
        price: "0.1",
        prizeAsset: "GAS",
        items: [
          { name: "Legend Capsule", weight: "5", amount: "1" },
          { name: "GAS Rebate", weight: "95", amount: "0.1" },
        ],
      },
      setStatus,
    );

    expect(ok).toBe(true);

    // createMachine(creator, name, prizeAsset GAS, price base units).
    const create = callFor(invoke, "createMachine");
    expect(create![1]).toEqual([
      { type: "Hash160", value: CREATOR_HASH },
      { type: "String", value: "Aurora Capsule" },
      { type: "Hash160", value: GAS_HASH },
      { type: "Integer", value: "10000000" },
    ]);

    // addItem for each item, weight as a plain integer, amount as GAS base units.
    const addItems = invoke.mock.calls.filter((c) => c[0] === "addItem");
    expect(addItems).toHaveLength(2);
    expect(addItems[0][1]).toEqual([
      { type: "Hash160", value: CREATOR_HASH },
      { type: "Integer", value: "1" },
      { type: "String", value: "Legend Capsule" },
      { type: "Integer", value: "5" }, // weight is NOT scaled
      { type: "Integer", value: "100000000" }, // 1 GAS prize
    ]);
    expect(addItems[1][1]).toContainEqual({ type: "Integer", value: "95" });
    expect(addItems[1][1]).toContainEqual({ type: "Integer", value: "10000000" }); // 0.1 GAS

    // FUND POOL — transfer of the max prize (1 GAS) with the pool memo.
    const fund = invoke.mock.calls.find(
      (c) => c[0] === "transfer" && String((c[1] as ContractArg[])[3]?.value).startsWith(POOL_MEMO_PREFIX),
    );
    expect(fund).toBeTruthy();
    expect(fund![1]).toEqual([
      { type: "Hash160", value: CREATOR_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "100000000" }, // max prize = 1 GAS
      { type: "String", value: `${POOL_MEMO_PREFIX}1` },
    ]);
    expect(fund![2]).toMatchObject({ scriptHash: GAS_HASH });

    // setActive(creator, machineId, true).
    const activate = callFor(invoke, "setActive");
    expect(activate![1]).toEqual([
      { type: "Hash160", value: CREATOR_HASH },
      { type: "Integer", value: "1" },
      { type: "Boolean", value: true },
    ]);

    // Ordering: create -> addItem -> fund -> setActive.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("createMachine")).toBeLessThan(order.indexOf("addItem"));
    expect(order.lastIndexOf("addItem")).toBeLessThan(order.indexOf("setActive"));
  });

  it("publishes a NEO machine funding the pool on the NEO token with integer amounts", async () => {
    const { app, invoke } = setup();

    await app.publishMachine(
      {
        name: "NEO Box",
        price: "0.5",
        prizeAsset: "NEO",
        items: [{ name: "One NEO", weight: "10", amount: "1" }],
      },
      vi.fn(),
    );

    // Play price is ALWAYS GAS (0.5 GAS = 50_000_000 base units).
    const create = callFor(invoke, "createMachine");
    expect(create![1][2]).toEqual({ type: "Hash160", value: NEO_HASH }); // prize asset is NEO
    expect(create![1][3]).toEqual({ type: "Integer", value: "50000000" }); // GAS price

    // NEO prize amount is the integer token count (no 1e8 scaling).
    const addItem = callFor(invoke, "addItem");
    expect(addItem![1]).toContainEqual({ type: "Integer", value: "1" });

    // Pool funded on the NEO token, integer amount.
    const fund = invoke.mock.calls.find(
      (c) => c[0] === "transfer" && String((c[1] as ContractArg[])[3]?.value).startsWith(POOL_MEMO_PREFIX),
    );
    expect(fund![1]).toContainEqual({ type: "Integer", value: "1" });
    expect(fund![2]).toMatchObject({ scriptHash: NEO_HASH });
  });

  it("rejects fractional NEO prizes before any chain call", async () => {
    const { app, invoke } = setup();

    await expect(
      app.publishMachine(
        {
          name: "Frac NEO",
          price: "0.1",
          prizeAsset: "NEO",
          items: [{ name: "Half NEO", weight: "10", amount: "1.5" }],
        },
        vi.fn(),
      ),
    ).rejects.toThrow("NEO prizes must be positive whole numbers.");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a non-positive weight before any chain call", async () => {
    const { app, invoke } = setup();

    await expect(
      app.publishMachine(
        {
          name: "Zero weight",
          price: "0.1",
          prizeAsset: "GAS",
          items: [{ name: "Bad", weight: "0", amount: "0.1" }],
        },
        vi.fn(),
      ),
    ).rejects.toThrow("Each item needs a positive whole-number weight.");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces a clean pool-coverage error when setActive reverts", async () => {
    const { app, invoke } = setup();
    invoke.mockImplementation(async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }) => {
      if (op === "setActive") throw new Error("pool cannot cover max prize");
      if (op === "createMachine" && options?.waitForEvent === "MachineCreated") {
        return { txid: "0xtx", event: { state: [{ type: "Integer", value: "1" }] }, success: true };
      }
      return { txid: "0xtx", success: true };
    });

    await expect(
      app.publishMachine(
        {
          name: "Thin pool",
          price: "0.1",
          prizeAsset: "GAS",
          items: [{ name: "Big", weight: "10", amount: "5" }],
        },
        vi.fn(),
      ),
    ).rejects.toThrow("The prize pool cannot cover the largest prize.");
  });

  it("guards against double pull submissions", async () => {
    // Existing credit covers the price, so the pull runs through invoke('pull')
    // directly (no prepayAndInvoke) — the cleanest path to count the dispatch.
    const { app, invoke } = setup({ playCredit: "10000000" });
    await app.loadAll();
    app.selectMachine(studioMachine({ items: app.machines.get()[0].items }));

    const first = app.playMachine();
    // Second call while the first is in flight must be a no-op that returns false
    // (so the caller does NOT double-count the per-user pull).
    const second = await app.playMachine();
    expect(second).toBe(false);
    await first;

    // Only one pull was dispatched.
    expect(invoke.mock.calls.filter((c) => c[0] === "pull")).toHaveLength(1);
  });

  it("tops up a machine's prize pool with a pool-memo transfer on the prize asset", async () => {
    const { app, invoke } = setup();
    await app.loadAll();

    await app.topUpPool("1", "0.5"); // 0.5 GAS

    const fund = invoke.mock.calls.find(
      (c) => c[0] === "transfer" && String((c[1] as ContractArg[])[3]?.value).startsWith(POOL_MEMO_PREFIX),
    );
    expect(fund).toBeTruthy();
    expect(fund![1]).toEqual([
      { type: "Hash160", value: CREATOR_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "50000000" }, // 0.5 GAS base units
      { type: "String", value: `${POOL_MEMO_PREFIX}1` },
    ]);
    expect(fund![2]).toMatchObject({ scriptHash: GAS_HASH });
  });

  it("rejects a non-positive pool top-up before any chain call", async () => {
    const { app, invoke } = setup();
    await app.loadAll();
    await expect(app.topUpPool("1", "0")).rejects.toThrow("Each item needs a positive prize amount.");
    expect(invoke).not.toHaveBeenCalledWith("transfer", expect.anything(), expect.anything());
  });

  it("activates and deactivates a machine via setActive(creator, id, active)", async () => {
    const { app, invoke } = setup();
    await app.loadAll();

    await app.setMachineActive("1", true);
    let activate = callFor(invoke, "setActive");
    expect(activate![1]).toEqual([
      { type: "Hash160", value: CREATOR_HASH },
      { type: "Integer", value: "1" },
      { type: "Boolean", value: true },
    ]);

    invoke.mockClear();
    await app.setMachineActive("1", false);
    activate = callFor(invoke, "setActive");
    expect(activate![1]).toContainEqual({ type: "Boolean", value: false });
  });

  it("rewords an activation fault as a pool-coverage error", async () => {
    const { app, invoke } = setup();
    await app.loadAll();
    invoke.mockImplementation(async (op: string) => {
      if (op === "setActive") throw new Error("pool cannot cover max prize");
      return { txid: "0xtx", success: true };
    });
    await expect(app.setMachineActive("1", true)).rejects.toThrow(
      "The prize pool cannot cover the largest prize.",
    );
  });

  it("surfaces the player's prepaid play credit after loadAll", async () => {
    const { app } = setup({ playCredit: "150000000" }); // 1.5 GAS

    await app.loadAll();

    expect(app.playCreditBase.get()).toBe(150000000n);
    expect(app.hasPlayCredit.get()).toBe(true);
    expect(app.formattedPlayCredit.get()).toContain("1.5");
  });
});
