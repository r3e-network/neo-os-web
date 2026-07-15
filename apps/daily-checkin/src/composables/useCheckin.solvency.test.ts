import { afterEach, describe, expect, it, vi } from "vitest";

import { GAS_HASH } from "@shared/constants/rpc";
import { createMiniAppFramework } from "@shared/react";
import { createObservable } from "@shared/react/context";
import { addressToScriptHash } from "@shared/utils/neo";
import {
  isPendingDailyCheckinOperation,
  requireCanonicalDailyCheckinContext,
  type PendingDailyCheckinOperation,
} from "../daily-checkin-safety";
import { CHECKIN_MEMO, useCheckin } from "./useCheckin";

const WALLET = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const ACTOR = addressToScriptHash(WALLET).toLowerCase();
const CONTRACT = "0x25db219a701a2b23130788723fcf9a2e76857235";
const GAS = GAS_HASH.toLowerCase();
const CHECKIN_TX = `0x${"11".repeat(32)}`;
const CLAIM_TX = `0x${"22".repeat(32)}`;

interface UserState {
  currentStreak: number;
  highestStreak: number;
  lastCheckinDay: number;
  unclaimed: string;
  claimed: string;
  totalCheckins: number;
  canCheckin: boolean;
  streakWillReset: boolean;
}

interface PlatformState {
  totalUsers: number;
  totalCheckins: number;
  totalRewarded: string;
  checkInFee: string;
  currentDay: number;
  nextMidnight: number;
  weekReward: string;
  twoWeekReward: string;
  pool: string;
  totalUnclaimed: string;
  paused: boolean;
}

function t(key: string) {
  return key;
}

function hashStack(displayHash: string) {
  const bytes = Uint8Array.from(
    displayHash.replace(/^0x/i, "").match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
  const littleEndian = String.fromCharCode(...bytes.reverse());
  return {
    type: "ByteString",
    value: btoa(littleEndian),
  };
}

function integer(value: string | number) {
  return { type: "Integer", value: String(value) };
}

function notification(contract: string, eventname: string, values: unknown[]) {
  return {
    contract,
    eventname,
    state: { type: "Array", value: values },
  };
}

function applicationLog(notifications: unknown[], state = "HALT") {
  return new Response(JSON.stringify({
    result: { executions: [{ vmstate: state, notifications }] },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function setup(options: {
  user?: Partial<UserState>;
  platform?: Partial<PlatformState>;
  malformedRead?: string;
  broadcastThenThrow?: boolean;
} = {}) {
  const user: UserState = {
    currentStreak: 6,
    highestStreak: 8,
    lastCheckinDay: 20_644,
    unclaimed: "0",
    claimed: "150000000",
    totalCheckins: 12,
    canCheckin: true,
    streakWillReset: false,
    ...options.user,
  };
  const platform: PlatformState = {
    totalUsers: 20,
    totalCheckins: 100,
    totalRewarded: "1000000000",
    checkInFee: "100000",
    currentDay: 20_645,
    nextMidnight: Date.now() + 86_400_000,
    weekReward: "1000000",
    twoWeekReward: "2000000",
    pool: "100000000",
    totalUnclaimed: user.unclaimed,
    paused: false,
    ...options.platform,
  };
  const address = createObservable<string | null>(WALLET);
  const contractAddress = createObservable<string | null>(CONTRACT);

  const read = vi.fn(async (operation: string) => {
    if (operation === options.malformedRead) return null;
    switch (operation) {
      case "getPlatformStats":
        return {
          totalUsers: String(platform.totalUsers),
          totalCheckins: String(platform.totalCheckins),
          totalRewarded: platform.totalRewarded,
          checkInFee: platform.checkInFee,
          currentUtcDay: String(platform.currentDay),
          nextMidnight: String(platform.nextMidnight),
          weekReward: platform.weekReward,
          twoWeekReward: platform.twoWeekReward,
        };
      case "isPaused": return platform.paused;
      case "rewardPool": return platform.pool;
      case "totalUnclaimed": return platform.totalUnclaimed;
      case "getCheckInStateForFrontend":
        return {
          currentStreak: String(user.currentStreak),
          highestStreak: String(user.highestStreak),
          lastCheckinDay: String(user.lastCheckinDay),
          unclaimed: user.unclaimed,
          totalCheckins: String(user.totalCheckins),
          currentDay: String(platform.currentDay),
        };
      case "getCheckinStatus":
        return {
          currentUtcDay: String(platform.currentDay),
          lastCheckinDay: String(user.lastCheckinDay),
          canCheckin: user.canCheckin,
          streakWillReset: user.streakWillReset,
          currentStreak: String(user.currentStreak),
          nextRewardDay: String(user.currentStreak < 7 ? 7 : 14),
        };
      case "getUserStatsDetails":
        return {
          streak: String(user.currentStreak),
          highestStreak: String(user.highestStreak),
          lastCheckinDay: String(user.lastCheckinDay),
          unclaimed: user.unclaimed,
          claimed: user.claimed,
          totalCheckins: String(user.totalCheckins),
        };
      default: throw new Error(`unexpected read ${operation}`);
    }
  });

  const invoke = vi.fn(async (
    operation: string,
    _args: unknown[],
    invokeOptions?: { onTransactionSent?: (txid: string) => void },
  ) => {
    if (operation === "transfer") {
      invokeOptions?.onTransactionSent?.(CHECKIN_TX);
      if (options.broadcastThenThrow) throw new Error("wallet transport closed");
      const nextStreak = user.streakWillReset ? 1 : user.currentStreak + 1;
      const reward = nextStreak === 7 ? "1000000" : nextStreak === 14 ? "2000000" : "0";
      user.currentStreak = nextStreak;
      user.highestStreak = Math.max(user.highestStreak, nextStreak);
      user.lastCheckinDay = platform.currentDay;
      user.totalCheckins += 1;
      user.canCheckin = false;
      user.streakWillReset = false;
      user.unclaimed = (BigInt(user.unclaimed) + BigInt(reward)).toString();
      platform.totalCheckins += 1;
      platform.pool = (BigInt(platform.pool) + BigInt(platform.checkInFee)).toString();
      platform.totalUnclaimed = user.unclaimed;
      return { txid: CHECKIN_TX, success: true };
    }
    if (operation === "claimRewards") {
      invokeOptions?.onTransactionSent?.(CLAIM_TX);
      const amount = user.unclaimed;
      user.unclaimed = "0";
      user.claimed = (BigInt(user.claimed) + BigInt(amount)).toString();
      platform.totalRewarded = (BigInt(platform.totalRewarded) + BigInt(amount)).toString();
      platform.pool = (BigInt(platform.pool) - BigInt(amount)).toString();
      platform.totalUnclaimed = "0";
      return { txid: CLAIM_TX, success: true };
    }
    throw new Error(`unexpected invoke ${operation}`);
  });

  const chain = {
    address,
    contractAddress,
    detectNetwork: vi.fn(async () => "mainnet"),
    ensureWallet: vi.fn(async () => WALLET),
    read,
    invoke,
    invokeWithPayment: vi.fn(),
    listEvents: vi.fn(async () => []),
  };
  const framework = createMiniAppFramework({
    services: { chain, notify: {} },
    launchContext: { appId: "miniapp-dailycheckin", network: "neo-n3-mainnet" },
    t,
  } as never, { appId: "miniapp-dailycheckin", storagePrefix: "daily-test:" });
  const app = useCheckin({ app: framework, t });
  return { app, framework, chain, read, invoke, user, platform };
}

function pending(overrides: Partial<PendingDailyCheckinOperation> = {}): PendingDailyCheckinOperation {
  return {
    version: 1,
    kind: "checkin",
    network: "mainnet",
    contractHash: CONTRACT,
    gasHash: GAS,
    actorHash: ACTOR,
    txid: CHECKIN_TX,
    createdAt: Date.now(),
    feeRaw: "100000",
    beforeStreak: "6",
    beforeLastCheckinDay: "20644",
    beforeUserCheckins: "12",
    beforeUnclaimedRaw: "0",
    beforeClaimedRaw: "150000000",
    beforeGlobalCheckins: "100",
    beforeGlobalRewardedRaw: "1000000000",
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Daily Check-in canonical production state", () => {
  it("binds both live networks to the canonical contract and GAS", async () => {
    const { app, framework } = setup();
    await expect(requireCanonicalDailyCheckinContext(framework)).resolves.toEqual({
      network: "mainnet",
      contractHash: CONTRACT,
      gasHash: GAS,
    });
    app.cleanup();
  });

  it("requires a durable actor/network/contract/GAS/value record", () => {
    expect(isPendingDailyCheckinOperation(pending())).toBe(true);
    expect(isPendingDailyCheckinOperation(pending({ gasHash: "" }))).toBe(false);
    expect(isPendingDailyCheckinOperation(pending({ txid: "broadcast" }))).toBe(false);
    expect(isPendingDailyCheckinOperation(pending({ feeRaw: "0" }))).toBe(false);
  });

  it("loads strict contract terms and never inflates 0.01 GAS into 1 GAS", async () => {
    const { app, read } = setup();
    await app.loadAll();

    expect(app.hasLoadedStatus.get()).toBe(true);
    expect(app.dataSource.get()).toBe("chain");
    expect(app.currentStreak.get()).toBe(6);
    expect(app.weekReward.get()).toBe("1000000");
    expect(app.formattedWeekReward.get()).toBe("0.01 tokenGas");
    expect(app.formattedCheckInFee.get()).toBe("0.001 tokenGas");
    expect(read).toHaveBeenCalledWith("rewardPool", [], { scriptHash: CONTRACT });
    app.cleanup();
  });

  it("keeps malformed user reads unavailable instead of rendering trusted zero state", async () => {
    const { app } = setup({ malformedRead: "getCheckInStateForFrontend" });
    await app.loadAll();

    expect(app.hasLoadedPlatform.get()).toBe(true);
    expect(app.hasLoadedStatus.get()).toBe(false);
    expect(app.dataSource.get()).toBe("partial");
    // Intent unchanged: a malformed user read must stay UNAVAILABLE and must
    // never render as a trusted zero ("0 days" / "0.00 GAS") the visitor could
    // act on. Only the marker moved: the composable used to signal unavailable
    // with an em-dash, which meant it — not the view — decided what an
    // unresolved value looks like, and printed a dash grid onto the entry
    // surface. It now emits empty and the view renders a skeleton or localized
    // zero-state copy. Assert both halves so neither can regress into a zero.
    expect(app.formattedCurrentStreak.get()).toBe("");
    expect(app.formattedUnclaimed.get()).toBe("");
    expect(app.formattedCurrentStreak.get()).not.toContain("0");
    expect(app.formattedUnclaimed.get()).not.toContain("0");
    app.cleanup();
  });

  it("keeps a failed reward-pool read unavailable instead of treating it as zero", async () => {
    const { app } = setup({ malformedRead: "rewardPool" });
    await app.loadAll();

    expect(app.hasLoadedPlatform.get()).toBe(false);
    expect(app.dataSource.get()).toBe("failed");
    // Same re-pin as above: unavailable is now "" rather than "—". The load-
    // bearing half of this guard is that a failed pool read is NOT treated as a
    // funded/zero balance.
    expect(app.formattedRewardPool.get()).toBe("");
    expect(app.rewardsUnderfunded.get()).toBe(false);
    app.cleanup();
  });

  it("never invents a minimum transfer when the live fee is zero", async () => {
    const { app, invoke } = setup({ platform: { checkInFee: "0" } });

    await expect(app.doCheckIn()).rejects.toThrow("checkinFeeUnavailable");
    expect(invoke).not.toHaveBeenCalled();
    expect(app.pendingOperation.get()).toBeNull();
    app.cleanup();
  });
});

describe("Daily Check-in exact event plus readback", () => {
  it("confirms check-in only with exact GAS payment, CheckedIn event, and advancing reads", async () => {
    const { app, invoke } = setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(applicationLog([
      notification(GAS, "Transfer", [hashStack(ACTOR), hashStack(CONTRACT), integer("100000")]),
      notification(CONTRACT, "CheckedIn", [hashStack(ACTOR), integer(7), integer("1000000")]),
    ]));

    await expect(app.doCheckIn()).resolves.toEqual({ status: "confirmed", txid: CHECKIN_TX });

    expect(invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: ACTOR },
        { type: "Hash160", value: CONTRACT },
        { type: "Integer", value: "100000" },
        { type: "String", value: CHECKIN_MEMO },
      ],
      expect.objectContaining({
        scriptHash: GAS,
        notify: "silent",
        onTransactionSent: expect.any(Function),
      }),
    );
    expect(app.pendingOperation.get()).toBeNull();
    expect(app.currentStreak.get()).toBe(7);
    expect(app.unclaimedRewards.get()).toBe("1000000");
    expect(app.lastSuccess.get()).toBe("checkinRecorded");
    expect(app.checkinHistory.get()[0]).toMatchObject({
      action: "checkin",
      streak: 7,
      rewardRaw: "1000000",
      txid: CHECKIN_TX,
    });
    app.cleanup();
  });

  it("confirms claims only with exact app event, GAS payout, and claimed readback", async () => {
    const { app } = setup({
      user: { unclaimed: "2000000" },
      platform: { totalUnclaimed: "2000000" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(applicationLog([
      notification(CONTRACT, "RewardsClaimed", [hashStack(ACTOR), integer("2000000")]),
      notification(GAS, "Transfer", [hashStack(CONTRACT), hashStack(ACTOR), integer("2000000")]),
    ]));

    await expect(app.claimRewards()).resolves.toEqual({ status: "confirmed", txid: CLAIM_TX });
    expect(app.pendingOperation.get()).toBeNull();
    expect(app.unclaimedRewards.get()).toBe("0");
    expect(app.totalClaimed.get()).toBe("152000000");
    expect(app.lastSuccess.get()).toBe("rewardClaimed");
    app.cleanup();
  });

  it("keeps a HALT transaction pending when the event streak disagrees with chain readback", async () => {
    const { app } = setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(applicationLog([
      notification(GAS, "Transfer", [hashStack(ACTOR), hashStack(CONTRACT), integer("100000")]),
      notification(CONTRACT, "CheckedIn", [hashStack(ACTOR), integer(8), integer("1000000")]),
    ]));

    await expect(app.doCheckIn()).resolves.toEqual({ status: "pending", txid: CHECKIN_TX });
    expect(app.pendingOperation.get()?.txid).toBe(CHECKIN_TX);
    expect(app.lastSuccess.get()).toBe("");
    expect(app.transactionNotice.get()).toBe("confirmationStillPending");
    app.cleanup();
  });

  it("never treats a broadcast followed by transport failure as success", async () => {
    const { app } = setup({ broadcastThenThrow: true });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(app.doCheckIn()).resolves.toEqual({ status: "pending", txid: CHECKIN_TX });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(app.pendingOperation.get()?.txid).toBe(CHECKIN_TX);
    expect(app.lastSuccess.get()).toBe("");
    expect(app.transactionNotice.get()).toBe("transactionPending");
    app.cleanup();
  });

  it("clears pending on FAULT without manufacturing streak progress", async () => {
    const { app } = setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(applicationLog([], "FAULT"));

    await expect(app.doCheckIn()).resolves.toEqual({ status: "fault", txid: CHECKIN_TX });
    expect(app.pendingOperation.get()).toBeNull();
    expect(app.lastSuccess.get()).toBe("");
    expect(app.lastError.get()).toBe("transactionFaulted");
    expect(app.currentStreak.get()).toBe(6);
    app.cleanup();
  });

  it("refuses recovery under a different actor before reading the transaction", async () => {
    const { app, chain } = setup();
    app.pendingOperation.set(pending());
    chain.address.set("NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(app.recoverPendingOperation({ state: "halt", notifications: [] })).resolves.toEqual({
      status: "pending",
      txid: CHECKIN_TX,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(app.transactionNotice.get()).toBe("pendingContextMismatch");
    app.cleanup();
  });
});
