import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-payment-balance", permission: "payments", cacheable: true },
  async ({ appId, userId }) => {
    return invokeOSContractCached(CONTRACT_HASH, "GetBalance", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
