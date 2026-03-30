import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_STORAGE_SERVICE_HASH") ?? "";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const handler = createOSHandler(
  { scopeName: "os-storage-list", permission: "storage" },
  async ({ appId, params }) => {
    const prefix = String(params.prefix ?? "").trim();

    let limit = Number(params.limit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    return invokeOSContract(CONTRACT_HASH, "ListKeys", [
      { type: "String", value: appId },
      { type: "String", value: prefix },
      { type: "Integer", value: String(Math.floor(limit)) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
