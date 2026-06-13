import { describe, expect, it, vi } from "vitest";

import { useCheckin, CHECKIN_MEMO } from "../../daily-checkin/src/composables/useCheckin";
import type { ChainService, ContractArg, TxResult } from "../services";
import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

/**
 * These tests drive the migrated useCheckin against a FAKE ChainService that
 * mirrors the standalone daily-checkin contract on testnet
 * 0xaba84da240a55410d284a656fc8dae044e6ec1a5. The composable now talks directly
 * to the chain — no OS proxies:
 *   - check-in = a GAS transfer of the fee with the memo
 *     "miniapp-dailycheckin:checkin" (OnNEP17Payment records it; CheckedIn event)
 *   - claim = claimRewards(user) direct call (RewardsClaimed event)
 *   - reads = getCheckInStateForFrontend / getCheckinStatus / getUserStatsDetails
 *     / getPlatformStats (all GAS amounts in base units; day counters are the
 *     contract's own unit, eligibility comes from the canCheckin boolean)
 */

const ME = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0xaba84da240a55410d284a656fc8dae044e6ec1a5";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const ME_HASH = addressToScriptHash(ME);

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    checkinRecorded: "Check-in recorded",
    checkinUnavailable: "Already checked in for this UTC day",
    contractNotReady: "Check-in contract is not ready",
    days: "Days",
    rewardClaimed: "Reward claimed",
    rewardsUnavailable: "No rewards available to claim",
    statusLoaded: "Status loaded",
    tokenGas: "GAS",
    walletRequired: "Connect your Neo wallet to continue",
    workflowCheckingIn: "Submitting check-in",
    workflowClaiming: "Claiming rewards",
    workflowFailed: "Action failed",
    workflowReady: "Ready",
    workflowRefreshing: "Refreshing check-in status",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

/** Authoritative on-chain user record (base-unit GAS, contract day counters). */
interface ChainUser {
  currentStreak: number;
  highestStreak: number;
  lastCheckinDay: number;
  unclaimed: number; // base units
  claimed: number; // base units
  totalCheckins: number;
  canCheckin: boolean;
}

interface PlatformState {
  totalUsers: number;
  totalCheckins: number;
  totalRewarded: number; // base units
  checkInFee: number; // base units
  currentDay: number;
  nextMidnight: number; // ms wall-clock
}

interface InvokeCall {
  operation: string;
  args: ContractArg[];
  options?: { scriptHash?: string; waitForEvent?: string };
}

function setup(opts?: {
  user?: Partial<ChainUser>;
  platform?: Partial<PlatformState>;
  wallet?: string | null;
  checkedInEvents?: unknown[];
  claimedEvents?: unknown[];
}) {
  const user: ChainUser = {
    currentStreak: 6,
    highestStreak: 8,
    lastCheckinDay: 20_609_000,
    unclaimed: 0,
    claimed: 150_000_000, // 1.5 GAS
    totalCheckins: 12,
    canCheckin: true,
    ...opts?.user,
  };
  const platform: PlatformState = {
    totalUsers: 20,
    totalCheckins: 100,
    totalRewarded: 1_000_000_000, // 10 GAS
    checkInFee: 100_000, // 0.001 GAS
    currentDay: 20_609_579,
    nextMidnight: Date.now() + 86_400,
    ...opts?.platform,
  };

  const invokes: InvokeCall[] = [];

  const address = createObservable<string | null>(
    opts && "wallet" in opts ? opts.wallet ?? null : ME,
  );
  const contractAddress = createObservable<string | null>(CONTRACT);

  const read = vi.fn(async (operation: string, _args?: ContractArg[]) => {
    switch (operation) {
      case "getCheckInStateForFrontend":
        return {
          currentStreak: String(user.currentStreak),
          highestStreak: String(user.highestStreak),
          lastCheckinDay: String(user.lastCheckinDay),
          unclaimed: String(user.unclaimed),
          totalCheckins: String(user.totalCheckins),
          currentTime: String(Date.now()),
          currentDay: String(platform.currentDay),
        };
      case "getCheckinStatus":
        return {
          currentUtcDay: String(platform.currentDay),
          lastCheckinDay: String(user.lastCheckinDay),
          canCheckin: user.canCheckin,
          timeUntilEligible: "0",
        };
      case "getUserStatsDetails":
        return {
          streak: String(user.currentStreak),
          highestStreak: String(user.highestStreak),
          lastCheckinDay: String(user.lastCheckinDay),
          unclaimed: String(user.unclaimed),
          claimed: String(user.claimed),
          totalCheckins: String(user.totalCheckins),
        };
      case "getPlatformStats":
        return {
          totalUsers: String(platform.totalUsers),
          totalCheckins: String(platform.totalCheckins),
          totalRewarded: String(platform.totalRewarded),
          checkInFee: String(platform.checkInFee),
          currentUtcDay: String(platform.currentDay),
          nextMidnight: String(platform.nextMidnight),
        };
      default:
        throw new Error(`unexpected read: ${operation}`);
    }
  });

  const invoke = vi.fn(
    async (
      operation: string,
      args: ContractArg[],
      options?: { scriptHash?: string; waitForEvent?: string },
    ): Promise<TxResult> => {
      invokes.push({ operation, args, options });

      if (operation === "transfer") {
        const memo = String(args[3]?.value ?? "");
        if (memo === CHECKIN_MEMO) {
          // OnNEP17Payment records the check-in: bump streak + accrue any
          // milestone reward, mark ineligible, emit CheckedIn.
          const nextStreak = user.currentStreak + 1;
          const reward = nextStreak === 7 ? 100_000_000 : nextStreak === 14 ? 200_000_000 : 0;
          user.currentStreak = nextStreak;
          user.highestStreak = Math.max(user.highestStreak, nextStreak);
          user.totalCheckins += 1;
          user.unclaimed += reward;
          user.lastCheckinDay = platform.currentDay;
          user.canCheckin = false;
          platform.totalCheckins += 1;
          const nextEligible = Date.now() + 86_400;
          // CheckedIn(user, streak, reward, nextEligibleTs).
          return {
            txid: "0xcheckin",
            success: true,
            event: {
              state: [
                { value: ME_HASH },
                { value: String(nextStreak) },
                { value: String(reward) },
                { value: String(nextEligible) },
              ],
            },
          };
        }
        return { txid: "0xtransfer", success: true };
      }

      if (operation === "claimRewards") {
        const amount = user.unclaimed;
        user.claimed += amount;
        user.unclaimed = 0;
        platform.totalRewarded += amount;
        // RewardsClaimed(user, amount, totalClaimed).
        return {
          txid: "0xclaim",
          success: true,
          event: {
            state: [
              { value: ME_HASH },
              { value: String(amount) },
              { value: String(user.claimed) },
            ],
          },
        };
      }

      throw new Error(`unexpected invoke: ${operation}`);
    },
  );

  // ensureWallet connects to ME by default; when the test seeds wallet:null it
  // models a user that declines connection, so it stays unresolved.
  const connectsWallet = !(opts && "wallet" in opts && opts.wallet === null);
  // The history hydration calls chain.listEvents("CheckedIn"|"RewardsClaimed");
  // default to the configured fixtures (empty unless a test supplies them).
  const listEvents = vi.fn(async (eventName: string) => {
    if (eventName === "CheckedIn") return opts?.checkedInEvents ?? [];
    if (eventName === "RewardsClaimed") return opts?.claimedEvents ?? [];
    return [];
  });
  const chain = {
    address,
    contractAddress,
    ensureWallet: vi.fn(async () => {
      if (connectsWallet && !address.get()) address.set(ME);
      return address.get() ?? "";
    }),
    read,
    invoke,
    listEvents,
  } as unknown as ChainService;

  const app = useCheckin({ chain, t });
  return { app, chain, invokes, read, invoke, user, platform, listEvents };
}

describe("useCheckin (on-chain wiring)", () => {
  it("loads merged on-chain state, keeps GAS in base units, and records refresh evidence", async () => {
    const { app, read } = setup();

    await app.refreshStatus();

    expect(read).toHaveBeenCalledWith(
      "getCheckInStateForFrontend",
      [{ type: "Hash160", value: ME_HASH }],
    );
    expect(read).toHaveBeenCalledWith("getPlatformStats", []);
    expect(app.currentStreak.get()).toBe(6);
    expect(app.highestStreak.get()).toBe(8);
    expect(app.checkInFee.get()).toBe(100_000);
    expect(app.totalClaimed.get()).toBe(150_000_000);
    expect(app.totalGlobalRewarded.get()).toBe(1_000_000_000);
    expect(app.totalGlobalCheckins.get()).toBe(100);
    expect(app.totalGlobalUsers.get()).toBe(20);
    expect(app.canCheckIn.get()).toBe(true);
    expect(app.latestResult.get()?.summary).toBe("Status loaded");
  });

  it("checks in via a memo'd GAS deposit, reads streak + reward from CheckedIn, then claims", async () => {
    const { app, invokes } = setup();
    await app.loadAll();

    await app.doCheckIn();

    // The check-in is the GAS transfer carrying the check-in memo to the contract.
    const transfer = invokes.find((c) => c.operation === "transfer");
    expect(transfer).toBeTruthy();
    expect(transfer?.options?.scriptHash).toBe(GAS_HASH);
    expect(transfer?.options?.waitForEvent).toBe("CheckedIn");
    expect(String(transfer?.args[1]?.value)).toBe(CONTRACT); // to = contract
    expect(String(transfer?.args[2]?.value)).toBe("100000"); // fee base units
    expect(String(transfer?.args[3]?.value)).toBe(CHECKIN_MEMO);

    expect(app.currentStreak.get()).toBe(7);
    expect(app.unclaimedRewards.get()).toBe(100_000_000);
    expect(app.canCheckIn.get()).toBe(false);
    expect(app.checkinHistory.get()[0]).toEqual(
      expect.objectContaining({ action: "checkin", streak: 7, txid: "0xcheckin" }),
    );

    await app.claimRewards();

    const claim = invokes.find((c) => c.operation === "claimRewards");
    expect(claim).toBeTruthy();
    expect(claim?.options?.waitForEvent).toBe("RewardsClaimed");
    expect(String(claim?.args[0]?.value)).toBe(ME_HASH);

    expect(app.unclaimedRewards.get()).toBe(0);
    expect(app.totalClaimed.get()).toBe(250_000_000);
    expect(app.latestResult.get()?.summary).toBe("Reward claimed");
    expect(app.checkinHistory.get()[0]).toEqual(
      expect.objectContaining({ action: "claim", txid: "0xclaim" }),
    );
  });

  it("drives eligibility from the contract's canCheckin flag (locks when already checked in)", async () => {
    const { app } = setup({ user: { canCheckin: false } });

    await app.loadAll();

    expect(app.canCheckIn.get()).toBe(false);
  });

  it("unlocks check-in when the contract reports canCheckin", async () => {
    const { app } = setup({ user: { canCheckin: true } });

    await app.loadAll();

    expect(app.canCheckIn.get()).toBe(true);
  });

  it("no-ops check-in (records the unavailable message) when not eligible", async () => {
    const { app, invokes } = setup({ user: { canCheckin: false } });
    await app.loadAll();

    await app.doCheckIn();

    expect(invokes.find((c) => c.operation === "transfer")).toBeUndefined();
    expect(app.latestResult.get()?.summary).toBe("Already checked in for this UTC day");
  });

  it("no-ops claim when there is nothing unclaimed", async () => {
    const { app, invokes } = setup({ user: { unclaimed: 0 } });
    await app.loadAll();

    await app.claimRewards();

    expect(invokes.find((c) => c.operation === "claimRewards")).toBeUndefined();
    expect(app.latestResult.get()?.summary).toBe("No rewards available to claim");
  });

  it("surfaces the next eligible timestamp from getPlatformStats for the countdown", async () => {
    const nextMidnight = Date.now() + 50_000;
    const { app } = setup({ platform: { nextMidnight } });

    await app.loadAll();

    expect(app.nextUtcMidnight.get()).toBe(nextMidnight);
  });

  it("requires a wallet before submitting a check-in", async () => {
    const { app, invokes } = setup({ wallet: null });
    // No wallet: loadAll returns early leaving the unknown (not-yet-loaded)
    // status, so doCheckIn proceeds past the eligibility guard and fails at the
    // wallet check.
    await app.loadAll();
    await expect(app.doCheckIn()).rejects.toThrow("Connect your Neo wallet to continue");
    expect(invokes.find((c) => c.operation === "transfer")).toBeUndefined();
  });

  it("starts with eligibility unknown and only flips after the first load", async () => {
    const { app } = setup({ user: { canCheckin: true } });

    // Before any load, eligibility is NOT assumed true (so the CTA stays gated).
    expect(app.hasLoadedStatus.get()).toBe(false);
    expect(app.canCheckIn.get()).toBe(false);

    await app.loadAll();

    expect(app.hasLoadedStatus.get()).toBe(true);
    expect(app.canCheckIn.get()).toBe(true);
  });

  it("hydrates activity history from the on-chain CheckedIn / RewardsClaimed logs", async () => {
    const { app } = setup({
      checkedInEvents: [
        {
          txid: "0xpastcheckin",
          block_time: "2026-06-10T08:00:00.000Z",
          state: [
            { value: ME_HASH },
            { value: "5" }, // streak
            { value: "0" }, // reward
            { value: "0" },
          ],
        },
        // An event for a DIFFERENT user must be filtered out.
        {
          txid: "0xotheruser",
          block_time: "2026-06-09T08:00:00.000Z",
          state: [
            { value: addressToScriptHash("NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv") },
            { value: "9" },
            { value: "0" },
            { value: "0" },
          ],
        },
      ],
      claimedEvents: [
        {
          txid: "0xpastclaim",
          block_time: "2026-06-11T08:00:00.000Z",
          state: [
            { value: ME_HASH },
            { value: "100000000" }, // amount (1 GAS)
            { value: "100000000" },
          ],
        },
      ],
    });

    await app.loadAll();

    const history = app.checkinHistory.get();
    const txids = history.map((h) => h.txid);
    expect(txids).toContain("0xpastcheckin");
    expect(txids).toContain("0xpastclaim");
    // The other user's event is never shown.
    expect(txids).not.toContain("0xotheruser");
    // Newest-first by block_time: the claim (June 11) precedes the check-in (June 10).
    expect(history[0]?.txid).toBe("0xpastclaim");
  });
});
