import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-badge-define", permission: "badges" },
  async ({ appId, params }) => {
    const badgeId = String(params.badge_id ?? params.badgeId ?? "").trim();
    if (!badgeId) throw new Error("badge_id required");

    const metadata = params.metadata;
    if (!metadata || typeof metadata !== "object") throw new Error("metadata required");

    return buildInvocationIntent(CONTRACT_HASH, "DefineBadge", [
      { type: "String", value: appId },
      { type: "String", value: badgeId },
      { type: "String", value: JSON.stringify(metadata) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
