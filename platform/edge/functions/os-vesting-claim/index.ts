import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-vesting-claim", permission: "vesting" },
  async ({ appId, userId, params }) => {
    const streamId = String(params.stream_id ?? params.streamId ?? "").trim();
    if (!streamId) throw new Error("stream_id required");

    return buildInvocationIntent(CONTRACT_HASH, "Claim", [
      { type: "String", value: appId },
      { type: "String", value: streamId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
