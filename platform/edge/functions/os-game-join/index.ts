import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-game-join", permission: "games" },
  async ({ appId, userId, params }) => {
    const poolId = String(params.pool_id ?? params.poolId ?? "").trim();
    if (!poolId) throw new Error("pool_id required");

    return buildInvocationIntent(CONTRACT_HASH, "JoinPool", [
      { type: "String", value: appId },
      { type: "Integer", value: poolId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
