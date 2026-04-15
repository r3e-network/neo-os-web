import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-game-status", permission: "games", cacheable: true },
  async ({ appId, params }) => {
    const poolId = String(params.pool_id ?? params.poolId ?? "").trim();
    if (!poolId) throw new Error("pool_id required");

    return invokeOSContractCached(CONTRACT_HASH, "GetPoolState", [
      { type: "String", value: appId },
      { type: "Integer", value: poolId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
