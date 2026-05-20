import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Audit fix E-7: previously returned an empty array unconditionally, which is
// indistinguishable from "this app has no leaderboard entries yet". Now routes
// to the kernel's `GetLeaderboardTop(appId, limit)` read.

export const handler = createOSHandler(
  { scopeName: "os-leaderboard-get", permission: "leaderboard", cacheable: true },
  async ({ appId, params }) => {
    let limit = Number(params.limit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const contractHash = getKernelHash();
    if (!contractHash) {
      throw new Error("leaderboard service contract hash not configured");
    }
    const result = await invokeOSContractCached(contractHash, "GetLeaderboardTop", [
      { type: "String", value: appId },
      { type: "Integer", value: String(limit) },
    ]);
    if (Array.isArray(result)) {
      return result as Array<{ user: string; score: string }>;
    }
    return [] as Array<{ user: string; score: string }>;
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
