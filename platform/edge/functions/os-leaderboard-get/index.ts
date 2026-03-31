import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_LEADERBOARD_SERVICE_HASH") ?? "";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const handler = createOSHandler(
  { scopeName: "os-leaderboard-get", permission: "leaderboard", cacheable: true },
  async ({ appId, params }) => {
    let limit = Number(params.limit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    return invokeOSContractCached(CONTRACT_HASH, "GetLeaderboard", [
      { type: "String", value: appId },
      { type: "Integer", value: String(Math.floor(limit)) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
