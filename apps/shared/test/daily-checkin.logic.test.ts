import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GAS_HASH } from "@shared/constants/rpc";
import {
  findDailyCheckinNotification,
  isPendingDailyCheckinOperation,
  readDailyCheckinTransactionOutcome,
  requireCanonicalDailyCheckinContext,
  type PendingDailyCheckinOperation,
} from "../../daily-checkin/src/daily-checkin-safety";
import { CHECKIN_MEMO, MILESTONES } from "../../daily-checkin/src/composables/useCheckin";

const APP = path.resolve(process.cwd(), "../daily-checkin");
const CONTRACT = "0x25db219a701a2b23130788723fcf9a2e76857235";
const GAS = GAS_HASH.toLowerCase();
const ACTOR = "0x1111111111111111111111111111111111111111";
const TXID = `0x${"ab".repeat(32)}`;

function source(relativePath: string): string {
  return readFileSync(path.join(APP, relativePath), "utf8");
}

function pending(overrides: Partial<PendingDailyCheckinOperation> = {}): PendingDailyCheckinOperation {
  return {
    version: 1,
    kind: "checkin",
    network: "mainnet",
    contractHash: CONTRACT,
    gasHash: GAS,
    actorHash: ACTOR,
    txid: TXID,
    createdAt: Date.now(),
    feeRaw: "100000",
    beforeStreak: "6",
    beforeLastCheckinDay: "20644",
    beforeUserCheckins: "12",
    beforeUnclaimedRaw: "0",
    beforeClaimedRaw: "0",
    beforeGlobalCheckins: "100",
    beforeGlobalRewardedRaw: "0",
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Daily Check-in canonical business rules", () => {
  it("uses the deployed Fixed8 terms and exact check-in memo", () => {
    expect(CHECKIN_MEMO).toBe("miniapp-dailycheckin:checkin");
    expect(MILESTONES).toEqual([
      { day: 7, reward: 0.01, cumulative: 0.01 },
      { day: 14, reward: 0.02, cumulative: 0.03 },
    ]);
  });

  it("pins launch, wallet network, canonical contract, and GAS together", async () => {
    const app = {
      platform: { launch: { network: "neo-n3-mainnet" } },
      chain: {
        detectNetwork: vi.fn(async () => "mainnet"),
        contractAddress: { get: () => CONTRACT },
      },
    };
    await expect(requireCanonicalDailyCheckinContext(app as never)).resolves.toEqual({
      network: "mainnet",
      contractHash: CONTRACT,
      gasHash: GAS,
    });

    app.chain.detectNetwork.mockResolvedValueOnce("testnet");
    await expect(requireCanonicalDailyCheckinContext(app as never)).rejects.toThrow(
      "dailyCheckinContextMismatch",
    );
  });

  it("rejects incomplete, non-integer, and non-transaction pending records", () => {
    expect(isPendingDailyCheckinOperation(pending())).toBe(true);
    expect(isPendingDailyCheckinOperation(pending({ actorHash: "" }))).toBe(false);
    expect(isPendingDailyCheckinOperation(pending({ beforeStreak: "6.5" }))).toBe(false);
    expect(isPendingDailyCheckinOperation(pending({ txid: "0x1234" }))).toBe(false);
    expect(isPendingDailyCheckinOperation({
      ...pending(),
      kind: "claim",
      feeRaw: undefined,
      claimAmountRaw: "2000000",
    })).toBe(true);
  });

  it("drives eligibility from contract status rather than a local-day guess", () => {
    const composable = source("src/composables/useCheckin.ts");
    expect(composable).toContain("status.canCheckin");
    expect(composable).toContain("status.streakWillReset");
    expect(composable).toContain("platform.nextMidnight");
    expect(composable).not.toMatch(/Math\.floor\(Date\.now\(\)\s*\/\s*MS_PER_DAY\)/);
  });
});

describe("Daily Check-in application-log truth", () => {
  it("accepts HALT notifications from the exact contracts and rejects the wrong event", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: CONTRACT,
            eventname: "CheckedIn",
            state: {
              type: "Array",
              value: [
                { type: "ByteString", value: "ERERERERERERERERERERERERERE=" },
                { type: "Integer", value: "7" },
                { type: "Integer", value: "1000000" },
              ],
            },
          }],
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const outcome = await readDailyCheckinTransactionOutcome(pending());
    expect(outcome.state).toBe("halt");
    expect(findDailyCheckinNotification(outcome, CONTRACT, "CheckedIn")).not.toBeNull();
    expect(findDailyCheckinNotification(outcome, CONTRACT, "RewardsClaimed")).toBeNull();
  });

  it("treats FAULT as terminal chain evidence", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(readDailyCheckinTransactionOutcome(pending())).resolves.toEqual({
      state: "fault",
      notifications: [],
    });
  });
});
