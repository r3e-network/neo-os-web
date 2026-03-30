import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_BADGE_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-badge-revoke", permission: "badges" },
  async ({ appId, userId, params }) => {
    const badgeId = String(params.badge_id ?? params.badgeId ?? "").trim();
    if (!badgeId) throw new Error("badge_id required");

    return buildInvocationIntent(CONTRACT_HASH, "RevokeBadge", [
      { type: "String", value: appId },
      { type: "String", value: badgeId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
