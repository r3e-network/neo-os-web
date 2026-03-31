import { OS_CONTRACTS } from "../_shared/os-contracts.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-badge-award", permission: "badges" },
  async ({ appId, userId, params }) => {
    const badgeId = String(params.badge_id ?? params.badgeId ?? "").trim();
    if (!badgeId) throw new Error("badge_id required");

    return buildInvocationIntent(OS_CONTRACTS.badge, "AwardBadge", [
      { type: "String", value: appId },
      { type: "String", value: badgeId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
