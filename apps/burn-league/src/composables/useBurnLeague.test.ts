import { describe, expect, it, vi } from "vitest";
import { useBurnLeague } from "./useBurnLeague";
import type { UseBurnLeagueOptions } from "./useBurnLeague";
import type { ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const BURN_MEMO = "miniapp-burnleague:burn";

const t = (key: string, params?: Record<string, string | number>) => {
  const messages: Record<string, string> = {
    tokenGas: "GAS",
    minBurn: "Minimum burn is {amount} {tokenGas}",
    maxBurn: "Maximum burn is {amount} {tokenGas}",
    missingContract: "Contract not configured",
    burnWalletUnavailable: "Connect your wallet",
    settleBeforeBurn: "Settle the season first",
    burnDepositHeld: "Deposit held — try again",
    burnActionUnavailable: "Burn unavailable",
    burnServiceUnavailable: "Service unavailable",
    burnPreparing: "Preparing {amount}",
    burnSubmitted: "Burn confirmed",
    noCredit: "No prepaid credit to withdraw",
    seasonActive: "Live now",
    seasonEnded: "Ended",
    seasonDormant: "Not started",
    durationSeconds: "{count}s",
    durationMinutes: "{count} min",
    durationHours: "{count}h",
    durationDays: "{count}d",
  };
  let out = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  return out;
};

/** CreditWithdrawn(account, amount) event — amount at state slot 1. */
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
    seasonDuration?: string;
    seasonEnd?: string;
    currentSeason?: string;
    burnThrows?: boolean;
    burnError?: string;
    withdrawAmount?: string;
    minBurn?: string;
    maxBurn?: string;
  } = {},
) {
  const invoke = vi.fn(
    async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      if (op === "burn") {
        if (opts.burnThrows) throw new Error(opts.burnError ?? "burn reverted");
        return { txid: "0xburn", event: { state: [] }, success: true };
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
      return { txid: "0xtransfer", success: true };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    if (op === "currentSeason") return opts.currentSeason ?? "1";
    if (op === "seasonEnd") return opts.seasonEnd ?? String(Date.now() + 3600_000);
    if (op === "rewardPool") return "500000000"; // 5 GAS
    if (op === "burnCount") return "3";
    if (op === "topBurner") return PLAYER_HASH;
    if (op === "topBurned") return "300000000";
    if (op === "seasonDuration") return opts.seasonDuration ?? "120000"; // 120s
    if (op === "userBurned") return "0";
    if (op === "creditOf") return opts.credit ?? "0";
    // minBurn/maxBurn default to {} (unreadable) so the composable falls back to
    // the contract literals unless a test supplies explicit bounds.
    if (op === "minBurn") return opts.minBurn ?? {};
    if (op === "maxBurn") return opts.maxBurn ?? {};
    return {};
  });

  const listEvents = vi.fn(async (): Promise<unknown[]> => []);

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
    listEvents,
  } as unknown as UseBurnLeagueOptions["chain"];

  return { chain, invoke, read };
}

function setup(opts: Parameters<typeof makeChain>[0] = {}) {
  const deps = makeChain(opts);
  const burn = useBurnLeague({ chain: deps.chain, t, getAddress: () => PLAYER });
  burn.setAddress(PLAYER);
  return { burn, ...deps };
}

function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useBurnLeague (direct MiniAppBurnLeague contract)", () => {
  it("deposits only the shortfall and waits for the Credited event before burn()", async () => {
    const { burn, invoke } = setup({ credit: "0" });
    await burn.loadAll();

    await burn.burnTokens("5"); // 5 GAS = 500000000 base units

    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "500000000" },
      { type: "String", value: BURN_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH, waitForEvent: "Credited" });

    const burnCall = callFor(invoke, "burn");
    expect(burnCall).toBeTruthy();
    expect(burnCall![2]).toMatchObject({ waitForEvent: "Burned" });

    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("burn"));
  });

  it("nets existing credit against the burn amount, depositing only the remainder", async () => {
    // 2 GAS prepaid; a 5 GAS burn deposits only the remaining 3 GAS.
    const { burn, invoke } = setup({ credit: "200000000" });
    await burn.loadAll();
    await burn.burnTokens("5");

    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1][2]).toEqual({ type: "Integer", value: "300000000" });
  });

  it("skips the deposit when existing credit already covers the burn", async () => {
    const { burn, invoke } = setup({ credit: "500000000" });
    await burn.loadAll();
    await burn.burnTokens("5");

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "burn")).toBeTruthy();
  });

  it("discloses the season length read from seasonDuration()", async () => {
    const { burn } = setup({ seasonDuration: "120000" });
    await burn.loadAll();
    expect(burn.seasonDurationMs.get()).toBe(120000);
    expect(burn.seasonDurationLabel.get()).toBe("2 min");
  });

  it("humanizes a multi-day season length", async () => {
    const { burn } = setup({ seasonDuration: String(7 * 24 * 3600 * 1000) });
    await burn.loadAll();
    expect(burn.seasonDurationLabel.get()).toBe("7d");
  });

  it("loads the connected wallet's prepaid credit into prepaidCredit / hasCredit", async () => {
    const { burn } = setup({ credit: "250000000" }); // 2.5 GAS
    await burn.loadAll();
    expect(burn.prepaidCredit.get()).toBeCloseTo(2.5, 8);
    expect(burn.hasCredit.get()).toBe(true);
  });

  it("withdraws the unused prepaid credit, reading the amount from CreditWithdrawn", async () => {
    const { burn, invoke } = setup({ credit: "250000000", withdrawAmount: "250000000" });
    await burn.loadAll();

    const { amount } = await burn.withdrawCredit();
    expect(amount).toBeCloseTo(2.5, 8);

    const withdraw = callFor(invoke, "withdraw");
    expect(withdraw).toBeTruthy();
    expect(withdraw![1]).toEqual([{ type: "Hash160", value: PLAYER_HASH }]);
    expect(withdraw![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
  });

  it("refuses a withdraw when there is no prepaid credit (clean message, no invoke)", async () => {
    const { burn, invoke } = setup({ credit: "0" });
    await burn.loadAll();

    await expect(burn.withdrawCredit()).rejects.toThrow("No prepaid credit to withdraw");
    expect(callFor(invoke, "withdraw")).toBeUndefined();
  });

  it("binds burn bounds to the on-chain minBurn()/maxBurn() reads and validates against them", async () => {
    // Contract reports a 2..50 GAS window (base units), differing from the
    // literal 1..1000 fallback.
    const { burn } = setup({ minBurn: "200000000", maxBurn: "5000000000" });
    await burn.loadAll();

    expect(burn.minBurnGas.get()).toBe(2);
    expect(burn.maxBurnGas.get()).toBe(50);
    // 1 GAS is below the live minimum, 60 above the live maximum, 10 is valid.
    expect(burn.validateBurnAmount("1")).toContain("Minimum burn is 2");
    expect(burn.validateBurnAmount("60")).toContain("Maximum burn is 50");
    expect(burn.validateBurnAmount("10")).toBeNull();
  });

  it("falls back to the contract literals when the bound reads are unavailable", async () => {
    // minBurn/maxBurn return {} (unreadable) → keep the 1..1000 literals.
    const { burn } = setup({ credit: "0" });
    await burn.loadAll();

    expect(burn.minBurnGas.get()).toBe(1);
    expect(burn.maxBurnGas.get()).toBe(1000);
    expect(burn.validateBurnAmount("0.5")).toContain("Minimum burn is 1");
    expect(burn.validateBurnAmount("1001")).toContain("Maximum burn is 1000");
    expect(burn.validateBurnAmount("500")).toBeNull();
  });
});
