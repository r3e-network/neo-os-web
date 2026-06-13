import { describe, expect, it, vi } from "vitest";
import { useLastSurvivor } from "./useLastSurvivor";
import type { UseLastSurvivorOptions } from "./useLastSurvivor";
import type { ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x8e1e432e1be276b03ecd7de82ea985dcc7435cec";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const BUY_MEMO = "miniapp-lastsurvivor:buy";

const t = (key: string, params?: Record<string, string | number>) => {
  const messages: Record<string, string> = {
    invalidKeyCount: "Invalid key count",
    maxKeyCountExceeded: "Maximum 1000 keys per transaction",
    walletNotConnected: "Connect your wallet to play",
    missingContract: "Contract not configured",
    settleBeforeBuy: "Settle the round first",
    keyPurchaseDepositHeld: "Deposit held — try again",
    noCredit: "No prepaid credit to withdraw",
    roundStateUnavailable: "Round state unavailable",
    notAvailable: "N/A",
    tokenGas: "GAS",
  };
  let out = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  return out;
};

/** A live current round: active, with one key already sold and a running clock. */
function liveRound(overrides: Record<string, unknown> = {}) {
  return {
    roundId: "1",
    pot: "20000000", // 0.2 GAS in base units
    totalKeys: "1",
    lastBuyer: PLAYER_HASH,
    endTime: String(Date.now() + 3600_000),
    settled: false,
    active: true,
    remainingTime: "3600",
    ...overrides,
  };
}

/** A KeysBought event (the buy waits for it). */
function keysBoughtEvent() {
  return { state: [{ type: "Integer", value: "1" }, { type: "Hash160", value: PLAYER_HASH }] };
}

/** A CreditWithdrawn(account, amount) event — amount at state slot 1. */
function creditWithdrawnEvent(amountBase: string) {
  return {
    state: [
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: amountBase },
    ],
  };
}

function makeChain(
  opts: {
    credit?: string;
    currentKeyCost?: string;
    round?: Record<string, unknown>;
    buyThrows?: boolean;
    buyError?: string;
    withdrawAmount?: string;
  } = {},
) {
  const round = opts.round ?? liveRound();
  const cost = opts.currentKeyCost ?? "10000000"; // 0.1 GAS

  const invoke = vi.fn(
    async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      if (op === "buyKeys") {
        if (opts.buyThrows) throw new Error(opts.buyError ?? "buy reverted");
        return {
          txid: "0xbuy",
          event: options?.waitForEvent === "KeysBought" ? keysBoughtEvent() : undefined,
          success: true,
        };
      }
      if (op === "withdraw") {
        return {
          txid: "0xwithdraw",
          event:
            options?.waitForEvent === "CreditWithdrawn"
              ? creditWithdrawnEvent(opts.withdrawAmount ?? opts.credit ?? "0")
              : undefined,
          success: true,
        };
      }
      // transfer (deposit) etc.
      return { txid: "0xtransfer", success: true };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    if (op === "getCurrentRound") return round;
    if (op === "creditOf") return opts.credit ?? "0";
    if (op === "currentKeyCost") return cost;
    if (op === "playerKeys") return "1";
    return {};
  });

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
  } as unknown as UseLastSurvivorOptions["chain"];

  return { chain, invoke, read };
}

function setup(opts: Parameters<typeof makeChain>[0] = {}) {
  const deps = makeChain(opts);
  const game = useLastSurvivor({ chain: deps.chain, t });
  game.setAddress(PLAYER);
  return { game, ...deps };
}

function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useLastSurvivor (direct MiniAppLastSurvivor contract)", () => {
  it("deposits only the shortfall and waits for the Credited event before buyKeys", async () => {
    // creditOf < cost: a deposit must precede the buy, confirmed via Credited.
    const { game, invoke } = setup({ credit: "0", currentKeyCost: "10000000" });
    await game.loadAll();

    await game.buyKeys("1");

    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    // Shortfall = cost - credit = 0.1 GAS, memo + GAS hash.
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "10000000" },
      { type: "String", value: BUY_MEMO },
    ]);
    // The deposit MUST wait for the contract's Credited event (race fix).
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH, waitForEvent: "Credited" });

    const buy = callFor(invoke, "buyKeys");
    expect(buy).toBeTruthy();
    expect(buy![2]).toMatchObject({ waitForEvent: "KeysBought" });

    // Deposit ordered before the consuming buy.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("buyKeys"));
  });

  it("nets an existing credit against the cost, depositing only the remainder", async () => {
    // Half the cost is already prepaid; only the remaining 0.06 GAS is deposited.
    const { game, invoke } = setup({ credit: "4000000", currentKeyCost: "10000000" });
    await game.loadAll();
    await game.buyKeys("1");

    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1][2]).toEqual({ type: "Integer", value: "6000000" });
  });

  it("skips the deposit entirely when existing credit already covers the cost", async () => {
    const { game, invoke } = setup({ credit: "10000000", currentKeyCost: "10000000" });
    await game.loadAll();
    await game.buyKeys("1");

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "buyKeys")).toBeTruthy();
  });

  it("loads the connected wallet's prepaid credit into prepaidCredit / hasCredit", async () => {
    const { game } = setup({ credit: "25000000" }); // 0.25 GAS
    await game.loadAll();

    expect(game.prepaidCredit.get()).toBeCloseTo(0.25, 8);
    expect(game.hasCredit.get()).toBe(true);
  });

  it("withdraws the unused prepaid credit, reading the amount from CreditWithdrawn", async () => {
    const { game, invoke } = setup({ credit: "25000000", withdrawAmount: "25000000" });
    await game.loadAll();

    const { amount } = await game.withdrawCredit();
    expect(amount).toBeCloseTo(0.25, 8);

    const withdraw = callFor(invoke, "withdraw");
    expect(withdraw).toBeTruthy();
    expect(withdraw![1]).toEqual([{ type: "Hash160", value: PLAYER_HASH }]);
    expect(withdraw![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
  });

  it("refuses a withdraw when there is no prepaid credit (clean message, no invoke)", async () => {
    const { game, invoke } = setup({ credit: "0" });
    await game.loadAll();

    await expect(game.withdrawCredit()).rejects.toThrow("No prepaid credit to withdraw");
    expect(callFor(invoke, "withdraw")).toBeUndefined();
  });

  it("surfaces the settle requirement when buyKeys faults on an ended round", async () => {
    const { game } = setup({
      credit: "10000000",
      buyThrows: true,
      buyError: "round ended; settle first",
    });
    await game.loadAll();

    await expect(game.buyKeys("1")).rejects.toThrow("Settle the round first");
  });
});
