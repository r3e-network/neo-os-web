import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EPOCH_DURATION_FALLBACK_MS,
  epochWindowPhase,
  useGovMerc,
  windowRevertKey,
} from "../../gov-merc/src/hooks/useGovMerc";
import { createMiniAppFramework, FrameworkPrepaidActionError } from "../react";
import { DepositConfirmedActionFailedError } from "../composables/useContractInteraction";
import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BOB = "NUuJw4C4XJFzxAvSZnFTfsNoWZytmQKXQP";
const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
const ALICE_HASH = addressToScriptHash(ALICE);
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const STAKE_MEMO = "govmerc:stake";
const BID_MEMO = "govmerc:bid";
const ZERO_HASH = "0x0000000000000000000000000000000000000000";
const ACTION_TXID = `0x${"a".repeat(64)}`;
const PAYMENT_TXID = `0x${"b".repeat(64)}`;

beforeEach(() => localStorage.clear());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    enterAmount: "Enter an amount",
    enterNeoAmount: "Enter a whole NEO amount",
    withdrawExceeds: "Amount exceeds your deposits",
    walletStatusIdle: "Wallet not connected",
    missingContract: "Contract not configured",
    settleNoBids: "No bids to settle for this epoch",
    minBid: `First bid must be at least ${params?.amount ?? ""} ${params?.tokenGas ?? ""}`,
    bidDepositHeld:
      "Your GAS was deposited as reusable bid credit. Raise the bid again or withdraw the credit.",
    biddingClosed: "Bidding for this epoch has closed",
    biddingClosedCreditHeld:
      "Bidding closed before your bid landed. Your GAS is held as reusable bid credit — withdraw it or bid in the next epoch.",
    epochNotEnded: "The bidding window is still open — settle after the deadline",
    noRewards: "No rewards to claim yet",
    noCredit: "No unused bid credit",
    tokenGas: "GAS",
    error: "Error",
  };
  let out = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  }
  return out;
}

/**
 * A BidPlaced event payload (epoch, bidder, totalBid). Bidder is a decoded
 * address string (N3Index decodes the Hash160 slot to an address); totalBid is
 * GAS base units.
 */
function bidEvent(epoch: number, bidder: string, totalBidBase: string): unknown {
  return {
    event_name: "BidPlaced",
    state: [
      { type: "Integer", value: String(epoch) },
      { type: "Hash160", value: bidder },
      { type: "Integer", value: totalBidBase },
    ],
  };
}

interface ChainOpts {
  /** totalStaked() read — WHOLE NEO (not base units). */
  totalStaked?: string;
  /** currentEpoch() read. */
  epoch?: number;
  /** stakeOf(user) read — WHOLE NEO. */
  stakeOf?: string;
  /** pendingRewards(user) read — GAS base units. */
  pendingRewards?: string;
  /** gasCreditOf(user) read — GAS base units. */
  gasCredit?: string;
  /** settlementWinner(epoch) reads, keyed by epoch. */
  settlementWinner?: Record<number, string>;
  /** settlementAmount(epoch) reads (GAS base units), keyed by epoch. */
  settlementAmount?: Record<number, string>;
  /** bidOf(epoch, user) reads (GAS base units), keyed by epoch. */
  bidOf?: Record<number, string>;
  /** BidPlaced events returned by listEvents. */
  bidEvents?: unknown[];
  /**
   * Force the consuming bid() call to throw. On the credit-covered lane the
   * raw error is thrown by invoke("bid"); on the funded lane the host
   * confirmed-deposit shape (DepositConfirmedActionFailedError) wraps it —
   * exactly what ChainService.invokeWithPayment throws when the deposit
   * was broadcast but the consuming call faulted.
   */
  bidThrows?: Error;
  /**
   * Settlement state the host lane observed for the deposit when bidThrows
   * fires ("confirmed" when omitted). The host wraps on ANY post-broadcast
   * settlement — "timeout"/"unreachable" only mean the deposit is unproven
   * by the indexer, not absent.
   */
  bidSettlement?: "confirmed" | "timeout" | "unreachable";
  /**
   * Force the funded lane's deposit leg to fail BEFORE the deposit confirms
   * (raw error — e.g. the wallet rejected the GAS transfer).
   */
  depositThrows?: Error;
  /** Force specific read operations to throw. */
  readThrows?: Record<string, Error>;
  /** epochDeadline(currentEpoch) read — ms timestamp (0 = window unopened). */
  epochDeadline?: string;
  /** epochDuration() read — bidding-window length in ms. */
  epochDuration?: string;
  /** Force the settleEpoch() invoke to throw. */
  settleThrows?: Error;
  /** highestBid(currentEpoch), GAS base units. Defaults to the event maximum. */
  highestBid?: string;
}

/**
 * Minimal ChainService stand-in. Records invoke/read/listEvents calls so tests
 * can assert the direct-contract stake (NEO integer) + bid (GAS base units) +
 * settle/claim/reclaim argument shapes and the leaderboard-from-events wiring. No
 * OS proxies are involved.
 */
function makeChain(opts: ChainOpts = {}) {
  let epochState = opts.epoch ?? 0;
  let stakeState = BigInt(opts.stakeOf ?? "0");
  let rewardsState = BigInt(opts.pendingRewards ?? "0");
  let creditState = BigInt(opts.gasCredit ?? "0");
  const bidState = new Map<number, bigint>(
    Object.entries(opts.bidOf ?? {}).map(([epoch, amount]) => [Number(epoch), BigInt(amount)]),
  );
  const eventHighest = (opts.bidEvents ?? [])
    .filter((event) => Number((event as { state: Array<{ value: string }> }).state[0]?.value) === epochState)
    .reduce((max, event) => {
      const amount = BigInt((event as { state: Array<{ value: string }> }).state[2]?.value ?? "0");
      return amount > max ? amount : max;
    }, 0n);
  let highestState = BigInt(opts.highestBid ?? eventHighest.toString());

  const invoke = vi.fn(
    async (op: string, args: ContractArg[], options?: {
      waitForEvent?: string;
      onTransactionSent?: (txid: string) => void;
    }): Promise<TxResult> => {
      let event: unknown;
      if (op === "bid") {
        if (opts.bidThrows) throw opts.bidThrows;
        const add = BigInt(String(args[1]?.value ?? "0"));
        const next = (bidState.get(epochState) ?? 0n) + add;
        bidState.set(epochState, next);
        creditState -= add;
        if (next > highestState) highestState = next;
        event = bidEvent(epochState, ALICE, next.toString());
      }
      if (op === "settleEpoch") {
        if (opts.settleThrows) throw opts.settleThrows;
        const settledEpoch = epochState;
        event = { state: [
          { type: "Integer", value: String(settledEpoch) },
          { type: "Hash160", value: BOB },
          { type: "Integer", value: highestState.toString() },
          { type: "Integer", value: highestState.toString() },
        ] };
        epochState += 1;
        highestState = 0n;
      }
      if (op === "transfer") {
        const amount = BigInt(String(args[2]?.value ?? "0"));
        stakeState += amount;
        event = { state: [
          { type: "Hash160", value: ALICE },
          { type: "Integer", value: amount.toString() },
          { type: "Integer", value: stakeState.toString() },
        ] };
      }
      if (op === "withdrawStake") {
        const amount = BigInt(String(args[1]?.value ?? "0"));
        stakeState -= amount;
        event = { state: [
          { type: "Hash160", value: ALICE },
          { type: "Integer", value: amount.toString() },
          { type: "Integer", value: stakeState.toString() },
        ] };
      }
      if (op === "claimRewards") {
        const amount = rewardsState;
        rewardsState = 0n;
        event = { state: [
          { type: "Hash160", value: ALICE },
          { type: "Integer", value: amount.toString() },
        ] };
      }
      if (op === "reclaimBid") {
        const targetEpoch = Number(args[1]?.value ?? 0);
        const amount = bidState.get(targetEpoch) ?? 0n;
        bidState.set(targetEpoch, 0n);
        event = { state: [
          { type: "Integer", value: String(targetEpoch) },
          { type: "Hash160", value: ALICE },
          { type: "Integer", value: amount.toString() },
        ] };
      }
      if (op === "withdraw") {
        const amount = creditState;
        creditState = 0n;
        event = { state: [
          { type: "Hash160", value: ALICE },
          { type: "Integer", value: amount.toString() },
        ] };
      }
      options?.onTransactionSent?.(ACTION_TXID);
      return { txid: ACTION_TXID, event, success: true, verified: Boolean(event) };
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    if (opts.readThrows?.[op]) throw opts.readThrows[op];
    const epochArg = args && args[0] ? Number(args[0].value) : undefined;
    switch (op) {
      case "totalStaked": return opts.totalStaked ?? "0";
      case "currentEpoch": return String(epochState);
      case "stakeOf": return stakeState.toString();
      case "pendingRewards": return rewardsState.toString();
      case "gasCreditOf": return creditState.toString();
      case "highestBid": return highestState.toString();
      case "settlementWinner":
        return (epochArg !== undefined && opts.settlementWinner?.[epochArg]) || ZERO_HASH;
      case "settlementAmount":
        return (epochArg !== undefined && opts.settlementAmount?.[epochArg]) || "0";
      case "bidOf":
        return (epochArg !== undefined ? bidState.get(epochArg)?.toString() : undefined) ?? "0";
      case "epochDeadline": return opts.epochDeadline ?? "0";
      case "epochDuration": return opts.epochDuration ?? "300000";
      default: return "0";
    }
  });

  const listEvents = vi.fn(async (): Promise<unknown[]> => opts.bidEvents ?? []);

  /**
   * Mirror of ChainService.invokeWithPayment — the confirmed-deposit lane
   * app.funds.payAndCall reaches: GAS transfer with the memo, deposit
   * confirmed in a block, then the consuming call. A consuming-call fault
   * after the confirmed deposit surfaces as DepositConfirmedActionFailedError
   * (the framework re-wraps it as the identity-stable
   * FrameworkPrepaidActionError the hook branches on).
   */
  const invokeWithPayment = vi.fn(
    async (
      _amount: string,
      _memo: string,
      op: string,
      _args: ContractArg[],
      options?: {
        waitForEvent?: string;
        onPaymentSent?: (txid: string) => void;
        onTransactionSent?: (txid: string) => void;
      },
    ): Promise<TxResult> => {
      let event: unknown;
      if (op === "bid") {
        if (opts.depositThrows) throw opts.depositThrows;
        creditState += BigInt(_amount);
        options?.onPaymentSent?.(PAYMENT_TXID);
        if (opts.bidThrows) {
          throw new DepositConfirmedActionFailedError(
            "bid",
            PAYMENT_TXID,
            opts.bidThrows,
            opts.bidSettlement ?? "confirmed",
          );
        }
        const add = BigInt(String(_args[1]?.value ?? "0"));
        const next = (bidState.get(epochState) ?? 0n) + add;
        bidState.set(epochState, next);
        creditState -= add;
        if (next > highestState) highestState = next;
        event = bidEvent(epochState, ALICE, next.toString());
      }
      options?.onTransactionSent?.(ACTION_TXID);
      return { txid: ACTION_TXID, event, success: true, verified: Boolean(event) };
    },
  );

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
    invoke,
    invokeWithPayment,
    read,
    listEvents,
  } as unknown as ChainService & {
    invoke: typeof invoke;
    invokeWithPayment: typeof invokeWithPayment;
    read: typeof read;
    listEvents: typeof listEvents;
  };
  return { chain, invoke, invokeWithPayment, read, listEvents };
}

function setup(opts: ChainOpts = {}) {
  const { chain, invoke, invokeWithPayment, read, listEvents } = makeChain(opts);
  // Wrap the mock chain in the MiniApp framework the hook now takes; arg builders
  // + passthroughs produce identical invoke/read/listEvents calls.
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-gov-merc" },
  );
  const app = useGovMerc({ app: framework, t });
  app.setAddress(ALICE);
  return { app, chain, invoke, invokeWithPayment, read, listEvents };
}

/** Find a recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useGovMerc — on-chain reads (NEO integer vs GAS base units)", () => {
  it("keeps expected local missing-contract reads quiet but still warns on unexpected read failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const missing = setup({
        readThrows: {
          totalStaked: new Error("Contract address not configured"),
        },
      });
      await missing.app.loadData();
      expect(warn).not.toHaveBeenCalled();
      expect(missing.app.marketAvailable.get()).toBe(false);
      expect(missing.app.readError.get()).toBe("loadFailed");

      const unexpected = setup({
        readThrows: {
          totalStaked: new Error("RPC node unavailable"),
        },
      });
      await unexpected.app.loadData();
      expect(unexpected.app.marketAvailable.get()).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        "[useGovMerc] loadData failed:",
        "RPC node unavailable",
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("marks a failed highest-bid read unavailable instead of presenting a real zero", async () => {
    const { app } = setup({
      epoch: 3,
      readThrows: { highestBid: new Error("RPC node unavailable") },
    });
    await app.loadData();
    expect(app.marketAvailable.get()).toBe(true);
    expect(app.highestBidAvailable.get()).toBe(false);
  });

  it("invalidates every dependent availability flag when the core market refresh fails", async () => {
    const { app, read } = setup({ epoch: 3, highestBid: "200000000" });
    await app.loadData();
    expect(app.windowAvailable.get()).toBe(true);
    expect(app.highestBidAvailable.get()).toBe(true);
    expect(app.walletAvailable.get()).toBe(true);
    expect(app.bidsAvailable.get()).toBe(true);

    const originalRead = read.getMockImplementation()!;
    read.mockImplementation(async (operation, args) => {
      if (operation === "totalStaked") throw new Error("RPC unavailable");
      return originalRead(operation, args);
    });
    await app.loadData();

    expect(app.marketAvailable.get()).toBe(false);
    expect(app.windowAvailable.get()).toBe(false);
    expect(app.highestBidAvailable.get()).toBe(false);
    expect(app.walletAvailable.get()).toBe(false);
    expect(app.bidsAvailable.get()).toBe(false);
    expect(app.settlementAvailable.get()).toBe(false);
    expect(app.reclaimableAvailable.get()).toBe(false);
  });

  it("reads totalStaked / stakeOf as WHOLE NEO (never ÷1e8) and rewards/credit as GAS (÷1e8)", async () => {
    const { app, read } = setup({
      totalStaked: "100", // 100 NEO — integer, not base units
      epoch: 3,
      stakeOf: "30", // 30 NEO
      pendingRewards: "250000000", // 2.5 GAS base units
      gasCredit: "150000000", // 1.5 GAS base units
    });

    await app.loadData();

    // NEO is integer — the pool is 100, NOT 100/1e8.
    expect(app.totalPool.get()).toBe(100);
    expect(app.userDeposits.get()).toBe(30);
    expect(app.currentEpoch.get()).toBe(3);
    // GAS is base units — scaled ÷1e8 for display.
    expect(app.pendingRewards.get()).toBeCloseTo(2.5, 8);
    expect(app.gasCredit.get()).toBeCloseTo(1.5, 8);
    // Reads came from the contract, not os.payment/os.storage.
    expect(read.mock.calls.some((c) => c[0] === "totalStaked")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "stakeOf")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "pendingRewards")).toBe(true);
  });

  it("rebuilds the current-epoch leaderboard from BidPlaced events, latest total per bidder, desc", async () => {
    const { app, listEvents } = setup({
      epoch: 2,
      bidEvents: [
        // Newest first. The FIRST event per bidder is their latest total bid.
        bidEvent(2, BOB, "500000000"), // Bob: 5 GAS (latest)
        bidEvent(2, ALICE, "300000000"), // Alice: 3 GAS (latest)
        bidEvent(2, ALICE, "100000000"), // stale earlier Alice total — ignored
        bidEvent(1, BOB, "900000000"), // PRIOR epoch — excluded
      ],
    });

    await app.loadData();

    const bids = app.bids.get();
    expect(bids).toHaveLength(2);
    // Sorted by amount desc; base units ÷1e8 → whole GAS.
    expect(bids[0]).toEqual({ address: BOB, amount: 5 });
    expect(bids[1]).toEqual({ address: ALICE, amount: 3 });
    expect(bids.some((b) => b.amount === 9)).toBe(false);
    expect(listEvents).toHaveBeenCalledWith("BidPlaced", { limit: 200 });
  });

  it("reads the last settlement (winner + GAS amount ÷1e8) for the prior epoch", async () => {
    const { app } = setup({
      epoch: 5,
      settlementWinner: { 4: BOB },
      settlementAmount: { 4: "800000000" }, // 8 GAS
    });

    await app.loadData();

    expect(app.lastSettlement.get()).toEqual({ epoch: 4, winner: BOB, amount: 8 });
  });

  it("treats a zero-address settlement winner as no settlement", async () => {
    const { app } = setup({ epoch: 2, settlementWinner: { 1: ZERO_HASH } });
    await app.loadData();
    expect(app.lastSettlement.get()).toBeNull();
  });
});

describe("useGovMerc — staking (NEO integer, transfer IS the stake)", () => {
  it("stakes a WHOLE NEO transfer with the stake memo and NEO scriptHash (NO ×1e8)", async () => {
    const { app, invoke } = setup({ epoch: 1 });
    await app.loadData();
    invoke.mockClear();

    app.depositAmount.set("30");
    await app.depositNeo();

    const transfer = callFor(invoke, "transfer");
    expect(transfer).toBeTruthy();
    // Amount is the WHOLE NEO integer "30" — NOT "3000000000".
    expect(transfer![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "30" },
      { type: "String", value: STAKE_MEMO },
    ]);
    expect(transfer![2]).toMatchObject({ scriptHash: NEO_HASH, waitForEvent: "Staked" });
    // There is NO separate stake call — the transfer IS the stake.
    expect(callFor(invoke, "stake")).toBeUndefined();
    expect(app.depositAmount.get()).toBe("");
  });

  it("rejects a fractional NEO stake (NEO is indivisible) before any chain call", async () => {
    const { app, invoke } = setup({ epoch: 1 });
    await app.loadData();
    invoke.mockClear();

    app.depositAmount.set("1.5");
    await expect(app.depositNeo()).rejects.toThrow("Enter a whole NEO amount");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("withdraws stake via withdrawStake(user, neoInteger) and validates against the user's stake", async () => {
    const { app, invoke } = setup({ epoch: 1, stakeOf: "10" });
    await app.loadData();
    invoke.mockClear();

    // Over-withdrawal is rejected before any chain call.
    app.withdrawAmount.set("25");
    await expect(app.withdrawNeo()).rejects.toThrow("Amount exceeds your deposits");
    expect(invoke).not.toHaveBeenCalled();

    // A valid partial withdrawal calls withdrawStake with the whole NEO integer.
    app.withdrawAmount.set("4");
    await app.withdrawNeo();
    const withdraw = callFor(invoke, "withdrawStake");
    expect(withdraw).toBeTruthy();
    expect(withdraw![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "4" },
    ]);
    expect(withdraw![2]).toMatchObject({ waitForEvent: "Unstaked" });
  });
});

describe("useGovMerc — bidding (GAS base units, deposit-then-act via payAndCall)", () => {
  it("routes the funded bid through the confirmed-deposit payAndCall lane (×1e8 scaled once)", async () => {
    const { app, invoke, invokeWithPayment } = setup({ epoch: 4, gasCredit: "0" });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2.5");
    await app.placeBid();

    // One confirmed-deposit lane call: the GAS transfer with the bid memo
    // settles in a block FIRST, then bid(bidder, addBase) consumes the credit.
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    const [amount, memo, op, args, options] = invokeWithPayment.mock.calls[0];
    // 2.5 GAS -> 250000000 base units (×1e8, scaled ONCE — no double-scale).
    expect(amount).toBe("250000000");
    expect(memo).toBe(BID_MEMO);
    expect(op).toBe("bid");
    expect(args).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "250000000" },
    ]);
    expect(options).toMatchObject({ waitForEvent: "BidPlaced" });

    // No hand-rolled two-step remains — the lane owns both the deposit and
    // the consuming call.
    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "bid")).toBeUndefined();
    expect(app.bidAmount.get()).toBe("");
  });

  it("skips the deposit when prepaid bid credit already covers the amount", async () => {
    const { app, invoke, invokeWithPayment } = setup({ epoch: 4, gasCredit: "300000000" }); // 3 GAS credit
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2.5"); // needs 2.5 GAS, credit covers it
    await app.placeBid();

    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(callFor(invoke, "transfer")).toBeUndefined();
    const bid = callFor(invoke, "bid");
    expect(bid).toBeTruthy();
    expect(bid![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "250000000" },
    ]);
    expect(bid![2]).toMatchObject({ waitForEvent: "BidPlaced" });
  });

  it("funds only the credit shortfall instead of overpaying the full bid again", async () => {
    const { app, invokeWithPayment } = setup({ epoch: 4, gasCredit: "100000000" });
    await app.loadData();

    app.bidAmount.set("2.5");
    await app.placeBid();

    // 1 GAS is already reusable credit, so only the remaining 1.5 GAS moves.
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(invokeWithPayment.mock.calls[0]?.[0]).toBe("150000000");
    expect(invokeWithPayment.mock.calls[0]?.[3]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "250000000" },
    ]);
  });

  it("rejects a first bid below 1 GAS before any chain call", async () => {
    const { app, invoke, invokeWithPayment } = setup({ epoch: 4, gasCredit: "0", bidEvents: [] });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("0.5");
    await expect(app.placeBid()).rejects.toThrow("First bid must be at least 1 GAS");
    expect(invoke).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();
  });

  it("surfaces the held-credit recovery copy when bid faults after the deposit lands", async () => {
    const { app, invokeWithPayment } = setup({
      epoch: 4,
      gasCredit: "0",
      bidThrows: new Error("some chain fault"),
    });
    await app.loadData();

    app.bidAmount.set("2");
    // The FrameworkPrepaidActionError branch: deposit CONFIRMED but bid()
    // faulted — the user must see the app's stranded-credit recovery copy.
    await expect(app.placeBid()).rejects.toThrow(
      "Your GAS was deposited as reusable bid credit.",
    );
    // The deposit DID go out (it landed); only the bid faulted.
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
  });

  it("surfaces the held-credit recovery copy when bid faults after a timeout-settled deposit (indexer lag)", async () => {
    // Regression pin (Wave 4 audit): the deposit transfer was BROADCAST but
    // the indexer never proved it in time ("timeout"). The host lane still
    // wraps the bid fault into the stranded-credit shape, so the user sees
    // the recovery copy — a generic toast here reads as "funds lost".
    const { app, invokeWithPayment } = setup({
      epoch: 4,
      gasCredit: "0",
      bidThrows: new Error("FAULT: insufficient prepaid asset"),
      bidSettlement: "timeout",
    });
    await app.loadData();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow(
      "Your GAS was deposited as reusable bid credit.",
    );
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
  });

  it("surfaces the held-credit recovery copy when the indexer was unreachable during the deposit", async () => {
    const { app } = setup({
      epoch: 4,
      gasCredit: "0",
      bidThrows: new Error("some chain fault"),
      bidSettlement: "unreachable",
    });
    await app.loadData();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow(
      "Your GAS was deposited as reusable bid credit.",
    );
  });

  it("propagates a pre-confirmation deposit failure verbatim (no credit-held copy)", async () => {
    const { app, invokeWithPayment } = setup({
      epoch: 4,
      gasCredit: "0",
      depositThrows: new Error("User rejected the request"),
    });
    await app.loadData();

    app.bidAmount.set("2");
    // The wallet rejected the GAS transfer — nothing is stranded, so the raw
    // message (mapped by the notify layer) must survive, not bidDepositHeld.
    await expect(app.placeBid()).rejects.toThrow("User rejected the request");
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
  });
});

describe("useGovMerc — settlement (permissionless)", () => {
  it("settles the live epoch via settleEpoch() with no args, waiting for EpochSettled", async () => {
    const { app, invoke } = setup({
      epoch: 5,
      bidEvents: [bidEvent(5, BOB, "800000000")],
      epochDeadline: String(Date.now() - 1_000),
    });
    await app.loadData();
    expect(app.bids.get()).toHaveLength(1);
    invoke.mockClear();

    await app.settleEpoch();

    const settle = callFor(invoke, "settleEpoch");
    expect(settle).toBeTruthy();
    expect(settle![1]).toEqual([]); // no args — the contract pays the top bidder
    expect(settle![2]).toMatchObject({ waitForEvent: "EpochSettled" });
  });

  it("refuses to settle an epoch with no bids", async () => {
    const { app, invoke } = setup({ epoch: 1, bidEvents: [] });
    await app.loadData();
    invoke.mockClear();

    await expect(app.settleEpoch()).rejects.toThrow("No bids to settle for this epoch");
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("useGovMerc — claim rewards + reclaim losing bid + withdraw credit", () => {
  it("claims accrued GAS rewards via claimRewards(user)", async () => {
    const { app, invoke } = setup({ epoch: 2, stakeOf: "10", pendingRewards: "500000000" });
    await app.loadData();
    expect(app.pendingRewards.get()).toBeCloseTo(5, 8);
    invoke.mockClear();

    await app.claimRewards();

    const claim = callFor(invoke, "claimRewards");
    expect(claim).toBeTruthy();
    expect(claim![1]).toEqual([{ type: "Hash160", value: ALICE_HASH }]);
    expect(claim![2]).toMatchObject({ waitForEvent: "RewardsClaimed" });
  });

  it("refuses to claim when there are no pending rewards", async () => {
    const { app, invoke } = setup({ epoch: 2, pendingRewards: "0" });
    await app.loadData();
    invoke.mockClear();

    await expect(app.claimRewards()).rejects.toThrow("No rewards to claim yet");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("detects a reclaimable losing bid in a settled epoch (bid by me, won by someone else)", async () => {
    const { app } = setup({
      epoch: 3,
      bidOf: { 1: "200000000", 2: "0" }, // bid 2 GAS in epoch 1, none in epoch 2
      settlementWinner: { 1: BOB }, // Bob won epoch 1 — Alice lost, can reclaim
    });

    await app.loadData();

    const reclaimable = app.reclaimableBids.get();
    expect(reclaimable).toEqual([{ epoch: 1, amount: 2 }]);
    expect(app.hasReclaimable.get()).toBe(true);
  });

  it("does NOT mark the winner's bid as reclaimable", async () => {
    const { app } = setup({
      epoch: 3,
      bidOf: { 1: "200000000" },
      settlementWinner: { 1: ALICE }, // Alice WON epoch 1 — cannot reclaim
    });

    await app.loadData();

    expect(app.reclaimableBids.get()).toEqual([]);
    expect(app.hasReclaimable.get()).toBe(false);
  });

  it("reclaims a losing bid via reclaimBid(bidder, epoch)", async () => {
    const { app, invoke } = setup({
      epoch: 3,
      bidOf: { 1: "200000000" },
      settlementWinner: { 1: BOB },
    });
    await app.loadData();
    invoke.mockClear();

    await app.reclaimBid(1);

    const reclaim = callFor(invoke, "reclaimBid");
    expect(reclaim).toBeTruthy();
    expect(reclaim![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "1" },
    ]);
    expect(reclaim![2]).toMatchObject({ waitForEvent: "BidReclaimed" });
  });

  it("withdraws unused GAS bid credit via withdraw(account)", async () => {
    const { app, invoke } = setup({ epoch: 2, gasCredit: "150000000" }); // 1.5 GAS
    await app.loadData();
    expect(app.hasCredit.get()).toBe(true);
    invoke.mockClear();

    await app.withdrawCredit();

    const withdraw = callFor(invoke, "withdraw");
    expect(withdraw).toBeTruthy();
    expect(withdraw![1]).toEqual([{ type: "Hash160", value: ALICE_HASH }]);
    expect(withdraw![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
  });

  it("refuses to withdraw when there is no unused credit", async () => {
    const { app, invoke } = setup({ epoch: 2, gasCredit: "0" });
    await app.loadData();
    invoke.mockClear();

    await expect(app.withdrawCredit()).rejects.toThrow("No unused bid credit");
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("useGovMerc — v2 bidding window (epochDeadline / epochDuration)", () => {
  it("derives the window phase: unopened (deadline 0) → open → closed", () => {
    const now = 1_750_000_000_000;
    expect(epochWindowPhase(0, now)).toBe("unopened");
    expect(epochWindowPhase(-1, now)).toBe("unopened");
    expect(epochWindowPhase(Number.NaN, now)).toBe("unopened");
    expect(epochWindowPhase(now + 1, now)).toBe("open");
    expect(epochWindowPhase(now, now)).toBe("closed");
    expect(epochWindowPhase(now - 1, now)).toBe("closed");
  });

  it("maps the v2 revert reasons to friendly message keys", () => {
    expect(windowRevertKey(new Error("Assert failed: bidding closed"))).toBe(
      "biddingClosed",
    );
    expect(windowRevertKey(new Error("ASSERT: Epoch Not Ended"))).toBe(
      "epochNotEnded",
    );
    expect(windowRevertKey(new Error("insufficient prepaid asset"))).toBeNull();
    // A FrameworkPrepaidActionError embeds the consuming call's revert reason
    // in its message, so the window mapping still recognizes it.
    expect(
      windowRevertKey(
        new FrameworkPrepaidActionError("bid", "0xdeposit", new Error("bidding closed")),
      ),
    ).toBe("biddingClosed");
  });

  it("loads epochDeadline(currentEpoch) + epochDuration() into state", async () => {
    const deadline = Date.now() + 60_000;
    const { app, read } = setup({
      epoch: 7,
      epochDeadline: String(deadline),
      epochDuration: "300000",
    });

    await app.loadData();

    expect(app.epochDeadline.get()).toBe(deadline);
    expect(app.epochDurationMs.get()).toBe(300000);
    const deadlineCall = read.mock.calls.find((c) => c[0] === "epochDeadline");
    expect(deadlineCall).toBeTruthy();
    // The deadline is read for the LIVE epoch.
    expect(deadlineCall![1]).toEqual([{ type: "Integer", value: "7" }]);
    expect(read.mock.calls.some((c) => c[0] === "epochDuration")).toBe(true);
  });

  it("falls back to the 5-minute default when epochDuration() reads 0", async () => {
    const { app } = setup({ epoch: 2, epochDuration: "0" });
    await app.loadData();
    expect(app.epochDurationMs.get()).toBe(EPOCH_DURATION_FALLBACK_MS);
    expect(app.windowAvailable.get()).toBe(false);
  });

  it("rejects a bid after the deadline BEFORE any chain call", async () => {
    const { app, invoke } = setup({
      epoch: 4,
      epochDeadline: String(Date.now() - 1_000), // window already closed
    });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow(
      "Bidding for this epoch has closed",
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("allows the opening bid while the window is unopened (deadline 0)", async () => {
    const { app, invoke, invokeWithPayment } = setup({ epoch: 4, epochDeadline: "0" });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2");
    await app.placeBid();

    // The funded opening bid goes out through the confirmed-deposit lane.
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(invokeWithPayment.mock.calls[0][2]).toBe("bid");
  });

  it("maps a 'bidding closed' bid revert to the credit-held message after the deposit landed", async () => {
    const { app, invokeWithPayment } = setup({
      epoch: 4,
      gasCredit: "0", // forces the deposit leg first
      epochDeadline: String(Date.now() + 60_000), // open locally, closed on-chain
      bidThrows: new Error("Assert failed: bidding closed"),
    });
    await app.loadData();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow(
      "Bidding closed before your bid landed",
    );
    // The deposit leg ran (and confirmed) before the bid raced the deadline.
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
  });

  it("maps a 'bidding closed' bid revert to the credit-held message on a timeout-settled deposit too", async () => {
    // Same race, but the indexer lagged: the deposit is broadcast (credit
    // will land) yet settlement reads "timeout". The wrap must survive so
    // the closed-window copy still says the GAS is HELD, not lost.
    const { app, invokeWithPayment } = setup({
      epoch: 4,
      gasCredit: "0",
      epochDeadline: String(Date.now() + 60_000),
      bidThrows: new Error("Assert failed: bidding closed"),
      bidSettlement: "timeout",
    });
    await app.loadData();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow(
      "Bidding closed before your bid landed",
    );
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
  });

  it("maps a 'bidding closed' bid revert to the plain message when credit already covered it", async () => {
    const { app, invoke, invokeWithPayment } = setup({
      epoch: 4,
      gasCredit: "300000000", // credit covers the bid — no deposit leg
      epochDeadline: String(Date.now() + 60_000),
      bidThrows: new Error("Assert failed: bidding closed"),
    });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow(
      "Bidding for this epoch has closed",
    );
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(callFor(invoke, "transfer")).toBeUndefined();
  });

  it("blocks settlement before the deadline (epoch not ended) with no chain call", async () => {
    const { app, invoke } = setup({
      epoch: 5,
      bidEvents: [bidEvent(5, BOB, "800000000")],
      epochDeadline: String(Date.now() + 60_000), // window still open
    });
    await app.loadData();
    invoke.mockClear();

    await expect(app.settleEpoch()).rejects.toThrow(
      "The bidding window is still open",
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("settles once the deadline has passed", async () => {
    const { app, invoke } = setup({
      epoch: 5,
      bidEvents: [bidEvent(5, BOB, "800000000")],
      epochDeadline: String(Date.now() - 1_000), // window closed
    });
    await app.loadData();
    invoke.mockClear();

    await app.settleEpoch();

    const settle = callFor(invoke, "settleEpoch");
    expect(settle).toBeTruthy();
    expect(settle![2]).toMatchObject({ waitForEvent: "EpochSettled" });
  });

  it("maps the contract's 'epoch not ended' settle revert when the deadline is unknown", async () => {
    const { app } = setup({
      epoch: 5,
      bidEvents: [bidEvent(5, BOB, "800000000")],
      epochDeadline: "0", // deadline read degraded — contract still rules
      settleThrows: new Error("Assert failed: epoch not ended"),
    });
    await app.loadData();

    await expect(app.settleEpoch()).rejects.toThrow(
      "The bidding window is still open — settle after the deadline",
    );
  });
});
