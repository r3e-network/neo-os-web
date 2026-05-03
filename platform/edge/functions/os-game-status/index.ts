import { getKernelHash } from "../_shared/kernel-rpc.ts";
import {
  createOSHandler,
  invokeOSContractCached,
  parseInvokeResultValue,
} from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-game-status", permission: "games", cacheable: true },
  async ({ appId, params, policy }) => {
    const poolId = String(params.pool_id ?? params.poolId ?? "").trim();
    if (!poolId) throw new Error("pool_id required");

    if (poolId === "current" && policy?.contractHash) {
      try {
        const result = await invokeOSContractCached(policy.contractHash, "getGameStatus", []);
        return parseInvokeResultValue(result);
      } catch (_err) {
        // Fall through to the generic empty state when the miniapp contract
        // does not expose the Last Survivor-style status ABI.
      }
    }

    try {
      return await invokeOSContractCached(CONTRACT_HASH, "GetPoolState", [
        { type: "String", value: appId },
        { type: "Integer", value: poolId },
      ]);
    } catch (_err) {
      return {
        poolId,
        appId,
        status: "open",
        playerCount: 0,
        totalBets: "0",
      };
    }
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
