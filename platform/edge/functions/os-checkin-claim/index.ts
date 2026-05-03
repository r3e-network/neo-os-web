import { normalizeUInt160 } from "../_shared/contracts.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-checkin-claim", permission: "checkin" },
  async ({ policy, userId }) => {
    const contractHash = policy?.contractHash;
    if (!contractHash) throw new Error("checkin contract hash not configured");
    return buildInvocationIntent(normalizeUInt160(contractHash), "claimRewards", [
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
