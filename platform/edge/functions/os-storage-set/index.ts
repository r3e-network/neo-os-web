import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_STORAGE_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-storage-set", permission: "storage" },
  async ({ appId, params }) => {
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");

    const value = params.value;
    if (value === undefined || value === null) throw new Error("value required");

    return buildInvocationIntent(CONTRACT_HASH, "Set", [
      { type: "String", value: appId },
      { type: "String", value: key },
      { type: "String", value: String(value) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
