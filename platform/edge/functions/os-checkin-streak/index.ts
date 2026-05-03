import {
  createOSHandler,
  invokeOSContractCached,
  parseInvokeResultValue,
} from "../_shared/os-service.ts";

function toNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function toGas(value: unknown): string {
  const raw = toNumber(value);
  return String(raw / 100000000);
}

export const handler = createOSHandler(
  { scopeName: "os-checkin-streak", permission: "checkin", cacheable: true },
  async ({ policy, userId }) => {
    const contractHash = policy?.contractHash;
    if (!contractHash) throw new Error("checkin contract hash not configured");

    const [userStatsRaw, platformStatsRaw] = await Promise.all([
      invokeOSContractCached(contractHash, "getUserStats", [
        { type: "Hash160", value: userId },
      ]),
      invokeOSContractCached(contractHash, "getPlatformStats", []),
    ]);

    const userStats = parseInvokeResultValue(userStatsRaw);
    const platformStats = parseInvokeResultValue(platformStatsRaw) as Record<string, unknown> | null;
    const stats = Array.isArray(userStats) ? userStats : [];

    return {
      currentStreak: toNumber(stats[0]),
      highestStreak: toNumber(stats[1]),
      totalCheckins: toNumber(stats[5]),
      lastCheckinTime: toNumber(stats[2]),
      unclaimedRewards: toGas(stats[3]),
      totalClaimed: toGas(stats[4]),
      totalGlobalCheckins: toNumber(platformStats?.totalCheckins),
      totalGlobalUsers: toNumber(platformStats?.totalUsers),
      totalGlobalRewarded: toGas(platformStats?.totalRewarded),
    };
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
