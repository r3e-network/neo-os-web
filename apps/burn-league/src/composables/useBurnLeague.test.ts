import { describe, expect, it, vi } from "vitest";
import { useBurnLeague } from "./useBurnLeague";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x21a527b50b839efeb73721a886c9b5994a206316";
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
    burnBusy: "Burn busy",
    burnPendingBlocksNew: "Resolve pending burn",
    burnDepositUnknown: "Deposit pending",
    burnTransactionUnknown: "Burn pending",
    burnDepositReady: "Deposit ready",
    burnRecoveryUnavailable: "Recovery unavailable",
    burnBalanceUnavailable: "Balance unavailable",
    burnInsufficientBalance: "Not enough GAS: need {required}, have {available}",
    settleTransactionUnknown: "Settlement pending",
    withdrawTransactionUnknown: "Withdrawal pending",
    noCredit: "No prepaid credit to withdraw",
    seasonActive: "Live now",
    seasonEnded: "Ended",
    seasonDormant: "Not started",
    durationSeconds: "{count}s",
    durationMinutes: "{count} min",
    durationHours: "{count}h",
    durationDays: "{count}d",
    seasonDurationUnsafe: "Demo season {duration}; burns paused",
  };
  let out = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  return out;
};

/** CreditWithdrawn(account, amount) event — amount at state slot 1. */
function creditWithdrawnEvent(amountBase: string) {
  return {
    tx_hash: "0xwithdraw",
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
    walletBalance?: string;
    connected?: boolean;
    transferVerified?: boolean;
    burnVerified?: boolean;
    withdrawVerified?: boolean;
    transferThrows?: boolean;
    events?: Record<string, unknown[]>;
  } = {},
) {
  const connected = opts.connected !== false;
  let liveCredit = BigInt(opts.credit ?? "0");
  let liveUserBurned = 0n;
  const invoke = vi.fn(
    async (
      op: string,
      args: ContractArg[],
      options?: {
        waitForEvent?: string;
        onTransactionSent?: (txid: string) => void;
      },
    ): Promise<TxResult> => {
      if (op === "burn") {
        if (opts.burnThrows) throw new Error(opts.burnError ?? "burn reverted");
        options?.onTransactionSent?.("0xburn");
        const verified = opts.burnVerified !== false;
        const burned = BigInt(String(args[1]?.value ?? "0"));
        liveCredit -= burned;
        liveUserBurned += burned;
        return {
          txid: "0xburn",
          event: verified
            ? {
                tx_hash: "0xburn",
                state: ["1", PLAYER_HASH, args[1]?.value ?? "0", args[1]?.value ?? "0"],
              }
            : undefined,
          success: true,
          verified,
        };
      }
      if (op === "withdraw") {
        options?.onTransactionSent?.("0xwithdraw");
        const verified = opts.withdrawVerified !== false;
        liveCredit = 0n;
        return {
          txid: "0xwithdraw",
          event:
            verified && options?.waitForEvent === "CreditWithdrawn"
              ? creditWithdrawnEvent(opts.withdrawAmount ?? opts.credit ?? "0")
              : undefined,
          success: true,
          verified,
        };
      }
      if (opts.transferThrows) throw new Error("transfer failed");
      options?.onTransactionSent?.("0xtransfer");
      const verified = opts.transferVerified !== false;
      liveCredit += BigInt(String(args[2]?.value ?? "0"));
      return {
        txid: "0xtransfer",
        event: verified
          ? {
              tx_hash: "0xtransfer",
              state: [PLAYER_HASH, args[2]?.value ?? "0", args[2]?.value ?? "0"],
            }
          : undefined,
        success: true,
        verified,
      };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    if (op === "currentSeason") return opts.currentSeason ?? "1";
    if (op === "seasonEnd") return opts.seasonEnd ?? String(Date.now() + 3600_000);
    if (op === "rewardPool") return "500000000"; // 5 GAS
    if (op === "burnCount") return "3";
    if (op === "topBurner") return PLAYER_HASH;
    if (op === "topBurned") return "300000000";
    if (op === "seasonDuration") return opts.seasonDuration ?? "86400000"; // 24h
    if (op === "userBurned") return liveUserBurned.toString();
    if (op === "creditOf") return liveCredit.toString();
    if (op === "balanceOf") return opts.walletBalance ?? "100000000000";
    // minBurn/maxBurn default to {} (unreadable) so the composable falls back to
    // the contract literals unless a test supplies explicit bounds.
    if (op === "minBurn") return opts.minBurn ?? {};
    if (op === "maxBurn") return opts.maxBurn ?? {};
    return {};
  });

  const listEvents = vi.fn(async (eventName: string): Promise<unknown[]> =>
    opts.events?.[eventName] ?? [],
  );
  const listAllEvents = vi.fn(async (eventName: string): Promise<unknown[]> =>
    opts.events?.[eventName] ?? [],
  );

  let addressValue: string | null = connected ? PLAYER : null;
  const addressListeners = new Set<() => void>();

  const ensureWallet = vi.fn(async () => PLAYER);
  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: {
      get: () => addressValue,
      set: (next: string | null) => {
        addressValue = next;
        addressListeners.forEach((listener) => listener());
      },
      subscribe: (listener: () => void) => {
        addressListeners.add(listener);
        return () => addressListeners.delete(listener);
      },
    },
    ensureWallet,
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    invoke,
    read,
    listEvents,
    listAllEvents,
  } as unknown as ChainService;

  return { chain, invoke, read, listEvents, listAllEvents, ensureWallet };
}

function setup(opts: Parameters<typeof makeChain>[0] = {}) {
  const deps = makeChain(opts);
  const app = createMiniAppFramework(
    { services: { chain: deps.chain }, t } as never,
    { appId: "miniapp-burn-league" },
  );
  const burn = useBurnLeague({
    app,
    t,
    getAddress: () => opts.connected === false ? null : PLAYER,
  });
  burn.setAddress(opts.connected === false ? null : PLAYER);
  return { burn, app, ...deps };
}

function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useBurnLeague (direct MiniAppBurnLeague contract)", () => {
  it("deposits only the shortfall and waits for the Credited event before burn()", async () => {
    const { burn, invoke } = setup({ credit: "0" });
    await burn.loadAll();

    const result = await burn.burnTokens("5"); // 5 GAS = 500000000 base units
    expect(result).toMatchObject({ status: "confirmed", phase: "burn", txid: "0xburn" });

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
    expect(burn.leagueDataAvailable.get()).toBe(false);
    expect(burn.serviceNotice.get()).toContain("burns paused");
    await expect(burn.burnTokens("5")).rejects.toThrow("burns paused");
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

  it("blocks credit withdrawal while another irreversible league action is active", async () => {
    const { burn, invoke } = setup({ credit: "250000000" });
    await burn.loadAll();
    burn.isBurning.set(true);

    await expect(burn.withdrawCredit()).rejects.toThrow("Burn busy");
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

  it("never connects and burns in one call when the wallet is disconnected", async () => {
    const { burn, invoke, ensureWallet } = setup({ connected: false });

    await expect(burn.burnTokens("5")).rejects.toThrow("Connect your wallet");
    expect(ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects an unfunded burn before requesting any transaction signature", async () => {
    const { burn, invoke } = setup({ credit: "0", walletBalance: "499999999" });
    await burn.loadAll();

    await expect(burn.burnTokens("5")).rejects.toThrow("Not enough GAS");
    expect(invoke).not.toHaveBeenCalled();
    expect(burn.burnTransactionState.get()).toBe("failed");
  });

  it("stops after an unverified deposit and never submits burn()", async () => {
    const events: Record<string, unknown[]> = {};
    const { burn, invoke } = setup({
      credit: "0",
      transferVerified: false,
      events,
    });
    await burn.loadAll();

    const result = await burn.burnTokens("5");
    expect(result).toMatchObject({ status: "unknown", phase: "deposit", txid: "0xtransfer" });
    expect(callFor(invoke, "burn")).toBeUndefined();
    expect(burn.hasUnknownBurn.get()).toBe(true);
    expect(burn.pendingBurnTxid.get()).toBe("0xtransfer");
  });

  it("recovers a deposit only from the exact tx/player/amount and never auto-burns", async () => {
    const events: Record<string, unknown[]> = {};
    const { burn, invoke } = setup({
      credit: "0",
      transferVerified: false,
      events,
    });
    await burn.loadAll();
    await burn.burnTokens("5");

    events.Credited = [
      {
        tx_hash: "0xwrong",
        state: [PLAYER_HASH, "500000000", "500000000"],
      },
    ];
    await expect(burn.recheckPendingBurn()).resolves.toMatchObject({ status: "pending" });
    expect(burn.hasUnknownBurn.get()).toBe(true);

    events.Credited = [
      {
        tx_hash: "0xtransfer",
        state: [PLAYER_HASH, "500000000", "500000000"],
      },
    ];
    await expect(burn.recheckPendingBurn()).resolves.toMatchObject({
      status: "deposit-confirmed",
    });
    expect(burn.hasUnknownBurn.get()).toBe(false);
    expect(callFor(invoke, "burn")).toBeUndefined();
    expect(burn.actionNotice.get()).toBe("Deposit ready");
  });

  it("persists an unverified burn and clears it only after its exact Burned event", async () => {
    const events: Record<string, unknown[]> = {};
    const { burn, invoke } = setup({
      credit: "500000000",
      burnVerified: false,
      events,
    });
    await burn.loadAll();

    const submitted = await burn.burnTokens("5");
    expect(submitted).toMatchObject({ status: "unknown", phase: "burn", txid: "0xburn" });
    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(burn.hasUnknownBurn.get()).toBe(true);

    events.Burned = [
      {
        tx_hash: "0xburn",
        state: ["1", PLAYER_HASH, "500000000", "500000000"],
      },
    ];
    await expect(burn.restorePendingBurn()).resolves.toMatchObject({
      status: "burn-confirmed",
    });
    expect(burn.hasUnknownBurn.get()).toBe(false);
    expect(burn.burnTransactionState.get()).toBe("confirmed");
    await expect(burn.recheckPendingBurn()).resolves.toEqual({
      status: "none",
      operation: null,
    });
  });
});
