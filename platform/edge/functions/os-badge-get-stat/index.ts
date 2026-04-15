import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-badge-get-stat", permission: "badges" },
  async ({ appId, userId, params }) => {
    const statKey = String(params.stat_key ?? params.statKey ?? "").trim();
    if (!statKey) throw new Error("stat_key required");

    return invokeOSContract(CONTRACT_HASH, "GetStat", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "String", value: statKey },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
