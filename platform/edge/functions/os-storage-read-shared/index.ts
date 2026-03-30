import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_STORAGE_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-storage-read-shared", permission: "storage" },
  async ({ appId, params }) => {
    const ownerAppId = String(params.owner_app_id ?? params.ownerAppId ?? "").trim();
    if (!ownerAppId) throw new Error("owner_app_id required");

    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");

    return invokeOSContract(CONTRACT_HASH, "ReadShared", [
      { type: "String", value: appId },
      { type: "String", value: ownerAppId },
      { type: "String", value: key },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
