import { describe, expect, it, vi } from "vitest";

import {
  EPOCH_DURATION_FALLBACK_MS,
  epochWindowPhase,
  useGovMerc,
  windowRevertKey,
} from "../../gov-merc/src/hooks/useGovMerc";
import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BOB = "NUuPbNwrecVnAQauFTdMPaMQRgwsmFwjwR";
const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
const ALICE_HASH = addressToScriptHash(ALICE);
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const STAKE_MEMO = "govmerc:stake";
const BID_MEMO = "govmerc:bid";
const ZERO_HASH = "0x0000000000000000000000000000000000000000";

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
  /** Force the bid() invoke to throw. */
  bidThrows?: Error;
  /** Force specific read operations to throw. */
  readThrows?: Record<string, Error>;
  /** epochDeadline(currentEpoch) read — ms timestamp (0 = window unopened). */
  epochDeadline?: string;
  /** epochDuration() read — bidding-window length in ms. */
  epochDuration?: string;
  /** Force the settleEpoch() invoke to throw. */
  settleThrows?: Error;
}

/**
 * Minimal ChainService stand-in. Records invoke/read/listEvents calls so tests
 * can assert the direct-contract stake (NEO integer) + bid (GAS base units) +
 * settle/claim/reclaim argument shapes and the leaderboard-from-events wiring. No
 * OS proxies are involved.
 */
function makeChain(opts: ChainOpts = {}) {
  const invoke = vi.fn(
    async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      let event: unknown;
      if (op === "bid") {
        if (opts.bidThrows) throw opts.bidThrows;
        if (options?.waitForEvent === "BidPlaced") {
          event = bidEvent(opts.epoch ?? 0, ALICE, "100000000");
        }
      }
      if (op === "settleEpoch") {
        if (opts.settleThrows) throw opts.settleThrows;
        if (options?.waitForEvent === "EpochSettled") {
          event = { state: [{ type: "Integer", value: String(opts.epoch ?? 0) }] };
        }
      }
      return { txid: "0xtx", event, success: true };
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    if (opts.readThrows?.[op]) throw opts.readThrows[op];
    const epochArg = args && args[0] ? Number(args[0].value) : undefined;
    switch (op) {
      case "totalStaked": return opts.totalStaked ?? "0";
      case "currentEpoch": return String(opts.epoch ?? 0);
      case "stakeOf": return opts.stakeOf ?? "0";
      case "pendingRewards": return opts.pendingRewards ?? "0";
      case "gasCreditOf": return opts.gasCredit ?? "0";
      case "settlementWinner":
        return (epochArg !== undefined && opts.settlementWinner?.[epochArg]) || ZERO_HASH;
      case "settlementAmount":
        return (epochArg !== undefined && opts.settlementAmount?.[epochArg]) || "0";
      case "bidOf":
        return (epochArg !== undefined && opts.bidOf?.[epochArg]) || "0";
      case "epochDeadline": return opts.epochDeadline ?? "0";
      case "epochDuration": return opts.epochDuration ?? "300000";
      default: return "0";
    }
  });

  const listEvents = vi.fn(async (): Promise<unknown[]> => opts.bidEvents ?? []);

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    invoke,
    read,
    listEvents,
  } as unknown as ChainService & {
    invoke: typeof invoke;
    read: typeof read;
    listEvents: typeof listEvents;
  };
  return { chain, invoke, read, listEvents };
}

function setup(opts: ChainOpts = {}) {
  const { chain, invoke, read, listEvents } = makeChain(opts);
  const app = useGovMerc({ chain, t });
  app.setAddress(ALICE);
  return { app, chain, invoke, read, listEvents };
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

      const unexpected = setup({
        readThrows: {
          totalStaked: new Error("RPC node unavailable"),
        },
      });
      await unexpected.app.loadData();
      expect(warn).toHaveBeenCalledWith(
        "[useGovMerc] loadData failed:",
        "RPC node unavailable",
      );
    } finally {
      warn.mockRestore();
    }
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

describe("useGovMerc — bidding (GAS base units, deposit-then-act)", () => {
  it("deposits the GAS bid then calls bid(bidder, addBase), in that order (×1e8 scaled once)", async () => {
    const { app, invoke } = setup({ epoch: 4, gasCredit: "0" });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2.5");
    await app.placeBid();

    // Step 1: GAS transfer to the contract with the bid memo, base units.
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    // 2.5 GAS -> 250000000 base units (×1e8, scaled ONCE — no double-scale).
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "250000000" },
      { type: "String", value: BID_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH });

    // Step 2: bid(bidder, addBase) waiting for BidPlaced.
    const bid = callFor(invoke, "bid");
    expect(bid).toBeTruthy();
    expect(bid![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "250000000" },
    ]);
    expect(bid![2]).toMatchObject({ waitForEvent: "BidPlaced" });

    // The deposit must precede the bid.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("bid"));
    expect(app.bidAmount.get()).toBe("");
  });

  it("skips the deposit when prepaid bid credit already covers the amount", async () => {
    const { app, invoke } = setup({ epoch: 4, gasCredit: "300000000" }); // 3 GAS credit
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2.5"); // needs 2.5 GAS, credit covers it
    await app.placeBid();

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "bid")).toBeTruthy();
  });

  it("rejects a first bid below 1 GAS before any chain call", async () => {
    const { app, invoke } = setup({ epoch: 4, gasCredit: "0", bidEvents: [] });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("0.5");
    await expect(app.placeBid()).rejects.toThrow("First bid must be at least 1 GAS");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces a held-credit message when bid faults after the deposit lands", async () => {
    const { app, invoke } = setup({
      epoch: 4,
      gasCredit: "0",
      bidThrows: new Error("some chain fault"),
    });
    await app.loadData();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow(
      "Your GAS was deposited as reusable bid credit.",
    );
    // The deposit DID go out (it landed); only the bid faulted.
    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(callFor(invoke, "bid")).toBeTruthy();
  });
});

describe("useGovMerc — settlement (permissionless)", () => {
  it("settles the live epoch via settleEpoch() with no args, waiting for EpochSettled", async () => {
    const { app, invoke } = setup({
      epoch: 5,
      bidEvents: [bidEvent(5, BOB, "800000000")],
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
    const { app, invoke } = setup({ epoch: 4, epochDeadline: "0" });
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2");
    await app.placeBid();

    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(callFor(invoke, "bid")).toBeTruthy();
  });

  it("maps a 'bidding closed' bid revert to the credit-held message after the deposit landed", async () => {
    const { app } = setup({
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
  });

  it("maps a 'bidding closed' bid revert to the plain message when credit already covered it", async () => {
    const { app, invoke } = setup({
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
