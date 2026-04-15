import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-script-list", permission: "scripts" },
  async ({ appId }) => {
    return invokeOSContract(CONTRACT_HASH, "GetScript", [
      { type: "String", value: appId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
