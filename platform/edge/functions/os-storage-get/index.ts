import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_STORAGE_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-storage-get", permission: "storage" },
  async ({ appId, params }) => {
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");

    return invokeOSContract(CONTRACT_HASH, "Get", [
      { type: "String", value: appId },
      { type: "String", value: key },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
