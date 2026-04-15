import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-badge-list", permission: "badges", cacheable: true },
  async ({ appId, userId }) => {
    return invokeOSContractCached(CONTRACT_HASH, "GetBadges", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
