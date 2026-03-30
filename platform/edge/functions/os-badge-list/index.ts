import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_BADGE_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-badge-list", permission: "badges" },
  async ({ appId, userId }) => {
    return invokeOSContract(CONTRACT_HASH, "GetBadges", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
