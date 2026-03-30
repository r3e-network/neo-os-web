import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_GAME_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-game-settle", permission: "games" },
  async ({ appId, params }) => {
    const poolId = String(params.pool_id ?? params.poolId ?? "").trim();
    if (!poolId) throw new Error("pool_id required");

    const winnerId = String(params.winner_id ?? params.winnerId ?? "").trim();
    if (!winnerId) throw new Error("winner_id required");

    return buildInvocationIntent(CONTRACT_HASH, "Settle", [
      { type: "String", value: appId },
      { type: "Integer", value: poolId },
      { type: "Hash160", value: winnerId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
