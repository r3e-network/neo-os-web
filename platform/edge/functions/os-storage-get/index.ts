import { OS_CONTRACTS } from "../_shared/os-contracts.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-get", permission: "storage", cacheable: true },
  async ({ appId, params }) => {
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");

    return invokeOSContractCached(OS_CONTRACTS.storage, "Get", [
      { type: "String", value: appId },
      { type: "String", value: key },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
