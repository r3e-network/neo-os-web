import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_CHECKIN_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-checkin-claim", permission: "checkin" },
  async ({ appId, userId }) => {
    return buildInvocationIntent(CONTRACT_HASH, "ClaimRewards", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
