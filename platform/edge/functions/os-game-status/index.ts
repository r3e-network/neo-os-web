import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_GAME_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-game-status", permission: "games" },
  async ({ appId, params }) => {
    const poolId = String(params.pool_id ?? params.poolId ?? "").trim();
    if (!poolId) throw new Error("pool_id required");

    return invokeOSContract(CONTRACT_HASH, "GetPoolState", [
      { type: "String", value: appId },
      { type: "String", value: poolId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
