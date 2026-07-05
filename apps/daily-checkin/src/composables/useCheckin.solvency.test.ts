import { describe, expect, it, vi } from "vitest";

import { useCheckin, FIXED8 } from "./useCheckin";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x25db219a701a2b23130788723fcf9a2e76857235";
const ALICE_HASH = addressToScriptHash(ALICE);

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

interface ChainFixtures {
  /** Connected user's unclaimed reward (base-unit GAS). */
  unclaimed?: number;
  /** Whether the user can check in this UTC day. */
  canCheckin?: boolean;
  /** The contract's own GAS balance = the reward pool (base-unit GAS). */
  poolBalance?: number;
  /** Whether the contract reports paused. */
  paused?: boolean;
}

/**
 * Minimal ChainService stand-in. Reads return the configured fixtures; the
 * GAS `balanceOf` read (scriptHash GAS) returns the reward pool, the contract
 * methods return the per-user / platform state. Writes resolve successfully so
 * a non-guarded path could be exercised — the tests assert the guards prevent
 * the write entirely.
 */
function makeChain(s: ChainFixtures) {
  const invoke = vi.fn(
    async (
      _op: string,
      _args?: unknown[],
      _options?: Record<string, unknown>,
    ) => ({ txid: "0xtx", success: true, event: { state: [] as unknown[] } }),
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    switch (op) {
      case "getCheckInStateForFrontend":
        return {
          currentStreak: "6",
          highestStreak: "6",
          lastCheckinDay: "0",
          unclaimed: String(s.unclaimed ?? 0),
          totalCheckins: "6",
          currentDay: "1",
        };
      case "getCheckinStatus":
        return { canCheckin: s.canCheckin ?? true };
      case "getUserStatsDetails":
        return { claimed: "0" };
      case "getPlatformStats":
        return {
          totalUsers: "10",
          totalCheckins: "100",
          totalRewarded: "0",
          checkInFee: "100000",
          weekReward: String(1 * FIXED8),
          twoWeekReward: String(2 * FIXED8),
          currentUtcDay: "1",
          nextMidnight: String(Date.now() + 3_600_000),
        };
      case "isPaused":
        return s.paused ?? false;
      case "rewardPool":
        // The contract's authoritative reward-pool report (preferred read).
        return String(s.poolBalance ?? 0);
      case "balanceOf":
        // GAS balanceOf(contract) — the legacy fallback, equals the pool.
        return String(s.poolBalance ?? 0);
      default:
        return "0";
    }
  });

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    invoke,
    read,
    listEvents: vi.fn(async () => []),
  } as unknown as ChainService;
  return { chain, invoke, read };
}

describe("useCheckin — reward-pool solvency + pause gating", () => {
  it("flags the pool as underfunded when its balance is below the smallest milestone reward", async () => {
    // Pool holds 0.015 GAS but a day-7 reward is 1 GAS — ~66x short.
    const { chain } = makeChain({ poolBalance: 1_500_000, unclaimed: 0 });
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-dailycheckin" },
    );
    const app = useCheckin({ app: framework, t });
    await app.loadAll();

    expect(app.rewardPoolBalance.get()).toBe(1_500_000);
    expect(app.rewardsUnderfunded.get()).toBe(true);
    expect(app.isPaused.get()).toBe(false);
  });

  it("does NOT flag underfunded when the pool can cover the milestone reward", async () => {
    const { chain } = makeChain({ poolBalance: 5 * FIXED8, unclaimed: 0 });
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-dailycheckin" },
    );
    const app = useCheckin({ app: framework, t });
    await app.loadAll();

    expect(app.rewardsUnderfunded.get()).toBe(false);
  });

  it("blocks claimRewards (no invoke) when the pool cannot cover the accrued reward", async () => {
    // User has 1 GAS unclaimed but the pool holds only 0.01 GAS.
    const { chain, invoke } = makeChain({ unclaimed: 1 * FIXED8, poolBalance: 1_000_000 });
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-dailycheckin" },
    );
    const app = useCheckin({ app: framework, t });
    await app.loadAll();

    expect(app.claimableButUnfunded.get()).toBe(true);

    await app.claimRewards();
    // The guard short-circuits before any on-chain claim invoke.
    expect(invoke.mock.calls.some((c) => c[0] === "claimRewards")).toBe(false);
  });

  it("allows claimRewards to invoke when the pool covers the accrued reward", async () => {
    const { chain, invoke } = makeChain({ unclaimed: 1 * FIXED8, poolBalance: 5 * FIXED8 });
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-dailycheckin" },
    );
    const app = useCheckin({ app: framework, t });
    await app.loadAll();

    expect(app.claimableButUnfunded.get()).toBe(false);

    await app.claimRewards();
    expect(invoke.mock.calls.some((c) => c[0] === "claimRewards")).toBe(true);
  });

  it("surfaces the paused flag and blocks check-in (no transfer) when paused", async () => {
    const { chain, invoke } = makeChain({ paused: true, canCheckin: true, poolBalance: 5 * FIXED8 });
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-dailycheckin" },
    );
    const app = useCheckin({ app: framework, t });
    await app.loadAll();

    expect(app.isPaused.get()).toBe(true);

    await app.doCheckIn();
    // The paused guard short-circuits before the check-in GAS transfer.
    expect(invoke.mock.calls.some((c) => c[0] === "transfer")).toBe(false);
  });
});
