import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_STORAGE_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-storage-grant-access", permission: "storage" },
  async ({ appId, params }) => {
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");

    const grantee = String(params.grantee ?? params.grantee_app_id ?? "").trim();
    if (!grantee) throw new Error("grantee required");

    return buildInvocationIntent(CONTRACT_HASH, "GrantReadAccess", [
      { type: "String", value: appId },
      { type: "String", value: key },
      { type: "String", value: grantee },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
