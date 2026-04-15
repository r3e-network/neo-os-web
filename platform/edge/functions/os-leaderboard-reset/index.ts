import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-leaderboard-reset", permission: "leaderboard" },
  async ({ appId }) => {
    return buildInvocationIntent(CONTRACT_HASH, "ResetLeaderboard", [
      { type: "String", value: appId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
